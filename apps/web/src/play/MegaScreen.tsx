import {useState} from 'react';
import {kantoSpecies,kantoMegaForm,kantoPokemonFormProfile} from '@kanto/game-core';
import type {KantoMegaFormId} from '@kanto/game-core';
import type {MegaView,MegaTrial} from './onlinePlay';
import type {LegacyPokemon} from '../storage/legacySave';
import {PokemonArt} from './JourneyShell';
import {BattleStage} from './BattleStage';
import {BattlePlayback} from './BattlePlayback';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
import css from './MegaScreen.module.css';

type Command={uid:number;formId:KantoMegaFormId};
type Mutate=(command:Command,revision:number)=>Promise<boolean>;
const species=(id:number)=>kantoSpecies(id)?.name??'Pokémon';
export const stoneName=(id:string)=>id.split('-').map(s=>s.length===1?s.toUpperCase():s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
const families:Record<number,string>={3:'Bulbasaur',6:'Charmander',9:'Squirtle'};
const types:Record<string,string>={grass:'Planta',poison:'Venenoso',fire:'Fogo',dragon:'Dragão',flying:'Voador',water:'Água'};
const typeLabel=(t:readonly string[])=>t.map(x=>types[x]??x).join(' / ');
function TrialReplay({trial,onClose}:{trial:MegaTrial;onClose:()=>void}){
 const [visible,setVisible]=useState(1);
 const [done,setDone]=useState(false);
 const fighter=(f:MegaTrial['player'])=>({name:f.name,level:f.level,art:<PokemonArt id={kantoPokemonFormProfile(f.speciesId,f.megaForm)?.artId??f.speciesId} name={f.name} large/>});
 const frame=trial.frames[Math.max(0,Math.min((done?trial.frames.length:visible)-1,trial.frames.length-1))]??null;
 return <section className={styles.panel} aria-label="Batalha do Santuário" data-testid="mega-trial-replay">
  <h2>Desafio Mega · UID #{trial.uid}</h2>
  <BattleStage player={fighter(trial.player)} wild={fighter(trial.boss)} frame={frame} playerMaxHp={trial.player.maxHp} wildMaxHp={trial.boss.maxHp} playerMaxSp={trial.player.maxSp} wildMaxSp={trial.boss.maxSp} playing={!done} cue={trial.id+':'+visible} opponentLabel="Guardião Mega" vitals={{playerHp:trial.player.hp,wildHp:trial.boss.hp,playerSp:trial.player.sp,wildSp:trial.boss.sp}}/>
  <BattlePlayback log={trial.log} turns={trial.turns} playing={!done} onProgress={setVisible} onFinished={()=>setDone(true)} holdLastFrame/>
  {done&&<div className={css.result} role="status"><strong>{trial.outcome==='win'?'Vitória!':trial.outcome==='loss'?'Derrota':'Empate'}</strong><p>{trial.stoneId?stoneName(trial.stoneId)+' conquistada e vinculada ao UID #'+trial.uid+'. A Mega Evolução está disponível na tela Evolução.':'Seu Passe Mega foi preservado. Treine e tente novamente.'}</p><button className={styles.primary} type="button" onClick={onClose}>Voltar ao Santuário</button></div>}
 </section>;
}
export function MegaSanctuary({view,roster,busy,onChallenge,onEvolution}:{view:MegaView;roster:readonly LegacyPokemon[];busy:boolean;onChallenge:Mutate;onEvolution:(uid:number)=>void}){
 const [uid,setUid]=useState<number|null>(null);
 const [confirm,setConfirm]=useState<KantoMegaFormId|null>(null);
 const [shown,setShown]=useState<string|null>(null);
 const [dismissed,setDismissed]=useState<string|null>(null);
 const candidates=view.pokemon;
 const selected=candidates.find(p=>p.uid===uid)??candidates.find(p=>p.pass==='available')??candidates[0];
 const specimen=roster.find(p=>p.uid===selected?.uid);
 const blocked=busy||view.busy;
 const trial=view.lastTrial;
 const replay=trial&&trial.id!==dismissed&&(shown===trial.id||shown==='latest');
 if(replay)return <TrialReplay key={trial.id} trial={trial} onClose={()=>{setDismissed(trial.id);setShown(null);}}/>;
 return <div className={css.workspace}>
  <section className={styles.hero}><div><div className={styles.kicker}>DESAFIO FINAL · KANTO</div><h2>Santuário Mega</h2><p>Supere o guardião da sua família. Uma vitória consome o Passe Mega individual e vincula a pedra ao seu Pokémon.</p><small>1 × 1 · Nível 100 · HP/SP completos · Sem captura ou recompensas comuns</small></div><i className={'fa-solid fa-gem '+css.heroGem} aria-hidden="true"/></section>
  <section className={styles.panel}><h2>Seu candidato</h2>
   {candidates.length>0?<><label className={css.select}>Selecionar Pokémon<select value={selected?.uid??''} onChange={e=>setUid(Number(e.target.value))}>{candidates.map(p=><option key={p.uid} value={p.uid}>{kantoPokemonFormProfile(p.speciesId,p.currentForm??undefined)?.name??species(p.speciesId)} · UID #{p.uid} · Nv. {roster.find(x=>x.uid===p.uid)?.level??'?'} · {p.pass==='available'?'Passe disponível':p.pass==='consumed'?'Passe consumido':'Requisitos pendentes'}</option>)}</select></label>
   {selected&&specimen&&<div className={css.identity}><PokemonArt id={kantoPokemonFormProfile(specimen.pokemonId,specimen.megaForm)?.artId??specimen.pokemonId} name={species(specimen.pokemonId)}/><div><strong>UID #{selected.uid} · Nível {specimen.level} · Afinidade {specimen.affinity}%</strong><p>{selected.pass==='available'?'Passe Mega: 1/1':selected.pass==='consumed'?'Passe Mega: 0/1 — vitória já conquistada':'Passe bloqueado: cumpra todos os requisitos.'}</p>{selected.earnedForm&&!selected.currentForm&&<button type="button" className={styles.secondary} onClick={()=>onEvolution(selected.uid)}>Ir para Evolução</button>}</div></div>}</>:<p>Treine Venusaur, Charizard ou Blastoise até a evolução natural final.</p>}
   {blocked&&<p role="status">Finalize a atividade atual antes de iniciar outro desafio.</p>}
   {trial&&<button className={styles.secondary} type="button" onClick={()=>{setDismissed(null);setShown(trial.id)}}>Rever último desafio</button>}
  </section>
  <div className={css.grid}>{view.challenges.map(({form,name,unlocked})=>{
    const option=selected?.options.find(o=>o.form.id===form.id);
    const met=option?.met;
    const missing=met?Object.entries({level:'Nível 100',affinity:'Afinidade 100%',mastery:'Maestria V',badges:'8 insígnias'}).filter(([k])=>!met[k as 'level'|'affinity'|'mastery'|'badges']).map(([,label])=>label):[];
    const eligible=unlocked&&!!option?.canChallenge&&!blocked;
    const reason=!unlocked?'Atinja Maestria V na família de '+families[form.speciesId]+'.':selected?.speciesId!==form.speciesId?'Selecione um '+species(form.speciesId)+' elegível.':selected.pass==='consumed'?'Passe individual já consumido.':missing.length?missing.join(' · '):blocked?'Atividade em andamento.':'Passe disponível';
    return <article key={form.id} className={css.challenge} data-locked={!eligible} data-testid={'mega-challenge-'+form.id}>
      <PokemonArt id={form.pokemonApiId} name={form.name} large/><h3>{name}</h3><strong>{form.name}</strong><small>{typeLabel(form.types)} · Nv. 100</small><p>Recompensa: {stoneName(form.stoneId)}</p><small>{reason}</small>
      <button className={eligible?styles.primary:styles.secondary} type="button" disabled={!eligible} onClick={()=>setConfirm(form.id)}>{eligible?'Desafiar':'Bloqueado'}</button>
    </article>;
  })}</div>
  {confirm&&selected&&<RegionDialog title="Confirmar desafio Mega" size="compact" onClose={()=>setConfirm(null)}><p>UID #{selected.uid} enfrentará {kantoMegaForm(confirm)?.name}. A vitória consome o passe e bloqueia as outras escolhas deste Pokémon. Derrotas e empates não consomem o passe.</p><div className={styles.evolutionConfirmActions}><button className={styles.secondary} onClick={()=>setConfirm(null)}>Cancelar</button><button className={styles.primary} disabled={blocked||!selected.options.some(o=>o.form.id===confirm&&o.canChallenge)} onClick={async()=>{const formId=confirm;setConfirm(null);setDismissed(trial?.id??null);if(await onChallenge({uid:selected.uid,formId},view.revision))setShown('latest');}}>Iniciar desafio</button></div></RegionDialog>}
 </div>;
}
export function MegaEvolution({view,uid,busy,onEvolve,onSanctuary}:{view:MegaView;uid:number;busy:boolean;onEvolve:Mutate;onSanctuary:()=>void}){
 const p=view.pokemon.find(x=>x.uid===uid);
 const [confirm,setConfirm]=useState<KantoMegaFormId|null>(null);
 if(!p)return null;
 const blocked=busy||view.busy;
 return <section className={styles.panel} data-testid="mega-evolution"><h2><i className="fa-solid fa-gem" aria-hidden="true"/> Mega Evolução</h2>
  {p.currentForm?<p>Forma permanente: {kantoMegaForm(p.currentForm)?.name}. O Passe Mega já foi consumido.</p>:<><p>Requisitos: nível 100, afinidade 100%, Maestria V da família, oito insígnias e pedra vinculada a este UID.</p>
  {p.options.map(o=><div className={styles.evolutionOption} key={o.form.id}><PokemonArt id={o.form.pokemonApiId} name={o.form.name}/><div><strong>{o.form.name}</strong><small>{stoneName(o.form.stoneId)} · {o.met.stone?'Pedra vinculada':'Pedra não conquistada'}</small><small>{typeLabel(o.form.types)}</small></div><button type="button" className={styles.primary} disabled={blocked||!o.available} onClick={()=>setConfirm(o.form.id)}>Mega Evoluir</button></div>)}
  {view.visible&&p.pass!=='consumed'&&<button type="button" className={styles.secondary} onClick={onSanctuary}>Abrir Santuário Mega</button>}</>}
  {confirm&&<RegionDialog title="Confirmar Mega Evolução" size="compact" onClose={()=>setConfirm(null)}><p>Esta transformação é permanente. A pedra vinculada ao UID #{uid} será consumida para evoluir em {kantoMegaForm(confirm)?.name}.</p><div className={styles.evolutionConfirmActions}><button className={styles.secondary} onClick={()=>setConfirm(null)}>Cancelar</button><button className={styles.primary} disabled={blocked||!p.options.some(o=>o.form.id===confirm&&o.available)} onClick={()=>{const formId=confirm;setConfirm(null);void onEvolve({uid,formId},view.revision)}}>Confirmar Mega Evolução</button></div></RegionDialog>}
 </section>;
}
export function MegaBag({view,onEvolution}:{view:MegaView;onEvolution:(uid:number)=>void}){
 return <section className={styles.panel} data-testid="mega-bag"><h2><i className="fa-solid fa-gem" aria-hidden="true"/> Pedras Mega</h2><p>Pedras individuais, não transferíveis. Use-as na tela Evolução.</p>{view.stones.length===0?<p>Nenhuma Mega Stone conquistada.</p>:<div className={css.grid}>{view.stones.map(s=><article key={s.uid} className={css.stone}><i className="fa-solid fa-gem" aria-hidden="true"/><div><strong>{stoneName(s.id)}</strong><small>Quantidade: 1 · Vinculada ao UID #{s.uid}</small><button type="button" className={styles.secondary} onClick={()=>onEvolution(s.uid)}>Ver Pokémon</button></div></article>)}</div>}</section>;
}
