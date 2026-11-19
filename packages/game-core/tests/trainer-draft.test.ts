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


describe('D-051 — seleção segura de títulos do treinador',()=>{
  const withProgress=(wins:number,seenCount:number,badges:string[])=>
    JSON.stringify({...save,wins,seen:Array.from({length:seenCount},(_,i)=>i+1),badges});

  it('mantém títulos bloqueados até cumprir vitória, Pokédex e insígnias',()=>{
    const baseline=withProgress(0,1,[]);
    for(const titleId of ['veterano','explorador','mestre','forged']){
      expect(editLegacyTrainerJson(baseline,{type:'title',titleId}).status).toBe('invalid');
    }
    const veteran=editLegacyTrainerJson(withProgress(4,1,[]),{type:'title',titleId:'veterano'});
    const explorer=editLegacyTrainerJson(withProgress(0,10,[]),{type:'title',titleId:'explorador'});
    const master=editLegacyTrainerJson(withProgress(0,1,['boulder','cascade','thunder','rainbow','soul','marsh','volcano','earth']),{type:'title',titleId:'mestre'});
    for(const result of [veteran,explorer,master])expect(result.status).toBe('ok');
  });

  it('altera só o título, preservando XP, moedas, badges e a equipe',()=>{
    const before=withProgress(4,1,['boulder']);
    const selected=editLegacyTrainerJson(before,{type:'title',titleId:'veterano'});
    expect(selected.status).toBe('ok');
    if(selected.status!=='ok')return;
    expect(validLegacyTrainerDraft(before,selected.json)).toBe(true);
    const after=JSON.parse(selected.json);
    const original=JSON.parse(before);
    expect(after.trainer.title).toBe('veterano');
    expect(after.trainer.manual).toEqual(original.trainer.manual);
    expect(after.trainer.equipped).toEqual(original.trainer.equipped);
    expect(after.coins).toBe(original.coins);
    expect(after.badges).toEqual(original.badges);
    expect(after.roster).toEqual(original.roster);
    expect(after.expedition).toEqual(original.expedition);
  });

  it('não permite título forjado em draft nem alterações de recompensa',()=>{
    const before=withProgress(0,1,[]);
    const candidate=JSON.parse(before);
    candidate.trainer.title='mestre';
    expect(validLegacyTrainerDraft(before,JSON.stringify(candidate))).toBe(false);
    candidate.trainer.title='aprendiz';
    candidate.coins=999;
    expect(validLegacyTrainerDraft(before,JSON.stringify(candidate))).toBe(false);
  });
});


describe('D-053 — transição opcional para equipamentos de propriedade real',()=>{
  const inventoryRaw=(ownedEquipment:Record<string,number>)=>JSON.stringify({
    ...save,inventory:{version:1,ownedEquipment,extraBagSlots:0}
  });
  it('saves antigos mantêm o laboratório; ledger presente não concede itens de catálogo',()=>{
    expect(editLegacyTrainerJson(raw,{type:'equip',slot:'gloves',itemId:'gloves-tech'}).status).toBe('ok');
    const locked=inventoryRaw({cap:1});
    expect(editLegacyTrainerJson(locked,{type:'equip',slot:'gloves',itemId:'gloves-tech'}).status).toBe('invalid');
    const candidate=JSON.parse(locked);
    candidate.trainer.equipped.gloves='gloves-tech';
    expect(validLegacyTrainerDraft(locked,JSON.stringify(candidate))).toBe(false);
  });
  it('permite só equipamento possuído no slot e devolve item sem consumir propriedade',()=>{
    const before=inventoryRaw({cap:1,'gloves-tech':1});
    const changed=editLegacyTrainerJson(before,{type:'equip',slot:'gloves',itemId:'gloves-tech'});
    expect(changed.status).toBe('ok');
    if(changed.status!=='ok')return;
    expect(validLegacyTrainerDraft(before,changed.json)).toBe(true);
    const game=JSON.parse(changed.json);
    expect(game.inventory.ownedEquipment['gloves-tech']).toBe(1);
    expect(game.coins).toBe(save.coins);
    expect(game.roster).toEqual(save.roster);
    expect(editLegacyTrainerJson(changed.json,{type:'equip',slot:'gloves',itemId:''}).status).toBe('ok');
    const forged=JSON.parse(changed.json);
    forged.inventory.ownedEquipment.coat=99;
    expect(validLegacyTrainerDraft(before,JSON.stringify(forged))).toBe(false);
  });
  it('bloqueia ledger corrompido sem alterar o save',()=>{
    const corrupt=JSON.stringify({...save,inventory:{version:1,ownedEquipment:{cap:-2},extraBagSlots:0}});
    expect(editLegacyTrainerJson(corrupt,{type:'equip',slot:'hat',itemId:'cap'}).status).toBe('invalid');
  });
});
