import {describe,it,expect} from 'vitest';
import {applyOnlineMoveRank,validatedOnlineMoveRanks} from '../src/combat/serverMoveRanks.js';
import {legacyMoveRankLimits} from '../src/legacy/pokemonMoveReducer.js';
const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const state=()=>{
 const p={uid:1,pokemonId:4,level:30,xp:0,affinity:0,manual:zero(),moveName:'scratch',equippedMoveNames:['scratch','ember','growl'],upgrades:{} as Record<string,number>};
 return {version:1,mode:'normal',name:'Rank CI',trainer:{level:1,xp:0,manual:zero()},coins:0,wins:0,losses:0,seen:[4],caughtSpecies:[4],badges:[],roster:[p,{...(JSON.parse(JSON.stringify(p)) as typeof p),uid:2}],team:[1],nextUid:3,expedition:null};
};
describe('23F12B1 — canonical rank candidate',()=>{
 it('uses local budget and cap at all levels',()=>{
  for(let n=1;n<=100;n++){
   const limits=legacyMoveRankLimits(n);
   expect(limits.skillPoints).toBe(Math.floor(n/5));
   expect(limits.maxRankPerMove).toBe(Math.min(10,Math.floor(n/10)+1));
  }
 });
 it('upgrades secondary equipped attack without introducing legacy slot field or mutating other UID',()=>{
  const before=state();
  const result=applyOnlineMoveRank(JSON.stringify(before),1,'ember');
  expect(result.status).toBe('ok');
  if(result.status!=='ok')throw Error('rank blocked');
  const after=JSON.parse(result.raw);
  expect(after).toEqual({...before,roster:[{...before.roster[0],upgrades:{ember:1}},before.roster[1]]});
  expect(result.remaining).toBe(5);
 });
 it('rejects supports, unequipped, forged names, cap, total budget and missing UID',()=>{
  const s=state();
  expect(applyOnlineMoveRank(JSON.stringify(s),1,'growl').status).toBe('illegal-move');
  expect(applyOnlineMoveRank(JSON.stringify(s),1,'hyper-beam').status).toBe('illegal-move');
  expect(applyOnlineMoveRank(JSON.stringify(s),99,'scratch').status).toBe('missing-pokemon');
  s.roster[0]!.upgrades={scratch:4,ember:2};
  expect(applyOnlineMoveRank(JSON.stringify(s),1,'ember').status).toBe('unavailable');
  expect(validatedOnlineMoveRanks(4,30,undefined,{scratch:5})).toBeNull();
  expect(validatedOnlineMoveRanks(4,30,undefined,{growl:1})).toBeNull();
  expect(validatedOnlineMoveRanks(4,30,undefined,{scratch:4,ember:3})).toBeNull();
  s.roster[0]!.equippedMoveNames=['scratch','growl'];
  expect(applyOnlineMoveRank(JSON.stringify(s),1,'ember').status).toBe('illegal-move');
 });
 it('retains historical spent ranks after evolution, rejects invented history',()=>{
  const h=[{from:4,to:5,level:16,moves:['scratch','growl']}];
  expect(validatedOnlineMoveRanks(5,16,h,{scratch:1})).toEqual({scratch:1});
  expect(validatedOnlineMoveRanks(5,16,[{...h[0],level:1}],{scratch:1})).toBeNull();
  expect(validatedOnlineMoveRanks(5,16,h,{'hyper-beam':1})).toBeNull();
 });
});
