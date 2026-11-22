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
import {replayGymSession} from './gymSession';
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
  const session=readSession(game.gymSession);
  const gym=session?KANTO_GYMS.find(g=>g.id===session.gymId):
    kantoNextGym(data.badges);
  let state:GymBattleState|null=null;
  let invalid='';
  if(session){
    try{state=replayGymSession(game,session);}
    catch(e){invalid=e instanceof Error?e.message:'Não foi possível validar a sessão.';}
  }
  useEffect(()=>{
    if(session&&detailsRef.current){
      detailsRef.current.focus({preventScroll:true});
    }
  },[session?.id,revision]);
  useEffect(()=>{setConfirmAbandon(false);},[session?.id]);

  const earned=new Set(data.badges);
  const starting=selected.length===3&&!session;
  const actions=state&&state.outcome==='ongoing'
    ?gymLegalTurnActions(state,'player'):[];
  const member=(uid:number)=>data.roster.find(p=>p.uid===uid);
  const renderSide=(side:'player'|'leader')=>{
    if(!state)return null;
    const fighters=state[side].fighters;
    const party=state[side];
    return <div className={styles.team}>
      <h3>{side==='player'?'Sua equipe':'Equipe do líder'}</h3>
      {fighters.map((fighter,index)=>
        <div key={index} className={index===party.activeIndex?styles.active:styles.fighter}>
          {art(fighter.combatant.speciesId,fighter.combatant.name)}
          <div className={styles.fighterInfo}>
            <strong>{fighter.combatant.name} · Nv. {fighter.combatant.level}</strong>
            <span>{fighter.hp===0?'Derrotado':status(fighter)}</span>
            <label>HP {fighter.hp}/{fighter.combatant.stats.hp}
              <progress value={fighter.hp} max={fighter.combatant.stats.hp}/>
            </label>
            <label>SP {fighter.sp}/{fighter.maxSp}
              <progress value={fighter.sp} max={fighter.maxSp}/>
            </label>
          </div>
          {index===party.activeIndex&&<span className={styles.current}>Em campo</span>}
        </div>
      )}
      <small>Trocas voluntárias: {party.voluntarySwitchesUsed}/3</small>
    </div>;
  };
  return <section className={styles.screen} data-testid="gym-screen">
    <div className={styles.intro}>
      <div>
        <p className={styles.kicker}>DESAFIO OFICIAL · KANTO</p>
        <h2>Ginásios Pokémon</h2>
        <p>Monte uma equipe de três Pokémon e enfrente o líder por turnos.
          HP e SP persistem entre as trocas. Apenas vencer os três adversários
          concede a insígnia.</p>
      </div>
      <strong className={styles.progress}>{earned.size}/8 insígnias</strong>
    </div>
    <div className={styles.gymList} aria-label="Progressão dos oito ginásios">
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
    </div>
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
      <div className={styles.opponents} aria-label={"Equipe de "+gym.leader}}>
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
        <div className={styles.battleTeams}>
          {renderSide('player')}
          {renderSide('leader')}
        </div>
        {state.outcome==='ongoing'&&<div className={styles.actions}
          aria-label="Ações de batalha">
          {actions.map((action,i)=>{
            const label=action.kind==='basic'?'Ataque básico':
              action.kind==='focus'?'Concentrar':
              action.kind==='move'?action.moveName:
              'Trocar para '+state!.player.fighters[action.toIndex]!.combatant.name+
                ' (slot '+(action.toIndex+1)+')';
            return <button type="button" className={styles.secondary}
              key={action.kind+('-'+i)} disabled={busy}
              onClick={()=>onAction({type:'gym-turn',sessionId:session.id,action})}>
              {label}
            </button>;
          })}
        </div>}
        {state.outcome!=='ongoing'&&<div role="status" className={styles.result}>
          <h3>{state.outcome==='player-win'?'Você venceu '+gym?.leader+'!':
            state.outcome==='draw'?'Empate no Ginásio':'Sua equipe foi derrotada'}</h3>
          <p>{state.outcome==='player-win'
            ?'Finalize para registrar a insígnia e a recompensa uma única vez.':
            'Nenhuma insígnia ou recompensa de vitória será concedida.'}</p>
          <button className={styles.primary} type="button" disabled={busy}
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
