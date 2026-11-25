import { useEffect, useId, useRef, useState } from 'react';
import styles from './PlayApp.module.css';

interface BattlePlaybackProps {
  readonly log: readonly string[];
  readonly turns: number;
  /** A apresentação conclui o combate; o writer efetiva as recompensas após onFinished. */
  readonly playing: boolean;
  readonly onFinished: () => void;
  /** Informar apenas o índice visível: não modifica nem recalcula o combate. */
  readonly onProgress?: (visible:number) => void;
  /** Ginásios reutilizam o diário inteiro, mas só revelam linhas novas. */
  readonly initialVisible?:number;
  /** Online rounds may end on an impact; keep that final frame visible before advancing. */
  readonly holdLastFrame?:boolean;
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
export function BattlePlayback({log,turns,playing,onFinished,onProgress,
  initialVisible=0,holdLastFrame=false}:BattlePlaybackProps) {
  const [visible,setVisible]=useState(()=>playing
    ?Math.min(log.length,Math.max(0,Math.floor(initialVisible))+1):log.length);
  const [skipped,setSkipped]=useState(false);
  const finishRef=useRef(onFinished);finishRef.current=onFinished;
  const [speed,setSpeed]=useState<1|2>(1);
  const [paused,setPaused]=useState(false);
  const [assistive,setAssistive]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const helpId=useId();
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
    // Leitura assistiva dá ao leitor de tela mais tempo para narrar cada linha.
    const timer=window.setTimeout(()=>setVisible(n=>Math.min(log.length,n+1)),
      (assistive?3000:900)/speed);
    return ()=>window.clearTimeout(timer);
  },[inProgress,paused,speed,assistive,visible,log.length]);

  useEffect(()=>{
    if(!playing||visible<log.length)return;
    if(!holdLastFrame||skipped){finishRef.current();return;}
    const timer=window.setTimeout(()=>finishRef.current(),(assistive?3000:900)/speed);
    return()=>window.clearTimeout(timer);
  },[playing,visible,log.length,holdLastFrame,skipped,assistive,speed]);

  useEffect(()=>{
    if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;
  },[visible]);

  useEffect(()=>{
    onProgress?.(visible);
  },[visible,onProgress]);

  const lines=log.slice(0,visible);
  const latest=lines.at(-1)??'';
  const turnMatch=/^T(\d+)\s/.exec(latest);
  const shownTurn=turnMatch?Number(turnMatch[1]):0;
  const isConcentrating=/\busou Concentrar\b/.test(latest);
  const liveMessage=!inProgress
    ?'Apresentação concluída. Resultado pronto para ser confirmado.'
    :paused?'Apresentação pausada no registro '+visible+' de '+log.length+'.'
      :assistive?'Registro '+visible+' de '+log.length+'. '+latest
        :isConcentrating?'Concentrar. '+latest:'';
  return (
    <section className={styles.panel+' '+styles.battlePlaybackPanel}
      aria-label="Diário de combate" aria-describedby={helpId} tabIndex={0}
      onKeyDown={event=>{
        if(event.currentTarget!==event.target||!inProgress)return;
        if(event.key===' '){
          event.preventDefault();
          setPaused(value=>!value);
        }else if(event.key==='ArrowRight'&&paused){
          event.preventDefault();
          setVisible(value=>Math.min(log.length,value+1));
        }
      }}>
      <h2>Diário de combate</h2>
      <div className={styles.battlePlaybackMeta}>
        <div><small>Tempo de apresentação</small><strong aria-label="Cronômetro da apresentação" role="timer" aria-live="off" data-testid="battle-clock">{fmt(elapsed)}</strong></div>
        <div><small>Turno exibido</small><strong>{Math.min(turns,shownTurn)} / {turns}</strong></div>
        <div><small>Registro</small><strong data-testid="battle-line-progress">{visible} / {log.length}</strong></div>
      </div>
      <div className={styles.battlePlaybackProgress} role="progressbar" aria-label="Andamento da apresentação"
        aria-valuemin={0} aria-valuemax={log.length}
        aria-valuenow={visible}>
        <span style={{width:(log.length?visible/log.length*100:100)+'%'}} />
      </div>
      {playing&&(
        <div className={styles.battlePlaybackControls} role="group" aria-label="Controles do diário">
          <button type="button" className={styles.secondary}
            onClick={()=>setPaused(value=>!value)} disabled={!inProgress}
            aria-pressed={paused}>
            {paused?'Continuar':'Pausar'}
          </button>
          <button type="button" className={styles.secondary}
            aria-label="Alterar velocidade da apresentação"
            onClick={()=>setSpeed(value=>value===1?2:1)} disabled={!inProgress}>
            Velocidade {speed}×
          </button>
          <button type="button" className={styles.secondary}
            aria-pressed={assistive}
            onClick={()=>setAssistive(value=>!value)} disabled={!inProgress}>
            {assistive?'Desativar leitura assistiva':'Ativar leitura assistiva'}
          </button>
          <button type="button" className={styles.secondary}
            onClick={()=>setVisible(value=>Math.min(log.length,value+1))}
            disabled={!inProgress||!paused}>Avançar uma linha</button>
          <button type="button" className={styles.textButton}
            onClick={()=>{setSkipped(true);setVisible(log.length);}} disabled={!inProgress}>Pular apresentação</button>
        </div>
      )}
      <p id={helpId} className={styles.battlePlaybackHelp}>
        Controle por teclado: Tab para focar o painel, Espaço para pausar ou continuar
        e seta para a direita para avançar uma linha quando pausado.
        A leitura assistiva reduz o ritmo e anuncia cada registro.
      </p>
      <ol ref={listRef} className={styles.battleLog} role="log"
        aria-live="off" aria-label="Registros da batalha"
        data-testid="battle-log">
        {lines.map((line,i)=><li key={i} className={styles.battleLogEntry}>{line}</li>)}
      </ol>
      <p className={styles.disclaimer} data-testid="battle-playback-status">
        {inProgress ? paused?'Apresentação pausada.': 'Combate em andamento · '+latest
          : 'Apresentação concluída · resultado revelado ao jogador.'}
      </p>
      <p className={styles.battleSrOnly} role="status" aria-live="polite"
        aria-atomic="true" data-testid="battle-screenreader-status">
        {liveMessage}
      </p>
      <p className={styles.disclaimer}>O cronômetro mede o tempo de exibição dos ataques. O cálculo do encontro é imediato, mas o prêmio só é confirmado depois do fim da apresentação; reassistir não concede recompensas adicionais.</p>
    </section>
  );
}
