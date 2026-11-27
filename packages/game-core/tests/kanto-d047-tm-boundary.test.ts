import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_MOVES,KANTO_MULTI_HIT_MOVES,kantoLevelMoves,
  kantoPreviewMoveSpCost,reducePokemonMoveSlotsJson
} from '../src/index.js';

/** D-047: preview/local writer must not authorize the online TM. */
describe('D-047 — preview e writer local não autorizam TM09',()=>{
  it('não confunde prévia PokéAPI moderna com autorização para equipar TM09',()=>{
    // A prévia D-039 usa dados MODERNOS; sua estimativa 2,5 impactos
    // não significa que exista TM, learnset, inventário nem RNG de golpes.
    const modernPreview=kantoPreviewMoveSpCost({
      name:'bullet-seed',pp:30,power:25,priority:0,
      damage_class:{name:'physical'},
      meta:{category:{name:'damage'},min_hits:2,max_hits:5}
    });
    expect(modernPreview).toBeGreaterThan(0);
    expect(KANTO_BATTLE_MOVES['bullet-seed']).toBeUndefined();
    expect(KANTO_MULTI_HIT_MOVES['bullet-seed']).toEqual({minHits:2,maxHits:5});
    expect(kantoLevelMoves(1,100).some(x=>x.move.name==='bullet-seed')).toBe(false);
    const saved=JSON.stringify({
      version:1,roster:[{uid:19,pokemonId:1,level:100,moveName:'tackle'}],
      team:[19],badges:[],coins:404
    });
    for(const operation of ['add','replace-primary'] as const){
      const reply=reducePokemonMoveSlotsJson(saved,{
        uid:19,moveName:'bullet-seed',operation
      });
      expect(reply.status).toBe('invalid');
    }
    expect(JSON.parse(saved).roster[0].moveName).toBe('tackle');
    expect(JSON.parse(saved).coins).toBe(404);
  });
});
