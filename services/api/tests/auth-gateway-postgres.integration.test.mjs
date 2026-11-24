import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {createAuthGateway} from '../../../scripts/auth-gateway-candidate.mjs';
import {createProxyIssuer} from '../src/proxyKeyring.mjs';

const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s.address().port)));
const close=s=>new Promise(resolve=>s.close(resolve));
async function freePort(){const s=createServer(),p=await listen(s);await close(s);return p;}
async function ready(child,url){
  for(let i=0;i<100;i++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});await r.text();if(r.ok)return;}catch{}
    if(child.exitCode!==null||child.signalCode!==null)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Disposable HTTP process did not start');
}

test('23E19: real gateway -> web -> API -> PG18, account lifecycle, replay and independent quotas',async()=>{
  assert.equal(process.env.NODE_ENV,'test');
  const db=new URL(process.env.DATABASE_URL);
  assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');
  assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
  assert.equal(db.search,'');
  const suffix=randomBytes(8).toString('hex'),schema='gateway_ci_'+suffix;
  const admin=new pg.Pool({connectionString:db.href});
  const signingHex=randomBytes(32).toString('hex'),subjectHex=randomBytes(32).toString('hex');
  const issuer=createProxyIssuer({activeHex:signingHex,subjectHex});
  const origin='https://gateway-ci.up.railway.app';
  const email='gateway-'+suffix+'@example.test',password='Synthetic-old-12345',newPassword='Synthetic-new-67890';
  const children=[],gateways=[];let created=false,lastProof;
  try{
    assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name,'kanto_ci');
    await admin.query('CREATE SCHEMA '+schema);created=true;
    const fixture=new pg.Pool({connectionString:db.href,options:'-c search_path='+schema});
    try{await fixture.query(await readFile(new URL('../sql/026_proxy_identity_nonces.sql',import.meta.url),'utf8'));}
    finally{await fixture.end();}
    db.searchParams.set('options','-c search_path='+schema+',public');
    const apiPort=await freePort();
    const api=spawn(process.execPath,['src/server.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),
      env:{...process.env,DATABASE_URL:db.href,NODE_ENV:'test',ONLINE_REGISTRATION_ENABLED:'true',
        ACCOUNT_DRILL_LOOPBACK_ONLY:'true',ACCOUNT_MAIL_MODE:'off',APP_ORIGIN:origin,PORT:String(apiPort),
        AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),ONLINE_SIGNED_QUOTA_TEST_ONLY:'true',
        ONLINE_SIGNED_QUOTA_TEST_KEY:signingHex},stdio:'ignore'});
    children.push(api);await ready(api,'http://127.0.0.1:'+apiPort+'/health');
    const webPort=await freePort(),webBase='http://127.0.0.1:'+webPort;
    // Web gets neither database credentials nor either cryptographic key.
    const web=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../../../',import.meta.url)),
      env:{NODE_ENV:'test',PORT:String(webPort),ONLINE_API_INTERNAL_URL:'http://127.0.0.1:'+apiPort+'/',
        ONLINE_GATEWAY_FORWARD_TEST_ONLY:'true'},stdio:'ignore'});
    children.push(web);await ready(web,webBase+'/api/v1/status');
    for(const ip of ['192.0.2.10','192.0.2.11']){
      const server=createAuthGateway({upstreamOrigin:webBase,clientOrigin:origin,loopbackTest:true,
        issuer:{sign(input){lastProof=issuer.sign(input);return lastProof;}},
        // Constant trusted identity per synthetic gateway; NOT a real Railway adapter.
        resolveTrustedClientIp:()=>ip});
      gateways.push(server);await listen(server);
    }
    const g=i=>'http://127.0.0.1:'+gateways[i].address().port;
    async function post(base,route,data,headers={}){
      const res=await fetch(base+'/api/v1/auth/'+route,{method:'POST',redirect:'manual',
        headers:{Origin:origin,'Content-Type':'application/json',...headers},
        body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
      return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie'),retry:res.headers.get('retry-after')};
    }
    const registration={email,password,trainerName:'Gateway Trainer'};
    for(const base of [webBase,'http://127.0.0.1:'+apiPort]){
      assert.equal((await post(base,'register',registration,{'X-Real-IP':'192.0.2.10','X-Railway-Edge':'fake'})).status,403);
      assert.equal((await post(base,'register',registration,{'X-Kanto-Proxy-Identity':'forged'})).status,403);
    }
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM game_accounts WHERE email=$1',[email])).rows[0].n,0);
    const registered=await post(g(0),'register',registration,{'X-Kanto-Proxy-Identity':'forged','X-Real-IP':'198.51.100.1'});
    assert.equal(registered.status,201);
    const proof=lastProof,accountId=registered.body.id;
    assert.ok(typeof registered.body.verificationToken==='string');
    assert.equal((await post(webBase,'register',registration,{'X-Kanto-Proxy-Identity':proof})).status,403);
    assert.equal((await post(webBase,'register',{...registration,trainerName:'Tampered'},{'X-Kanto-Proxy-Identity':proof})).status,403);
    assert.equal((await post(g(0),'login',{email,password})).status,403);
    assert.equal((await post(g(0),'verify',{token:registered.body.verificationToken})).status,200);
    assert.equal((await post(g(0),'verify',{token:registered.body.verificationToken})).status,400);
    const login=await post(g(0),'login',{email,password});
    assert.equal(login.status,200);assert.match(login.cookie,/HttpOnly/);assert.match(login.cookie,/Secure/);
    assert.match(login.cookie,/SameSite=Lax/);
    const me=async cookie=>{
      const res=await fetch(g(0)+'/api/v1/me',{headers:{Cookie:cookie.split(';')[0]},signal:AbortSignal.timeout(10000)});
      return {status:res.status,body:await res.json()};
    };
    assert.equal((await me(login.cookie)).body.id,accountId);
    const reset=await post(g(0),'request-reset',{email});
    assert.equal(reset.status,200);assert.ok(typeof reset.body.testResetToken==='string');
    assert.equal((await post(g(0),'confirm-reset',{token:reset.body.testResetToken,password:newPassword})).status,200);
    assert.equal((await post(g(0),'confirm-reset',{token:reset.body.testResetToken,password:newPassword})).status,400);
    assert.equal((await me(login.cookie)).status,401);
    assert.equal((await post(g(0),'login',{email,password})).status,401);
    const renewed=await post(g(0),'login',{email,password:newPassword});
    assert.equal(renewed.status,200);assert.equal((await me(renewed.cookie)).body.id,accountId);
    const logout=await post(g(0),'logout',{}, {Cookie:renewed.cookie.split(';')[0]});
    assert.equal(logout.status,200);assert.match(logout.cookie,/Max-Age=0/);
    assert.equal((await me(renewed.cookie)).status,401);
    const status=await fetch(g(0)+'/api/v1/status');assert.equal(status.status,200);
    assert.equal((await status.json()).registrationEnabled,true);
    const home=await fetch(g(0)+'/');assert.equal(home.status,200);
    assert.match(home.headers.get('content-type'),/text\/html/);await home.text();
    const sprite=await fetch(g(0)+'/assets/pokemon-gifs/poke_1.gif');
    assert.equal(sprite.status,200);assert.equal(sprite.headers.get('content-type'),'image/gif');
    assert.ok((await sprite.arrayBuffer()).byteLength>0);
    // Second identity exhausts its login IP quota with unique nonexistent accounts.
    for(let i=0;i<30;i++){
      const attempt=await post(g(1),'login',{email:'missing-'+suffix+'-'+i+'@example.test',password},
        {'X-Real-IP':'198.51.100.'+(i+1),'X-Railway-Edge':'fake'});
      assert.equal(attempt.status,401);
    }
    const blocked=await post(g(1),'login',{email:'blocked-'+suffix+'@example.test',password});
    assert.equal(blocked.status,429);assert.equal(blocked.retry,'900');
    assert.equal((await post(g(0),'login',{email:'other-'+suffix+'@example.test',password})).status,401);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM game_accounts WHERE email=$1',[email])).rows[0].n,1);
  }finally{
    for(const s of gateways)if(s.listening)await close(s);
    for(const child of children)if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited;}
    if(created){
      await admin.query('DELETE FROM game_accounts WHERE email=$1',[email]);
      await admin.query('DROP SCHEMA '+schema+' CASCADE');
    }
    await admin.end();
  }
});
