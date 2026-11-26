import test from 'node:test';
import assert from 'node:assert/strict';
import {CI_FEATURE_FLAGS,ciOnlineFeatureEnabled,disposableOnlineDatabase} from '../src/onlineFeatureGate.mjs';
import {expeditionHttpEnabled} from '../src/expeditionHttp.mjs';
import {shopHttpEnabled} from '../src/shopHttp.mjs';
import {movesHttpEnabled} from '../src/movesHttp.mjs';
import {evolutionHttpEnabled} from '../src/evolutionHttp.mjs';
import {pokemonTrainingHttpEnabled} from '../src/pokemonTrainingHttp.mjs';
import {pokedexHttpEnabled} from '../src/pokedexHttp.mjs';
import {trainerLoadoutHttpEnabled} from '../src/trainerLoadoutHttp.mjs';
import {gymPortalEnabled} from '../src/gymPortalState.mjs';
import {masteryHttpEnabled} from '../src/masteryHttp.mjs';
const fns=[expeditionHttpEnabled,shopHttpEnabled,movesHttpEnabled,evolutionHttpEnabled,pokemonTrainingHttpEnabled,pokedexHttpEnabled,trainerLoadoutHttpEnabled,masteryHttpEnabled,gymPortalEnabled];
const base={NODE_ENV:'test',ONLINE_REGISTRATION_ENABLED:'true',DATABASE_URL:'postgresql://kanto_ci:fixture@127.0.0.1:55432/kanto_ci'};
test('D6G: every feature is individually opt-in only in the disposable CI database',()=>{
 assert.equal(CI_FEATURE_FLAGS.length,fns.length);
 for(const [i,flag] of CI_FEATURE_FLAGS.entries()){
  const env={...base,[flag]:'true'};
  assert.equal(ciOnlineFeatureEnabled(flag,env),true);
  fns.forEach((fn,j)=>assert.equal(fn(env),i===j));
  for(const change of [{NODE_ENV:'production'},{NODE_ENV:'development'},{ONLINE_REGISTRATION_ENABLED:'false'},{[flag]:'false'}]){
   assert.equal(fns[i]({...env,...change}),false);
  }
  for(const DATABASE_URL of ['','not-a-url','postgresql://kanto_ci@db.railway.internal:55432/kanto_ci','postgresql://other@127.0.0.1:55432/kanto_ci','postgresql://kanto_ci@127.0.0.1:5432/kanto_ci','postgresql://kanto_ci@127.0.0.1:55432/production','postgresql://kanto_ci@127.0.0.1:55432/kanto_ci?sslmode=require']){
   assert.equal(disposableOnlineDatabase({...env,DATABASE_URL}),false);
   assert.equal(fns[i]({...env,DATABASE_URL}),false);
  }
 }
 const all={...base,...Object.fromEntries(CI_FEATURE_FLAGS.map(k=>[k,'true'])),NODE_ENV:'production'};
 assert.ok(fns.every(fn=>!fn(all)));
 assert.equal(ciOnlineFeatureEnabled('UNKNOWN',{...base,UNKNOWN:'true'}),false);
});
