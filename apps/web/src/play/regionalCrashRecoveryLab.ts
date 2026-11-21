/**
 * D-064U: ensaio de recuperação de transação regional somente em RAM.
 *
 * A ordem backup -> candidato -> marcador é testada com falhas injetadas.
 * Não expõe Storage nem chaves reais, não é writer de produção, não realiza
 * rollback no navegador e não aprova a curva econômica experimental.
 */
import {readPlaySave} from './playSave';
import type {PlaySnapshot} from './playSave';

export type RegionalCrashPoint =
  'before-backup'|'after-backup'|'after-candidate'|'after-marker'|'none';
export type RegionalRecoveryResult =
  | {readonly status:'original'|'committed';readonly snapshot:PlaySnapshot}
  | {readonly status:'blocked';readonly reason:string};

const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const valid=(input:unknown):input is PlaySnapshot=>{
  try{
    const data=readPlaySave({getItem:()=>JSON.stringify(input)});
    return data.status==='ready' && data.snapshot.revision===data.snapshot.journal.revision;
  }catch{return false;}
};

/**
 * Slots privados representam uma única sessão hipotética. Qualquer candidato
 * sem marcador não é confirmado. A origem permanece recuperável e intacta.
 * Um marcador sem candidato íntegro bloqueia recuperação automática.
 */
export class RegionalCrashRecoveryLab {
  private readonly original:PlaySnapshot;
  private backup:PlaySnapshot|null=null;
  private candidate:PlaySnapshot|null=null;
  private marker:{revision:number}|null=null;

  constructor(source:PlaySnapshot){
    if(!valid(source))throw Error('Origem inválida para ensaio de recuperação.');
    this.original=copy(source);
  }

  stage(next:PlaySnapshot,at:RegionalCrashPoint):void{
    if(!valid(next)||next.revision<=this.original.revision)
      throw Error('Candidato regional inválido ou obsoleto.');
    if(this.backup!==null||this.candidate!==null||this.marker!==null)
      throw Error('Ensaio já iniciado; não sobrescrever os slots.');
    if(at==='before-backup')return;
    this.backup=copy(this.original);
    if(at==='after-backup')return;
    this.candidate=copy(next);
    if(at==='after-candidate')return;
    this.marker={revision:next.revision};
  }

  recover():RegionalRecoveryResult{
    // Somente quando existe marcador, a simulação pode confirmar o candidato.
    if(this.marker!==null){
      if(this.backup===null||!valid(this.backup)
        ||JSON.stringify(this.backup)!==JSON.stringify(this.original)
        ||this.candidate===null||!valid(this.candidate)
        ||this.candidate.revision!==this.marker.revision)
        return{status:'blocked',reason:'Marcador de commit inconsistente; revisão manual necessária.'};
      return{status:'committed',snapshot:copy(this.candidate)};
    }
    if(this.backup!==null&&(!valid(this.backup)
      ||JSON.stringify(this.backup)!==JSON.stringify(this.original)))
      return{status:'blocked',reason:'Backup inconsistente; revisão manual necessária.'};
    return{status:'original',snapshot:copy(this.original)};
  }

  /** Somente para fixtures de corrupção. Não dá acesso ao Storage real. */
  corruptCandidateForTest():void{
    if(this.candidate!==null)this.candidate={...this.candidate,revision:-1};
  }
}
