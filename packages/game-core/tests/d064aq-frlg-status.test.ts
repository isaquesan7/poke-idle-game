/** D064AQ — suporte FRLG com fonte versionada e execução determinística. */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_FRLG_MOVE_META,KANTO_SUPPORT_MOVES,
  kantoSupportMoves,kantoSupportEffect,kantoMoveSpCost,kantoMovePp,
  reducePokemonMoveSlotsJson,pokemonOwnStats,zeroStats,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

function fighter(id:number,moves:readonly KantoMove[]):Combatant{
  const species=KANTO_BATTLE_SPECIES[id]!;
  return {speciesId:id,name:species.name,level:45,types:species.types,
    stats:pokemonOwnStats(species.base,45,zeroStats()),
    move:moves[0]!,moves,rank:0};
}
describe('D064AQ — Leer / Stun Spore / Glare FRLG',()=>{
  it('fonte, custos e nivelamento exatos sem liberar Hypnosis',()=>{
    for(const [name,at,id] of [
      ['leer',7,21],['stun-spore',16,43],['glare',20,23]
    ] as const){
      const meta=Object.values(KANTO_FRLG_MOVE_META).find(m=>m.name===name)!;
      expect(meta.category).toBe('status');
      expect(meta.power).toBeNull();
      expect(KANTO_SUPPORT_MOVES[name]?.power).toBe(0);
      expect(kantoMovePp(name)).toBe(meta.pp);
      expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES[name]!)).toBeGreaterThan(0);
      expect(kantoSupportMoves(id,at-1).map(x=>x.move.name)).not.toContain(name);
      expect(kantoSupportMoves(id,at).map(x=>x.move.name)).toContain(name);
    }
    expect(kantoSupportEffect('leer')).toEqual({kind:'lower-defense',stages:1});
    expect(kantoSupportEffect('stun-spore')).toEqual({kind:'status',status:'paralysis'});
    expect(kantoSupportEffect('glare')).toEqual({kind:'status',status:'paralysis'});
    expect(kantoSupportMoves(94,45).map(x=>x.move.name)).not.toContain('hypnosis');
  });
  it('writer recusa aprendizados prematuros e preserva slots/UID',()=>{
    const json=(level:number)=>JSON.stringify({version:1,badges:[],team:[1],
      roster:[{uid:1,pokemonId:23,level,moveName:'tackle',moveNames:['tackle']}]});
    expect(reducePokemonMoveSlotsJson(json(19),{uid:1,moveName:'glare',operation:'add'}).status)
      .toBe('invalid');
    const updated=reducePokemonMoveSlotsJson(json(20),{uid:1,moveName:'glare',operation:'add'});
    expect(updated.status).toBe('ok');
    if(updated.status==='ok'){
      expect(JSON.parse(updated.json).roster[0].moveNames).toEqual(['tackle','glare']);
      expect(JSON.parse(updated.json).roster[0].uid).toBe(1);
    }
  });
  it('motor aplica status e debuff com log/frame, SP e replay reprodutíveis',()=>{
    const variants=[
      [21,'leer',25],
      [43,'stun-spore',25],
      [23,'glare',25]
    ] as const;
    for(const [id,name,targetId] of variants){
      const lead=KANTO_BATTLE_SPECIES[id]!;
      const move=KANTO_SUPPORT_MOVES[name]!;
      const attacker=fighter(id,[lead.move,move]);
      const target=KANTO_BATTLE_SPECIES[targetId]!;
      const rival=fighter(targetId,[target.move]);
      let used=0;
      for(let seed=0;seed<24;seed++){
        const first=simulateKantoBattle(attacker,rival,seed);
        expect(first).toEqual(simulateKantoBattle(attacker,rival,seed));
        expect(first.frames).toHaveLength(first.log.length);
        expect(first.playerRemainingSp).toBeGreaterThanOrEqual(0);
        expect(first.turns).toBeLessThanOrEqual(30);
        if(first.frames.some(frame=>frame.moveName===name)){
          used++;
          expect(first.log.some(line=>line.includes(name))).toBe(true);
          expect(first.frames.some(frame=>frame.moveName===name
            &&frame.spCost===kantoMoveSpCost(move))).toBe(true);
        }
      }
      expect(used).toBeGreaterThan(0);
    }
  });
});
