import { describe, expect, it } from 'vitest';
import {
  legacyMoveRankLimits, reduceLegacyPokemonMoveJson
} from '../src/index.js';
import type { LegacyMoveAction } from '../src/index.js';

const pokemon = (uid: number, level = 30) => ({
  uid, pokemonId: 1, level, xp: 12, affinity: 77,
  manual: { hp: 2, attack: 1, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
  moveName: 'tackle' as string | null,
  upgrades: { tackle: 1 } as Record<string, number>,
  customPokemon: { uid }
});
const source = () => ({
  version: 1, name: 'Kanto', mode: 'demo',
  trainer: { level: 21, xp: 14, manual: { attack: 39 }, title: 'aprendiz' },
  coins: 511, wins: 3, losses: 1,
  roster: [pokemon(1), pokemon(2)],
  team: [1, 2], badges: ['boulder', 'cascade'], nextUid: 3,
  expedition: null as null | Record<string, unknown>,
  lastClaim: { cycles: 7 }, customRoot: 'intocável'
});
const raw = JSON.stringify(source());
type SelectMoveCommand = Extract<LegacyMoveAction, { type: 'select-move' }>;
type UpgradeMoveCommand = Extract<LegacyMoveAction, { type: 'upgrade-move' }>;
const select = (uid = 1, moveName = 'vine-whip'): SelectMoveCommand => ({
  type: 'select-move', uid, moveName,
  availableMoves: ['tackle', 'vine-whip', 'growl']
});
const upgrade = (uid = 1, moveName = 'tackle', movePower = 40): UpgradeMoveCommand => ({
  type: 'upgrade-move', uid, moveName, movePower
});

function apply(text: string, action: LegacyMoveAction): ReturnType<typeof source> {
  const result = reduceLegacyPokemonMoveJson(text, action);
  expect(result.status, JSON.stringify(result)).toBe('ok');
  if (result.status !== 'ok') throw Error(result.reason);
  return JSON.parse(result.json) as ReturnType<typeof source>;
}
function deny(text: string, action: LegacyMoveAction): void {
  const result = reduceLegacyPokemonMoveJson(text, action);
  expect(result.status).toBe('invalid');
}

describe('golpes do Pokémon por UID: reducer puro v0.1', () => {
  it('preserva espécies repetidas e não perde ranks ao trocar o golpe', () => {
    const changed = apply(raw, select());
    expect(changed.roster[0]?.moveName).toBe('vine-whip');
    expect(changed.roster[0]?.upgrades).toEqual({ tackle: 1 });
    expect(changed.roster[1]).toEqual(source().roster[1]);
    expect({ ...changed, roster: source().roster }).toEqual(source());
    expect(JSON.parse(raw)).toEqual(source());
  });

  it('permite trocar golpe ao voltar para um já melhorado, sem gastar pontos', () => {
    const first = apply(raw, select());
    const second = apply(JSON.stringify(first), select(1, 'tackle'));
    expect(second.roster[0]?.upgrades.tackle).toBe(1);
    expect(second.trainer).toEqual(source().trainer);
    expect(second.coins).toBe(511);
  });

  it('aprimora apenas o golpe selecionado do UID correto', () => {
    const changed = apply(raw, upgrade());
    expect(changed.roster[0]?.upgrades.tackle).toBe(2);
    expect(changed.roster[0]?.xp).toBe(12);
    expect(changed.roster[0]?.affinity).toBe(77);
    expect(changed.roster[1]).toEqual(source().roster[1]);
    expect(changed.badges).toEqual(source().badges);
    expect(changed.nextUid).toBe(3);
    expect(changed.lastClaim).toEqual({ cycles: 7 });
    expect(changed.customRoot).toBe('intocável');
  });

  it('usa floor(level/5) para orçamento e min(10, floor(level/10)+1) para teto por golpe', () => {
    expect(legacyMoveRankLimits(1)).toEqual({ skillPoints: 0, maxRankPerMove: 1 });
    expect(legacyMoveRankLimits(5)).toEqual({ skillPoints: 1, maxRankPerMove: 1 });
    expect(legacyMoveRankLimits(10)).toEqual({ skillPoints: 2, maxRankPerMove: 2 });
    expect(legacyMoveRankLimits(30)).toEqual({ skillPoints: 6, maxRankPerMove: 4 });
    expect(legacyMoveRankLimits(100)).toEqual({ skillPoints: 20, maxRankPerMove: 10 });
    expect(() => legacyMoveRankLimits(101)).toThrow();
  });

  it('recusa aprimorar sem pontos, com rank máximo ou golpe sem dano', () => {
    const maxRank = source();
    maxRank.roster[0]!.upgrades = { tackle: 4 };
    deny(JSON.stringify(maxRank), upgrade());
    const exhausted = source();
    exhausted.roster[0]!.upgrades = { tackle: 3, 'vine-whip': 3 };
    deny(JSON.stringify(exhausted), upgrade());
    const lowLevel = source();
    lowLevel.roster[0]!.level = 1;
    lowLevel.roster[0]!.upgrades = {};
    deny(JSON.stringify(lowLevel), upgrade());
    deny(raw, upgrade(1, 'tackle', 0));
    deny(raw, upgrade(1, 'tackle', -5));
    deny(raw, upgrade(1, 'tackle', NaN));
    deny(raw, upgrade(1, 'vine-whip', 40));
  });

  it('recusa troca para golpe fora da lista explícita da espécie', () => {
    deny(raw, select(1, 'hyper-beam'));
    deny(raw, { ...select(), availableMoves: ['tackle', 'growl'] });
    deny(raw, { ...select(), availableMoves: [] });
    deny(raw, { ...select(), availableMoves: [''] });
    deny(raw, select(999));
  });

  it('rejeita save inválido, versões futuras, UIDs duplicados, ranks fracionários e orçamento estourado', () => {
    deny('{', select());
    deny(JSON.stringify({ ...source(), version: 2 }), select());
    deny(JSON.stringify({ ...source(), team: [999] }), select());
    const dup = source();
    dup.roster[1]!.uid = 1;
    deny(JSON.stringify(dup), select());
    const fraction = source();
    fraction.roster[0]!.upgrades = { tackle: 1.5 };
    deny(JSON.stringify(fraction), upgrade());
    const tooMany = source();
    tooMany.roster[0]!.upgrades = { tackle: 7 };
    deny(JSON.stringify(tooMany), upgrade());
  });

  it('aceita versões legadas sem upgrades e inicia a contagem no primeiro aprimoramento', () => {
    const legacy = source();
    const minimal = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    const roster = minimal.roster as Record<string, unknown>[];
    delete roster[0]!.upgrades;
    const changed = apply(JSON.stringify(minimal), upgrade());
    expect(changed.roster[0]?.upgrades.tackle).toBe(1);
  });

  it('não confunde golpe escolhido com os membros da equipe e não impede treino em expedição', () => {
    const during = source();
    during.expedition = { startedAt: 100, lastClaimAt: 100, teamUids: [1, 2] };
    const changed = apply(JSON.stringify(during), upgrade(2));
    expect(changed.roster[0]?.upgrades.tackle).toBe(1);
    expect(changed.roster[1]?.upgrades.tackle).toBe(2);
    expect(changed.expedition).toEqual(during.expedition);
  });

  it('não aceita tipos de ação ou UIDs inesperados', () => {
    deny(raw, { ...select(), type: 'not-supported' as 'select-move' });
    deny(raw, { ...select(), uid: -1 });
    deny(raw, { ...select(), uid: 1.5 });
  });
});
