import {RegionDialog} from '../regions/RegionDialog';
import {PokeballSymbol,PokeballArt} from './PokeballArt';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  expeditionRewards, LEGACY_EQUIPMENT_SLOTS,
  LEGACY_ITEMS, LEGACY_STARTERS, STATS, legacyPokemonManualBudget,
  KANTO_BATTLE_SPECIES, pokemonFinalStats, affinityRate, zeroStats,
  kantoLevelMoves,kantoSupportMoves,KANTO_SUPPORT_MOVES,pokemonMoveSlots,
  legacyMoveRankLimits,KANTO_BATTLE_MOVES,kantoMoveSecondaryEffect,
  kantoMoveSpCost,kantoMovePp,
  KANTO_EVOLUTION_STONES, kantoEvolutionOptions,
  KANTO_REGIONS,inspectKantoBallPocket,xpThreshold,affinityIdlePenaltyDays
} from '@kanto/game-core';
import type { Stat, EquipmentSlot, StatValues, KantoBattleVisualFrame,KantoBallId,KantoShopBallId } from '@kanto/game-core';
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
import {OnlineBattle} from './OnlineBattle';
import { BallShopPreview } from './BallShopPreview';
import { TrainerScreen } from './TrainerScreen';
import {OnlineNavigation} from './OnlineNavigation';
import {AdventureOverview,AdventureTopbar} from './AdventureOverview';
import {kantoSpecies} from '@kanto/game-core';
import type {TrainerSection} from './OnlineNavigation';
import { GymScreen } from './GymScreen';
import { PokemonTraining } from './PokemonTraining';
import type {OnlineViews,RegionalReward} from './onlinePlay';
import {readOnlineAccount,startOnline,logoutOnline,sendOnlineAction,readOnlineViews,sendOnlineCommand,onlineBattleCommand,onlineMoveSlots} from './onlinePlay';
import { RegionsScreen } from '../regions/RegionsScreen';
import { ExpeditionScreen } from './ExpeditionScreen';
import { estimatedServerNow,formatExpeditionDuration,timeUntilAffinityLoss } from './expeditionDisplay';

type Tab = 'overview' | 'trainer' | 'pokemon' | 'collection' | 'pokedex' | 'regions' | 'battle' | 'gyms' | 'expedition' | 'shop';
type CollectionFilter = 'all' | 'team' | 'reserve';
type CollectionSort = 'recent' | 'level' | 'affinity' | 'species';
type PokemonSection = 'profile' | 'evolution' | 'moves';
/** D-051: navegação consistente com o Font Awesome da tela do treinador. */
const NAV_ICONS:Readonly<Record<Tab,string>>={
  overview:'fa-house',trainer:'fa-user',pokemon:'fa-dragon',collection:'fa-layer-group',
  pokedex:'fa-book-open',regions:'fa-map-location-dot',battle:'fa-khanda',gyms:'fa-medal',expedition:'fa-compass',shop:'fa-store'
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
  return { overview: 'Visão geral', trainer: 'Treinador', pokemon: 'Pokémon', collection: 'Coleção', pokedex: 'Pokédex', regions: 'Regiões', battle: 'Batalha regional', gyms:'Ginásios', expedition: 'Expedição', shop:'Loja' }[tab];
}

/**
 * Primeira experiência v0.2 jogável: cria progresso, edita atributos e
 * recebe recursos idle na mesma chave local, sem simular vitória falsa.
 * A v0.1 existente não é importada nem modificada.
 */
export function PlayApp({initialTab='overview',online=false}:{readonly initialTab?:'overview'|'regions';readonly online?:boolean}={}) {
  const [save, setSave] = useState<PlayRead>(()=>online?{status:'unavailable'}:readSafe());
  const onlineLock=useRef(false);
  const [onlineViews,setOnlineViews]=useState<OnlineViews|null>(null);
  const [onlineLoading,setOnlineLoading]=useState(online);
  async function refreshOnline():Promise<PlayRead>{
    try{const account=await readOnlineAccount();const views=account.save.status==='ready'?await readOnlineViews(account.save.snapshot.revision):null;setOnlineViews(views);setName(account.name);setSave(account.save);return account.save;}
    catch{const unavailable:PlayRead={status:'unavailable'};setSave(unavailable);return unavailable;}
    finally{setOnlineLoading(false);}
  }
  useEffect(()=>{if(online)void refreshOnline();},[online]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [regionalArea, setRegionalArea] = useState(1);
  const [regionalReward,setRegionalReward]=useState<RegionalReward|null>(null);
  const [arenaEncounterId,setArenaEncounterId]=useState<string|null>(null);
  const [expeditionArea, setExpeditionArea] = useState(1);
  const [captureBall,setCaptureBall] = useState<KantoBallId|null>('poke-ball');
  const [name, setName] = useState('');
  const [starter, setStarter] = useState(1);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [evolutionConfirm,setEvolutionConfirm]=useState<{uid:number;from:number;to:number;requirement:string;stone:boolean;revision:number}|null>(null);
  /** Apenas navegação local: não grava no save nem altera o Pokémon ativo. */
  const [pokemonSection,setPokemonSection]=useState<PokemonSection>('profile');
  const [trainerSection,setTrainerSection]=useState<TrainerSection>('profile');
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('recent');
  const [feedback, setFeedback] = useState('');
  const [serverOnline,setServerOnline]=useState<boolean|null>(null);
  const [battlePlayback, setBattlePlayback] = useState<{id:string;seq:number;done:boolean}|null>(null);
  /** Apenas reprodução: não faz parte do save do jogo. */
  const [battleReveal,setBattleReveal]=useState<{key:string;visible:number}|null>(null);
  const settlingBattle=useRef<string|null>(null);
  /** Âncoras estáveis: alterações de save não devem lançar a página ao topo. */
  const battleSceneFocusRef=useRef<HTMLDivElement|null>(null);
  const battleCaptureFocusRef=useRef<HTMLDivElement|null>(null);
  /** Retorno da captura/derrota para a ação que reinicia o encontro. */
  const battleAgainFocusRef=useRef<HTMLButtonElement|null>(null);
  const lastBattleFocusKeyRef=useRef<string|null>(null);
  /** Apenas efeito temporário da subida de nível já confirmada pelo writer. */
  const [levelUpNotice,setLevelUpNotice]=useState<{battleId:string}|null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [monotonicNow,setMonotonicNow]=useState(()=>performance.now());
  const expeditionNow=online?estimatedServerNow(onlineViews?.expeditionClock,monotonicNow):now;
  const viewRevision=save.status==='ready'?save.snapshot.revision:null;
  useEffect(()=>{if(!online)return;if(onlineViews?.region?.encounter){setRegionalArea(onlineViews.region.encounter.regionId);setTab('battle');}else if(onlineViews?.gym?.gym)setTab('gyms');},[online,onlineViews?.region?.encounter?.id,onlineViews?.gym?.gym?.id]);
  useEffect(()=>{
    if(!online||(tab!=='expedition'&&tab!=='overview')||viewRevision===null||busy)return;
    let active=true;
    const timer=window.setInterval(()=>{void readOnlineViews(viewRevision).then(v=>{if(active&&!onlineLock.current)setOnlineViews(v);});},10000);
    return()=>{active=false;window.clearInterval(timer);};
  },[online,tab,viewRevision,busy]);

  useEffect(() => {
    const timer = window.setInterval(() => {setNow(Date.now());setMonotonicNow(performance.now());}, 1000);
    const refresh = (event: StorageEvent) => {
      if (event.key === PLAY_SAVE_KEY || event.key === null) setSave(readSafe());
    };
    if(!online)window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // O LEVEL UP é um efeito breve; não vira um aviso permanente na página.
  useEffect(()=>{
    if(!levelUpNotice)return;
    const timer=window.setTimeout(()=>setLevelUpNotice(current=>
      current?.battleId===levelUpNotice.battleId?null:current),2300);
    return()=>window.clearTimeout(timer);
  },[levelUpNotice?.battleId]);

  /** Status real do endpoint /health, sem confundir com a PokéAPI. */
  useEffect(()=>{
    const controller=new AbortController();
    fetch(online?'/api/v1/status':'/health',{signal:controller.signal,cache:'no-store'})
      .then(response=>setServerOnline(response.ok))
      .catch(()=>{if(!controller.signal.aborted)setServerOnline(false);});
    return ()=>controller.abort();
  },[]);

  /** Preferir Web Lock; sem suporte o modo alfa oferece revisão otimista local. */
  async function transact(callback: () => PlayWrite): Promise<PlayWrite|null> {
    if (online||busy) return null;
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

  // D064BG: no máximo um commit quando a afinidade efetivamente muda
  // (ou quando um save legado ganha sua âncora inicial). Sem cron jobs de
  // servidor; a reavaliação acontece ao abrir o jogo e periodicamente.
  useEffect(()=>{
    if(online||save.status!=='ready'||busy)return;
    const snapshot=save.snapshot;
    let game:Record<string,unknown>;
    try{game=JSON.parse(snapshot.journal.raw) as Record<string,unknown>;}
    catch{return;}
    if(game.pendingBattle||game.gymSession||!Array.isArray(game.roster))return;
    const needsSync=game.roster.some(item=>{
      if(!item||typeof item!=='object')return false;
      const p=item as Record<string,unknown>;
      if(typeof p.affinityLastUsedAt!=='number')return true;
      if(typeof p.affinity!=='number'||p.affinity<=0)return false;
      if(typeof p.affinityIdleDaysApplied!=='number')return true;
      try{return affinityIdlePenaltyDays(p.affinityLastUsedAt,now)>p.affinityIdleDaysApplied;}
      catch{return false;}
    });
    if(!needsSync)return;
    // Não gerar mensagem de erro se outra aba salvar primeiro.
    const run=()=>updatePlaySave(window.localStorage,snapshot.revision,
      {type:'affinity-tick',nowMs:Date.now()});
    void (navigator.locks?.request
      ?navigator.locks.request(PLAY_LOCK_NAME,{mode:'exclusive'},run)
      :Promise.resolve(run())).then(()=>setSave(readSafe())).catch(()=>{});
  },[save.status==='ready'?save.snapshot.revision:-1,Math.floor(now/60000),busy]);

  async function onlineTransaction(action:PlayAction,revision:number):Promise<PlayWrite|null>{
    if(!online||onlineLock.current||save.status!=='ready'||save.snapshot.revision!==revision)return null;
    onlineLock.current=true;setBusy(true);setFeedback('');
    try{
      const ok=await sendOnlineAction(action,save.snapshot);
      const current=await refreshOnline();
      if(ok&&current.status==='ready')return {status:'ok',snapshot:current.snapshot};
      setFeedback('Ação não confirmada ou ainda não integrada. Confira o progresso do servidor.');
      return null;
    }catch{await refreshOnline();setFeedback('Não foi possível confirmar a ação no servidor.');return null;}
    finally{onlineLock.current=false;setBusy(false);}
  }
  async function onlineExtra(path:'inventory/loadout'|'shop/purchase',fields:Record<string,unknown>){
    if(!online||onlineLock.current||save.status!=='ready')return false;
    onlineLock.current=true;setBusy(true);setFeedback('');
    try{const ok=await sendOnlineCommand(path,fields,save.snapshot.revision);await refreshOnline();if(!ok)setFeedback('Ação recusada pelo servidor. Confira o progresso.');return ok;}
    catch{await refreshOnline();setFeedback('Ação não confirmada. Confira o progresso.');return false;}
    finally{onlineLock.current=false;setBusy(false);}
  }
  async function runOnlineBattle(mode:'region'|'gym',command:'open'|'turn'|'reward'|'finish',choice?:string){
    const current=mode==='region'?onlineViews?.region:onlineViews?.gym;
    if(!online||onlineLock.current||save.status!=='ready'||!current||current.revision!==save.snapshot.revision)return false;
    onlineLock.current=true;setBusy(true);setFeedback('');
    try{const result=await onlineBattleCommand(mode,current,command,regionalArea,choice);const refreshed=await refreshOnline();
      // Only a confirmed regional payout may trigger the existing level-up animation.
      if(mode==='region'&&command==='reward'&&'encounter' in current&&current.encounter&&refreshed.status==='ready'){
        const before=current.encounter;
        const parsed=parseLegacySave(refreshed.snapshot.journal.raw);
        if(parsed.status==='valid'){
          const partner=parsed.save.roster.find(p=>p.uid===parsed.save.team[0]);
          if(partner&&Number.isSafeInteger(before.playerLevel)&&partner.level>before.playerLevel)setLevelUpNotice({battleId:before.id});
        }
      }
      if(command==='finish'){if(mode==='region'&&result?.rewardSummary)setRegionalReward(result.rewardSummary);else setFeedback(result?.capture==='captured'?'Pokémon capturado!':result?.capture==='failed'?'A captura falhou.':'Batalha encerrada.');}return true;}
    catch{await refreshOnline();setFeedback('Ação de combate não confirmada. Confira o estado atualizado.');return false;}
    finally{onlineLock.current=false;setBusy(false);}
  }
  function newGame() {
    if(online){
      if(onlineLock.current||save.status!=='absent')return;
      onlineLock.current=true;setBusy(true);
      void startOnline(starter).then(r=>{if(!r.ok&&r.status!==409)setFeedback('A aventura não foi confirmada.');})
        .catch(()=>setFeedback('A aventura não foi confirmada.'))
        .finally(async()=>{await refreshOnline();onlineLock.current=false;setBusy(false);});
      return;
    }
    void transact(() => createPlaySave(window.localStorage, name, starter, Date.now(), demo));
  }

  function dispatch(action: PlayAction): void {
    if (save.status !== 'ready') return;
    const expected = save.snapshot.revision;
    if(online){void onlineTransaction(action,expected);return;}
    void transact(() => updatePlaySave(window.localStorage, expected, action));
  }

  /** D064BQ: id de requisição único + revisão esperada.
   * O writer recalcula o preço, debita moedas e credita bolas em UM receipt.
   */
  async function buyBall(ballId:KantoShopBallId,quantity:number):Promise<void>{
    if(save.status!=='ready'||busy)return;
    const revision=save.snapshot.revision;
    const requestId='shop-v1-'+window.crypto.randomUUID();
    if(online){await onlineTransaction({type:'buy-ball',purchaseId:requestId,ballId,quantity},revision);return;}
    const outcome=await transact(()=>updatePlaySave(window.localStorage,revision,{
      type:'buy-ball',purchaseId:requestId,ballId,quantity
    }));
    if(outcome?.status==='ok'){
      const label=ballId==='poke-ball'?'Poké Ball':ballId==='great-ball'?'Great Ball':'Ultra Ball';
      setFeedback('Compra confirmada: +'+quantity+' '+label+
        (quantity>1?'s':'')+'. Moedas e mochila atualizadas juntas.');
    }
  }

  /** D050: confirmação única para os pontos mostrados na prévia. */
  async function investTrainerBatch(increments:Partial<Record<Stat,number>>,revision:number):Promise<boolean>{
    if(save.status!=='ready'||save.snapshot.revision!==revision)return false;
    if(online)return (await onlineTransaction({type:'trainer-invest-batch',increments},revision))?.status==='ok';
    const outcome=await transact(()=>updatePlaySave(window.localStorage,revision,{
      type:'trainer-invest-batch',increments
    }));
    return outcome?.status==='ok';
  }

  /** D-056: prévia Pokémon confirmada em UMA revisão, sem recompensa nova. */
  async function investPokemonBatch(uid:number,increments:Partial<Record<Stat,number>>,revision:number):Promise<boolean>{
    if(save.status!=='ready'||save.snapshot.revision!==revision)return false;
    if(online)return (await onlineTransaction({type:'pokemon-invest-batch',uid,increments},revision))?.status==='ok';
    const outcome=await transact(()=>updatePlaySave(window.localStorage,revision,{
      type:'pokemon-invest-batch',uid,increments
    }));
    return outcome?.status==='ok';
  }

  /** Browser seguro: sorteia seed uint32, resolução real ocorre no game-core. */
  function fight(regionId:number): void {
    if(online){setFeedback('Combate por turno do servidor ainda em integração nesta prévia.');return;}
    if (busy || (battlePlayback&&!battlePlayback.done) || save.status!=='ready') return;
    const expected=save.snapshot.revision;
    const seed = window.crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed === undefined) {
      setFeedback('Não foi possível sortear o encontro.');
      return;
    }
    setLevelUpNotice(null);
    // D064BE: primeiro registrar somente a batalha pendente; XP, vitória,
    // níveis e bolas permanecem intactos até o fim do diário.
    void transact(()=>updatePlaySave(window.localStorage,expected,
      {type:'start-regional-battle',regionId,seed,nowMs:Date.now()}))
      .then(result=>{
        if(result?.status==='ok'){
          setRegionalArea(regionId);
          setArenaEncounterId('regional-v02-'+result.snapshot.revision);
          setTab('battle');
          setBattlePlayback({id:'regional-v02-'+result.snapshot.revision,seq:(battlePlayback?.seq??0)+1,done:false});
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
    if(online){if(!onlineLock.current)void logoutOnline().catch(()=>setFeedback('Não foi possível encerrar a sessão.'));return;}
    if (!window.confirm('Reiniciar apenas este teste v0.2? O progresso de teste atual será apagado.')) return;
    if (!resetPlaySave(window.localStorage)) {
      setFeedback('Não foi possível apagar o progresso de teste.');
      return;
    }
    setSave(readSafe());
    setBattlePlayback(null);
    setArenaEncounterId(null);
    setLevelUpNotice(null);
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
  const baseView = projected?.status === 'ready' ? projected.value : null;
  const inventory=onlineViews?.inventory;
  const view=online?(baseView&&inventory?{...baseView,totals:inventory.totals}:null):baseView;
  const active = data?.roster.find(p => p.uid === data.team[0]) ?? data?.roster[0];
  // Treinar uma captura NÃO altera o líder da Arena. Cada instância mantém seu UID.
  const focused = data?.roster.find(p => p.uid === selectedUid) ?? active;
  const pokemonManual = manualValues(focused?.manual);
  const pokemonBudget = focused ? legacyPokemonManualBudget(focused.level) : 0;
  // XP exibido é o saldo dentro do nível atual, não o total histórico.
  const pokemonXpMax=focused&&focused.level<100?xpThreshold('pokemon',focused.level):null;
  const pokemonXpCurrent=focused&&pokemonXpMax!==null
    &&typeof focused.xp==='number'&&Number.isSafeInteger(focused.xp)
    ?Math.min(pokemonXpMax,Math.max(0,focused.xp)):0;
  const pokemonXpPercent=pokemonXpMax===null?100:Math.min(100,
    pokemonXpCurrent/pokemonXpMax*100);
  const levelMoves=focused?kantoLevelMoves(focused.pokemonId,focused.level):[];
  const supportMoves=focused?kantoSupportMoves(focused.pokemonId,focused.level):[];
  const currentMoveName=typeof focused?.moveName==='string'?focused.moveName:'';
  const currentMove=KANTO_BATTLE_MOVES[currentMoveName]
    ??KANTO_SUPPORT_MOVES[currentMoveName]??focusedSpeciesFallback(focused?.pokemonId);
  const equippedNames=focused?(online?onlineMoveSlots(focused,currentMove?.name??'tackle'):pokemonMoveSlots(focused,currentMove?.name??'tackle')):[];
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
  const activeSpecies=active?KANTO_BATTLE_SPECIES[active.pokemonId]:null;
  const activeStats=active&&activeSpecies&&view?pokemonFinalStats(activeSpecies.base,active.level,activeManual,view.totals,active.affinity):null;
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
  const expBallProgress=ballGame?.expeditionBallProgress;
  const expProgress=expBallProgress&&typeof expBallProgress==='object'
    ?expBallProgress as Record<'poke-ball'|'great-ball'|'ultra-ball',number>:undefined;
  const expeditionMembers=expedition?.teamUids?.map(uid=>data?.roster.find(p=>p.uid===uid))
    .filter((p):p is NonNullable<typeof p>=>Boolean(p))??[];
  const pending=!online&&expedition?(()=>{
    try{
      return expeditionRewards(Math.max(0,now-expedition.lastClaimAt),
        expedition.regionId&&expeditionMembers.length>0
          ?{regionId:expedition.regionId,
            pokemon:expeditionMembers.map(p=>({
              level:p.level,xp:typeof p.xp==='number'&&Number.isSafeInteger(p.xp)?p.xp:0
            })),
            ...(expProgress?{ballProgress:expProgress}:{})}
          :undefined);
    }catch{
      // Save local malformado não pode derrubar toda a interface.
      // Writer mantém o bloqueio e não concede recompensas incorretas.
      return null;
    }
  })():null;
  // D064BR: a prévia deve refletir as bolas EFETIVAMENTE creditáveis.
  // Encher a mochila nunca cancela moedas/XP da expedição.
  const pendingClaim=pending?.ballDrops&&ballPocket.status==='valid'?{
    ...pending,
    ballDrops:{
      'poke-ball':Math.min(pending.ballDrops['poke-ball'],
        Math.max(0,100000-(ballQuantities['poke-ball']??0))),
      'great-ball':Math.min(pending.ballDrops['great-ball'],
        Math.max(0,100000-(ballQuantities['great-ball']??0))),
      'ultra-ball':Math.min(pending.ballDrops['ultra-ball'],
        Math.max(0,100000-(ballQuantities['ultra-ball']??0)))
    }
  }:pending;
  const pendingStockLimitReached=Boolean(pending?.ballDrops&&pendingClaim?.ballDrops&&(
    pending.ballDrops['poke-ball']>pendingClaim.ballDrops['poke-ball']||
    pending.ballDrops['great-ball']>pendingClaim.ballDrops['great-ball']||
    pending.ballDrops['ultra-ball']>pendingClaim.ballDrops['ultra-ball']
  ));
  const pendingBattle=!online&&ballGame?.pendingBattle && typeof ballGame.pendingBattle==='object'
    ? ballGame.pendingBattle as {battleId:string;preview:unknown}:null;
  // Em um reload, retomar apresentação pendente antes de pagar resultados.
  // O save ainda contém os níveis, XP e estatísticas anteriores ao combate.
  useEffect(()=>{
    if(pendingBattle?.battleId && battlePlayback?.id!==pendingBattle.battleId){
      setTab('battle');
      setArenaEncounterId(pendingBattle.battleId);
      setBattlePlayback({id:pendingBattle.battleId,seq:0,done:false});
    }
  },[pendingBattle?.battleId]);
  const lastBattleRaw = online?null:pendingBattle?.preview??data?.lastBattle;
  const lastBattlePersisted=lastBattleRaw && typeof lastBattleRaw==='object'
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
        captureBallId?:KantoBallId|null;capturedStartingLevel?:number;
        ballDrops?:Readonly<Partial<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>>;
        rewardFactor?:number;
        rewardCoins:number;trainerXp:number;pokemonXp:number;
        playerRemainingHp:number;wildRemainingHp:number
      }
    : null;
  // Entrada vazia: o registro anterior continua salvo, mas não é
  // reaproveitado como adversário antes de iniciar um novo encontro.
  const lastBattle=tab==='battle'&&!pendingBattle
    &&arenaEncounterId!==lastBattlePersisted?.battleId?null:lastBattlePersisted;
  const battleRegion=KANTO_REGIONS.find(region=>region.id===(online?regionalArea:lastBattle?.regionId))
    ??KANTO_REGIONS.find(region=>region.id===regionalArea)??KANTO_REGIONS[0]!;
  const displayedBattleId=lastBattle?.battleId??'legacy-battle';
  const battlePlaying=Boolean(pendingBattle)||Boolean(battlePlayback && !battlePlayback.done && battlePlayback.id===displayedBattleId);
  // Só reposiciona a página em transições REAIS de combate/captura/tab.
  // As dezenas de atualizações do replay e o cronômetro não roubam scroll.
  const battleFocusKey=tab==='battle'?[
    arenaEncounterId??'',displayedBattleId,pendingBattle?.battleId??'',
    lastBattle?.captureStatus??'',battlePlaying?'playing':'settled'
  ].join(':'):null;
  useLayoutEffect(()=>{
    if(!battleFocusKey){lastBattleFocusKeyRef.current=null;return;}
    if(lastBattleFocusKeyRef.current===battleFocusKey)return;
    // Estados do fluxo:
    // 1. Encontro iniciado: palco; 2. Vitória pendente: captura;
    // 3. Capturou/falhou/pulou ou perdeu/empatou: botão do próximo combate.
    const capturePending=!battlePlaying&&lastBattle?.captureStatus==='available';
    const concluded=!battlePlaying&&Boolean(lastBattle)&&!capturePending;
    const target=capturePending?battleCaptureFocusRef.current
      :concluded?battleAgainFocusRef.current:battleSceneFocusRef.current;
    // O botão fica temporariamente disabled enquanto a transação grava.
    // Não registrar o foco até ele estar novamente utilizável.
    if(!target||('disabled' in target&&target.disabled)||busy)return;
    lastBattleFocusKeyRef.current=battleFocusKey;
    target.focus({preventScroll:true});
    target.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
  },[battleFocusKey,busy,battlePlaying,lastBattle?.captureStatus]);
  const activeRecord=pokemonBattleRecord(active);
  async function finishPlayback():Promise<void>{
    if(online)return;
    if(!pendingBattle||settlingBattle.current===pendingBattle.battleId){
      if(!pendingBattle)setBattlePlayback(previous=>previous?{...previous,done:true}:null);
      return;
    }
    settlingBattle.current=pendingBattle.battleId;
    const current=readSafe();
    if(current.status==='ready'){
      const initialLevel=lastBattle?.playerLevel;
      const initialUid=active?.uid;
      const result=await transact(()=>updatePlaySave(window.localStorage,
        current.snapshot.revision,{type:'finish-regional-battle',
          battleId:pendingBattle.battleId}));
      if(result?.status==='ok'){
        // O anúncio existe apenas no primeiro settlement, nunca em replay.
        try{
          const final=JSON.parse(result.snapshot.journal.raw) as {
            roster?:{uid:number;level:number;pokemonId:number}[]
          };
          const currentPokemon=final.roster?.find(p=>p.uid===initialUid);
          if(currentPokemon&&typeof initialLevel==='number'
            &&currentPokemon.level>initialLevel)
            setLevelUpNotice({battleId:pendingBattle.battleId});
        }catch{/* nenhuma animação inventada para save inesperado */}
        setBattlePlayback(previous=>previous?{...previous,done:true}:null);
      }
    }
    settlingBattle.current=null;
  }
  function captureAfterBattle(ballId:KantoBallId|null):void{
    if(save.status!=='ready'||!lastBattle?.battleId||battlePlaying)return;
    dispatch(ballId?{type:'capture-after-battle',battleId:lastBattle.battleId,ballId,nowMs:Date.now()}
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

  if (save.status !== 'ready') {
    return (
      <main className={styles.setupShell} data-testid="play-root">
        <header className={styles.brand}><PokeballSymbol className={styles.brandBall}/>KANTO <strong>IDLE</strong><span className={styles.alpha}>v0.2 ALPHA</span></header>
        <section className={styles.welcome}>
          <div className={styles.kicker}>UMA NOVA JORNADA EM KANTO</div>
          <h1>O começo da sua aventura.</h1>
          <p>Escolha seu parceiro, treine seus atributos e envie Pokémon em expedições para evoluir mesmo enquanto explora outras telas.</p>
          {onlineLoading?<p role="status">Carregando seu progresso online…</p>:save.status === 'absent' ? (
            <div className={styles.form}>
              <label className={styles.label} htmlFor="trainer-name">Nome do treinador</label>
              <input
                id="trainer-name" className={styles.input} maxLength={24}
                value={name} readOnly={online} onChange={event => setName(event.target.value)}
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
              {!online&&<label className={styles.demoToggle}>
                <input type="checkbox" checked={demo} onChange={event => setDemo(event.target.checked)} />
                Começar no modo demonstração (níveis e pontos para testar)
              </label>}
              <button className={styles.primary} type="button" disabled={busy || name.trim().length < 2}
                onClick={newGame}>Começar aventura</button>
            </div>
          ) : (
            <div className={styles.form} role="alert">
              <h2>{online?'Não foi possível carregar o progresso online':'O progresso local precisa de atenção'}</h2>
              <p>O armazenamento está {save.status === 'invalid' ? 'incompatível' : 'indisponível'}. Nenhum dado foi apagado automaticamente.</p>
              <button type="button" className={styles.secondary} onClick={() => online?void refreshOnline():setSave(readSafe())}>Tentar novamente</button>
              {!online&&save.status === 'invalid' && <button type="button" className={styles.secondary} onClick={restart}>Reiniciar teste v0.2</button>}
            </div>
          )}
          {feedback && <p role="status" className={styles.message}>{feedback}</p>}
          <p className={styles.disclaimer}>{online?'Prévia Alpha online: progresso salvo no servidor.':'Versão alfa de testes: progresso salvo apenas neste navegador, sem contas ou sincronização. Regras e dados de teste poderão ser reiniciados antes do lançamento.'}</p>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.appShell} data-testid="play-root" data-motion="full" data-theme="kanto-adventure">
      <aside className={styles.sidebar}>
        <div className={styles.brand}><PokeballSymbol className={styles.brandBall}/>KANTO <strong>IDLE</strong><span className={styles.alpha}>ALPHA</span></div>
        <div className={styles.sidebarCaption}>SUA JORNADA</div>
        {online?<OnlineNavigation tab={tab} trainerSection={trainerSection} pokemonSection={pokemonSection}
          disabled={item=>item==='gyms'&&!onlineViews?.gym||item==='trainer'&&!inventory||item==='shop'&&!onlineViews?.shop||item==='expedition'&&!onlineViews?.expedition}
          onNavigate={item=>{if(onlineViews?.region?.encounter){setTab('battle');return;}if(onlineViews?.gym?.gym){setTab('gyms');return;}if(item.tab==='trainer')setTrainerSection(item.trainerSection??'profile');if(item.tab==='pokemon')setPokemonSection(item.pokemonSection??'profile');setTab(item.tab);setFeedback('');setBattlePlayback(null);}}/>:<nav className={styles.menu} aria-label="Navegação do jogo">
          {(['overview','trainer','pokemon','collection','pokedex','regions','gyms','expedition','shop'] as Tab[]).map(item => (
            <button type="button" key={item} disabled={online&&(item==='gyms'&&!onlineViews?.gym||item==='trainer'&&!inventory||item==='shop'&&!onlineViews?.shop||item==='expedition'&&!onlineViews?.expedition)} aria-current={tab === item ? 'page' : undefined}
              className={tab === item ? styles.menuActive : styles.menuItem}
              onClick={() => { if(online&&onlineViews?.region?.encounter){setTab('battle');return;} if(online&&onlineViews?.gym?.gym){setTab('gyms');return;} if(pendingBattle){setTab('battle');setFeedback('Conclua o combate em andamento antes de navegar.');return;} if(ballGame?.gymSession&&item!=='gyms'){setTab('gyms');setFeedback('Finalize ou abandone o Ginásio antes de sair.');return;} if(item==='pokemon')setPokemonSection('profile'); setTab(item); setFeedback(''); if(item!=='battle')setBattlePlayback(null); }}><i className={'fa-solid '+NAV_ICONS[item]} aria-hidden="true"/>{sectionName(item)}</button>
          ))}
        </nav>}
        <div className={styles.sidebarFooter}>
          <p>Pré-lançamento v0.2</p>
          <p>{online?'Progresso online':'Progresso local'} · {save.snapshot.revision} alterações</p>
          <button type="button" className={styles.resetButton} onClick={restart}>{online?'Sair da conta':'Reiniciar teste'}</button>
        </div>
      </aside>
      <div className={styles.content}>
        {online?<>
          <AdventureTopbar online={serverOnline} level={view?.level??'?'} name={view?.name??data?.name??'Treinador'} coins={data?.coins??0} now={now} busy={busy} onLogout={restart}/>
          {tab!=='overview'&&<div className={styles.onlinePageHeading}>
            <div className={styles.kicker}>REGIÃO DE KANTO · SEASON 1</div>
            <h1>{tab==='battle'?battleRegion.name:tab==='trainer'?({profile:'Meu perfil',equipment:'Equipamentos',bag:'Mochila'}[trainerSection]):tab==='pokemon'?({profile:'Perfil do Pokémon',evolution:'Evolução',moves:'Golpes'}[pokemonSection]):sectionName(tab)}</h1>
          </div>}
        </>:<header className={styles.topbar}>
          <div>
            <div className={styles.kicker}>REGIÃO DE KANTO · SEASON 1</div>
            <h1>{tab==='battle'?battleRegion.name:sectionName(tab)}</h1>
          </div>
          <div className={styles.trainerChip}><span className={serverOnline===true?styles.serverOnline:styles.serverOffline} role="status">{serverOnline===null?'Verificando servidor':serverOnline?'● Servidor Online':'● Servidor indisponível'}</span><span className={styles.avatar}>★</span>
            <span><strong>{view?.name ?? data?.name}</strong><small>Nível {view?.level ?? '?'}</small></span>
            <span className={styles.coins}>◈ {data?.coins ?? 0}</span>
          </div>
        </header>}
        {online&&(!onlineViews?.inventory||!onlineViews?.shop||!onlineViews?.expedition||!onlineViews?.region||!onlineViews?.gym)&&<p className={styles.disclaimer} role="status">Alguns dados do servidor estão indisponíveis. <button className={styles.secondary} disabled={busy} onClick={()=>void refreshOnline()}>Atualizar progresso</button></p>}
        {feedback && <div role="status" aria-live="polite" className={styles.message}>{feedback}</div>}
        {!view || !data || !active || !focused ? (
          <section className={styles.panel}>{online?'O progresso online não pôde ser carregado.':'O perfil de teste não pôde ser projetado.'} Nenhum dado foi modificado.</section>
        ) : (
          <>
            {tab==='overview'&&online&&<AdventureOverview view={view} speciesCount={caughtSpeciesCount} individualCount={data.roster.length}
              leader={{id:active.pokemonId,name:speciesName(active.pokemonId),level:active.level,affinity:active.affinity,types:kantoSpecies(active.pokemonId)?.types??[],stats:activeStats,art:<PokemonArt id={active.pokemonId} name={speciesName(active.pokemonId)} large/>}}
              expedition={onlineViews?.expedition?.expedition?{startedAt:onlineViews.expedition.expedition.startedAt,regionName:expeditionRegion?.name??'Kanto',cycles:onlineViews.expedition.expedition.preview?.cycles??0}:null}
              serverNow={expeditionNow} expeditionAvailable={!!onlineViews?.expedition} busy={busy||!!onlineViews?.expedition?.busy} pendingLoot={!!onlineViews?.expedition?.pendingLoot}
              onTrain={()=>openPokemon(active.uid)} onExpedition={()=>setTab('expedition')}
              onClaim={()=>{if(onlineViews?.expedition?.pendingLoot||!onlineViews?.expedition?.expedition?.preview?.cycles||expeditionNow===null)return;dispatch({type:'claim-expedition',nowMs:Date.now()});}}
              onStop={()=>{if(onlineViews?.expedition?.expedition&&expeditionNow!==null)dispatch({type:'stop-expedition',nowMs:Date.now()});}}/>}
            {tab === 'overview' && !online && (
              <>
                <section className={styles.hero}>
                  <div>
                    <div className={styles.kicker}>TREINADOR EM JORNADA</div>
                    <h2>Bem-vindo de volta, {view.name}!</h2>
                    <p>Seu parceiro está pronto. Continue sua jornada, distribua pontos e receba recompensas idle.</p>
                    <div className={styles.heroActions}>
                      <button type="button" className={styles.primary} disabled={online&&!onlineViews?.expedition} onClick={() => setTab('expedition')}>
                        {expedition ? 'Ver expedição ativa' : 'Iniciar expedição'}</button>
                      <button type="button" className={styles.secondary} disabled={online&&!inventory} onClick={() => {setTrainerSection('profile');setTab('trainer');}}>Meu treinador</button>
                      <button type="button" className={styles.secondary} onClick={() => setTab('regions')}>Explorar regiões</button>
                      <button type="button" className={styles.secondary} onClick={() => setTab('pokedex')}>Abrir Pokédex</button>
                    </div>
                  </div>
                  <PokemonArt id={active.pokemonId} name={view.active.name} large />
                </section>
                <div className={styles.metrics}>
                  <article className={styles.metric} data-tone="trainer"><small><i className="fa-solid fa-user" aria-hidden="true"/> Treinador</small><strong>Lv. {view.level}</strong><span>{view.xpNext === null ? 'Nível máximo' : view.xp + ' / ' + view.xpNext + ' XP'}</span></article>
                  <article className={styles.metric} data-tone="pokemon"><small><i className="fa-solid fa-dragon" aria-hidden="true"/> Parceiro</small><strong>Lv. {active.level}</strong><span>{view.active.name}</span></article>
                  <article className={styles.metric} data-tone="gold"><small><i className="fa-solid fa-coins" aria-hidden="true"/> Moedas</small><strong>{data.coins}</strong><span>Saldo da jornada</span></article>
                  <article className={styles.metric} data-tone="collection"><small><i className="fa-solid fa-book-open" aria-hidden="true"/> Pokédex de Kanto</small><strong>{caughtSpeciesCount}/151</strong><span>{data.roster.length} indivíduos · {view.seenSpecies} vistos</span></article>
                </div>
                <div className={styles.twoColumn}>
                  <section className={styles.panel} data-tone="pokemon">
                    <h2><PokeballSymbol/> Seu parceiro</h2>
                    <div className={styles.partner}>
                      <PokemonArt id={active.pokemonId} name={view.active.name} />
                      <div><strong>{view.active.name}</strong><p>UID #{active.uid} · Afinidade {active.affinity}%</p>
                      <p>{activeRemaining} pontos de treinamento disponíveis</p>
                      <button type="button" className={styles.textButton}
                        onClick={() => openPokemon(active.uid)}>Treinar Pokémon</button></div>
                    </div>
                  </section>
                  <section className={styles.panel} data-tone="collection">
                    <h2><i className="fa-solid fa-layer-group" aria-hidden="true"/> Coleção e equipe</h2>
                    <p>{data.roster.length} Pokémon capturado(s) · {data.team.length}/3 na equipe</p>
                    <p>Organize seus parceiros e escolha quem lidera as batalhas nas regiões.</p>
                    <button type="button" className={styles.secondary} onClick={() => setTab('collection')}>Abrir coleção</button>
                  </section>
                  <section className={styles.panel} data-tone="expedition">
                    <h2><i className="fa-solid fa-mountain" aria-hidden="true"/> Expedição idle</h2>
                    <p>{expedition
                      ? 'Explorando Kanto · ' + ((online?onlineViews?.expedition?.expedition?.preview?.cycles:pending?.cycles) ?? 0) + ' ciclos disponíveis para resgate'
                      : 'Envie seu parceiro em expedição para receber moedas e XP.'}</p>
                    <button type="button" className={styles.secondary} disabled={online&&!onlineViews?.expedition} onClick={() => setTab('expedition')}>Abrir expedição</button>
                  </section>
                </div>
              </>
            )}
            {tab === 'trainer' && <TrainerScreen view={view} data={data} {...(online?{controlledSection:trainerSection}:{})}
              revision={save.snapshot.revision} busy={busy||!!inventory?.busy}
              {...(inventory?{onlineInventory:inventory,onDiscardGear:(id:string)=>void onlineExtra('inventory/loadout',{command:{kind:'discard-gear',itemId:id}}),onLoot:(command:Record<string,unknown>)=>void onlineExtra('inventory/loadout',{command}),lootBusy:busy}:{})}
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
                {!online&&<nav className={styles.pokemonQuickNav} aria-label="Seções do Pokémon">
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
                </nav>}
                <div className={styles.pokemonGrid+(pokemonSection==='profile'?' '+styles.pokemonProfileGrid:'')}>
                {pokemonSection==='profile'&&<>
                <section className={styles.pokemonHero}>
                  <div className={styles.pokemonShowcase}>
                    <div className={styles.pokemonArtStage}>
                      <PokeballSymbol className={styles.pokemonArtHalo}/>
                      <PokemonArt id={focused.pokemonId} name={speciesName(focused.pokemonId)} large />
                      <span className={styles.pokemonArtRing} aria-hidden="true"/>
                    </div>
                    <div className={styles.pokemonIdentity}>
                      <span className={styles.pokemonSpeciesNumber}># {String(focused.pokemonId).padStart(3,'0')} · UID {focused.uid}</span>
                      <h2>{speciesName(focused.pokemonId)}</h2>
                      <div className={styles.pokemonExperience} data-testid="pokemon-xp">
                        <div className={styles.pokemonExperienceHeader}>
                          <strong><i className="fa-solid fa-bolt" aria-hidden="true"/> EXP · Nível {focused.level}</strong>
                          <span>{pokemonXpMax===null?'Nível máximo':
                            pokemonXpCurrent+' / '+pokemonXpMax+' XP'}</span>
                        </div>
                        <div className={styles.pokemonExperienceTrack} role="progressbar"
                          aria-label={'Experiência do Pokémon UID '+focused.uid}
                          aria-valuemin={0} aria-valuemax={pokemonXpMax??1}
                          aria-valuenow={pokemonXpMax===null?1:pokemonXpCurrent}>
                          <span style={{width:pokemonXpPercent+'%'}}/>
                        </div>
                        <small>{pokemonXpMax===null?'Seu Pokémon alcançou o nível 100.':
                          'Faltam '+(pokemonXpMax-pokemonXpCurrent)+' XP para o nível '+(focused.level+1)+'.'}</small>
                      </div>
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
                        <small>Vitórias aumentam a afinidade; derrotas reduzem 3 pontos e empates reduzem 1. Após 48h sem batalhar, diminui 1 ponto por dia até zero.</small>
                        <small data-testid="pokemon-affinity-next-loss">
                          <i className="fa-regular fa-clock" aria-hidden="true"/>{' '}
                          {focused.affinity<=0
                            ?'Afinidade mínima alcançada. Vença batalhas para recuperar o vínculo.'
                            :typeof focused.affinityLastUsedAt==='number'
                              &&Number.isSafeInteger(focused.affinityLastUsedAt)
                              ?'Próxima redução por inatividade em '
                                +formatExpeditionDuration(timeUntilAffinityLoss(
                                  focused.affinityLastUsedAt,now,
                                  typeof focused.affinityIdleDaysApplied==='number'
                                    ?focused.affinityIdleDaysApplied:0))
                              :'Tempo de inatividade será contado a partir da primeira sincronização.'}
                        </small>
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
                              onClick={()=>setEvolutionConfirm({uid:focused.uid,from:focused.pokemonId,to:rule.to,requirement,stone:rule.trigger==='stone',revision:save.snapshot.revision})}>Evoluir</button>
                          </div>;
                        })}
                      </div>}

                </section>
                {evolutionConfirm&&<RegionDialog title="Confirmar evolução" size="compact" onClose={()=>setEvolutionConfirm(null)}>
                  <div className={styles.evolutionConfirmScene}>
                    <div><PokemonArt id={evolutionConfirm.from} name={speciesName(evolutionConfirm.from)} large/><strong>{speciesName(evolutionConfirm.from)}</strong></div>
                    <i className="fa-solid fa-arrow-right" aria-hidden="true"/>
                    <div><PokemonArt id={evolutionConfirm.to} name={speciesName(evolutionConfirm.to)} large/><strong>{speciesName(evolutionConfirm.to)}</strong></div>
                  </div>
                  <p>Confirme a evolução deste Pokémon. A espécie será alterada permanentemente.</p>
                  <p className={styles.evolutionConfirmRequirement}><i className={'fa-solid '+(evolutionConfirm.stone?'fa-gem':'fa-dna')} aria-hidden="true"/> {evolutionConfirm.stone?'Será consumida: ':'Requisito: '}{evolutionConfirm.requirement}</p>
                  {evolutionConfirm.revision!==save.snapshot.revision&&<p role="status">O progresso mudou. Feche e confirme novamente.</p>}
                  <div className={styles.evolutionConfirmActions}>
                    <button type="button" className={styles.secondary} onClick={()=>setEvolutionConfirm(null)}>Cancelar</button>
                    <button type="button" className={styles.primary} disabled={busy||Boolean(expedition)||evolutionConfirm.revision!==save.snapshot.revision||focused.uid!==evolutionConfirm.uid||focused.pokemonId!==evolutionConfirm.from||!!onlineViews?.region?.encounter||!!onlineViews?.gym?.gym} onClick={()=>{
                      const choice=evolutionConfirm;setEvolutionConfirm(null);
                      dispatch({type:'evolution',uid:choice.uid,targetSpeciesId:choice.to});
                    }}><i className="fa-solid fa-dna" aria-hidden="true"/> Confirmar evolução</button>
                  </div>
                </RegionDialog>}
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
                <section className={styles.panel+' '+styles.collectionAllPanel}>
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
                  <div className={styles.collectionGrid+' '+styles.collectionScroll} tabIndex={0} aria-label="Lista de todos os Pokémon">
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
              <RegionsScreen online={online}
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
                onEnterRegion={regionId=>{
                  if(online){setRegionalArea(regionId);setTab('battle');return;}
                  if(busy||pendingBattle)return;
                  if(lastBattlePersisted?.captureStatus==='available'){
                    setFeedback('Resolva a captura pendente antes de entrar em outra região.');
                    setArenaEncounterId(lastBattlePersisted.battleId??null);
                    setRegionalArea(lastBattlePersisted.regionId??regionId);
                    setBattlePlayback(null);
                    setTab('battle');
                    return;
                  }
                  setRegionalArea(regionId);
                  setArenaEncounterId(null);
                  setLevelUpNotice(null);
                  setBattlePlayback(null);
                  setTab('battle');
                 }}
                onOpenTeam={()=>setTab('collection')}
                lastBattleRegionId={lastBattle?.regionId}
                onReplayBattle={()=>{
                  if(lastBattlePersisted?.battleId)setArenaEncounterId(lastBattlePersisted.battleId);
                  setBattlePlayback(null);setTab('battle');
                }}
              />
            )}

            {tab==='battle'&&online&&<OnlineBattle mode="region" region={onlineViews?.region??null} gym={onlineViews?.gym??null} data={data} regionId={regionalArea} regionName={KANTO_REGIONS.find(r=>r.id===regionalArea)?.name??battleRegion.name} reward={regionalReward} levelUpEncounterId={levelUpNotice?.battleId??null} onDismissReward={()=>setRegionalReward(null)} busy={busy} blocked={!!onlineViews?.gym?.gym||!!expedition} onCommand={(command,choice)=>runOnlineBattle('region',command,choice)} onBack={()=>setTab('regions')}/>}
            {tab === 'battle' && !online && (
              <>
                <section className={styles.battleIntro}>
                  <div>
                    <button type="button" className={styles.secondary}
                      onClick={()=>{if(pendingBattle){setFeedback('Conclua o combate antes de sair.');return;}setBattlePlayback(null);setTab('regions');}}>
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
                      <button type="button" className={styles.secondary} disabled={Boolean(pendingBattle)}
                        onClick={()=>setTab('collection')}>
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
                        disabled={Boolean(pendingBattle)||lastBattle?.captureStatus==='available'}
                        value={regionalArea} onChange={event=>{
                          setRegionalArea(Number(event.target.value));
                          setArenaEncounterId(null);
                          setBattlePlayback(null);
                        }}
                        className={styles.arenaStyledSelect}>
                        {KANTO_REGIONS.map(region=><option key={region.id} value={region.id}
                          disabled={view.level<region.trainerUnlockLevel}>
                          {region.id}. {region.name} · Treinador Lv. {region.trainerUnlockLevel}
                        </option>)}
                      </select>
                      <p className={styles.arenaSelectLabel}><i className="fa-solid fa-baseball" aria-hidden="true"/> Captura disponível depois da vitória</p>
                      <p className={styles.arenaCaptureHint}>Conheça o adversário no combate e escolha uma Pokébola apenas se vencer. Uma tentativa por encontro.</p>
                      <button className={styles.primary} type="button"
                        ref={battleAgainFocusRef} data-testid="battle-again-button"
                        disabled={online||busy||battlePlaying||Boolean(pendingBattle)
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
                  <div className={styles.battleArenaColumn}>
                  <BattleStage
                    stageRef={battleSceneFocusRef}
                    levelUp={Boolean(levelUpNotice?.battleId===displayedBattleId&&!battlePlaying)}
                    player={{
                      name:lastBattle?.playerName??view.active.name,
                      level:battlePlaying?(lastBattle?.playerLevel??active.level):active.level,
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
                  {!lastBattle&&<div className={styles.arenaWaiting} role="status">
                    <i className="fa-solid fa-question" aria-hidden="true"/>
                    <strong>Quem aparecerá nesta região?</strong>
                    <span>Use o botão Batalhar na região para encontrar um Pokémon selvagem.</span>
                  </div>}
                  {!battlePlaying&&lastBattle&&['available','caught','escaped','skipped'].includes(lastBattle.captureStatus??'')&&
                    <div className={styles.battleCapturePlacement} ref={battleCaptureFocusRef}
                      tabIndex={-1} role="region" aria-label="Área de captura"
                      data-testid="battle-capture-area">
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
                            onClick={()=>captureAfterBattle(captureBall)}>{captureBall&&<PokeballArt id={captureBall}/>}
                            <i className="fa-solid fa-bullseye" aria-hidden="true"/> Tentar capturar (1 tentativa)
                          </button>
                          <button type="button" className={styles.secondary}
                            disabled={busy} onClick={()=>captureAfterBattle(null)}>
                            Seguir sem capturar
                          </button>
                        </div>
                      ) : <p>{lastBattle.captured
                        ? 'Captura realizada! O Pokémon entrou na coleção no nível '
                          +(lastBattle.capturedStartingLevel??'inicial')+'.'
                        :lastBattle.captureStatus==='escaped'?'O Pokémon escapou da tentativa.'
                        :lastBattle.captureStatus==='skipped'?'Você decidiu não tentar capturar.'
                        :'Nenhuma captura nesta batalha.'}</p>}

                    </div>}
                  </div>
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
                      {lastBattle.outcome!=='win'&&
                        <p className={styles.affinityLossNotice} role="status">
                          <i className="fa-solid fa-heart-crack" aria-hidden="true"/>
                          Afinidade do Pokémon: {lastBattle.outcome==='draw'?'−1':'−3'} ponto(s) neste combate.
                        </p>}
                      {lastBattle.rewardFactor===0&&
                        <p role="status" className={styles.affinityLossNotice}>
                          Este Pokémon está muito acima do nível da região.
                          O encontro não concede XP, moedas, afinidade ou progresso no histórico.
                          Explore uma região mais avançada.
                        </p>}
                      {lastBattle.outcome === 'win' && (
                        <div className={styles.battleRewards} aria-label="Recompensas recebidas">
                          <div><small>Moedas</small><strong>+{lastBattle.rewardCoins}</strong></div>
                          <div><small>XP treinador</small><strong>+{lastBattle.trainerXp}</strong></div>
                          <div><small>XP Pokémon</small><strong>+{lastBattle.pokemonXp}</strong></div>
                          <div><small>Afinidade</small><strong>+{lastBattle.affinityGain}</strong></div>
                          <div data-testid="battle-ball-drop"><small>Drop aleatório</small>
                            <strong>{(['poke-ball','great-ball','ultra-ball'] as const)
                              .filter(id=>(lastBattle.ballDrops?.[id]??0)>0)
                              .map(id=>id==='poke-ball'?'Poké Ball':id==='great-ball'?'Great Ball':'Ultra Ball')
                              .join(', ')||'Nenhum nesta vitória'}</strong>
                          </div>
                        </div>
                      )}
                      <button type="button" className={styles.secondary}
                        onClick={()=>{setLevelUpNotice(null);setBattlePlayback({id:displayedBattleId,seq:(battlePlayback?.seq??0)+1,done:false});}}>
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
            {tab==='gyms'&&online&&<OnlineBattle mode="gym" region={onlineViews?.region??null} gym={onlineViews?.gym??null} data={data} regionId={regionalArea} regionName={battleRegion.name} busy={busy} blocked={!!onlineViews?.region?.encounter||!!expedition||!!inventory?.pending||!!inventory?.expeditionPending} onCommand={(command,choice)=>runOnlineBattle('gym',command,choice)} onBack={()=>setTab('collection')}/>}
            {tab === 'gyms' && !online && <GymScreen game={ballGame??{}} data={data}
              busy={busy} revision={save.snapshot.revision} onAction={dispatch}
              onOpenCollection={()=>setTab('collection')}/>}
            {tab === 'shop' && <BallShopPreview coins={data.coins}
              trainerLevel={view.level} quantities={ballQuantities}
              busy={busy||(online&&!onlineViews?.shop)||!!onlineViews?.shop?.busy} onBuy={(ballId,quantity)=>void buyBall(ballId,quantity)}
              {...(onlineViews?.shop?{onlineShop:onlineViews.shop,onCheckout:(items:readonly {itemId:string;quantity:number}[])=>onlineExtra('shop/purchase',{items})}:{})}/>} 
            {tab === 'expedition' && (
              <ExpeditionScreen
                expedition={expedition??null}
                regionName={expeditionRegion?.name??'Expedição antiga'}
                options={expeditionOptions.map(({region,unlocked})=>({
                  id:region.id,name:region.name,trainerUnlockLevel:region.trainerUnlockLevel,
                  levelMin:region.levelMin,levelMax:region.levelMax,unlocked
                }))}
                selectedRegionId={expeditionArea}
                onSelectRegion={setExpeditionArea}
                leaderName={view.active.name}
                leaderLevel={active.level}
                leaderArt={<PokemonArt id={active.pokemonId} name={view.active.name} />}
                pending={online?(onlineViews?.expedition?.expedition?.preview?{cycles:onlineViews.expedition.expedition.preview.cycles,coins:onlineViews.expedition.expedition.preview.coins,trainerXp:onlineViews.expedition.expedition.preview.trainerXP,pokemonXpPerMember:onlineViews.expedition.expedition.preview.pokemonXP,ballDrops:{'poke-ball':onlineViews.expedition.expedition.preview.ballDrops?.['poke-ball']??0,'great-ball':onlineViews.expedition.expedition.preview.ballDrops?.['great-ball']??0,'ultra-ball':onlineViews.expedition.expedition.preview.ballDrops?.['ultra-ball']??0}}:null):pendingClaim??null}
                ballStockCapped={pendingStockLimitReached}
                ballProgress={expProgress}
                activePokemonLevel={expeditionMembers[0]?.level??active.level}
                nowMs={expeditionNow??expedition?.lastClaimAt??0}
                serverControlled={online}
                clockAvailable={expeditionNow!==null}
                busy={busy||!!onlineViews?.expedition?.busy||online&&(!onlineViews?.expedition||expeditionNow===null)}
                onStart={()=>{if(online&&(inventory?.pending||inventory?.expeditionPending)){setFeedback('Resolva os itens pendentes na mochila.');return;}dispatch({type:'start-expedition',regionId:expeditionArea,nowMs:Date.now()});}}
                onClaim={()=>{if(onlineViews?.expedition?.pendingLoot){setFeedback('Resolva os itens pendentes na mochila antes de resgatar novamente.');return;}dispatch({type:'claim-expedition',nowMs:Date.now()});}}
                onStop={()=>dispatch({type:'stop-expedition',nowMs:Date.now()})}
              />
            )}
          </>
        )}
        <footer className={styles.footer}>Poke Idle Game · Alfa pré-lançamento · Pokémon e marcas pertencem aos seus titulares. {online?'Progresso salvo no servidor.':'Sem conta ou progresso em nuvem.'}</footer>
      </div>
    </div>
  );
}
