import { describe, expect, it } from 'vitest';
import {
  zeroStats, trainerTotals, canInvestTrainerPoint,
  affinityRate, trainerContribution, clampAffinity, pokemonOwnStats,
  pokemonFinalStats, xpThreshold, grantXp, expeditionRewards
} from '../src/index.js';

describe('totais do treinador — GDD', () => {
  it('limita apenas investimento manual e acumula itens/título/todas as 8 insígnias', () => {
    const manual = { ...zeroStats(), attack: 40 };
    const badges = Array.from({ length: 8 }, (_, i) => ({ id: String(i), stats: { attack: 1 } }));
    const result = trainerTotals({
      manual,
      equipment: [{ slot: 'gloves', stats: { attack: 6 } }],
      activeTitle: { attack: 2 },
      badges
    });
    expect(result.attack).toBe(56); // 40 + 6 + 2 + 8: sem teto no total
    expect(canInvestTrainerPoint(manual, 'attack', 100)).toBe(false);
    expect(canInvestTrainerPoint({ ...manual, attack: 39 }, 'attack', 1)).toBe(true);
    expect(manual.attack).toBe(40); // entrada preservada
  });
  it('não duplica bônus por mesma insígnia e rejeita slots duplicados', () => {
    const t = trainerTotals({
      manual: zeroStats(), equipment: [],
      badges: [{ id: 'boulder', stats: { defense: 1 } }, { id: 'boulder', stats: { defense: 1 } }]
    });
    expect(t.defense).toBe(1);
    expect(() => trainerTotals({
      manual: zeroStats(),
      equipment: [
        { slot: 'ring1', stats: { hp: 1 } },
        { slot: 'ring1', stats: { hp: 1 } }
      ], badges: []
    })).toThrow(/duplicado/);
  });
  it('rejeita 41 pontos manuais, mas não bônus acima de 40', () => {
    expect(() => trainerTotals({
      manual: { ...zeroStats(), hp: 41 }, equipment: [], badges: []
    })).toThrow(/Máximo manual/);
    expect(trainerTotals({
      manual: zeroStats(), equipment: [{ slot: 'hat', stats: { hp: 60 } }], badges: []
    }).hp).toBe(60);
  });
});

describe('afinidade e status Pokémon — GDD', () => {
  it('aplica floor(8–10% do treinador) como pontos, independentemente do status Pokémon', () => {
    expect(affinityRate(0)).toBeCloseTo(0.08);
    expect(affinityRate(100)).toBeCloseTo(0.10);
    expect(trainerContribution(50, 0)).toBe(4);
    expect(trainerContribution(50, 100)).toBe(5);
    expect(trainerContribution(49, 0)).toBe(3);
    expect(trainerContribution(0, 100)).toBe(0);
    expect(clampAffinity(110)).toBe(100);
    expect(clampAffinity(-7)).toBe(0);
  });
  it('usa base_stat PokéAPI, arredondamento HP e bônus treinadores aditivos', () => {
    const base = { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 };
    const before = { ...base };
    const manual = zeroStats();
    const own = pokemonOwnStats(base, 20, manual);
    expect(own.hp).toBe(48);
    expect(own.attack).toBe(24);
    const total = { ...zeroStats(), hp: 50, attack: 50 };
    const a = pokemonFinalStats(base, 20, manual, total, 0);
    const b = pokemonFinalStats(base, 20, manual, total, 100);
    expect(a.hp).toBe(52);
    expect(b.hp).toBe(53);
    expect(b.attack).toBe(29);
    expect(base).toEqual(before);
    expect(manual).toEqual(zeroStats());
  });
  it('atribui HP manual 2x, demais atributos 1x', () => {
    const base = { ...zeroStats(), hp: 45, speed: 45 };
    const own = pokemonOwnStats(base, 10, { ...zeroStats(), hp: 3, speed: 3 });
    expect(own.hp).toBe(35); // 9 + 10 + 10 + 6
    expect(own.speed).toBe(17); // 9 + 5 + 3
  });
});

describe('XP e recompensas idle v0.1 — sem state externo', () => {
  it('preserva thresholds e acumula XP sem mutar o progresso original', () => {
    expect(xpThreshold('trainer', 1)).toBe(179);
    expect(xpThreshold('pokemon', 5)).toBe(175);
    const p = { level: 1, xp: 0 };
    expect(grantXp('trainer', p, 179)).toEqual({ level: 2, xp: 0, gainedLevels: 1 });
    expect(grantXp('pokemon', { level: 5, xp: 0 }, 180)).toEqual({ level: 6, xp: 5, gainedLevels: 1 });
    expect(p).toEqual({ level: 1, xp: 0 });
  });
  it('não ultrapassa nível 100, não retém XP no cap', () => {
    expect(grantXp('trainer', { level: 100, xp: 12 }, 1000)).toEqual({
      level: 100, xp: 0, gainedLevels: 0
    });
  });
  it('premia somente ciclos completos de 10s e limita 8h por resgate', () => {
    expect(expeditionRewards(9999).cycles).toBe(0);
    expect(expeditionRewards(10000)).toEqual({
      cycles: 1, coins: 7, trainerXp: 4, pokemonXpPerMember: 5, affinityGainPerMember: 0
    });
    expect(expeditionRewards(30000).affinityGainPerMember).toBe(0); // só batalhas
    expect(expeditionRewards(9 * 3600 * 1000)).toEqual({
      cycles: 2880, coins: 20160, trainerXp: 11520,
      pokemonXpPerMember: 14400, affinityGainPerMember: 0
    });
  });
});
