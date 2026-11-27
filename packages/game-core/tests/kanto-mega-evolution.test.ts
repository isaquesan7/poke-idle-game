import {describe,it,expect} from 'vitest';
import {applyOnlineMegaEvolution,onlineMegaProjection} from '../src/combat/serverMegaEvolution.js';
import {inspectMegaStoneStock} from '../src/catalog/kantoMegaForms.js';
import {prepareRewardJournal} from '../src/legacy/rewardEvents.js';
import {quoteKantoResearch} from '../src/progression/kantoMastery.js';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
const student={uid:1,pokemonId:6,level:100,xp:0,affinity:100,moveName:'ember',equippedMoveNames:['ember'],upgrades:{ember:5},machineLessons:[{tmId:'tm35',speciesId:6}],manual:{attack:10}};
const fixture=()=>({version:1,mode:'normal',trainer:{level:100,xp:0},roster:[{...student},{...student,uid:2}],team:[1],badges:KANTO_GYMS.map(g=>g.id),coins:100,wins:90,losses:2,nextUid:3,expedition:null,research:{points:{'4':100},favorites:[],totalSent:0,history:[]},megaStoneStock:{'charizardite-x':2,'charizardite-y':1}});
const command={uid:1,formId:'charizard-mega-x'};
const run=(state:unknown,cmd:unknown=command)=>applyOnlineMegaEvolution(JSON.stringify(state),cmd);
describe('MEGA02 — permanent transformation candidate',()=>{
 it('consumes one matching stone and changes only the individual form, not identity or progress',()=>{
  const s=fixture(),before=JSON.stringify(s),res=run(s);
  expect(res.status).toBe('ok');if(res.status!=='ok')throw Error('expected ok');
  const after=JSON.parse(res.raw);
  expect(after).toEqual({...s,roster:[{...s.roster[0],megaForm:'charizard-mega-x'},s.roster[1]],megaStoneStock:{'charizardite-x':1,'charizardite-y':1}});
  expect(JSON.stringify(s)).toBe(before);
  expect(run(after,{uid:1,formId:'charizard-mega-y'}).status).toBe('already-mega');
  expect(onlineMegaProjection(res.raw)?.pokemon[0]).toMatchObject({uid:1,currentForm:'charizard-mega-x',options:[]});
  expect(run(after,{uid:2,formId:'charizard-mega-y'}).status).toBe('ok');
 });
 it('requires each endgame condition, a compatible stone and idle account',()=>{
  const s=fixture();
  expect(run({...s,roster:[{...student,level:99},s.roster[1]]}).status).toBe('requirements');
  expect(run({...s,roster:[{...student,affinity:99},s.roster[1]]}).status).toBe('requirements');
  expect(run({...s,research:{...s.research,points:{'4':99}}}).status).toBe('requirements');
  expect(run({...s,badges:s.badges.slice(0,7)}).status).toBe('requirements');
  expect(run({...s,megaStoneStock:{'charizardite-y':2}}).status).toBe('no-stock');
  expect(run({...s,pendingRegionalLoot:{}}).status).toBe('busy');
  expect(run(s,{uid:1,formId:'venusaur-mega'}).status).toBe('incompatible');
  expect(run(s,{uid:9,formId:'charizard-mega-x'}).status).toBe('missing-pokemon');
  expect(run(s,{...command,quantity:99}).status).toBe('invalid');
 });
 it('rejects malformed persisted forms or stock and protects Megas from research',()=>{
  const s=fixture();
  expect(inspectMegaStoneStock({'charizardite-x':-1})).toBeNull();
  expect(inspectMegaStoneStock({'fire-stone':1})).toBeNull();
  expect(prepareRewardJournal(JSON.stringify({...s,roster:[{...student,megaForm:'venusaur-mega'}]}))).toBeNull();
  const roster=[{...student,megaForm:'charizard-mega-x'},{...student,uid:2}];
  expect(quoteKantoResearch({roster,team:[2],favorites:[],points:{'4':0},busy:false},[1]).status).toBe('protected');
  expect(onlineMegaProjection(JSON.stringify(s))?.pokemon[0]?.options.every(o=>o.available)).toBe(true);
 });
});
