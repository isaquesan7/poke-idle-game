import { describe,expect,it } from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_WILD_POOL,kantoDamage,
  kantoTypeMultiplier,simulateKantoBattle,pokemonOwnStats,zeroStats
} from '../src/index.js';
import type { Combatant,KantoMove } from '../src/index.js';

const stats={hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:80};
function fighter(override:Partial<Combatant>={}):Combatant {
  return {
    speciesId:4,name:'Charmander',types:['fire'],level:50,
    stats,rank:0,
    move:{name:'ember',type:'fire',category:'special',power:40,accuracy:100,priority:0},
    ...override
  };
}
const enemy=fighter({
  speciesId:7,name:'Squirtle',types:['water'],
  stats:{...stats,speed:40}
});

describe('combate determinístico Kanto — fórmulas do protótipo',()=>{
  it('usa STAB, resistência, crítico e variação na ordem da v0.1',()=>{
    expect(kantoDamage(fighter(),enemy,.8,0)).toEqual({
      damage:12,critical:false,effectiveness:.5
    });
    expect(kantoDamage(fighter(),enemy,0,0)).toEqual({
      damage:19,critical:true,effectiveness:.5
    });
    expect(kantoDamage(fighter(),enemy,.0625,0).critical).toBe(false);
  });

  it('aplica duplo tipo, 4×, imunidade 0× e cadeia de resistências',()=>{
    expect(kantoTypeMultiplier('grass',['water','ground'])).toBe(4);
    expect(kantoTypeMultiplier('electric',['water','ground'])).toBe(0);
    expect(kantoTypeMultiplier('fire',['grass','poison'])).toBe(2);
    expect(kantoTypeMultiplier('normal',['ghost'])).toBe(0);
    expect(kantoTypeMultiplier('fire',['fire','water'])).toBe(.25);
    expect(kantoDamage(fighter({
      move:{name:'thunder-shock',type:'electric',category:'special',power:40,accuracy:100,priority:0}
    }),enemyWithGround(),0,0).damage).toBe(0);
  });

  it('mesma entrada e seed geram log, dano, captura e resultado idênticos',()=>{
    const a=simulateKantoBattle(fighter(),enemy,123456789);
    const b=simulateKantoBattle(fighter(),enemy,123456789);
    expect(a).toEqual(b);
    expect(a.turns).toBeGreaterThan(0);
    expect(a.turns).toBeLessThanOrEqual(30);
    expect(a.wildSpeciesId).toBe(7);
    expect(['win','loss','draw']).toContain(a.outcome);
  });

  it('prioridade resolve antes da velocidade e dá vitória em um golpe',()=>{
    const heavy=fighter({
      level:100,stats:{...stats,specialAttack:10000,speed:1},
      move:{name:'ember',type:'fire',category:'special',power:200,accuracy:100,priority:1}
    });
    const fast=fighter({speciesId:19,name:'Rattata',types:['normal'],stats:{...stats,hp:10,speed:300},
      move:{name:'tackle',type:'normal',category:'physical',power:40,accuracy:100,priority:0}});
    const r=simulateKantoBattle(heavy,fast,8);
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(1);
    expect(r.playerRemainingHp).toBe(100);
  });

  it('atinge empate por limite 30 se ambos erram; não concede captura',()=>{
    const miss:KantoMove={name:'falha',type:'normal',category:'physical',power:40,accuracy:0,priority:0};
    const a=fighter({move:miss}),b=enemyWithGround({move:miss});
    const r=simulateKantoBattle(a,b,2026);
    expect(r.outcome).toBe('draw');
    expect(r.turns).toBe(30);
    expect(r.captured).toBe(false);
    expect(r.affinityGain).toBeNull();
    expect(r.log.at(-1)).toMatch(/Empate/);
  });

  it('nunca captura após derrota, mas calcula captura de 35% só após vitória',()=>{
    const strong=fighter({stats:{...stats,specialAttack:10000},level:100,
      move:{name:'ember',type:'fire',category:'special',power:200,accuracy:100,priority:1}});
    const weak=enemyWithGround({stats:{...stats,hp:10,speed:1}});
    let caught=0;
    for(let seed=0;seed<256;seed++){
      const result=simulateKantoBattle(strong,weak,seed);
      expect(result.outcome).toBe('win');
      expect(result.affinityGain).toBeGreaterThanOrEqual(2);
      expect(result.affinityGain).toBeLessThanOrEqual(5);
      if(result.captured)caught++;
    }
    expect(caught).toBeGreaterThan(0);
    expect(caught).toBeLessThan(256);
    const defeated=simulateKantoBattle(weak,strong,9876);
    expect(defeated.outcome).toBe('loss');
    expect(defeated.captured).toBe(false);
  });

  it('rejeita rolagem/seed inválidas, golpes sem dano e estados ambíguos',()=>{
    expect(()=>simulateKantoBattle(fighter(),enemy,-1)).toThrow();
    expect(()=>simulateKantoBattle(fighter(),enemy,2**32)).toThrow();
    expect(()=>simulateKantoBattle(fighter({level:0}),enemy,1)).toThrow();
    expect(()=>simulateKantoBattle(fighter({stats:{...stats,hp:0}}),enemy,1)).toThrow();
    expect(()=>kantoDamage(fighter(),enemy,1,0)).toThrow();
    expect(()=>kantoDamage(fighter({move:{...fighter().move,power:0}}),enemy,0,0)).toThrow();
    expect(()=>kantoTypeMultiplier('inventado',['water'])).toThrow();
  });

  it('catálogo local de 3 iniciais, 8 selvagens e stats positivos',()=>{
    for(const id of [1,4,7,...KANTO_WILD_POOL]){
      const info=KANTO_BATTLE_SPECIES[id];
      expect(info?.id).toBe(id);
      const own=pokemonOwnStats(info!.base,5,zeroStats());
      expect(own.hp).toBeGreaterThan(0);
      expect(info!.move.power).toBeGreaterThan(0);
    }
    expect(new Set(KANTO_WILD_POOL).size).toBe(8);
  });
});

function enemyWithGround(override:Partial<Combatant>={}):Combatant {
  return fighter({speciesId:74,name:'Geodude',types:['rock','ground'],...override});
}
