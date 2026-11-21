/** D064AV — auditoria de equipagem selvagem e paridade de IA. */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,
  kantoWildMoveLoadout,kantoLevelMoves,kantoSupportMoves,
  pokemonOwnStats,zeroStats,simulateKantoBattle,kantoMoveSpCost
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

const names=(id:number,level:number)=>kantoWildMoveLoadout(
  id,level,KANTO_BATTLE_SPECIES[id]!.move).map(move=>move.name);
function combatant(id:number,level:number,moves:readonly KantoMove[]):Combatant{
  const species=KANTO_BATTLE_SPECIES[id]!;
  return {speciesId:id,name:species.name,types:species.types,level,
    stats:pokemonOwnStats(species.base,level,zeroStats()),move:moves[0]!,
    moves,rank:0};
}

describe('D064AV — IA selvagem: golpe permitido por nível e paridade',()=>{
  it('inclui novos golpes nos selvagens quando seu nível permite',()=>{
    expect(names(15,19)).not.toContain('twineedle');
    expect(names(15,20)).toContain('twineedle');
    expect(names(74,30)).not.toContain('rock-blast');
    expect(names(74,31)).toContain('rock-blast');
    expect(names(94,15)).not.toContain('night-shade');
    expect(names(94,16)).toContain('night-shade');
    expect(names(43,17)).not.toContain('sleep-powder');
    expect(names(43,18)).toContain('sleep-powder');
    expect(names(15,100)).not.toContain('bullet-seed');
  });

  it('para 151 espécies, permite no máximo 4 slots e nenhum golpe prematuro ou TM',()=>{
    for(let id=1;id<=151;id++){
      for(const level of [1,5,15,20,31,50,100]){
        const fallback=KANTO_BATTLE_SPECIES[id]!.move;
        const moves=kantoWildMoveLoadout(id,level,fallback);
        expect(moves.length).toBeGreaterThan(0);
        expect(moves.length).toBeLessThanOrEqual(4);
        expect(new Set(moves.map(m=>m.name)).size).toBe(moves.length);
        const earned=[...kantoLevelMoves(id,level),...kantoSupportMoves(id,level)]
          .map(entry=>entry.move.name);
        const hasUnlockedOffensive=kantoLevelMoves(id,level)
          .some(entry=>entry.move.category!=='status');
        expect(moves.some(m=>m.category!=='status')).toBe(true);
        for(const move of moves){
          if(!earned.includes(move.name)){
            expect(hasUnlockedOffensive).toBe(false);
            expect(move).toEqual(fallback);
          }
          expect(move.name).not.toBe('bullet-seed');
          expect(kantoMoveSpCost(move)).toBeGreaterThan(0);
        }
      }
    }
    expect(()=>kantoWildMoveLoadout(0,1,KANTO_BATTLE_SPECIES[1]!.move))
      .toThrow();
    expect(()=>kantoWildMoveLoadout(1,101,KANTO_BATTLE_SPECIES[1]!.move))
      .toThrow();
  });

  it('mesmo combatente usa mesma IA e SP de ambos os lados, sem vantagens escondidas',()=>{
    const moves=kantoWildMoveLoadout(15,30,KANTO_BATTLE_SPECIES[15]!.move);
    const player=combatant(15,30,moves);
    const wild=combatant(15,30,moves);
    let wins=0,losses=0;
    for(let seed=0;seed<120;seed++){
      const value=Math.imul(seed+1,0x9e3779b9)>>>0;
      const a=simulateKantoBattle(player,wild,value);
      expect(a).toEqual(simulateKantoBattle(player,wild,value));
      expect(a.frames).toHaveLength(a.log.length);
      expect(a.playerMaxSp).toBe(a.wildMaxSp);
      expect(a.playerRemainingSp).toBeGreaterThanOrEqual(0);
      expect(a.wildRemainingSp).toBeGreaterThanOrEqual(0);
      for(const frame of a.frames.filter(f=>f.kind==='attack'&&f.moveName!=='basic-attack')){
        expect(moves.map(m=>m.name)).toContain(frame.moveName);
        expect(frame.spCost).toBeGreaterThanOrEqual(0);
      }
      if(a.outcome==='win')wins++;
      if(a.outcome==='loss')losses++;
    }
    // Paridade de atributos, golpes e regras, não promessa de vitória exata.
    expect(wins+losses).toBeGreaterThan(0);
  });

  it('um selvagem em simulador usa golpes FRLG recentes de verdade',()=>{
    const moves=kantoWildMoveLoadout(15,30,KANTO_BATTLE_SPECIES[15]!.move);
    expect(moves.some(m=>m.name==='twineedle')).toBe(true);
    const wild=combatant(15,30,moves);
    const player=combatant(143,80,[KANTO_BATTLE_MOVES['tackle']!]);
    let usedTwineedle=false;
    for(let seed=0;seed<80;seed++){
      const battle=simulateKantoBattle(player,wild,Math.imul(seed+1,0x9e3779b9)>>>0);
      if(battle.frames.some(f=>f.actor==='wild'&&f.moveName==='twineedle')){
        usedTwineedle=true;break;
      }
    }
    expect(usedTwineedle).toBe(true);
  });
});
