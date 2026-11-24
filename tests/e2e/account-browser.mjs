/** ONLINE-01C-23E4 — real browser → web proxy → API → disposable PG18.
 * No Railway connection, real email, or public registrations.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer as createTlsServer} from 'node:https';
import {request as httpRequest} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require=createRequire(new URL('../../services/api/package.json',import.meta.url));
const pg=require('pg');
const repoDir=new URL('../../',import.meta.url).pathname;
const apiPort=43220,webPort=43221,closedPort=43222,tlsPort=43223;
const origin='https://127.0.0.1:'+tlsPort;
const closedOrigin='http://127.0.0.1:'+closedPort;
if(process.env.NODE_ENV!=='test'||
  !/^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55432\/kanto_ci$/.test(process.env.DATABASE_URL??''))
  throw new Error('Browser auth flow MUST use disposable local CI PostgreSQL');

const processes=[];
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
let browser,registeredId=null,tlsGateway=null;
function launch(command,args,env){
  const child=spawn(command,args,{cwd:repoDir,
    env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  let error='';
  child.stderr.on('data',part=>{error=(error+part.toString()).slice(-3000);});
  processes.push(child);
  return {child,get error(){return error;}};
}
async function ready(url,label){
  for(let i=0;i<160;i++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});
      if(r.status===200)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(label+' unavailable');
}
async function expectFeedback(page,text){
  await page.locator('#feedback').getByText(text,{exact:false}).waitFor();
}
async function responseFor(page,route,click){
  const awaited=page.waitForResponse(r=>r.url().endsWith(route)&&r.request().method()==='POST');
  await click();
  const response=await awaited;
  assert.ok(response.ok(),route+' failed '+response.status());
  return response.json();
}
try{
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  await pool.query(readFileSync(new URL('../../services/api/sql/027_regional_turn_binding.sql',import.meta.url),'utf8'));
  const api=launch(process.execPath,['services/api/src/server.mjs'],{
    NODE_ENV:'test',ONLINE_REGISTRATION_ENABLED:'true',
    ACCOUNT_MAIL_MODE:'off',PORT:String(apiPort),APP_ORIGIN:origin,
    WILD_CI_ENTROPY_HEX:'42'.repeat(32),ONLINE_REGIONAL_EXPANSION_CI_ONLY:'true'
  });
  const web=launch(process.execPath,['server.mjs'],{
    PORT:String(webPort),ONLINE_API_INTERNAL_URL:'http://127.0.0.1:'+apiPort+'/'
  });
  const closed=launch(process.execPath,['server.mjs'],{
    PORT:String(closedPort),ONLINE_API_INTERNAL_URL:''
  });
  await ready('http://127.0.0.1:'+apiPort+'/health','API: '+api.error);
  await ready('http://127.0.0.1:'+webPort+'/','web: '+web.error);
  if(!process.env.BROWSER_TLS_CERT||!process.env.BROWSER_TLS_KEY)
    throw new Error('CI-only HTTPS certificate files required');
  tlsGateway=createTlsServer({
    cert:readFileSync(process.env.BROWSER_TLS_CERT),
    key:readFileSync(process.env.BROWSER_TLS_KEY)
  },(request,response)=>{
    const upstream=httpRequest({hostname:'127.0.0.1',port:webPort,
      method:request.method,path:request.url,headers:request.headers},res=>{
      response.writeHead(res.statusCode??502,res.headers);res.pipe(response);
    });
    upstream.on('error',()=>{
      if(!response.headersSent){response.writeHead(502);response.end();}
      else response.destroy();
    });
    request.pipe(upstream);
  });
  await new Promise(resolve=>tlsGateway.listen(tlsPort,'127.0.0.1',resolve));
  await ready(closedOrigin+'/','closed web: '+closed.error);
  browser=await chromium.launch({headless:true});

  // Closed public-facing mode: no browser can submit registration/login.
  const mobile=await browser.newContext({viewport:{width:390,height:844}});
  const publicPage=await mobile.newPage();
  const browserErrors=[];
  publicPage.on('pageerror',err=>browserErrors.push(err.message));
  await publicPage.goto(closedOrigin+'/',{waitUntil:'domcontentloaded'});
  await publicPage.getByText('Cadastro e login online em preparação.',{exact:false}).waitFor();
  assert.equal(await publicPage.locator('#submit').isDisabled(),true);
  await publicPage.locator('#tab-register').click();
  assert.equal(await publicPage.locator('#submit').isDisabled(),true);
  assert.equal((await publicPage.request.get(closedOrigin+'/api/v1/status')).status(),503);
  assert.equal((await publicPage.request.get(closedOrigin+'/play')).status(),200);
  assert.equal(await publicPage.locator('#online-panel').isHidden(),true);
  await mobile.close();

  const context=await browser.newContext({viewport:{width:1365,height:768},
    ignoreHTTPSErrors:true});
  const page=await context.newPage();
  page.on('pageerror',err=>browserErrors.push(err.message));
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.getByText('Acesso de testes habilitado.').waitFor();
  const email='browser-23e4-'+process.pid+'@example.test';
  const password='Poke-Browser-Auth-23E4-Strong!';
  const replacement='Poke-Recovered-23E4-Strong!';
  await page.locator('#tab-register').click();
  await page.locator('#name').fill('Treinador Browser');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill('different secret');
  await page.locator('#submit').click();
  await expectFeedback(page,'As senhas informadas não coincidem');
  await page.locator('#confirm-password').fill(password);
  const registration=await responseFor(page,'/api/v1/auth/register',
    ()=>page.locator('#submit').click());
  assert.match(registration.verificationToken,/^[A-Za-z0-9_-]{43}$/);
  registeredId=registration.id;
  await expectFeedback(page,'Conta criada');
  const beforeVerify=await page.request.post(origin+'/api/v1/auth/login',{
    data:{email,password},headers:{Origin:origin}});
  assert.equal(beforeVerify.status(),403,'unverified login must be refused');

  await page.goto(origin+'/verify-email?token='+registration.verificationToken,
    {waitUntil:'domcontentloaded'});
  await page.getByText('Acesso de testes habilitado.').waitFor();
  assert.ok(!page.url().includes('token='),'URL must not retain bearer token');
  await responseFor(page,'/api/v1/auth/verify',()=>page.locator('#submit').click());
  await expectFeedback(page,'E-mail confirmado');
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.getByText('Acesso de testes habilitado.').waitFor();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await responseFor(page,'/api/v1/auth/login',()=>page.locator('#submit').click());
  await expectFeedback(page,'Autenticação concluída');
  const cookies=await context.cookies(origin);
  assert.ok(cookies.some(c=>c.name==='__Host-kanto_session'&&c.secure),
    'HTTPS must retain a Secure __Host- session cookie');
  assert.equal((await page.request.get(origin+'/api/v1/me')).status(),200);

  // First adventure is a server action, never an import of the /play save.
  await page.locator('#online-new').waitFor();
  assert.equal(await page.locator('#online-start').isDisabled(),true);
  await page.evaluate(()=>localStorage.setItem('online-portal-ci-sentinel','must-not-change'));
  await page.locator('[data-starter="4"]').click();
  const started=await responseFor(page,'/api/v1/adventure/start',()=>page.locator('#online-start').click());
  assert.deepEqual(started,{created:true,revision:0,starterId:4});
  await page.locator('#online-progress').waitFor();
  assert.equal(await page.locator('#online-level').textContent(),'1');
  assert.equal(await page.locator('#online-coins').textContent(),'0');
  assert.equal(await page.locator('#online-count').textContent(),'1');
  assert.match(await page.locator('#online-roster').textContent(),/Charmander · Nível 1/);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#online-progress').waitFor();
  assert.equal(await page.locator('#online-new').isHidden(),true);
  assert.match(await page.locator('#online-roster').textContent(),/Charmander · Nível 1/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('online-portal-ci-sentinel')),'must-not-change');
  const duplicate=await page.request.post(origin+'/api/v1/adventure/start',{data:{starterId:7},headers:{Origin:origin}});
  assert.equal(duplicate.status(),409);
  const persisted=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[registeredId]);
  assert.equal(persisted.rowCount,1);assert.equal(Number(persisted.rows[0].revision),0);
  assert.equal(JSON.parse(persisted.rows[0].state.journal.raw).roster[0].pokemonId,4);

  // Seed a disposable account-only fixture for actions that normally require
  // earning XP and captures. No UI/API path accepts this raw state.
  const fixture=persisted.rows[0].state;
  const raw=JSON.parse(fixture.journal.raw);
  raw.trainer.level=3;
  raw.roster.push({...structuredClone(raw.roster[0]),uid:2,pokemonId:25,level:30,moveName:'thunder-shock'});
  raw.roster.push({...structuredClone(raw.roster[0]),uid:3,pokemonId:7,moveName:'tackle'});
  raw.roster.push({...structuredClone(raw.roster[0]),uid:4,pokemonId:1,moveName:'tackle'});
  raw.nextUid=5;fixture.journal.raw=JSON.stringify(raw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(fixture)]);
  await page.locator('#online-refresh').click();
  await page.getByText('Pontos disponíveis: 4',{exact:true}).waitFor();
  await responseFor(page,'/api/v1/trainer/invest',()=>page.locator('[data-stat="attack"]').click());
  await page.getByText('Pontos disponíveis: 3',{exact:true}).waitFor();
  await page.locator('[data-uid="2"]').click();
  await page.locator('[data-uid="3"]').click();
  assert.equal(await page.locator('[data-uid="4"]').isDisabled(),true);
  await page.locator('#online-team li').nth(1).getByRole('button',{name:'↑',exact:true}).click();
  await responseFor(page,'/api/v1/collection/team',()=>page.locator('#online-team-save').click());
  await page.getByText('Revisão do servidor: 2',{exact:true}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#online-progress').waitFor();
  assert.match(await page.locator('#online-team li').first().textContent(),/Líder · Pikachu/);
  assert.equal(await page.locator('#online-team li').count(),3);
  const actionSave=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[registeredId]);
  const afterActions=JSON.parse(actionSave.rows[0].state.journal.raw);
  assert.equal(Number(actionSave.rows[0].revision),2);
  assert.deepEqual(afterActions.team,[2,1,3]);assert.equal(afterActions.trainer.manual.attack,1);
  assert.equal(afterActions.coins,0);assert.equal(afterActions.roster.length,4);
  const stale=await page.request.post(origin+'/api/v1/collection/team',{data:{actionId:'stale-browser-test-01',expectedRevision:0,teamUids:[1]},headers:{Origin:origin}});
  assert.equal(stale.status(),409);

  // Same authenticated browser context, real Web/API/PG18; UI battle controls
  // follow after the HTTP contract. Use the account's persisted selected leader.
  const callRegion=async(command,data)=>{
    const response=await page.request.post(origin+'/api/v1/region/'+command,{data,headers:{Origin:origin}});
    const result=await response.json();
    assert.equal(response.status(),200,command+' failed '+response.status()+' '+String(result.status??result.error??''));
    return result;
  };
  const readRegion=async()=>{const response=await page.request.get(origin+'/api/v1/region/current');assert.equal(response.status(),200);return response.json();};
  const none=await readRegion();assert.equal(none.encounter,null);assert.equal(none.revision,2);
  const reserved=await callRegion('reserve',{actionId:'browser-region-reserve-01',expectedRevision:2,regionId:1});
  const encounterId=reserved.encounter.id;
  const tamper=await page.request.post(origin+'/api/v1/region/start',{data:{encounterId,expectedRevision:reserved.revision,seed:1},headers:{Origin:origin}});
  assert.equal(tamper.status(),400);
  const blockedInvest=await page.request.post(origin+'/api/v1/trainer/invest',{data:{actionId:'browser-region-block-invest',expectedRevision:reserved.revision,stat:'attack'},headers:{Origin:origin}});
  assert.equal(blockedInvest.status(),409);
  const start=await callRegion('start',{encounterId,expectedRevision:reserved.revision});
  assert.equal(start.encounter.player.uid,2);assert.equal(start.encounter.player.speciesId,25);
  assert.equal(start.encounter.phase,'await-player');assert.equal(start.encounter.engine,undefined);
  const turnCommand={encounterId,actionId:'browser-region-turn-01',expectedRevision:start.revision,action:{kind:'basic'}};
  let battle=await callRegion('turn',turnCommand);
  const replayTurn=await callRegion('turn',turnCommand);
  assert.equal(replayTurn.status,'replay');assert.equal(replayTurn.revision,battle.revision);
  const reloadState=await readRegion();assert.deepEqual(reloadState.encounter,battle.encounter);
  for(let i=2;battle.encounter.phase==='await-player'&&i<=30;i++)
    battle=await callRegion('turn',{encounterId,actionId:'browser-region-turn-'+String(i).padStart(2,'0'),expectedRevision:battle.revision,action:{kind:'basic'}});
  assert.equal(battle.encounter.phase,'resolved');
  const certified=await callRegion('certify',{encounterId,actionId:'browser-region-certify-01',expectedRevision:battle.revision});
  const paid=await callRegion('settle',{encounterId,actionId:'browser-region-settle-01',expectedRevision:certified.revision});
  assert.equal(paid.encounter.phase,'paid');
  const finish=await callRegion('finish',{encounterId,actionId:'browser-region-finish-01',expectedRevision:paid.revision,choice:'skip'});
  assert.equal(finish.encounter,null);assert.equal(finish.capture,'skipped');
  assert.equal((await readRegion()).encounter,null);

  // Actual UI journey: the previous HTTP encounter closed; a new battle
  // uses the same server-owned leader and canonical permitted actions.
  await page.locator('#online-refresh').click();
  await page.locator('#region-open').click();
  await page.locator('#region-phase[data-phase="await-player"]').waitFor();
  assert.match(await page.locator('#region-actors').textContent(),/Pikachu/);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#region-phase[data-phase="await-player"]').waitFor();
  let uiTurn=0;
  while(await page.locator('#region-phase').getAttribute('data-phase')==='await-player'&&uiTurn<30){
    uiTurn++;
    await responseFor(page,'/api/v1/region/turn',()=>page.locator('[data-region-action="basic"]').click());
    await page.locator('#region-phase[data-turn="'+uiTurn+'"]').waitFor();
  }
  await page.locator('#region-phase[data-phase="resolved"]').waitFor();
  await page.locator('[data-region-action="reward"]').click();
  await page.locator('#region-phase[data-phase="paid"]').waitFor();
  const beforeCapture=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId]);
  const beforeBalls=JSON.parse(beforeCapture.rows[0].state.journal.raw).ballPocket.quantities['poke-ball'];
  const canCapture=await page.locator('[data-region-action="poke-ball"]').count();
  assert.equal(canCapture,1,'strong CI fixture should win');
  const capture=await responseFor(page,'/api/v1/region/finish',()=>page.locator('[data-region-action="poke-ball"]').click());
  assert.ok(['captured','failed'].includes(capture.capture));
  await page.locator('#region-open').waitFor();
  await page.waitForFunction(()=>document.activeElement?.id==='region-open');
  const afterCapture=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId]);
  assert.equal(JSON.parse(afterCapture.rows[0].state.journal.raw).ballPocket.quantities['poke-ball'],beforeBalls-1);
  assert.equal((await readRegion()).encounter,null);

  // Expanded selector uses server-provided access rules. R2 stays disabled
  // until the disposable fixture reaches its existing trainer threshold.
  assert.equal(await page.locator('#region-select option[value="2"]').isDisabled(),true);
  const expandedSave=afterCapture.rows[0].state;
  const expandedRaw=JSON.parse(expandedSave.journal.raw);expandedRaw.trainer.level=6;
  expandedSave.journal.raw=JSON.stringify(expandedRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(expandedSave)]);
  await page.locator('#online-refresh').click();
  await page.waitForFunction(()=>!document.querySelector('#region-select option[value="2"]')?.disabled&&document.querySelector('#region-select option[value="2"]')!==null);
  await page.locator('#region-select').selectOption('2');
  assert.equal(await page.locator('#region-heading').textContent(),'Colinas de Kanto');
  await page.locator('#region-open').click();
  await page.locator('#region-phase[data-phase="await-player"]').waitFor();
  assert.equal((await readRegion()).encounter.regionId,2);
  assert.equal(await page.locator('#region-select').isDisabled(),true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#region-phase[data-phase="await-player"]').waitFor();
  assert.equal(await page.locator('#region-select').inputValue(),'2');
  let secondTurn=0;
  while(await page.locator('#region-phase').getAttribute('data-phase')==='await-player'&&secondTurn<30){
    secondTurn++;
    await responseFor(page,'/api/v1/region/turn',()=>page.locator('[data-region-action="basic"]').click());
    await page.locator('#region-phase[data-turn="'+secondTurn+'"]').waitFor();
  }
  await page.locator('#region-phase[data-phase="resolved"]').waitFor();
  await page.locator('[data-region-action="reward"]').click();
  await page.locator('#region-phase[data-phase="paid"]').waitFor();
  await responseFor(page,'/api/v1/region/finish',()=>page.locator('[data-region-action="skip"]').click());
  await page.locator('#region-open').waitFor();
  await page.waitForFunction(()=>document.activeElement?.id==='region-open');
  assert.equal(await page.locator('#region-select').inputValue(),'2');
  assert.equal((await readRegion()).encounter,null);

  // Recovery is requested using the actual browser form, never a real inbox.
  await page.locator('#reset-link').click();
  assert.ok(page.url().endsWith('/reset-password'));
  await page.locator('#email').fill(email);
  const reset=await responseFor(page,'/api/v1/auth/request-reset',
    ()=>page.locator('#submit').click());
  assert.match(reset.testResetToken,/^[A-Za-z0-9_-]{43}$/);
  await expectFeedback(page,'Se o e-mail estiver cadastrado');
  await page.goto(origin+'/reset-password?token='+reset.testResetToken,
    {waitUntil:'domcontentloaded'});
  await page.getByText('Acesso de testes habilitado.').waitFor();
  assert.ok(!page.url().includes('token='),'reset URL must not retain bearer token');
  await page.locator('#password').fill(replacement);
  await page.locator('#confirm-password').fill('mismatch');
  await page.locator('#submit').click();
  await expectFeedback(page,'As senhas informadas não coincidem');
  await page.locator('#confirm-password').fill(replacement);
  await responseFor(page,'/api/v1/auth/confirm-reset',
    ()=>page.locator('#submit').click());
  await expectFeedback(page,'Senha redefinida');
  assert.equal((await page.request.get(origin+'/api/v1/me')).status(),401,
    'password reset must revoke prior session');
  const replay=await page.request.post(origin+'/api/v1/auth/confirm-reset',{
    data:{token:reset.testResetToken,password:replacement},
    headers:{Origin:origin}});
  assert.equal(replay.status(),400,'reset token cannot be reused');

  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.getByText('Acesso de testes habilitado.').waitFor();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  const oldLogin=page.waitForResponse(r=>r.url().endsWith('/api/v1/auth/login'));
  await page.locator('#submit').click();
  assert.equal((await oldLogin).status(),401,'old password cannot log in');
  await page.locator('#password').fill(replacement);
  await responseFor(page,'/api/v1/auth/login',()=>page.locator('#submit').click());
  assert.equal((await page.request.get(origin+'/api/v1/me')).status(),200);
  await page.locator('#online-progress').waitFor();
  assert.match(await page.locator('#online-roster').textContent(),/Charmander · Nível 1/);
  await responseFor(page,'/api/v1/auth/logout',()=>page.locator('#online-logout').click());
  await page.locator('#auth-form').waitFor();
  assert.equal(await page.locator('#online-panel').isHidden(),true);
  assert.equal((await page.request.get(origin+'/api/v1/me')).status(),401);
  assert.deepEqual(browserErrors,[],'no uncaught browser errors');
  console.log('ONLINE-01C-23E4: browser auth, verification, reset, replay and closed mode PASS');
  await context.close();
}finally{
  if(browser)await browser.close();
  if(tlsGateway)await new Promise(resolve=>tlsGateway.close(resolve));
  for(const proc of processes)proc.kill('SIGTERM');
  if(registeredId)await pool.query('DELETE FROM game_accounts WHERE id=$1',
    [registeredId]);
  await pool.end();
}
