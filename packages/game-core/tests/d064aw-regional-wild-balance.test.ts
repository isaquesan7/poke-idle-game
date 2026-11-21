/**
 * D064AW — auditoria diagnóstica da IA selvagem publicada em D064AV.
 * NÃO é telemetria nem taxa de vitória de jogadores reais. Compara os
 * mesmos encontros/seeds com o selvagem antigo (1 ataque padrão) e
 * o novo (até 4 golpes FRLG), controlando espécie, nível e stats.
 * Não altera nenhum dado, recompensa, economia, captura ou gameplay.
 */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_REGIONS,kantoRegionCatalogInvariant,
  kantoRegionalEncounter,kantoWildMoveLoadout,
  pokemonOwnStats,pokemonFinalStats,zeroStats,
  kantoLevelMoves,kantoSupportMoves,simulateKantoBattle,
  kantoMoveSpCost
} from '../src/index.js';
import type {Combatant,KantoMove,StatValues} from '../src/index.js';

const SEEDS_PER_CELL=12;
const LEADS=[
  [1,2,3],[4,5,6],[7,8,9]
] as const;
const STATS=['hp','attack','defense','specialAttack','specialDefense','speed'] as const;
const round=(x:number)=>Math.round(x*100)/100;
const seedFor=(region:number,level:number,starter:number,variant:number,index:number):number=>{
  let x=(Math.imul(region,0x9e3779b1)^Math.imul(level,0x85ebca6b)
    ^Math.imul(starter+1,0xc2b2ae35)^Math.imul(variant+1,0x27d4eb2f)
    ^Math.imul(index+1,0x165667b1))>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;
  x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;
  return (x^(x>>>16))>>>0;
};

function starterAtLevel(line:readonly number[],level:number):number{
  return line[level>=36?2:level>=16?1:0]!;
}
function player(speciesId:number,level:number,trained:boolean):Combatant{
  const species=KANTO_BATTLE_SPECIES[speciesId]!;
  const own=zeroStats(),trainer=zeroStats();
  if(trained)for(const key of STATS){own[key]=4;trainer[key]=8;}
  const learned=[...kantoLevelMoves(speciesId,level),...kantoSupportMoves(speciesId,level)]
    .sort((a,b)=>b.learnedAt-a.learnedAt||a.move.name.localeCompare(b.move.name));
  // Simula um set plausível sem TM. A primeira posição é o movimento ativo;
  // não atribuir automaticamente os melhores golpes com conhecimento do inimigo.
  const attack=learned.filter(x=>x.move.category!=='status').slice(0,3).map(x=>x.move);
  const support=learned.filter(x=>x.move.category==='status').slice(0,1).map(x=>x.move);
  const moves=attack.length?[...attack,...support]:[species.move,...support];
  return {speciesId,name:species.name,types:species.types,level,
    stats:trained?pokemonFinalStats(species.base,level,own,trainer,60)
      :pokemonOwnStats(species.base,level,own),
    move:moves[0]!,moves,rank:0};
}
function wild(speciesId:number,level:number,newAi:boolean):Combatant{
  const species=KANTO_BATTLE_SPECIES[speciesId]!;
  const moves=newAi?kantoWildMoveLoadout(speciesId,level,species.move)
    :[species.move];
  return {speciesId,name:species.name,types:species.types,level,
    stats:pokemonOwnStats(species.base,level,zeroStats()),
    move:moves[0]!,moves,rank:0};
}

describe('D064AW — equilíbrio regional após equipagem de IA selvagem',()=>{
  it('compara todas as dez regiões e dois pontos de nível em seeds fixas, sem mudar gameplay',()=>{
    expect(kantoRegionCatalogInvariant()).toBe(true);
    const regional:Record<string,unknown>={};
    let battles=0,changedLoadouts=0,illegalMoves=0,oldWins=0,newWins=0;
    let oldTurns=0,newTurns=0,oldLines=0,newLines=0;
    let newWildSpendingActions=0,oldWildSpendingActions=0;
    let newWildSpecialMoveHits=0,oldWildSpecialMoveHits=0;
    let differences=0;
    for(const region of KANTO_REGIONS){
      const levels=[Math.min(region.levelMax,region.levelMin+2),
        Math.max(region.levelMin,region.levelMax-1)];
      const segment:Record<string,unknown>={};
      for(const level of levels)for(const trained of [false,true]){
        let count=0,winOld=0,winNew=0,totalTurns=0,totalLines=0;
        let changed=0,uniqueSpecies=new Set<number>();
        let wildNewSkillActions=0,wildOldSkillActions=0;
        for(let starter=0;starter<LEADS.length;starter++){
          const id=starterAtLevel(LEADS[starter]!,level);
          const p=player(id,level,trained);
          for(let sample=0;sample<SEEDS_PER_CELL;sample++){
            const seed=seedFor(region.id,level,starter,trained?1:0,sample);
            const encounter=kantoRegionalEncounter(region.id,seed,level)!;
            expect(region.speciesIds).toContain(encounter.speciesId);
            expect(encounter.level).toBeGreaterThanOrEqual(region.levelMin);
            expect(encounter.level).toBeLessThanOrEqual(region.levelMax);
            uniqueSpecies.add(encounter.speciesId);
            const oldEnemy=wild(encounter.speciesId,encounter.level,false);
            const newEnemy=wild(encounter.speciesId,encounter.level,true);
            if(newEnemy.moves!.length>1||newEnemy.move.name!==oldEnemy.move.name){
              changed++;changedLoadouts++;
            }
            const allowed=new Set([
              ...kantoLevelMoves(encounter.speciesId,encounter.level),
              ...kantoSupportMoves(encounter.speciesId,encounter.level)
            ].map(x=>x.move.name));
            const anyOffensive=kantoLevelMoves(encounter.speciesId,encounter.level)
              .some(x=>x.move.category!=='status');
            for(const move of newEnemy.moves!){
              if(!allowed.has(move.name)){
                if(anyOffensive||move.name!==oldEnemy.move.name)illegalMoves++;
              }
              expect(kantoMoveSpCost(move)).toBeGreaterThan(0);
            }
            const a=simulateKantoBattle(p,oldEnemy,seed);
            const b=simulateKantoBattle(p,newEnemy,seed);
            expect(a.frames).toHaveLength(a.log.length);
            expect(b.frames).toHaveLength(b.log.length);
            expect(b.wildRemainingSp).toBeGreaterThanOrEqual(0);
            expect(b.playerRemainingSp).toBeGreaterThanOrEqual(0);
            expect(b.turns).toBeLessThanOrEqual(30);
            if(a.outcome==='win'){winOld++;oldWins++;}
            if(b.outcome==='win'){winNew++;newWins++;}
            if(a.outcome!==b.outcome)differences++;
            oldTurns+=a.turns;newTurns+=b.turns;
            oldLines+=a.log.length;newLines+=b.log.length;
            totalTurns+=b.turns;totalLines+=b.log.length;
            const oldSkillFrames=a.frames.filter(f=>f.actor==='wild'
              &&f.spCost!==undefined&&f.spCost>0);
            const newSkillFrames=b.frames.filter(f=>f.actor==='wild'
              &&f.spCost!==undefined&&f.spCost>0);
            oldWildSpendingActions+=oldSkillFrames.length;
            newWildSpendingActions+=newSkillFrames.length;
            wildOldSkillActions+=oldSkillFrames.length;
            wildNewSkillActions+=newSkillFrames.length;
            oldWildSpecialMoveHits+=a.frames.filter(f=>f.actor==='wild'&&
              f.kind==='attack'&&f.moveName!==undefined&&
              f.moveName!==oldEnemy.move.name&&f.moveName!=='basic-attack').length;
            newWildSpecialMoveHits+=b.frames.filter(f=>f.actor==='wild'&&
              f.kind==='attack'&&f.moveName!==undefined&&
              f.moveName!==oldEnemy.move.name&&f.moveName!=='basic-attack').length;
            count++;battles+=2;
          }
        }
        segment[`L${level}-${trained?'moderate':'base'}`]={
          samples:count,uniqueWildSpecies:uniqueSpecies.size,
          newLoadoutDifferentPct:round(changed/count*100),
          oldWinPct:round(winOld/count*100),
          newWinPct:round(winNew/count*100),
          deltaWinPoints:round((winNew-winOld)/count*100),
          meanNewTurns:round(totalTurns/count),
          meanNewReplayLines:round(totalLines/count),
          meanNewReplaySeconds900ms:round(Math.max(0,totalLines/count-1)*.9),
          oldWildSpActions:wildOldSkillActions,
          newWildSpActions:wildNewSkillActions
        };
      }
      regional[`R${region.id}-${region.name}`]=segment;
    }
    const samples=battles/2;
    expect(battles).toBe(10*2*2*LEADS.length*SEEDS_PER_CELL*2);
    expect(illegalMoves).toBe(0);
    expect(changedLoadouts).toBeGreaterThan(0);
    expect(oldWildSpecialMoveHits).toBe(0);
    expect(newWildSpecialMoveHits).toBeGreaterThan(0);
    expect(newWildSpendingActions).toBeGreaterThan(0);
    const report={
      version:'D064AW',source:'deterministic-regional-matched-seed-diagnostic',
      caution:'NOT player telemetry; sample teams/stats and region access are hypothetical; no party switching; RNG diverges after moves differ, so outcomes are not strict counterfactual causality; replay duration is theoretical',
      regions:10,encounterPairs:samples,totalBattles:battles,
      changedLoadoutPct:round(changedLoadouts/samples*100),
      oldWinPct:round(oldWins/samples*100),newWinPct:round(newWins/samples*100),
      deltaWinPoints:round((newWins-oldWins)/samples*100),
      changedOutcomePct:round(differences/samples*100),
      meanOldTurns:round(oldTurns/samples),meanNewTurns:round(newTurns/samples),
      meanOldReplayLines:round(oldLines/samples),
      meanNewReplayLines:round(newLines/samples),
      newReplaySeconds900ms:round(Math.max(0,newLines/samples-1)*.9),
      oldWildSpActions:oldWildSpendingActions,
      newWildSpActions:newWildSpendingActions,
      newWildExpandedOffensiveHitFrames:newWildSpecialMoveHits,
      segments:regional
    };
    (globalThis as unknown as {console:{info:(text:string)=>void}}).console.info(
      'D064AW_REGIONAL_BALANCE_REPORT '+JSON.stringify(report));
  },120000);
});
