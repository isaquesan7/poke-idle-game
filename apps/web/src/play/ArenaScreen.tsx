import {useEffect,useState} from 'react';
import {kantoPokemonFormProfile,kantoMachine} from '@kanto/game-core';
import type {ArenaCommand,ArenaDuel,ArenaView} from './onlinePlay';
import {ArenaShop} from './ArenaShop';
import {PokemonArt} from './JourneyShell';
import {BattleStage} from './BattleStage';
import {BattlePlayback} from './BattlePlayback';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
import css from './ArenaScreen.module.css';
type Mutate=(command:ArenaCommand,revision:number)=>Promise<boolean>;
const types:Record<string,string>={normal:'Normal',fire:'Fogo',water:'Água',grass:'Planta',electric:'Elétrico',ice:'Gelo',fighting:'Lutador',poison:'Venenoso',ground:'Terrestre',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
function Replay({duel,onClose}:{duel:ArenaDuel;onClose:()=>void}){
 const [visible,setVisible]=useState(1),[done,setDone]=useState(false);
 const fighter=(f:ArenaDuel['player'])=>({name:f.name,level:f.level,art:<PokemonArt id={kantoPokemonFormProfile(f.speciesId,f.megaForm)?.artId??f.speciesId} name={f.name} large/>});
 const frame=duel.frames[Math.max(0,Math.min((done?duel.frames.length:visible)-1,duel.frames.length-1))]??null;
 return <section className={styles.panel} data-testid="arena-replay"><h2>Andar {duel.floor} · Batalha da Arena</h2>
 <BattleStage player={fighter(duel.player)} wild={fighter(duel.opponent)} frame={frame} playerMaxHp={duel.player.maxHp} wildMaxHp={duel.opponent.maxHp} playerMaxSp={duel.player.maxSp} wildMaxSp={duel.opponent.maxSp} playing={!done} cue={duel.id+':'+visible} opponentLabel="Adversário da Arena" vitals={{playerHp:duel.player.hp,wildHp:duel.opponent.hp,playerSp:duel.player.sp,wildSp:duel.opponent.sp}}/>
 <BattlePlayback log={duel.log} turns={duel.turns} playing={!done} onProgress={setVisible} onFinished={()=>setDone(true)} holdLastFrame/>
 {done&&<div className={css.result} role="status"><strong>{duel.outcome==='win'?'Vitória!':duel.outcome==='loss'?'Derrota':'Empate'}</strong><p>{duel.outcome==='win'?'Progresso confirmado pelo servidor.':'Tentativa encerrada. Você pode reiniciar no andar 1, sem perder os pontos conquistados.'}</p>{duel.reward&&<div className={css.summary} data-testid="arena-reward"><div><small>Pontos de Arena</small><strong>+{duel.points??0}</strong></div><div><small>Ouro</small><strong>+{duel.reward.coins}</strong></div><div><small>XP Pokémon</small><strong>+{duel.reward.pokemonXp}</strong></div><div><small>XP Treinador</small><strong>+{duel.reward.trainerXp}</strong></div></div>}{duel.outcome==='win'&&duel.rewardEligible===false&&<p>Andar já recompensado nesta semana.</p>}<div className={css.replayActions}><button className={styles.primary} onClick={onClose}>Voltar à Arena</button></div></div>}
 </section>;
}
export function ArenaScreen({view,busy,onAction,onRefresh,onCollection}:{view:ArenaView;busy:boolean;onAction:Mutate;onRefresh:()=>void;onCollection:()=>void}){
 const [uid,setUid]=useState<number|null>(null),[confirm,setConfirm]=useState(false),[show,setShow]=useState(false);
 const [shopOpen,setShopOpen]=useState(false);
 const [remaining,setRemaining]=useState(Math.max(0,view.endMs-view.serverNowMs));
 useEffect(()=>{const sampled=performance.now();const tick=()=>setRemaining(Math.max(0,view.endMs-view.serverNowMs-(performance.now()-sampled)));tick();const t=window.setInterval(tick,1000);return()=>clearInterval(t);},[view.serverNowMs,view.endMs]);
 const hours=Math.floor(remaining/3600000),minutes=Math.floor(remaining/60000)%60;
 const next=view.nextFloor??1,opponent=view.opponents.find(p=>p.floor===next);
 const selected=view.team.find(p=>p.uid===uid)??view.team[0];
 const blocked=busy||view.busy||remaining===0;
 const duel=view.lastDuel;
 if(shopOpen&&view.shop)return <ArenaShop view={view.shop} revision={view.revision} busy={busy||remaining===0} onAction={onAction} onBack={()=>setShopOpen(false)} onRefresh={onRefresh}/>;
 if(show&&duel)return <Replay key={duel.id} duel={duel} onClose={()=>setShow(false)}/>;
 return <div className={css.workspace} data-testid="arena-screen">
  <section className={styles.hero}><div><div className={styles.kicker}>DESAFIO SEMANAL · KANTO</div><h2>Arena semanal</h2><p>Enfrente 40 andares com a equipe definida na Coleção. Escolha um dos seus três Pokémon para cada duelo automático.</p><small>HP e SP completos · Sem captura · Derrota ou empate encerra a tentativa.</small></div><i className={'fa-solid fa-trophy '+css.trophy} aria-hidden="true"/></section>
  <section className={styles.panel+' '+css.panel}><div className={css.summary}><div><small>Saldo de Pontos de Arena</small><strong>{view.balance}</strong></div><div><small>Ganhos nesta semana</small><strong>{view.earned} / {view.cap}</strong></div><div><small>Recorde semanal</small><strong>{view.paidThrough} / 40</strong></div><div><small>Reinício em</small><strong>{Math.floor(hours/24)}d {hours%24}h {minutes}min</strong></div></div>{view.shop&&<button className={styles.secondary} type="button" onClick={()=>setShopOpen(true)}><i className="fa-solid fa-store" aria-hidden="true"/> Loja da Arena</button>}<progress className={css.progress} value={view.earned} max={view.cap}/>{remaining===0&&<button className={styles.secondary} onClick={onRefresh}>Atualizar semana</button>}</section>
  <section className={styles.panel+' '+css.panel}><h2>{view.complete?'Semana concluída':view.run?'Próximo adversário':'Preparar tentativa'}</h2>
   {view.complete?<p>Você conquistou todas as recompensas semanais. Volte após o reinício.</p>:<>
    {opponent&&<div className={css.opponent}><PokemonArt id={opponent.speciesId} name={opponent.name} large/><div><small>Andar {opponent.floor}{opponent.guardian?' · Guardião':''}</small><h3>{opponent.name} · Nv. {opponent.level}</h3><p>{opponent.types.map(t=>types[t]??t).join(' / ')}</p><p>{opponent.paid?'Recompensa já recebida nesta semana':opponent.points+' Pontos de Arena + XP e ouro elegíveis'}</p>{opponent.tmIds.length>0&&<small>TMs: {opponent.tmIds.map(t=>kantoMachine(t)?.moveName??t).join(' · ')}</small>}</div></div>}
    <h3>{view.run?'Escolha o combatente':'Sua equipe da Coleção'}</h3>
    <div className={css.team}>{view.team.map(p=>{const form=kantoPokemonFormProfile(p.speciesId,p.megaForm);return <button type="button" key={p.uid} className={css.member} data-testid={'arena-member-'+p.uid} aria-pressed={view.run?selected?.uid===p.uid:undefined} disabled={!view.run||blocked} onClick={()=>setUid(p.uid)}><PokemonArt id={form?.artId??p.speciesId} name={form?.name??'Pokémon'}/><strong>{form?.name??'Pokémon'}</strong><small>Nv. {p.level} · #{p.uid}</small></button>})}</div>
    {view.run?<div className={css.actions}><button className={styles.primary} disabled={blocked||!selected||!view.teamEligible||!opponent} onClick={async()=>{if(!selected||!view.run||!opponent)return;if(await onAction({type:'challenge',weekStartMs:view.startMs,runId:view.run.id,floor:opponent.floor,uid:selected.uid},view.revision))setShow(true)}}>Desafiar andar {next}</button><button className={styles.secondary} disabled={busy} onClick={()=>setConfirm(true)}>Abandonar tentativa</button></div>:<div className={css.actions}><button className={styles.primary} disabled={blocked||!view.teamEligible} onClick={()=>void onAction({type:'start'},view.revision)}>Iniciar tentativa</button><button className={styles.secondary} onClick={onCollection}>Ir para Coleção</button></div>}
    {!view.teamEligible&&<p role="status">Defina exatamente três Pokémon válidos na Coleção.</p>}{view.busy&&<p role="status">Finalize a atividade em andamento antes de desafiar.</p>}
   </>}
   {duel&&<div className={css.replayActions}><button className={styles.secondary} onClick={()=>setShow(true)}>Rever último combate</button></div>}
  </section>
  <section className={styles.panel}><h2>Andares da semana</h2><div className={css.floors}>{view.opponents.map(p=><article key={p.floor} className={css.floor} data-testid={'arena-floor-'+p.floor} data-current={view.nextFloor===p.floor} data-paid={p.paid}><small>#{p.floor}{p.guardian?' ★':''}</small><PokemonArt id={p.speciesId} name={p.name}/><strong>{p.name}</strong><small>Nv. {p.level}</small><small>{p.paid?'Recebido':p.points+' PA'} · {view.complete||view.run&&view.run.cleared>=p.floor?'Vencido':view.nextFloor===p.floor?'Próximo':'Bloqueado'}</small></article>)}</div></section>
  {confirm&&view.run&&<RegionDialog title="Abandonar tentativa?" size="compact" onClose={()=>setConfirm(false)}><p>Você começará novamente no andar 1. Os pontos e recompensas já recebidos nesta semana serão preservados.</p><div className={styles.evolutionConfirmActions}><button className={styles.secondary} onClick={()=>setConfirm(false)}>Cancelar</button><button className={styles.primary} disabled={busy} onClick={()=>{if(view.run)void onAction({type:'abandon',runId:view.run.id},view.revision);setConfirm(false)}}>Confirmar</button></div></RegionDialog>}
 </div>;
}
