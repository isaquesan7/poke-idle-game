/**
 * Save LOCAL do primeiro loop jogável v0.2.
 *
 * Não há contas ou backend. Este formato versionado é independente de v0.1
 * e pode ser reiniciado durante o desenvolvimento pré-lançamento, conforme
 * decisão D-027. Mantém JSON de domínio compatível com os reducers puros.
 * Web Locks são solicitados pelo controlador React, não pelo game-core.
 */
import {
  applyRewardEvent, editLegacyTrainerJson, prepareRewardJournal,
  reduceLegacyPokemonTeamJson, zeroStats, LEGACY_STARTERS,
  KANTO_BATTLE_SPECIES, KANTO_BATTLE_MOVES, KANTO_WILD_POOL,
  LEGACY_ITEMS, LEGACY_BADGES, STATS, trainerTotals, pokemonFinalStats,
  pokemonOwnStats, effectiveLegacyTitle, simulateKantoBattle,
  reduceLegacyPokemonMoveJson, kantoLevelMoves,kantoWildMoveLoadout,reduceKantoEvolutionJson,
  KANTO_SUPPORT_MOVES,pokemonMoveSlots,reducePokemonMoveSlotsJson,
  kantoRegion,kantoRegionalEncounter,kantoRegionCatalogInvariant,
  inspectKantoBallPocket,resolveKantoCaptureAttempt,d064DraftBallDrop,
  D064_DRAFT_STARTER_BALLS,battleTrainerXp,beginnerBattleXp,kantoCaptureStartingLevel
} from '@kanto/game-core';
import type {
  LegacyPokemonTeamAction, RewardJournal, RewardCommand, TrainerDraftAction, StatValues, Combatant,
  KantoBallId, KantoBallPocketV1
} from '@kanto/game-core';

export const PLAY_SAVE_KEY = 'kanto-idle-play-v02';
export const PLAY_LOCK_NAME = 'kanto-idle-play-v02-writer';

export interface PlaySnapshot {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly journal: RewardJournal;
}
export type PlayRead =
  | { readonly status: 'ready'; readonly snapshot: PlaySnapshot }
  | { readonly status: 'absent' | 'invalid' | 'unavailable' };

export type PlayAction =
  | { readonly type: 'trainer'; readonly value: TrainerDraftAction }
  | { readonly type: 'pokemon'; readonly value: LegacyPokemonTeamAction }
  | { readonly type: 'trainer-invest-batch'; readonly increments: Readonly<Partial<Record<keyof StatValues, number>>> }
  | { readonly type: 'pokemon-invest-batch'; readonly uid:number; readonly increments: Readonly<Partial<Record<keyof StatValues,number>>> }
  | { readonly type: 'battle'; readonly seed: number }
  | { readonly type: 'regional-battle'; readonly seed:number; readonly regionId:number; readonly ballId?:KantoBallId|null }
  | { readonly type:'start-regional-battle'; readonly seed:number; readonly regionId:number }
  | { readonly type:'finish-regional-battle'; readonly battleId:string }
  | { readonly type:'capture-after-battle'; readonly battleId:string; readonly ballId:KantoBallId }
  | { readonly type:'skip-capture'; readonly battleId:string }
  | { readonly type: 'evolution'; readonly uid:number; readonly targetSpeciesId:number }
  | { readonly type: 'evolution-test-kit' }
  | { readonly type: 'move'; readonly uid:number; readonly moveName:string;
      readonly operation:'select'|'upgrade' }
  | { readonly type:'move-set'; readonly uid:number; readonly moveName:string;
      readonly operation:'add'|'remove'|'primary' }
  | { readonly type: 'start-expedition'; readonly nowMs: number; readonly regionId: number }
  | { readonly type: 'claim-expedition' | 'stop-expedition'; readonly nowMs: number };

export type PlayWrite =
  | { readonly status: 'ok'; readonly snapshot: PlaySnapshot }
  | { readonly status: 'blocked'; readonly reason: string };

export interface PlayStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const goodNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function readPlaySave(storage: Pick<PlayStorage, 'getItem'>): PlayRead {
  let raw: string | null;
  try { raw = storage.getItem(PLAY_SAVE_KEY); }
  catch { return { status: 'unavailable' }; }
  if (raw === null) return { status: 'absent' };
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.schemaVersion !== 2 || !goodNumber(value.revision)
      || !record(value.journal)) return { status: 'invalid' };
    const j = value.journal;
    if (typeof j.raw !== 'string' || !goodNumber(j.revision)
      || !Array.isArray(j.receipts) || j.receipts.length !== j.revision
      || prepareRewardJournal(j.raw) === null) return { status: 'invalid' };
    const ids = new Set<string>();
    for (const receipt of j.receipts as unknown[]) {
      if (!record(receipt) || typeof receipt.id !== 'string'
        || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(receipt.id)
        || typeof receipt.fingerprint !== 'string' || ids.has(receipt.id)) {
        return { status: 'invalid' };
      }
      ids.add(receipt.id);
    }
    return { status: 'ready', snapshot: value as unknown as PlaySnapshot };
  } catch { return { status: 'invalid' }; }
}

function commit(storage: PlayStorage, expectedStored: string | null, next: PlaySnapshot): PlayWrite {
  try {
    // Rechecagem defensiva: CAS não é atômico sem Web Lock cooperativo.
    if (storage.getItem(PLAY_SAVE_KEY) !== expectedStored) {
      return { status: 'blocked', reason: 'Outra aba modificou o progresso. Atualize a página.' };
    }
    const encoded = JSON.stringify(next);
    storage.setItem(PLAY_SAVE_KEY, encoded);
    if (storage.getItem(PLAY_SAVE_KEY) !== encoded) {
      return { status: 'blocked', reason: 'Falha de verificação após salvar.' };
    }
    return { status: 'ok', snapshot: next };
  } catch {
    return { status: 'blocked', reason: 'Não foi possível salvar no navegador. Verifique o armazenamento.' };
  }
}

export function createPlaySave(
  storage: PlayStorage, name: string, starterId: number, nowMs: number, demo = false
): PlayWrite {
  if (readPlaySave(storage).status !== 'absent') {
    return { status: 'blocked', reason: 'Já existe progresso v0.2 ou armazenamento indisponível.' };
  }
  const nickname = name.trim();
  if (nickname.length < 2 || nickname.length > 24 || !LEGACY_STARTERS[starterId]
    || !goodNumber(nowMs)) {
    return { status: 'blocked', reason: 'Informe nome de 2–24 caracteres e escolha um inicial válido.' };
  }
  const game = {
    version: 1, mode: demo ? 'demo' : 'normal', createdAt: nowMs, name: nickname,
    trainer: {
      level: demo ? 21 : 1, xp: 0, manual: zeroStats(), equipped: {}, title: 'aprendiz'
    },
    coins: demo ? 200 : 0, wins: 0, losses: 0, seen: [starterId],
    caughtSpecies:[starterId],evolutionStones:{},evolutionTestKitClaimed:false,badges: [],
    roster: [{
      uid: 1, pokemonId: starterId, level: demo ? 20 : 1,
      xp: 0, manual: zeroStats(), affinity: demo ? 70 : 0,
      moveName: starterId === 4 ? 'scratch' : 'tackle', upgrades: {},
      battleRecord:{wins:0,draws:0,losses:0}
    }],
    team: [1], nextUid: 2, expedition: null, lastClaim: null,
    ballPocket: D064_DRAFT_STARTER_BALLS, regionWins: Array(10).fill(0)
  };
  const journal = prepareRewardJournal(JSON.stringify(game));
  if (!journal) return { status: 'blocked', reason: 'Falha ao preparar o perfil inicial.' };
  return commit(storage, null, { schemaVersion: 2, revision: 0, journal });
}


/**
 * Prepara encontro e comando de recompensa no MESMO cálculo local, sem
 * aceitar outcome, dano, XP, espécie alvo ou captura arbitrários do botão.
 * Uma seed de navegador ainda é manipulável: apenas alfa sem antifraude.
 */
function trainerLevel(game:Record<string,unknown>):number {
  const trainer=game.trainer;
  return record(trainer)&&Number.isSafeInteger(trainer.level)?trainer.level as number:-1;
}

function playBattle(
  journal: RewardJournal,seed:number,eventId:string,
  regionId?:number,ballId?:KantoBallId|null
):
  | { readonly status:'ok'; readonly journal:RewardJournal }
  | { readonly status:'blocked'; readonly reason:string } {
  if (!Number.isSafeInteger(seed) || seed<0 || seed>0xffffffff) {
    return {status:'blocked',reason:'Seed de combate inválida.'};
  }
  try {
    const game:unknown=JSON.parse(journal.raw);
    if (!record(game) || !record(game.trainer) || !record(game.trainer.manual)
      || !Array.isArray(game.roster) || !Array.isArray(game.team)
      || !Array.isArray(game.badges) || !Array.isArray(game.seen)
      || !Number.isSafeInteger(game.wins)) {
      return {status:'blocked',reason:'Save de combate inválido.'};
    }
    // D-064AG: o nível é consultado no save REAL, nunca no botão.
    // A Arena antiga continua sem parâmetros regionais.
    const selectedRegion=regionId===undefined?null:kantoRegion(regionId);
    if(regionId!==undefined&&(!selectedRegion
      ||!kantoRegionCatalogInvariant()
      ||trainerLevel(game)<selectedRegion.trainerUnlockLevel)){
      return {status:'blocked',reason:'Região bloqueada para o nível atual do treinador.'};
    }
    // O estoque e as vitórias são sempre lidos do snapshot, nunca da UI.
    // A inicialização do bolso é uma regra beta para novos saves locais,
    // aplicável à primeira batalha regional de perfis de teste existentes.
    const pocketRead=inspectKantoBallPocket(game.ballPocket);
    if(selectedRegion&&pocketRead.status==='invalid')
      return {status:'blocked',reason:'Bolso de Pokébolas inválido.'};
    const pocket:KantoBallPocketV1=pocketRead.status==='valid'
      ?pocketRead.pocket:D064_DRAFT_STARTER_BALLS;
    const winsRaw=game.regionWins;
    const regionWins=winsRaw===undefined?Array<number>(10).fill(0)
      :Array.isArray(winsRaw)&&winsRaw.length===10
        &&winsRaw.every(value=>Number.isSafeInteger(value)&&value>=0&&value<=100000)
        ?[...winsRaw as number[]]:null;
    if(selectedRegion&&!regionWins)
      return {status:'blocked',reason:'Histórico de vitórias regionais inválido.'};
    if(selectedRegion&&ballId!==undefined&&ballId!==null
      &&!['poke-ball','great-ball','ultra-ball'].includes(ballId))
      return {status:'blocked',reason:'Pokébola inválida para captura automática.'};
    if(selectedRegion&&ballId&&(pocket.quantities[ballId]??0)<1)
      return {status:'blocked',reason:'Você não possui esta Pokébola.'};
    const trainer=game.trainer;
    const trainerManual=trainer.manual as Record<string,unknown>;
    const badgeIds=game.badges as unknown[];
    const currentUid=game.team[0];
    const active=(game.roster as unknown[]).find(p=>record(p)&&p.uid===currentUid);
    if (!record(active) || !Number.isSafeInteger(active.pokemonId)
      || !Number.isSafeInteger(active.level) || !Number.isSafeInteger(active.affinity)
      || !record(active.manual)) {
      return {status:'blocked',reason:'Pokémon ativo inválido.'};
    }
    const species=KANTO_BATTLE_SPECIES[active.pokemonId as number];
    if (!species) {
      return {status:'blocked',reason:'Esta espécie ainda não possui dados para a arena Alfa.'};
    }
    const manual:StatValues=zeroStats();
    const pokemonManual:StatValues=zeroStats();
    for(const stat of STATS) {
      const value=trainerManual[stat] ?? 0;
      const amount=active.manual[stat] ?? 0;
      if (!Number.isSafeInteger(value) || (value as number)<0 || (value as number)>40
        || !Number.isSafeInteger(amount) || (amount as number)<0 || (amount as number)>200) {
        return {status:'blocked',reason:'Atributos do combatente inválidos.'};
      }
      manual[stat]=value as number;
      pokemonManual[stat]=amount as number;
    }
    const equipped=record(trainer.equipped)?trainer.equipped:{};
    const items=LEGACY_ITEMS.filter(item=>equipped[item.slot]===item.id);
    const badges=LEGACY_BADGES.filter(badge=>badgeIds.includes(badge.id));
    const title=effectiveLegacyTitle(trainer.title,game.wins as number,
      game.seen.length,game.badges.length);
    const totals=trainerTotals({
      manual, equipment:items.map(item=>({slot:item.slot,stats:item.stats})),
      activeTitle:title.stats,
      badges:badges.map(badge=>({id:badge.id,stats:badge.stats}))
    });
    const moveName=typeof active.moveName==='string'?active.moveName:'';
    const equippedNames=pokemonMoveSlots(active,species.move.name);
    if(equippedNames.length<1||equippedNames.length>4
      ||new Set(equippedNames).size!==equippedNames.length
      ||(moveName&&equippedNames[0]!==moveName))
      return{status:'blocked',reason:'Slots de golpes inválidos.'};
    const equippedMoves=equippedNames.map(name=>KANTO_BATTLE_MOVES[name]??KANTO_SUPPORT_MOVES[name]);
    if(equippedMoves.some(move=>!move)||!equippedMoves.some(move=>move!.category!=='status'))
      return{status:'blocked',reason:'Equipe um golpe ofensivo válido.'};
    const move=equippedMoves[0]!;
    const upgrades=record(active.upgrades)?active.upgrades:{};
    const rank=upgrades[move.name] ?? 0;
    const player:Combatant={
      speciesId:species.id,name:species.name,level:active.level as number,
      types:species.types,
      stats:pokemonFinalStats(species.base,active.level as number,pokemonManual,totals,active.affinity as number),
      move,rank:rank as number,moves:equippedMoves as NonNullable<Combatant['moves']>,
      ranks:upgrades as NonNullable<Combatant['ranks']>
    };
    const encounter=selectedRegion
      ?kantoRegionalEncounter(selectedRegion.id,seed,active.level as number):null;
    if(selectedRegion&&!encounter)return{status:'blocked',reason:'Encontro regional inválido.'};
    const wildSpeciesId=encounter?.speciesId
      ??KANTO_WILD_POOL[seed % KANTO_WILD_POOL.length]!;
    const enemy=KANTO_BATTLE_SPECIES[wildSpeciesId]!;
    const wildLevel=encounter?.level
      ??Math.max(2,Math.min(100,(active.level as number)+((seed>>>8)%5)-2));
    // D064AV: selvagens também usam golpes FRLG liberados para seu nível.
    // A mesma IA/SP/precisão/limitador de turnos atende os dois lados.
    const wildMoves=kantoWildMoveLoadout(enemy.id,wildLevel,enemy.move);
    const wild:Combatant={
      speciesId:enemy.id,name:enemy.name,level:wildLevel,types:enemy.types,
      stats:pokemonOwnStats(enemy.base,wildLevel,zeroStats()),
      move:wildMoves[0]!,moves:wildMoves,rank:0
    };
    const result=simulateKantoBattle(player,wild,seed);
    // A Arena clássica permanece com captura legada. Na região, a captura
    // acontece APENAS após vitória e lançamento autorizado: uma bola é
    // consumida mesmo quando falha, na mesma revisão de recompensa.
    let captured=result.captured;
    let nextPocket:KantoBallPocketV1=pocket;
    let usedBallId:KantoBallId|null=null;
    if(selectedRegion){
      captured=false;
      const rare=selectedRegion.rareSpeciesIds.includes(wildSpeciesId);
      // Poké/Great não são gastas contra raros e não cancelam combate:
      // o adversário é sorteado DEPOIS da escolha de bola.
      if(result.outcome==='win'&&ballId&&(!rare||ballId==='ultra-ball')){
        const attempted=resolveKantoCaptureAttempt({
          regionId:selectedRegion.id,speciesId:wildSpeciesId,ballId,
          pocket,maxHp:result.wildMaxHp,currentHp:0,
          seed:(seed^0xa5a5a5a5)>>>0
        });
        if(attempted.status!=='resolved')
          return{status:'blocked',reason:attempted.reason};
        usedBallId=ballId;
        captured=attempted.captured;
        nextPocket=attempted.pocket;
      }
    }
    const base={ id:eventId,expectedRevision:journal.revision,type:'battle-result' as const,
      outcome:result.outcome,activeUid:currentUid as number,wildLevel };
    const command:RewardCommand=result.outcome==='win'
      ? {
        ...base,outcome:'win',affinityGain:result.affinityGain!,
        ...(captured?{capture:{pokemonId:wildSpeciesId,moveName:enemy.move.name}}:{})
      } : base;
    const applied=applyRewardEvent(journal,command);
    if (applied.status!=='applied') {
      return {status:'blocked',reason:applied.status==='rejected'?applied.reason:'Batalha duplicada.'};
    }
    const updated=JSON.parse(applied.journal.raw) as Record<string,unknown>;
    const seen=new Set(game.seen.filter(n=>Number.isSafeInteger(n) && (n as number)>=1 && (n as number)<=151));
    seen.add(wildSpeciesId);
    updated.seen=Array.from(seen);
    if(captured){
      const caughtRaw=Array.isArray(updated.caughtSpecies)?updated.caughtSpecies:[];
      const caught=new Set([
        ...caughtRaw.filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=151),
        ...(game.roster as Record<string,unknown>[]).map(p=>p.pokemonId).filter(n=>Number.isSafeInteger(n)),
        wildSpeciesId
      ]);
      updated.caughtSpecies=Array.from(caught);
    }
    if(selectedRegion){
      const regionWinNumber=(regionWins![selectedRegion.id-1]??0)
        +(result.outcome==='win'?1:0);
      regionWins![selectedRegion.id-1]=regionWinNumber;
      const drop=result.outcome==='win'
        ?d064DraftBallDrop(selectedRegion.id,regionWinNumber):null;
      if(result.outcome==='win'&&!drop)
        return{status:'blocked',reason:'Reposição regional inválida.'};
      const quantities={...nextPocket.quantities};
      if(drop)for(const ball of ['poke-ball','great-ball','ultra-ball'] as const){
        const amount=(quantities[ball]??0)+drop[ball];
        if(!Number.isSafeInteger(amount)||amount>100000)
          return{status:'blocked',reason:'Limite de Pokébolas atingido.'};
        quantities[ball]=amount;
      }
      updated.ballPocket={version:1,quantities};
      updated.regionWins=regionWins;
    }
    // O motor da Arena inclui captura automática no log, mas a captura
    // regional agora possui um sorteio independente. Sempre remover
    // a mensagem antiga e adicionar a verdade do novo lançamento.
    const keepLine=(line:string)=>!selectedRegion||!line.startsWith('Captura! ');
    const battleLog=result.log.filter(keepLine);
    const battleFrames=result.frames.filter((_,index)=>keepLine(result.log[index]??''));
    if(selectedRegion&&result.outcome==='win'&&usedBallId){
      const label=usedBallId==='poke-ball'?'Poké Ball':usedBallId==='great-ball'?'Great Ball':'Ultra Ball';
      battleLog.push(captured
        ?label+' lançada! '+enemy.name+' foi capturado.'
        :label+' lançada! '+enemy.name+' escapou da captura.');
      const lastFrame=battleFrames.at(-1);
      if(lastFrame)battleFrames.push({...lastFrame,kind:'info',target:null,amount:0});
    }
    const earlyLossXp=beginnerBattleXp(active.level as number,result.outcome);
    if(earlyLossXp>0){
      battleLog.push('Aprendizado inicial: +'+earlyLossXp+' XP para seu Pokémon após o combate.');
      const lastFrame=battleFrames.at(-1);
      if(lastFrame)battleFrames.push({...lastFrame,kind:'info',target:null,amount:0});
    }
    updated.lastBattle={
      ...result,captured,log:battleLog,frames:battleFrames,
      ...(selectedRegion?{
        regionId:selectedRegion.id,regionName:selectedRegion.name,
        captureBallId:usedBallId
      }:{ }),
      battleId:eventId,
      wildName:enemy.name,wildLevel,
      rewardCoins:result.outcome==='win'?25+wildLevel*3:0,
      trainerXp:result.outcome==='win'?battleTrainerXp(wildLevel):0,
      pokemonXp:result.outcome==='win'?20+wildLevel*6:earlyLossXp
    };
    return {status:'ok',journal:{...applied.journal,raw:JSON.stringify(updated)}};
  } catch {
    return {status:'blocked',reason:'Não foi possível calcular o encontro; nenhum progresso foi alterado.'};
  }
}

/**
 * D064BE: o combate é calculado de maneira determinística, mas as recompensas
 * só são concedidas quando a reprodução termina. O pending fica no próprio
 * save para sobreviver a reload/navegação, sem pagamento duplicado.
 */
function stagedRegionalBattle(journal:RewardJournal,seed:number,regionId:number,battleId:string):
  {status:'ok';journal:RewardJournal}|{status:'blocked';reason:string}{
  let game:Record<string,unknown>;
  try{game=JSON.parse(journal.raw) as Record<string,unknown>;}catch{
    return {status:'blocked',reason:'Save inválido.'};
  }
  if(game.pendingBattle)return {status:'blocked',reason:'Finalize o combate pendente.'};
  if(record(game.lastBattle)&&game.lastBattle.captureStatus==='available')
    return {status:'blocked',reason:'Escolha capturar ou seguir antes de lutar novamente.'};
  const simulated=playBattle(journal,seed,battleId,regionId,null);
  if(simulated.status!=='ok')return simulated;
  let advanced:Record<string,unknown>;
  try{advanced=JSON.parse(simulated.journal.raw) as Record<string,unknown>;}catch{
    return {status:'blocked',reason:'Resultado inválido.'};
  }
  game.pendingBattle={
    battleId,seed,regionId,preview:advanced.lastBattle
  };
  return {status:'ok',journal:{...journal,raw:JSON.stringify(game)}};
}

function finalizeRegionalBattle(journal:RewardJournal,battleId:string):
  {status:'ok';journal:RewardJournal}|{status:'blocked';reason:string}{
  let game:Record<string,unknown>;
  try{game=JSON.parse(journal.raw) as Record<string,unknown>;}catch{
    return {status:'blocked',reason:'Save inválido.'};
  }
  const pending=game.pendingBattle;
  if(!record(pending)||pending.battleId!==battleId
    ||!goodNumber(pending.regionId)||!goodNumber(pending.seed))
    return {status:'blocked',reason:'Batalha pendente não encontrada ou já finalizada.'};
  delete game.pendingBattle;
  const base={...journal,raw:JSON.stringify(game)};
  const outcome=playBattle(base,pending.seed as number,battleId,pending.regionId as number,null);
  if(outcome.status!=='ok')return outcome;
  const updated=JSON.parse(outcome.journal.raw) as Record<string,unknown>;
  if(!record(updated.lastBattle)||!record(pending.preview)
    ||updated.lastBattle.outcome!==pending.preview.outcome
    ||updated.lastBattle.wildSpeciesId!==pending.preview.wildSpeciesId)
    return {status:'blocked',reason:'Resultado divergente; progresso preservado.'};
  updated.lastBattle.captureStatus=updated.lastBattle.outcome==='win'?'available':'unavailable';
  updated.lastBattle.captureSeed=pending.seed;
  return {status:'ok',journal:{...outcome.journal,raw:JSON.stringify(updated)}};
}

/** Uma escolha pós-combate; id do encontro é obrigatório e replay não reabre oferta. */
function postBattleCapture(journal:RewardJournal,battleId:string,ballId:KantoBallId|null):
  {status:'ok';journal:RewardJournal}|{status:'blocked';reason:string}{
  let game:Record<string,unknown>;
  try{game=JSON.parse(journal.raw) as Record<string,unknown>;}catch{
    return {status:'blocked',reason:'Save inválido.'};
  }
  const battle=game.lastBattle;
  if(game.pendingBattle||!record(battle)||battle.battleId!==battleId
    ||battle.outcome!=='win'||battle.captureStatus!=='available'
    ||!goodNumber(battle.regionId)||!goodNumber(battle.wildSpeciesId)
    ||!goodNumber(battle.captureSeed)||!goodNumber(battle.wildMaxHp))
    return {status:'blocked',reason:'Não há captura disponível para este combate.'};
  if(ballId===null){
    battle.captureStatus='skipped';
    return {status:'ok',journal:{...journal,raw:JSON.stringify(game)}};
  }
  if(!['poke-ball','great-ball','ultra-ball'].includes(ballId))
    return {status:'blocked',reason:'Pokébola inválida.'};
  const region=kantoRegion(battle.regionId as number);
  const species=KANTO_BATTLE_SPECIES[battle.wildSpeciesId as number];
  const pocket=inspectKantoBallPocket(game.ballPocket);
  if(!region||!species||pocket.status!=='valid')
    return {status:'blocked',reason:'Encontro ou inventário inválido.'};
  if(region.rareSpeciesIds.includes(species.id)&&ballId!=='ultra-ball')
    return {status:'blocked',reason:'Este Pokémon exige Ultra Ball.'};
  if((pocket.pocket.quantities[ballId]??0)<1)
    return {status:'blocked',reason:'Você não possui esta Pokébola.'};
  const outcome=resolveKantoCaptureAttempt({
    regionId:region.id,speciesId:species.id,ballId,pocket:pocket.pocket,
    maxHp:battle.wildMaxHp as number,currentHp:0,
    seed:((battle.captureSeed as number)^0xa5a5a5a5)>>>0
  });
  if(outcome.status!=='resolved')return {status:'blocked',reason:outcome.reason};
  if(!Array.isArray(game.roster)||!goodNumber(game.nextUid)||game.nextUid<1)
    return {status:'blocked',reason:'Coleção inválida.'};
  if(outcome.captured){
    if(!Number.isSafeInteger(game.nextUid+1))
      return {status:'blocked',reason:'UID esgotado.'};
    const captureLevel=kantoCaptureStartingLevel(species.id);
    const initialMove=kantoWildMoveLoadout(species.id,captureLevel,species.move)[0];
    game.roster.push({
      uid:game.nextUid,pokemonId:species.id,level:captureLevel,xp:0,
      manual:zeroStats(),affinity:0,moveName:initialMove?.name??species.move.name,upgrades:{},
      battleRecord:{wins:0,draws:0,losses:0}
    });
    game.nextUid++;
    const caught=new Set<number>(Array.isArray(game.caughtSpecies)
      ?game.caughtSpecies.filter((value:unknown):value is number=>
          typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=151):[]);
    caught.add(species.id);
    game.caughtSpecies=[...caught];
  }
  game.ballPocket=outcome.pocket;
  battle.captured=outcome.captured;
  if(outcome.captured)battle.capturedStartingLevel=kantoCaptureStartingLevel(species.id);
  battle.captureStatus=outcome.captured?'caught':'escaped';
  battle.captureBallId=ballId;
  // Captura é separada do replay e NÃO acrescenta outra vitória/XP.
  return {status:'ok',journal:{...journal,raw:JSON.stringify(game)}};
}

/**
 * Uma única transição imutável + uma gravação da chave v0.2.
 * O caller DEVE usar navigator.locks para coordenação entre abas.
 * Enquanto não existir backend, o relógio do dispositivo não é confiável.
 */
export function updatePlaySave(
  storage: PlayStorage, expectedRevision: number, action: PlayAction
): PlayWrite {
  const previous = readPlaySave(storage);
  if (previous.status !== 'ready') {
    return { status: 'blocked', reason: 'Progresso ausente, corrompido ou indisponível.' };
  }
  if (!goodNumber(expectedRevision) || expectedRevision !== previous.snapshot.revision) {
    return { status: 'blocked', reason: 'Revisão desatualizada. Atualize antes de jogar.' };
  }
  const journal = previous.snapshot.journal;
  // Não permitir edição/expedição paralela a uma batalha ainda sem prêmio.
  let current:Record<string,unknown>;
  try{current=JSON.parse(journal.raw) as Record<string,unknown>;}catch{
    return {status:'blocked',reason:'Save inválido.'};
  }
  if(current.pendingBattle&&action.type!=='finish-regional-battle')
    return {status:'blocked',reason:'Conclua o replay antes de continuar.'};
  let next: RewardJournal;
  if (action.type === 'trainer' || action.type === 'pokemon') {
    const result = action.type === 'trainer'
      ? editLegacyTrainerJson(journal.raw, action.value)
      : reduceLegacyPokemonTeamJson(journal.raw, action.value);
    if (result.status !== 'ok') return { status: 'blocked', reason: result.reason };
    next = { ...journal, raw: result.json };
  } else if (action.type === 'trainer-invest-batch') {
    // D-050: a prévia nunca grava. Validamos TODO o lote contra o snapshot
    // atual e fazemos apenas um commit/revision. Falha = nenhum ponto aplicado.
    const increments = action.increments;
    const requested = Object.entries(increments) as [keyof StatValues, number][];
    if (requested.length === 0 || requested.some(([stat, count]) =>
      !STATS.includes(stat) || !Number.isSafeInteger(count) || count < 1 || count > 40
    )) return {status:'blocked',reason:'Distribuição de pontos inválida.'};
    let candidate = journal.raw;
    for (const [stat, count] of requested) {
      for (let i = 0; i < count; i++) {
        const result = editLegacyTrainerJson(candidate,{type:'invest',stat});
        if (result.status !== 'ok') return {status:'blocked',reason:result.reason};
        candidate = result.json;
      }
    }
    next = {...journal,raw:candidate};
  } else if (action.type === 'pokemon-invest-batch') {
    // D-056: um lote, um commit. O UID e todos os incrementos são
    // revalidados pelo reducer de domínio sobre o JSON candidato. Qualquer
    // falha devolve blocked sem gravar absolutamente nenhum ponto.
    const requested=Object.entries(action.increments) as [keyof StatValues,number][];
    if(!Number.isSafeInteger(action.uid)||action.uid<1||
      requested.length===0||requested.some(([stat,count])=>
        !STATS.includes(stat)||!Number.isSafeInteger(count)||count<1||count>198
      ))return{status:'blocked',reason:'Distribuição Pokémon inválida.'};
    let candidate=journal.raw;
    for(const [stat,count] of requested){
      for(let i=0;i<count;i++){
        const result=reduceLegacyPokemonTeamJson(candidate,{
          type:'invest-pokemon',uid:action.uid,stat
        });
        if(result.status!=='ok')return{status:'blocked',reason:result.reason};
        candidate=result.json;
      }
    }
    next={...journal,raw:candidate};
  } else if (action.type === 'move') {
    // O cliente NÃO fornece lista de golpes, poder ou elegibilidade.
    // Este writer deriva do snapshot FireRed/LeafGreen e do UID real.
    let current:unknown;
    try { current=JSON.parse(journal.raw); } catch { current=null; }
    if(!record(current)||!Array.isArray(current.roster)) {
      return {status:'blocked',reason:'Save inválido para treinamento de golpes.'};
    }
    const member=(current.roster as unknown[]).find(p=>record(p)&&p.uid===action.uid);
    if(!record(member)||!Number.isSafeInteger(member.pokemonId)||!Number.isSafeInteger(member.level)) {
      return {status:'blocked',reason:'Pokémon não encontrado.'};
    }
    const eligible=kantoLevelMoves(member.pokemonId as number,member.level as number);
    const definition=eligible.find(item=>item.move.name===action.moveName);
    const fallback=KANTO_BATTLE_MOVES[action.moveName];
    const result=action.operation==='select'
      ? reducePokemonMoveSlotsJson(journal.raw,{
          uid:action.uid,moveName:action.moveName,operation:'replace-primary'
        })
      : action.operation==='upgrade' && (definition||fallback)
        ? reduceLegacyPokemonMoveJson(journal.raw,{
            type:'upgrade-move',uid:action.uid,moveName:action.moveName,
            movePower:(definition?.move??fallback!).power
          })
        : {status:'invalid' as const,reason:'Golpe não disponível para aprimoramento.'};
    if (result.status!=='ok') return {status:'blocked',reason:result.reason};
    next={...journal,raw:result.json};
  } else if (action.type === 'move-set') {
    const result=reducePokemonMoveSlotsJson(journal.raw,action);
    if(result.status!=='ok')return{status:'blocked',reason:result.reason};
    next={...journal,raw:result.json};
  } else if (action.type === 'evolution' || action.type === 'evolution-test-kit') {
    // O writer resolve as condições do catálogo, não confia em item/nível do botão.
    const result=reduceKantoEvolutionJson(journal.raw,
      action.type==='evolution'
        ? {type:'evolve',uid:action.uid,targetSpeciesId:action.targetSpeciesId}
        : {type:'grant-test-kit'});
    if(result.status!=='ok')return{status:'blocked',reason:result.reason};
    next={...journal,raw:result.json};
  } else if (action.type === 'start-regional-battle') {
    const result=stagedRegionalBattle(journal,action.seed,action.regionId,
      'regional-v02-'+(previous.snapshot.revision+1));
    if(result.status==='blocked')return result;
    next=result.journal;
  } else if (action.type === 'finish-regional-battle') {
    const result=finalizeRegionalBattle(journal,action.battleId);
    if(result.status==='blocked')return result;
    next=result.journal;
  } else if (action.type === 'capture-after-battle'||action.type==='skip-capture') {
    const result=postBattleCapture(journal,action.battleId,
      action.type==='skip-capture'?null:action.ballId);
    if(result.status==='blocked')return result;
    next=result.journal;
  } else if (action.type === 'battle'||action.type === 'regional-battle') {
    const region=action.type==='regional-battle'?action.regionId:undefined;
    const idPrefix=region===undefined?'battle-v02-':'regional-v02-';
    const result=playBattle(journal,action.seed,idPrefix+(previous.snapshot.revision+1),region,
      action.type==='regional-battle'?action.ballId:undefined);
    if (result.status==='blocked') return result;
    next=result.journal;
  } else {
    const eventBase = {
      id: 'idle-v02-' + (previous.snapshot.revision + 1),
      expectedRevision: journal.revision,
      nowMs: action.nowMs
    };
    const command: RewardCommand = action.type === 'start-expedition'
      ? {...eventBase,type:'start-expedition',regionId:action.regionId}
      : {...eventBase,type:action.type};
    const result = applyRewardEvent(journal, command);
    if (result.status !== 'applied') {
      return { status: 'blocked', reason: result.status === 'rejected'
        ? result.reason : 'Comando já processado.' };
    }
    next = result.journal;
  }
  if (previous.snapshot.revision >= Number.MAX_SAFE_INTEGER) {
    return { status: 'blocked', reason: 'Limite de revisões atingido.' };
  }
  return commit(storage, JSON.stringify(previous.snapshot), {
    schemaVersion: 2, revision: previous.snapshot.revision + 1, journal: next
  });
}

/** Reinício do teste: apaga APENAS a chave v0.2, nunca os dados da v0.1. */
export function resetPlaySave(storage: PlayStorage): boolean {
  try {
    storage.removeItem(PLAY_SAVE_KEY);
    return storage.getItem(PLAY_SAVE_KEY) === null;
  } catch { return false; }
}
