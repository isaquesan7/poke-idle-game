import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState,switchGymPokemon,spendGymSp} from '../src/gyms/gymBattleState.js';
import {gymApplyConfusion,gymTickConfusion,gymConfusionSelfDamage,
  gymDropStat} from '../src/gyms/gymEffects.js';
import {gymPsychicLevelMoves,gymPsychicSecondary}
  from '../src/gyms/gymPsychicMoves.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import type {GymBattleState} from '../src/gyms/gymBattleState.js';
const basic={kind:'basic'} as const;
function state(){
  const sabrina=prepareGymOpponent(KANTO_GYMS[5]!).team;
  return createGymBattleState([
    {uid:1,combatant:sabrina[0]},{uid:2,combatant:sabrina[1]},
    {uid:3,combatant:sabrina[2]}],sabrina);
}
function applied<T extends {status:string}>(r:T):Extract<T,{status:'applied'}>{
  expect(r.status).toBe('applied');
  if(r.status!=='applied')throw Error('Ação deveria ser aplicada.');
  return r as Extract<T,{status:'applied'}>;
}
describe('GYM-02C2b2 — catálogo psíquico e efeitos de Sabrina',()=>{
  it('todos os oito líderes têm três membros e Sabrina conhece golpes FRLG válidos',()=>{
    for(const gym of KANTO_GYMS)
      expect(prepareGymOpponent(gym).team).toHaveLength(3);
    for(const id of [64,65]){
      const moves=gymPsychicLevelMoves(id,60);
      for(const name of ['confusion','psybeam','psychic'])
        expect(moves.some(m=>m.move.name===name)).toBe(true);
    }
    expect(gymPsychicSecondary('confusion')).toEqual({kind:'confusion',chance:10});
    expect(gymPsychicSecondary('psybeam')).toEqual({kind:'confusion',chance:10});
    expect(gymPsychicSecondary('psychic')).toEqual({
      kind:'special-defense-drop',chance:10
    });
    expect(gymPsychicSecondary('ember')).toBeNull();
  });
  it('confusão dura só ações do próprio Pokémon, preservada em trocas',()=>{
    let s=gymApplyConfusion(state(),'player',4);
    s=applied(switchGymPokemon(s,'player',1)).state;
    expect(s.player.fighters[0]!.confusionTurns).toBe(4);
    s=applied(switchGymPokemon(s,'player',0)).state;
    expect(s.player.fighters[0]!.confusionTurns).toBe(4);
    s=gymTickConfusion(s,'player');
    expect(s.player.fighters[0]!.confusionTurns).toBe(3);
    expect(()=>gymApplyConfusion(s,'player',6)).toThrow();
  });
  it('autodano por confusão pode impedir ataque sem consumir SP; seed reproduz',()=>{
    const s=gymApplyConfusion(state(),'player',3);
    const before=s.player.fighters[0]!;
    const list=Array.from({length:60},(_,seed)=>resolveGymTurn(s,basic,basic,seed));
    const hit=list.find(r=>r.status==='applied'
      &&r.log.some(x=>x.includes('se feriu na confusão')));
    expect(hit).toBeDefined();
    if(hit?.status==='applied'){
      expect(hit.state.player.fighters[0]!.sp).toBe(before.sp);
      expect(hit.state.player.fighters[0]!.confusionTurns).toBe(2);
      expect(hit.state.player.fighters[0]!.hp).toBeLessThan(before.hp);
    }
    expect(gymConfusionSelfDamage({level:20,attack:40,defense:40}))
      .toBeGreaterThan(0);
    expect(resolveGymTurn(s,basic,basic,25)).toEqual(
      resolveGymTurn(s,basic,basic,25));
  });
  it('Psychic aplica sua queda de Special Defense em seeds elegíveis',()=>{
    let s:GymBattleState=state();
    const pokemon=s.player.fighters[0]!;
    // O Pokémon principal de Sabrina (Mr. Mime) conhece Psychic no FRLG.
    const psychic=pokemon.combatant.moves?.find(m=>m.name==='psychic');
    expect(psychic).toBeDefined();
    const hits=Array.from({length:400},(_,seed)=>resolveGymTurn(s,
      {kind:'move',moveName:'psychic'},basic,seed));
    const dropped=hits.find(r=>r.status==='applied'&&
      (r.state.leader.fighters[0]!.effects?.specialDefenseDrops??0)>0);
    expect(dropped).toBeDefined();
    s=gymDropStat(s,'leader','specialDefenseDrops');
    expect(s.leader.fighters[0]!.effects?.specialDefenseDrops).toBe(1);
    expect(s.leader.fighters[0]!.hp).toBe(
      s.leader.fighters[0]!.combatant.stats.hp);
  });
});
