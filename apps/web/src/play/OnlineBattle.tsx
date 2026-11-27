import {GearArt} from './GearArt';
import {BadgeArt} from './BadgeArt';
import {PokeballArt,PokeballSymbol} from './PokeballArt';
import {useEffect,useRef,useState} from 'react';
import {KANTO_BATTLE_SPECIES,KANTO_GYMS,kantoNextGym,xpThreshold,LEGACY_ITEMS,kantoMachine,machineRarity} from '@kanto/game-core';
import type {LegacySave} from '../storage/legacySave';
import type {Actor,Party,RegionView,GymView,RegionalReward} from './onlinePlay';
import {BattleStage} from './BattleStage';
import {BattlePlayback} from './BattlePlayback';
import {PokemonArt} from './JourneyShell';
import {narrateGymAction} from './gymLogText';
import styles from './PlayApp.module.css';
import {RegionDialog} from '../regions/RegionDialog';
import gymStyles from './GymScreen.module.css';

export type BattleCommand=(command:'open'|'turn'|'reward'|'finish',choice?:string)=>Promise<boolean>;
const name=(id:number)=>KANTO_BATTLE_SPECIES[id]?.name??'Pokémon #'+id;
const stones:Record<string,string>={'fire-stone':'Pedra de Fogo','water-stone':'Pedra de Água','thunder-stone':'Pedra do Trovão','leaf-stone':'Pedra da Folha','moon-stone':'Pedra da Lua'};
const rarities:Record<string,string>={common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário'};
const balls:Record<string,string>={'poke-ball':'Poké Ball','great-ball':'Great Ball','ultra-ball':'Ultra Ball'};
function Reserve({party,label}:{party:Party;label:string}){
 return <div className={gymStyles.reserveGroup}><strong>{label}</strong><div className={gymStyles.reserveCards}>
 {party.fighters.map((p,i)=>i===party.activeIndex?null:<div key={i} className={gymStyles.reserveCard+(p.hp===0?' '+gymStyles.reserveFainted:'')} data-fainted={p.hp===0?'true':'false'}>
 <div className={gymStyles.reserveSprite}><PokemonArt id={p.speciesId} name={name(p.speciesId)}/>{p.hp===0&&<span className={gymStyles.reserveKoTag}>Nocauteado</span>}</div><div className={gymStyles.reserveInfo}><strong>{name(p.speciesId)}</strong><small>Nv. {p.level}</small><label>HP {p.hp}/{p.maxHp}<progress value={p.hp} max={p.maxHp}/></label><label>SP {p.sp}/{p.maxSp}<progress value={p.sp} max={p.maxSp}/></label></div></div>)}
 </div></div>;
}
export function OnlineBattle({mode,region,gym,data,regionId,regionName,busy,blocked,onCommand,onBack,reward,onDismissReward,levelUpEncounterId,masteredSpecies=[]}:{mode:'region'|'gym';region:RegionView|null;gym:GymView|null;data:LegacySave;regionId:number;regionName:string;busy:boolean;blocked:boolean;onCommand:BattleCommand;onBack:()=>void;reward?:RegionalReward|null;onDismissReward?:()=>void;levelUpEncounterId?:string|null;masteredSpecies?:readonly number[]}){
 const e=mode==='region'?region?.encounter:gym?.gym;
 const g=mode==='gym'?gym?.gym:null;
 const w=mode==='region'?region?.encounter:null;
 const [auto,setAuto]=useState(false);
 const [shown,setShown]=useState({key:'',length:0});
 const stageRef=useRef<HTMLDivElement>(null);
 const captureRef=useRef<HTMLDivElement>(null);
 const startRef=useRef<HTMLButtonElement>(null);
 const [reveal,setReveal]=useState({key:'',visible:0});
 const prev=useRef({id:'',length:0});
 const sent=useRef('');
 const key=e?e.id+':'+(g?.actionNumber??0)+':'+e.log.length:'';
 const prior=Math.max(g?.presentation?.logOffset??0,e&&prev.current.id===e.id?Math.min(prev.current.length,e.log.length):0);
 const playing=!!e&&e.log.length>0&&shown.key!==key;
 const visible=playing?(reveal.key===key?reveal.visible:Math.min(e?.log.length??0,prior+1)):(e?.log.length??0);
 const levelUp=!!w&&w.phase==='paid'&&levelUpEncounterId===w.id;
 const focusedEncounter=useRef('');
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
 useEffect(()=>{if(!e){focusedEncounter.current='';return;}if(busy||reward||!stageRef.current)return;if(focusedEncounter.current!==e.id){focusedEncounter.current=e.id;stageRef.current.focus({preventScroll:true});stageRef.current.scrollIntoView({block:'center'});}},[e?.id,busy,reward]);
 useEffect(()=>{if(busy||playing||reward)return;const target=levelUp?stageRef.current:w?.phase==='paid'?captureRef.current:e?stageRef.current:startRef.current;target?.focus({preventScroll:true});target?.scrollIntoView({block:levelUp?'center':'nearest'});},[e?.id,e?.phase,busy,playing,reward,levelUp]);
 function launch(){sent.current='';setAuto(true);void onCommand('open').then(ok=>{if(!ok)setAuto(false);});}
 const lead=data.roster.find(p=>p.uid===data.team[0]);
 const xpMax=lead&&lead.level<100?xpThreshold('pokemon',lead.level):null;
 const xp=typeof lead?.xp==='number'&&xpMax!==null?Math.min(xpMax,Math.max(0,lead.xp)):0;
 const record=lead?.battleRecord&&typeof lead.battleRecord==='object'?lead.battleRecord as Record<string,unknown>:{};
 const count=(key:string)=>typeof record[key]==='number'?Number(record[key]):0;
 const present=g?.presentation;
 const index=present?Math.max(-1,Math.min(present.events.length-1,visible-present.logOffset-1)):-1;
 const display=present&&playing?(index<0?present.before:present.events[index]?.display??present.before):g;
 const a:Actor|null|undefined=w?w.player:display?.player?.fighters[display.player.activeIndex];
 const z:Actor|null|undefined=w?w.wild:display?.opponent?.fighters[display.opponent.activeIndex];
 const frame=w?.frames?.length===w?.log.length&&w&&w.frames.length>0?w.frames[Math.max(0,Math.min(w.frames.length-1,playing?Math.max(prior,visible-1):w.frames.length-1))]??null:present&&playing&&index>=0?present.events[index]?.frame??null:null;
 const next=kantoNextGym(data.badges);
 const log=e?.log.map((line,i)=>{
  if(!g)return line;
  const match=/^(player|leader)\s+(.+)$/.exec(line),actor=g.narration?.[i];
  if(!match||!actor)return line.replace(/\bplayer\b/g,()=>data.name).replace(/\bleader\b/g,()=>g.leader);
  return narrateGymAction(actor.turn,match[2]!,name(actor.actor),name(actor.foe),actor.side==='player'?data.name:g.leader,name(actor.entered));
 })??[];
 return <section className={mode==='gym'?gymStyles.screen:styles.panel} data-testid={'online-'+mode+'-battle'}>
 {mode==='gym'&&!e&&<><div className={gymStyles.intro}><div><p className={gymStyles.kicker}>DESAFIO OFICIAL · KANTO</p><h2>Ginásios Pokémon</h2><p>Defina sua equipe na Coleção. A IA conduz o duelo 3 × 3.</p></div><strong className={gymStyles.progress}>{data.badges.length}/8 insígnias</strong></div><div className={gymStyles.gymList}>{KANTO_GYMS.map(x=><article key={x.id} className={next?.id===x.id?gymStyles.gymCurrent:gymStyles.gymCard}><small>{x.order} · {x.city}</small><strong className={gymStyles.badgeTitle}><BadgeArt id={x.id} earned={data.badges.includes(x.id)}/> {x.name}</strong><span>{x.leader}</span><small>{data.badges.includes(x.id)?'✓ Insígnia conquistada':next?.id===x.id?'Desafio atual':'Bloqueado'}</small></article>)}</div></>}
 <div className={mode==='gym'?gymStyles.panel:styles.battleIntro}>
 <div><div className={styles.kicker}>{mode==='gym'?'BATALHA 3 × 3':'ENCONTROS SELVAGENS'}</div>{mode==='gym'&&<h2>{g?g.leader+' × '+data.name:next?'Desafiar '+next.leader:'Todos os ginásios conquistados'}</h2>}
 {!e&&mode==='gym'&&<><p>Equipe definida na Coleção: {data.team.length}/3.</p><div className={gymStyles.choices}>{data.team.map(uid=>{const p=data.roster.find(x=>x.uid===uid);return p?<div key={uid} className={gymStyles.choiceOn}><PokemonArt id={p.pokemonId} name={name(p.pokemonId)}/><span>{name(p.pokemonId)} · Nv. {p.level}</span></div>:null;})}</div></>}
 {mode==='region'&&lead&&<div className={styles.regionLeaderSummary}><div className={styles.arenaLeader}><PokemonArt id={lead.pokemonId} name={name(lead.pokemonId)}/><div><small><i className="fa-solid fa-crown" aria-hidden="true"/> SEU LÍDER</small><strong>{name(lead.pokemonId)} · Nível {lead.level}</strong></div></div><div className={styles.arenaOverview}><div><i className="fa-solid fa-trophy" aria-hidden="true"/><strong>{count('wins')}</strong><span>Vitórias</span></div><div><i className="fa-solid fa-handshake" aria-hidden="true"/><strong>{count('draws')}</strong><span>Empates</span></div><div><i className="fa-solid fa-shield-halved" aria-hidden="true"/><strong>{count('losses')}</strong><span>Derrotas</span></div></div><label>{xpMax===null?'Nível máximo':'XP '+xp+' / '+xpMax}<progress aria-label="XP do Pokémon líder" value={xpMax===null?1:xp} max={xpMax??1}/></label></div>}
 {!e&&<div className={styles.regionBattleActions}><button className={styles.secondary} type="button" onClick={onBack}>{mode==='gym'?'Abrir Coleção':'Voltar às regiões'}</button><button type="button" className={styles.primary} data-testid="online-battle-start" ref={startRef} disabled={busy||blocked||(mode==='gym'?!gym?.canReserve:!region?.regions.some(x=>x.id===regionId&&x.unlocked)||!!region.pendingLoot)} onClick={launch}>{mode==='gym'?'Iniciar batalha':'Batalhar na região'}</button></div>}
 {e?.phase==='reserved'&&<button className={styles.primary} disabled={busy||blocked} onClick={launch}>Retomar batalha</button>}
 {e&&e.phase!=='reserved'&&<p>Turno {e.turn} · {playing?'Apresentando diário':e.phase==='await-player'?'Combate em andamento':e.outcome==='win'||e.outcome==='player-win'?'Vitória!':e.outcome==='draw'?'Empate':'Derrota'}</p>}
 {e?.phase==='await-player'&&<div className={gymStyles.actions}><button className={styles.primary} disabled={busy||auto||blocked} onClick={()=>{sent.current='';setAuto(true);}}>Continuar batalha automática</button><button className={styles.secondary} disabled={!auto} onClick={()=>setAuto(false)}>Pausar após a rodada</button></div>}
 </div>
 {lead&&(mode==='region'||!!g?.player&&!!g.opponent)&&<div className={styles.battleArenaColumn}>{masteredSpecies.includes(a?.speciesId??lead.pokemonId)&&<span className={styles.masteryEmblem}><i className="fa-solid fa-award" aria-hidden="true"/> {name(a?.speciesId??lead.pokemonId)} · Maestria V</span>}<BattleStage stageRef={stageRef} levelUp={levelUp} player={{name:name(a?.speciesId??lead.pokemonId),level:w?.phase==='paid'?lead.level:a?.level??w?.playerLevel??lead.level,art:<PokemonArt id={a?.speciesId??lead.pokemonId} name={name(a?.speciesId??lead.pokemonId)} large/>}} wild={z?{name:name(z.speciesId),level:z.level??w?.level??1,art:<PokemonArt id={z.speciesId} name={name(z.speciesId)} large/>}:null} frame={frame} playerMaxHp={a?.maxHp??null} wildMaxHp={z?.maxHp??null} playerMaxSp={a?.maxSp??null} wildMaxSp={z?.maxSp??null} playing={playing&&!!frame} cue={key+':'+visible} {...(a&&z?{vitals:{playerHp:a.hp,wildHp:z.hp,playerSp:a.sp,wildSp:z.sp}}:{})} opponentLabel={g?'Pokémon de '+g.leader:'Pokémon selvagem'}/>
 {w?.phase==='paid'&&!playing&&!levelUp&&<div className={styles.battleCapturePlacement} ref={captureRef} tabIndex={-1}><div className={styles.captureDecision}><h3>{w.outcome==='win'?'Tentar capturar '+name(w.wild?.speciesId??0)+'?':'Encerrar batalha'}</h3>{w.captureChoices.map(ball=><button key={ball.ballId} className={styles.primary} disabled={busy||ball.quantity<1} onClick={()=>void onCommand('finish',ball.ballId)}><PokeballArt id={ball.ballId}/> {balls[ball.ballId]??ball.ballId} · {ball.quantity}</button>)}<button className={styles.secondary} disabled={busy} onClick={()=>void onCommand('finish','skip')}>Seguir sem capturar</button></div></div>}
 </div>}
 </div>
 {g&&display?.player&&display.opponent&&<div className={gymStyles.benchColumns}><Reserve party={display.player} label="Suas reservas"/><Reserve party={display.opponent} label={'Reservas de '+g.leader}/></div>}
 {e&&log.length>0&&<BattlePlayback key={key} log={log} initialVisible={prior} turns={e.turn} playing={playing} holdLastFrame onProgress={n=>setReveal(old=>old.key===key&&old.visible===n?old:{key,visible:n})} onFinished={()=>{prev.current={id:e.id,length:log.length};setShown({key,length:log.length});}}/>}
 {e&&!playing&&['resolved','certified'].includes(e.phase)&&<button className={styles.primary} disabled={busy} onClick={()=>void onCommand('reward')}>{mode==='gym'?'Finalizar confronto':'Receber recompensas'}</button>}
 {mode==='region'&&reward&&onDismissReward&&<RegionDialog title="Resultado da batalha" onClose={onDismissReward}><h2>{reward.outcome==='win'?'Vitória!':reward.outcome==='draw'?'Empate':'Derrota'}</h2><div className={styles.battleRewards}><div><small><i className="fa-solid fa-user" aria-hidden="true"/> XP do treinador</small><strong>+{reward.trainerXp}</strong></div><div><small><i className="fa-solid fa-dragon" aria-hidden="true"/> XP do Pokémon</small><strong>+{reward.pokemonXp}</strong></div><div><small><i className="fa-solid fa-coins" aria-hidden="true"/> Ouro</small><strong>+{reward.coins}</strong></div><div><small><PokeballSymbol/> Captura</small><strong>{reward.capture==='captured'?'Bem-sucedida':reward.capture==='failed'?'Falhou':'Não realizada'}</strong></div></div><h3>Itens dropados</h3>{reward.loot.stored.length+reward.loot.pending.length===0?<p>Nenhum item dropado.</p>:<ul className={styles.rewardDrops}>{[...reward.loot.stored.map(item=>({item,pending:false})),...reward.loot.pending.map(item=>({item,pending:true}))].map(({item,pending},i)=><li key={i} className={styles.rewardDropCard} data-rarity={item.kind==='gear'?item.gear.rarity:item.kind==='tm'?machineRarity(item.itemId)??undefined:undefined}><span className={styles.rewardDropIcon}>{item.kind==='ball'?<PokeballArt id={item.itemId}/>:item.kind==='gear'?<GearArt id={item.gear.templateId} rarity={item.gear.rarity} fallback="fa-shield-halved"/>:<i className={item.kind==='tm'?'fa-solid fa-compact-disc':'fa-solid fa-gem'} aria-hidden="true"/>}</span><strong>{item.kind==='gear'?LEGACY_ITEMS.find(x=>x.id===item.gear.templateId)?.name??item.gear.templateId:item.kind==='tm'?item.itemId.toUpperCase()+' — '+(kantoMachine(item.itemId)?.moveName??''):balls[item.itemId]??stones[item.itemId]??item.itemId}</strong><small>{item.kind==='gear'?rarities[item.gear.rarity]??item.gear.rarity:'Quantidade: '+item.quantity}</small><small><i className={'fa-solid '+(pending?'fa-clock':'fa-check')} aria-hidden="true"/> {pending?'Pendente':'Na mochila'}</small></li>)}</ul>}<button type="button" className={styles.primary} onClick={onDismissReward}>Continuar</button></RegionDialog>}
 </section>;
}
