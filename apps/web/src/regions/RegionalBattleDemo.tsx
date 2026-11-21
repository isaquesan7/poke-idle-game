import {useEffect,useState} from 'react';
import type {RegionDemoResult} from './previewBattle';
import {previewRegionDemo} from './previewBattle';
import {PREVIEW_REGIONS} from './previewCatalog';
import styles from './RegionalBattleDemo.module.css';

const STARTERS=[{id:1,name:'Bulbasaur'},{id:4,name:'Charmander'},{id:7,name:'Squirtle'}] as const;
const LEVELS=[5,15,30,45,60,75,90,100] as const;

export function RegionalBattleDemo({regionId}:{readonly regionId:number}){
  const [leader,setLeader]=useState(1);
  const [level,setLevel]=useState(5);
  const [result,setResult]=useState<RegionDemoResult|null>(null);
  const [revealed,setRevealed]=useState(0);
  const region=PREVIEW_REGIONS.find(r=>r.id===regionId);
  useEffect(()=>{
    if(!result||revealed>=result.log.length)return;
    const timeout=setTimeout(()=>setRevealed(current=>Math.min(result.log.length,current+1)),680);
    return()=>clearTimeout(timeout);
  },[result,revealed]);
  if(!region)return null;
  function begin(){
    const request={
      regionId,leaderSpeciesId:leader,leaderLevel:level,
      // Sorteio local NÃO autoritativo: sem qualquer recompensa ou gravação.
      seed:Math.floor(Math.random()*0x100000000)
    };
    const proposed=previewRegionDemo(request);
    setResult(proposed);
    setRevealed(proposed?1:0);
  }
  return <section className={styles.panel} aria-label="Demonstração de encontro regional">
    <div className={styles.heading}>
      <div>
        <span className={styles.kicker}>Laboratório · sem recompensas</span>
        <h3>Simular encontro nesta região</h3>
        <p>Experimente uma batalha usando o motor real. É apenas uma demonstração: não ganha XP, moedas, Pokébolas ou novos Pokémon.</p>
      </div>
    </div>
    <div className={styles.controls}>
      <label>Seu Pokémon
        <select value={leader} onChange={event=>{setLeader(Number(event.target.value));setResult(null);}}>
          {STARTERS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>Nível de demonstração
        <select value={level} onChange={event=>{setLevel(Number(event.target.value));setResult(null);}}>
          {LEVELS.map(n=><option key={n} value={n}>Nível {n}</option>)}
        </select>
      </label>
      <button type="button" className={styles.start} onClick={begin}>
        {result?'Simular outro encontro':'Simular encontro'}
      </button>
    </div>
    {result&&<div className={styles.battle} data-testid="regional-demo-result">
      <div className={styles.opponents}>
        <div className={styles.combatant}>
          <img src={`/assets/pokemon-gifs/poke_${result.leaderSpeciesId}.gif`} alt={result.leaderName} width="92" height="92"/>
          <strong>{result.leaderName}</strong>
          <small>Lv. {result.leaderLevel} · HP final {result.playerRemainingHp}/{result.playerMaxHp}</small>
        </div>
        <span className={styles.versus} aria-hidden="true">VS</span>
        <div className={styles.combatant}>
          <img src={`/assets/pokemon-gifs/poke_${result.wildSpeciesId}.gif`} alt={result.wildName} width="92" height="92"/>
          <strong>{result.wildName}</strong>
          <small>Lv. {result.wildLevel} · HP final {result.wildRemainingHp}/{result.wildMaxHp}</small>
        </div>
      </div>
      <div className={styles.playback}>
        <div className={styles.playbackHeading}>
          <strong>Diário da demonstração</strong>
          <span>{revealed}/{result.log.length} mensagens</span>
        </div>
        <ol className={styles.log}>
          {result.log.slice(0,revealed).map((line,index)=><li key={index}>{line}</li>)}
        </ol>
        <p className={styles.status} role="status" aria-live="polite">
          {revealed<result.log.length
            ?'Reproduzindo batalha, mensagem por mensagem.'
            :`Demonstração encerrada após ${result.turns} turnos: ${result.outcome==='win'?'vitória':result.outcome==='loss'?'derrota':'empate'}. Nenhum progresso alterado.`}
        </p>
        {revealed<result.log.length&&<button type="button" className={styles.skip}
          onClick={()=>setRevealed(result.log.length)}>Ver resultado completo</button>}
      </div>
    </div>}
  </section>;
}
