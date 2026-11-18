import { useCallback, useEffect, useState } from 'react';
import {
  EXPEDITION_CYCLE_MS, expeditionRewards, LEGACY_EQUIPMENT_SLOTS,
  LEGACY_ITEMS, LEGACY_STARTERS, STATS, legacyPokemonManualBudget,
  KANTO_BATTLE_SPECIES, KANTO_WILD_POOL, pokemonFinalStats, affinityRate, zeroStats,
  kantoLevelMoves,kantoSupportMoves,KANTO_SUPPORT_MOVES,pokemonMoveSlots,
  legacyMoveRankLimits,KANTO_BATTLE_MOVES,kantoMoveSecondaryEffect,
  KANTO_BASIC_ATTACK,kantoMaxSp,kantoMoveSpCost,
  KANTO_EVOLUTION_STONES, kantoEvolutionOptions
} from '@kanto/game-core';
import type { Stat, EquipmentSlot, StatValues, KantoBattleVisualFrame } from '@kanto/game-core';
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

type Tab = 'overview' | 'trainer' | 'pokemon' | 'collection' | 'pokedex' | 'arena' | 'expedition';
type CollectionFilter = 'all' | 'team' | 'reserve';

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
      loading="lazy"
    />
  );
}

function sectionName(tab: Tab): string {
  return { overview: 'Visão geral', trainer: 'Treinador', pokemon: 'Pokémon', collection: 'Coleção', pokedex: 'Pokédex', arena: 'Arena', expedition: 'Expedição' }[tab];
}

/**
 * Primeira experiência v0.2 jogável: cria progresso, edita atributos e
 * recebe recursos idle na mesma chave local, sem simular vitória falsa.
 * A v0.1 existente não é importada nem modificada.
 */
export function PlayApp() {
  const [save, setSave] = useState<PlayRead>(readSafe);
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState('');
  const [starter, setStarter] = useState(1);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [feedback, setFeedback] = useState('');
  const [battlePlayback, setBattlePlayback] = useState<{id:string;seq:number;done:boolean}|null>(null);
  /** Apenas reprodução: não faz parte do save do jogo. */
  const [battleReveal,setBattleReveal]=useState<{key:string;visible:number}|null>(null);
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
      setFeedback(outcome.status === 'ok' ? 'Progresso salvo neste navegador.' : outcome.reason);
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

  /** Browser seguro: sorteia seed uint32, resolução real ocorre no game-core. */
  function fight(): void {
    if (busy || (battlePlayback&&!battlePlayback.done) || save.status!=='ready') return;
    const expected=save.snapshot.revision;
    const seed = window.crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed === undefined) {
      setFeedback('Não foi possível sortear o encontro.');
      return;
    }
    // Uma única transação de gameplay; animação não toca o save nem recompensas.
    void transact(()=>updatePlaySave(window.localStorage,expected,{type:'battle',seed}))
      .then(result=>{
        if(result?.status==='ok'){
          setTab('arena');
          setBattlePlayback({id:'battle-v02-'+result.snapshot.revision,seq:(battlePlayback?.seq??0)+1,done:false});
        }
      });
  }

  function openPokemon(uid:number):void {
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
    setCollectionQuery('');
    setCollectionFilter('all');
    setFeedback('Teste v0.2 reiniciado. O protótipo v0.1 não foi alterado.');
  }

  const parsed = save.status === 'ready' ? parseLegacySave(save.snapshot.journal.raw) : null;
  const data = parsed?.status === 'valid' ? parsed.save : null;
  const projected = data ? projectLegacyTrainer(data, BATTLE_SPECIES_CACHE, now) : null;
  const view = projected?.status === 'ready' ? projected.value : null;
  const active = data?.roster.find(p => p.uid === data.team[0]) ?? data?.roster[0];
  // Treinar uma captura NÃO altera o líder da Arena. Cada instância mantém seu UID.
  const focused = data?.roster.find(p => p.uid === selectedUid) ?? active;
  const pokemonManual = manualValues(focused?.manual);
  const pokemonSpent = STATS.reduce((total, stat) => total + pokemonManual[stat], 0);
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
  }) ?? [];
  const expedition = data?.expedition as { lastClaimAt: number; startedAt: number } | null | undefined;
  const pending = expedition
    ? expeditionRewards(Math.max(0, now - expedition.lastClaimAt)) : null;
  const lastBattleRaw = data?.lastBattle;
  const lastBattle=lastBattleRaw && typeof lastBattleRaw==='object'
    && 'outcome' in lastBattleRaw && 'wildSpeciesId' in lastBattleRaw
    && 'log' in lastBattleRaw && Array.isArray(lastBattleRaw.log)
    ? lastBattleRaw as {
        battleId?:string;
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
        rewardCoins:number;trainerXp:number;pokemonXp:number;
        playerRemainingHp:number;wildRemainingHp:number
      }
    : null;
  const displayedBattleId=lastBattle?.battleId??'legacy-battle';
  const battlePlaying=Boolean(battlePlayback && !battlePlayback.done && battlePlayback.id===displayedBattleId);
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
      &&['intro','attack','miss','status','heal','residual','outcome','info'].includes(frame.kind)
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
    <div className={styles.appShell} data-testid="play-root">
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.brandBall}>◉</span>KANTO <strong>IDLE</strong><span className={styles.alpha}>ALPHA</span></div>
        <div className={styles.sidebarCaption}>SUA JORNADA</div>
        <nav className={styles.menu} aria-label="Navegação do jogo">
          {(['overview','trainer','pokemon','collection','pokedex','arena','expedition'] as Tab[]).map(item => (
            <button type="button" key={item} aria-current={tab === item ? 'page' : undefined}
              className={tab === item ? styles.menuActive : styles.menuItem}
              onClick={() => { setTab(item); setFeedback(''); if(item!=='arena')setBattlePlayback(null); }}>{sectionName(item)}</button>
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
            <h1>{sectionName(tab)}</h1>
          </div>
          <div className={styles.trainerChip}><span className={styles.avatar}>★</span>
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
                      <button type="button" className={styles.secondary} onClick={() => setTab('arena')}>Explorar Arena</button>
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
                    <p>Organize seus parceiros e escolha o líder que combate na Arena.</p>
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
            {tab === 'trainer' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}><h2>{view.name}</h2><span className={styles.levelTag}>Nível {view.level}</span></div>
                  <p>{view.title.name} · {view.unspent} ponto(s) para distribuir</p>
                  <div className={styles.progress} role="progressbar" aria-label="Experiência do treinador"
                    aria-valuemin={0} aria-valuemax={view.xpNext ?? 1}
                    aria-valuenow={view.xpNext === null ? 1 : view.xp}>
                    <span style={{width: (view.xpNext === null ? 100 : Math.min(100, view.xp / view.xpNext * 100)) + '%'}} />
                  </div>
                  <div className={styles.statList}>
                    {STATS.map(stat => (
                      <div className={styles.stat} key={stat}>
                        <span>{STAT_LABELS[stat]}</span><strong>{view.totals[stat]}</strong>
                        <small>{view.manual[stat]} manual</small>
                        <button type="button" disabled={busy || view.unspent < 1 || view.manual[stat] >= 40}
                          onClick={() => dispatch({type:'trainer',value:{type:'invest',stat}})}
                          aria-label={`Adicionar ponto em ${STAT_LABELS[stat]} do treinador`}>+1</button>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={styles.panel}>
                  <h2>Equipamentos provisórios</h2>
                  <p>Itens de teste disponíveis para explorar os bônus. A economia definitiva será implementada depois.</p>
                  <div className={styles.equipmentList}>
                    {LEGACY_EQUIPMENT_SLOTS.map((slot: EquipmentSlot) => {
                      const trainer = data.trainer as Record<string, unknown>;
                      const equipped = (trainer.equipped ?? {}) as Record<string, string>;
                      return (
                        <label key={slot}><span>{slot}</span>
                          <select aria-label={`Equipamento: ${slot}`} disabled={busy}
                            value={equipped[slot] || ''}
                            onChange={event => dispatch({type:'trainer',value:{type:'equip',slot,itemId:event.target.value}})}>
                            <option value="">Sem equipamento</option>
                            {LEGACY_ITEMS.filter(item => item.slot === slot).map(item => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <p>Insígnias: {view.badges.length}/8 · Título: {view.title.name}</p>
                </section>
              </div>
            )}
            {tab === 'pokemon' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <div className={styles.pokemonShowcase}>
                    <PokemonArt id={focused.pokemonId} name={speciesName(focused.pokemonId)} large />
                    <h2>{speciesName(focused.pokemonId)} <span className={styles.levelTag}>Lv. {focused.level}</span></h2>
                    <p>Instância UID #{focused.uid} · Afinidade {focused.affinity}%</p>
                    <p>Transferência de atributos do treinador: {(affinityRate(focused.affinity)*100).toFixed(1)}%</p>
                    <p>{data.team[0]===focused.uid ? 'Líder da equipe · participa da Arena'
                      : data.team.includes(focused.uid) ? 'Na equipe · reserva de combate'
                        : 'Na coleção · fora da equipe'}</p>
                    <button type="button" className={styles.secondary}
                      onClick={()=>setTab('collection')}>Voltar à coleção</button>
                  </div>
                </section>
                <section className={styles.panel}>
                  <h2>Treinamento Pokémon</h2>
                  <p>Pontos disponíveis: <strong>{pokemonBudget - pokemonSpent}</strong> de {pokemonBudget}</p>
                  {!focusedStats && <p>Atributos de batalha desta espécie ainda não constam no catálogo piloto.</p>}
                  <div className={styles.statList}>
                    {STATS.map((stat: Stat) => (
                      <div className={styles.stat} key={stat}>
                        <span>{STAT_LABELS[stat]}</span>
                        <strong>{focusedStats?.[stat] ?? '—'}</strong>
                        <small>{pokemonManual?.[stat] ?? 0} manual</small>
                        <button type="button" disabled={busy || pokemonSpent >= pokemonBudget}
                          onClick={() => dispatch({type:'pokemon',value:{type:'invest-pokemon',uid:focused.uid,stat}})}
                          aria-label={`Adicionar ponto em ${STAT_LABELS[stat]} do Pokémon`}>+1</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className={styles.secondary} disabled={busy || pokemonSpent === 0}
                    onClick={() => dispatch({type:'pokemon',value:{type:'reset-pokemon',uid:focused.uid}})}>
                    Redistribuir pontos</button>
                </section>
                <section className={styles.panel} aria-label="Evolução do Pokémon">
                  <h2>Evolução</h2>
                  <p>Seu Pokémon conserva UID, nível, XP, afinidade, pontos e golpes ao evoluir.</p>
                  {focusedEvolutions.length===0
                    ? <p>Nenhuma evolução disponível para esta espécie dentro dos 151 de Kanto.</p>
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
                              {rule.trigger==='stone'&&<small>Em estoque: {stoneStock[rule.stone]??0}</small>}
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
                  <div className={styles.evolutionTestTools}>
                    <span>Pedras: {KANTO_EVOLUTION_STONES.map(item=>
                      item.name+' '+(stoneStock[item.id]??0)).join(' · ')}</span>
                    <button type="button" className={styles.secondary}
                      disabled={busy||data.evolutionTestKitClaimed===true}
                      onClick={()=>dispatch({type:'evolution-test-kit'})}>
                      {data.evolutionTestKitClaimed===true
                        ? 'Kit de teste já recebido':'Receber kit de pedras (teste)'}</button>
                  </div>
                  <p className={styles.disclaimer}>Kit único, apenas para validar a alfa. Não é uma loja
                    nem uma regra definitiva de obtenção de itens. Trocas não estão implementadas.
                    Durante expedições, evolução fica bloqueada.</p>
                </section>
                <section className={styles.panel} aria-label="Treinar golpes do Pokémon">
                  <h2>Golpes do Pokémon</h2>
                  <p>Golpes equipados: <strong>{equippedNames.length}/4</strong> ·
                    principal: <strong>{currentMoveName || 'Padrão'}</strong>.
                    A Arena escolhe ataques e pode usar suportes na abertura;
                    pelo menos um golpe de dano deve permanecer equipado.
                    Cada habilidade gasta SP, e o ataque básico é gratuito.</p>
                  <p>SP de combate por encontro: <strong>{focused?kantoMaxSp(focused.level):0}</strong> ·
                    ataque básico gratuito (Poder {KANTO_BASIC_ATTACK.power}).
                    O SP só recarrega no próximo encontro; não se confunde com
                    pontos de aprimoramento.</p>
                  <div className={styles.moveList} aria-label="Golpes equipados" data-testid="equipped-moves">
                    {equippedNames.map((name,i)=><div key={name} className={styles.moveEquipped}>
                      <div><strong>{i+1}. {name}</strong>
                        <small>{i===0?'Principal':'Adicional'} ·
                          {KANTO_SUPPORT_MOVES[name]?' Suporte':' Ataque'} ·
                          {KANTO_SUPPORT_MOVES[name]||KANTO_BATTLE_MOVES[name]
                            ?' '+kantoMoveSpCost((KANTO_SUPPORT_MOVES[name]??KANTO_BATTLE_MOVES[name])!)+' SP'
                            :' Golpe provisório'}</small></div>
                      <div className={styles.moveActions}>
                        {i>0&&<button type="button" className={styles.secondary}
                          aria-label={'Tornar principal '+name} disabled={busy}
                          onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                            moveName:name,operation:'primary'})}>Principal</button>}
                        {equippedNames.length>1&&<button type="button" className={styles.textButton}
                          aria-label={'Retirar golpe '+name} disabled={busy}
                          onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                            moveName:name,operation:'remove'})}>Retirar</button>}
                      </div>
                    </div>)}
                  </div>
                  <p>Pontos para aprimorar golpes: <strong>{moveLimits?moveLimits.skillPoints-moveSpent:0}</strong>
                    {moveLimits ? ' · Rank máximo por golpe: '+moveLimits.maxRankPerMove : ''}</p>
                  <div className={styles.moveList}>
                    {levelMoves.map(({move,learnedAt})=>{
                      const equipped=currentMoveName===move.name;
                      const inSlots=equippedNames.includes(move.name);
                      const rank=moveRanks[move.name]??0;
                      return <div key={move.name} className={equipped?styles.moveEquipped:styles.moveOption}>
                        <div><strong>{move.name}</strong><small>Nv. {learnedAt} · {move.type} ·
                          Poder {move.power} · Precisão {move.accuracy}%</small>
                          <small>Rank {rank} · {move.category==='physical'?'Físico':'Especial'} ·
                            Custo {kantoMoveSpCost(move)} SP na Arena</small>
                           {effectLabel(move.name)&&<small>{effectLabel(move.name)}</small>}
                        </div>
                        <div className={styles.moveActions}>
                          {!inSlots&&<button type="button" className={styles.secondary}
                            disabled={busy||equippedNames.length>=4}
                            aria-label={'Adicionar golpe '+move.name}
                            onClick={()=>dispatch({type:'move-set',uid:focused.uid,
                              moveName:move.name,operation:'add'})}>Adicionar</button>}
                          <button type="button" className={styles.secondary}
                            disabled={busy||equipped}
                            aria-label={'Equipar golpe '+move.name}
                            onClick={()=>dispatch({type:'move',uid:focused.uid,moveName:move.name,operation:'select'})}>
                            {equipped?'Equipado':'Equipar'}</button>
                          <button type="button" className={styles.primary}
                            aria-label={'Aprimorar golpe '+move.name}
                            disabled={busy||!equipped||moveSpent>=(moveLimits?.skillPoints??0)
                              ||rank>=(moveLimits?.maxRankPerMove??0)}
                            onClick={()=>dispatch({type:'move',uid:focused.uid,moveName:move.name,operation:'upgrade'})}>
                            + Rank</button>
                        </div>
                      </div>;
                    })}
                  </div>
                  <h3>Golpes de suporte aprendidos</h3>
                  <div className={styles.moveList}>
                    {supportMoves.map(({move,learnedAt})=>{
                      const inSlots=equippedNames.includes(move.name);
                      return <div key={move.name} className={inSlots?styles.moveEquipped:styles.moveOption}>
                        <div><strong>{move.name}</strong>
                          <small>Nv. {learnedAt} · {move.type} · Precisão {move.accuracy}% ·
                            Custo {kantoMoveSpCost(move)} SP</small>
                          <small>{move.name==='growl'?'Reduz Ataque':
                            move.name==='tail-whip'?'Reduz Defesa':
                              move.name==='thunder-wave'?'Paralisa':'Envenena'}</small></div>
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
                  {supportMoves.length===0&&<p>Nenhum suporte foi liberado neste recorte.</p>}
                  {levelMoves.length===0&&<p>Nenhum golpe de dano direto foi catalogado até este nível nesta seleção da PokéAPI.</p>}
                  {currentMoveName&&!levelMoves.some(x=>x.move.name===currentMoveName)&&
                    <p className={styles.disclaimer}>O golpe equipado pode ter sido aprendido antes da evolução ou ser provisório da alfa. Ele é preservado nesta instância; ao equipar outro golpe, será substituído.</p>}
                  <p className={styles.disclaimer}>Recorte de movimentos por nível
                    FireRed/LeafGreen: dano e quatro suportes básicos. A IA escolhe
                    suporte válido na abertura e depois prioriza dano. Sem PP ou
                    escolha manual por turno na alfa; status são temporários.</p>
                </section>
              </div>
            )}


            {tab === 'collection' && (
              <>
                <section className={styles.collectionHeader}>
                  <div>
                    <div className={styles.kicker}>SEUS PARCEIROS · CADA UID É ÚNICO</div>
                    <h2>Coleção Pokémon</h2>
                    <p>Você capturou {data.roster.length} indivíduo(s) de {caughtSpeciesCount} espécie(s).
                      O líder, primeiro na equipe, é quem participa das batalhas.</p>
                  </div>
                  <div className={styles.collectionSummary}>
                    <strong>{data.team.length}<span>/3</span></strong>
                    <small>Na equipe</small>
                  </div>
                </section>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <h2>Equipe atual</h2>
                    {expedition && <span className={styles.teamLocked}>Equipe bloqueada: expedição ativa</span>}
                  </div>
                  <div className={styles.teamSlots} aria-label="Equipe atual, até 3 Pokémon">
                    {[0,1,2].map(position=>{
                      const uid=data.team[position];
                      const pokemon=data.roster.find(p=>p.uid===uid);
                      return (
                        <article key={position} className={pokemon?styles.teamSlot:styles.teamSlotEmpty}>
                          <span className={styles.slotCaption}>{position===0?'Líder · Arena':'Slot '+(position+1)}</span>
                          {pokemon ? <>
                            <PokemonArt id={pokemon.pokemonId} name={speciesName(pokemon.pokemonId)} />
                            <strong>{speciesName(pokemon.pokemonId)}</strong>
                            <small>UID #{pokemon.uid} · Nv. {pokemon.level}</small>
                            {position>0&&<button type="button" className={styles.textButton}
                              disabled={busy || Boolean(expedition)}
                              aria-label={'Tornar líder UID '+pokemon.uid}
                              onClick={()=>dispatch({type:'pokemon',value:{type:'set-active',uid:pokemon.uid}})}>
                              Tornar líder</button>}
                          </> : <span className={styles.slotPlaceholder}>Vazio</span>}
                        </article>
                      );
                    })}
                  </div>
                  <p className={styles.disclaimer}>Máximo de 3 Pokémon. A equipe precisa manter pelo menos 1 integrante. Durante uma expedição não é possível adicionar, remover ou trocar o líder.</p>
                </section>
                <section className={styles.panel}>
                  <div className={styles.collectionToolbar}>
                    <div>
                      <h2>Todos os Pokémon</h2>
                      <p>Pesquise por nome, número da Pokédex ou UID.</p>
                    </div>
                    <input className={styles.input} aria-label="Buscar Pokémon na coleção"
                      type="search" value={collectionQuery} onChange={e=>setCollectionQuery(e.target.value)}
                      placeholder="Buscar Pokémon ou UID..." />
                  </div>
                  <div className={styles.collectionFilters} aria-label="Filtrar coleção">
                    {(['all','team','reserve'] as CollectionFilter[]).map(filter=>(
                      <button type="button" key={filter}
                        aria-pressed={collectionFilter===filter}
                        className={collectionFilter===filter?styles.collectionFilterActive:styles.collectionFilter}
                        onClick={()=>setCollectionFilter(filter)}>
                        {filter==='all'?'Todos':filter==='team'?'Na equipe':'Reserva'}
                      </button>
                    ))}
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
                            <span>#{String(pokemon.pokemonId).padStart(3,'0')}</span>
                            <span>{leader?'LÍDER':inTeam?'EQUIPE':'RESERVA'}</span>
                          </div>
                          <PokemonArt id={pokemon.pokemonId} name={dex} />
                          <strong>{dex}</strong>
                          <div className={styles.collectionAttributes}>
                            <span>UID #{pokemon.uid}</span><span>Lv. {pokemon.level}</span>
                            <span>♥ {pokemon.affinity}%</span>
                          </div>
                          <div className={styles.collectionCardActions}>
                            <button type="button" className={styles.secondary}
                              aria-label={'Treinar UID '+pokemon.uid}
                              onClick={()=>openPokemon(pokemon.uid)}>Treinar</button>
                            {inTeam ? (
                              <button type="button" className={styles.secondary}
                                aria-label={'Remover UID '+pokemon.uid+' da equipe'}
                                disabled={busy || Boolean(expedition) || data.team.length<=1}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'remove-team',uid:pokemon.uid}})}>
                                Retirar</button>
                            ) : (
                              <button type="button" className={styles.primary}
                                aria-label={'Adicionar UID '+pokemon.uid+' à equipe'}
                                disabled={busy || Boolean(expedition) || data.team.length>=3}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'add-team',uid:pokemon.uid}})}>
                                Escalar</button>
                            )}
                            {inTeam&&!leader&&(
                              <button type="button" className={styles.textButton}
                                aria-label={'Tornar líder UID '+pokemon.uid+' pela coleção'}
                                disabled={busy || Boolean(expedition)}
                                onClick={()=>dispatch({type:'pokemon',value:{type:'set-active',uid:pokemon.uid}})}>
                                Definir líder</button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {rosterFiltered.length===0&&<p className={styles.emptyCollection} role="status">
                    Nenhum Pokémon encontrado com este filtro.
                  </p>}
                </section>
              </>
            )}

            {tab === 'pokedex' && (
              <PokedexPanel
                seenIds={seenDexIds}
                capturedSpeciesIds={caughtDexIds}
                onArena={()=>setTab('arena')}
                onCollection={()=>setTab('collection')}
              />
            )}

            {tab === 'arena' && (
              <>
                <section className={styles.battleIntro}>
                  <div>
                    <div className={styles.kicker}>ENCONTROS SELVAGENS · KANTO</div>
                    <h2>Arena de batalha</h2>
                    <p>Seu Pokémon enfrenta automaticamente um encontro de Kanto em até 30 turnos. O motor calcula precisão, dano, críticos, tipos e condições temporárias (queimadura, envenenamento e paralisia). Vitória concede XP, moedas, afinidade e chance de captura de 35%.</p>
                    <p>SP de combate: <strong>40 + floor(nível / 4)</strong> por Pokémon.
                      Habilidades consomem SP ao tentar usá-las, mesmo se errarem;
                      a IA intercala golpes com ataque básico gratuito (Poder 30).
                      Se faltar SP, só poderá usar o básico até o próximo encontro.
                      O SP não se regenera durante a batalha.</p>
                    <p>Líder: <strong>{speciesName(active.pokemonId)} · UID #{active.uid}</strong></p>
                    <p>Equipe: <strong>{data.team.length}/3</strong> ·
                      <button type="button" className={styles.textButton}
                        onClick={()=>setTab('collection')}>Gerenciar equipe</button></p>
                    <p>Vitórias: <strong>{typeof data.wins === 'number' ? data.wins : 0}</strong> · Derrotas/empates: <strong>{typeof data.losses === 'number' ? data.losses : 0}</strong> · Insígnias: <strong>{view.badges.length}/8</strong></p>
                    <button className={styles.primary} type="button" disabled={busy||battlePlaying} onClick={fight}>
                      Batalhar contra Pokémon selvagem
                    </button>
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
                    <section className={styles.panel} aria-label="Resultado da última batalha">
                      <div className={styles.kicker}>ÚLTIMO COMBATE</div>
                      {battlePlaying ? <>
                        <h2>Batalha em andamento…</h2>
                        <p>As ações aparecem ataque por ataque, acompanhadas por um cronômetro.</p>
                        <p>Os resultados e prêmios serão revelados após a apresentação.</p>
                      </> : <>
                      <h2>{lastBattle.outcome === 'win' ? 'Vitória!' : lastBattle.outcome === 'draw' ? 'Empate' : 'Derrota'}</h2>
                      <p>{lastBattle.wildName} · {lastBattle.turns} turno(s) · HP restante {lastBattle.playerRemainingHp}</p>
                      {(lastBattle.playerStatus||lastBattle.wildStatus)&&
                        <p>Condições ao fim do encontro: parceiro {lastBattle.playerStatus??'normal'} ·
                          selvagem {lastBattle.wildStatus??'normal'}. Reiniciadas na próxima batalha.</p>}
                      {lastBattle.outcome === 'win' && (
                        <div className={styles.battleRewards}>
                          <div><small>Moedas</small><strong>+{lastBattle.rewardCoins}</strong></div>
                          <div><small>XP treinador</small><strong>+{lastBattle.trainerXp}</strong></div>
                          <div><small>XP Pokémon</small><strong>+{lastBattle.pokemonXp}</strong></div>
                          <div><small>Afinidade</small><strong>+{lastBattle.affinityGain}</strong></div>
                        </div>
                      )}
                      <p>{lastBattle.captured
                        ? 'Captura realizada! O Pokémon foi adicionado à coleção.'
                        : 'Nenhuma captura nesta batalha.'}</p>
                      <button type="button" className={styles.secondary}
                        onClick={()=>setBattlePlayback({id:displayedBattleId,seq:(battlePlayback?.seq??0)+1,done:false})}>
                        Reassistir à batalha</button>
                      </>}
                    </section>
                    <BattlePlayback key={displayedBattleId+':'+(battlePlayback?.seq??0)}
                      log={lastBattle.log} turns={lastBattle.turns}
                      playing={battlePlaying} onProgress={onBattleProgress} onFinished={()=>setBattlePlayback(previous=>previous&&previous.id===displayedBattleId?{...previous,done:true}:previous)} />
                  </div>
                )}
                <section className={styles.panel}>
                  <h2>Pokémon encontrados nesta arena</h2>
                  <div className={styles.encounterGrid}>
                    {KANTO_WILD_POOL.slice(0,12).map(id=><div key={id} className={styles.encounterCard}>
                      <PokemonArt id={id} name={KANTO_BATTLE_SPECIES[id]!.name} />
                      <span>{KANTO_BATTLE_SPECIES[id]!.name}</span>
                    </div>)}
                  </div>
                  <p className={styles.disclaimer}>
                    A Arena agora sorteia entre {KANTO_WILD_POOL.length} espécies selvagens comuns; aqui aparecem 12 exemplos.
                    O catálogo local tem os 151 Pokémon de Kanto com nomes, tipos e atributos-base oficiais.
                    Os golpes automáticos de espécies adicionadas nesta etapa ainda são provisórios, não listas oficiais de aprendizado.
                    Esta alfa usa seed gerada no navegador, sem servidor antifraude.
                  </p>
                  <button type="button" className={styles.secondary}
                    onClick={()=>setTab('pokedex')}>Explorar Pokédex 151</button>
                </section>
              </>
            )}
            {tab === 'expedition' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <h2>{expedition ? 'Expedição em andamento' : 'Expedição de Kanto'}</h2>
                  <p>Seu Pokémon explora a região em ciclos de 10 segundos. Cada ciclo concede 7 moedas, 4 XP ao treinador e 5 XP ao Pokémon. O resgate acumula no máximo 8 horas por vez.</p>
                  <div className={styles.partner}><PokemonArt id={active.pokemonId} name={view.active.name} />
                    <div><strong>{view.active.name}</strong><p>Parceiro da equipe · Nível {active.level}</p></div>
                  </div>
                  {!expedition
                    ? <button type="button" className={styles.primary} disabled={busy}
                        onClick={() => dispatch({type:'start-expedition',nowMs:Date.now()})}>Iniciar expedição</button>
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
