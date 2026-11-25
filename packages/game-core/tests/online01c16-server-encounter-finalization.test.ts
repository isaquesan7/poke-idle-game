import {describe,it,expect} from 'vitest';
import {finalizeFrozenWildEncounter} from '../src/index.js';
const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const snap=(speciesId:number)=>({
  version:1 as const,regionId:1 as const,trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,gear:[],extraBagSlots:0},level:1,manual:zero()},
  activePokemon:{uid:1,speciesId:4,level:1,affinity:0,manual:zero(),moveName:'scratch'},
  opponent:{speciesId,level:2}
});
const state=()=>({
  version:1,mode:'normal',roster:[{uid:1,pokemonId:4,level:1,xp:0}],
  team:[1],nextUid:2,seen:[4],caughtSpecies:[4],
  ballPocket:{version:1,quantities:{'poke-ball':12,'great-ball':3,'ultra-ball':2}},
  badges:[],coins:20
});
const preview=(outcome:string,wildRemainingHp:number)=>({
 outcome,turns:5,wildRemainingHp,log:['hit'],frames:[{kind:'info'}]
});
describe('ONLINE-01C-16 — pure postbattle capture/skip',()=>{
 it('skip never spends a Pokéball, captures or changes rewards',()=>{
  const raw=JSON.stringify(state());
  const result=finalizeFrozenWildEncounter(raw,snap(10),preview('loss',6),
    'skip',77,1700000000000)!;
  expect(result).not.toBeNull();
  expect(result.result).toEqual({
    outcome:'skipped',ballId:null,speciesId:10,caughtUid:null
  });
  expect(JSON.parse(result.raw)).toEqual(JSON.parse(raw));
 });
 it('one Pokéball captures KO Caterpie, creates only one UID with canonical levels',()=>{
  const result=finalizeFrozenWildEncounter(JSON.stringify(state()),
    snap(10),preview('win',0),'poke-ball',22,1700000000000)!;
  expect(result.result).toEqual({
    outcome:'captured',ballId:'poke-ball',speciesId:10,caughtUid:2
  });
  const after=JSON.parse(result.raw);
  expect(after.ballPocket.quantities['poke-ball']).toBe(11);
  expect(after.roster.length).toBe(2);
  expect(after.nextUid).toBe(3);
  expect(after.roster[1]).toMatchObject({
    uid:2,pokemonId:10,level:1,xp:0,affinity:0,
    battleRecord:{wins:0,losses:0,draws:0}
  });
  expect(after.caughtSpecies).toContain(10);
  expect(after.seen).toContain(10);
  expect(after.coins).toBe(20);
  expect(after.badges).toEqual([]);
 });
 it('failed capture still spends a ball once; no new UID',()=>{
  const s=snap(4),p=preview('win',0),raw=JSON.stringify(state());
  const failure=[...Array(100)].map((_,i)=>
    finalizeFrozenWildEncounter(raw,s,p,'poke-ball',i,1700000000000))
    .find(x=>x?.result.outcome==='failed');
  expect(failure).toBeDefined();
  const after=JSON.parse(failure!.raw);
  expect(after.ballPocket.quantities['poke-ball']).toBe(11);
  expect(after.roster.length).toBe(1);
  expect(after.nextUid).toBe(2);
  expect(failure!.result.caughtUid).toBeNull();
 });
 it('rejects attempts after loss/draw, unavailable balls and forged input',()=>{
  const raw=JSON.stringify(state()),s=snap(10);
  expect(finalizeFrozenWildEncounter(raw,s,preview('loss',8),'poke-ball',
    77,1700000000000)).toBeNull();
  expect(finalizeFrozenWildEncounter(raw,s,preview('draw',0),'poke-ball',
    77,1700000000000)).toBeNull();
  expect(finalizeFrozenWildEncounter(raw,s,preview('win',0),
    'master-ball' as 'poke-ball',77,1700000000000)).toBeNull();
  expect(finalizeFrozenWildEncounter(raw,s,preview('win',0),'poke-ball',
    2**32,1700000000000)).toBeNull();
  const empty=state();
  empty.ballPocket.quantities['poke-ball']=0;
  expect(finalizeFrozenWildEncounter(JSON.stringify(empty),s,
    preview('win',0),'poke-ball',1,1700000000000)).toBeNull();
  const broken=state();broken.nextUid=1;
  expect(finalizeFrozenWildEncounter(JSON.stringify(broken),s,
    preview('win',0),'poke-ball',1,1700000000000)).toBeNull();
 });
});
