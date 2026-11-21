/** D064AU — Twineedle por impacto, RNG, imunidades, SP e UID. */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_MOVES,KANTO_BATTLE_SPECIES,KANTO_MULTI_HIT_MOVES,
  kantoLevelMoves,kantoMovePp,kantoMoveSpCost,
  kantoPerHitSecondaryEffect,kantoMoveSecondaryEffect,
  kantoTmIsTeachEnabled,reducePokemonMoveSlotsJson,
  pokemonOwnStats,zeroStats,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

const twineedle=KANTO_BATTLE_MOVES['twineedle']!;
function combatant(id:number,level:number,moves:readonly KantoMove[]):Combatant{
  const s=KANTO_BATTLE_SPECIES[id]!;
  return {speciesId:id,name:s.name,level,types:s.types,
    stats:pokemonOwnStats(s.base,level,zeroStats()),move:moves[0]!,moves,rank:0};
}

describe('D064AU — Twineedle',()=>{
  it('aprende via FRLG somente Beedrill no nível 20, sem TM09',()=>{
    expect(twineedle).toEqual({
      name:'twineedle',type:'bug',category:'physical',power:25,accuracy:100,priority:0
    });
    expect(KANTO_MULTI_HIT_MOVES['twineedle']).toEqual({minHits:2,maxHits:2});
    expect(kantoMovePp('twineedle')).toBe(20);
    expect(kantoMoveSpCost(twineedle)).toBeGreaterThan(0);
    expect(kantoPerHitSecondaryEffect('twineedle')).toEqual({
      kind:'status',status:'poison',chance:20
    });
    expect(kantoMoveSecondaryEffect('twineedle')).toBeNull();
    expect(kantoLevelMoves(15,19).map(x=>x.move.name)).not.toContain('twineedle');
    expect(kantoLevelMoves(15,20).map(x=>x.move.name)).toContain('twineedle');
    expect(kantoLevelMoves(13,100).map(x=>x.move.name)).not.toContain('twineedle');
    expect(kantoTmIsTeachEnabled('tm09',15)).toBe(false);
    expect(KANTO_BATTLE_MOVES['bullet-seed']).toBeUndefined();
    const save=(level:number)=>JSON.stringify({version:1,badges:[],team:[42],
      roster:[{uid:42,pokemonId:15,level,moveName:'fury-attack',
        moveNames:['fury-attack']}]});
    expect(reducePokemonMoveSlotsJson(save(19),{
      uid:42,moveName:'twineedle',operation:'add'
    }).status).toBe('invalid');
    const result=reducePokemonMoveSlotsJson(save(20),{
      uid:42,moveName:'twineedle',operation:'add'
    });
    expect(result.status).toBe('ok');
    if(result.status==='ok'){
      const roster=JSON.parse(result.json).roster[0];
      expect(roster.uid).toBe(42);
      expect(roster.moveNames).toContain('twineedle');
    }
  });

  it('usa dois impactos, uma cobrança SP e log/frame determinísticos',()=>{
    const player=combatant(15,60,[twineedle]);
    const defender=combatant(143,100,[KANTO_BATTLE_SPECIES[143]!.move]);
    let attacks=0,poison=0;
    const seeds=Array.from({length:160},(_,i)=>Math.imul(i+1,0x9e3779b9)>>>0);
    for(const seed of seeds){
      const result=simulateKantoBattle(player,defender,seed);
      expect(result).toEqual(simulateKantoBattle(player,defender,seed));
      expect(result.frames.length).toBe(result.log.length);
      expect(result.playerRemainingSp).toBeGreaterThanOrEqual(0);
      const hits=result.frames.filter(f=>f.actor==='player'
        &&f.moveName==='twineedle'&&f.kind==='attack');
      const starts=hits.filter(f=>f.hitIndex===1);
      attacks+=starts.length;
      for(const hit of hits){
        expect(hit.hitTotal).toBe(2);
        expect(hit.hitIndex===1||hit.hitIndex===2).toBe(true);
        expect(hit.spCost).toBe(hit.hitIndex===1?kantoMoveSpCost(twineedle):0);
      }
      for(const line of result.log){
        if(!line.includes('envenenado pelo acerto'))continue;
        poison++;
        expect(line).toMatch(/acerto [12]\/2 de twineedle/);
      }
    }
    expect(attacks).toBeGreaterThan(0);
    expect(poison).toBeGreaterThan(0);
  });

  it('alvo já envenenado não recebe reaplicação nem status duplicado',()=>{
    const attacker=combatant(15,40,[twineedle]);
    const target=combatant(25,90,[KANTO_BATTLE_SPECIES[25]!.move]);
    for(let seed=0;seed<96;seed++){
      const r=simulateKantoBattle(attacker,target,Math.imul(seed+1,0x9e3779b9)>>>0);
      expect(r.log.filter(x=>x.includes('envenenado pelo acerto')).length)
        .toBeLessThanOrEqual(1);
      expect(r.log).toHaveLength(r.frames.length);
    }
  });

  it('alvos Poison/Steel são imunes ao status; stats adulterados rejeitados',()=>{
    const attacker=combatant(15,50,[twineedle]);
    const poisonTarget=combatant(24,90,[KANTO_BATTLE_SPECIES[24]!.move]);
    const steelTarget=combatant(81,90,[KANTO_BATTLE_SPECIES[81]!.move]);
    for(const defender of [poisonTarget,steelTarget]){
      for(let seed=0;seed<32;seed++){
        const r=simulateKantoBattle(attacker,defender,Math.imul(seed+1,0x9e3779b9)>>>0);
        expect(r.wildStatus).not.toBe('poison');
        expect(r.log.some(x=>x.includes('envenenado pelo acerto'))).toBe(false);
      }
    }
    expect(()=>simulateKantoBattle(
      combatant(15,50,[{...twineedle,power:200}]),poisonTarget,2
    )).toThrow();
  });
});
