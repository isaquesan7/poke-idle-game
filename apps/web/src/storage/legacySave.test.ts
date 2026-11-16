import { describe, expect, it } from 'vitest';
import { LEGACY_SAVE_KEY, parseLegacySave, readLegacySave } from './legacySave';

const fixture = {
  version: 1, name: 'Save original', coins: 321,
  trainer: { level: 21, xp: 7, manual: { attack: 40 } },
  roster: [{ uid: 1, pokemonId: 1, level: 20, affinity: 73, upgrades: {} }],
  team: [1], badges: ['boulder'], lastClaim: null
};

describe('adapter de save v0.1 (somente leitura)', () => {
  it('preserva todos os campos e o JSON original para backup sem alterá-lo', () => {
    const raw = JSON.stringify(fixture);
    const result = parseLegacySave(raw);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.raw).toBe(raw);
    expect(result.save.roster[0]?.affinity).toBe(73);
    expect(result.save.name).toBe('Save original');
    expect(result.save.lastClaim).toBe(null);
    expect(raw).toBe(JSON.stringify(fixture));
  });
  it('distingue save inexistente, inválido e versão ainda não suportada', () => {
    expect(parseLegacySave(null).status).toBe('absent');
    expect(parseLegacySave('{broken').status).toBe('invalid');
    expect(parseLegacySave(JSON.stringify({ ...fixture, version: 2 })).status).toBe('unsupported');
    expect(parseLegacySave(JSON.stringify({ ...fixture, roster: [] })).status).toBe('invalid');
  });
  it('lê a chave existente sem usar escrita e lida com storage indisponível', () => {
    const requested: string[] = [];
    const result = readLegacySave(key => {
      requested.push(key);
      return JSON.stringify(fixture);
    });
    expect(result.status).toBe('valid');
    expect(requested).toEqual([LEGACY_SAVE_KEY]);
    expect(readLegacySave(() => { throw new Error('Bloqueado'); }).status).toBe('unavailable');
  });
});
