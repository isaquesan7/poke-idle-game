import test from 'node:test';
import assert from 'node:assert/strict';
import {initialAdventure,firstSave,STARTER_SPECIES} from '../src/initialAdventure.mjs';

test('authoritative first adventure matches Kanto non-demo initial policy',()=>{
  assert.deepEqual(STARTER_SPECIES,[1,4,7]);
  for(const starterId of STARTER_SPECIES){
    const state=initialAdventure({trainerName:'Treinador CI',starterId,nowMs:1740000000000});
    assert.equal(state.version,1);
    assert.equal(state.mode,'normal');
    assert.equal(state.name,'Treinador CI');
    assert.equal(state.trainer.level,1);
    assert.equal(state.trainer.xp,0);
    assert.ok(Object.values(state.trainer.manual).every(v=>v===0));
    assert.equal(state.coins,0);
    assert.deepEqual(state.inventory,{version:1,ownedEquipment:{},extraBagSlots:0});
    assert.deepEqual(state.badges,[]);
    assert.deepEqual(state.seen,[starterId]);
    assert.deepEqual(state.caughtSpecies,[starterId]);
    assert.deepEqual(state.roster.map(p=>p.uid),[1]);
    assert.equal(state.roster[0].pokemonId,starterId);
    assert.equal(state.roster[0].level,1);
    assert.equal(state.roster[0].affinity,0);
    assert.equal(state.roster[0].moveName,starterId===4?'scratch':'tackle');
    assert.equal(state.nextUid,2);
    assert.deepEqual(state.team,[1]);
    assert.deepEqual(state.ballPocket,{version:1,quantities:{'poke-ball':12}});
    assert.deepEqual(state.expeditionBallProgress,{'poke-ball':0,'great-ball':0,'ultra-ball':0});
    assert.deepEqual(state.regionWins,Array(10).fill(0));
    const save=firstSave('Treinador CI',starterId,1740000000000);
    assert.equal(save.schemaVersion,2);
    assert.equal(save.revision,0);
    assert.deepEqual(save.journal.receipts,[]);
    assert.deepEqual(JSON.parse(save.journal.raw),state);
  }
});
test('client cannot select unsupported species, demo mode or client-supplied time',()=>{
  for(const starterId of [0,6,25,150,'1',null,{},[]])
    assert.throws(()=>firstSave('Treinador',starterId,1740000000000));
  assert.throws(()=>firstSave('T',1,1740000000000));
  assert.throws(()=>firstSave('Treinador',1,NaN));
});
