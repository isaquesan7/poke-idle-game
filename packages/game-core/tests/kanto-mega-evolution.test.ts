import {describe,it,expect} from 'vitest';
import {applyOnlineMegaEvolution,onlineMegaProjection,quoteOnlineMegaTrial,applyCertifiedMegaTrialVictory} from '../src/combat/serverMegaEvolution.js';
import {prepareRewardJournal} from '../src/legacy/rewardEvents.js';
import {quoteKantoResearch} from '../src/progression/kantoMastery.js';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
const student={uid:1,pokemonId:6,level:100,xp:0,affinity:100,moveName:'ember',equippedMoveNames:['ember'],upgrades:{ember:5},machineLessons:[{tmId:'tm35',speciesId:6}],manual:{attack:10}};
const fixture=()=>({version:1,mode:'normal',trainer:{level:100,xp:0},roster:[{...student},{...student,uid:2}],team:[1],badges:KANTO_GYMS.map(g=>g.id),coins:100,wins:90,losses:2,nextUid:3,expedition:null,research:{points:{'4':100},favorites:[],totalSent:0,history:[]}});
const x={uid:1,formId:'charizard-mega-x'},y={uid:1,formId:'charizard-mega-y'};
const raw=(state:unknown)=>JSON.stringify(state);
describe('Santuário Mega: shared mastery, one independent permanent pass',()=>{
 it('always shows sanctuary but unlocks only mastered families, not a low-level individual',()=>{
  const s=fixture();
  const locked=onlineMegaProjection(raw({...s,research:{...s.research,points:{'4':99}}}))!;
  expect(locked.visible).toBe(true);
  expect(locked.challenges.every(c=>!c.unlocked)).toBe(true);
  expect(locked.pokemon.every(p=>p.pass==='locked'&&p.options.every(o=>!o.canChallenge))).toBe(true);
  const view=onlineMegaProjection(raw({...s,roster:[student,{...student,uid:2,level:99}]}))!;
  expect(view.visible).toBe(true);
  expect(view.challenges.map(c=>c.unlocked)).toEqual([false,true,true,false]);
  expect(view.pokemon.map(p=>p.pass)).toEqual(['available','locked']);
  expect(view.stones).toEqual([]);
 });
 it('one certified victory consumes both X/Y options and binds the earned stone to UID',()=>{
  const s=fixture(),before=raw(s);
  expect(quoteOnlineMegaTrial(before,x).status).toBe('ok');
  expect(quoteOnlineMegaTrial(before,y).status).toBe('ok');
  expect(applyOnlineMegaEvolution(before,x).status).toBe('no-stock');
  const earned=applyCertifiedMegaTrialVictory(before,x);
  if(earned.status!=='ok')throw Error('expected victory transition');
  expect(raw(s)).toBe(before);
  expect(JSON.parse(earned.raw)).toEqual({...s,roster:[{...student,megaTrialForm:x.formId},s.roster[1]]});
  expect(quoteOnlineMegaTrial(earned.raw,x).status).toBe('pass-consumed');
  expect(quoteOnlineMegaTrial(earned.raw,y).status).toBe('pass-consumed');
  expect(applyCertifiedMegaTrialVictory(earned.raw,y).status).toBe('pass-consumed');
  expect(applyOnlineMegaEvolution(earned.raw,{...x,uid:2}).status).toBe('no-stock');
  expect(applyOnlineMegaEvolution(earned.raw,y).status).toBe('no-stock');
  const view=onlineMegaProjection(earned.raw)!;
  expect(view.stones).toEqual([{id:'charizardite-x',formId:x.formId,uid:1,quantity:1}]);
  expect(view.pokemon.map(p=>p.pass)).toEqual(['consumed','available']);
  expect(view.pokemon[0]?.options.every(o=>!o.canChallenge)).toBe(true);
  const evolved=applyOnlineMegaEvolution(earned.raw,x);
  if(evolved.status!=='ok')throw Error('expected evolution');
  expect(JSON.parse(evolved.raw)).toEqual({...s,roster:[{...student,megaTrialForm:x.formId,megaForm:x.formId},s.roster[1]]});
  expect(onlineMegaProjection(evolved.raw)?.stones).toEqual([]);
  expect(quoteOnlineMegaTrial(evolved.raw,y).status).toBe('already-mega');
  const second=applyCertifiedMegaTrialVictory(evolved.raw,{...y,uid:2});
  expect(second.status).toBe('ok');
  if(second.status==='ok')expect(applyOnlineMegaEvolution(second.raw,{...y,uid:2}).status).toBe('ok');
 });
 it('rejects requirements, forged unbound stock and incompatible or missing UID',()=>{
  const s=fixture();
  for(const p of [{...student,level:99},{...student,affinity:99}]){
   expect(quoteOnlineMegaTrial(raw({...s,roster:[p,s.roster[1]]}),x).status).toBe('requirements');
  }
  expect(quoteOnlineMegaTrial(raw({...s,badges:s.badges.slice(0,7)}),x).status).toBe('requirements');
  expect(quoteOnlineMegaTrial(raw({...s,research:{...s.research,points:{'4':99}}}),x).status).toBe('requirements');
  expect(quoteOnlineMegaTrial(raw({...s,pendingRegionalLoot:{}}),x).status).toBe('busy');
  expect(quoteOnlineMegaTrial(raw(s),{uid:1,formId:'venusaur-mega'}).status).toBe('incompatible');
  expect(quoteOnlineMegaTrial(raw(s),{...x,uid:9}).status).toBe('missing-pokemon');
  expect(quoteOnlineMegaTrial(raw(s),{...x,outcome:'win'}).status).toBe('invalid');
  expect(prepareRewardJournal(raw({...s,megaStoneStock:{'charizardite-x':1}}))).toBeNull();
  for(const p of [{...student,megaForm:x.formId},{...student,megaTrialForm:'venusaur-mega'},{...student,megaTrialForm:x.formId,megaForm:y.formId}]){
   expect(prepareRewardJournal(raw({...s,roster:[p,s.roster[1]]}))).toBeNull();
  }
  const roster=[{...student,megaTrialForm:x.formId},{...student,uid:2}];
  expect(quoteKantoResearch({roster,team:[2],favorites:[],points:{'4':100},busy:false},[1]).status).toBe('protected');
 });
});
