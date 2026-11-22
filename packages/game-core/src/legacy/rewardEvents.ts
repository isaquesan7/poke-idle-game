/**
 * Eventos PUROS e idempotentes de recompensas compatíveis com a v0.1.
 *
 * Cada execução recebe um envelope em MEMÓRIA com a revisão e TODOS os IDs
 * já processados. Nenhuma gravação, relógio, RNG, PokéAPI ou autoridade de
 * recompensa existe aqui. A batalha deve chegar RESOLVIDA por outra camada,
 * e o resultado enviado pelo cliente NÃO é prova antifraude.
 *
 * Invariantes: evento repetido não concede nada; mesmo ID com payload
 * diferente é conflito; revisão obsoleta é recusada; recompensas, captura
 * e recibo são calculados na MESMA transição imutável. Ainda não é writer.
 */
import { kantoCaptureStartingLevel } from '../catalog/kantoEvolution.js';
import { AFFINITY_LOSS_ON_DEFEAT, AFFINITY_LOSS_ON_DRAW } from '../affinity/affinityDynamics.js';
import { grantXp, battleTrainerXp, beginnerBattleXp } from '../progression/xp.js';
import {expeditionRewards,emptyExpeditionBallProgress} from '../rewards/expedition.js';
import type {ExpeditionBallKind} from '../rewards/expedition.js';
import {battleProgressFactor,scaledRegionalReward} from '../rewards/regionProgression.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';
import {KANTO_BALL_SHOP_PRICE_POLICY,quoteKantoBallShopPurchase} from '../shop/ballShop.js';
import { LEGACY_BADGES } from './catalog.js';
import { kantoRegion } from '../map/kantoRegions.js';

type Entry = Record<string, unknown>;

export interface RewardEventReceipt {
  readonly id: string;
  readonly fingerprint: string;
}
export interface RewardJournal {
  readonly raw: string;
  readonly revision: number;
  readonly receipts: readonly RewardEventReceipt[];
}

interface CommandBase {
  readonly id: string;
  readonly expectedRevision: number;
}
export type RewardCommand =
  | (CommandBase & {
    readonly type: 'battle-result';
    readonly outcome: 'win' | 'loss' | 'draw';
    readonly activeUid: number;
    readonly wildLevel: number;
    readonly regionId?:number;
    readonly affinityGain?: number;
    /** Captura já resolvida (nenhuma rolagem ou sorteio dentro do reducer). */
    readonly capture?: { readonly pokemonId: number; readonly moveName?: string | null };
  })
  | (CommandBase & { readonly type:'shop-purchase';readonly ballId:string;
      readonly quantity:number })
  | (CommandBase & { readonly type: 'start-expedition'; readonly nowMs: number; readonly regionId?: number })
  | (CommandBase & { readonly type: 'claim-expedition'; readonly nowMs: number })
  | (CommandBase & { readonly type: 'stop-expedition'; readonly nowMs: number });

export type RewardEventResult =
  | { readonly status: 'applied'; readonly journal: RewardJournal }
  | { readonly status: 'duplicate'; readonly journal: RewardJournal }
  | { readonly status: 'rejected'; readonly journal: RewardJournal; readonly reason: string };

function record(value: unknown): value is Entry {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number {
  return natural(value) && value > 0;
}
function reject(journal: RewardJournal, reason: string): RewardEventResult {
  return { status: 'rejected', journal, reason };
}

interface ProgressPokemon extends Entry {
  uid: number;
  pokemonId: number;
  level: number;
  xp: number;
  affinity: number;
}
interface ValidState extends Entry {
  trainer: Entry;
  roster: ProgressPokemon[];
  team: number[];
  badges: string[];
  coins: number;
  wins: number;
  losses: number;
  nextUid: number;
  expedition: Entry | null;
}

/** Valida apenas campos consumidos para recompensas; nunca repara saves ruins. */
function parseState(raw: string): ValidState | null {
  let source: unknown;
  try { source = JSON.parse(raw); }
  catch { return null; }
  if (!record(source) || source.version !== 1 || !record(source.trainer)
    || !positive(source.trainer.level) || source.trainer.level > 100
    || !natural(source.trainer.xp)
    || !natural(source.coins) || !natural(source.wins) || !natural(source.losses)
    || !positive(source.nextUid)
    || !Array.isArray(source.badges)
    || !source.badges.every((b: unknown) => typeof b === 'string')
    || !Array.isArray(source.roster) || source.roster.length === 0
    || !Array.isArray(source.team) || source.team.length < 1 || source.team.length > 3
    || !(source.expedition === null || record(source.expedition))) return null;

  const uids = new Set<number>();
  for (const p of source.roster as unknown[]) {
    if (!record(p) || !positive(p.uid) || uids.has(p.uid)
      || !positive(p.pokemonId) || p.pokemonId > 151
      || !positive(p.level) || p.level > 100
      || !natural(p.xp) || !natural(p.affinity) || p.affinity > 100) return null;
    uids.add(p.uid);
  }
  if (source.nextUid <= Math.max(...uids)) return null;
  const team = new Set<number>();
  for (const uid of source.team as unknown[]) {
    if (!positive(uid) || !uids.has(uid) || team.has(uid)) return null;
    team.add(uid);
  }
  if (record(source.expedition)) {
    const exp = source.expedition;
    if (!natural(exp.startedAt) || !natural(exp.lastClaimAt)
      || exp.lastClaimAt < exp.startedAt || !Array.isArray(exp.teamUids)
      || exp.teamUids.length < 1 || exp.teamUids.length > 3) return null;
    // Expedições criadas antes da D064AK não possuem regionId; preservá-las.
    if (exp.regionId !== undefined && (!positive(exp.regionId) || !kantoRegion(exp.regionId))) return null;
    const members = new Set<number>();
    for (const uid of exp.teamUids as unknown[]) {
      if (!positive(uid) || !uids.has(uid) || members.has(uid)) return null;
      members.add(uid);
    }
  }
  return source as unknown as ValidState;
}
function validJournal(j: RewardJournal): boolean {
  if (!j || typeof j.raw !== 'string'
    || !natural(j.revision) || !Array.isArray(j.receipts)
    || j.receipts.length !== j.revision) return false;
  const ids = new Set<string>();
  for (const r of j.receipts) {
    if (!r || typeof r.id !== 'string' || !validId(r.id)
      || typeof r.fingerprint !== 'string' || ids.has(r.id)) return false;
    ids.add(r.id);
  }
  return true;
}
function validId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(id);
}
function creditCoins(state: ValidState, amount: number): void {
  if (!natural(amount) || !Number.isSafeInteger(state.coins + amount)) {
    throw new RangeError('Saldo ou recompensa fora do limite seguro.');
  }
  state.coins += amount;
}
function creditTrainerXp(state: ValidState, amount: number): void {
  if (!Number.isSafeInteger((state.trainer.xp as number) + amount)) {
    throw new RangeError('XP do treinador fora do limite seguro.');
  }
  const progress = grantXp('trainer', {
    level: state.trainer.level as number,
    xp: state.trainer.xp as number
  }, amount);
  state.trainer.level = progress.level;
  state.trainer.xp = progress.xp;
}
function creditPokemonXp(p: ProgressPokemon, amount: number): void {
  if (!Number.isSafeInteger(p.xp + amount)) {
    throw new RangeError('XP do Pokémon fora do limite seguro.');
  }
  const progress = grantXp('pokemon', { level: p.level, xp: p.xp }, amount);
  p.level = progress.level;
  p.xp = progress.xp;
}
/** Emula claimExp da v0.1; avanço do cursor usa nowMs, não soma ciclos. */
function claimExpedition(state: ValidState, nowMs: number, required: boolean): boolean {
  const exp = state.expedition;
  if (!exp || !natural(exp.lastClaimAt) || !natural(exp.startedAt)
    || !natural(nowMs) || nowMs < exp.lastClaimAt) {
    throw new RangeError('Expedição ausente ou relógio retrocedeu.');
  }
  const byUid=new Map(state.roster.map(p=>[p.uid,p]));
  const members=(exp.teamUids as number[]).map(uid=>{
    const p=byUid.get(uid);
    if(!p)throw new RangeError('UID da expedição ausente.');
    return p;
  });
  const regionId=exp.regionId as number|undefined;
  const rawProgress=state.expeditionBallProgress;
  const previous=emptyExpeditionBallProgress();
  if(rawProgress!==undefined){
    if(!record(rawProgress))throw new RangeError('Contador de bolas de expedição inválido.');
    for(const kind of Object.keys(previous) as ExpeditionBallKind[]){
      const n=rawProgress[kind]??0;
      if(!natural(n))throw new RangeError('Contador de Pokébola inválido.');
      previous[kind]=n;
    }
  }
  const reward=expeditionRewards(nowMs-(exp.lastClaimAt as number),
    regionId===undefined?undefined:{
      regionId,pokemon:members.map(p=>({level:p.level,xp:p.xp})),
      ballProgress:previous
    });
  if(reward.cycles<1){
    if(required)throw new RangeError('Nenhum ciclo completo para resgatar.');
    return false;
  }
  // Inventário e evento num único commit: nunca duplicar bolas após reload.
  const drops=reward.ballDrops;
  const creditedDrops=drops?{...drops}:undefined;
  if(drops&&Object.values(drops).some(v=>v>0)){
    const pocket=inspectKantoBallPocket(state.ballPocket);
    if(pocket.status==='invalid')throw new RangeError('Bolso inválido.');
    // D064BR: no limite técnico, apenas a bola excedente não entra.
    // A coleta de moedas, XP e o cursor da expedição NUNCA ficam bloqueados
    // por um item cujo estoque já chegou a 100.000.
    const quantities=pocket.status==='valid'?{...pocket.pocket.quantities}
      :{} as Record<ExpeditionBallKind,number>;
    for(const kind of Object.keys(drops) as ExpeditionBallKind[]){
      const old=quantities[kind]??0;
      if(!natural(old)||old>100000)
        throw new RangeError('Bolso de Pokébolas inválido.');
      const amount=Math.min(100000,old+drops[kind]);
      if(creditedDrops)creditedDrops[kind]=amount-old;
      quantities[kind]=amount;
    }
    state.ballPocket={version:1,quantities};
    // Em save v0.1 sem bolso não criamos o kit inicial retroativamente.
  }
  if(reward.ballProgress)state.expeditionBallProgress=reward.ballProgress;
  creditCoins(state,reward.coins);
  creditTrainerXp(state,reward.trainerXp);
  // Proteção também para expedições legadas sem regionId:
  // só o UID líder (primeiro membro fixado no início) recebe XP.
  creditPokemonXp(members[0]!,reward.pokemonXpByMember?.[0]??reward.pokemonXpPerMember);
  exp.lastClaimAt=nowMs;
  state.lastClaim={
    coins:reward.coins,trainerXP:reward.trainerXp,
    pokemonXP:reward.pokemonXpPerMember,cycles:reward.cycles,
    ...(creditedDrops?{ballDrops:creditedDrops}:{}),
  };
  return true;
}
function resolvedBattle(state: ValidState, cmd: Extract<RewardCommand, {type:'battle-result'}>): void {
  if (!positive(cmd.activeUid) || state.team[0] !== cmd.activeUid
    || !positive(cmd.wildLevel) || cmd.wildLevel < 2 || cmd.wildLevel > 100
    || !['win','loss','draw'].includes(cmd.outcome)) {
    throw new RangeError('Resultado ou Pokémon ativo inválido.');
  }
  const active = state.roster.find(p => p.uid === cmd.activeUid);
  if (!active) throw new RangeError('Pokémon ativo não pertence ao jogador.');
  const factor=cmd.regionId===undefined?1:
    battleProgressFactor(active.level,cmd.wildLevel);
  // D064BE: histórico da instância por UID, não da espécie. Campos ausentes
  // em capturas/saves legados começam em zero (não inventar partidas antigas).
  const historical=record(active.battleRecord)?active.battleRecord:null;
  const recordCount=(key:'wins'|'draws'|'losses'):number=>{
    const value=historical?.[key];
    if(value===undefined)return 0;
    if(!natural(value))throw new RangeError('Histórico individual inválido.');
    return value;
  };
  const battleRecord={
    wins:recordCount('wins'),draws:recordCount('draws'),losses:recordCount('losses')
  };
  const key=cmd.outcome==='win'?'wins':cmd.outcome==='draw'?'draws':'losses';
  if(!Number.isSafeInteger(battleRecord[key]+1))
    throw new RangeError('Limite de partidas do Pokémon.');
  if(factor>0)battleRecord[key]++;
  active.battleRecord=battleRecord;
  if(cmd.outcome==='draw'&&factor>0){
    const prior=state.draws;
    if(prior!==undefined&&!natural(prior))throw new RangeError('Empates inválidos.');
    state.draws=(prior===undefined?0:prior as number)+1;
  }
  if (cmd.outcome !== 'win') {
    if (cmd.capture !== undefined || cmd.affinityGain !== undefined) {
      throw new RangeError('Derrota/empate não pode receber bônus ou captura.');
    }
    if(factor>0){
      if (!Number.isSafeInteger(state.losses+1))throw new RangeError('Derrotas fora do limite.');
      state.losses++;
    }
    active.affinity=Math.max(0,active.affinity-
      (cmd.outcome==='draw'?AFFINITY_LOSS_ON_DRAW:AFFINITY_LOSS_ON_DEFEAT));
    // Lv1 não possui expedição regional na primeira área e pode perder
    // repetidamente para selvagens Lv2+. Aprendizagem limitada evita softlock
    // sem modificar a IA adversária ou recompensar moedas/captura/treinador.
    const trainingXp=beginnerBattleXp(active.level,cmd.outcome);
    if(trainingXp>0)creditPokemonXp(active,trainingXp);
    return;
  }
  if (!natural(cmd.affinityGain) || cmd.affinityGain < 2 || cmd.affinityGain > 5) {
    throw new RangeError('Ganho de afinidade deve estar entre 2 e 5.');
  }
  if (cmd.capture) {
    if (!positive(cmd.capture.pokemonId) || cmd.capture.pokemonId > 151
      || (cmd.capture.moveName !== undefined
        && cmd.capture.moveName !== null
        && (typeof cmd.capture.moveName !== 'string'
          || cmd.capture.moveName.length < 1
          || cmd.capture.moveName.length > 100))) {
      throw new RangeError('Captura resolvida possui espécie ou golpe inválido.');
    }
  }
  if(factor>0){
    if(!Number.isSafeInteger(state.wins+1))throw new RangeError('Vitórias fora do limite.');
    state.wins++;
  }
  creditCoins(state,scaledRegionalReward(25+cmd.wildLevel*3,factor));
  creditTrainerXp(state,scaledRegionalReward(battleTrainerXp(cmd.wildLevel),factor));
  creditPokemonXp(active,scaledRegionalReward(20+cmd.wildLevel*6,factor));
  active.affinity=Math.min(100,active.affinity+
    scaledRegionalReward(cmd.affinityGain,factor));
  for (const badge of LEGACY_BADGES) {
    if (state.wins >= badge.wins && !state.badges.includes(badge.id)) {
      state.badges.push(badge.id);
    }
  }
  if (cmd.capture) {
    if (!Number.isSafeInteger(state.nextUid + 1)) throw new RangeError('UID esgotado.');
    const p: ProgressPokemon = {
      uid: state.nextUid, pokemonId: cmd.capture.pokemonId,
      level: kantoCaptureStartingLevel(cmd.capture.pokemonId), xp: 0,
      manual: { hp: 0, attack: 0, defense: 0,
        specialAttack: 0, specialDefense: 0, speed: 0 },
      affinity: 0, moveName: cmd.capture.moveName ?? null, upgrades: {},
      battleRecord:{wins:0,draws:0,losses:0}
    };
    state.nextUid++;
    state.roster.push(p);
  }
}

/**
 * Cria envelope em RAM apenas se a origem v0.1 for minimamente íntegra.
 * O envelope e seus recibos NÃO são persistidos nem têm autoridade de servidor.
 */
export function prepareRewardJournal(raw: string): RewardJournal | null {
  return parseState(raw) === null ? null : { raw, revision: 0, receipts: [] };
}

/**
 * Uma transição por evento: rejeita revision stale, aceita replay idêntico
 * como DUPLICATE e impede reuso de ID para payload diferente.
 *
 * A verificação revisão+ledger só protege um envelope compartilhado
 * sequencialmente; duas abas com cópias separadas NÃO ficam coordenadas.
 */
export function applyRewardEvent(journal: RewardJournal, cmd: RewardCommand): RewardEventResult {
  if (!validJournal(journal) || !cmd || typeof cmd !== 'object'
    || !validId(cmd.id) || !natural(cmd.expectedRevision)) {
    return reject(journal, 'Journal ou comando inválido.');
  }
  const fingerprint = JSON.stringify(cmd);
  if (typeof fingerprint !== 'string') return reject(journal, 'Payload inválido.');
  const previous = journal.receipts.find(r => r.id === cmd.id);
  if (previous) {
    return previous.fingerprint === fingerprint
      ? { status: 'duplicate', journal }
      : reject(journal, 'ID de evento reutilizado com payload diferente.');
  }
  if (cmd.expectedRevision !== journal.revision) {
    return reject(journal, 'Revisão obsoleta: recarregar snapshot autoritativo.');
  }
  const state = parseState(journal.raw);
  if (!state) return reject(journal, 'Save v0.1 inválido ou ambíguo.');
  try {
    switch (cmd.type) {
      case 'battle-result':
        resolvedBattle(state, cmd);
        break;
      case 'shop-purchase': {
        // Preço e desbloqueio derivados do estado do save e do catálogo do CORE,
        // nunca do formulário. Tudo dentro da mesma transição com receipt.
        const bag=inspectKantoBallPocket(state.ballPocket);
        if(bag.status!=='valid')
          throw new RangeError('Mochila de Pokébolas indisponível ou inválida.');
        const quote=quoteKantoBallShopPurchase({
          coins:state.coins,trainerLevel:state.trainer.level as number,
          pocket:bag.pocket,ballId:cmd.ballId,quantity:cmd.quantity
        },KANTO_BALL_SHOP_PRICE_POLICY);
        if(quote.status!=='quoted')throw new RangeError(quote.reason);
        state.coins=quote.remainingCoins;
        state.ballPocket=quote.pocket;
        state.lastShopPurchase={
          id:cmd.id,ballId:cmd.ballId,quantity:cmd.quantity,cost:quote.cost,
          priceVersion:quote.policyVersion
        };
        break;
      }
      case 'start-expedition':
        if (!natural(cmd.nowMs) || state.expedition !== null) {
          throw new RangeError('Expedição já ativa ou horário inválido.');
        }
        if (cmd.regionId !== undefined) {
          const region = kantoRegion(cmd.regionId);
          const leader = state.roster.find(p => p.uid === state.team[0]);
          if (!region || !leader || (state.trainer.level as number) < region.trainerUnlockLevel
            || leader.level < region.levelMin) {
            throw new RangeError('Região bloqueada ou nível do Pokémon insuficiente para a expedição.');
          }
          // Congelar a região e o UID evita trocar Pokémon para receber XP indevida.
          state.expedition = {
            startedAt: cmd.nowMs, lastClaimAt: cmd.nowMs,
            regionId: region.id, teamUids: [leader.uid]
          };
        } else {
          // Compatibilidade com expedições antigas e fixtures anteriores à D064AK.
          state.expedition = {
            startedAt: cmd.nowMs, lastClaimAt: cmd.nowMs, teamUids: [...state.team]
          };
        }
        break;
      case 'claim-expedition':
        claimExpedition(state, cmd.nowMs, true);
        break;
      case 'stop-expedition':
        claimExpedition(state, cmd.nowMs, false);
        state.expedition = null;
        break;
      default:
        return reject(journal, 'Tipo de evento desconhecido.');
    }
    return {
      status: 'applied',
      journal: {
        raw: JSON.stringify(state),
        revision: journal.revision + 1,
        receipts: [...journal.receipts, { id: cmd.id, fingerprint }]
      }
    };
  } catch (e) {
    return reject(journal, e instanceof Error ? e.message : 'Falha de validação.');
  }
}
