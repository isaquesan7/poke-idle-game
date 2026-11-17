/**
 * Paridade PURA dos handlers "move" e "upgrade-move" do protótipo v0.1.
 *
 * A lista de golpes por espécie e o poder do golpe são dados EXTERNOS
 * fornecidos por uma camada confiável no futuro. Parâmetros do cliente
 * NÃO são prova de elegibilidade, nem autorização para salvar recompensas.
 * Esta função não lê storage, rede, relógio ou DOM e não grava saves.
 */
export type LegacyMoveAction =
  | {
    readonly type: 'select-move';
    readonly uid: number;
    readonly moveName: string;
    /** Snapshot da lista de golpes da espécie (PokéAPI/cache). */
    readonly availableMoves: readonly string[];
  }
  | {
    readonly type: 'upgrade-move';
    readonly uid: number;
    /** Detecta comando obsoleto se outro golpe foi equipado. */
    readonly moveName: string;
    /** Poder de dano base conhecido externamente, nunca calculado aqui. */
    readonly movePower: number;
  };

export type LegacyMoveEditResult =
  | { readonly status: 'ok'; readonly json: string }
  | { readonly status: 'invalid'; readonly reason: string };

type Entry = Record<string, unknown>;
type Pokemon = Entry & {
  uid: number;
  pokemonId: number;
  level: number;
  moveName?: string | null;
  upgrades?: Entry;
};

function isRecord(value: unknown): value is Entry {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number {
  return natural(value) && value > 0;
}
function moveName(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 100
    && value === value.trim();
}
function invalid(reason: string): LegacyMoveEditResult {
  return { status: 'invalid', reason };
}

/** Retorna o orçamento de ranks e o teto por golpe da v0.1. */
export function legacyMoveRankLimits(level: number): {
  readonly skillPoints: number;
  readonly maxRankPerMove: number;
} {
  if (!Number.isSafeInteger(level) || level < 1 || level > 100) {
    throw new RangeError('Nível Pokémon fora de 1..100.');
  }
  return {
    skillPoints: Math.floor(level / 5),
    maxRankPerMove: Math.min(10, Math.floor(level / 10) + 1)
  };
}

function parseSave(raw: string): { save: Entry; roster: Pokemon[] } | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed) || parsed.version !== 1
    || !isRecord(parsed.trainer) || !positive(parsed.trainer.level)
    || parsed.trainer.level > 100 || !natural(parsed.coins)
    || !Array.isArray(parsed.roster) || parsed.roster.length < 1
    || !Array.isArray(parsed.team) || parsed.team.length < 1
    || parsed.team.length > 3 || !Array.isArray(parsed.badges)
    || (parsed.expedition !== null && !isRecord(parsed.expedition))) {
    return null;
  }
  const roster: Pokemon[] = [];
  const uids = new Set<number>();
  for (const value of parsed.roster as unknown[]) {
    if (!isRecord(value) || !positive(value.uid) || uids.has(value.uid)
      || !positive(value.pokemonId) || value.pokemonId > 151
      || !positive(value.level) || value.level > 100
      || (value.moveName !== null && value.moveName !== undefined
        && !moveName(value.moveName))
      || (value.upgrades !== null && value.upgrades !== undefined
        && !isRecord(value.upgrades))) return null;
    uids.add(value.uid);
    const upgrades = isRecord(value.upgrades) ? value.upgrades : {};
    const limits = legacyMoveRankLimits(value.level);
    let spent = 0;
    for (const [key, rank] of Object.entries(upgrades)) {
      if (!moveName(key) || !natural(rank) || rank > 10) return null;
      spent += rank;
      if (!Number.isSafeInteger(spent)) return null;
    }
    if (spent > limits.skillPoints) return null;
    roster.push(value as Pokemon);
  }
  const members = new Set<number>();
  for (const uid of parsed.team as unknown[]) {
    if (!positive(uid) || members.has(uid) || !uids.has(uid)) return null;
    members.add(uid);
  }
  return { save: parsed, roster };
}

/**
 * Edita SOMENTE moveName ou upgrades do Pokémon identificado por UID.
 * Espécies repetidas não compartilham ranks; trocar golpe não apaga upgrades.
 */
export function reduceLegacyPokemonMoveJson(
  sourceJson: string,
  action: LegacyMoveAction
): LegacyMoveEditResult {
  if (typeof sourceJson !== 'string' || !action || typeof action !== 'object'
    || !positive(action.uid)) return invalid('Comando ou UID inválido.');
  const state = parseSave(sourceJson);
  if (!state) return invalid('Save v0.1 inválido ou incompatível.');
  const pokemon = state.roster.find(p => p.uid === action.uid);
  if (!pokemon) return invalid('Pokémon não pertence ao treinador.');

  if (action.type === 'select-move') {
    if (!moveName(action.moveName) || !Array.isArray(action.availableMoves)
      || !action.availableMoves.every(moveName)
      || !action.availableMoves.includes(action.moveName)) {
      return invalid('Golpe não consta na lista de golpes fornecida para a espécie.');
    }
    pokemon.moveName = action.moveName;
  } else if (action.type === 'upgrade-move') {
    if (!moveName(action.moveName) || pokemon.moveName !== action.moveName
      || !positive(action.movePower)) {
      return invalid('Golpe alterado, desconhecido ou sem dano direto.');
    }
    const upgrades: Entry = isRecord(pokemon.upgrades) ? pokemon.upgrades : {};
    const ranks = Object.values(upgrades) as number[];
    const spent = ranks.reduce((sum, rank) => sum + rank, 0);
    const current = upgrades[action.moveName] ?? 0;
    const limits = legacyMoveRankLimits(pokemon.level);
    if (!natural(current) || current >= limits.maxRankPerMove
      || spent >= limits.skillPoints) {
      return invalid('Rank máximo ou pontos de habilidade esgotados.');
    }
    upgrades[action.moveName] = current + 1;
    pokemon.upgrades = upgrades;
  } else {
    return invalid('Ação desconhecida.');
  }
  return { status: 'ok', json: JSON.stringify(state.save) };
}
