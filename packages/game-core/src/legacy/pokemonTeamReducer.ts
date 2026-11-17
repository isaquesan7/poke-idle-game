/**
 * Redutores PUROS das ações de Pokémon/equipe existentes na v0.1.
 *
 * Consomem e produzem JSON separado: não leem relógio, PokéAPI, DOM,
 * localStorage ou estado global. Nunca concedem XP, moedas ou capturas.
 * NÃO são conectados ao writer oficial v0.2 (que segue bloqueado).
 */
import { STATS, zeroStats } from '../stats/types.js';
import type { Stat, StatValues } from '../stats/types.js';

export const LEGACY_POKEMON_POINTS_PER_LEVEL = 2;
export const LEGACY_TEAM_MAX_MEMBERS = 3;

export type LegacyPokemonTeamAction =
  | { readonly type: 'invest-pokemon'; readonly uid: number; readonly stat: Stat }
  | { readonly type: 'reset-pokemon'; readonly uid: number }
  | { readonly type: 'add-team'; readonly uid: number }
  | { readonly type: 'remove-team'; readonly uid: number }
  | { readonly type: 'set-active'; readonly uid: number };

export type LegacyPokemonTeamEditResult =
  | { readonly status: 'ok'; readonly json: string }
  | { readonly status: 'invalid'; readonly reason: string };

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function positive(value: unknown): value is number {
  return natural(value) && value > 0;
}

/**
 * Retorna o orçamento manual de UM Pokémon conforme nível 1–100 da v0.1:
 * 2 pontos para cada nível adquirido. Não confundir com o teto de 40 do
 * TREINADOR, que não existe por atributo no treino de Pokémon legado.
 */
export function legacyPokemonManualBudget(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > 100) {
    throw new RangeError('Nível de Pokémon deve estar entre 1 e 100.');
  }
  return (level - 1) * LEGACY_POKEMON_POINTS_PER_LEVEL;
}

/** Campos omitidos no manual v0.1 são zero (mesmo default aplicado em init). */
function readManual(value: unknown, level: number): StatValues | null {
  if (value !== null && value !== undefined && !record(value)) return null;
  const input = record(value) ? value : {};
  if (Object.keys(input).some(key => !(STATS as readonly string[]).includes(key))) {
    // Campos desconhecidos no orçamento da v0.1 requerem auditoria manual.
    return null;
  }
  const manual = zeroStats();
  const budget = legacyPokemonManualBudget(level);
  let spent = 0;
  for (const stat of STATS) {
    const amount = input[stat] ?? 0;
    if (!natural(amount) || amount > budget) return null;
    spent += amount;
    manual[stat] = amount;
  }
  return spent <= budget ? manual : null;
}

interface ValidPokemon {
  readonly value: RecordValue;
  readonly manual: StatValues;
  readonly level: number;
}

/** Rejeita saves futuros/ambíguos antes de qualquer alteração de campo. */
function parseValidState(raw: string): {
  source: RecordValue;
  roster: ValidPokemon[];
  team: number[];
} | null {
  let candidate: unknown;
  try { candidate = JSON.parse(raw); }
  catch { return null; }
  if (!record(candidate) || candidate.version !== 1
    || !record(candidate.trainer) || !positive(candidate.trainer.level)
    || candidate.trainer.level > 100
    || typeof candidate.name !== 'string' || !natural(candidate.coins)
    || !Array.isArray(candidate.badges)
    || !candidate.badges.every(x => typeof x === 'string')
    || !Array.isArray(candidate.roster) || candidate.roster.length === 0
    || !Array.isArray(candidate.team) || candidate.team.length < 1
    || candidate.team.length > LEGACY_TEAM_MAX_MEMBERS
    || (candidate.expedition != null && !record(candidate.expedition))) return null;

  const roster: ValidPokemon[] = [];
  const uids = new Set<number>();
  for (const candidatePokemon of candidate.roster as unknown[]) {
    if (!record(candidatePokemon)
      || !positive(candidatePokemon.uid) || uids.has(candidatePokemon.uid)
      || !positive(candidatePokemon.pokemonId) || candidatePokemon.pokemonId > 151
      || !positive(candidatePokemon.level) || candidatePokemon.level > 100
      || !natural(candidatePokemon.affinity) || candidatePokemon.affinity > 100) {
      return null;
    }
    const manual = readManual(candidatePokemon.manual, candidatePokemon.level);
    if (!manual) return null;
    uids.add(candidatePokemon.uid);
    roster.push({ value: candidatePokemon, manual, level: candidatePokemon.level });
  }

  const team: number[] = [];
  const selected = new Set<number>();
  for (const uid of candidate.team as unknown[]) {
    if (!positive(uid) || selected.has(uid) || !uids.has(uid)) return null;
    selected.add(uid);
    team.push(uid);
  }
  return { source: candidate, roster, team };
}

/**
 * Aplica UMA ação legada a uma cópia do JSON, sem modificar entrada/estado
 * persistido. Valida integridade do time e dos UID antes de cada operação.
 *
 * O resultado 'ok' é APENAS um novo texto experimental; não escreve save,
 * não promove rascunhos e não significa autorização para migração.
 */
export function reduceLegacyPokemonTeamJson(
  sourceJson: string, action: LegacyPokemonTeamAction
): LegacyPokemonTeamEditResult {
  const parsed = parseValidState(sourceJson);
  if (!parsed) return { status: 'invalid', reason: 'Save v0.1 ou equipe inválida.' };
  if (!positive(action.uid)) {
    return { status: 'invalid', reason: 'UID da instância Pokémon inválido.' };
  }
  const target = parsed.roster.find(p => p.value.uid === action.uid);
  if (!target) return { status: 'invalid', reason: 'Pokémon UID inexistente neste save.' };

  switch (action.type) {
    case 'invest-pokemon': {
      if (!(STATS as readonly string[]).includes(action.stat)) {
        return { status: 'invalid', reason: 'Atributo Pokémon desconhecido.' };
      }
      const spent = STATS.reduce((sum, stat) => sum + target.manual[stat], 0);
      if (spent >= legacyPokemonManualBudget(target.level)) {
        return { status: 'invalid', reason: 'Sem pontos manuais disponíveis neste Pokémon.' };
      }
      target.value.manual = {
        ...target.manual,
        [action.stat]: target.manual[action.stat] + 1
      };
      break;
    }
    case 'reset-pokemon':
      // Redistribuição gratuita apenas dos pontos da instância indicada.
      target.value.manual = zeroStats();
      break;
    case 'add-team':
      if (parsed.source.expedition != null) {
        return { status: 'invalid', reason: 'Não alterar equipe durante uma expedição.' };
      }
      if (parsed.team.includes(action.uid)) {
        return { status: 'invalid', reason: 'Pokémon já está na equipe.' };
      }
      if (parsed.team.length >= LEGACY_TEAM_MAX_MEMBERS) {
        return { status: 'invalid', reason: 'Equipe já possui três Pokémon.' };
      }
      parsed.source.team = [...parsed.team, action.uid];
      break;
    case 'set-active':
      // A posição 0 é o Pokémon que participa da batalha.
      // Promovemos somente um UID JÁ pertencente à equipe, sem criar duplicatas.
      if (parsed.source.expedition != null) {
        return { status: 'invalid', reason: 'Não alterar líder durante uma expedição.' };
      }
      if (!parsed.team.includes(action.uid)) {
        return { status: 'invalid', reason: 'Adicione o Pokémon à equipe antes de torná-lo líder.' };
      }
      if (parsed.team[0] === action.uid) {
        return { status: 'invalid', reason: 'Pokémon já é o líder da equipe.' };
      }
      parsed.source.team = [action.uid, ...parsed.team.filter(uid => uid !== action.uid)];
      break;
    case 'remove-team':
      if (parsed.source.expedition != null) {
        return { status: 'invalid', reason: 'Não alterar equipe durante uma expedição.' };
      }
      if (!parsed.team.includes(action.uid)) {
        return { status: 'invalid', reason: 'Pokémon não está na equipe.' };
      }
      if (parsed.team.length <= 1) {
        return { status: 'invalid', reason: 'A equipe precisa manter um Pokémon.' };
      }
      parsed.source.team = parsed.team.filter(uid => uid !== action.uid);
      break;
    default:
      return { status: 'invalid', reason: 'Ação de Pokémon/equipe desconhecida.' };
  }
  return { status: 'ok', json: JSON.stringify(parsed.source) };
}
