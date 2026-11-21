/**
 * D-064T — laboratório de writer regional, estritamente EM MEMÓRIA.
 *
 * Deliberadamente não recebe PlayStorage, Storage, navigator.locks, nem
 * exporta função de commit em navegador. A política econômica D064 permanece
 * experimental e não deve ser publicada no writer real.
 */
import {
  D064_EXPERIMENTAL_ECONOMY_VERSION, inspectKantoBallPocket,
  migrateD064EconomyDraft, migrateD064PocketDraft
} from '@kanto/game-core';
import type {D064PocketMigrationPolicy, KantoBallId, RewardJournal} from '@kanto/game-core';
import {readPlaySave} from './playSave';
import type {PlaySnapshot} from './playSave';
import {dryRunRegionalBattleTransaction} from './regionalBattleBridge';

export interface RegionalLabCommand {
  readonly id:string;
  readonly expectedRevision:number;
  readonly regionId:number;
  readonly seed:number;
  readonly pocketPolicy:D064PocketMigrationPolicy;
  readonly ballId?:KantoBallId;
}
export type RegionalLabOutcome =
  | {readonly status:'applied'|'duplicate';readonly snapshot:PlaySnapshot}
  | {readonly status:'blocked';readonly reason:string};

const record=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const deny=(reason:string):RegionalLabOutcome=>({status:'blocked',reason});

/**
 * Cópia privada para ensaiar transações sem tocar uma chave de save real.
 * O modelo não é um lock cross-tab nem proteção contra alteração de seed:
 * o futuro writer persistente deve continuar sujeito a gate de release.
 */
export class RegionalWriterMemoryLab {
  private snapshot:PlaySnapshot;
  private readonly commands=new Map<string,string>();

  constructor(source:PlaySnapshot){
    const copy=clone(source);
    const inspected=readPlaySave({getItem:()=>JSON.stringify(copy)});
    if(inspected.status!=='ready'||copy.revision!==copy.journal.revision)
      throw new Error('Snapshot inicial inválido para laboratório regional.');
    this.snapshot=copy;
  }

  inspect():PlaySnapshot{return clone(this.snapshot);}

  apply(command:RegionalLabCommand):RegionalLabOutcome{
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(command.id)
      ||!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0
      ||!Number.isSafeInteger(command.regionId)||command.regionId<1||command.regionId>10
      ||!Number.isSafeInteger(command.seed)||command.seed<0||command.seed>0xffffffff
      ||!['legacy-empty','starter-proposal'].includes(command.pocketPolicy)
      ||(command.ballId!==undefined&&!['poke-ball','great-ball','ultra-ball','master-ball'].includes(command.ballId)))
      return deny('Comando regional de laboratório inválido.');
    const fingerprint=JSON.stringify(command);
    const existing=this.commands.get(command.id);
    if(existing!==undefined)
      return existing===fingerprint
        ?{status:'duplicate',snapshot:this.inspect()}
        :deny('ID de comando reutilizado com parâmetros diferentes.');
    if(command.expectedRevision!==this.snapshot.revision)
      return deny('Revisão desatualizada: nenhuma transação aplicada.');

    // Todo estágio é local. Uma falha em migração, combate ou bolso não
    // altera a instância e não registra o ID, permitindo retry corrigido.
    let game:unknown;
    try{game=JSON.parse(this.snapshot.journal.raw);}catch{return deny('Progresso inválido.');}
    if(!record(game)||game.expedition!==null)
      return deny('Expedição ativa ou progresso inválido: encerrar antes do rollout.');
    let staged:RewardJournal=clone(this.snapshot.journal);
    if(game.economyVersion===undefined){
      const xp=migrateD064EconomyDraft(staged,{
        id:'d064-lab-xp-'+staged.revision,
        expectedRevision:staged.revision
      });
      if(xp.status!=='applied')
        return deny(xp.status==='rejected'?xp.reason:'Migração econômica não aplicada.');
      staged=xp.journal;
    }else if(game.economyVersion!==D064_EXPERIMENTAL_ECONOMY_VERSION){
      return deny('Versão econômica desconhecida.');
    }
    const pocket=inspectKantoBallPocket(game.ballPocket);
    if(pocket.status==='invalid')return deny(pocket.reason);
    if(pocket.status==='legacy-untracked'){
      const migration=migrateD064PocketDraft(staged,{
        id:'d064-lab-pocket-'+staged.revision,
        expectedRevision:staged.revision,
        policy:command.pocketPolicy
      });
      if(migration.status!=='applied')
        return deny(migration.status==='rejected'?migration.reason:'Bolso não inicializado.');
      staged=migration.journal;
    }
    const battle=dryRunRegionalBattleTransaction(
      staged,command.regionId,command.seed,command.ballId
    );
    if(battle.status!=='ready')return deny(battle.reason);

    const candidate:PlaySnapshot={
      schemaVersion:2,
      revision:battle.proposedJournal.revision,
      journal:battle.proposedJournal
    };
    const verified=readPlaySave({getItem:()=>JSON.stringify(candidate)});
    if(verified.status!=='ready'||candidate.revision<=this.snapshot.revision
      ||candidate.revision!==candidate.journal.revision)
      return deny('Journal candidato não passou na validação.');
    this.snapshot=clone(candidate); // um único ponto de commit NO MAPA DE MEMÓRIA
    this.commands.set(command.id,fingerprint);
    return{status:'applied',snapshot:this.inspect()};
  }
}
