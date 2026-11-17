import { useEffect, useRef, useState } from 'react';
import styles from './PlayApp.module.css';

interface BattlePlaybackProps {
  readonly log: readonly string[];
  readonly turns: number;
  /** Somente a apresentação; resultado e recompensas já estão salvos. */
  readonly playing: boolean;
  readonly onFinished: () => void;
}

const fmt=(ms:number):string=>{
  const seconds=Math.floor(ms/1000);
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'
    +String(seconds%60).padStart(2,'0')+'.'
    +String(Math.floor((ms%1000)/100));
};

/**
 * Replay puramente visual: cada entrada do log de combate surge separadamente.
 * Cronômetro = tempo de EXIBIÇÃO (não tempo de cálculo do motor instantâneo).
 * Não emite comandos, não altera RNG, save, recompensas, UIDs ou recibos.
 * Unmount/troca de aba cancela os timers sem perder a batalha salva.
 */
export function BattlePlayback({log,turns,playing,onFinished}:BattlePlaybackProps) {
  const [visible,setVisible]=useState(()=>playing?Math.min(log.length,1):log.length);
  const [speed,setSpeed]=useState<1|2>(1);
  const [paused,setPaused]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const elapsedRef=useRef(0);
  const listRef=useRef<HTMLOListElement|null>(null);
  const inProgress=playing && visible<log.length;

  useEffect(()=>{
    if(!inProgress||paused)return;
    let last=performance.now();
    const timer=window.setInterval(()=>{
      const current=performance.now();
      elapsedRef.current+=Math.max(0,current-last);
      last=current;
      setElapsed(elapsedRef.current);
    },100);
    return ()=>{
      window.clearInterval(timer);
      elapsedRef.current+=Math.max(0,performance.now()-last);
    };
  },[inProgress,paused]);

  useEffect(()=>{
    if(!inProgress||paused)return;
    const timer=window.setTimeout(()=>setVisible(n=>Math.min(log.length,n+1)),900/speed);
    return ()=>window.clearTimeout(timer);
  },[inProgress,paused,speed,visible,log.length]);

  useEffect(()=>{
    if(playing&&visible>=log.length)onFinished();
  },[playing,visible,log.length,onFinished]);

  useEffect(()=>{
    if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;
  },[visible]);

  const lines=log.slice(0,visible);
  const latest=lines.at(-1)??'';
  const turnMatch=/^T(\d+)\s/.exec(latest);
  const shownTurn=turnMatch?Number(turnMatch[1]):0;
  return (
    <section className={styles.panel} aria-label="Diário de combate">
      <h2>Diário de combate</h2>
      <div className={styles.battlePlaybackMeta}>
        <div><small>Tempo de apresentação</small><strong aria-label="Cronômetro da apresentação" data-testid="battle-clock">{fmt(elapsed)}</strong></div>
        <div><small>Turno exibido</small><strong>{Math.min(turns,shownTurn)} / {turns}</strong></div>
        <div><small>Registro</small><strong data-testid="battle-line-progress">{visible} / {log.length}</strong></div>
      </div>
      <div className={styles.battlePlaybackProgress} role="progressbar" aria-label="Andamento da apresentação"
        aria-valuemin={0} aria-valuemax={log.length}
        aria-valuenow={visible}>
        <span style={{width:(log.length?visible/log.length*100:100)+'%'}} />
      </div>
      {playing&&(
        <div className={styles.battlePlaybackControls}>
          <button type="button" className={styles.secondary}
            onClick={()=>setPaused(value=>!value)} disabled={!inProgress}>
            {paused?'Continuar':'Pausar'}
          </button>
          <button type="button" className={styles.secondary}
            aria-label="Alterar velocidade da apresentação"
            onClick={()=>setSpeed(value=>value===1?2:1)} disabled={!inProgress}>
            Velocidade {speed}×
          </button>
          <button type="button" className={styles.textButton}
            onClick={()=>setVisible(log.length)} disabled={!inProgress}>Pular apresentação</button>
        </div>
      )}
      <ol ref={listRef} className={styles.battleLog} aria-label="Diário de combate"
        data-testid="battle-log">
        {lines.map((line,i)=><li key={i} className={styles.battleLogEntry}>{line}</li>)}
      </ol>
      <p className={styles.disclaimer} aria-live="polite" data-testid="battle-playback-status">
        {inProgress ? paused?'Apresentação pausada.':'Combate em andamento · '+latest
          : 'Apresentação concluída · resultado registrado no progresso local.'}
      </p>
      <p className={styles.disclaimer}>O cronômetro mede o tempo de exibição dos ataques. O cálculo da batalha e o registro de recompensas são instantâneos; reproduzir ou pular não concede prêmios novamente.</p>
    </section>
  );
}
