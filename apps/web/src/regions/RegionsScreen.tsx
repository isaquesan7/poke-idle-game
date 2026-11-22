import {KANTO_REGIONS,KANTO_BATTLE_SPECIES} from '@kanto/game-core';
import type {KantoBallId} from '@kanto/game-core';
import styles from './RegionsScreen.module.css';

type BallStock=Readonly<Partial<Record<KantoBallId,number>>>;
interface Props{
  readonly trainerLevel:number;
  readonly leaderSpeciesId:number;
  readonly leaderLevel:number;
  readonly selectedRegionId:number;
  readonly onSelectRegion:(id:number)=>void;
  readonly balls:BallStock;
  readonly selectedBall:KantoBallId|null;
  readonly onSelectBall:(ball:KantoBallId|null)=>void;
  readonly wins:readonly number[];
  readonly seenIds:readonly number[];
  readonly capturedIds:readonly number[];
  readonly busy:boolean;
  readonly onFight:(regionId:number)=>void;
  readonly onOpenTeam:()=>void;
  readonly lastBattleRegionId?:number|undefined;
  readonly onReplayBattle?:()=>void;
}
const ballLabels=[
  {id:'poke-ball',name:'Poké Ball'},
  {id:'great-ball',name:'Great Ball'},
  {id:'ultra-ball',name:'Ultra Ball'}
] as const;

/** D-064AI: visualiza o save real, mas não o modifica; batalhar delega ao writer da Arena. */
export function RegionsScreen({
  trainerLevel,leaderSpeciesId,leaderLevel,selectedRegionId,onSelectRegion,balls,
  selectedBall,onSelectBall,wins,seenIds,capturedIds,busy,onFight,onOpenTeam,
  lastBattleRegionId,onReplayBattle
}:Props){
  const selected=KANTO_REGIONS.find(region=>region.id===selectedRegionId)??KANTO_REGIONS[0]!;
  const unlocked=trainerLevel>=selected.trainerUnlockLevel;
  const seen=new Set(seenIds);
  const caught=new Set(capturedIds);
  const available=selectedBall===null||(balls[selectedBall]??0)>0;
  const discovered=selected.speciesIds.filter(id=>seen.has(id)).length;
  const caughtHere=selected.speciesIds.filter(id=>caught.has(id)).length;
  return <div className={styles.screen}>
    <header className={styles.intro}>
      <div>
        <span className={styles.kicker}>KANTO · EXPLORAÇÃO REGIONAL</span>
        <h2>Suas regiões</h2>
        <p>Escolha uma área para enfrentar Pokémon selvagens, ganhar experiência e tentar novas capturas. As batalhas acontecem na região escolhida e salvam seu progresso normalmente.</p>
      </div>
      <div className={styles.summary} aria-label="Resumo da exploração">
        <div><strong>{KANTO_REGIONS.filter(r=>trainerLevel>=r.trainerUnlockLevel).length}/10</strong><span>Regiões abertas</span></div>
        <div><strong>{trainerLevel}</strong><span>Nível do treinador</span></div>
        <div><strong>{wins.reduce((total,amount)=>total+amount,0)}</strong><span>Vitórias regionais</span></div>
      </div>
    </header>

    <section aria-label="Escolha de região" className={styles.regions}>
      {KANTO_REGIONS.map(region=>{
        const availableRegion=trainerLevel>=region.trainerUnlockLevel;
        const active=region.id===selected.id;
        return <button key={region.id} type="button"
          className={active?styles.regionActive:styles.region}
          aria-pressed={active} aria-controls="regional-details"
          onClick={()=>onSelectRegion(region.id)}>
          <span className={styles.regionNumber}>ÁREA {String(region.id).padStart(2,'0')}</span>
          <strong>{region.name}</strong>
          <span className={styles.regionRange}>Pokémon Lv. {region.levelMin}–{region.levelMax}</span>
          <span className={availableRegion?styles.open:styles.locked}>
            <i className={'fa-solid '+(availableRegion?'fa-lock-open':'fa-lock')} aria-hidden="true"/>
            {availableRegion?' Desbloqueada':' Treinador Lv. '+region.trainerUnlockLevel}
          </span>
        </button>;
      })}
    </section>

    <section id="regional-details" aria-label="Detalhes da região" className={styles.details}>
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>REGIÃO {String(selected.id).padStart(2,'0')}</span>
          <h3>{selected.name}</h3>
          <p>Encontros de nível {selected.levelMin} a {selected.levelMax} · {selected.speciesIds.length} espécies nesta região.</p>
        </div>
        <span className={unlocked?styles.open:styles.locked}>
          {unlocked?'Região disponível':'Desbloqueia no nível '+selected.trainerUnlockLevel}
        </span>
      </div>
      <div className={styles.detailStats}>
        <div><strong>{wins[selected.id-1]??0}</strong><span>Vitórias aqui</span></div>
        <div><strong>{discovered}/{selected.speciesIds.length}</strong><span>Espécies vistas</span></div>
        <div><strong>{caughtHere}/{selected.speciesIds.length}</strong><span>Espécies registradas</span></div>
      </div>

      <section aria-label="Pokémon possíveis nesta região" className={styles.catalog}>
        <div className={styles.catalogHeading}>
          <h4>Pokémon da região</h4>
          <small>Espécies ainda não vistas permanecem ocultas. Lendários e míticos são extremamente raros.</small>
        </div>
        <ul className={styles.pokemonList}>
          {selected.speciesIds.map(id=>{
            const discoveredSpecies=seen.has(id);
            const species=KANTO_BATTLE_SPECIES[id];
            return <li key={id} className={styles.pokemon}>
              {discoveredSpecies
                ?<img loading="lazy" src={`/assets/pokemon-gifs/poke_${id}.gif`} alt="" width="68" height="68"/>
                :<span className={styles.unknown} aria-hidden="true">?</span>}
              <span>#{String(id).padStart(3,'0')}</span>
              <strong>{discoveredSpecies?species?.name??'Pokémon':'Desconhecido'}</strong>
              <small>{caught.has(id)?'Capturado':discoveredSpecies?'Encontrado':'Não descoberto'}</small>
            </li>;
          })}
        </ul>
      </section>

      <section aria-label="Preparar combate regional" className={styles.prepare}>
        <div className={styles.leader}>
          <img src={`/assets/pokemon-gifs/poke_${leaderSpeciesId}.gif`} alt="" width="76" height="76"/>
          <div><span className={styles.kicker}>SEU LÍDER</span>
            <strong>{KANTO_BATTLE_SPECIES[leaderSpeciesId]?.name??'Pokémon'} · Lv. {leaderLevel}</strong>
            <button type="button" className={styles.link} onClick={onOpenTeam}>Alterar equipe</button>
          </div>
        </div>
        <label className={styles.ball}>
          <strong>Pokébola após a vitória</strong>
          <select aria-label="Pokébola para captura regional" value={selectedBall??'none'}
            onChange={event=>onSelectBall(event.target.value==='none'?null:event.target.value as KantoBallId)}>
            <option value="none">Não tentar capturar</option>
            {ballLabels.map(ball=><option key={ball.id} value={ball.id} disabled={(balls[ball.id]??0)<1}>
              {ball.name} · {balls[ball.id]??0} disponível(is)
            </option>)}
          </select>
        </label>
        <button type="button" className={styles.fight}
          disabled={!unlocked||busy||!available}
          onClick={()=>onFight(selected.id)}>
          <i className="fa-solid fa-khanda" aria-hidden="true"/> Batalhar em {selected.name}
        </button>
        {lastBattleRegionId===selected.id&&onReplayBattle&&
          <button type="button" className={styles.link} onClick={onReplayBattle}>
            Rever último combate nesta região
          </button>}
        {!unlocked&&<p className={styles.notice} role="status">Alcance o nível {selected.trainerUnlockLevel} de treinador para lutar nesta região.</p>}
        {!available&&<p className={styles.notice} role="status">Sem estoque dessa Pokébola. Escolha outra ou lute sem tentar capturar.</p>}
        {selected.id===1&&leaderLevel===1&&
          <p className={styles.notice}>Primeiros passos: mesmo se não vencer, seu Pokémon ganha 22 XP de aprendizado até alcançar o nível 2. O treinador só ganha XP nas vitórias ou expedições.</p>}
        <p className={styles.notice}>O combate abre a tela da região com animações e diário turno a turno. Pokébolas só são gastas numa tentativa após a vitória. Lendários exigem Ultra Ball.</p>
      </section>
    </section>
  </div>;
}
