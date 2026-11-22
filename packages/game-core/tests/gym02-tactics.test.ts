import {describe,expect,it} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {selectGymTeam,gymTrainerPoints,gymLegalMoves,prepareGymOpponent,gymAiDecision}
  from '../src/gyms/gymTactics.js';
import {kantoSpecies} from '../src/catalog/kantoSpecies.js';
import {pokemonOwnStats} from '../src/stats/pokemon.js';
import type {Combatant} from '../src/combat/kantoBattle.js';

const candidate=(speciesId:number,level=20):Combatant=>{
  const species=kantoSpecies(speciesId)!;
  const moves=gymLegalMoves(speciesId,level);
  return {
    speciesId,level,name:species.name,types:species.types,
    stats:pokemonOwnStats(species.base,level,gymTrainerPoints(1,level)),
    move:moves[0]!,moves,rank:0
  };
};
describe('GYM-02A — preparação, escolha e IA sem recompensa',()=>{
  it('três UIDs distintos, permite ordem personalizada, recusa indisponíveis',()=>{
    const owned=[1,2,3,4].map(uid=>({uid,combatant:candidate(1)}));
    expect(selectGymTeam(owned,[3,1,4])?.map(p=>p.uid)).toEqual([3,1,4]);
    expect(selectGymTeam(owned,[1,1,2])).toBeNull();
    expect(selectGymTeam(owned,[1,2])).toBeNull();
    expect(selectGymTeam(owned,[1,2,9])).toBeNull();
    expect(selectGymTeam(owned,[1,2,3],[2])).toBeNull();
  });
  it('cada Pokémon do líder recebe exatamente seu orçamento legal por nível',()=>{
    for(const gym of KANTO_GYMS){
      for(const {level} of gym.team){
        const invested=gymTrainerPoints(gym.order,level);
        expect(Object.values(invested).reduce((a,b)=>a+b,0)).toBe(2*(level-1));
        expect(Object.values(invested).every(n=>n>=0&&Number.isSafeInteger(n))).toBe(true);
      }
    }
  });
  it('prepara os oito elencos completos apenas com golpes executáveis aprendidos',()=>{
    for(const gym of KANTO_GYMS){
      const prepared=prepareGymOpponent(gym);
      expect(prepared.gymId).toBe(gym.id);
      expect(prepared.team).toHaveLength(3);
      for(let i=0;i<3;i++){
        const p=prepared.team[i]!;
        expect(p.speciesId).toBe(gym.team[i]!.speciesId);
        expect(p.level).toBe(gym.team[i]!.level);
        expect(p.moves!.length).toBeGreaterThanOrEqual(1);
        expect(p.moves!.length).toBeLessThanOrEqual(4);
        expect(new Set(p.moves!.map(m=>m.name)).size).toBe(p.moves!.length);
        expect(p.stats.hp).toBeGreaterThan(0);
      }
    }
  });
  it('imunidade: não escolhe golpe elétrico contra adversário ground',()=>{
    const raichu=candidate(26,31);
    const dugtrio=candidate(51,31);
    const decision=gymAiDecision({
      actor:raichu,defender:dugtrio,
      actorHp:raichu.stats.hp,actorSp:50,bench:[]
    });
    expect(decision.action==='move'&&decision.moveName==='thunder-shock').toBe(false);
  });
  it('recusa HP e SP adulterados e não gera efeitos colaterais no elenco',()=>{
    const one=candidate(1);
    const two=candidate(4);
    const saved=JSON.stringify(one);
    expect(()=>gymAiDecision({actor:one,defender:two,actorHp:0,actorSp:50,bench:[]})).toThrow();
    expect(()=>gymAiDecision({actor:one,defender:two,actorHp:one.stats.hp,actorSp:101,bench:[]})).toThrow();
    gymAiDecision({actor:one,defender:two,actorHp:one.stats.hp,actorSp:50,bench:[]});
    expect(JSON.stringify(one)).toBe(saved);
  });
});
