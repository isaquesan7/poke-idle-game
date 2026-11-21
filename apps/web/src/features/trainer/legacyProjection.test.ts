import { describe, expect, it } from 'vitest';
import { parseLegacySave } from '../../storage/legacySave';
import {
  cachedSpecies, projectLegacyTrainer, STAT_LABELS
} from './legacyProjection';
import {
  LEGACY_ITEMS, LEGACY_BADGES, LEGACY_TITLES, effectiveLegacyTitle, xpThreshold
} from '@kanto/game-core';
import fixture from '../../../../../tests/fixtures/legacy-save-v01.json';

function project(value: unknown, cache: string | null = null, nowMs = 0) {
  const parsed = parseLegacySave(JSON.stringify(value));
  if (parsed.status !== 'valid') throw Error('Fixture inválida: ' + parsed.status);
  return projectLegacyTrainer(parsed.save, cache, nowMs);
}
function ready(value: unknown, cache: string | null = null, nowMs = 0) {
  const result = project(value, cache, nowMs);
  if (result.status !== 'ready') throw Error(result.reason);
  return result.value;
}

describe('paridade da v0.1 e game-core (fixture de save realista)', () => {
  it('mantém catálogo exato: 14 itens, 8 insígnias, 4 títulos', () => {
    expect(LEGACY_ITEMS).toHaveLength(14);
    expect(LEGACY_BADGES.map(b => b.wins)).toEqual([1,3,5,8,11,15,19,24]);
    expect(LEGACY_TITLES.map(t => t.id)).toEqual(['aprendiz','veterano','explorador','mestre']);
  });

  it('reproduz os totais do treinador da v0.1 e distribui o bônus aditivo ao Bulbasaur', () => {
    // O index.html calcula manual + itens por slot + título + TODAS as insígnias.
    // Fixture original: level21, attack manual39, gear gloves3 + ring1 2,
    // defense gear coat3 + ring2 2 + boulder1, cap2+ título aprendiz1.
    const value = ready(fixture);
    expect(value.name).toBe('Save legado v0.1');
    expect(value.level).toBe(21);
    expect(value.xpNext).toBe(xpThreshold('trainer',21)); // D-064AJ: curva longa compartilhada com o core
    expect(value.unspent).toBe(1); // (21-1)*2 - 39
    expect(value.totals).toEqual({
      hp: 3, attack: 44, defense: 6,
      specialAttack: 4, specialDefense: 3, speed: 3
    });
    expect(value.badges.map(b => b.id)).toEqual(['boulder']);
    expect(value.title.id).toBe('aprendiz');
    expect(value.active.name).toBe('Bulbasaur');
    expect(value.active.affinity).toBe(73);
    expect(value.active.ratePercent).toBeCloseTo(9.46, 8);
    expect(value.active.stats).toEqual({
      hp: 48, attack: 28, defense: 24,
      specialAttack: 31, specialDefense: 31, speed: 23
    });
    expect(value.coins).toBe(321);
    expect(value.capturedInstances).toBe(1);
    expect(value.capturedSpecies).toBe(1);
    expect(value.seenSpecies).toBe(2);
    expect(STAT_LABELS.specialDefense).toBe('SP. DEF');
  });

  it('insígnias cumulativas, sem teto global e sem mutar o save', () => {
    const save = structuredClone(fixture);
    save.trainer.manual.attack = 40;
    save.trainer.title = 'mestre';
    save.badges = LEGACY_BADGES.map(b=>b.id);
    save.wins = 24;
    const rawBefore = JSON.stringify(save);
    const data = ready(save);
    expect(data.totals.attack).toBe(48); // 40 manuais + 3 luva +2 anel +2 título +1 insígnia
    expect(data.totals.defense).toBe(7); // 3 jaqueta +2 anel +2 insígnias
    expect(data.totals.specialAttack).toBe(8); // 4 equipamentos+2 título+2 insígnias
    expect(data.title.id).toBe('mestre');
    expect(data.unspent).toBe(0);
    expect(JSON.stringify(save)).toBe(rawBefore);
  });

  it('título indisponível cai apenas na projeção para aprendiz, sem gravar save', () => {
    const value = ready({ ...fixture, trainer: { ...fixture.trainer, title: 'mestre' } });
    expect(value.title.id).toBe('aprendiz');
    expect(effectiveLegacyTitle('veterano',4,0,0).id).toBe('veterano');
    expect(effectiveLegacyTitle('explorador',0,10,0).id).toBe('explorador');
  });

  it('não inventa base_stat para Pokémon fora de snapshots sem cache da PokéAPI', () => {
    const altered = {
      ...fixture, roster:[{ ...fixture.roster[0], pokemonId: 25 }], seen:[25]
    };
    const withoutCache = ready(altered);
    expect(withoutCache.active.missingBase).toBe(true);
    expect(withoutCache.active.stats).toBeNull();
    const base = {
      hp:35, attack:55, defense:40, specialAttack:50, specialDefense:50, speed:90
    };
    const cache = JSON.stringify({ pokemon: { 25: { id:25, name:'pikachu', base } } });
    const withCache = ready(altered, cache);
    expect(withCache.active.missingBase).toBe(false);
    expect(withCache.active.stats?.hp).toBe(44); // floor(2*35*.20) +20+10 =44
    expect(cachedSpecies('{bad', 25)).toBeNull();
    expect(cachedSpecies(null, 1)?.base.hp).toBe(45);
  });

  it('estima idle sem resgatar ou mudar timestamps e preserva teto de 8 horas', () => {
    const original = JSON.stringify(fixture);
    const save = {
      ...fixture, expedition:{startedAt:1000, lastClaimAt:1000, teamUids:[1]}
    };
    const projected = ready(save,null,1000 + 9*3600*1000);
    expect(projected.expedition).toEqual({
      cycles:2880, coinsEstimate:20160, trainerXpEstimate:11520
    });
    expect(JSON.stringify(fixture)).toBe(original);
  });

  it('recusa pontos inválidos sem afetar possibilidade de exportar o save', () => {
    const invalid = {
      ...fixture, trainer: {
        ...fixture.trainer, manual: { ...fixture.trainer.manual, attack: 41 }
      }
    };
    const original = JSON.stringify(invalid);
    expect(project(invalid).status).toBe('unavailable');
    expect(JSON.stringify(invalid)).toBe(original);
  });
});
