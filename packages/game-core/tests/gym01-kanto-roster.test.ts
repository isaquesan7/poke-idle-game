import {describe,expect,it} from 'vitest';
import {KANTO_GYMS,KANTO_GYM_MASTER_TITLE_STATS,kantoNextGym,
  kantoGymCatalogInvariant} from '../src/gyms/kantoGyms.js';

describe('GYM-01 — catálogo Kanto sem concessão de recompensas',()=>{
  it('define oito líderes na ordem correta e apenas 3 Pokémon treinados cada',()=>{
    expect(kantoGymCatalogInvariant()).toBe(true);
    expect(KANTO_GYMS.map(g=>g.leader)).toEqual([
      'Brock','Misty','Lt. Surge','Erika','Koga','Sabrina','Blaine','Giovanni'
    ]);
    expect(KANTO_GYMS.every(g=>g.team.length===3)).toBe(true);
    expect(KANTO_GYMS.at(-1)?.team.map(p=>p.speciesId)).toEqual([51,31,34]);
  });
  it('desbloqueia somente o próximo, rejeita saltos, duplicatas e históricos desconhecidos',()=>{
    const ids=KANTO_GYMS.map(g=>g.id);
    for(let i=0;i<8;i++)expect(kantoNextGym(ids.slice(0,i))?.id).toBe(ids[i]);
    expect(kantoNextGym(ids)).toBeNull();
    expect(kantoNextGym(['cascade'])).toBeNull();
    expect(kantoNextGym(['boulder','boulder'])).toBeNull();
    expect(kantoNextGym(['unknown'])).toBeNull();
    expect(kantoNextGym([...ids,'unknown'])).toBeNull();
  });
  it('soma 99 pontos de insígnias e mantém título separado de +12 em cada atributo',()=>{
    const sum={hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0};
    for(const gym of KANTO_GYMS){
      for(const stat of Object.keys(sum) as (keyof typeof sum)[]){
        sum[stat]+=gym.badgeStats[stat]??0;
      }
    }
    expect(sum).toEqual({
      hp:20,attack:16,defense:18,specialAttack:20,specialDefense:13,speed:12
    });
    expect(Object.values(sum).reduce((a,b)=>a+b,0)).toBe(99);
    expect(Object.values(KANTO_GYM_MASTER_TITLE_STATS)).toEqual([12,12,12,12,12,12]);
  });
});
