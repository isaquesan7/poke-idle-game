/** D064AS — Night Shade: FRLG level-up, dano de nível, imunidade e replay. */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,KANTO_FRLG_MOVE_META,
  kantoLevelMoves,kantoMoveSpCost,kantoMovePp,kantoDamage,
  reducePokemonMoveSlotsJson,pokemonOwnStats,zeroStats,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

const night=KANTO_BATTLE_MOVES['night-shade']!;
function fighter(id:number,level:number,moves:readonly KantoMove[],boost=0):Combatant{
  const species=KANTO_BATTLE_SPECIES[id]!;
  const stats=pokemonOwnStats(species.base,level,zeroStats());
  return {speciesId:id,name:species.name,types:species.types,level,
    stats:{...stats,attack:stats.attack+boost,defense:stats.defense+boost,
      specialAttack:stats.specialAttack+boost,specialDefense:stats.specialDefense+boost},
    move:moves[0]!,moves,rank:0};
}
describe('D064AS — Night Shade',()=>{
  it('respeita FRLG e recusa adulterações ou aprendizado prematuro',()=>{
    const meta=Object.values(KANTO_FRLG_MOVE_META).find(x=>x.name==='night-shade')!;
    expect(meta.effectId).toBe(88);
    expect(meta.power).toBeNull();
    expect(meta.pp).toBe(15);
    expect(night).toEqual({name:'night-shade',type:'ghost',category:'special',
      power:0,accuracy:100,priority:0});
    expect(kantoMovePp('night-shade')).toBe(meta.pp);
    expect(kantoMoveSpCost(night)).toBeGreaterThan(0);
    expect(()=>kantoMoveSpCost({...night,power:40})).toThrow();
    expect(kantoLevelMoves(94,15).map(x=>x.move.name)).not.toContain('night-shade');
    expect(kantoLevelMoves(94,16).map(x=>x.move.name)).toContain('night-shade');
    expect(kantoLevelMoves(93,16).map(x=>x.move.name)).toContain('night-shade');
    const save=(level:number)=>JSON.stringify({version:1,badges:[],team:[7],
      roster:[{uid:7,pokemonId:94,level,moveName:'tackle',moveNames:['tackle']}]});
    expect(reducePokemonMoveSlotsJson(save(15),{uid:7,moveName:'night-shade',operation:'add'}).status).toBe('invalid');
    const added=reducePokemonMoveSlotsJson(save(16),{uid:7,moveName:'night-shade',operation:'add'});
    expect(added.status).toBe('ok');
    if(added.status==='ok')expect(JSON.parse(added.json).roster[0].moveNames).toEqual(['tackle','night-shade']);
  });

  it('fixa dano no nível ignorando critico, variância, defesa, STAB e resistência',()=>{
    const attacker=fighter(94,45,[night]);
    const psychic=fighter(65,45,[KANTO_BATTLE_SPECIES[65]!.move]);
    const boosted=fighter(65,45,[KANTO_BATTLE_SPECIES[65]!.move],900);
    const a=kantoDamage(attacker,psychic,0,0);
    const b=kantoDamage(attacker,boosted,.9,.99);
    expect(a).toEqual({damage:45,critical:false,effectiveness:2});
    expect(b).toEqual(a);
    const normal=fighter(143,45,[KANTO_BATTLE_SPECIES[143]!.move]);
    expect(kantoDamage(attacker,normal,0,0).damage).toBe(0);
    expect(kantoDamage(attacker,normal,.7,.7).effectiveness).toBe(0);
  });

  it('batalhas determinísticas, custo SP único e quadros correspondentes ao log',()=>{
    const attacker=fighter(94,45,[night]);
    const enemy=fighter(65,45,[KANTO_BATTLE_SPECIES[65]!.move]);
    let attacks=0;
    for(let seed=0;seed<40;seed++){
      const a=simulateKantoBattle(attacker,enemy,seed);
      expect(a).toEqual(simulateKantoBattle(attacker,enemy,seed));
      expect(a.log).toHaveLength(a.frames.length);
      expect(a.playerRemainingSp).toBeGreaterThanOrEqual(0);
      expect(a.turns).toBeLessThanOrEqual(30);
      for(const frame of a.frames.filter(f=>f.moveName==='night-shade'&&f.kind==='attack')){
        attacks++;
        expect(frame.amount).toBeGreaterThan(0);
        expect(frame.amount).toBeLessThanOrEqual(attacker.level);
        expect(frame.critical).toBe(false);
        expect(frame.spCost).toBe(kantoMoveSpCost(night));
      }
    }
    expect(attacks).toBeGreaterThan(0);
    const immune=fighter(143,45,[KANTO_BATTLE_SPECIES[143]!.move]);
    const res=simulateKantoBattle(attacker,immune,1);
    expect(res.frames.filter(f=>f.moveName==='night-shade'&&f.kind==='attack')
      .every(f=>f.amount===0)).toBe(true);
  });
});
