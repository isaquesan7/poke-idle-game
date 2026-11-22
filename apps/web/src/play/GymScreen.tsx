/**
 * GYM-04A — tela jogável que apenas envia ações ao writer versionado.
 * Nunca fornece HP/SP/outcome/recompensas. O estado exibido é replayado
 * pelo motor a partir do transcript persistido (inclusive após reload).
 */
import {useCallback,useEffect,useRef,useState} from 'react';
import {
  KANTO_GYMS,kantoNextGym,gymChooseAiAction,
  KANTO_BATTLE_SPECIES
} from '@kanto/game-core';
import type {GymBattleState,KantoBattleVisualFrame} from '@kanto/game-core';
import type {LegacySave} from '../storage/legacySave';
import type {PlayAction} from './playSave';
import {replayGymSessionTrace} from './gymSession';
import type {GymSessionV1} from './gymSession';
import {BattleStage} from './BattleStage';
import {BattlePlayback} from './BattlePlayback';
import styles from './GymScreen.module.css';

type Props={
  readonly game:Record<string,unknown>;
  readonly data:LegacySave;
  readonly busy:boolean;
  readonly revision:number;
  readonly onAction:(action:PlayAction)=>void;
};
const isRecord=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
function readSession(value:unknown):GymSessionV1|null{
  if(!isRecord(value)||value.version!==1||typeof value.id!=='string'
    ||!Array.isArray(value.uids)||!Array.isArray(value.actions)
    ||typeof value.gymId!=='string'||typeof value.seed!=='number')return null;
  return value as unknown as GymSessionV1;
}
function art(id:number,alt:string,large=false){
  return <img src={'/assets/pokemon-gifs/poke_'+id+'.gif'} alt={alt}
    loading="eager" className={large?styles.duelPokemon:styles.pokemonArt}/>;
}
function status(value:GymBattleState['player']['fighters'][number]):string{
  const conditions=[value.status,value.confusionTurns?'confuso':null]
    .filter(Boolean);
  return conditions.join(' · ')||'Pronto';
}
export function GymScreen({game,data,busy,revision,onAction}:Props){
  const [selected,setSelected]=useState<readonly number[]>([]);
  const [confirmAbandon,setConfirmAbandon]=useState(false);
  const detailsRef=useRef<HTMLElement|null>(null);
  const finishRef=useRef<HTMLButtonElement|null>(null);
  const previousSession=useRef<string|null>(null);
  const lastSent=useRef<string|null>(null);
  const [automatic,setAutomatic]=useState(false);
  const [presented,setPresented]=useState(0);
  const [progress,setProgress]=useState({key:'',visible:0});
  const session=readSession(game.gymSession);
  const gym=session?KANTO_GYMS.find(g=>g.id===session.gymId):
    kantoNextGym(data.badges);
  let state:GymBattleState|null=null;
  let invalid='';
  let history:readonly import('./gymSession').GymReplayRound[]=[];
  if(session){
    try{
      const trace=replayGymSessionTrace(game,session);
      state=trace.state;
      history=trace.rounds;
    }catch(e){invalid=e instanceof Error?e.message:'Não foi possível validar a sessão.';}
  }
  useEffect(()=>{
    if(!session){previousSession.current=null;lastSent.current=null;return;}
    if(previousSession.current!==session.id){
      previousSession.current=session.id;
      detailsRef.current?.focus({preventScroll:true});
    }else if(state?.outcome!=='ongoing'){
      finishRef.current?.focus({preventScroll:true});
    }
  },[session?.id,revision]);
  useEffect(()=>{setConfirmAbandon(false);},[session?.id]);
  const actionCount=session?.actions.length??0;
  const lastRound=history.at(-1);
  const donePresentation=presented>=actionCount;
  // O primeiro turno é decidido pela mesma IA dos líderes. A cada
  // gravação o replay reconstruído é a fonte de verdade antes da ação
  // seguinte. Pausar não grava no save; recarregar requer retomada explícita.
  useEffect(()=>{
    const currentState=state;
    if(!automatic||!session||!currentState||busy||!donePresentation
      ||currentState.outcome!=='ongoing')return;
    const key=session.id+':'+actionCount;
    if(lastSent.current===key)return;
    const timer=window.setTimeout(()=>{
      if(lastSent.current===key)return;
      lastSent.current=key;
      onAction({type:'gym-turn',sessionId:session.id,
        action:gymChooseAiAction(currentState,'player')});
    },160);
    return ()=>window.clearTimeout(timer);
  },[automatic,session?.id,actionCount,busy,donePresentation,revision]);
  const earned=new Set(data.badges);
  const starting=selected.length===3&&!session;
  const roundKey=(session?.id??'')+':'+actionCount;
  // Callback estável: BattlePlayback emite índice apenas quando progride,
  // evitando loops e sem produzir nenhuma gravação no save.
  const onProgress=useCallback((visible:number)=>{
    setProgress(previous=>previous.key===roundKey&&previous.visible===visible
      ?previous:{key:roundKey,visible});
  },[roundKey]);
  const visible=progress.key===roundKey?progress.visible:0;
  const displayState=lastRound&&!donePresentation
    ?visible>0?lastRound.snapshots[Math.min(visible,lastRound.snapshots.length)-1]
      ??lastRound.before:lastRound.before
    :state;
  const player=displayState?.player.fighters[displayState.player.activeIndex];
  const leader=displayState?.leader.fighters[displayState.leader.activeIndex];
  const latestFrame=lastRound
    ?lastRound.frames.at(donePresentation?-1:Math.max(0,visible-1))
    :null;
  // Antes da primeira linha não antecipamos dano/KO da rodada.
  // O palco regional lê exatamente o mesmo frame e índice do diário.
  const frame:KantoBattleVisualFrame|null=player&&leader?(
    lastRound&&visible>0?latestFrame??null:
    lastRound&&donePresentation?latestFrame??null:{
      kind:'intro',target:null,amount:0,playerHp:player.hp,
      wildHp:leader.hp,playerSp:player.sp,wildSp:leader.sp
    }
  ):null;
  const showingRound=Boolean(automatic&&lastRound&&!donePresentation);
  const renderReserve=(side:'player'|'leader')=>{
    if(!displayState)return null;
    const party=displayState[side];
    return <div className={styles.reserveGroup}
      aria-label={side==='player'?'Seus Pokémon reservas':'Reservas do líder'}>
      <strong>{side==='player'?'Suas reservas':'Reservas de '+(gym?.leader??'líder')}</strong>
      <div className={styles.reserveCards}>
        {party.fighters.map((fighter,index)=>{
          if(index===party.activeIndex)return null;
          return <div key={index} className={styles.reserveCard}>
            {art(fighter.combatant.speciesId,fighter.combatant.name)}
            <div className={styles.reserveInfo}>
              <strong>{fighter.combatant.name}</strong>
              <small>Nv. {fighter.combatant.level} · {fighter.hp===0?'KO':status(fighter)}</small>
              <label>HP {fighter.hp}/{fighter.combatant.stats.hp}
                <progress value={fighter.hp} max={fighter.combatant.stats.hp}/></label>
              <label>SP {fighter.sp}/{fighter.maxSp}
                <progress value={fighter.sp} max={fighter.maxSp}/></label>
            </div>
            {side==='player'&&<span className={styles.benchIndicator}>
              {fighter.hp===0?'Nocauteado':'Reserva · IA decide a troca'}
            </span>}
          </div>;
        })}
      </div>
    </div>;
  };
  return <section className={styles.screen} data-testid="gym-screen">
    {!session&&<div className={styles.intro}>
      <div>
        <p className={styles.kicker}>DESAFIO OFICIAL · KANTO</p>
        <h2>Ginásios Pokémon</h2>
        <p>Monte uma equipe de três Pokémon: a IA conduz o duelo contra o líder.
          HP e SP persistem entre as trocas. Apenas vencer os três adversários
          concede a insígnia.</p>
      </div>
      <strong className={styles.progress}>{earned.size}/8 insígnias</strong>
    </div>}
    {!session&&<div className={styles.gymList} aria-label="Progressão dos oito ginásios">
      {KANTO_GYMS.map(g=>{
        const won=earned.has(g.id),current=g.id===gym?.id;
        return <article key={g.id} className={current?styles.gymCurrent:styles.gymCard}
          aria-label={g.order+'º Ginásio: '+g.name+', '+g.leader+
            (won?', conquistado':current?', desafio atual':', bloqueado')}>
          <small>{String(g.order).padStart(2,'0')} · {g.city}</small>
          <strong>{g.name}</strong>
          <span>{g.leader}</span>
          <small>{won?'✓ Insígnia conquistada':
            current?'Disponível · nível recomendado '+g.recommendedMinLevel+'–'+g.recommendedMaxLevel:
            'Conquiste as anteriores'}</small>
        </article>;
      })}
    </div>}
    {!session&&!gym&&<div className={styles.panel} role="status">
      <h3>Todas as insígnias conquistadas!</h3>
      <p>Você venceu os oito líderes de Kanto. O título Mestre de Ginásios
        poderá ser equipado no perfil do treinador.</p>
    </div>}
    {!session&&gym&&<div className={styles.panel}>
      <h3>Desafiar {gym.leader} · Insígnia {gym.name}</h3>
      <p>Recomendação: níveis {gym.recommendedMinLevel}–{gym.recommendedMaxLevel}.
        Recompensa por vitória: {gym.coins.toLocaleString('pt-BR')} moedas
        e {gym.trainerXp.toLocaleString('pt-BR')} XP de treinador.</p>
      <div className={styles.opponents} aria-label={"Equipe de "+gym.leader}>
        {gym.team.map((foe,i)=><div key={i}>
          {art(foe.speciesId,KANTO_BATTLE_SPECIES[foe.speciesId]?.name??'Pokémon')}
          <span>{KANTO_BATTLE_SPECIES[foe.speciesId]?.name} · Nv. {foe.level}</span>
        </div>)}
      </div>
      <fieldset className={styles.choices}>
        <legend>Escolha exatamente três Pokémon para o desafio ({selected.length}/3)</legend>
        {data.roster.map(p=>{
          const checked=selected.includes(p.uid);
          return <label key={p.uid} className={checked?styles.choiceOn:styles.choice}>
            <input type="checkbox" checked={checked}
              disabled={busy||(!checked&&selected.length>=3)}
              onChange={()=>setSelected(previous=>checked
                ?previous.filter(uid=>uid!==p.uid):[...previous,p.uid])}/>
            {art(p.pokemonId,KANTO_BATTLE_SPECIES[p.pokemonId]?.name??'Pokémon')}
            <span>{KANTO_BATTLE_SPECIES[p.pokemonId]?.name??'Pokémon'}
              <small>UID {p.uid} · Nv. {p.level}</small></span>
          </label>;
        })}
      </fieldset>
      <button type="button" className={styles.primary} disabled={busy||!starting}
        onClick={()=>{
          const seed=window.crypto.getRandomValues(new Uint32Array(1))[0];
          if(seed!==undefined){
            setPresented(0);setAutomatic(true);lastSent.current=null;
            onAction({type:'gym-start',seed,uids:selected});
          }
        }}>Iniciar batalha contra {gym.leader}</button>
      <p className={styles.hint}>Batalha local alfa: dados e resultados ainda não
        são verificados por um servidor.</p>
    </div>}
    {session&&<section className={styles.panel} ref={detailsRef}
      tabIndex={-1} aria-label="Batalha de Ginásio em andamento">
      <p className={styles.kicker}>BATALHA 3 × 3 · {gym?.name.toUpperCase()??session.gymId}</p>
      <h3>{gym?.leader??'Líder'} vs. seu time</h3>
      {invalid?<p role="alert">Sessão inválida: {invalid}.
        Nenhum prêmio foi concedido.</p>:state&&<>
        <p className={styles.round} aria-live="polite" aria-atomic="true">
          Rodada {state.turn}/120 · {state.outcome==='ongoing'
            ?state.player.needsReplacement?'IA escolhendo substituto':
              state.leader.needsReplacement?'O líder está substituindo o Pokémon':
              'IA decidindo próxima ação':
            state.outcome==='player-win'?'Vitória!':
            state.outcome==='leader-win'?'Sua equipe foi derrotada':'Empate'}
        </p>
        <div className={styles.duelScene} data-testid="gym-duel-scene"
          aria-label="Arena de batalha do Ginásio">
          {player&&leader&&<BattleStage
            player={{name:player.combatant.name,level:player.combatant.level,
              art:art(player.combatant.speciesId,player.combatant.name,true)}}
            wild={{name:leader.combatant.name,level:leader.combatant.level,
              art:art(leader.combatant.speciesId,leader.combatant.name,true)}}
            frame={frame} playerMaxHp={player.combatant.stats.hp}
            wildMaxHp={leader.combatant.stats.hp}
            playerMaxSp={player.maxSp} wildMaxSp={leader.maxSp}
            cue={roundKey+':'+visible} playing={showingRound}
            opponentLabel={'Pokémon de '+(gym?.leader??'líder')}/>}
        </div>
        <div className={styles.benchColumns}>
          {renderReserve('player')}
          {renderReserve('leader')}
        </div>
        {state.outcome==='ongoing'&&<div className={styles.commands}
          aria-label="Comandos de batalha">
          <div className={styles.commandsHeader}>
            <h4> <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"/> Combate automático por IA</h4>
            <small>Ambos os lados escolhem golpes, Concentrar e trocas pela IA.
              A equipe preserva HP e SP; até 3 trocas voluntárias por lado,
              com uma recuperação de SP ao recolher cada Pokémon.</small>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary}
              disabled={busy||automatic} onClick={()=>{
                lastSent.current=null;setPresented(actionCount);setAutomatic(true);
              }}><i className="fa-solid fa-play" aria-hidden="true"/> {automatic?'IA em ação':'Continuar batalha automática'}</button>
            <button type="button" className={styles.secondary}
              disabled={!automatic} onClick={()=>setAutomatic(false)}>
              <i className="fa-solid fa-pause" aria-hidden="true"/> Pausar após a rodada
            </button>
          </div>
          <small className={styles.hint}>A IA escolhe a próxima ação somente após o diário revelar o turno atual.
            O resultado continua sendo validado no save, sem prêmios antecipados.</small>
        </div>}
        {lastRound&&<section className={styles.history} data-testid="gym-battle-history"
          aria-label="Diário do combate">
          <BattlePlayback key={session.id+':'+actionCount}
            log={lastRound.lines.map(line=>'T'+lastRound.turn+' '+line
              .replace(/^player\\b/,'Seu Pokémon')
              .replace(/^leader\\b/,'Líder'))}
            turns={Math.max(1,state.turn)}
            playing={!donePresentation} onProgress={onProgress}
            onFinished={()=>setPresented(actionCount)}/>
        </section>}
        {state.outcome!=='ongoing'&&!donePresentation&&
          <p role="status" className={styles.hint}>
            Finalize a apresentação do diário para revelar o resultado e as recompensas.
          </p>}
        {state.outcome!=='ongoing'&&donePresentation&&
          <div role="status" className={styles.result}>
          <h3>{state.outcome==='player-win'?'Você venceu '+gym?.leader+'!':
            state.outcome==='draw'?'Empate no Ginásio':'Sua equipe foi derrotada'}</h3>
          <p>{state.outcome==='player-win'
            ?'Finalize para registrar a insígnia e a recompensa uma única vez.':
            'Nenhuma insígnia ou recompensa de vitória será concedida.'}</p>
          <button className={styles.primary} type="button" disabled={busy} ref={finishRef}
            onClick={()=>onAction({type:'gym-finish',sessionId:session.id})}>
            Finalizar confronto
          </button>
        </div>}
      </>}
      <div className={styles.abandon}>
        {confirmAbandon?<div role="group" aria-label="Confirmar abandono">
          <p>Abandonar encerra esta batalha sem insígnia ou recompensa.</p>
          <button type="button" className={styles.secondary} disabled={busy}
            onClick={()=>onAction({type:'gym-abandon',sessionId:session.id})}>
            Confirmar abandono
          </button>
          <button type="button" className={styles.secondary}
            onClick={()=>setConfirmAbandon(false)}>Continuar batalha</button>
        </div>:<button type="button" className={styles.secondary}
          disabled={busy} onClick={()=>setConfirmAbandon(true)}>Abandonar batalha</button>}
      </div>
    </section>}
    {!session&&isRecord(game.lastGymVictory)&&
      <p role="status" className={styles.result}>
        Última conquista: {String(game.lastGymVictory.gymId)}. Insígnia e
        recompensas registradas no save.</p>}
  </section>;
}
