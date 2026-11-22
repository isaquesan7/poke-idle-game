/**
 * GYM-04A — tela jogável que apenas envia ações ao writer versionado.
 * Nunca fornece HP/SP/outcome/recompensas. O estado exibido é replayado
 * pelo motor a partir do transcript persistido (inclusive após reload).
 */
import {useEffect,useRef,useState} from 'react';
import {
  KANTO_GYMS,kantoNextGym,gymLegalTurnActions,
  KANTO_BATTLE_SPECIES
} from '@kanto/game-core';
import type {GymTurnAction,GymBattleState} from '@kanto/game-core';
import type {LegacySave} from '../storage/legacySave';
import type {PlayAction} from './playSave';
import {replayGymSessionTrace} from './gymSession';
import type {GymSessionV1} from './gymSession';
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
function art(id:number,alt:string){
  return <img src={'/assets/pokemon-gifs/poke_'+id+'.gif'} alt={alt}
    loading="lazy" className={styles.pokemonArt}/>;
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
  const commandRef=useRef<HTMLDivElement|null>(null);
  const reserveRef=useRef<HTMLDivElement|null>(null);
  const finishRef=useRef<HTMLButtonElement|null>(null);
  const previousSession=useRef<string|null>(null);
  const session=readSession(game.gymSession);
  const gym=session?KANTO_GYMS.find(g=>g.id===session.gymId):
    kantoNextGym(data.badges);
  let state:GymBattleState|null=null;
  let invalid='';
  let history:readonly {readonly turn:number;readonly lines:readonly string[]}[]=[];
  if(session){
    try{
      const trace=replayGymSessionTrace(game,session);
      state=trace.state;
      history=trace.rounds;
    }catch(e){invalid=e instanceof Error?e.message:'Não foi possível validar a sessão.';}
  }
  useEffect(()=>{
    if(!session){previousSession.current=null;return;}
    if(previousSession.current!==session.id){
      previousSession.current=session.id;
      detailsRef.current?.focus({preventScroll:true});
    }else if(state?.outcome!=='ongoing'){
      finishRef.current?.focus({preventScroll:true});
    }else if(state.player.needsReplacement){
      reserveRef.current?.focus({preventScroll:true});
    }else{
      commandRef.current?.focus({preventScroll:true});
    }
  },[session?.id,revision]);
  useEffect(()=>{setConfirmAbandon(false);},[session?.id]);

  const earned=new Set(data.badges);
  const starting=selected.length===3&&!session;
  const actions=state&&state.outcome==='ongoing'
    ?gymLegalTurnActions(state,'player'):[];
  const renderActive=(side:'player'|'leader')=>{
    if(!state)return null;
    const party=state[side];
    const active=party.fighters[party.activeIndex]!;
    const maxHp=active.combatant.stats.hp;
    return <div className={styles.duelist} data-testid={'gym-active-'+side}
      aria-label={side==='player'?'Seu Pokémon em campo':'Pokémon do líder em campo'}>
      <span className={styles.role}>{side==='player'?'SEU PARCEIRO':'POKÉMON DE '+(gym?.leader??'LÍDER').toUpperCase()}</span>
      <div className={styles.duelArt}>{art(active.combatant.speciesId,active.combatant.name)}</div>
      <strong>{active.combatant.name} · Nv. {active.combatant.level}</strong>
      <small>{active.hp===0?'Nocauteado':status(active)}</small>
      <div className={styles.meters}>
        <label>HP <strong>{active.hp} / {maxHp}</strong>
          <progress aria-label={'HP '+active.combatant.name}
            value={active.hp} max={maxHp}/></label>
        <label>SP <strong>{active.sp} / {active.maxSp}</strong>
          <progress aria-label={'SP '+active.combatant.name}
            value={active.sp} max={active.maxSp}/></label>
      </div>
    </div>;
  };
  const renderReserve=(side:'player'|'leader')=>{
    if(!state)return null;
    const party=state[side];
    const switchActions=actions.filter((action):action is Extract<GymTurnAction,{kind:'switch'}>=>
      action.kind==='switch');
    return <div className={styles.reserveGroup}
      ref={side==='player'?reserveRef:undefined} tabIndex={side==='player'?-1:undefined}
      aria-label={side==='player'?'Seus Pokémon reservas':'Reservas do líder'}>
      <strong>{side==='player'?'Suas reservas':'Reservas de '+(gym?.leader??'líder')}</strong>
      <div className={styles.reserveCards}>
        {party.fighters.map((fighter,index)=>{
          if(index===party.activeIndex)return null;
          const switchAction=switchActions.find(action=>action.toIndex===index);
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
            {side==='player'&&<button type="button" className={styles.switchButton}
              disabled={busy||!switchAction} onClick={()=>{
                if(switchAction)onAction({type:'gym-turn',sessionId:session!.id,action:switchAction});
              }}>{fighter.hp===0?'Nocauteado':switchAction?'Trocar':'Indisponível'}</button>}
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
        <p>Monte uma equipe de três Pokémon e enfrente o líder por turnos.
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
          if(seed!==undefined)onAction({type:'gym-start',seed,uids:selected});
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
            ?state.player.needsReplacement?'Escolha um substituto':
              state.leader.needsReplacement?'O líder está substituindo o Pokémon':
              'Escolha sua ação':
            state.outcome==='player-win'?'Vitória!':
            state.outcome==='leader-win'?'Sua equipe foi derrotada':'Empate'}
        </p>
        <div className={styles.duelScene} role="region" aria-label="Arena de batalha do Ginásio"
          data-testid="gym-duel-scene">
          {renderActive('player')}
          <span className={styles.vs} aria-hidden="true">VS</span>
          {renderActive('leader')}
        </div>
        <div className={styles.benchColumns}>
          {renderReserve('player')}
          {renderReserve('leader')}
        </div>
        {state.outcome==='ongoing'&&<div className={styles.commands}
          ref={commandRef} tabIndex={-1} aria-label="Comandos de batalha">
          <div className={styles.commandsHeader}>
            <h4>{state.player.needsReplacement?'Escolha um Pokémon para substituir':
              'Escolha sua habilidade'}</h4>
            <small>Trocas voluntárias: {state.player.voluntarySwitchesUsed}/3 ·
              Ao recolher, HP é preservado e o SP recupera somente dentro do limite.</small>
          </div>
          <div className={styles.actions} aria-label="Habilidades disponíveis">
            {actions.filter(action=>action.kind!=='switch').map((action,i)=>{
              const label=action.kind==='basic'?'Ataque básico':
                action.kind==='focus'?'Concentrar':action.kind==='move'?action.moveName:'';
              return <button type="button" className={styles.secondary} key={action.kind+'-'+i}
                disabled={busy} onClick={()=>onAction({type:'gym-turn',sessionId:session.id,action})}>
                {label}
              </button>;
            })}
            {state.player.needsReplacement&&<p className={styles.hint}>
              Selecione uma das reservas acima. A substituição após KO não consome rodada.
            </p>}
          </div>
        </div>}
        {history.length>0&&<section className={styles.history}
          aria-label="Diário do combate" data-testid="gym-battle-history">
          <h4>Diário de combate</h4>
          <ol aria-live="off">{history.slice(-8).map((entry,i)=><li key={history.length+i}>
            <strong>Rodada {entry.turn}</strong>
            <ul>{entry.lines.map((line,j)=><li key={j}>{line
              .replace(/^player\\b/,'Seu Pokémon')
              .replace(/^leader\\b/,'Líder')}</li>)}</ul>
          </li>)}</ol>
          {history.length>8&&<small>Últimas oito ações de {history.length}.</small>}
        </section>}
        {state.outcome!=='ongoing'&&<div role="status" className={styles.result}>
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
