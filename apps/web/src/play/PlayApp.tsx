import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  EXPEDITION_CYCLE_MS, expeditionRewards, LEGACY_EQUIPMENT_SLOTS,
  LEGACY_ITEMS, LEGACY_STARTERS, STATS, legacyPokemonManualBudget,
  KANTO_BATTLE_SPECIES, pokemonFinalStats, affinityRate, zeroStats,
  kantoLevelMoves,kantoSupportMoves,KANTO_SUPPORT_MOVES,pokemonMoveSlots,
  legacyMoveRankLimits,KANTO_BATTLE_MOVES,kantoMoveSecondaryEffect,
  kantoMoveSpCost,kantoMovePp,
  KANTO_EVOLUTION_STONES, kantoEvolutionOptions,
  KANTO_REGIONS,inspectKantoBallPocket
} from '@kanto/game-core';
import type { Stat, EquipmentSlot, StatValues, KantoBattleVisualFrame,KantoBallId } from '@kanto/game-core';
import { projectLegacyTrainer, STAT_LABELS } from '../features/trainer/legacyProjection';
import { parseLegacySave } from '../storage/legacySave';
import {
  PLAY_LOCK_NAME, PLAY_SAVE_KEY, createPlaySave, readPlaySave,
  resetPlaySave, updatePlaySave
} from './playSave';
import type { PlayAction, PlayRead, PlayWrite } from './playSave';
import styles from './PlayApp.module.css';
import { PokedexPanel } from './PokedexPanel';
import { BattlePlayback } from './BattlePlayback';
import { BattleStage } from './BattleStage';
import { TrainerScreen } from './TrainerScreen';
import { PokemonTraining } from './PokemonTraining';
import { RegionsScreen } from '../regions/RegionsScreen';

type Tab = 'overview' | 'trainer' | 'pokemon' | 'collection' | 'pokedex' | 'regions' | 'battle' | 'expedition';
type CollectionFilter = 'all' | 'team' | 'reserve';
type CollectionSort = 'recent' | 'level' | 'affinity' | 'species';
type PokemonSection = 'profile' | 'evolution' | 'moves';
/** D-051: navegação consistente com o Font Awesome da tela do treinador. */
const NAV_ICONS:Readonly<Record<Tab,string>>={
  overview:'fa-house',trainer:'fa-user',pokemon:'fa-dragon',collection:'fa-layer-group',
  pokedex:'fa-book-open',regions:'fa-map-location-dot',battle:'fa-khanda',expedition:'fa-compass'
};

/** D-042: animações completas na Arena independentemente do sistema operacional. */

/** A prévia do core usa este catálogo como fonte LOCAL das espécies já jogáveis. */
const BATTLE_SPECIES_CACHE = JSON.stringify({
  pokemon: Object.fromEntries(
    Object.values(KANTO_BATTLE_SPECIES).map(species=>[
      species.id,{name:species.name,base:species.base}
    ])
  )
});
function speciesName(id:number):string {
  return KANTO_BATTLE_SPECIES[id]?.name ?? 'Pokémon #' + String(id).padStart(3,'0');
}
/** Rótulos locais; as chances e efeitos vêm do domínio, não da UI. */
function effectLabel(name:string):string|null {
  const effect=kantoMoveSecondaryEffect(name);
  if(!effect)return null;
  if(effect.kind==='drain')return 'Recupera '+effect.percent+'% do dano como HP';
  if(effect.kind==='speed-drop')return effect.chance+'% de reduzir Velocidade';
  return effect.chance+'% de '+(
    effect.status==='burn'?'queimadura':effect.status==='poison'?'envenenamento':'paralisia'
  );
}
/** Histórico por UID com fallback 0 para partidas anteriores a D064BE. */
function pokemonBattleRecord(value:unknown):{wins:number;draws:number;losses:number}{
  const v=value && typeof value==='object'?value as Record<string,unknown>:{};
  const r=v.battleRecord && typeof v.battleRecord==='object'
    ?v.battleRecord as Record<string,unknown>:{};
  const read=(key:'wins'|'draws'|'losses')=>
    typeof r[key]==='number'&&Number.isSafeInteger(r[key])&&r[key]>=0?r[key] as number:0;
  return {wins:read('wins'),draws:read('draws'),losses:read('losses')};
}
function focusedSpeciesFallback(speciesId:number|undefined) {
  return speciesId?KANTO_BATTLE_SPECIES[speciesId]?.move:undefined;
}
function manualValues(input:unknown):StatValues {
  const result=zeroStats();
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const values=input as Record<string,unknown>;
    for (const stat of STATS) {
      const value=values[stat];
      if (typeof value==='number' && Number.isSafeInteger(value) && value>=0) result[stat]=value;
    }
  }
  return result;
}
const STARTERS = [
  { id: 1, type: 'Grama / Veneno', hint: 'Resistente e equilibrado' },
  { id: 4, type: 'Fogo', hint: 'Ataque e velocidade' },
  { id: 7, type: 'Água', hint: 'Defesa e resistência' }
] as const;

function readSafe(): PlayRead {
  try { return readPlaySave(window.localStorage); }
  catch { return { status: 'unavailable' }; }
}

/** GIFs locais na rota pública; arte estática só se um GIF não carregar. */
function PokemonArt({ id, name, large = false }: {
  id: number; name: string; large?: boolean
}) {
  return (
    <img
      className={large ? styles.pokemonLarge : styles.pokemonArt}
      src={`/assets/pokemon-gifs/poke_${id}.gif`}
      onError={event => {
        const image = event.currentTarget;
        image.onerror = null;
        image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      }}
      alt={name}
      loading={large?'eager':'lazy'}
    />
  );
}

/** Preposição natural para o título da batalha: na Costa Oceânica, no Bosque Inicial etc. */
function regionBattleTitle(regionId:number,regionName:string):string {
  const byId:Readonly<Record<number,string>>={
    1:'no',2:'nas',3:'na',4:'nos',5:'nas',
    6:'no',7:'na',8:'na',9:'no',10:'no'
  };
  return 'Batalha '+(byId[regionId]??'em')+' '+regionName;
}

function sectionName(tab: Tab): string {
  return { overview: 'Visão geral', trainer: 'Treinador', pokemon: 'Pokémon', collection: 'Coleção', pokedex: 'Pokédex', regions: 'Regiões', battle: 'Batalha regional', expedition: 'Expedição' }[tab];
}

/**
 * Primeira experiência v0.2 jogável: cria progresso, edita atributos e
 * recebe recursos idle na mesma chave local, sem simular vitória falsa.
 * A v0.1 existente não é importada nem modificada.
 */
export function PlayApp({initialTab='overview'}:{readonly initialTab?:'overview'|'regions'}={}) {
  const [save, setSave] = useState<PlayRead>(readSafe);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [regionalArea, setRegionalArea] = useState(1);
  const [expeditionArea, setExpeditionArea] = useState(1);
  const [captureBall,setCaptureBall] = useState<KantoBallId|null>('poke-ball');
  const [name, setName] = useState('');
  const [starter, setStarter] = useState(1);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  /** Apenas navegação local: não grava no save nem altera o Pokémon ativo. */
  const [pokemonSection,setPokemonSection]=useState<PokemonSection>('profile');
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('recent');
  const [feedback, setFeedback] = useState('');
  const [serverOnline,setServerOnline]=useState<boolean|null>(null);
  const [battlePlayback, setBattlePlayback] = useState<{id:string;seq:number;done:boolean}|null>(null);
  /** Apenas reprodução: não faz parte do save do jogo. */
  const [battleReveal,setBattleReveal]=useState<{key:string;visible:number}|null>(null);
  const settlingBattle=useRef<string|null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = (event: StorageEvent) => {
      if (event.key === PLAY_SAVE_KEY || event.key === null) setSave(readSafe());
    };
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  /** Status real do endpoint /health, sem confundir com a PokéAPI. */
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/health',{signal:controller.signal,cache:'no-store'})
      .then(response=>setServerOnline(response.ok))
      .catch(()=>{if(!controller.signal.aborted)setServerOnline(false);});
    return ()=>controller.abort();
  },[]);

  /** Preferir Web Lock; sem suporte o modo alfa oferece revisão otimista local. */
  async function transact(callback: () => PlayWrite): Promise<PlayWrite|null> {
    if (busy) return null;
    setBusy(true);
    try {
      const execute = () => callback();
      const outcome = navigator.locks?.request
        ? await navigator.locks.request(PLAY_LOCK_NAME, { mode: 'exclusive' }, execute)
        : execute();
      setSave(readSafe());
      setFeedback(outcome.status === 'ok' ? '' : outcome.reason);
      return outcome;
    } catch {
      setSave(readSafe());
      setFeedback('O armazenamento não pôde ser atualizado. Verifique as permissões do navegador.');
      return null;
    } finally { setBusy(false); }
  }

  function newGame() {
    void transact(() => createPlaySave(window.localStorage, name, starter, Date.now(), demo));
  }

  function dispatch(action: PlayAction): void {
    if (save.status !== 'ready') return;
    const expected = save.snapshot.revision;
    void transact(() => updatePlaySave(window.localStorage, expected, action));
  }

  /** D050: confirmação única para os pontos mostrados na prévia. */
  async function investTrainerBatch(increments:Partial<Record<Stat,number>>,revision:number):Promise<boolean>{
    if(save.status!=='ready'||save.snapshot.revision!==revision)return false;
    const outcome=await transact(()=>updatePlaySave(window.localStorage,revision,{
      type:'trainer-invest-batch',increments
    }));
    return outcome?.status==='ok';
  }

  /** D-056: prévia Pokémon confirmada em UMA revisão, sem recompensa nova. */
  async function investPokemonBatch(uid:number,increments:Partial<Record<Stat,number>>,revision:number):Promise<boolean>{
    if(save.status!=='ready'||save.snapshot.revision!==revision)return false;
    const outcome=await transact(()=>updatePlaySave(window.localStorage,revision,{
      type:'pokemon-invest-batch',uid,increments
    }));
    return outcome?.status==='ok';
  }

  /** Browser seguro: sorteia seed uint32, resolução real ocorre no game-core. */
  function fight(regionId:number): void {
    if (busy || (battlePlayback&&!battlePlayback.done) || save.status!=='ready') return;
    const expected=save.snapshot.revision;
    const seed = window.crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed === undefined) {
      setFeedback('Não foi possível sortear o encontro.');
      return;
    }
    // D064BE: primeiro registrar somente a batalha pendente; XP, vitória,
    // níveis e bolas permanecem intactos até o fim do diário.
    void transact(()=>updatePlaySave(window.localStorage,expected,
      {type:'start-regional-battle',regionId,seed}))
      .then(result=>{
        if(result?.status==='ok'){
          setTab('battle');
          setBattlePlayback({id:'regional-v02-'+result.snapshot.revision,seq:(battlePlayback?.seq??0)+1,done:false});
          window.requestAnimationFrame(()=>window.scrollTo(0,0));
        }
      });
  }

  function openPokemon(uid:number):void {
    setPokemonSection('profile');
    setSelectedUid(uid);
    setFeedback('');
    setTab('pokemon');
  }

  function restart() {
    if (!window.confirm('Reiniciar apenas este teste v0.2? O progresso de teste atual será apagado.')) return;
    if (!resetPlaySave(window.localStorage)) {
      setFeedback('Não foi possível apagar o progresso de teste.');
      return;
    }
    setSave(readSafe());
    setBattlePlayback(null);
    setTab('overview');
    setSelectedUid(null);
    setPokemonSection('profile');
    setCollectionQuery('');
    setCollectionFilter('all');
    setCollectionSort('recent');
    setFeedback('Teste v0.2 reiniciado. O protótipo v0.1 não foi alterado.');
  }

  // D-064AH: leitura do bolso no snapshot atual, sem duplicar estado.
  const ballGame=save.status==='ready'
    ?(()=>{try{return JSON.parse(save.snapshot.journal.raw) as Record<string,unknown>}
      catch{return null;}})():null;
  const ballPocket=inspectKantoBallPocket(ballGame?.ballPocket);
  const ballQuantities=ballPocket.status==='valid'
    ?ballPocket.pocket.quantities:{'poke-ball':12,'great-ball':0,'ultra-ball':0};
  const parsed = save.status === 'ready' ? parseLegacySave(save.snapshot.journal.raw) : null;
  const data = parsed?.status === 'valid' ? parsed.save : null;
  const projected = data ? projectLegacyTrainer(data, BATTLE_SPECIES_CACHE, now) : null;
  const view = projected?.status === 'ready' ? projected.value : null;
  const active = data?.roster.find(p => p.uid === data.team[0]) ?? data?.roster[0];
  // Treinar uma captura NÃO altera o líder da Arena. Cada instância mantém seu UID.
  const focused = data?.roster.find(p => p.uid === selectedUid) ?? active;
  const pokemonManual = manualValues(focused?.manual);
  const pokemonBudget = focused ? legacyPokemonManualBudget(focused.level) : 0;
  const levelMoves=focused?kantoLevelMoves(focused.pokemonId,focused.level):[];
  const supportMoves=focused?kantoSupportMoves(focused.pokemonId,focused.level):[];
  const currentMoveName=typeof focused?.moveName==='string'?focused.moveName:'';
  const currentMove=KANTO_BATTLE_MOVES[currentMoveName]
    ??KANTO_SUPPORT_MOVES[currentMoveName]??focusedSpeciesFallback(focused?.pokemonId);
  const equippedNames=focused?pokemonMoveSlots(focused,currentMove?.name??'tackle'):[];
  const moveRanks=focused?.upgrades && typeof focused.upgrades==='object'
    ? focused.upgrades as Record<string,number> : {};
  const moveLimits=focused?legacyMoveRankLimits(focused.level):null;
  const moveSpent=Object.values(moveRanks).reduce((sum,rank)=>sum+(Number.isSafeInteger(rank)?rank:0),0);
  const focusedSpecies = focused ? KANTO_BATTLE_SPECIES[focused.pokemonId] : null;
  const focusedEvolutions=focused?kantoEvolutionOptions(focused.pokemonId):[];
  const stoneStock=data?.evolutionStones&&typeof data.evolutionStones==='object'
    &&!Array.isArray(data.evolutionStones)
    ? data.evolutionStones as Record<string,number>:{};
  const caughtHistory=Array.isArray(data?.caughtSpecies)
    ? data.caughtSpecies.filter((id):id is number=>typeof id==='number'
      &&Number.isSafeInteger(id)&&id>=1&&id<=151):[];
  const caughtDexIds=[...new Set([...caughtHistory,...(data?.roster.map(p=>p.pokemonId)??[])])];
  const caughtSpeciesCount=caughtDexIds.length;
  const focusedStats = focused && focusedSpecies && view
    ? pokemonFinalStats(
        focusedSpecies.base, focused.level, pokemonManual, view.totals, focused.affinity
      ) : null;
  const activeManual = manualValues(active?.manual);
  const activeRemaining = active
    ? legacyPokemonManualBudget(active.level) -
      STATS.reduce((total,stat)=>total+activeManual[stat],0)
    : 0;
  const seenDexIds: number[] = Array.isArray(data?.seen)
    ? data.seen.filter((id): id is number=>typeof id==='number'&&Number.isSafeInteger(id))
    : [];
  const rosterFiltered = data?.roster.filter(p=>{
    const inTeam=data.team.includes(p.uid);
    if (collectionFilter==='team'&&!inTeam) return false;
    if (collectionFilter==='reserve'&&inTeam) return false;
    const query=collectionQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) return true;
    return speciesName(p.pokemonId).toLocaleLowerCase('pt-BR').includes(query)
      || String(p.uid)===query
      || String(p.pokemonId)===query.replace('#','');
  }).sort((a,b)=>{
    if(collectionSort==='level')return b.level-a.level||a.uid-b.uid;
    if(collectionSort==='affinity')return b.affinity-a.affinity||a.uid-b.uid;
    if(collectionSort==='species')return a.pokemonId-b.pokemonId||a.uid-b.uid;
    return b.uid-a.uid;
  }) ?? [];
  const expedition = data?.expedition as { lastClaimAt: number; startedAt: number; regionId?:number; teamUids?:number[] } | null | undefined;
  const expeditionRegion = KANTO_REGIONS.find(region=>region.id===expedition?.regionId);
  const expeditionOptions=KANTO_REGIONS.map(region=>({
    region,unlocked: Boolean(view&&active&&view.level>=region.trainerUnlockLevel&&active.level>=region.levelMin)
  }));
  const expeditionSelected=expeditionOptions.find(option=>option.region.id===expeditionArea);
  const expeditionAllowed=expeditionSelected?.unlocked??false;
  const pending = expedition
    ? expeditionRewards(Math.max(0, now - expedition.lastClaimAt)) : null;
  const pendingBattle=ballGame?.pendingBattle && typeof ballGame.pendingBattle==='object'
    ? ballGame.pendingBattle as {battleId:string;preview:unknown}:null;
  // Em um reload, retomar apresentação pendente antes de pagar resultados.
  // O save ainda contém os níveis, XP e estatísticas anteriores ao combate.
  useEffect(()=>{
    if(pendingBattle?.battleId && battlePlayback?.id!==pendingBattle.battleId){
      setTab('battle');
      setBattlePlayback({id:pendingBattle.battleId,seq:0,done:false});
    }
  },[pendingBattle?.battleId]);
  const lastBattleRaw = pendingBattle?.preview??data?.lastBattle;
  const lastBattle=lastBattleRaw && typeof lastBattleRaw==='object'
    && 'outcome' in lastBattleRaw && 'wildSpeciesId' in lastBattleRaw
    && 'log' in lastBattleRaw && Array.isArray(lastBattleRaw.log)
    ? lastBattleRaw as {
        battleId?:string;regionId?:number;regionName?:string;
        playerSpeciesId?:number;playerName?:string;playerLevel?:number;
        playerMaxHp?:number;wildMaxHp?:number;
        playerMaxSp?:number;wildMaxSp?:number;
        playerRemainingSp?:number;wildRemainingSp?:number;
        frames?:readonly KantoBattleVisualFrame[];
        playerStatus?:'burn'|'poison'|'paralysis'|null;
        wildStatus?:'burn'|'poison'|'paralysis'|null;
        outcome:'win'|'loss'|'draw'; wildSpeciesId:number;
        wildName:string;wildLevel:number;turns:number;
        captured:boolean;affinityGain:number|null;log:string[];
        captureStatus?:'available'|'unavailable'|'caught'|'escaped'|'skipped';
        captureBallId?:KantoBallId|null;
        rewardCoins:number;trainerXp:number;pokemonXp:number;
        playerRemainingHp:number;wildRemainingHp:number
      }
    : null;
  const battleRegion=KANTO_REGIONS.find(region=>region.id===lastBattle?.regionId)
    ??KANTO_REGIONS.find(region=>region.id===regionalArea)??KANTO_REGIONS[0]!;
  useLayoutEffect(()=>{
    if(tab==='battle')window.scrollTo(0,0);
  },[tab,save.status==='ready'?save.snapshot.revision:0]);
  const displayedBattleId=lastBattle?.battleId??'legacy-battle';
  const battlePlaying=Boolean(pendingBattle)||Boolean(battlePlayback && !battlePlayback.done && battlePlayback.id===displayedBattleId);
  const activeRecord=pokemonBattleRecord(active);
  async function finishPlayback():Promise<void>{
    if(!pendingBattle||settlingBattle.current===pendingBattle.battleId){
      if(!pendingBattle)setBattlePlayback(previous=>previous?{...previous,done:true}:null);
      return;
    }
    settlingBattle.current=pendingBattle.battleId;
    const current=readSafe();
    if(current.status==='ready'){
      const result=await transact(()=>updatePlaySave(window.localStorage,
        current.snapshot.revision,{type:'finish-regional-battle',
          battleId:pendingBattle.battleId}));
      if(result?.status==='ok')
        setBattlePlayback(previous=>previous?{...previous,done:true}:null);
    }
    settlingBattle.current=null;
  }
  function captureAfterBattle(ballId:KantoBallId|null):void{
    if(save.status!=='ready'||!lastBattle?.battleId||battlePlaying)return;
    dispatch(ballId?{type:'capture-after-battle',battleId:lastBattle.battleId,ballId}
      :{type:'skip-capture',battleId:lastBattle.battleId});
  }
  const playbackKey=displayedBattleId+':'+(battlePlayback?.seq??0);
  const onBattleProgress=useCallback((visible:number)=>{
    setBattleReveal(previous=>previous?.key===playbackKey&&previous.visible===visible
      ?previous:{key:playbackKey,visible});
  },[playbackKey]);
  const battleFrames=lastBattle?.frames;
  const validFrames=lastBattle&&Array.isArray(battleFrames)
    &&battleFrames.length===lastBattle.log.length
    &&Number.isSafeInteger(lastBattle.playerMaxHp)&&Number.isSafeInteger(lastBattle.wildMaxHp)
    &&(lastBattle.playerMaxHp??0)>0&&(lastBattle.wildMaxHp??0)>0
    &&battleFrames.every(frame=>frame!==null&&typeof frame==='object'
      &&['intro','attack','miss','status','heal','residual','focus','outcome','info'].includes(frame.kind)
      &&(frame.target===null||frame.target==='player'||frame.target==='wild')
      &&Number.isSafeInteger(frame.playerHp)
      &&Number.isSafeInteger(frame.wildHp)
      &&frame.playerHp>=0&&frame.playerHp<=(lastBattle.playerMaxHp??0)
      &&frame.wildHp>=0&&frame.wildHp<=(lastBattle.wildMaxHp??0)
      &&Number.isSafeInteger(frame.amount)&&frame.amount>=0)
    ?battleFrames:null;
  /** Para saves antigos com HP mas sem SP, preservar HP e ocultar só SP. */
  const validSp=lastBattle&&validFrames
    &&Number.isSafeInteger(lastBattle.playerMaxSp)
    &&Number.isSafeInteger(lastBattle.wildMaxSp)
    &&(lastBattle.playerMaxSp??0)>0&&(lastBattle.wildMaxSp??0)>0
    &&validFrames.every(frame=>typeof frame.playerSp==='number'
      &&typeof frame.wildSp==='number'
      &&Number.isSafeInteger(frame.playerSp)&&Number.isSafeInteger(frame.wildSp)
      &&frame.playerSp>=0&&frame.playerSp<=(lastBattle.playerMaxSp??0)
      &&frame.wildSp>=0&&frame.wildSp<=(lastBattle.wildMaxSp??0))
    ?true:false;
  const revealedLines=battlePlaying
    ?battleReveal?.key===playbackKey?battleReveal.visible:Math.min(lastBattle?.log.length??0,1)
    :lastBattle?.log.length??0;
  const currentFrame=validFrames?.[Math.max(0,revealedLines-1)]??null;
  const nextCycle = expedition
    ? Math.max(0, Math.ceil((EXPEDITION_CYCLE_MS - Math.max(0, now - expedition.lastClaimAt) % EXPEDITION_CYCLE_MS) / 1000))
    : 0;

  if (save.status !== 'ready') {
    return (
      <main className={styles.setupShell} data-testid="play-root">
        <header className={styles.brand}><span className={styles.brandBall}>◉</span>KANTO <strong>IDLE</strong><span className={styles.alpha}>v0.2 ALPHA</span></header>
        <section className={styles.welcome}>
          <div className={styles.kicker}>UMA NOVA JORNADA EM KANTO</div>
          <h1>O começo da sua aventura.</h1>
          <p>Escolha seu parceiro, treine seus atributos e envie Pokémon em expedições para evoluir mesmo enquanto explora outras telas.</p>
          {save.status === 'absent' ? (
            <div className={styles.form}>
              <label className={styles.label} htmlFor="trainer-name">Nome do treinador</label>
              <input
                id="trainer-name" className={styles.input} maxLength={24}
                value={name} onChange={event => setName(event.target.value)}
                placeholder="Como devemos chamar você?" autoComplete="nickname"
              />
              <h2>Escolha seu Pokémon inicial</h2>
              <div className={styles.starters}>
                {STARTERS.map(option => {
                  const pokemon = LEGACY_STARTERS[option.id]!;
                  return (
                    <label key={option.id} className={starter === option.id ? styles.starterSelected : styles.starter}>
                      <input type="radio" name="starter" value={option.id}
                        checked={starter === option.id} onChange={() => setStarter(option.id)} />
                      <PokemonArt id={option.id} name={pokemon.name} />
                      <strong>{pokemon.name}</strong>
                      <span>{option.type}</span>
                      <small>{option.hint}</small>
                    </label>
                  );
                })}
              </div>
              <label className={styles.demoToggle}>
                <input type="checkbox" checked={demo} onChange={event => setDemo(event.target.checked)} />
                Começar no modo demonstração (níveis e pontos para testar)
              </label>
              <button className={styles.primary} type="button" disabled={busy || name.trim().length < 2}
                onClick={newGame}>Começar aventura</button>
            </div>
          ) : (
            <div className={styles.form} role="alert">
              <h2>O progresso local precisa de atenção</h2>
              <p>O armazenamento está {save.status === 'invalid' ? 'incompatível' : 'indisponível'}. Nenhum dado foi apagado automaticamente.</p>
              <button type="button" className={styles.secondary} onClick={() => setSave(readSafe())}>Tentar novamente</button>
              {save.status === 'invalid' && <button type="button" className={styles.secondary} onClick={restart}>Reiniciar teste v0.2</button>}
            </div>
          )}
          {feedback && <p role="status" className={styles.message}>{feedback}</p>}
          <p className={styles.disclaimer}>Versão alfa de testes: progresso salvo apenas neste navegador, sem contas ou sincronização. Regras e dados de teste poderão ser reiniciados antes do lançamento.</p>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.appShell} data-testid="play-root" data-motion="full">
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.brandBall}>◉</span>KANTO <strong>IDLE</strong><span className={styles.alpha}>ALPHA</span></div>
        <div className={styles.sidebarCaption}>SUA JORNADA</div>
        <nav className={styles.menu} aria-label="Navegação do jogo">
          {(['overview','trainer','pokemon','collection','pokedex','regions','expedition'] as Tab[]).map(item => (
            <button type="button" key={item} aria-current={tab === item ? 'page' : undefined}
              className={tab === item ? styles.menuActive : styles.menuItem}
              onClick={() => { if(item==='pokemon')setPokemonSection('profile'); setTab(item); setFeedback(''); if(item!=='battle')setBattlePlayback(null); }}><i className={'fa-solid '+NAV_ICONS[item]} aria-hidden="true"/>{sectionName(item)}</button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <p>Pré-lançamento v0.2</p>
          <p>Progresso local · {save.snapshot.revision} alterações</p>
          <button type="button" className={styles.resetButton} onClick={restart}>Reiniciar teste</button>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.kicker}>REGIÃO DE KANTO · SEASON 1</div>
            <h1>{tab==='battle'?battleRegion.name:sectionName(tab)}</h1>
          </div>
          <div className={styles.trainerChip}><span className={serverOnline===true?styles.serverOnline:styles.serverOffline} role="status">{serverOnline===null?'Verificando servidor':serverOnline?'● Servidor Online':'● Servidor indisponível'}</span><span className={styles.avatar}>★</span>
            <span><strong>{view?.name ?? data?.name}</strong><small>Nível {view?.level ?? '?'}</small></span>
            <span className={styles.coins}>◈ {data?.coins ?? 0}</span>
          </div>
        </header>
        {feedback && <div role="status" aria-live="polite" className={styles.message}>{feedback}</div>}
        {!view || !data || !active || !focused ? (
          <section className={styles.panel}>O perfil de teste não pôde ser projetado. Nenhum dado foi modificado.</section>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <section className={styles.hero}>
                  <div>
                    <div className={styles.kicker}>TREINADOR EM JORNADA</div>
                    <h2>Bem-vindo de volta, {view.name}!</h2>
                    <p>Seu parceiro está pronto. Continue sua jornada, distribua pontos e receba recompensas idle.</p>
                    <div className={styles.heroActions}>
                      <button type="button" className={styles.primary} onClick={() => setTab('expedition')}>
                        {expedition ? 'Ver expedição ativa' : 'Iniciar expedição'}</button>
                      <button type="button" className={styles.secondary} onClick={() => setTab('trainer')}>Meu treinador</button>
                      <button type="button" className={styles.secondary} onClick={() => setTab('regions')}>Explorar regiões</button>
                      <button type="button" className={styles.secondary} onClick={() => setTab('pokedex')}>Abrir Pokédex</button>
                    </div>
                  </div>
                  <PokemonArt id={active.pokemonId} name={view.active.name} large />
                </section>
                <div className={styles.metrics}>
                  <article className={styles.metric}><small>Treinador</small><strong>Lv. {view.level}</strong><span>{view.xpNext === null ? 'Nível máximo' : view.xp + ' / ' + view.xpNext + ' XP'}</span></article>
                  <article className={styles.metric}><small>Parceiro</small><strong>Lv. {active.level}</strong><span>{view.active.name}</span></article>
                  <article className={styles.metric}><small>Moedas</small><strong>{data.coins}</strong><span>Saldo da jornada</span></article>
                  <article className={styles.metric}><small>Pokédex de Kanto</small><strong>{caughtSpeciesCount}/151</strong><span>{data.roster.length} indivíduos · {view.seenSpecies} vistos</span></article>
                </div>
                <div className={styles.twoColumn}>
                  <section className={styles.panel}>
                    <h2>Seu parceiro</h2>
                    <div className={styles.partner}>
                      <PokemonArt id={active.pokemonId} name={view.active.name} />
                      <div><strong>{view.active.name}</strong><p>UID #{active.uid} · Afinidade {active.affinity}%</p>
                      <p>{activeRemaining} pontos de treinamento disponíveis</p>
                      <button type="button" className={styles.textButton}
                        onClick={() => openPokemon(active.uid)}>Treinar Pokémon</button></div>
                    </div>
                  </section>
                  <section className={styles.panel}>
                    <h2>Coleção e equipe</h2>
                    <p>{data.roster.length} Pokémon capturado(s) · {data.team.length}/3 na equipe</p>
                    <p>Organize seus parceiros e escolha quem lidera as batalhas nas regiões.</p>
                    <button type="button" className={styles.secondary} onClick={() => setTab('collection')}>Abrir coleção</button>
                  </section>
                  <section className={styles.panel}>
                    <h2>Expedição idle</h2>
                    <p>{expedition
                      ? 'Explorando Kanto · ' + (pending?.cycles ?? 0) + ' ciclos disponíveis para resgate'
                      : 'Envie seu parceiro em expedição para receber moedas e XP.'}</p>
                    <button type="button" className={styles.secondary} onClick={() => setTab('expedition')}>Abrir expedição</button>
                  </section>
                </div>
              </>
            )}
            {tab === 'trainer' && <TrainerScreen view={view} data={data}
              revision={save.snapshot.revision} busy={busy}
              onInvest={investTrainerBatch}
              onEquip={(slot,itemId)=>dispatch({type:'trainer',value:{type:'equip',slot,itemId}})}
              onTitle={titleId=>dispatch({type:'trainer',value:{type:'title',titleId}})}/> }
            {tab === 'pokemon' && (
              <div className={styles.pokemonWorkspace}>
                <header className={styles.pokemonHeading}>
                  <div>
                    <span className={styles.pokemonEyebrow}><i className="fa-solid fa-dragon" aria-hidden="true"/> SEU PARCEIRO POKÉMON</span>
                    <h2>{pokemonSection==='profile'?'Perfil do Pokémon':pokemonSection==='evolution'?'Evoluções disponíveis':'Gerenciar movimentos'}</h2>
                    <p>{pokemonSection==='profile'?'Confira os atributos e a afinidade do seu parceiro.':
                      pokemonSection==='evolution'?'Veja as evoluções possíveis e seus requisitos.':
                      'Gerencie golpes, energia e aprimoramentos do seu Pokémon.'}</p>
                  </div>
                  <button type="button" className={styles.secondary} onClick={()=>setTab('collection')}>
                    <i className="fa-solid fa-layer-group" aria-hidden="true"/> Ver coleção</button>
                </header>
                <nav className={styles.pokemonQuickNav} aria-label="Seções do Pokémon">
                  {([
                    ['profile','Perfil','fa-chart-simple'],
                    ['evolution','Evolução','fa-dna'],
                    ['moves','Golpes','fa-bolt']
                  ] as const).map(([section,label,icon])=>
                    <button key={section} type="button"
                      className={pokemonSection===section?styles.pokemonQuickActive:styles.pokemonQuickButton}
                      aria-current={pokemonSection===section?'page':undefined}
                      onClick={()=>setPokemonSection(section)}>
                      <i className={'fa-solid '+icon} aria-hidden="true"/> {label}
                    </button>)}
                </nav>
                <div className={styles.pokemonGrid+(pokemonSection==='profile'?' '+styles.pokemonProfileGrid:'')}>
                {pokemonSection==='profile'&&<>
                <section className={styles.pokemonHero}>
                  <div className={styles.pokemonShowcase}>
                    <div className={styles.pokemonArtStage}>
                      <span className={styles.pokemonArtHalo} aria-hidden="true"/>
                      <PokemonArt id={focused.pokemonId} name={speciesName(focused.pokemonId)} large />
                      <span className={styles.pokemonArtRing} aria-hidden="true"/>
                    </div>
                    <div className={styles.pokemonIdentity}>
                      <span className={styles.pokemonSpeciesNumber}># {String(focused.pokemonId).padStart(3,'0')} · UID {focused.uid}</span>
                      <h2>{speciesName(focused.pokemonId)}</h2>
                      <div className={styles.pokemonChips}>
                        <span><i className="fa-solid fa-star" aria-hidden="true"/> Nível {focused.level}</span>
                        <span><i className="fa-solid fa-shield-heart" aria-hidden="true"/> Afinidade {focused.affinity}%</span>
                        <span><i className="fa-solid fa-users" aria-hidden="true"/> {data.team[0]===focused.uid?'Líder da equipe':data.team.includes(focused.uid)?'Na equipe':'Na coleção'}</span>
                      </div>
                      <div className={styles.pokemonBattleHistory} aria-label="Histórico individual deste Pokémon">
                        <span><i className="fa-solid fa-trophy" aria-hidden="true"/> {pokemonBattleRecord(focused)["wins"]} vitórias</span>
                        <span><i className="fa-solid fa-handshake" aria-hidden="true"/> {pokemonBattleRecord(focused)["draws"]} empates</span>
                        <span><i className="fa-solid fa-shield-halved" aria-hidden="true"/> {pokemonBattleRecord(focused)["losses"]} derrotas</span>
                      </div>
                      <div className={styles.pokemonAffinity}>
                        <div><strong>Vínculo com o treinador</strong><span>{focused.affinity}%</span></div>
                        <div className={styles.pokemonAffinityTrack} role="progressbar" aria-label="Afinidade do Pokémon"
                          aria-valuemin={0} aria-valuemax={100} aria-valuenow={focused.affinity}>
                          <span style={{width:focused.affinity+'%'}}/>
                        </div>
                        <small>Transferência de atributos: {(affinityRate(focused.affinity)*100).toFixed(1)}%</small>
                      </div>
                      <p className={styles.pokemonRole}>{data.team[0]===focused.uid?'Lidera as batalhas regionais.'
                        :data.team.includes(focused.uid)?'Está na equipe, podendo ser escolhido como líder.':'Está na coleção, fora da equipe ativa.'}</p>
                    </div>
                  </div>
                </section>
                <PokemonTraining key={focused.uid} uid={focused.uid}
                  revision={save.snapshot.revision} busy={busy}
                  stats={focusedStats} manual={pokemonManual} budget={pokemonBudget}
                  previewStats={increments=>{
                    if(!focusedSpecies||!view)return null;
                    const previewManual={...pokemonManual};
                    for(const stat of STATS)previewManual[stat]+=(increments[stat]??0);
                    return pokemonFinalStats(focusedSpecies.base,focused.level,previewManual,view.totals,focused.affinity);
                  }}
                  onConfirm={investPokemonBatch}
                  onReset={()=>{
                    if(window.confirm('Redistribuir todos os pontos de '+speciesName(focused.pokemonId)+' (UID '+focused.uid+')?')){
                      dispatch({type:'pokemon',value:{type:'reset-pokemon',uid:focused.uid}});
                    }
                  }}/>

                </>}
                {pokemonSection==='evolution'&&<>
                <section className={styles.panel+' '+styles.pokemonEvolutionPanel} id="pokemon-evolution" aria-label="Evolução do Pokémon">
                  <h2><i className="fa-solid fa-dna" aria-hidden="true"/> Evolução</h2>
                  {focusedEvolutions.length>0&&<p>Treine seu Pokémon para que ele possa evoluir.</p>}
                  {focusedEvolutions.length===0
                    ? <p>Nenhuma evolução disponível para este Pokémon.</p>
                    : <div className={styles.evolutionList}>
                        {focusedEvolutions.map(rule=>{
                          const target=speciesName(rule.to);
                          const requirement=rule.trigger==='level'
                            ? 'Nível '+rule.minLevel
                            : rule.trigger==='stone'
                              ? KANTO_EVOLUTION_STONES.find(item=>item.id===rule.stone)?.name??rule.stone
                              : 'Troca de Pokémon';
                          const available=rule.trigger==='level'
                            ? focused.level>=rule.minLevel
                            : rule.trigger==='stone'
                              ? (stoneStock[rule.stone]??0)>0
                              : false;
                          return <div className={styles.evolutionOption} key={rule.to}>
                            <PokemonArt id={rule.to} name={target} />
                            <div><strong>{target}</strong><small>Requisito: {requirement}</small>
                              {rule.trigger==='trade'&&<small>Trocas indisponíveis na alfa.</small>}
                            </div>
                            <button type="button" className={styles.primary}
                              aria-label={'Evoluir para '+target}
                              disabled={busy||Boolean(expedition)||!available}
                              onClick={()=>{
                                if(window.confirm('Evoluir UID #'+focused.uid+' para '+target+
                                  '? Esta ação altera a espécie e, se aplicável, consome uma pedra.')){
                                  dispatch({type:'evolution',uid:focused.uid,targetSpeciesId:rule.to});
                                }
                              }}>Evoluir</button>
                          </div>;
                        })}
                      </div>}

                </section>
                </>}
                {pokemonSection==='moves'&&<>
                <section className={styles.panel+' '+styles.pokemonMovesPanel} id="pokemon-moves" aria-label="Treinar golpes do Pokémon">
                  <h2><i className="fa-solid fa-bolt" aria-hidden="true"/> Golpes do Pokémon</h2>
                  <div className={styles.pokemonMovesHeader}>
                    <div><h3><i className="fa-solid fa-shield-halved" aria-hidden="true"/> Golpes equipados</h3>
                      <p>Escolha até quatro golpes. O primeiro é o principal.</p></div>
                    <span className={styles.pokemonMovesCount}>{equippedNames.length} / 4 slots</span>
                  </div>
                  <div className={styles.moveList+' '+styles.pokemonEquippedGrid} aria-label="Golpes equipados" data-testid="equipped-moves">
                    {equippedNames.map((name,i)=><div key={name} className={styles.moveEquipped+' '+styles.pokemonMoveCard}>
                      <div><strong><i className={'fa-solid '+(KANTO_SUPPORT_MOVES[name]?'fa-hand-sparkles':'fa-bolt')} aria-hidden="true"/> {name}</strong>
                        <span className={styles.pokemonMoveBadge}>{i===0?'★ Principal':'Equipado · slot '+(i+1)}</span>
                        <small>{i===0?'Principal':'Adicional'} ·
                          {KANTO_SUPPORT_MOVES[name]?(name==='recover'?' Cura':' Suporte'):' Ataque'} ·
                          {KANTO_SUPPORT_MOVES[name]||KANTO_BATTLE_MOVES[name]
                            ?' '+kantoMoveSpCost((KANTO_SUPPORT_MOVES[name]??KANTO_BATTLE_MOVES[name])!)+' SP · PP '+(kantoMovePp(name)??'não catalogado')
                            :' Golpe provisório'}</small></div>
                      <div className={styles.moveActions}>
                        {i>0&&<button type="button" className={styles.secondary}
                          aria-label={'Tornar principal '+name} disabled={busy}
                          onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                            moveName:name,operation:'primary'})}><i className="fa-solid fa-star" aria-hidden="true"/> Principal</button>}
                        {equippedNames.length>1&&<button type="button" className={styles.textButton}
                          aria-label={'Retirar golpe '+name} disabled={busy}
                          onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                            moveName:name,operation:'remove'})}><i className="fa-solid fa-xmark" aria-hidden="true"/> Retirar</button>}
                      </div>
                    </div>)}
                    {Array.from({length:Math.max(0,4-equippedNames.length)},(_,index)=>
                      <div className={styles.pokemonEmptyMoveSlot} key={'empty-'+index}>
                        <i className="fa-solid fa-plus" aria-hidden="true"/>
                        <span>Espaço vazio {equippedNames.length+index+1}</span>
                      </div>)}
                  </div>
                  <div className={styles.pokemonMovesHeader}>
                    <div><h3><i className="fa-solid fa-book-open" aria-hidden="true"/> Golpes aprendidos</h3>
                      <p>Escolha e melhore os movimentos do seu Pokémon.</p></div>
                    <span className={styles.pokemonMovesCount}>Pontos de aprimoramento: {moveLimits?moveLimits.skillPoints-moveSpent:0}</span>
                  </div>
                  <div className={styles.moveList+' '+styles.pokemonLearnedGrid}>
                    {levelMoves.map(({move,learnedAt})=>{
                      const equipped=currentMoveName===move.name;
                      const inSlots=equippedNames.includes(move.name);
                      const rank=moveRanks[move.name]??0;
                      const availablePoints=Math.max(0,(moveLimits?.skillPoints??0)-moveSpent);
                      const maxRank=moveLimits?.maxRankPerMove??0;
                      const upgradeReason=!inSlots?'Equipe este golpe para aprimorar.'
                        :rank>=maxRank?'Rank máximo atingido.'
                        :availablePoints<1?'Pontos de aprimoramento insuficientes.':null;
                      return <div key={move.name} className={(inSlots?styles.moveEquipped:styles.moveOption)+' '+styles.pokemonMoveCard}>
                        <div><strong><i className="fa-solid fa-bolt" aria-hidden="true"/> {move.name}</strong>
                          {inSlots&&<span className={styles.pokemonMoveBadge}><i className="fa-solid fa-circle-check" aria-hidden="true"/> Equipado</span>}<small>Nv. {learnedAt} · {move.type} ·
                          Poder {move.power}{move.name==='double-kick'?' × 2 impactos':''} · Precisão {move.accuracy}%</small>
                          <small>Rank {rank} · {move.category==='physical'?'Físico':'Especial'} ·
                            PP {kantoMovePp(move.name)??'não catalogado'} ·
                            Custo {kantoMoveSpCost(move)} SP em batalha</small>
                          <small>{rank>=maxRank?'Rank máximo atingido': 'Custo do próximo aprimoramento: 1 ponto'} · Disponíveis: {availablePoints}</small>
                          {upgradeReason&&<small className={styles.pokemonUpgradeReason} role="status">{upgradeReason}</small>}
                           {effectLabel(move.name)&&<small>{effectLabel(move.name)}</small>}
                        </div>
                        <div className={styles.moveActions}>
                          {!inSlots&&<button type="button" className={styles.secondary}
                            disabled={busy||equippedNames.length>=4}
                            aria-label={'Adicionar golpe '+move.name}
                            onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                              moveName:move.name,operation:'add'})}><i className="fa-solid fa-plus" aria-hidden="true"/> Adicionar</button>}
                          {!inSlots&&<button type="button" className={styles.secondary}
                            disabled={busy||equippedNames.length>=4}
                            aria-label={'Equipar golpe '+move.name}
                            onClick={()=>dispatch({type:'move',uid:focused.uid,moveName:move.name,operation:'select'})}>
                            <i className="fa-solid fa-check" aria-hidden="true"/> Equipar</button>}
                          <button type="button" className={styles.primary}
                            aria-label={'Aprimorar golpe '+move.name}
                            disabled={busy||upgradeReason!==null}
                            onClick={()=>dispatch({type:'move',uid:focused.uid,moveName:move.name,operation:'upgrade'})}>
                            <i className="fa-solid fa-arrow-up" aria-hidden="true"/> {rank>=maxRank?'Rank máximo':'Aprimorar · 1 ponto'}</button>
                        </div>
                      </div>;
                    })}
                  </div>
                  <h3 className={styles.pokemonMoveSubheading}><i className="fa-solid fa-hand-holding-heart" aria-hidden="true"/> Suporte e cura</h3>
                  <div className={styles.moveList+' '+styles.pokemonLearnedGrid}>
                    {supportMoves.map(({move,learnedAt})=>{
                      const inSlots=equippedNames.includes(move.name);
                      return <div key={move.name} className={(inSlots?styles.moveEquipped:styles.moveOption)+' '+styles.pokemonMoveCard}>
                        <div><strong><i className="fa-solid fa-hand-holding-heart" aria-hidden="true"/> {move.name}</strong>
                          {inSlots&&<span className={styles.pokemonMoveBadge}><i className="fa-solid fa-circle-check" aria-hidden="true"/> Equipado</span>}
                          <small>Nv. {learnedAt} · {move.type} · Precisão {move.accuracy}% ·
                            PP {kantoMovePp(move.name)??'não catalogado'} ·
                            Custo {kantoMoveSpCost(move)} SP</small>
                          <small>{move.name==='growl'?'Reduz Ataque':
                            move.name==='tail-whip'?'Reduz Defesa':
                              move.name==='thunder-wave'?'Paralisa':
                            move.name==='recover'?'Recupera até 50% do HP, no máximo 1 vez por batalha':'Envenena'}</small></div>
                        <div className={styles.moveActions}>
                          {inSlots?<small>Equipado</small>:
                            <button type="button" className={styles.secondary}
                              aria-label={'Adicionar golpe '+move.name}
                              disabled={busy||equippedNames.length>=4}
                              onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                                moveName:move.name,operation:'add'})}>Adicionar</button>}
                        </div>
                      </div>;
                    })}
                  </div>
                  {supportMoves.length===0&&<p>Nenhum golpe de suporte aprendido até este nível.</p>}
                  {levelMoves.length===0&&<p>Nenhum golpe de ataque aprendido até este nível.</p>}

                </section>
                </>}
                </div>
              </div>
            )}


            {tab === 'collection' && (
              <>
                <section className={styles.collectionHeader}>
                  <div>
                    <div className={styles.kicker}>SEUS PARCEIROS · CADA UID É ÚNICO</div>
                    <h2>Coleção Pokémon</h2>
                    <p>Organize seus parceiros, escolha seu líder e acompanhe a evolução de cada Pokémon capturado.</p>
                  </div>
                  <div className={styles.collectionSummaryGroup}>
                    <div className={styles.collectionSummary}><strong>{data.roster.length}</strong><small>Capturados</small></div>
                    <div className={styles.collectionSummary}><strong>{caughtSpeciesCount}</strong><small>Espécies</small></div>
                    <div className={styles.collectionSummary}><strong>{data.team.length}<span>/3</span></strong><small>Na equipe</small></div>
                  </div>
                </section>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <h2><i className="fa-solid fa-users" aria-hidden="true"/> Equipe atual</h2>
                    {expedition && <span className={styles.teamLocked}>Equipe bloqueada: expedição ativa</span>}
                  </div>
                  <div className={styles.teamSlots} aria-label="Equipe atual, até 3 Pokémon">
                    {[0,1,2].map(position=>{
                      const uid=data.team[position];
                      const pokemon=data.roster.find(p=>p.uid===uid);
                      return (
                        <article key={position} data-testid={'team-slot-'+position} className={pokemon?styles.teamSlot:styles.teamSlotEmpty}>
                          <span className={styles.slotCaption}><i className={'fa-solid '+(position===0?'fa-crown':'fa-shield')} aria-hidden="true"/> {position===0?'Líder · Regiões':'Slot '+(position+1)}</span>
                          {pokemon ? <>
                            <PokemonArt id={pokemon.pokemonId} name={speciesName(pokemon.pokemonId)} />
                            <strong>{speciesName(pokemon.pokemonId)}</strong>
                            <small>UID #{pokemon.uid} · Nv. {pokemon.level}</small>
                            <small><i className="fa-solid fa-heart" aria-hidden="true"/> {pokemon.affinity}% afinidade</small>
                            <div className={styles.teamSlotActions}>
                              <button type="button" className={styles.secondary}
                                aria-label={'Treinar UID '+pokemon.uid+' pelo slot da equipe'}
                                onClick={()=>openPokemon(pokemon.uid)}>
                                <i className="fa-solid fa-chart-simple" aria-hidden="true"/> Treinar</button>
                              <button type="button" className={styles.secondary}
                                disabled={busy || Boolean(expedition) || data.team.length<=1}
                                aria-label={'Remover UID '+pokemon.uid+' pelo slot da equipe'}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'remove-team',uid:pokemon.uid}})}>
                                <i className="fa-solid fa-user-minus" aria-hidden="true"/> Retirar</button>
                              {position>0&&<button type="button" className={styles.textButton}
                                disabled={busy || Boolean(expedition)}
                                aria-label={'Tornar líder UID '+pokemon.uid}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'set-active',uid:pokemon.uid}})}>
                                <i className="fa-solid fa-crown" aria-hidden="true"/> Tornar líder</button>}
                            </div>
                          </> : <span className={styles.slotPlaceholder}><i className="fa-solid fa-plus" aria-hidden="true"/> Vazio</span>}
                        </article>
                      );
                    })}
                  </div>
                  <p className={styles.disclaimer}>Máximo de 3 Pokémon. A equipe precisa manter pelo menos 1 integrante. Durante uma expedição não é possível adicionar, remover ou trocar o líder.</p>
                </section>
                <section className={styles.panel}>
                  <div className={styles.collectionToolbar}>
                    <div>
                      <h2><i className="fa-solid fa-layer-group" aria-hidden="true"/> Todos os Pokémon</h2>
                      <p>{rosterFiltered.length} de {data.roster.length} Pokémon · Pesquise por nome, número da Pokédex ou UID.</p>
                    </div>
                    <input className={styles.input} aria-label="Buscar Pokémon na coleção"
                      type="search" value={collectionQuery} onChange={e=>setCollectionQuery(e.target.value)}
                      placeholder="Buscar Pokémon ou UID..." />
                  </div>
                  <div className={styles.collectionControls}>
                    <div className={styles.collectionFilters} aria-label="Filtrar coleção">
                      {(['all','team','reserve'] as CollectionFilter[]).map(filter=>(
                        <button type="button" key={filter}
                          aria-pressed={collectionFilter===filter}
                          className={collectionFilter===filter?styles.collectionFilterActive:styles.collectionFilter}
                          onClick={()=>setCollectionFilter(filter)}>
                          {filter==='all'?'Todos':filter==='team'?'Na equipe':'Reserva'}
                          <span>{filter==='all'?data.roster.length:filter==='team'?data.team.length:data.roster.length-data.team.length}</span>
                        </button>
                      ))}
                    </div>
                    <label className={styles.collectionSortLabel}>Ordenar
                      <select value={collectionSort} onChange={event=>setCollectionSort(event.target.value as CollectionSort)}
                        aria-label="Ordenar coleção" className={styles.input}>
                        <option value="recent">Mais recentes</option>
                        <option value="level">Maior nível</option>
                        <option value="affinity">Maior afinidade</option>
                        <option value="species">Número da Pokédex</option>
                      </select>
                    </label>
                  </div>
                  <div className={styles.collectionGrid}>
                    {rosterFiltered.map(pokemon=>{
                      const inTeam=data.team.includes(pokemon.uid);
                      const leader=data.team[0]===pokemon.uid;
                      const dex=speciesName(pokemon.pokemonId);
                      return (
                        <article key={pokemon.uid} data-testid={'pokemon-uid-'+pokemon.uid}
                          className={leader?styles.collectionCardLeader:styles.collectionCard}>
                          <div className={styles.collectionCardTop}>
                            <span>#{String(pokemon.pokemonId).padStart(3,'0')} · UID {pokemon.uid}</span>
                            <span className={styles.collectionCardStatus}>
                              <i className={'fa-solid '+(leader?'fa-crown':inTeam?'fa-shield':'fa-box-archive')} aria-hidden="true"/>
                              {leader?'LÍDER':inTeam?'EQUIPE':'RESERVA'}</span>
                          </div>
                          <div className={styles.collectionCardArt}><PokemonArt id={pokemon.pokemonId} name={dex} /></div>
                          <strong>{dex}</strong>
                          <div className={styles.collectionAttributes}>
                            <span><i className="fa-solid fa-star" aria-hidden="true"/> Nv. {pokemon.level}</span>
                            <span><i className="fa-solid fa-heart" aria-hidden="true"/> {pokemon.affinity}% afinidade</span>
                          </div>
                          <div className={styles.collectionCardActions}>
                            <button type="button" className={styles.secondary}
                              aria-label={'Treinar UID '+pokemon.uid}
                              onClick={()=>openPokemon(pokemon.uid)}><i className="fa-solid fa-chart-simple" aria-hidden="true"/> Treinar</button>
                            {inTeam ? (
                              <button type="button" className={styles.secondary}
                                aria-label={'Remover UID '+pokemon.uid+' da equipe'}
                                disabled={busy || Boolean(expedition) || data.team.length<=1}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'remove-team',uid:pokemon.uid}})}>
                                <i className="fa-solid fa-user-minus" aria-hidden="true"/> Retirar</button>
                            ) : (
                              <button type="button" className={styles.primary}
                                aria-label={'Adicionar UID '+pokemon.uid+' à equipe'}
                                disabled={busy || Boolean(expedition) || data.team.length>=3}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'add-team',uid:pokemon.uid}})}>
                                <i className="fa-solid fa-user-plus" aria-hidden="true"/> Escalar</button>
                            )}
                            {inTeam&&!leader&&(
                              <button type="button" className={styles.textButton}
                                aria-label={'Tornar líder UID '+pokemon.uid+' pela coleção'}
                                disabled={busy || Boolean(expedition)}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'set-active',uid:pokemon.uid}})}>
                                <i className="fa-solid fa-crown" aria-hidden="true"/> Definir líder</button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {rosterFiltered.length===0&&<p className={styles.emptyCollection} role="status">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"/> Nenhum Pokémon encontrado com este filtro.
                    <button type="button" className={styles.secondary} onClick={()=>{
                      setCollectionQuery('');setCollectionFilter('all');
                    }}>Limpar busca e filtros</button>
                  </p>}
                </section>
              </>
            )}

            {tab === 'pokedex' && (
              <PokedexPanel
                seenIds={seenDexIds}
                capturedSpeciesIds={caughtDexIds}
                onArena={()=>setTab('regions')}
                onCollection={()=>setTab('collection')}
              />
            )}

            {tab === 'regions' && (
              <RegionsScreen
                trainerLevel={view.level}
                leaderSpeciesId={active.pokemonId}
                leaderLevel={active.level}
                selectedRegionId={regionalArea}
                onSelectRegion={setRegionalArea}
                balls={ballQuantities}
                wins={Array.isArray(ballGame?.regionWins)
                  ?(ballGame.regionWins as number[]):[]}
                seenIds={seenDexIds}
                capturedIds={caughtDexIds}
                busy={busy||battlePlaying}
                onFight={fight}
                onOpenTeam={()=>setTab('collection')}
                lastBattleRegionId={lastBattle?.regionId}
                onReplayBattle={()=>{setBattlePlayback(null);setTab('battle');}}
              />
            )}

            {tab === 'battle' && (
              <>
                <section className={styles.battleIntro}>
                  <div>
                    <button type="button" className={styles.secondary}
                      onClick={()=>{setBattlePlayback(null);setTab('regions');window.scrollTo(0,0);}}>
                      <i className="fa-solid fa-arrow-left" aria-hidden="true"/> Voltar às regiões
                    </button>
                    <div className={styles.kicker}>ENCONTROS SELVAGENS · {battleRegion.name.toUpperCase()}</div>
                    <h2>{regionBattleTitle(battleRegion.id,battleRegion.name)}</h2>
                    <p className={styles.arenaLead}>Seu parceiro enfrenta Pokémon selvagens na região escolhida. Acompanhe os ataques, o HP e a energia dos dois combatentes.</p>
                    <div className={styles.arenaLeader} aria-label="Líder do combate">
                      <div className={styles.arenaLeaderPortrait}>
                        <PokemonArt id={active.pokemonId} name={speciesName(active.pokemonId)} />
                      </div>
                      <div>
                        <small><i className="fa-solid fa-crown" aria-hidden="true"/> SEU LÍDER</small>
                        <strong>{speciesName(active.pokemonId)}</strong>
                        <span>UID #{active.uid} · Nível {active.level}</span>
                      </div>
                      <button type="button" className={styles.secondary} onClick={()=>setTab('collection')}>
                        <i className="fa-solid fa-users" aria-hidden="true"/> Equipe {data.team.length}/3
                      </button>
                    </div>
                    <div className={styles.arenaOverview} aria-label="Desempenho na região">
                      <div><i className="fa-solid fa-trophy" aria-hidden="true"/><strong>{activeRecord.wins}</strong><span>Vitórias</span></div>
                      <div><i className="fa-solid fa-handshake" aria-hidden="true"/><strong>{activeRecord.draws}</strong><span>Empates</span></div>
                      <div><i className="fa-solid fa-shield-halved" aria-hidden="true"/><strong>{activeRecord.losses}</strong><span>Derrotas</span></div>
                    </div>
                    <div style={{display:'grid',gap:'var(--space-3)',padding:'var(--space-4)',background:'var(--color-surface-raised)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)'}}>
                      <label htmlFor="region-arena-select" className={styles.arenaSelectLabel}><i className="fa-solid fa-map-location-dot" aria-hidden="true"/> Explorar região de Kanto</label>
                      <select id="region-arena-select" aria-label="Região para batalha"
                        value={regionalArea} onChange={event=>setRegionalArea(Number(event.target.value))}
                        className={styles.arenaStyledSelect}>
                        {KANTO_REGIONS.map(region=><option key={region.id} value={region.id}
                          disabled={view.level<region.trainerUnlockLevel}>
                          {region.id}. {region.name} · Treinador Lv. {region.trainerUnlockLevel}
                        </option>)}
                      </select>
                      <p className={styles.arenaSelectLabel}><i className="fa-solid fa-baseball" aria-hidden="true"/> Captura disponível depois da vitória</p>
                      <p className={styles.arenaCaptureHint}>Conheça o adversário no combate e escolha uma Pokébola apenas se vencer. Uma tentativa por encontro.</p>
                      <button className={styles.primary} type="button"
                        disabled={busy||battlePlaying||Boolean(pendingBattle)
                          ||lastBattle?.captureStatus==='available'}
                        onClick={()=>fight(regionalArea)}>
                        <i className="fa-solid fa-map-location-dot" aria-hidden="true"/> Batalhar na região
                      </button>
                      <small>O resultado, XP e níveis são confirmados apenas ao fim do diário. Após vencer, você pode tentar capturar uma vez ou seguir sem capturar.</small>
                    </div>
                    <p className={styles.arenaMicrocopy}>
                      <i className="fa-solid fa-circle-info" aria-hidden="true"/>
                      {battlePlaying?' Assista ao confronto antes de iniciar outra batalha.':
                        ' Vitórias concedem experiência, moedas e afinidade ao final do combate.'}
                    </p>
                  </div>
                  <BattleStage
                    player={{
                      name:lastBattle?.playerName??view.active.name,
                      level:lastBattle?.playerLevel??active.level,
                      art:<PokemonArt id={lastBattle?.playerSpeciesId??active.pokemonId}
                        name={lastBattle?.playerName??view.active.name} large />
                    }}
                    wild={lastBattle?{
                      name:lastBattle.wildName,level:lastBattle.wildLevel,
                      art:KANTO_BATTLE_SPECIES[lastBattle.wildSpeciesId]
                        ?<PokemonArt id={lastBattle.wildSpeciesId} name={lastBattle.wildName} large />
                        :<span className={styles.unknownEnemy}>?</span>
                    }:null}
                    frame={currentFrame}
                    playerMaxHp={validFrames?lastBattle?.playerMaxHp??null:null}
                    wildMaxHp={validFrames?lastBattle?.wildMaxHp??null:null}
                    playerMaxSp={validSp?lastBattle?.playerMaxSp??null:null}
                    wildMaxSp={validSp?lastBattle?.wildMaxSp??null:null}
                    cue={playbackKey+':'+revealedLines}
                    playing={battlePlaying}
                  />
                </section>
                {lastBattle && (
                  <div className={styles.twoColumn}>
                    <section className={styles.panel+' '+styles.arenaResultPanel} aria-label="Resultado da última batalha">
                      <div className={styles.kicker}><i className="fa-solid fa-flag-checkered" aria-hidden="true"/> ÚLTIMO COMBATE{lastBattle.regionName?' · '+lastBattle.regionName:''}</div>
                      {battlePlaying ? <>
                        <h2>Batalha em andamento…</h2>
                        <p>As ações aparecem ataque por ataque, acompanhadas por um cronômetro.</p>
                        <p>Os resultados e prêmios serão revelados após a apresentação.</p>
                      </> : <>
                      <h2 className={lastBattle.outcome==='win'?styles.arenaWin:styles.arenaOutcome}>{lastBattle.outcome === 'win' ? 'Vitória!' : lastBattle.outcome === 'draw' ? 'Empate' : 'Derrota'}</h2>
                      <p>{lastBattle.wildName} · {lastBattle.turns} turno(s) · HP restante {lastBattle.playerRemainingHp}</p>
                      {(lastBattle.playerStatus||lastBattle.wildStatus)&&
                        <p>Condições ao fim do encontro: parceiro {lastBattle.playerStatus??'normal'} ·
                          selvagem {lastBattle.wildStatus??'normal'}. Reiniciadas na próxima batalha.</p>}
                      {lastBattle.outcome === 'win' && (
                        <div className={styles.battleRewards} aria-label="Recompensas recebidas">
                          <div><small>Moedas</small><strong>+{lastBattle.rewardCoins}</strong></div>
                          <div><small>XP treinador</small><strong>+{lastBattle.trainerXp}</strong></div>
                          <div><small>XP Pokémon</small><strong>+{lastBattle.pokemonXp}</strong></div>
                          <div><small>Afinidade</small><strong>+{lastBattle.affinityGain}</strong></div>
                        </div>
                      )}
                      {lastBattle.captureStatus==='available' ? (
                        <div className={styles.captureDecision} aria-label="Decisão de captura após a batalha">
                          <h3><i className="fa-solid fa-baseball" aria-hidden="true"/> Tentar capturar {lastBattle.wildName}?</h3>
                          <p>Uma única tentativa para este encontro. Você pode escolher a Pokébola agora que conhece o adversário.</p>
                          <label htmlFor="post-battle-ball" className={styles.arenaSelectLabel}>Escolha sua Pokébola</label>
                          <select id="post-battle-ball" aria-label="Pokébola para captura após batalha"
                            className={styles.arenaStyledSelect} value={captureBall??'none'}
                            onChange={event=>setCaptureBall(event.target.value==='none'
                              ?null:event.target.value as KantoBallId)}>
                            <option value="none">Selecione uma Pokébola</option>
                            <option value="poke-ball" disabled={(ballQuantities['poke-ball']??0)<1
                              ||battleRegion.rareSpeciesIds.includes(lastBattle.wildSpeciesId)}>Poké Ball · {ballQuantities['poke-ball']??0}</option>
                            <option value="great-ball" disabled={(ballQuantities['great-ball']??0)<1
                              ||battleRegion.rareSpeciesIds.includes(lastBattle.wildSpeciesId)}>Great Ball · {ballQuantities['great-ball']??0}</option>
                            <option value="ultra-ball" disabled={(ballQuantities['ultra-ball']??0)<1}>Ultra Ball · {ballQuantities['ultra-ball']??0}</option>
                          </select>
                          <button className={styles.primary} type="button"
                            disabled={busy||!captureBall||(ballQuantities[captureBall]??0)<1
                              ||battleRegion.rareSpeciesIds.includes(lastBattle.wildSpeciesId)
                                &&captureBall!=='ultra-ball'}
                            onClick={()=>captureAfterBattle(captureBall)}>
                            <i className="fa-solid fa-bullseye" aria-hidden="true"/> Tentar capturar (1 tentativa)
                          </button>
                          <button type="button" className={styles.secondary}
                            disabled={busy} onClick={()=>captureAfterBattle(null)}>
                            Seguir sem capturar
                          </button>
                        </div>
                      ) : <p>{lastBattle.captured
                        ? 'Captura realizada! O Pokémon foi adicionado à coleção.'
                        :lastBattle.captureStatus==='escaped'?'O Pokémon escapou da tentativa.'
                        :lastBattle.captureStatus==='skipped'?'Você decidiu não tentar capturar.'
                        :'Nenhuma captura nesta batalha.'}</p>}
                      <button type="button" className={styles.secondary}
                        onClick={()=>setBattlePlayback({id:displayedBattleId,seq:(battlePlayback?.seq??0)+1,done:false})}>
                        Reassistir à batalha</button>
                      </>}
                    </section>
                    <BattlePlayback key={displayedBattleId+':'+(battlePlayback?.seq??0)}
                      log={lastBattle.log} turns={lastBattle.turns}
                      playing={battlePlaying} onProgress={onBattleProgress} onFinished={()=>{void finishPlayback();}} />
                  </div>
                )}
                <section className={styles.panel+' '+styles.arenaEncounters}>
                  <div className={styles.arenaEncountersHeading}>
                    <div><div className={styles.kicker}>EXPLORAÇÃO DE {battleRegion.name.toUpperCase()}</div><h2>Pokémon encontrados nesta área</h2></div>
                    <span>{battleRegion.speciesIds.length} espécies selvagens</span>
                  </div>
                  <div className={styles.encounterGrid}>
                    {battleRegion.speciesIds.map(id=><div key={id} className={styles.encounterCard}>
                      <PokemonArt id={id} name={KANTO_BATTLE_SPECIES[id]!.name} />
                      <span>{KANTO_BATTLE_SPECIES[id]!.name}</span>
                    </div>)}
                  </div>
                  <p className={styles.disclaimer}>Todas as espécies possíveis desta região. Os encontros lendários são extremamente raros.</p>
                  <button type="button" className={styles.secondary}
                    onClick={()=>setTab('pokedex')}>Explorar Pokédex 151</button>
                </section>
              </>
            )}
            {tab === 'expedition' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <h2>{expedition ? 'Expedição em andamento' : 'Expedição de Kanto'}</h2>
                  <p>Escolha uma região desbloqueada pelo treinador e compatível com o nível do Pokémon líder. Cada ciclo de 10 segundos rende 7 moedas, 4 XP ao treinador e 5 XP ao Pokémon expedicionário (até 8 horas por resgate).</p>
                  {expedition ? <p><strong>Região da expedição:</strong> {expeditionRegion?.name??'Expedição antiga'} · Pokémon UID {expedition.teamUids?.join(', ')??'—'}</p> : <label htmlFor="expedition-region"><strong>Região para expedição</strong>
                    <select id="expedition-region" value={expeditionArea} onChange={event=>setExpeditionArea(Number(event.target.value))}>
                      {expeditionOptions.map(({region,unlocked})=><option key={region.id} value={region.id} disabled={!unlocked}>
                        {region.name} · Treinador Nv. {region.trainerUnlockLevel} · Pokémon Nv. {region.levelMin}{unlocked?'':' (bloqueada)'}
                      </option>)}
                    </select>
                    {!expeditionAllowed&&<span role="status">O líder ou treinador ainda não atende aos requisitos desta região.</span>}
                  </label>}
                  <div className={styles.partner}><PokemonArt id={active.pokemonId} name={view.active.name} />
                    <div><strong>{view.active.name}</strong><p>Parceiro da equipe · Nível {active.level}</p></div>
                  </div>
                  {!expedition
                    ? <button type="button" className={styles.primary} disabled={busy||!expeditionAllowed}
                        onClick={() => dispatch({type:'start-expedition',regionId:expeditionArea,nowMs:Date.now()})}>Iniciar expedição</button>
                    : <div className={styles.heroActions}>
                        <button type="button" className={styles.primary} disabled={busy || !pending?.cycles}
                          onClick={() => dispatch({type:'claim-expedition',nowMs:Date.now()})}>Resgatar recompensas</button>
                        <button type="button" className={styles.secondary} disabled={busy}
                          onClick={() => dispatch({type:'stop-expedition',nowMs:Date.now()})}>Encerrar expedição</button>
                      </div>}
                </section>
                <section className={styles.panel}>
                  <h2>Recompensas acumuladas</h2>
                  <div className={styles.metricsCompact}>
                    <div><small>Ciclos completos</small><strong>{pending?.cycles ?? 0}</strong></div>
                    <div><small>Moedas</small><strong>+{pending?.coins ?? 0}</strong></div>
                    <div><small>XP treinador</small><strong>+{pending?.trainerXp ?? 0}</strong></div>
                    <div><small>XP Pokémon</small><strong>+{pending?.pokemonXpPerMember ?? 0}</strong></div>
                  </div>
                  <p>{expedition ? 'Próximo ciclo em cerca de ' + nextCycle + 's' : 'Comece uma expedição para acumular recompensas.'}</p>
                  <p className={styles.disclaimer}>A versão alfa usa o relógio deste dispositivo e não possui proteção contra alterações locais.</p>
                </section>
              </div>
            )}
          </>
        )}
        <footer className={styles.footer}>Poke Idle Game · Alfa pré-lançamento · Pokémon e marcas pertencem aos seus titulares. Sem conta ou progresso em nuvem.</footer>
      </div>
    </div>
  );
}
