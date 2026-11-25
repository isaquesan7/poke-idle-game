import {useEffect,useRef,useState} from 'react';
import {KANTO_BATTLE_SPECIES,KANTO_GYMS,kantoNextGym} from '@kanto/game-core';
import type {LegacySave} from '../storage/legacySave';
import type {Actor,Party,RegionView,GymView} from './onlinePlay';
import {BattleStage} from './BattleStage';
import {BattlePlayback} from './BattlePlayback';
import {PokemonArt} from './JourneyShell';
import styles from './PlayApp.module.css';
import gymStyles from './GymScreen.module.css';

export type BattleCommand=(command:'open'|'turn'|'reward'|'finish',choice?:string)=>Promise<boolean>;
const name=(id:number)=>KANTO_BATTLE_SPECIES[id]?.name??'Pokémon #'+id;
const balls:Record<string,string>={'poke-ball':'Poké Ball','great-ball':'Great Ball','ultra-ball':'Ultra Ball'};
function Reserve({party,label}:{party:Party;label:string}){
 return <div className={gymStyles.reserveGroup}><strong>{label}</strong><div className={gymStyles.reserveCards}>
 {party.fighters.map((p,i)=>i===party.activeIndex?null:<div key={i} className={gymStyles.reserveCard+(p.hp===0?' '+gymStyles.reserveFainted:'')} data-fainted={p.hp===0?'true':'false'}>
 <div className={gymStyles.reserveSprite}><PokemonArt id={p.speciesId} name={name(p.speciesId)}/>{p.hp===0&&<span className={gymStyles.reserveKoTag}>Nocauteado</span>}</div><div className={gymStyles.reserveInfo}><strong>{name(p.speciesId)}</strong><small>Nv. {p.level}</small><label>HP {p.hp}/{p.maxHp}<progress value={p.hp} max={p.maxHp}/></label><label>SP {p.sp}/{p.maxSp}<progress value={p.sp} max={p.maxSp}/></label></div></div>)}
 </div></div>;
}
export function OnlineBattle({mode,region,gym,data,regionId,regionName,busy,blocked,onCommand,onBack}:{mode:'region'|'gym';region:RegionView|null;gym:GymView|null;data:LegacySave;regionId:number;regionName:string;busy:boolean;blocked:boolean;onCommand:BattleCommand;onBack:()=>void}){
 const e=mode==='region'?region?.encounter:gym?.gym;
 const g=mode==='gym'?gym?.gym:null;
 const w=mode==='region'?region?.encounter:null;
 const [auto,setAuto]=useState(false);
 const [shown,setShown]=useState({key:'',length:0});
 const stageRef=useRef<HTMLDivElement>(null);
 const captureRef=useRef<HTMLDivElement>(null);
 const startRef=useRef<HTMLButtonElement>(null);
 const [visible,setVisible]=useState(0);
 const prev=useRef({id:'',length:0});
 const sent=useRef('');
 const key=e?e.id+':'+e.log.length:'';
 const prior=e&&prev.current.id===e.id?Math.min(prev.current.length,e.log.length):0;
 const playing=!!e&&e.log.length>0&&shown.key!==key;
 const onCommandRef=useRef(onCommand);onCommandRef.current=onCommand;
 useEffect(()=>{if(!e){setAuto(false);sent.current='';prev.current={id:'',length:0};return;}},[e?.id]);
 useEffect(()=>{
  if(!e||busy||blocked||playing||!auto||!['await-player','resolved','certified'].includes(e.phase)||mode==='gym'&&e.phase!=='await-player')return;
  if(e.phase==='await-player'&&!e.recommendedAction){setAuto(false);return;}
  const token=e.id+':'+e.phase+':'+e.log.length;
  if(sent.current===token)return;
  const timer=window.setTimeout(()=>{sent.current=token;void onCommandRef.current(e.phase==='await-player'?'turn':'reward').then(ok=>{if(!ok)setAuto(false);});},180);
  return()=>window.clearTimeout(timer);
 },[e?.id,e?.phase,e?.log.length,auto,busy,blocked,playing]);
 useEffect(()=>{if(busy||playing)return;const target=w?.phase==='paid'?captureRef.current:e?stageRef.current:startRef.current;target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'});},[e?.id,e?.phase,busy,playing]);
 function launch(){sent.current='';setAuto(true);void onCommand('open').then(ok=>{if(!ok)setAuto(false);});}
 const lead=data.roster.find(p=>p.uid===data.team[0]);
 const a:Actor|null|undefined=w?w.player:g?.player?.fighters[g.player.activeIndex];
 const z:Actor|null|undefined=w?w.wild:g?.opponent?.fighters[g.opponent.activeIndex];
 const frame=w?.frames?.length===w?.log.length&&w&&w.frames.length>0?w.frames[Math.max(0,Math.min(w.frames.length-1,playing?Math.max(prior,visible-1):w.frames.length-1))]??null:null;
 const next=kantoNextGym(data.badges);
 const log=e?.log.map(line=>g?line.replace(/\bplayer\b/g,()=>data.name).replace(/\bleader\b/g,()=>g.leader):line)??[];
 return <section className={mode==='gym'?gymStyles.screen:styles.panel} data-testid={'online-'+mode+'-battle'}>
 {mode==='gym'&&!e&&<><div className={gymStyles.intro}><div><p className={gymStyles.kicker}>DESAFIO OFICIAL · KANTO</p><h2>Ginásios Pokémon</h2><p>Defina sua equipe na Coleção. A IA conduz o duelo 3 × 3.</p></div><strong className={gymStyles.progress}>{data.badges.length}/8 insígnias</strong></div><div className={gymStyles.gymList}>{KANTO_GYMS.map(x=><article key={x.id} className={next?.id===x.id?gymStyles.gymCurrent:gymStyles.gymCard}><small>{x.order} · {x.city}</small><strong>{x.name}</strong><span>{x.leader}</span><small>{data.badges.includes(x.id)?'✓ Insígnia conquistada':next?.id===x.id?'Desafio atual':'Bloqueado'}</small></article>)}</div></>}
 <div className={mode==='gym'?gymStyles.panel:styles.battleIntro}>
 <div><div className={styles.kicker}>{mode==='gym'?'BATALHA 3 × 3':'ENCONTROS SELVAGENS'}</div><h2>{mode==='gym'?(g?g.leader+' × '+data.name:next?'Desafiar '+next.leader:'Todos os ginásios conquistados'):regionName}</h2>
 {!e&&mode==='gym'&&<><p>Equipe definida na Coleção: {data.team.length}/3.</p><div className={gymStyles.choices}>{data.team.map(uid=>{const p=data.roster.find(x=>x.uid===uid);return p?<div key={uid} className={gymStyles.choiceOn}><PokemonArt id={p.pokemonId} name={name(p.pokemonId)}/><span>{name(p.pokemonId)} · Nv. {p.level}</span></div>:null;})}</div></>}
 {!e&&<><button className={styles.secondary} type="button" onClick={onBack}>{mode==='gym'?'Abrir Coleção':'Voltar às regiões'}</button><button type="button" className={styles.primary} data-testid="online-battle-start" ref={startRef} disabled={busy||blocked||(mode==='gym'?!gym?.canReserve:!region?.regions.some(x=>x.id===regionId&&x.unlocked)||!!region.pendingLoot)} onClick={launch}>{mode==='gym'?'Iniciar batalha':'Batalhar na região'}</button></>}
 {e?.phase==='reserved'&&<button className={styles.primary} disabled={busy||blocked} onClick={launch}>Retomar batalha</button>}
 {e&&e.phase!=='reserved'&&<p>Turno {e.turn} · {playing?'Apresentando diário':e.phase==='await-player'?'Combate em andamento':e.outcome==='win'||e.outcome==='player-win'?'Vitória!':e.outcome==='draw'?'Empate':'Derrota'}</p>}
 {e?.phase==='await-player'&&<div className={gymStyles.actions}><button className={styles.primary} disabled={busy||auto||blocked} onClick={()=>{sent.current='';setAuto(true);}}>Continuar batalha automática</button><button className={styles.secondary} disabled={!auto} onClick={()=>setAuto(false)}>Pausar após a rodada</button></div>}
 </div>
 {lead&&<div className={styles.battleArenaColumn}><BattleStage stageRef={stageRef} player={{name:name(a?.speciesId??lead.pokemonId),level:a?.level??w?.playerLevel??lead.level,art:<PokemonArt id={a?.speciesId??lead.pokemonId} name={name(a?.speciesId??lead.pokemonId)} large/>}} wild={z?{name:name(z.speciesId),level:z.level??w?.level??1,art:<PokemonArt id={z.speciesId} name={name(z.speciesId)} large/>}:null} frame={frame} playerMaxHp={a?.maxHp??null} wildMaxHp={z?.maxHp??null} playerMaxSp={a?.maxSp??null} wildMaxSp={z?.maxSp??null} playing={playing&&!!frame} cue={key+':'+visible} {...(a&&z?{vitals:{playerHp:a.hp,wildHp:z.hp,playerSp:a.sp,wildSp:z.sp}}:{})} opponentLabel={g?'Pokémon de '+g.leader:'Pokémon selvagem'}/>
 {w?.phase==='paid'&&!playing&&<div className={styles.battleCapturePlacement} ref={captureRef} tabIndex={-1}><div className={styles.captureDecision}><h3>{w.outcome==='win'?'Tentar capturar '+name(w.wild?.speciesId??0)+'?':'Encerrar batalha'}</h3>{w.captureChoices.map(ball=><button key={ball.ballId} className={styles.primary} disabled={busy||ball.quantity<1} onClick={()=>void onCommand('finish',ball.ballId)}>{balls[ball.ballId]??ball.ballId} · {ball.quantity}</button>)}<button className={styles.secondary} disabled={busy} onClick={()=>void onCommand('finish','skip')}>Seguir sem capturar</button></div></div>}
 </div>}
 </div>
 {g?.player&&g.opponent&&<div className={gymStyles.benchColumns}><Reserve party={g.player} label="Suas reservas"/><Reserve party={g.opponent} label={'Reservas de '+g.leader}/></div>}
 {e&&log.length>0&&<BattlePlayback key={key} log={log} initialVisible={prior} turns={e.turn} playing={playing} onProgress={setVisible} onFinished={()=>{prev.current={id:e.id,length:log.length};setShown({key,length:log.length});}}/>}
 {e&&!playing&&['resolved','certified'].includes(e.phase)&&<button className={styles.primary} disabled={busy} onClick={()=>void onCommand('reward')}>{mode==='gym'?'Finalizar confronto':'Receber recompensas'}</button>}
 </section>;
}
