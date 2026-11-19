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
  reduceLegacyPokemonMoveJson, kantoLevelMoves, reduceKantoEvolutionJson,
  KANTO_SUPPORT_MOVES,pokemonMoveSlots,reducePokemonMoveSlotsJson
} from '@kanto/game-core';
import type {
  LegacyPokemonTeamAction, RewardJournal, RewardCommand, TrainerDraftAction, StatValues, Combatant
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
  | { readonly type: 'evolution'; readonly uid:number; readonly targetSpeciesId:number }
  | { readonly type: 'evolution-test-kit' }
  | { readonly type: 'move'; readonly uid:number; readonly moveName:string;
      readonly operation:'select'|'upgrade' }
  | { readonly type:'move-set'; readonly uid:number; readonly moveName:string;
      readonly operation:'add'|'remove'|'primary' }
  | { readonly type: 'start-expedition' | 'claim-expedition' | 'stop-expedition'; readonly nowMs: number };

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
      uid: 1, pokemonId: starterId, level: demo ? 20 : 5,
      xp: 0, manual: zeroStats(), affinity: demo ? 70 : 0,
      moveName: starterId === 4 ? 'scratch' : 'tackle', upgrades: {}
    }],
    team: [1], nextUid: 2, expedition: null, lastClaim: null
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
function playBattle(journal: RewardJournal, seed: number, eventId: string):
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
    const wildSpeciesId=KANTO_WILD_POOL[seed % KANTO_WILD_POOL.length]!;
    const enemy=KANTO_BATTLE_SPECIES[wildSpeciesId]!;
    const wildLevel=Math.max(2,Math.min(100,(active.level as number)+((seed>>>8)%5)-2));
    const wild:Combatant={
      speciesId:enemy.id,name:enemy.name,level:wildLevel,types:enemy.types,
      stats:pokemonOwnStats(enemy.base,wildLevel,zeroStats()),
      move:enemy.move,rank:0
    };
    const result=simulateKantoBattle(player,wild,seed);
    const base={ id:eventId,expectedRevision:journal.revision,type:'battle-result' as const,
      outcome:result.outcome,activeUid:currentUid as number,wildLevel };
    const command:RewardCommand=result.outcome==='win'
      ? {
        ...base,outcome:'win',affinityGain:result.affinityGain!,
        ...(result.captured?{capture:{pokemonId:wildSpeciesId,moveName:enemy.move.name}}:{})
      } : base;
    const applied=applyRewardEvent(journal,command);
    if (applied.status!=='applied') {
      return {status:'blocked',reason:applied.status==='rejected'?applied.reason:'Batalha duplicada.'};
    }
    const updated=JSON.parse(applied.journal.raw) as Record<string,unknown>;
    const seen=new Set(game.seen.filter(n=>Number.isSafeInteger(n) && (n as number)>=1 && (n as number)<=151));
    seen.add(wildSpeciesId);
    updated.seen=Array.from(seen);
    if(result.captured){
      const caughtRaw=Array.isArray(updated.caughtSpecies)?updated.caughtSpecies:[];
      const caught=new Set([
        ...caughtRaw.filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=151),
        ...(game.roster as Record<string,unknown>[]).map(p=>p.pokemonId).filter(n=>Number.isSafeInteger(n)),
        wildSpeciesId
      ]);
      updated.caughtSpecies=Array.from(caught);
    }
    updated.lastBattle={
      ...result,
      battleId:eventId,
      wildName:enemy.name,wildLevel,
      rewardCoins:result.outcome==='win'?25+wildLevel*3:0,
      trainerXp:result.outcome==='win'?30+wildLevel*7:0,
      pokemonXp:result.outcome==='win'?20+wildLevel*6:0
    };
    return {status:'ok',journal:{...applied.journal,raw:JSON.stringify(updated)}};
  } catch {
    return {status:'blocked',reason:'Não foi possível calcular o encontro; nenhum progresso foi alterado.'};
  }
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
  } else if (action.type === 'battle') {
    const result=playBattle(journal,action.seed,'battle-v02-'+(previous.snapshot.revision+1));
    if (result.status==='blocked') return result;
    next=result.journal;
  } else {
    const command: RewardCommand = {
      id: 'idle-v02-' + (previous.snapshot.revision + 1),
      expectedRevision: journal.revision,
      type: action.type,
      nowMs: action.nowMs
    };
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
