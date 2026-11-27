import {describe,it,expect} from 'vitest';
import {canonicalMegaTrialBoss,prepareMegaTrialBattle,resolveMegaTrialBattle} from '../src/combat/serverMegaBattle.js';
import {canonicalFrozenCombatants} from '../src/combat/serverFrozenBattle.js';
import {gymLegalTurnActions} from '../src/gyms/gymTurn.js';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {KANTO_MEGA_FORMS} from '../src/catalog/kantoMegaForms.js';
import {zeroStats} from '../src/stats/types.js';
const badges=KANTO_GYMS.map(g=>g.id);
const inventory={version:1,gear:[],extraBagSlots:0};
const student={uid:1,pokemonId:6,level:100,xp:0,affinity:100,manual:{...zeroStats(),attack:80,specialAttack:80,speed:38},moveName:'ember'};
const fixture=()=>({version:1,mode:'normal',trainer:{level:100,xp:0,manual:zeroStats(),equipped:{},title:'aprendiz'},inventory,seen:[4,5,6],roster:[student],team:[1],badges,coins:100,wins:90,losses:2,nextUid:2,expedition:null,research:{points:{'4':100},favorites:[],totalSent:0,history:[]}});
const command={uid:1,formId:'charizard-mega-x'};
describe('MEGA06: server-owned sanctuary combat',()=>{
 it('all four bosses have effective Mega types and legal level-100 moves',()=>{
  for(const form of KANTO_MEGA_FORMS){
   const boss=canonicalMegaTrialBoss(form.id);
   expect(boss).toMatchObject({speciesId:form.speciesId,megaForm:form.id,name:form.name,level:100,types:form.types});
   expect(boss?.moves).toHaveLength(4);
   expect(boss?.stats.hp).toBeGreaterThan(200);
  }
 });
 it('one eligible UID, full HP/SP, no substitutes or client-supplied enemy',()=>{
  const raw=JSON.stringify(fixture()),p=prepareMegaTrialBattle(raw,command);
  if(p.status!=='ok')throw Error(p.status);
  for(const side of ['player','leader'] as const){
   const party=p.battle[side];
   expect(party.fighters.slice(1).map(f=>f.hp)).toEqual([0,0]);
   expect(party.fighters[0].hp).toBe(party.fighters[0].combatant.stats.hp);
   expect(party.fighters[0].sp).toBe(party.fighters[0].maxSp);
   expect(gymLegalTurnActions(p.battle,side).some(a=>a.kind==='switch')).toBe(false);
  }
  expect(p.battle.player.fighters[0].uid).toBe(1);
  expect(p.battle.leader.fighters[0].combatant.types).toEqual(['fire','dragon']);
  expect(prepareMegaTrialBattle(raw,{...command,level:1}).status).toBe('invalid');
  expect(prepareMegaTrialBattle(raw,{...command,uid:2}).status).toBe('missing-pokemon');
 });
 it('replays deterministically without a reward or mutation and rejects invalid entropy',()=>{
  const s=fixture(),raw=JSON.stringify(s);
  const seed=(turn:number)=>Math.imul(turn,2654435761)>>>0;
  const a=resolveMegaTrialBattle(raw,command,seed),b=resolveMegaTrialBattle(raw,command,seed);
  expect(a).toEqual(b);if(a.status!=='ok')throw Error(a.status);
  expect(['win','loss','draw']).toContain(a.outcome);
  expect(a.turns).toBeGreaterThan(0);
  expect(a.log).toHaveLength(a.frames.length);
  expect(a.final.player.fighters[0].uid).toBe(1);
  expect(JSON.stringify(s)).toBe(raw);
  expect(resolveMegaTrialBattle(raw,command,()=>-1).status).toBe('invalid-seed');
 });
 it('regional combat uses Mega base stats, types and identity only with matching proof',()=>{
  const s=fixture();
  const snapshot={version:1,regionId:1,opponent:{speciesId:10,level:2},trainer:{...s.trainer,inventory,seen:s.seen,badges,wins:s.wins},masteryPoints:s.research.points,activePokemon:{uid:1,speciesId:6,level:100,affinity:100,manual:student.manual,moveName:'ember'}};
  const base=canonicalFrozenCombatants(snapshot);
  const mega=canonicalFrozenCombatants({...snapshot,activePokemon:{...snapshot.activePokemon,megaForm:command.formId,megaTrialForm:command.formId}});
  expect(base).not.toBeNull();expect(mega).not.toBeNull();
  expect(mega?.player).toMatchObject({speciesId:6,megaForm:command.formId,types:['fire','dragon']});
  expect(mega!.player.stats.attack).toBeGreaterThan(base!.player.stats.attack);
  expect(mega!.player.stats.hp).toBe(base!.player.stats.hp);
  expect(canonicalFrozenCombatants({...snapshot,activePokemon:{...snapshot.activePokemon,megaForm:command.formId}})).toBeNull();
 });
});
