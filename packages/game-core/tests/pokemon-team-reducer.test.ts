import { describe, expect, it } from 'vitest';
import {
  legacyPokemonManualBudget, reduceLegacyPokemonTeamJson,
  LEGACY_TEAM_MAX_MEMBERS
} from '../src/index.js';
import type { LegacyPokemonTeamAction } from '../src/index.js';

const manual = () => ({
  hp: 0, attack: 0, defense: 0,
  specialAttack: 0, specialDefense: 0, speed: 0
});
const pokemon = (uid: number, level=20) => ({
  uid, pokemonId: 1, level, xp: 12,
  affinity: uid === 1 ? 73 : 0,
  manual: { ...manual(), hp: uid === 1 ? 3 : 0 },
  moveName: 'vine-whip', upgrades: { 'vine-whip': 1 },
  customPokemonData: { marker: 'preservado', uid }
});
const state = () => ({
  version: 1, mode: 'demo', name: 'Treinador de Kanto',
  trainer: { level: 21, xp: 16, manual: { ...manual(), attack: 40 }, title: 'aprendiz' },
  coins: 321, wins: 1, losses: 0, badges: ['boulder'],
  roster: [pokemon(1), pokemon(2), pokemon(3)], team: [1],
  nextUid: 4, expedition: null, lastClaim: { coins: 7, cycles: 1 },
  customRootData: { saved: true, word: 'Kanto 🐉' }
});
const source = JSON.stringify(state());

function apply(raw: string, action: LegacyPokemonTeamAction) {
  return reduceLegacyPokemonTeamJson(raw, action);
}
function edited(raw: string, action: LegacyPokemonTeamAction): ReturnType<typeof state> {
  const result=apply(raw,action);
  expect(result.status).toBe('ok');
  if(result.status!=='ok')throw Error(result.reason);
  return JSON.parse(result.json) as ReturnType<typeof state>;
}
function reject(raw: string, action: LegacyPokemonTeamAction): void {
  expect(apply(raw,action).status).toBe('invalid');
}

describe('redutores puros da v0.1 — atributos por Pokémon/UID',()=>{
  it('preserva UID, espécie, recursos, XP, afinidade, golpes, campos extras e a ENTRADA',()=>{
    const input=source;
    const output=edited(input,{type:'invest-pokemon',uid:1,stat:'hp'});
    expect(output.roster[0]?.manual.hp).toBe(4);
    expect(output.roster[0]?.manual.attack).toBe(0);
    expect(output.roster[1]).toEqual(state().roster[1]);
    expect(output.team).toEqual([1]);
    expect(output.trainer).toEqual(state().trainer);
    expect(output.coins).toBe(321);
    expect(output.badges).toEqual(['boulder']);
    expect(output.nextUid).toBe(4);
    expect(output.customRootData).toEqual(state().customRootData);
    expect(output.roster[0]?.customPokemonData).toEqual(state().roster[0]?.customPokemonData);
    expect(input).toBe(JSON.stringify(state()));
    // Mesma ação com mesma entrada => saída igual, sem RNG/storage/relógio.
    expect(apply(input,{type:'invest-pokemon',uid:1,stat:'hp'}))
      .toEqual(apply(input,{type:'invest-pokemon',uid:1,stat:'hp'}));
  });

  it('aplica 2 pontos por nível e não impõe erroneamente cap 40 DO TREINADOR',()=>{
    expect(legacyPokemonManualBudget(1)).toBe(0);
    expect(legacyPokemonManualBudget(20)).toBe(38);
    expect(legacyPokemonManualBudget(100)).toBe(198);
    expect(() => legacyPokemonManualBudget(101)).toThrow();
    expect(() => legacyPokemonManualBudget(0)).toThrow();
    const maxLevel=state();
    maxLevel.roster[0]!.level=100;
    maxLevel.roster[0]!.manual={...manual(),attack:41};
    const after=edited(JSON.stringify(maxLevel),{
      type:'invest-pokemon',uid:1,stat:'attack'
    });
    expect(after.roster[0]?.manual.attack).toBe(42);
    expect(after.trainer.manual.attack).toBe(40);
  });

  it('recusa pontos esgotados, Pokémon nível 1 e UID inexistente',()=>{
    const exhausted=state();
    exhausted.roster[0]!.manual={...manual(),attack:38};
    reject(JSON.stringify(exhausted),{type:'invest-pokemon',uid:1,stat:'hp'});
    const levelOne=state();
    levelOne.roster[1]!.level=1;
    reject(JSON.stringify(levelOne),{type:'invest-pokemon',uid:2,stat:'hp'});
    reject(source,{type:'invest-pokemon',uid:999,stat:'hp'});
    reject(source,{type:'invest-pokemon',uid:0,stat:'hp'});
    reject(source,{type:'invest-pokemon',uid:1,stat:'not-stat' as 'hp'});
  });

  it('reseta apenas os 6 valores manuais do UID solicitado sem tocar em recursos',()=>{
    const after=edited(source,{type:'reset-pokemon',uid:1});
    expect(after.roster[0]?.manual).toEqual(manual());
    expect(after.roster[1]).toEqual(state().roster[1]);
    expect(after.roster[0]?.xp).toBe(12);
    expect(after.roster[0]?.affinity).toBe(73);
    expect(after.roster[0]?.upgrades).toEqual({'vine-whip':1});
    expect(after.roster[0]?.uid).toBe(1);
    expect(after.coins).toBe(321);
    expect(after.team).toEqual([1]);
  });

  it('compatibilidade: manual omitido da v0.1 é interpretado como 0',()=>{
    const old=state();
    delete (old.roster[1] as {manual?: unknown}).manual;
    const after=edited(JSON.stringify(old),{type:'invest-pokemon',uid:2,stat:'speed'});
    expect(after.roster[1]?.manual).toEqual({...manual(),speed:1});
    expect(after.roster[0]?.manual.hp).toBe(3);
  });
});

describe('redutores puros da equipe (ordem = Pokémon ativo)',()=>{
  it('adiciona UID da coleção, mantém ordem, limita a 3 e remove sem trocar recursos',()=>{
    expect(LEGACY_TEAM_MAX_MEMBERS).toBe(3);
    const withTwo=edited(source,{type:'add-team',uid:2});
    expect(withTwo.team).toEqual([1,2]);
    const withThree=edited(JSON.stringify(withTwo),{type:'add-team',uid:3});
    expect(withThree.team).toEqual([1,2,3]);
    reject(JSON.stringify(withThree),{type:'add-team',uid:1});
    const withoutActive=edited(JSON.stringify(withThree),{type:'remove-team',uid:1});
    expect(withoutActive.team).toEqual([2,3]);
    expect(withoutActive.roster).toEqual(state().roster);
    expect(withoutActive.coins).toBe(321);
    const withoutSecond=edited(JSON.stringify(withoutActive),{type:'remove-team',uid:2});
    expect(withoutSecond.team).toEqual([3]);
    reject(JSON.stringify(withoutSecond),{type:'remove-team',uid:3});
  });

  it('não aceita duplicata, Pokémon sem UID, remoção de fora do time ou 4º membro',()=>{
    reject(source,{type:'add-team',uid:1});
    reject(source,{type:'add-team',uid:999});
    reject(source,{type:'remove-team',uid:2});
    reject(source,{type:'remove-team',uid:1});
    const full=state();
    full.roster.push(pokemon(4));
    full.team=[1,2,3];
    reject(JSON.stringify(full),{type:'add-team',uid:4});
  });

  it('bloqueia troca do time durante expedição, mas treino do Pokémon segue permitido',()=>{
    const active=state();
    active.team=[1,2];
    active.expedition={startedAt:5,lastClaimAt:11,teamUids:[1,2]} as unknown as null;
    const raw=JSON.stringify(active);
    reject(raw,{type:'add-team',uid:2});
    reject(raw,{type:'remove-team',uid:2});
    const trained=edited(raw,{type:'invest-pokemon',uid:1,stat:'hp'});
    expect(trained.expedition).toEqual(active.expedition);
    expect(trained.roster[0]?.manual.hp).toBe(4);
  });
});

describe('validação de integridade do save e ações desconhecidas',()=>{
  it('rejeita JSON ilegível, versão futura, roster vazio, time corrupto e UIDs duplicados',()=>{
    const action:LegacyPokemonTeamAction={type:'invest-pokemon',uid:1,stat:'hp'};
    reject('{broken',action);
    reject(JSON.stringify({...state(),version:2}),action);
    reject(JSON.stringify({...state(),roster:[]}),action);
    reject(JSON.stringify({...state(),team:[]}),action);
    reject(JSON.stringify({...state(),team:[1,1]}),action);
    reject(JSON.stringify({...state(),team:[99]}),action);
    reject(JSON.stringify({...state(),team:[1,2,3,4]}),action);
    reject(JSON.stringify({...state(),roster:[pokemon(1),pokemon(1)]}),action);
  });

  it('não corrige silenciosamente atributo fracionário/negativo, orçamento ou espécie inválida',()=>{
    const base=state();
    base.roster[0]!.manual={...manual(),attack:39}; // nível 20: limite 38
    reject(JSON.stringify(base),{type:'reset-pokemon',uid:1});
    base.roster[0]!.manual={...manual(),attack:-1};
    reject(JSON.stringify(base),{type:'reset-pokemon',uid:1});
    base.roster[0]!.manual={...manual(),attack:0.5};
    reject(JSON.stringify(base),{type:'reset-pokemon',uid:1});
    base.roster[0]!.manual={...manual()};
    base.roster[0]!.pokemonId=152;
    reject(JSON.stringify(base),{type:'reset-pokemon',uid:1});
  });

  it('só permite atributos legados conhecidos; rejeita comandos arbitrários',()=>{
    const corrupt=state();
    (corrupt.roster[0]!.manual as Record<string,number>).intruder=5;
    reject(JSON.stringify(corrupt),{type:'reset-pokemon',uid:1});
    reject(source,{type:'grant-coins',uid:1} as unknown as LegacyPokemonTeamAction);
  });
});
