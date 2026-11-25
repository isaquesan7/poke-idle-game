import test from 'node:test';
import assert from 'node:assert/strict';
import {firstSave} from '../src/initialAdventure.mjs';
import {buildBattleSnapshot} from '../src/battlePreparation.mjs';

const initial=()=>firstSave('Treinador CI',4,1740000000000);
const opponent={regionId:1,speciesId:10,level:2};
test('snapshot captures server-owned trainer, player Pokémon and reserved wild species',()=>{
 const source=initial();
 const result=buildBattleSnapshot(source,opponent);
 assert.deepEqual(result.opponent,{speciesId:10,level:2});
 assert.deepEqual(result.activePokemon,{
   uid:1,speciesId:4,level:1,affinity:0,
   manual:{hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0},
   moveName:'scratch'
 });
 assert.equal(result.trainer.level,1);
 assert.equal(result.version,1);
 const sourceRaw=JSON.parse(source.journal.raw);
 assert.equal(sourceRaw.coins,0);
 assert.deepEqual(sourceRaw.badges,[]);
 assert.equal(sourceRaw.ballPocket.quantities['poke-ball'],12);
 assert.equal(Object.hasOwn(result,'coins'),false);
 assert.equal(Object.hasOwn(result,'seed'),false);
 assert.equal(Object.hasOwn(result,'battleResult'),false);
});
test('reject bad region, forged stats and inconsistent party',()=>{
 const save=initial();
 assert.equal(buildBattleSnapshot(save,{...opponent,regionId:9}),null);
 assert.equal(buildBattleSnapshot(save,{...opponent,level:100}),null);
 const mut=data=>({...save,journal:{...save.journal,raw:JSON.stringify(data)}});
 const raw=JSON.parse(save.journal.raw);
 assert.equal(buildBattleSnapshot(mut({...raw,team:[55]}),opponent),null);
 const illegal=structuredClone(raw);
 illegal.trainer.manual.hp=1000;
 assert.equal(buildBattleSnapshot(mut(illegal),opponent),null);
 const illegal2=structuredClone(raw);
 illegal2.roster[0].moveName='unknown<script>';
 assert.equal(buildBattleSnapshot(mut(illegal2),opponent),null);
 const illegal3=structuredClone(raw);
 illegal3.roster[0].uid=-1;
 assert.equal(buildBattleSnapshot(mut(illegal3),opponent),null);
});


test('ONLINE-01C-23A: v2 freezes exactly explicit equipped moves, not learned catalog',()=>{
 const save=initial();
 const raw=JSON.parse(save.journal.raw);
 const make=data=>({...save,journal:{...save.journal,raw:JSON.stringify(data)}});
 raw.roster[0].equippedMoveNames=['scratch','growl'];
 const v2=buildBattleSnapshot(make(raw),opponent);
 assert.equal(v2.version,2);
 assert.equal(v2.activePokemon.moveName,'scratch');
 assert.deepEqual(v2.activePokemon.moveNames,['scratch','growl']);
 assert.equal(Object.hasOwn(v2,'loadout'),false);
 assert.equal(Object.hasOwn(v2,'bonus'),false);
 assert.deepEqual(buildBattleSnapshot(save,opponent).activePokemon,{
   uid:1,speciesId:4,level:1,affinity:0,
   manual:{hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0},
   moveName:'scratch'
 },'legacy v1 must preserve its exact snapshot shape');
 for(const names of [
   [],['scratch','scratch'],['scratch','growl','ember','quick-attack','tackle'],
   ['growl','scratch'],['scratch','<script>'],['scratch',88],null
 ]){
   raw.roster[0].equippedMoveNames=names;
   assert.equal(buildBattleSnapshot(make(raw),opponent),null,
     'invalid equipment array must fail closed');
 }
 delete raw.roster[0].equippedMoveNames;
 assert.equal(buildBattleSnapshot(make(raw),opponent).version,1);
});


test('ONLINE-01C-23 correction: a three-Pokémon Gym team never becomes a regional squad',()=>{
 const save=initial();
 const raw=JSON.parse(save.journal.raw);
 raw.roster.push({...structuredClone(raw.roster[0]),uid:2,pokemonId:25,
   level:20,moveName:'thunder-shock'});
 raw.roster.push({...structuredClone(raw.roster[0]),uid:3,pokemonId:7,
   level:20,moveName:'tackle'});
 raw.team=[1,2,3];raw.nextUid=4;
 const withRaw=data=>({...save,journal:{...save.journal,raw:JSON.stringify(data)}});
 const one=buildBattleSnapshot(withRaw(raw),opponent);
 assert.equal(one.version,1,'regions keep the legacy single-fighter snapshot');
 assert.equal(one.activePokemon.uid,1);
 assert.equal(one.activePokemon.speciesId,4);
 assert.equal(Object.hasOwn(one,'party'),false);
 assert.equal(Object.hasOwn(one,'playerParty'),false);
 raw.roster[0].equippedMoveNames=['scratch','growl'];
 const equipped=buildBattleSnapshot(withRaw(raw),opponent);
 assert.equal(equipped.version,2,'one fighter can still equip multiple moves');
 assert.deepEqual(equipped.activePokemon.moveNames,['scratch','growl']);
 assert.equal(Object.hasOwn(equipped,'party'),false);
 raw.team=[2,1,3];
 const otherLead=buildBattleSnapshot(withRaw(raw),opponent);
 assert.equal(otherLead.version,1);
 assert.equal(otherLead.activePokemon.uid,2,
   'only the selected lead of the stored team enters the regional battle');
 assert.equal(otherLead.activePokemon.speciesId,25);
});

 test('23F12B2: ranked single slot upgrades snapshot to v2, old v1 unchanged',()=>{
 const save=initial();const raw=JSON.parse(save.journal.raw);
 Object.assign(raw.roster[0],{level:10,upgrades:{scratch:2}});
 const ranked=buildBattleSnapshot({...save,journal:{...save.journal,raw:JSON.stringify(raw)}},opponent);
 assert.equal(ranked.version,2);assert.deepEqual(ranked.activePokemon.moveNames,['scratch']);
 assert.deepEqual(ranked.activePokemon.upgrades,{scratch:2});
 assert.equal(buildBattleSnapshot(save,opponent).version,1);
 raw.roster[0].upgrades={scratch:11};
 assert.equal(buildBattleSnapshot({...save,journal:{...save.journal,raw:JSON.stringify(raw)}},opponent),null);
});
