import { describe, expect, it } from 'vitest';
import {
  editLegacyTrainerJson, validLegacyTrainerDraft, LEGACY_EQUIPMENT_SLOTS
} from '../src/legacy/trainerDraft.js';

const save = {
  version: 1, name: 'Treinador de Kanto', coins: 321,
  trainer: {
    level: 21, xp: 17, manual: {
      hp: 0, attack: 39, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0
    },
    equipped: { hat: 'cap', jacket: 'coat', gloves: 'gloves', ring1: 'ring-a' },
    title: 'aprendiz'
  },
  badges: ['boulder'], team: [1], roster: [
    { uid: 1, pokemonId: 1, level: 20, affinity: 73 }
  ], nextUid: 2, expedition: { startedAt: 8, lastClaimAt: 15, teamUids: [1] }
};
const raw = JSON.stringify(save);

describe('rascunho de treinamento: regras puras de domínio', () => {
  it('aplica último ponto manual, não altera entrada nem concede recompensas', () => {
    const result = editLegacyTrainerJson(raw, { type: 'invest', stat: 'attack' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const after = JSON.parse(result.json);
    expect(after.trainer.manual.attack).toBe(40);
    expect(after.coins).toBe(321);
    expect(after.trainer.xp).toBe(17);
    expect(after.roster[0].affinity).toBe(73);
    expect(after.expedition.lastClaimAt).toBe(15);
    expect(raw).toBe(JSON.stringify(save));
    expect(validLegacyTrainerDraft(raw, result.json)).toBe(true);
    expect(editLegacyTrainerJson(result.json, { type: 'invest', stat: 'attack' }).status).toBe('invalid');
  });

  it('não deixa passar teto de 40 ou limite total de 2 por nível', () => {
    expect(editLegacyTrainerJson(raw, { type: 'invest', stat: 'hp' }).status).toBe('ok');
    const exhausted = JSON.stringify({ ...save,
      trainer: { ...save.trainer, manual: { ...save.trainer.manual, attack: 40 } }
    });
    expect(editLegacyTrainerJson(exhausted, { type: 'invest', stat: 'hp' }).status).toBe('invalid');
    const overCap = JSON.stringify({ ...save,
      trainer: { ...save.trainer, manual: { ...save.trainer.manual, attack: 41 } }
    });
    expect(editLegacyTrainerJson(overCap, { type: 'invest', stat: 'hp' }).status).toBe('invalid');
  });

  it('mantém 9 slots e só equipa itens existentes no slot correto', () => {
    expect(LEGACY_EQUIPMENT_SLOTS).toHaveLength(9);
    const result = editLegacyTrainerJson(raw, { type: 'equip', slot: 'gloves', itemId: 'gloves-tech' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(JSON.parse(result.json).trainer.equipped.gloves).toBe('gloves-tech');
    expect(validLegacyTrainerDraft(raw, result.json)).toBe(true);
    expect(editLegacyTrainerJson(raw, { type: 'equip', slot: 'gloves', itemId: 'ring-a' }).status).toBe('invalid');
    expect(editLegacyTrainerJson(raw, { type: 'equip', slot: 'gloves', itemId: '' }).status).toBe('ok');
  });

  it('bloqueia alteração direta de moedas, insígnias, XP, UID e demais dados', () => {
    const forged = [
      { ...save, coins: 999 },
      { ...save, badges: ['boulder', 'rainbow'] },
      { ...save, trainer: { ...save.trainer, xp: 999 } },
      { ...save, roster: [{ ...save.roster[0], affinity: 100 }] },
      { ...save, expedition: { ...save.expedition, lastClaimAt: 1234 } }
    ];
    for (const candidate of forged) {
      expect(validLegacyTrainerDraft(raw, JSON.stringify(candidate))).toBe(false);
    }
  });

  it('rejeita alterações inválidas do manual, de campos extras e equipamento forjado', () => {
    const inject = (manual: unknown, equipped: unknown) => JSON.stringify({
      ...save, trainer: { ...save.trainer, manual, equipped }
    });
    expect(validLegacyTrainerDraft(raw, inject({ ...save.trainer.manual, attack: 38 }, save.trainer.equipped))).toBe(false);
    expect(validLegacyTrainerDraft(raw, inject({ ...save.trainer.manual, attack: 41 }, save.trainer.equipped))).toBe(false);
    expect(validLegacyTrainerDraft(raw, inject({ ...save.trainer.manual, injected: 3 }, save.trainer.equipped))).toBe(false);
    expect(validLegacyTrainerDraft(raw, inject(save.trainer.manual, { ...save.trainer.equipped, gloves: 'ring-c' }))).toBe(false);
  });
});
