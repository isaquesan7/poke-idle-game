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
