/** D064AR — sono: contador temporário por combate, UID, SP, IA, replay. */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_SUPPORT_MOVES,kantoSupportMoves,kantoMoveSpCost,
  reducePokemonMoveSlotsJson,pokemonOwnStats,zeroStats,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

function fighter(id:number,moves:readonly KantoMove[],level=45):Combatant{
  const mon=KANTO_BATTLE_SPECIES[id]!;
  return {speciesId:id,name:mon.name,types:mon.types,level,
    stats:pokemonOwnStats(mon.base,level,zeroStats()),move:moves[0]!,moves,rank:0};
}

describe('D064AR — Hypnosis / Sleep Powder / Spore',()=>{
  it('usa level-up FRLG sem liberar outros efeitos especiais',()=>{
    const cases=[
      {id:94,name:'hypnosis',level:1,accuracy:60},
      {id:43,name:'sleep-powder',level:18,accuracy:75},
      {id:46,name:'spore',level:25,accuracy:100}
    ] as const;
    for(const x of cases){
      expect(kantoSupportMoves(x.id,x.level).map(v=>v.move.name)).toContain(x.name);
      expect(KANTO_SUPPORT_MOVES[x.name]?.accuracy).toBe(x.accuracy);
      expect(KANTO_SUPPORT_MOVES[x.name]?.power).toBe(0);
      expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES[x.name]!)).toBeGreaterThan(0);
      if(x.level>1)expect(kantoSupportMoves(x.id,x.level-1)
        .map(v=>v.move.name)).not.toContain(x.name);
    }
    expect(kantoSupportMoves(94,45).map(v=>v.move.name)).not.toContain('night-shade');
  });

  it('writer protege o UID e não antecipa Sleep Powder',()=>{
    const save=(level:number)=>JSON.stringify({version:1,badges:[],team:[5],
      roster:[{uid:5,pokemonId:43,level,moveName:'absorb',moveNames:['absorb']}]});
    expect(reducePokemonMoveSlotsJson(save(17),{uid:5,moveName:'sleep-powder',operation:'add'}).status)
      .toBe('invalid');
    const good=reducePokemonMoveSlotsJson(save(18),{uid:5,moveName:'sleep-powder',operation:'add'});
    expect(good.status).toBe('ok');
    if(good.status==='ok')expect(JSON.parse(good.json).roster[0].moveNames)
      .toContain('sleep-powder');
  });

  it('dormir e acordar geram linhas e frames sem dano ou SP extra',()=>{
    const user=KANTO_BATTLE_SPECIES[46]!;
    const enemy=KANTO_BATTLE_SPECIES[25]!;
    const caster=fighter(46,[user.move,KANTO_SUPPORT_MOVES.spore!]);
    const target=fighter(25,[enemy.move]);
    let sleeps=0,wakes=0;
    for(let seed=0;seed<64;seed++){
      const battle=simulateKantoBattle(caster,target,seed);
      expect(battle).toEqual(simulateKantoBattle(caster,target,seed));
      expect(battle.log).toHaveLength(battle.frames.length);
      expect(battle.playerRemainingSp).toBeGreaterThanOrEqual(0);
      expect(battle.wildRemainingSp).toBeGreaterThanOrEqual(0);
      const starts=battle.log.filter(line=>line.includes('adormecido')).length;
      const sleeping=battle.log.filter(line=>line.includes('está dormindo')).length;
      const awake=battle.log.filter(line=>line.includes('acordou')).length;
      if(starts){
        sleeps++;
        expect(sleeping).toBeGreaterThanOrEqual(1);
        expect(sleeping).toBeLessThanOrEqual(3);
        // Pode haver KO antes de acordar, sem despertar artificial após término.
        expect(awake).toBeLessThanOrEqual(starts);
        wakes+=awake;
        expect(battle.frames.some(f=>f.moveName==='spore'
          &&f.spCost===kantoMoveSpCost(KANTO_SUPPORT_MOVES.spore!))).toBe(true);
      }
    }
    expect(sleeps).toBeGreaterThan(0);
    expect(wakes).toBeGreaterThan(0);
  });
});
