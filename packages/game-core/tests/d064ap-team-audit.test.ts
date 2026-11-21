/**
 * D064AP — diagnóstico de diversidade de equipe, não uma funcionalidade de troca.
 * As quatro espécies são hipóteses de posse e treino, NÃO um save/captura provada.
 * Cada batalha é independente; "oracle" é teto contrafactual de escolher o melhor
 * líder sabendo o resultado ANTES do combate, não estratégia disponível no jogo.
 * Sem runtime, XP grant, drop, alteração de chance ou novos golpes.
 */
import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_REGIONS,KANTO_BATTLE_MOVES,KANTO_SUPPORT_MOVES,
  kantoLevelMoves,kantoSupportMoves,kantoRegionalEncounter,
  pokemonFinalStats,pokemonOwnStats,zeroStats,
  simulateKantoBattle,battleTrainerXp
} from '../src/index.js';
import type {Combatant,KantoMove,StatValues} from '../src/index.js';

const REGIONS=[8,9,10] as const;
const LEVELS=[81,90,100] as const;
const TEAM=[3,6,9,94] as const;
const SEEDS=32;
const round=(n:number)=>Math.round(n*100)/100;

function mixSeed(region:number,level:number,i:number):number{
  let x=(Math.imul(region,0x9e3779b1)^Math.imul(level,0x85ebca6b)
    ^Math.imul(i+1,0xc2b2ae35))>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;
  x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;
  return (x^(x>>>16))>>>0;
}

function legalMoves(speciesId:number,level:number):readonly KantoMove[]{
  const species=KANTO_BATTLE_SPECIES[speciesId]!;
  const found=new Map<string,KantoMove>();
  for(const item of [...kantoLevelMoves(speciesId,level),...kantoSupportMoves(speciesId,level)])
    found.set(item.move.name,item.move);
  found.delete(species.move.name);
  const scored=[...found.values()].sort((a,b)=>{
    const score=(move:KantoMove)=>move.category==='status'?0:
      move.power*move.accuracy*(species.types.includes(move.type)?1.5:1);
    return score(b)-score(a)||a.name.localeCompare(b.name);
  });
  const result=[species.move,...scored.slice(0,3)];
  expect(result.length).toBeLessThanOrEqual(4);
  expect(new Set(result.map(m=>m.name)).size).toBe(result.length);
  for(const move of result.slice(1))
    expect(KANTO_BATTLE_MOVES[move.name]??KANTO_SUPPORT_MOVES[move.name]).toEqual(move);
  return result;
}

function fighter(speciesId:number,level:number,trained:boolean):Combatant{
  const species=KANTO_BATTLE_SPECIES[speciesId]!;
  const manual=zeroStats(),trainer=zeroStats();
  if(trained)for(const key of Object.keys(manual) as (keyof StatValues)[]){
    manual[key]=4;trainer[key]=8;
  }
  const moves=legalMoves(speciesId,level);
  return {
    speciesId,name:species.name,types:species.types,level,
    stats:trained?pokemonFinalStats(species.base,level,manual,trainer,60):
      pokemonOwnStats(species.base,level,manual),
    move:moves[0]!,moves,rank:0
  };
}

describe('D064AP — equipe hipotética e limites de progressão regional',()=>{
  it('só usa ataques atualmente equipáveis pelo nível, sem liberar TM ou efeitos bloqueados',()=>{
    for(const id of TEAM)for(const level of LEVELS){
      const moves=legalMoves(id,level);
      const allowed=new Set([...kantoLevelMoves(id,level),...kantoSupportMoves(id,level)]
        .map(x=>x.move.name));
      for(const move of moves.slice(1))expect(allowed.has(move.name)).toBe(true);
      expect(moves.map(m=>m.name)).not.toContain('bullet-seed');
    }
    expect(legalMoves(94,81).map(m=>m.name)).toContain('shadow-punch');
    expect(legalMoves(94,81).map(m=>m.name)).not.toContain('hypnosis');
  });

  it('compara um líder fixo, rotação pré-determinada e teto contrafactual da equipe',()=>{
    const report:Record<string,unknown>={};
    let total=0;
    for(const regionId of REGIONS)for(const level of LEVELS)for(const trained of [false,true]){
      const fixed=fighter(TEAM[0],level,trained);
      const team=TEAM.map(id=>fighter(id,level,trained));
      let fixedWins=0,rotationWins=0,oracleWins=0,oracleXp=0,rotationXp=0;
      let sumLines=0,maxLines=0;
      const wildIds=new Set<number>();
      for(let sample=0;sample<SEEDS;sample++){
        const seed=mixSeed(regionId,level,sample);
        const encounter=kantoRegionalEncounter(regionId,seed,level)!;
        expect(KANTO_REGIONS[regionId-1]!.speciesIds).toContain(encounter.speciesId);
        wildIds.add(encounter.speciesId);
        const wild=fighter(encounter.speciesId,encounter.level,false);
        const results=team.map(member=>simulateKantoBattle(member,wild,seed));
        // Mesmo encontro/seed, mas RNG posterior muda com golpes distintos.
        for(const result of results){
          expect(result.log).toHaveLength(result.frames.length);
          expect(result.turns).toBeGreaterThanOrEqual(1);
          expect(result.turns).toBeLessThanOrEqual(30);
        }
        const first=results[0]!;
        const rotated=results[sample%TEAM.length]!;
        const anyWin=results.some(result=>result.outcome==='win');
        const xp=battleTrainerXp(encounter.level);
        if(first.outcome==='win')fixedWins++;
        if(rotated.outcome==='win'){rotationWins++;rotationXp+=xp;}
        if(anyWin){oracleWins++;oracleXp+=xp;}
        expect(anyWin||first.outcome!=='win').toBe(true);
        expect(anyWin||rotated.outcome!=='win').toBe(true);
        sumLines+=rotated.log.length;
        maxLines=Math.max(maxLines,rotated.log.length);
        total+=results.length;
      }
      const key=`R${regionId}-L${level}-${trained?'moderate':'base'}`;
      expect(oracleWins).toBeGreaterThanOrEqual(fixedWins);
      expect(oracleWins).toBeGreaterThanOrEqual(rotationWins);
      report[key]={
        encounters:SEEDS,uniqueWildSpecies:wildIds.size,
        fixedWinPct:round(fixedWins/SEEDS*100),
        rotationWinPct:round(rotationWins/SEEDS*100),
        oracleUpperBoundWinPct:round(oracleWins/SEEDS*100),
        rotationXpPerAttempt:round(rotationXp/SEEDS),
        oracleUpperBoundXpPerAttempt:round(oracleXp/SEEDS),
        meanReplayLines:round(sumLines/SEEDS),
        maxReplayLines:maxLines,
        meanReplaySeconds900ms:round((sumLines/SEEDS-1)*.9)
      };
    }
    expect(total).toBe(3*3*2*SEEDS*TEAM.length);
    expect(Object.keys(report)).toHaveLength(18);
    console.info('D064AP_TEAM_AUDIT_REPORT '+JSON.stringify({
      version:'D064AP',source:'deterministic-engine-fixtures',
      warning:'NOT user telemetry; all four Pokemon assumed owned/trained; no party-switching in battle; oracle sees future outcome and is NOT playable; replay seconds are theoretical',
      battles:total,team:TEAM,segments:report
    }));
  },90000);
});
