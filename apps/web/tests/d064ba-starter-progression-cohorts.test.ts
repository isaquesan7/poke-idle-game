/**
 * D064BA — coortes independentes de progressão normal (não-demo).
 *
 * São trajetórias completas de writers, sem alterar JSON/snapshot por fora.
 * Duas estratégias fixas: somente batalhas versus batalhas + expedição
 * regional de 15 minutos a cada 12 encontros. Não há itens, treino manual,
 * novo golpe equipado ou troca de líder; captura desativada para isolar
 * o desempenho do starter. Dados de CI não equivalem a telemetria humana.
 */
import {describe,expect,it} from 'vitest';
import {createPlaySave,readPlaySave,updatePlaySave} from '../src/play/playSave.js';
import {KANTO_REGIONS,kantoEvolutionOptions} from '@kanto/game-core';

class MemoryStorage {
  readonly data=new Map<string,string>();
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,value);}
  removeItem(key:string){this.data.delete(key);}
}
function read(store:MemoryStorage){
  const x=readPlaySave(store);
  if(x.status!=='ready')throw Error('Snapshot indisponível');
  return x.snapshot;
}
function profile(store:MemoryStorage):any{
  return JSON.parse(read(store).journal.raw);
}
function write(store:MemoryStorage,action:Parameters<typeof updatePlaySave>[2]){
  const before=read(store),result=updatePlaySave(store,before.revision,action);
  expect(result.status).toBe('ok');
  const after=read(store);
  expect(after.revision).toBe(before.revision+1);
  // Evolução altera o snapshot v0.2, mas não emite reward receipt.
  const isReward=['regional-battle','battle','start-expedition',
    'claim-expedition','stop-expedition'].includes(action.type);
  expect(after.journal.revision).toBe(before.journal.revision+(isReward?1:0));
  expect(after.journal.receipts).toHaveLength(after.journal.revision);
  return after;
}
/** Seeds de encontro/combate idênticas entre os iniciais na mesma coorte. */
function fightSeed(cohort:number,index:number):number {
  let x=(Math.imul(cohort+17,0x9e3779b1)^Math.imul(index+1,0x85ebca6b))>>>0;
  x=Math.imul(x^(x>>>16),0xc2b2ae35)>>>0;
  return (x^(x>>>13))>>>0;
}
const STARTERS=[{id:1,evolvesTo:2,name:'Bulbasaur'},
  {id:4,evolvesTo:5,name:'Charmander'},
  {id:7,evolvesTo:8,name:'Squirtle'}] as const;
const COHORTS=6,ENCOUNTERS=96;
const EXPEDITION_EVERY=12,EXPEDITION_MS=15*60*1000;
const round=(n:number)=>Math.round(n*100)/100;
type Strategy='battle-only'|'battle-plus-expedition';
type Journey={
  readonly starter:string;readonly cohort:number;readonly policy:Strategy;
  readonly wins:number;readonly attempts:number;readonly firstWin:number|null;
  readonly firstPokemon2:number|null;readonly trainer6:number|null;
  readonly pokemon16:number|null;readonly evolvedAt:number|null;
  readonly region2Eligible:boolean;readonly region2BattleAccepted:boolean;
  readonly pokemonLevel:number;readonly trainerLevel:number;
  readonly expeditions:number;readonly totalExpeditionMinutes:number;
  readonly earlyWins:number;readonly lateWins:number;
  readonly firstRegion2Level:number|null;readonly captures:number;
};
function journey(starter:typeof STARTERS[number],cohort:number,policy:Strategy):Journey{
  const store=new MemoryStorage();
  expect(createPlaySave(store,'Coorte '+cohort,starter.id,1_000,false).status).toBe('ok');
  let initial=profile(store);
  expect(initial.roster[0]).toMatchObject({uid:1,pokemonId:starter.id,level:1,xp:0});
  expect(initial.trainer.level).toBe(1);
  expect(initial.team).toEqual([1]);
  const rule=kantoEvolutionOptions(starter.id)[0]!;
  expect(rule).toMatchObject({from:starter.id,to:starter.evolvesTo,trigger:'level',minLevel:16});
  expect(updatePlaySave(store,read(store).revision,{
    type:'evolution',uid:1,targetSpeciesId:starter.evolvesTo
  }).status).toBe('blocked');
  expect(read(store).revision).toBe(0);

  let wins=0,firstWin:null|number=null,firstPokemon2:null|number=null,
    trainer6:null|number=null,pokemon16:null|number=null,evolvedAt:null|number=null;
  let expeditions=0,earlyWins=0,lateWins=0;
  let simulatedClock=10_000+(cohort*100_000_000);
  for(let attempt=1;attempt<=ENCOUNTERS;attempt++){
    const before=profile(store);
    write(store,{type:'regional-battle',regionId:1,seed:fightSeed(cohort,attempt),
      ballId:null});
    const after=profile(store);
    expect(after.roster[0].uid).toBe(1);
    expect(after.team).toEqual([1]);
    expect(after.roster).toHaveLength(1);
    expect(after.ballPocket.quantities['poke-ball']).toBeGreaterThanOrEqual(12);
    expect(after.roster[0].level).toBeGreaterThanOrEqual(before.roster[0].level);
    expect(after.trainer.level).toBeGreaterThanOrEqual(before.trainer.level);
    expect(after.lastBattle.regionId).toBe(1);
    expect(after.lastBattle.frames).toHaveLength(after.lastBattle.log.length);
    expect(after.lastBattle.captured).toBe(false);
    if(after.lastBattle.outcome==='win'){
      wins++;
      if(firstWin===null)firstWin=attempt;
      if(attempt<=24)earlyWins++;else lateWins++;
    }
    if(after.roster[0].level>=2&&firstPokemon2===null)firstPokemon2=attempt;
    if(after.trainer.level>=6&&trainer6===null)trainer6=attempt;
    if(after.roster[0].level>=16&&pokemon16===null)pokemon16=attempt;
    if(after.roster[0].level>=16&&evolvedAt===null){
      const previous=read(store);
      const level=after.roster[0].level,xp=after.roster[0].xp,
        affinity=after.roster[0].affinity;
      write(store,{type:'evolution',uid:1,targetSpeciesId:starter.evolvesTo});
      const evolved=profile(store).roster[0];
      expect(evolved).toMatchObject({
        uid:1,pokemonId:starter.evolvesTo,level,xp,affinity
      });
      expect(read(store).revision).toBe(previous.revision+1);
      evolvedAt=attempt;
    }
    if(policy==='battle-plus-expedition'&&attempt%EXPEDITION_EVERY===0
      &&profile(store).roster[0].level>=2){
      simulatedClock+=1_000;
      const beforeExp=profile(store);
      write(store,{type:'start-expedition',regionId:1,nowMs:simulatedClock});
      expect(profile(store).expedition).toMatchObject({regionId:1,teamUids:[1]});
      simulatedClock+=EXPEDITION_MS;
      write(store,{type:'claim-expedition',nowMs:simulatedClock});
      expect(profile(store).lastClaim).toMatchObject({
        cycles:90,trainerXP:360,pokemonXP:450
      });
      write(store,{type:'stop-expedition',nowMs:simulatedClock});
      const rewarded=profile(store);
      expect(rewarded.expedition).toBeNull();
      expect(rewarded.roster[0].level).toBeGreaterThanOrEqual(beforeExp.roster[0].level);
      expect(rewarded.trainer.level).toBeGreaterThanOrEqual(beforeExp.trainer.level);
      if(rewarded.trainer.level>=6&&trainer6===null)trainer6=attempt;
      if(rewarded.roster[0].level>=16&&pokemon16===null)pokemon16=attempt;
      // Evolução após a expedição deve ser acionada pelo writer, não automática.
      if(rewarded.roster[0].level>=16&&evolvedAt===null){
        const member=rewarded.roster[0];
        write(store,{type:'evolution',uid:1,targetSpeciesId:starter.evolvesTo});
        expect(profile(store).roster[0]).toMatchObject({
          uid:1,pokemonId:starter.evolvesTo,level:member.level,xp:member.xp
        });
        evolvedAt=attempt;
      }
      expeditions++;
    }
  }
  const final=profile(store);
  expect(firstPokemon2).not.toBeNull();
  expect(firstPokemon2!).toBeLessThanOrEqual(4);
  expect(final.regionWins[0]).toBe(wins);
  expect(final.wins).toBe(wins);
  expect(final.losses).toBe(ENCOUNTERS-wins);
  expect(final.roster[0].pokemonId).toBe(evolvedAt===null?starter.id:starter.evolvesTo);
  expect(final.roster[0].uid).toBe(1);
  const eligible=final.trainer.level>=6;
  let region2BattleAccepted=false;
  if(eligible){
    const before=read(store);
    write(store,{type:'regional-battle',regionId:2,
      seed:fightSeed(cohort,ENCOUNTERS+5),ballId:null});
    region2BattleAccepted=true;
    expect(profile(store).lastBattle.regionId).toBe(2);
    expect(read(store).revision).toBe(before.revision+1);
  }else{
    const before=read(store);
    const blocked=updatePlaySave(store,before.revision,{
      type:'regional-battle',regionId:2,seed:fightSeed(cohort,ENCOUNTERS+5)
    });
    expect(blocked.status).toBe('blocked');
    expect(read(store).revision).toBe(before.revision);
  }
  return{
    starter:starter.name,cohort,policy,wins,attempts:ENCOUNTERS,
    firstWin,firstPokemon2,trainer6,pokemon16,evolvedAt,
    region2Eligible:eligible,region2BattleAccepted,
    pokemonLevel:final.roster[0].level,trainerLevel:final.trainer.level,
    expeditions,totalExpeditionMinutes:expeditions*15,
    earlyWins,lateWins,firstRegion2Level:eligible?final.roster[0].level:null,
    captures:final.roster.length-1
  };
}
function median(values:number[]):number|null{
  if(values.length===0)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted.length%2?sorted[(sorted.length-1)/2]!:
    round((sorted[sorted.length/2-1]!+sorted[sorted.length/2]!)/2);
}
function summarize(rows:Journey[]){
  const milestones=(key:'firstWin'|'firstPokemon2'|'trainer6'|'pokemon16'|'evolvedAt')=>{
    const v=rows.map(r=>r[key]).filter((value):value is number=>value!==null);
    return {reached:v.length,median:median(v),min:v.length?Math.min(...v):null,
      max:v.length?Math.max(...v):null};
  };
  const count=rows.length,attempts=rows.reduce((n,r)=>n+r.attempts,0);
  return{
    profiles:count,attempts,
    wins:rows.reduce((n,r)=>n+r.wins,0),
    winRatePct:round(rows.reduce((n,r)=>n+r.wins,0)/attempts*100),
    earlyWinRatePct:round(rows.reduce((n,r)=>n+r.earlyWins,0)/(count*24)*100),
    lateWinRatePct:round(rows.reduce((n,r)=>n+r.lateWins,0)/(count*72)*100),
    meanFinalPokemonLevel:round(rows.reduce((n,r)=>n+r.pokemonLevel,0)/count),
    meanFinalTrainerLevel:round(rows.reduce((n,r)=>n+r.trainerLevel,0)/count),
    firstWin:milestones('firstWin'),pokemonLv2:milestones('firstPokemon2'),
    trainerLv6:milestones('trainer6'),pokemonLv16:milestones('pokemon16'),
    firstEvolution:milestones('evolvedAt'),
    region2Eligible:rows.filter(r=>r.region2Eligible).length,
    firstRegion2Accepted:rows.filter(r=>r.region2BattleAccepted).length,
    meanExpeditionMinutes:round(rows.reduce((n,r)=>n+r.totalExpeditionMinutes,0)/count),
    profilesWithCapture:rows.filter(r=>r.captures>0).length
  };
}

describe('D064BA — coortes normais independentes de iniciais Nv1',()=>{
  it('reproduz jornadas battle-only e com expedições pelo writer sem boosts',()=>{
    const rows:Journey[]=[];
    for(const starter of STARTERS)for(let cohort=0;cohort<COHORTS;cohort++){
      for(const policy of ['battle-only','battle-plus-expedition'] as const){
        rows.push(journey(starter,cohort,policy));
      }
    }
    expect(rows).toHaveLength(STARTERS.length*COHORTS*2);
    expect(rows.every(r=>r.firstPokemon2!==null&&r.firstPokemon2<=4)).toBe(true);
    expect(rows.every(r=>r.captures===0)).toBe(true);
    const summary:Record<string,ReturnType<typeof summarize>>={};
    for(const starter of STARTERS)for(const policy of ['battle-only','battle-plus-expedition'] as const){
      summary[starter.name+' / '+policy]=summarize(rows.filter(r=>
        r.starter===starter.name&&r.policy===policy));
    }
    (globalThis as unknown as {console:{info:(text:string)=>void}}).console.info(
      'D064BA_STARTER_COHORT_REPORT '+JSON.stringify({
        version:'D064BA',cohortsPerStarter:COHORTS,
        battlesPerCohort:ENCOUNTERS,expeditionMinutesPerClaim:15,
        caution:'Fixed seeds and one leader without manual stat/move changes, no capture; expedition times are simulated, not elapsed user play time; not population telemetry.',
        summary
      }));
    // Hard gates only for domain invariants, not preselected win-rate parity.
    expect(rows.every(r=>r.region2Eligible===r.region2BattleAccepted)).toBe(true);
    expect(rows.every(r=>r.expeditions===(r.policy==='battle-only'?0:8))).toBe(true);
  },120000);
});
