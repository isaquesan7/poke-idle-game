/** D064AT — multi-hit FRLG, acertos por seed, writer, SP e replay. */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,KANTO_MULTI_HIT_MOVES,
  KANTO_FRLG_MOVE_META,kantoLevelMoves,kantoMovePp,kantoMoveSpCost,
  kantoRollHitCount,kantoMoveExpectedHits,kantoMoveHitCount,
  kantoTmIsTeachEnabled,reducePokemonMoveSlotsJson,
  pokemonOwnStats,zeroStats,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

function fighter(id:number,level:number,moves:readonly KantoMove[]):Combatant{
  const mon=KANTO_BATTLE_SPECIES[id]!;
  return {speciesId:id,name:mon.name,types:mon.types,level,
    stats:pokemonOwnStats(mon.base,level,zeroStats()),move:moves[0]!,moves,rank:0};
}

describe('D064AT — golpes com acertos múltiplos FRLG',()=>{
  it('libera 12 nomes FRLG incluindo Twineedle seguro e preserva Double Kick',()=>{
    const expected=[
      'double-kick','double-slap','comet-punch','fury-attack','pin-missile',
      'spike-cannon','barrage','fury-swipes','bonemerang','bone-rush',
      'icicle-spear','rock-blast','twineedle'
    ].sort();
    expect(Object.keys(KANTO_MULTI_HIT_MOVES).sort()).toEqual(expected);
    for(const name of expected.filter(n=>n!=='double-kick')){
      const api=Object.values(KANTO_FRLG_MOVE_META).find(x=>x.name===name)!;
      const hit=KANTO_MULTI_HIT_MOVES[name]!;
      expect(api.effectId===30||api.effectId===45||
        (name==='twineedle'&&api.effectId===78)).toBe(true);
      expect(hit.minHits).toBe(2);
      expect(hit.maxHits).toBe(api.maxHits);
      expect(KANTO_BATTLE_MOVES[name]).toEqual({
        name,type:api.type,category:api.category,power:api.power,
        accuracy:api.accuracy,priority:api.priority
      });
      expect(kantoMovePp(name)).toBe(api.pp);
      expect(kantoMoveSpCost(KANTO_BATTLE_MOVES[name]!)).toBeGreaterThan(0);
    }
    expect(KANTO_MULTI_HIT_MOVES['twineedle']).toEqual({minHits:2,maxHits:2});
    expect(KANTO_MULTI_HIT_MOVES['bullet-seed']).toBeUndefined();
    expect(kantoTmIsTeachEnabled('tm09',1)).toBe(false);
  });

  it('aplica níveis FRLG por espécie e UID sem ensinar TM09',()=>{
    const cases=[
      [35,13,'double-slap'],[21,13,'fury-attack'],
      [15,35,'pin-missile'],[104,25,'bonemerang'],
      [104,41,'bone-rush'],[90,8,'icicle-spear'],
      [74,31,'rock-blast']
    ] as const;
    for(const [id,level,name] of cases){
      expect(kantoLevelMoves(id,level-1).map(x=>x.move.name)).not.toContain(name);
      expect(kantoLevelMoves(id,level).map(x=>x.move.name)).toContain(name);
    }
    const save=(level:number)=>JSON.stringify({version:1,badges:[],team:[9],
      roster:[{uid:9,pokemonId:74,level,moveName:'tackle',moveNames:['tackle']}]});
    expect(reducePokemonMoveSlotsJson(save(30),{
      uid:9,moveName:'rock-blast',operation:'add'
    }).status).toBe('invalid');
    const added=reducePokemonMoveSlotsJson(save(31),{
      uid:9,moveName:'rock-blast',operation:'add'
    });
    expect(added.status).toBe('ok');
    if(added.status==='ok'){
      expect(JSON.parse(added.json).roster[0].uid).toBe(9);
      expect(JSON.parse(added.json).roster[0].moveNames).toContain('rock-blast');
    }
    expect(reducePokemonMoveSlotsJson(save(100),{
      uid:9,moveName:'bullet-seed',operation:'add'
    }).status).toBe('invalid');
  });

  it('sorteia 2/3/4/5 no limiar sem gastar RNG em golpes fixos',()=>{
    for(const [roll,hits] of [
      [0,2],[.374999,2],[.375,3],[.74999,3],
      [.75,4],[.87499,4],[.875,5],[.9999,5]
    ] as const)
      expect(kantoRollHitCount('rock-blast',()=>roll)).toBe(hits);
    expect(()=>kantoRollHitCount('rock-blast',()=>1)).toThrow();
    expect(()=>kantoRollHitCount('rock-blast',()=>-1)).toThrow();
    expect(kantoMoveHitCount('rock-blast')).toBe(2);
    expect(kantoMoveExpectedHits('rock-blast')).toBe(3);
    expect(kantoMoveExpectedHits('double-kick')).toBe(2);
    expect(kantoRollHitCount('double-kick',()=>{throw Error('RNG indevido');})).toBe(2);
    expect(kantoRollHitCount('tackle',()=>{throw Error('RNG indevido');})).toBe(1);
  });

  it('produz logs e frames por impacto, só um custo SP e replay determinístico',()=>{
    const rock=KANTO_BATTLE_MOVES['rock-blast']!;
    const attacker=fighter(74,40,[rock]);
    const target=fighter(143,80,[KANTO_BATTLE_SPECIES[143]!.move]);
    const observed=new Set<number>();
    let actions=0;
    for(let seed=0;seed<180;seed++){
      // Seeds espaçadas em 32 bits cobrem as faixas do LCG, ao contrário
      // de seeds consecutivas, altamente correlacionadas nos primeiros rolls.
      const sampledSeed=Math.imul(seed+1,0x9e3779b9)>>>0;
      const battle=simulateKantoBattle(attacker,target,sampledSeed);
      expect(battle).toEqual(simulateKantoBattle(attacker,target,sampledSeed));
      expect(battle.frames).toHaveLength(battle.log.length);
      expect(battle.playerRemainingSp).toBeGreaterThanOrEqual(0);
      expect(battle.turns).toBeLessThanOrEqual(30);
      for(const frame of battle.frames){
        if(frame.moveName!=='rock-blast'||frame.kind!=='attack')continue;
        // Grupos deriváveis do início (hitIndex1) e acertos subsequentes.
        if(frame.hitIndex===1){
          actions++;
          observed.add(frame.hitTotal!);
          expect(frame.spCost).toBe(kantoMoveSpCost(rock));
        }else expect(frame.spCost).toBe(0);
        expect(frame.hitIndex).toBeGreaterThanOrEqual(1);
        expect(frame.hitIndex).toBeLessThanOrEqual(frame.hitTotal!);
        expect(frame.hitTotal).toBeGreaterThanOrEqual(2);
        expect(frame.hitTotal).toBeLessThanOrEqual(5);
      }
    }
    expect(actions).toBeGreaterThan(0);
    expect(observed.size).toBeGreaterThanOrEqual(3);
  });

  it('rejeita payload multi-hit adulterado e encerra os impactos após KO',()=>{
    const rock=KANTO_BATTLE_MOVES['rock-blast']!;
    const target=fighter(10,10,[KANTO_BATTLE_SPECIES[10]!.move]);
    expect(()=>simulateKantoBattle(fighter(74,70,[{...rock,power:200}]),target,1)).toThrow();
    const kill=simulateKantoBattle(fighter(74,70,[rock]),target,7);
    const frames=kill.frames.filter(f=>f.moveName==='rock-blast'&&f.kind==='attack');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.length).toBeLessThanOrEqual(5);
    if(kill.wildRemainingHp===0){
      const last=frames.at(-1)!;
      expect(last.wildHp).toBe(0);
    }
  });
});
