/**
 * Projeção somente de leitura de um save v0.1 para telas React.
 * Fontes: dados legados + funções puras do @kanto/game-core.
 * NEVER: setItem, migração, concessão de XP, edição de equipamento.
 */
import {
  STATS, zeroStats, trainerTotals, pokemonFinalStats,
  xpThreshold, affinityRate, expeditionRewards
} from '@kanto/game-core';
import type { Stat, StatValues, EquipmentSlot } from '@kanto/game-core';
import {
  LEGACY_ITEMS, KANTO_GYMS, LEGACY_STARTERS, effectiveLegacyTitle
} from '@kanto/game-core';
import type { LegacyItem, LegacyBadge, LegacySpecies, LegacyTitle } from '@kanto/game-core';
import type { LegacySave } from '../../storage/legacySave';

export const STAT_LABELS: Record<Stat, string> = {
  hp: 'HP', attack: 'ATK', defense: 'DEF',
  specialAttack: 'SP. ATK', specialDefense: 'SP. DEF', speed: 'SPD'
};

export interface TrainerViewModel {
  readonly name: string;
  readonly level: number;
  readonly xp: number;
  readonly xpNext: number | null;
  readonly coins: number;
  readonly wins: number;
  readonly manual: Readonly<StatValues>;
  readonly totals: Readonly<StatValues>;
  readonly unspent: number;
  readonly equipped: readonly LegacyItem[];
  readonly title: LegacyTitle;
  readonly badges: readonly (LegacyBadge)[];
  readonly capturedSpecies: number;
  readonly capturedInstances: number;
  readonly seenSpecies: number;
  readonly active: {
    readonly id: number;
    readonly uid: number;
    readonly name: string;
    readonly level: number;
    readonly affinity: number;
    readonly ratePercent: number;
    readonly stats: Readonly<StatValues> | null;
    readonly missingBase: boolean;
  };
  readonly expedition: {
    readonly cycles: number;
    readonly coinsEstimate: number;
    readonly trainerXpEstimate: number;
  } | null;
}

export type ProjectionResult =
  | { readonly status: 'ready'; readonly value: TrainerViewModel }
  | { readonly status: 'unavailable'; readonly reason: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function natural(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

/** Campos manuais omitidos pela v0.1 são tratados como 0, sem persistir defaults. */
function readStatValues(input: unknown): StatValues | null {
  if (!isRecord(input)) return null;
  const output = zeroStats();
  for (const stat of STATS) {
    const value = input[stat] ?? 0;
    if (!natural(value)) return null;
    output[stat] = value;
  }
  return output;
}

/** Dados normalizados do cache v0.1, nunca tratar ausência como base=0. */
export function cachedSpecies(rawCache: string | null, pokemonId: number): LegacySpecies | null {
  if (!natural(pokemonId) || pokemonId < 1 || pokemonId > 151) return null;
  if (rawCache !== null) {
    try {
      const parsed: unknown = JSON.parse(rawCache);
      if (isRecord(parsed) && isRecord(parsed.pokemon)) {
        const entry = parsed.pokemon[String(pokemonId)];
        if (isRecord(entry) && typeof entry.name === 'string' && isRecord(entry.base)) {
          const base = readStatValues(entry.base);
          if (base) return { id: pokemonId, name: entry.name, base };
        }
      }
    } catch {
      // Cache corrompido não deve impedir a leitura do save original.
    }
  }
  return LEGACY_STARTERS[pokemonId] ?? null;
}

/** Retorna projeção, ou motivo explícito; não conserta automaticamente dados. */
export function projectLegacyTrainer(
  save: LegacySave, rawCache: string | null, nowMs: number
): ProjectionResult {
  try {
    const trainer = save.trainer;
    const manual = readStatValues(trainer.manual);
    if (!manual) return { status: 'unavailable', reason: 'Pontos manuais ausentes ou inválidos no save.' };

    const selectedEquipment = isRecord(trainer.equipped) ? trainer.equipped : {};
    const equipped = LEGACY_ITEMS.filter(item => selectedEquipment[item.slot] === item.id);
    const badged = new Set(save.badges);
    const badges:LegacyBadge[] = KANTO_GYMS.filter(gym => badged.has(gym.id))
      .map(gym=>({id:gym.id,name:gym.name,wins:0,stats:gym.badgeStats}));
    const wins = natural(save.wins) ? save.wins : 0;
    const seenCount = Array.isArray(save.seen) ? save.seen.length : 0;
    const title = effectiveLegacyTitle(trainer.title, wins, seenCount, save.badges.length);
    const totals = trainerTotals({
      manual,
      equipment: equipped.map(item => ({ slot: item.slot, stats: item.stats })),
      activeTitle: title.stats,
      badges: badges.map(badge => ({ id: badge.id, stats: badge.stats }))
    });
    const xp = natural(trainer.xp) ? trainer.xp : 0;
    const earned = Math.max(0, (trainer.level - 1) * 2);
    const unspent = Math.max(0, earned - STATS.reduce((sum, stat) => sum + manual[stat], 0));
    const active = save.roster.find(p => p.uid === save.team[0]) ?? save.roster[0];
    if (!active) return { status: 'unavailable', reason: 'O save não possui Pokémon ativo.' };
    const species = cachedSpecies(rawCache, active.pokemonId);
    const pokemonManual = readStatValues(active.manual) ?? zeroStats();
    const stats = species
      ? pokemonFinalStats(species.base, active.level, pokemonManual, totals, active.affinity)
      : null;

    let expedition: TrainerViewModel['expedition'] = null;
    if (isRecord(save.expedition) && natural(save.expedition.lastClaimAt) && Number.isFinite(nowMs)) {
      const rewards = expeditionRewards(nowMs - save.expedition.lastClaimAt);
      expedition = {
        cycles: rewards.cycles,
        coinsEstimate: rewards.coins,
        trainerXpEstimate: rewards.trainerXp
      };
    }

    return {
      status: 'ready',
      value: {
        name: save.name,
        level: trainer.level,
        xp,
        xpNext: trainer.level < 100 ? xpThreshold('trainer', trainer.level) : null,
        coins: save.coins,
        wins,
        manual,
        totals,
        unspent,
        equipped,
        title,
        badges,
        capturedSpecies: new Set(save.roster.map(p => p.pokemonId)).size,
        capturedInstances: save.roster.length,
        seenSpecies: seenCount,
        active: {
          id: active.pokemonId,
          uid: active.uid,
          name: species?.name ?? 'Espécie #' + active.pokemonId,
          level: active.level,
          affinity: active.affinity,
          ratePercent: affinityRate(active.affinity) * 100,
          stats,
          missingBase: !species
        },
        expedition
      }
    };
  } catch {
    return {
      status: 'unavailable',
      reason: 'Não foi possível calcular os atributos a partir deste save; os dados foram preservados.'
    };
  }
}
