import test from 'node:test';
import assert from 'node:assert/strict';
import {firstSave} from '../src/initialAdventure.mjs';
import {investTrainerPoint,investTrainerBatch} from '../src/trainerInvestment.mjs';

function leveled(){
 const source=firstSave('CI Kanto',4,1740000000000);
 const state=JSON.parse(source.journal.raw);
 state.trainer.level=2; // Test fixture only; no API level grant.
 source.journal.raw=JSON.stringify(state);
 return source;
}
test('only server-earned level budget allows one point per action',()=>{
 const lv1=firstSave('CI Kanto',4,1740000000000);
 assert.equal(investTrainerPoint(lv1,'hp').status,'unavailable');
 const lv2=leveled();
 const edited=investTrainerPoint(lv2,'attack');
 assert.equal(edited.status,'ok');
 assert.equal(edited.allocated,1);
 assert.equal(JSON.parse(lv2.journal.raw).trainer.manual.attack,0);
 const after=JSON.parse(edited.next.journal.raw);
 assert.equal(after.trainer.manual.attack,1);
 assert.equal(after.coins,0);
 assert.deepEqual(after.badges,[]);
 assert.equal(after.roster[0].pokemonId,4);
 assert.equal(after.roster[0].level,1);
 assert.equal(after.trainer.xp,0);
 assert.deepEqual(after.ballPocket.quantities,{'poke-ball':12});
 assert.equal(investTrainerPoint(edited.next,'hp').status,'ok');
 const final=investTrainerPoint(investTrainerPoint(edited.next,'hp').next,'speed');
 assert.equal(final.status,'unavailable');
 assert.equal(investTrainerPoint(lv2,'coins').status,'invalid');
});
test('tampered level, budget, stat cap and envelope are rejected',()=>{
 const src=leveled();
 const broken=structuredClone(src);
 let data=JSON.parse(broken.journal.raw);
 data.trainer.level=101;broken.journal.raw=JSON.stringify(data);
 assert.equal(investTrainerPoint(broken,'hp').status,'invalid');
 data.trainer.level=2;data.trainer.manual.hp=40;
 broken.journal.raw=JSON.stringify(data);
 assert.equal(investTrainerPoint(broken,'hp').status,'unavailable');
 data.trainer.manual.hp=-1;broken.journal.raw=JSON.stringify(data);
 assert.equal(investTrainerPoint(broken,'hp').status,'invalid');
 assert.equal(investTrainerPoint({schemaVersion:99},'hp').status,'invalid');
});

test('confirmed batch is atomic, budgeted and never partially applied',()=>{
 const source=leveled(),original=source.journal.raw;
 const result=investTrainerBatch(source,{hp:1,attack:1});
 assert.equal(result.status,'ok');assert.equal(result.allocated.hp,1);assert.equal(result.allocated.attack,1);
 assert.equal(source.journal.raw,original);assert.equal(investTrainerBatch(source,{hp:2,attack:1}).status,'unavailable');
 assert.equal(investTrainerBatch(source,{hp:1,attack:-1}).status,'invalid');assert.equal(investTrainerBatch(source,{coins:1}).status,'invalid');
 assert.equal(investTrainerBatch(source,{}).status,'invalid');assert.equal(source.journal.raw,original);
});
