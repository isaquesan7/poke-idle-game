import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,KANTO_BATTLE_SPECIES,kantoRegionalEncounter,
  pokemonOwnStats,pokemonFinalStats,zeroStats,
  simulateKantoBattle,battleTrainerXp
} from '../src/index.js';
import type {Combatant,KantoBattleResult,StatValues} from '../src/index.js';

/**
 * D064AM — auditoria determinística do MOTOR, não sessão humana.
 * 4 regiões × 3 níveis × 6 espécies × 2 perfis × 32 seeds = 4.608 confrontos.
 * Não usa writer, recompensas, RNG global, Pokébolas, save ou relógio.
 * O catálogo padrão de golpes é provisório; nenhum golpe/atributo é
 * artificialmente alterado na execução do simulador.
 */
const REGION_IDS=[7,8,9,10] as const;
const LEADERS=[3,6,9,25,94,130] as const;
const MODES=['base','trained'] as const;
const SAMPLES=32;
const round=(v:number)=>Math.round(v*100)/100;
const fraction=(count:number,total:number)=>round(count/total*100);

function seeded(regionId:number,leaderId:number,level:number,modeIndex:number,sample:number):number {
  // Mistura determinística para amostrar o mesmo espaço uint32 usado pelo writer.
  let x=(Math.imul(regionId,0x9e3779b1)^Math.imul(leaderId,0x85ebca6b)
    ^Math.imul(level,0xc2b2ae35)^Math.imul(modeIndex+1,0x27d4eb2f)
    ^Math.imul(sample+1,0x165667b1))>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;
  x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;
  return (x^(x>>>16))>>>0;
}
function combatant(id:number,level:number,mode:'base'|'trained'):Combatant {
  const definition=KANTO_BATTLE_SPECIES[id];
  if(!definition)throw Error('Espécie fora do catálogo');
  const manual=zeroStats();
  const trainer=zeroStats();
  if(mode==='trained'){
    for(const key of Object.keys(manual) as (keyof StatValues)[]){
      manual[key]=5;
      trainer[key]=40;
    }
  }
  const stats=mode==='base'
    ?pokemonOwnStats(definition.base,level,manual)
    :pokemonFinalStats(definition.base,level,manual,trainer,75);
  return {speciesId:id,name:definition.name,types:definition.types,
    level,stats,move:definition.move,rank:0};
}
function percentile(values:readonly number[],portion:number):number {
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.max(0,Math.ceil(portion*sorted.length)-1)]!;
}
interface Sample {
  readonly result:KantoBattleResult;
  readonly wildLevel:number;
  readonly wildId:number;
}
function summary(samples:readonly Sample[]) {
  const n=samples.length;
  const battles=samples.map(s=>s.result);
  const wins=battles.filter(b=>b.outcome==='win').length;
  const losses=battles.filter(b=>b.outcome==='loss').length;
  const draws=n-wins-losses;
  const lines=battles.map(b=>b.log.length);
  const turns=battles.map(b=>b.turns);
  const mean=(values:readonly number[])=>round(values.reduce((a,b)=>a+b,0)/values.length);
  const p95Lines=percentile(lines,.95);
  return {
    n,winPct:fraction(wins,n),lossPct:fraction(losses,n),drawPct:fraction(draws,n),
    meanTurns:mean(turns),p95Turns:percentile(turns,.95),
    cap30Pct:fraction(battles.filter(b=>b.turns===30).length,n),
    meanLogLines:mean(lines),p95LogLines:p95Lines,
    // Primeira linha é exibida imediatamente; as demais são temporizadas.
    // É duração TEÓRICA de playback sem pausas/atrasos do browser.
    p95PlaybackNormalSec:round(Math.max(0,p95Lines-1)*.9),
    p95PlaybackFastSec:round(Math.max(0,p95Lines-1)*.45),
    p95PlaybackAssistiveSec:Math.max(0,p95Lines-1)*3,
    meanWildLevel:mean(samples.map(s=>s.wildLevel)),
    meanWinTrainerXpPerEncounter:round(samples.reduce((sum,s)=>
      sum+(s.result.outcome==='win'?battleTrainerXp(s.wildLevel):0),0)/n),
    distinctWildSpecies:new Set(samples.map(s=>s.wildId)).size
  };
}
describe('D064AM — combate por região avançada, seeds e níveis',()=>{
  it('estratifica 4.608 confrontos sem alterar economia nem motor',()=>{
    const rows:Record<string,ReturnType<typeof summary>>={};
    const all:Sample[]=[];
    for(const regionId of REGION_IDS){
      const region=KANTO_REGIONS.find(r=>r.id===regionId)!;
      const levels=[region.levelMin,region.levelMax,100] as const;
      for(const level of levels)for(let m=0;m<MODES.length;m++){
        const mode=MODES[m]!;
        const bucket:Sample[]=[];
        for(const id of LEADERS){
          const player=combatant(id,level,mode);
          for(let i=0;i<SAMPLES;i++){
            const seed=seeded(regionId,id,level,m,i);
            const encountered=kantoRegionalEncounter(regionId,seed,level);
            expect(encountered).not.toBeNull();
            const {speciesId,wildLevel}= {speciesId:encountered!.speciesId,wildLevel:encountered!.level};
            expect(region.speciesIds).toContain(speciesId);
            expect(wildLevel).toBeGreaterThanOrEqual(region.levelMin);
            expect(wildLevel).toBeLessThanOrEqual(region.levelMax);
            const wild=combatant(speciesId,wildLevel,'base');
            const result=simulateKantoBattle(player,wild,seed);
            expect(result.frames).toHaveLength(result.log.length);
            expect(result.turns).toBeGreaterThanOrEqual(1);
            expect(result.turns).toBeLessThanOrEqual(30);
            expect(result.frames.at(-1)?.playerHp).toBe(result.playerRemainingHp);
            expect(result.frames.at(-1)?.wildHp).toBe(result.wildRemainingHp);
            bucket.push({result,wildId:speciesId,wildLevel});
          }
        }
        expect(bucket).toHaveLength(LEADERS.length*SAMPLES);
        rows['R'+regionId+'-'+mode+'-L'+level]=summary(bucket);
        all.push(...bucket);
      }
    }
    expect(all).toHaveLength(4*3*6*2*SAMPLES);
    // Agregados explícitos por prefixo mantêm todo resultado vinculado à região.
    const byRegion:Record<string,{samples:number;meanWinPct:number;p95ReplaySec:number}>={};
    for(const id of REGION_IDS){
      const entries=Object.entries(rows).filter(([key])=>key.startsWith('R'+id+'-'));
      byRegion['R'+id]={
        samples:entries.reduce((sum,[,r])=>sum+r.n,0),
        meanWinPct:round(entries.reduce((sum,[,r])=>sum+r.winPct,0)/entries.length),
        p95ReplaySec:Math.max(...entries.map(([,r])=>r.p95PlaybackNormalSec))
      };
    }
    expect(Object.keys(rows)).toHaveLength(24);
    expect(Object.values(byRegion).every(v=>v.samples===1152)).toBe(true);
    expect(Object.values(rows).every(row=>row.winPct+row.lossPct+row.drawPct>=99.98)).toBe(true);
    (globalThis as unknown as {console:{info:(text:string)=>void}})
      .console.info('D064AM_REGION_BATTLE_REPORT '+JSON.stringify({
        version:'D064AM',fixtures:'deterministic-engine-only',
        warnings:'NO USER TELEMETRY; no writer, bag, actual elapsed browser time or real play-session; leaders hypothetical',
        totalBattles:all.length,regions:byRegion,segments:rows
      }));
  },90000);
});
