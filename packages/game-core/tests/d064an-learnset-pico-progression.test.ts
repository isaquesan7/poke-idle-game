import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,KANTO_SUPPORT_MOVES,
  kantoRegionalEncounter,kantoLevelMoves,kantoSupportMoves,
  kantoTypeMultiplier,pokemonOwnStats,pokemonFinalStats,zeroStats,
  simulateKantoBattle,battleTrainerXp,xpThreshold,grantXp,
  legacyMoveRankLimits
} from '../src/index.js';
import type {Combatant,KantoBattleResult,KantoMove,StatValues} from '../src/index.js';

/**
 * D064AN — auditoria COM learnsets efetivamente publicados e quatro slots.
 * Nenhum movimento/tipo/dano novo é criado. O golpe default do catálogo é
 * preservado em todos os loadouts; os demais são APENAS movimentos já liberados
 * por nível no recorte atual. Sem TM09, sem PokéAPI ao vivo, sem save real.
 */
const REGIONS=[8,9,10] as const;
const LEADERS=[3,6,9,25,94,130,121,149] as const;
const LEVELS=[81,90,100] as const;
const BUILDS=['base','moderate'] as const;
const LOADOUTS=['default','learned'] as const;
const SEEDS=32;
const rounded=(v:number)=>Math.round(v*100)/100;
type Build=typeof BUILDS[number];
type Loadout=typeof LOADOUTS[number];
interface RecordBattle {
  result:KantoBattleResult;
  wildId:number;
  wildLevel:number;
  playerId:number;
  playerLevel:number;
  logLines:number;
}
function seedFor(region:number,id:number,level:number,build:number,sample:number):number {
  let x=(Math.imul(region,0x9e3779b1)^Math.imul(id,0x85ebca6b)
    ^Math.imul(level,0xc2b2ae35)^Math.imul(build+1,0x27d4eb2f)
    ^Math.imul(sample+1,0x165667b1))>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;
  x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;
  return(x^(x>>>16))>>>0;
}
function loadout(id:number,level:number,which:Loadout):readonly KantoMove[]{
  const species=KANTO_BATTLE_SPECIES[id]!;
  if(which==='default')return[species.move];
  const allowed=[
    ...kantoLevelMoves(id,level),
    ...kantoSupportMoves(id,level)
  ].map(entry=>entry.move);
  const unique=new Map<string,KantoMove>();
  for(const move of allowed)unique.set(move.name,move);
  unique.delete(species.move.name);
  const moves=[...unique.values()];
  // Estratégia determinística de escolha somente para a fixture:
  // primeiro dois ataques de melhor poder/tipo próprio, depois suporte.
  moves.sort((a,b)=>{
    const score=(m:KantoMove)=>m.category==='status'?0:
      m.power*m.accuracy*(species.types.includes(m.type)?1.5:1);
    return score(b)-score(a)||a.name.localeCompare(b.name);
  });
  const picked=[species.move,...moves.slice(0,3)];
  expect(picked.length).toBeLessThanOrEqual(4);
  expect(new Set(picked.map(move=>move.name)).size).toBe(picked.length);
  expect(picked[0]!.name).toBe(species.move.name);
  for(const move of picked.slice(1)){
    expect(unique.has(move.name)).toBe(true);
    expect(KANTO_BATTLE_MOVES[move.name]??KANTO_SUPPORT_MOVES[move.name]).toEqual(move);
  }
  expect(picked.some(m=>m.category!=='status')).toBe(true);
  return picked;
}
function combatant(id:number,level:number,build:Build,which:Loadout):Combatant{
  const species=KANTO_BATTLE_SPECIES[id]!;
  const manual=zeroStats(),trainer=zeroStats();
  const trained=build==='moderate';
  if(trained){
    for(const key of Object.keys(manual) as (keyof StatValues)[]){
      manual[key]=4;trainer[key]=8;
    }
  }
  const moves=loadout(id,level,which);
  const limits=legacyMoveRankLimits(level);
  expect(limits.skillPoints).toBeGreaterThanOrEqual(0);
  const stats=trained
    ?pokemonFinalStats(species.base,level,manual,trainer,60)
    :pokemonOwnStats(species.base,level,manual);
  return{
    speciesId:id,name:species.name,types:species.types,level,stats,
    move:moves[0]!,moves,rank:0
  };
}
function pct(n:number,all:number):number{return rounded(100*n/all);}
function mean(values:readonly number[]):number {
  return rounded(values.reduce((sum,n)=>sum+n,0)/values.length);
}
function p95(values:readonly number[]):number{
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.ceil(sorted.length*.95)-1]!;
}
function summarize(records:readonly RecordBattle[]){
  const n=records.length;
  const wins=records.filter(entry=>entry.result.outcome==='win');
  const losses=records.filter(entry=>entry.result.outcome==='loss');
  const draws=n-wins.length-losses.length;
  const xp=mean(records.map(entry=>
    entry.result.outcome==='win'?battleTrainerXp(entry.wildLevel):0));
  const avgLog=mean(records.map(entry=>entry.logLines));
  const avgPresentationSeconds=rounded((avgLog-1)*.9);
  const xpTo93=Array.from({length:11},(_,i)=>xpThreshold('trainer',82+i))
    .reduce((sum,n)=>sum+n,0);
  return{
    n,wins:wins.length,winPct:pct(wins.length,n),lossPct:pct(losses.length,n),
    drawPct:pct(draws,n),meanTurns:mean(records.map(e=>e.result.turns)),
    p95Turns:p95(records.map(e=>e.result.turns)),
    meanLines:avgLog,p95Lines:p95(records.map(e=>e.logLines)),
    theoreticalPresentationSeconds:avgPresentationSeconds,
    theoreticalP95PresentationSeconds:rounded((p95(records.map(e=>e.logLines))-1)*.9),
    meanTrainerXpPerAttempt:xp,
    // 20 TENTATIVAS/h, com derrotas sem XP. Não confundir com 20 vitórias/h.
    theoreticalTrainerXpAt20AttemptsPerHour:rounded(xp*20),
    theoreticalHoursTrainer82To93At20AttemptsPerHour:
      xp>0?rounded(xpTo93/(xp*20)):null,
    distinctWildIds:new Set(records.map(e=>e.wildId)).size
  };
}
describe('D064AN — slots legais e evolução de nível sob derrota no Pico Dracônico',()=>{
  it('usa somente catálogo e learnsets liberados, além do golpe inicial',()=>{
    let enhanced=0;
    for(const id of LEADERS)for(const level of LEVELS){
      const base=loadout(id,level,'default');
      const learned=loadout(id,level,'learned');
      expect(base).toHaveLength(1);
      expect(learned.length).toBeGreaterThanOrEqual(1);
      if(learned.length>1)enhanced++;
      const species=KANTO_BATTLE_SPECIES[id]!;
      for(const extra of learned.slice(1)){
        const candidates=[
          ...kantoLevelMoves(id,level),
          ...kantoSupportMoves(id,level)
        ].map(x=>x.move.name);
        expect(candidates).toContain(extra.name);
      }
      expect(species.id).toBe(id);
    }
    expect(enhanced).toBeGreaterThan(0);
    expect(legacyMoveRankLimits(81).skillPoints).toBeGreaterThan(0);
  });
  it('mede 3072 confrontos pareados incluindo região 8 como base e 10 como contexto',()=>{
    const report:Record<string,ReturnType<typeof summarize>>={};
    const examples:Record<string,readonly string[]>={};
    let total=0;
    let legalEnhanced=0;
    for(const regionId of REGIONS)for(const level of LEVELS){
      const region=KANTO_REGIONS[regionId-1]!;
      expect(level).toBeGreaterThanOrEqual(region.levelMin===91?81:region.levelMin-10);
      const entries:Record<string,RecordBattle[]>={};
      for(const build of BUILDS)for(const which of LOADOUTS)
        entries[build+'-'+which]=[];
      for(const id of LEADERS)for(let buildIndex=0;buildIndex<BUILDS.length;buildIndex++){
        const build=BUILDS[buildIndex]!;
        const basic=combatant(id,level,build,'default');
        const learned=combatant(id,level,build,'learned');
        if(learned.moves!.length>1)legalEnhanced++;
        examples[id+'-L'+level]=learned.moves!.map(m=>m.name);
        for(let i=0;i<SEEDS;i++){
          const seed=seedFor(regionId,id,level,buildIndex,i);
          const encountered=kantoRegionalEncounter(regionId,seed,level)!;
          expect(region.speciesIds).toContain(encountered.speciesId);
          const enemy=combatant(encountered.speciesId,encountered.level,'base','default');
          for(const [which,player] of [['default',basic],['learned',learned]] as const){
            const result=simulateKantoBattle(player,enemy,seed);
            expect(result.log).toHaveLength(result.frames.length);
            expect(result.turns).toBeGreaterThanOrEqual(1);
            expect(result.turns).toBeLessThanOrEqual(30);
            expect(result.frames.at(-1)?.playerHp).toBe(result.playerRemainingHp);
            expect(result.frames.at(-1)?.wildHp).toBe(result.wildRemainingHp);
            entries[build+'-'+which]!.push({
              result,wildId:encountered.speciesId,wildLevel:encountered.level,
              playerId:id,playerLevel:level,logLines:result.log.length
            });
            total++;
          }
        }
      }
      for(const [key,records] of Object.entries(entries)){
        expect(records).toHaveLength(LEADERS.length*SEEDS);
        report['R'+regionId+'-L'+level+'-'+key]=summarize(records);
      }
    }
    expect(total).toBe(3*3*8*2*2*SEEDS);
    expect(legalEnhanced).toBeGreaterThan(0);
    expect(Object.keys(report)).toHaveLength(3*3*2*2);
    // Mesmo treino/semente/rival só difere no loadout.
    // Sem expectativa de melhoria universal: tipos/status/IA podem piorar.
    for(const r of REGIONS)for(const l of LEVELS)for(const build of BUILDS){
      const a=report['R'+r+'-L'+l+'-'+build+'-default']!;
      const b=report['R'+r+'-L'+l+'-'+build+'-learned']!;
      expect(a.n).toBe(b.n);
      expect(a.winPct+a.lossPct+a.drawPct).toBeGreaterThanOrEqual(99.98);
      expect(b.winPct+b.lossPct+b.drawPct).toBeGreaterThanOrEqual(99.98);
    }
    const aggregate:Record<string,{
      initialWinPct:number;learnedWinPct:number;initialXpPerAttempt:number;
      learnedXpPerAttempt:number;learnedP95ReplaySeconds:number
    }>={};
    for(const r of REGIONS){
      // Mesma cardinalidade em cada linha; média por estrato é válida.
      const group=Object.entries(report).filter(([key])=>key.startsWith('R'+r+'-'));
      const initial=group.filter(([key])=>key.endsWith('-default'));
      const learned=group.filter(([key])=>key.endsWith('-learned'));
      aggregate['R'+r]={
        initialWinPct:mean(initial.map(([,row])=>row.winPct)),
        learnedWinPct:mean(learned.map(([,row])=>row.winPct)),
        initialXpPerAttempt:mean(initial.map(([,row])=>row.meanTrainerXpPerAttempt)),
        learnedXpPerAttempt:mean(learned.map(([,row])=>row.meanTrainerXpPerAttempt)),
        learnedP95ReplaySeconds:Math.max(...learned.map(([,row])=>row.theoreticalP95PresentationSeconds))
      };
    }
    // Um encontro perdido, empate ou não concluído não concede XP de vitória.
    expect(grantXp('trainer',{level:82,xp:0},0)).toEqual({level:82,xp:0,gainedLevels:0});
    (globalThis as unknown as {console:{info:(s:string)=>void}})
      .console.info('D064AN_LEARNSET_PROGRESS_REPORT '+JSON.stringify({
        version:'D064AN',source:'deterministic-engine-fixtures',
        disclaimer:'NOT user telemetry; no actual elapsed browser time; leader access/ownership and complete FRLG learnsets not guaranteed',
        total,legalEnhanced,aggregate,examples,segments:report
      }));
  },90000);
});
