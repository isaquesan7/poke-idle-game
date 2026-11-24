import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const landing=readFileSync(new URL('../landing.html',import.meta.url),'utf8');
const script=landing.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('23E3: auth landing script remains parseable, no credentials persist in local storage',()=>{
  assert.ok(script,'Expected inline auth controller');
  assert.doesNotThrow(()=>new Script(script,{filename:'landing-auth-controller.js'}));
  assert.doesNotMatch(script,/localStorage|sessionStorage|document\.cookie\s*=/);
  assert.match(landing,/href="\/play"/,'preserve playable testing route');
  assert.match(landing,/id="tab-register"/);
  assert.match(landing,/id="reset-link"/);
});

test('23E3: password confirmation is required on account creation and reset',()=>{
  assert.match(landing,/id="confirm-wrap" hidden/);
  assert.match(landing,/id="confirm-password"[^>]+type="password"/);
  assert.match(script,/const confirm=register\|\|\(reset&&!!token\)/);
  assert.match(script,/confirmPassword\.required=confirm/);
  assert.match(script,/pass!==confirmPassword\.value/);
  assert.match(script,/pass\.length<12\|\|pass\.length>128/);
});

test('23E3: email and password recovery token use remains fail-closed',()=>{
  assert.match(script,/history\.replaceState\(null,'',location\.pathname\)/);
  assert.match(script,/\^\[A-Za-z0-9_-\]\{43\}\$/);
  assert.match(script,/if\(!available\)return/);
  assert.match(script,/submit\.disabled=!available/);
  assert.match(script,/credentials:'same-origin'/);
  assert.match(script,/\/api\/v1\/auth\/confirm-reset/);
  assert.match(script,/\/api\/v1\/auth\/verify/);
  assert.match(landing,/meta name="referrer" content="no-referrer"/);
});

test('23E3: entering reset or tabs clears previous password fields',()=>{
  assert.match(script,/token='';password\.value='';confirmPassword\.value=''/);
  assert.match(script,/if\(!confirm\)confirmPassword\.value=''/);
  assert.match(script,/if\(reset&&!token\)password\.value=''/);
});
