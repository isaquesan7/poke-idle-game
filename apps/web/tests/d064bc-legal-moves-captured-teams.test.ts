/**
 * D064BC — jornadas pela API REAL de writer, sem edição manual de JSON.
 * Política A: inicial com golpes FRLG legalmente aprendidos.
 * Política B: mesmos iniciais e seeds, captura com bolas reais e rotação
 * de membros efetivamente capturados. Não concede XP, níveis ou espécies.
 * Os resultados NÃO são telemetria nem prova contrafactual estrita.
 */
import {describe,expect,it} from 'vitest';
import {createPlaySave,readPlaySave,updatePlaySave} from '../src/play/playSave.js';
import {KANTO_BATTLE_SPECIES,KANTO_REGIONS,kantoLevelMoves,
  kantoRegionalEncounter,kantoRegionCatalogInvariant} from '@kanto/game-core';

class MemoryStorage {
  readonly items=new Map<string,string>();
  getItem(key:string){return this.items.get(key)??null;}
  setItem(key:string,value:string){this.items.set(key,value);}
  removeItem(key:string){this.items.delete(key);}
}
const STARTERS=[{id:1,name:'Bulbasaur'},{id:4,name:'Charmander'},
  {id:7,name:'Squirtle'}] as const;
const COHORTS=6,ENCOUNTERS=72;
const round=(n:number)=>Math.round(n*100)/100;
type Action=Parameters<typeof updatePlaySave>[2];
type Policy='legal-moves-only'|'captured-team-rotation';
function snapshot(store:MemoryStorage){
  const read=readPlaySave(store);
  if(read.status!=='ready')throw Error('Save writer indisponível');
  return read.snapshot;
}
function game(store:MemoryStorage):any{return JSON.parse(snapshot(store).journal.raw);}
function write(store:MemoryStorage,action:Action){
  const before=snapshot(store),r=updatePlaySave(store,before.revision,action);
  expect(r.status).toBe('ok');
  const after=snapshot(store);
  expect(after.revision).toBe(before.revision+1);
  expect(after.journal.receipts).toHaveLength(after.journal.revision);
  return after;
}
function seed(cohort:number,index:number):number{
  let x=(Math.imul(cohort+17,0x9e3779b1)^Math.imul(index+1,0x85ebca6b))>>>0;
  x=Math.imul(x^(x>>>16),0xc2b2ae35)>>>0;
  return (x^(x>>>13))>>>0;
}
function journey(starter:typeof STARTERS[number],cohort:number,policy:Policy){
  const store=new MemoryStorage();
  expect(createPlaySave(store,'D064BC '+cohort,starter.id,1000,false).status).toBe('ok');
  let wins=0,earlyWins=0,lateWins=0,captures=0,movesSelected=0,
    teamAdded=0,leaderRotations=0,seenWater=0,seenGrass=0,seenBug=0;
  const encountered=new Set<number>();
  for(let n=1;n<=ENCOUNTERS;n++){
    let g=game(store);
    const leader=g.roster.find((p:any)=>p.uid===g.team[0]);
    expect(leader).toBeDefined();
    // Os golpes só são ensinados ao UID que efetivamente os aprendeu em FRLG.
    const available=kantoLevelMoves(leader.pokemonId,leader.level)
      .filter(item=>item.move.category!=='status')
      .sort((a,b)=>b.learnedAt-a.learnedAt||a.move.name.localeCompare(b.move.name));
    const selected=available.find(item=>item.move.name!==leader.moveName);
    if(selected){
      write(store,{type:'move',uid:leader.uid,moveName:selected.move.name,operation:'select'});
      movesSelected++;
      const afterMove=game(store);
      expect(afterMove.roster.find((p:any)=>p.uid===leader.uid).moveName)
        .toBe(selected.move.name);
    }
    g=game(store);
    const active=g.roster.find((p:any)=>p.uid===g.team[0]);
    const battleSeed=seed(cohort,n);
    const expected=kantoRegionalEncounter(1,battleSeed,active.level)!;
    encountered.add(expected.speciesId);
    const types=KANTO_BATTLE_SPECIES[expected.speciesId]!.types;
    if(types.includes('water'))seenWater++;
    if(types.includes('grass'))seenGrass++;
    if(types.includes('bug'))seenBug++;
    const previous=snapshot(store);
    const ball=policy==='captured-team-rotation'
      &&g.ballPocket.quantities['poke-ball']>0?'poke-ball':null;
    write(store,{type:'regional-battle',regionId:1,seed:battleSeed,ballId:ball});
    const after=game(store),last=after.lastBattle;
    expect(last.regionId).toBe(1);
    expect(last.log).toHaveLength(last.frames.length);
    expect(last.wildLevel).toBe(expected.level);
    expect(after.roster.some((p:any)=>p.uid===g.team[0])).toBe(true);
    expect(snapshot(store).journal.revision).toBe(previous.journal.revision+1);
    if(last.outcome==='win'){wins++;if(n<=24)earlyWins++;else lateWins++;}
    if(last.captured)captures++;
    if(policy==='captured-team-rotation'){
      // Só membros realmente capturados entram no time; respeitar teto 3.
      for(const member of after.roster){
        if(game(store).team.length>=3)break;
        if(!game(store).team.includes(member.uid)){
          write(store,{type:'pokemon',value:{type:'add-team',uid:member.uid}});
          teamAdded++;
        }
      }
      // A troca é feita PELO WRITER, nunca reescrevendo a ordem do array.
      if(n%12===0&&game(store).team.length>1){
        const current=game(store).team as number[];
        const target=current[1]!;
        write(store,{type:'pokemon',value:{type:'set-active',uid:target}});
        leaderRotations++;
      }
    } else {
      expect(after.roster).toHaveLength(1);
      expect(after.team).toEqual([1]);
      expect(last.captured).toBe(false);
    }
  }
  const g=game(store),j=snapshot(store).journal;
  expect(g.wins).toBe(wins);
  expect(g.regionWins[0]).toBe(wins);
  expect(g.losses).toBe(ENCOUNTERS-wins);
  expect(g.team.length).toBeLessThanOrEqual(3);
  expect(new Set(g.team).size).toBe(g.team.length);
  expect(new Set(g.roster.map((p:any)=>p.uid)).size).toBe(g.roster.length);
  expect(j.receipts.length).toBe(j.revision);
  expect(captures).toBe(g.roster.length-1);
  expect(g.seen.every((id:number)=>id>=1&&id<=151)).toBe(true);
  return {starter:starter.name,cohort,policy,wins,attempts:ENCOUNTERS,
    earlyWins,lateWins,captures,movesSelected,teamAdded,leaderRotations,
    rosterSize:g.roster.length,teamSize:g.team.length,
    trainerLevel:g.trainer.level,starterLevel:g.roster[0].level,
    region2Unlocked:g.trainer.level>=6,seenWater,seenGrass,seenBug,
    encounterSpecies:encountered.size};
}
describe('D064BC — movesets aprendidos e equipes capturadas pelo writer',()=>{
  it('mede condições legais e justiça de acesso nos três iniciais',()=>{
    expect(kantoRegionCatalogInvariant()).toBe(true);
    expect(KANTO_REGIONS[0]!.speciesIds).toContain(54);
    expect(KANTO_REGIONS[0]!.speciesIds).toContain(60);
    const journeys:ReturnType<typeof journey>[]=[];
    for(const starter of STARTERS)for(let cohort=0;cohort<COHORTS;cohort++)
      for(const policy of ['legal-moves-only','captured-team-rotation'] as const)
        journeys.push(journey(starter,cohort,policy));
    expect(journeys).toHaveLength(STARTERS.length*COHORTS*2);
    expect(journeys.every(j=>j.encounterSpecies>=5)).toBe(true);
    expect(journeys.some(j=>j.movesSelected>0)).toBe(true);
    expect(journeys.some(j=>j.captures>0)).toBe(true);
    expect(journeys.some(j=>j.leaderRotations>0)).toBe(true);
    const report:Record<string,unknown>={};
    for(const starter of STARTERS)for(const policy of
      ['legal-moves-only','captured-team-rotation'] as const){
      const group=journeys.filter(j=>j.starter===starter.name&&j.policy===policy);
      const sum=(key:keyof typeof group[number])=>group.reduce((total,j)=>
        total+(typeof j[key]==='number'?j[key] as number:0),0);
      report[starter.name+'/'+policy]={
        profiles:group.length,battles:group.length*ENCOUNTERS,
        wins:sum('wins'),winPct:round(sum('wins')/(group.length*ENCOUNTERS)*100),
        earlyWinPct:round(sum('earlyWins')/(group.length*24)*100),
        lateWinPct:round(sum('lateWins')/(group.length*48)*100),
        captures:sum('captures'),moveSelections:sum('movesSelected'),
        teamAdditions:sum('teamAdded'),leaderRotations:sum('leaderRotations'),
        region2Unlocked:group.filter(j=>j.region2Unlocked).length,
        meanStarterLevel:round(sum('starterLevel')/group.length),
        meanRoster:round(sum('rosterSize')/group.length),
        seenWater:sum('seenWater'),seenGrass:sum('seenGrass'),seenBug:sum('seenBug')
      };
    }
    console.info('D064BC_LEGAL_TEAM_REPORT '+JSON.stringify({
      version:'D064BC',cohorts:COHORTS,battlesPerProfile:ENCOUNTERS,
      note:'Writer-only local alpha cohorts; different levels/leaders and RNG branches prohibit causal interpretation; no elapsed human time or telemetry; rotation is fixed not optimal.',
      report
    }));
  },120000);
});
