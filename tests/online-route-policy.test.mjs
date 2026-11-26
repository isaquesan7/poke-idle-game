import test from 'node:test';
import assert from 'node:assert/strict';
import {ONLINE_ROUTES,CI_FEATURE_FLAGS,onlineRoute,webOnlineRoute,signedOnlineRoute} from '../services/api/src/onlineRoutePolicy.mjs';
import {ciOnlineFeatureEnabled} from '../services/api/src/onlineFeatureGate.mjs';
test('D6J: manifest preserves exact production and CI route boundaries',()=>{
 const base=['status','me','save','auth/register','auth/verify','auth/login','auth/logout','auth/request-reset','auth/confirm-reset','adventure/start','trainer/invest'].map(p=>'/api/v1/'+p);
 const extra=['collection/team','region/current','region/reserve','region/start','region/turn','region/certify','region/settle','region/finish','expedition/current','expedition/start','expedition/claim','expedition/stop','shop/current','shop/purchase','moves/current','moves/equip','moves/upgrade','evolution/current','evolution/evolve','pokemon-training/current','pokemon-training/train','pokedex/current','inventory/current','inventory/loadout','mastery/current','mastery/research','gym/current','gym/reserve','gym/start','gym/turn','gym/certify','gym/settle'].map(p=>'/api/v1/'+p);
 const flags=Object.fromEntries(CI_FEATURE_FLAGS.map(f=>[f,'true']));
 const paths=ONLINE_ROUTES.map(r=>r.path);
 assert.deepEqual([...paths].sort(),[...base,...extra].sort());
 assert.equal(new Set(paths).size,paths.length);
 for(const NODE_ENV of ['production','development',undefined]){
  assert.deepEqual(paths.filter(p=>webOnlineRoute(p,{NODE_ENV,...flags})).sort(),base.sort());
 }
 for(const route of ONLINE_ROUTES){
  assert.equal(route.method,route.path.endsWith('/current')||['/api/v1/status','/api/v1/me','/api/v1/save'].includes(route.path)?'GET':'POST');
  assert.equal(webOnlineRoute(route.path,{NODE_ENV:'test',...flags}),route);
  if(route.flag){
   assert.equal(webOnlineRoute(route.path,{NODE_ENV:'test'}),null);
   assert.equal(ciOnlineFeatureEnabled(route.flag,{NODE_ENV:'production',...flags,ONLINE_REGISTRATION_ENABLED:'true'}),false);
  }
 }
 assert.deepEqual(paths.filter(signedOnlineRoute).sort(),['register','verify','login','request-reset','confirm-reset'].map(s=>'/api/v1/auth/'+s).sort());
 for(const path of ['/api/v1/account/export','/api/v1/admin','/api/v1/region/seed','/api/v1/save/','/api/v1/status?x=1','__proto__']){
  assert.equal(onlineRoute(path),null);assert.equal(webOnlineRoute(path,{NODE_ENV:'test',...flags}),null);
 }
});
