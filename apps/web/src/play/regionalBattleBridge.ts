/**
 * D-064K: resolução regional READ-ONLY diretamente do snapshot do jogador.
 *
 * Esta camada reconstrói o líder com os bônus de Treinador/equipamentos,
 * insígnias, afinidade e os quatro golpes, exatamente como a Arena atual,
 * mas não cria comandos de reward, não consome Poké Bolas, nem grava dados.
 * Ao integrar o novo writer, reutilizar esta validação em vez de confiar
 * em resultado/outcome recebido da interface.
 */
import {
  STATS,zeroStats,KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,
  KANTO_SUPPORT_MOVES,LEGACY_BADGES,LEGACY_ITEMS,
  trainerTotals,pokemonFinalStats,effectiveLegacyTitle,
  pokemonMoveSlots,previewKantoRegionalBattle,applyRegionalBattleDraft
} from '@kanto/game-core';
import type {
  Combatant,StatValues,RewardJournal,KantoRegionalPreviewResult,
  KantoRegionalBattlePreview,KantoBallId
} from '@kanto/game-core';

type ObjectRecord=Record<string,unknown>;
const object=(v:unknown):v is ObjectRecord=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const intRange=(v:unknown,min:number,max:number):v is number=>
  typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const fail=(reason:string):KantoRegionalPreviewResult=>({status:'blocked',reason});

/** Nunca grava no journal, mesmo se o encontro for perdido ou concluído. */
export function previewRegionalBattleFromJournal(
  journal:RewardJournal,regionId:number,seed:number
):KantoRegionalPreviewResult {
  if(!journal||typeof journal.raw!=='string')
    return fail('Progresso indisponível para simulação.');
  try {
    const source:unknown=JSON.parse(journal.raw);
    if(!object(source)||!object(source.trainer)||!object(source.trainer.manual)
      ||!Array.isArray(source.roster)||!Array.isArray(source.team)
      ||!Array.isArray(source.badges)||!Array.isArray(source.seen)
      ||!intRange(source.wins,0,Number.MAX_SAFE_INTEGER))
      return fail('Save inválido para simulação.');
    const trainer=source.trainer;
    const trainerManualValues=trainer.manual as ObjectRecord;
    const badgeIds=source.badges as unknown[];
    if(!intRange(trainer.level,1,100))return fail('Nível de Treinador inválido.');
    const uid=source.team[0];
    const active=source.roster.find(v=>object(v)&&v.uid===uid);
    if(!object(active)||!intRange(active.pokemonId,1,151)
      ||!intRange(active.level,1,100)||!intRange(active.affinity,0,100)
      ||!object(active.manual)||!intRange(uid,1,Number.MAX_SAFE_INTEGER))
      return fail('Pokémon líder inválido.');
    const species=KANTO_BATTLE_SPECIES[active.pokemonId];
    if(!species)return fail('Espécie ainda não disponível.');
    const trainerManual:StatValues=zeroStats();
    const pokemonManual:StatValues=zeroStats();
    for(const stat of STATS){
      const value=trainerManualValues[stat]??0;
      const amount=active.manual[stat]??0;
      if(!intRange(value,0,40)||!intRange(amount,0,200))
        return fail('Atributos inválidos para simulação.');
      trainerManual[stat]=value;
      pokemonManual[stat]=amount;
    }
    const equipped=object(trainer.equipped)?trainer.equipped:{};
    const items=LEGACY_ITEMS.filter(item=>equipped[item.slot]===item.id);
    const badges=LEGACY_BADGES.filter(badge=>badgeIds.includes(badge.id));
    const title=effectiveLegacyTitle(trainer.title,source.wins,
      source.seen.length,source.badges.length);
    const totals=trainerTotals({
      manual:trainerManual,
      equipment:items.map(item=>({slot:item.slot,stats:item.stats})),
      activeTitle:title.stats,
      badges:badges.map(badge=>({id:badge.id,stats:badge.stats}))
    });
    const selectedName=typeof active.moveName==='string'?active.moveName:'';
    const names=pokemonMoveSlots(active,species.move.name);
    if(names.length<1||names.length>4
      ||new Set(names).size!==names.length
      ||(selectedName&&selectedName!==names[0]))
      return fail('Golpes equipados inválidos.');
    const moves=names.map(name=>KANTO_BATTLE_MOVES[name]??KANTO_SUPPORT_MOVES[name]);
    if(moves.some(move=>!move)||!moves.some(move=>move!.category!=='status'))
      return fail('É necessário um golpe ofensivo válido.');
    const upgrades=object(active.upgrades)?active.upgrades:{};
    const primary=moves[0]!;
    const rank=upgrades[primary.name]??0;
    if(!intRange(rank,0,10))return fail('Aprimoramento inválido.');
    const leader:Combatant={
      speciesId:species.id,name:species.name,level:active.level,
      types:species.types,
      stats:pokemonFinalStats(species.base,active.level,pokemonManual,totals,active.affinity),
      move:primary,rank,moves:moves as NonNullable<Combatant['moves']>,
      ranks:upgrades as NonNullable<Combatant['ranks']>
    };
    return previewKantoRegionalBattle(trainer.level,regionId,leader,seed);
  } catch {
    return fail('Não foi possível simular este encontro.');
  }
}


/**
 * D-064L · Dry run da futura transação regional. Esta função NÃO grava no
 * navegador; usa o resultado RECONSTRUÍDO do motor, nunca aceita outcome
 * ou afinidade arbitrários da interface. O journal retornado é hipotético,
 * ainda com a economia legada. Captura por bola só se existir bolso válido.
 */
export type RegionalTransactionDryRun=
  | {readonly status:'ready';readonly preview:KantoRegionalBattlePreview;
     readonly proposedJournal:RewardJournal}
  | {readonly status:'blocked';readonly reason:string};

export function dryRunRegionalBattleTransaction(
  journal:RewardJournal,regionId:number,seed:number,ballId?:KantoBallId
):RegionalTransactionDryRun {
  const result=previewRegionalBattleFromJournal(journal,regionId,seed);
  if(result.status!=='ready')return result;
  let uid:unknown;
  try{
    const game:unknown=JSON.parse(journal.raw);
    uid=object(game)&&Array.isArray(game.team)?game.team[0]:undefined;
  }catch{return{status:'blocked',reason:'Save de simulação inválido.'};}
  if(!intRange(uid,1,Number.MAX_SAFE_INTEGER))
    return{status:'blocked',reason:'UID do líder inválido.'};
  const battle=result.preview.battle;
  const command={
    id:'regional-dry-run-'+(journal.revision+1),
    expectedRevision:journal.revision,
    regionId,seed,activeUid:uid,
    outcome:battle.outcome,
    ...(battle.outcome==='win'&&battle.affinityGain!==null
      ?{affinityGain:battle.affinityGain}:{}),
    ...(ballId?{ballId}:{})
  };
  const proposed=applyRegionalBattleDraft(journal,command);
  return proposed.status==='applied'
    ?{status:'ready',preview:result.preview,proposedJournal:proposed.journal}
    :{status:'blocked',reason:proposed.status==='rejected'
      ?proposed.reason:'A transação experimental já foi processada.'};
}
