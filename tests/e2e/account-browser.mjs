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
    WILD_CI_ENTROPY_HEX:'42'.repeat(32),ONLINE_REGIONAL_EXPANSION_CI_ONLY:'true',ONLINE_GYM_PORTAL_CI_ONLY:'true',ONLINE_EXPEDITION_CI_ONLY:'true',ONLINE_SHOP_CI_ONLY:'true',ONLINE_MOVES_CI_ONLY:'true',ONLINE_POKEDEX_CI_ONLY:'true',ONLINE_TRAINER_LOADOUT_CI_ONLY:'true',ONLINE_EVOLUTION_CI_ONLY:'true',ONLINE_POKEMON_TRAINING_CI_ONLY:'true',
    GYM_HMAC_ACTIVE_KEY_ID:'browser-ci',GYM_HMAC_KEYRING_JSON:JSON.stringify({'browser-ci':Buffer.alloc(32,91).toString('base64')})
  });
  const web=launch(process.execPath,['server.mjs'],{
    PORT:String(webPort),ONLINE_GYM_PORTAL_CI_ONLY:'true',ONLINE_EXPEDITION_CI_ONLY:'true',ONLINE_SHOP_CI_ONLY:'true',ONLINE_MOVES_CI_ONLY:'true',ONLINE_POKEDEX_CI_ONLY:'true',ONLINE_TRAINER_LOADOUT_CI_ONLY:'true',ONLINE_EVOLUTION_CI_ONLY:'true',ONLINE_POKEMON_TRAINING_CI_ONLY:'true',ONLINE_API_INTERNAL_URL:'http://127.0.0.1:'+apiPort+'/'
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
  assert.equal((await publicPage.request.get(closedOrigin+'/api/v1/evolution/current')).status(),404);
  assert.equal((await publicPage.request.get(closedOrigin+'/api/v1/pokemon-training/current')).status(),404);
  assert.equal((await publicPage.request.get(closedOrigin+'/api/v1/pokedex/current')).status(),404);
  assert.equal((await publicPage.request.get(closedOrigin+'/api/v1/inventory/current')).status(),404);
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
  assert.equal(await page.locator('#online-team [data-leader="true"]').count(),1);
  assert.equal(await page.locator('#online-roster .collection-card[data-selected="true"]').count(),3);
  assert.equal(await page.locator('#collection-team-count').textContent(),'3 / 3 Pokémon na equipe');
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

  // Private expedition HTTP over the real authenticated browser proxy.
  const expeditionPath=origin+'/api/v1/expedition/';
  const expRead=async()=>{const response=await page.request.get(expeditionPath+'current');assert.equal(response.status(),200);return response.json();};
  const expPost=(kind,data)=>page.request.post(expeditionPath+kind,{data,headers:{Origin:origin}});
  const beforeExp=await expRead();assert.equal(beforeExp.expedition,null);assert.equal(beforeExp.leader.uid,2);
  assert.equal((await expPost('start',{actionId:'browser-expedition-clock-tamper',expectedRevision:beforeExp.revision,regionId:2,nowMs:1})).status(),400);
  await page.locator('#expedition-select').selectOption('2');
  await responseFor(page,'/api/v1/expedition/start',()=>page.locator('#expedition-start').click());
  await page.locator('#expedition-active').waitFor();
  assert.equal(await page.locator('#expedition-select').isDisabled(),true);
  assert.equal(await page.locator('#region-open').isDisabled(),true);
  assert.equal(await page.locator('#gym-open').isDisabled(),true);
  assert.equal(await page.locator('[data-shop-buy="poke-ball"]').isDisabled(),true);
  assert.equal(await page.locator('#online-team-save').isDisabled(),true);
  const openedExp=await expRead();assert.equal(openedExp.expedition.regionId,2);assert.equal(openedExp.expedition.leaderUid,2);
  assert.ok(openedExp.serverNowMs>=openedExp.expedition.startedAt);
  const expFixture=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId])).rows[0].state;
  const expRaw=JSON.parse(expFixture.journal.raw);
  expRaw.expedition.startedAt-=9*3600000;expRaw.expedition.lastClaimAt=expRaw.expedition.startedAt;
  expFixture.journal.raw=JSON.stringify(expRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(expFixture)]);
  const readyExp=await expRead();assert.equal(readyExp.expedition.cycles,2880);
  assert.equal(readyExp.expedition.preview.cycles,2880);
  await page.locator('#expedition-sync').click();
  await page.getByText('2880 / 2880 ciclos',{exact:true}).waitFor();
  assert.match(await page.locator('#expedition-timer').textContent(),/^09:/);
  assert.match(await page.locator('#expedition-cap').textContent(),/Limite de 8h/);
  const claimRequest=page.waitForRequest(r=>r.url().endsWith('/api/v1/expedition/claim')&&r.method()==='POST');
  await responseFor(page,'/api/v1/expedition/claim',()=>page.locator('#expedition-claim').click());
  const claimArgs=(await claimRequest).postDataJSON();
  assert.equal((await expPost('claim',claimArgs)).status(),409);
  await page.getByText('Recompensas resgatadas.',{exact:true}).waitFor();
  assert.match(await page.locator('#expedition-timer').textContent(),/^09:/);
  await page.reload({waitUntil:'domcontentloaded'});
  const claimedExp=await expRead();assert.equal(claimedExp.expedition.startedAt,readyExp.expedition.startedAt);
  await page.locator('#expedition-active').waitFor();
  assert.match(await page.locator('#expedition-timer').textContent(),/^09:/);
  await responseFor(page,'/api/v1/expedition/stop',()=>page.locator('#expedition-stop').click());
  await page.locator('#expedition-start').waitFor();
  assert.equal(await page.locator('#expedition-active').isHidden(),true);
  assert.equal((await expRead()).expedition,null);

  // Shop checkout through the real browser. Fund only in disposable PG fixture.
  const shopFixture=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId])).rows[0].state;
  const shopRaw=JSON.parse(shopFixture.journal.raw);shopRaw.coins=5000;
  const ownedBefore=shopRaw.ballPocket.quantities['poke-ball']??0;
  shopFixture.journal.raw=JSON.stringify(shopRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(shopFixture)]);
  await page.locator('#online-refresh').click();
  await page.getByText('Saldo: 5.000 moedas',{exact:true}).waitFor();
  const shopRead=async()=>{const q=await page.request.get(origin+'/api/v1/shop/current');assert.equal(q.status(),200);return q.json();};
  const shopBefore=await shopRead();assert.equal(shopBefore.items.length,3);
  assert.equal((await page.request.post(origin+'/api/v1/shop/purchase',{data:{actionId:'shop-tamper-browser-01',ballId:'poke-ball',quantity:2,expectedRevision:shopBefore.revision,unitPrice:0},headers:{Origin:origin}})).status(),400);
  await page.locator('#shop-qty-poke-ball').fill('2');
  await page.getByText('Total: 1.200 moedas',{exact:true}).waitFor();
  const shopRequest=page.waitForRequest(q=>q.url().endsWith('/api/v1/shop/purchase')&&q.method()==='POST');
  await responseFor(page,'/api/v1/shop/purchase',()=>page.locator('[data-shop-buy="poke-ball"]').click());
  const purchaseArgs=(await shopRequest).postDataJSON();
  assert.equal((await page.request.post(origin+'/api/v1/shop/purchase',{data:purchaseArgs,headers:{Origin:origin}})).status(),409);
  await page.getByText('Saldo: 3.800 moedas',{exact:true}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Saldo: 3.800 moedas',{exact:true}).waitFor();
  const shopAfter=await shopRead();assert.equal(shopAfter.coins,3800);assert.equal(shopAfter.items.find(i=>i.id==='poke-ball').owned,ownedBefore+2);

  // Gym portal read contract via the real authenticated Web proxy.
  const gymPath=origin+'/api/v1/gym/';
  const gymRead=async()=>{const response=await page.request.get(gymPath+'current');assert.equal(response.status(),200);return response.json();};
  const gymPost=async(command,data)=>{const response=await page.request.post(gymPath+command,{data,headers:{Origin:origin}});assert.equal(response.status(),200,command+' failed '+response.status());return response.json();};
  // Strong disposable Gym fixture: keep Charmander at its earned level;
  // two teammates can safely defeat Brock without changing the core.
  const gymFixture=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId])).rows[0].state;
  const gymRaw=JSON.parse(gymFixture.journal.raw);
  for(const p of gymRaw.roster)if([2,3].includes(p.uid))p.level=100;
  gymFixture.journal.raw=JSON.stringify(gymRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(gymFixture)]);
  await page.locator('#online-refresh').click();
  await page.locator('#gym-open').waitFor();
  const gymBefore=await gymRead();
  assert.equal(gymBefore.gym,null);assert.equal(gymBefore.canReserve,true);
  assert.equal(gymBefore.nextGym.leader,'Brock');assert.deepEqual(gymBefore.nextGym.teamUids,[2,1,3]);
  const anonymous=await browser.newContext({ignoreHTTPSErrors:true});
  assert.equal((await anonymous.request.get(gymPath+'current')).status(),401);
  await anonymous.close();
  const gymReserved=await gymPost('reserve',{actionId:'browser-gym-reserve-01',expectedRevision:gymBefore.revision});
  const gymReservationId=gymReserved.gymReservationId;
  const reservedGym=await gymRead();assert.equal(reservedGym.gym.phase,'reserved');
  assert.equal(reservedGym.gym.id,gymReservationId);
  assert.equal(reservedGym.gym.player,null);
  await page.locator('#online-refresh').click();
  await page.getByRole('button',{name:'Retomar confronto',exact:true}).click();
  await page.locator('#gym-phase[data-phase="await-player"]').waitFor();
  const openedGym=await gymRead();assert.equal(openedGym.gym.phase,'await-player');
  assert.equal(openedGym.gym.player.fighters.length,3);assert.equal(openedGym.gym.opponent.fighters.length,3);
  assert.deepEqual(openedGym.gym.player.fighters.map(f=>f.uid),[2,1,3]);
  assert.ok(openedGym.gym.actions.some(a=>a.kind==='switch'&&a.toIndex===1));
  assert.equal(openedGym.gym.frozenPreparation,undefined);
  assert.equal(openedGym.gym.entropyProof,undefined);
  await gymPost('turn',{gymReservationId,actionId:'browser-gym-switch-01',expectedRevision:openedGym.revision,action:{kind:'switch',toIndex:1}});
  const switchedGym=await gymRead();assert.equal(switchedGym.gym.player.activeIndex,1);
  assert.equal(switchedGym.gym.actionNumber,1);assert.ok(switchedGym.gym.log.length>0);
  assert.equal(switchedGym.gym.player.fighters[0].hp,openedGym.gym.player.fighters[0].hp);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.deepEqual(await gymRead(),switchedGym);
  const gymLockedTeam=await page.request.post(origin+'/api/v1/collection/team',{data:{actionId:'browser-gym-lock-team',expectedRevision:switchedGym.revision,teamUids:[1,2,3]},headers:{Origin:origin}});
  assert.equal(gymLockedTeam.status(),409);
  await page.locator('#gym-phase[data-action-number="1"]').waitFor();
  assert.equal(await page.locator('#gym-parties [data-gym-slot]').count(),6);
  assert.match(await page.locator('#gym-match').textContent(),/Brock vs Treinador Browser/);
  assert.equal(await page.locator('#region-open').isDisabled(),true);
  assert.equal(await page.locator('#online-team-save').isDisabled(),true);
  assert.equal(await page.locator('#expedition-start').isDisabled(),true);
  assert.equal(await page.locator('[data-shop-buy="poke-ball"]').isDisabled(),true);
  let gymNow=await gymRead();
  for(let i=0;gymNow.gym.phase==='await-player'&&i<140;i++){
    const g=gymNow.gym;
    const chosen=(g.player.activeIndex===1?g.actions.find(a=>a.kind==='switch'&&a.toIndex===2):null)
      ??g.actions.find(a=>a.kind==='basic')??g.actions[0];
    assert.ok(chosen);
    const tag=chosen.kind==='switch'?'switch:'+chosen.toIndex:chosen.kind==='move'?'move:'+chosen.moveName:chosen.kind;
    await responseFor(page,'/api/v1/gym/turn',()=>page.locator('[data-gym-action="'+tag+'"]').click());
    await page.locator('#gym-phase[data-action-number="'+(g.actionNumber+1)+'"]').waitFor();
    gymNow=await gymRead();
  }
  assert.equal(gymNow.gym.phase,'resolved');assert.equal(gymNow.gym.outcome,'player-win');
  const beforeGymCoins=Number(await page.locator('#online-coins').textContent());
  const gymPaid=await responseFor(page,'/api/v1/gym/settle',()=>page.locator('[data-gym-action="reward"]').click());
  assert.equal(gymPaid.paid.badgeId,'boulder');assert.equal(gymPaid.paid.coins,1500);assert.equal(gymPaid.paid.trainerXp,120);
  await page.getByRole('button',{name:'Desafiar Misty',exact:true}).waitFor();
  assert.equal(Number(await page.locator('#online-coins').textContent()),beforeGymCoins+1500);
  assert.equal(await page.locator('#online-badges').textContent(),'1');
  assert.equal((await gymRead()).gym,null);
  assert.match(await page.locator('#gym-note').textContent(),/Insígnia conquistada/);

  // Canonical FRLG learned moves through the real Collection UI.
  await page.locator('#moves-pokemon').selectOption('1');
  const moveRead=async()=>{const q=await page.request.get(origin+'/api/v1/moves/current');assert.equal(q.status(),200);return q.json();};
  const moveBefore=await moveRead();
  const char=moveBefore.pokemon.find(p=>p.uid===1);
  assert.ok(char.learned.some(m=>m.name==='scratch'));assert.ok(char.learned.some(m=>m.name==='growl'));
  const badMove=await page.request.post(origin+'/api/v1/moves/equip',{data:{actionId:'browser-move-forged-0001',expectedRevision:moveBefore.revision,pokemonUid:1,moveNames:['hyper-beam']},headers:{Origin:origin}});
  assert.equal(badMove.status(),409);
  const badUid=await page.request.post(origin+'/api/v1/moves/equip',{data:{actionId:'browser-move-other-0001',expectedRevision:moveBefore.revision,pokemonUid:999999,moveNames:['scratch']},headers:{Origin:origin}});
  assert.equal(badUid.status(),409);
  const supportOnly=await page.request.post(origin+'/api/v1/moves/equip',{data:{actionId:'browser-move-support-0001',expectedRevision:moveBefore.revision,pokemonUid:1,moveNames:['growl']},headers:{Origin:origin}});
  assert.equal(supportOnly.status(),409);
  assert.equal((await moveRead()).revision,moveBefore.revision);
  await page.locator('[data-move-name="growl"]').click();
  await page.locator('#moves-equipped .team-row').first().getByRole('button',{name:'Remover'}).click();
  assert.equal(await page.locator('#moves-save').isDisabled(),true);
  await page.locator('[data-move-name="scratch"]').click();
  await page.locator('#moves-equipped .team-row').nth(1).getByRole('button',{name:'↑'}).click();
  await responseFor(page,'/api/v1/moves/equip',()=>page.locator('#moves-save').click());
  await page.getByText('Golpes salvos.',{exact:true}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#moves-pokemon').waitFor();
  assert.deepEqual((await moveRead()).pokemon.find(p=>p.uid===1).equipped,['scratch','growl']);

  // Evolution via Collection, not an injected client save. Only fixture grants level.
  const evoRead=async()=>{const q=await page.request.get(origin+'/api/v1/evolution/current');assert.equal(q.status(),200);return q.json();};
  const evoPost=(data,headers={Origin:origin})=>page.request.post(origin+'/api/v1/evolution/evolve',{data,headers});
  const evoBefore=await evoRead();
  await page.locator('#evolution-pokemon').selectOption('1');
  assert.equal(await page.locator('[data-evolution-target="5"]').isDisabled(),true);
  const req={actionId:'browser-evolution-low-0001',expectedRevision:evoBefore.revision,pokemonUid:1,targetSpeciesId:5};
  assert.equal((await evoPost(req)).status(),409);
  assert.equal((await evoPost({...req,level:16})).status(),400);
  assert.equal((await evoPost(req,{Origin:'https://attacker.example'})).status(),400,'cross-site Origin rejected by existing API contract');
  assert.equal((await evoRead()).revision,evoBefore.revision);
  const evoFixture=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId])).rows[0].state;
  const evoRaw=JSON.parse(evoFixture.journal.raw);
  evoRaw.roster.find(p=>p.uid===1).level=16;
  evoFixture.journal.raw=JSON.stringify(evoRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(evoFixture)]);
  await page.locator('#online-refresh').click();
  await page.locator('#evolution-pokemon').selectOption('1');
  const button=page.locator('[data-evolution-target="5"]');
  await button.waitFor({state:'visible'});
  assert.equal(await button.isEnabled(),true);
  const eligibleRevision=(await evoRead()).revision;
  assert.equal((await evoPost({actionId:'browser-evolution-csrf-0002',expectedRevision:eligibleRevision,pokemonUid:1,targetSpeciesId:5},{Origin:'https://attacker.example'})).status(),400);
  assert.equal((await evoRead()).revision,eligibleRevision,'eligible cross-site evolution must not mutate save');
  page.once('dialog',d=>d.dismiss());await button.click();
  assert.equal((await evoRead()).revision,evoBefore.revision);
  page.once('dialog',d=>d.accept());
  await responseFor(page,'/api/v1/evolution/evolve',()=>button.click());
  await page.getByText('Evolução concluída.',{exact:true}).waitFor();
  const evoAfter=await evoRead();
  assert.equal(evoAfter.revision,evoBefore.revision+1);
  assert.equal(evoAfter.pokemon.find(p=>p.uid===1).speciesId,5);
  assert.deepEqual((await moveRead()).pokemon.find(p=>p.uid===1).equipped,['scratch','growl']);
  const storedEvo=JSON.parse((await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId])).rows[0].state.journal.raw);
  assert.deepEqual(storedEvo.team,evoRaw.team);
  assert.deepEqual(storedEvo.roster.find(p=>p.uid===1),{...evoRaw.roster.find(p=>p.uid===1),pokemonId:5,evolutionHistory:[{from:4,to:5,level:16,moves:['scratch','growl']}]});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#evolution-pokemon').waitFor();
  assert.equal((await evoRead()).pokemon.find(p=>p.uid===1).speciesId,5);

  // Train the evolved UID through the actual browser; draft never mutates PG.
  const trainingRead=async()=>{const q=await page.request.get(origin+'/api/v1/pokemon-training/current');assert.equal(q.status(),200);return q.json();};
  await page.locator('#training-pokemon').selectOption('1');
  const trainBefore=await trainingRead(),trainedBefore=trainBefore.pokemon.find(p=>p.uid===1);
  assert.equal(trainedBefore.budget,30);assert.ok(trainedBefore.remaining>=2);
  await page.locator('[data-training-plus="attack"]').click();
  await page.locator('[data-training-plus="hp"]').click();
  assert.equal((await trainingRead()).revision,trainBefore.revision);
  await page.locator('#training-cancel').click();
  assert.equal(await page.locator('#training-save').isDisabled(),true);
  await page.locator('[data-training-plus="attack"]').click();
  await page.locator('[data-training-plus="hp"]').click();
  await responseFor(page,'/api/v1/pokemon-training/train',()=>page.locator('#training-save').click());
  await page.getByText('Distribuição confirmada.',{exact:true}).waitFor();
  const trained=await trainingRead(),trainedMember=trained.pokemon.find(p=>p.uid===1);
  assert.equal(trained.revision,trainBefore.revision+1);
  assert.deepEqual(trainedMember.manual,{...trainedBefore.manual,attack:trainedBefore.manual.attack+1,hp:trainedBefore.manual.hp+1});
  assert.deepEqual(trained.pokemon.filter(p=>p.uid!==1),trainBefore.pokemon.filter(p=>p.uid!==1));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#training-pokemon').selectOption('1');
  assert.equal((await trainingRead()).pokemon.find(p=>p.uid===1).remaining,trainedMember.remaining);
  page.once('dialog',d=>d.dismiss());await page.locator('#training-reset').click();
  assert.equal((await trainingRead()).revision,trained.revision);
  page.once('dialog',d=>d.accept());
  await responseFor(page,'/api/v1/pokemon-training/train',()=>page.locator('#training-reset').click());
  await page.getByText('Pontos redistribuídos.',{exact:true}).waitFor();
  const redistributed=await trainingRead();assert.equal(redistributed.revision,trained.revision+1);
  assert.equal(redistributed.pokemon.find(p=>p.uid===1).remaining,30);
  assert.equal(redistributed.pokemon.find(p=>p.uid===1).spent,0);

  // Rank upgrades use the real evolved UID and only equipped offensive moves.
  await page.locator('#moves-pokemon').selectOption('1');
  const rankBefore=await moveRead(),rankMember=rankBefore.pokemon.find(p=>p.uid===1);
  assert.equal(rankMember.skillPoints,3);assert.equal(rankMember.remaining,3);
  const rankButton=page.locator('[data-move-rank="scratch"]');
  assert.equal(await rankButton.isEnabled(),true);
  assert.equal(await page.locator('[data-move-rank="growl"]').count(),0);
  const rankArgs={actionId:'browser-rank-invalid-0001',expectedRevision:rankBefore.revision,pokemonUid:1,moveName:'growl'};
  assert.equal((await page.request.post(origin+'/api/v1/moves/upgrade',{data:rankArgs,headers:{Origin:origin}})).status(),409);
  assert.equal((await page.request.post(origin+'/api/v1/moves/upgrade',{data:{...rankArgs,moveName:'scratch',rank:10},headers:{Origin:origin}})).status(),400);
  page.once('dialog',d=>d.dismiss());await rankButton.click();
  assert.equal((await moveRead()).revision,rankBefore.revision);
  page.once('dialog',d=>d.accept());
  await responseFor(page,'/api/v1/moves/upgrade',()=>rankButton.click());
  await page.getByText('Golpe aprimorado.',{exact:true}).waitFor();
  const rankAfter=await moveRead();
  assert.equal(rankAfter.revision,rankBefore.revision+1);
  assert.equal(rankAfter.pokemon.find(p=>p.uid===1).ranks.scratch,1);
  assert.equal(rankAfter.pokemon.find(p=>p.uid===1).remaining,2);
  assert.deepEqual(rankAfter.pokemon.filter(p=>p.uid!==1),rankBefore.pokemon.filter(p=>p.uid!==1));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#moves-pokemon').selectOption('1');
  assert.equal((await moveRead()).pokemon.find(p=>p.uid===1).ranks.scratch,1);

  // Pokédex is read-only, reflects actual account discovery and evolution.
  const dexResponse=await page.request.get(origin+'/api/v1/pokedex/current');
  assert.equal(dexResponse.status(),200);
  const dex=await dexResponse.json();
  assert.equal(dex.entries.length,151);
  assert.equal(dex.entries.find(e=>e.id===4).status,'caught');
  assert.equal(dex.entries.find(e=>e.id===5).status,'caught');
  assert.deepEqual(dex.entries.find(e=>e.id===150),{id:150,status:'unknown'});
  assert.ok(!dex.details.some(e=>e.id===150));
  await page.locator('#pokedex-search').fill('Charmeleon');
  assert.equal(await page.locator('#pokedex-grid button').count(),1);
  assert.equal(await page.locator('[data-dex-id="5"] img').getAttribute('src'),'/assets/pokemon-gifs/poke_5.gif');
  assert.equal(await page.locator('#pokedex-progress').evaluate(el=>el.value),dex.caught);
  await page.locator('[data-dex-id="5"]').click();
  await page.locator('#pokedex-dialog[open]').waitFor();
  assert.match(await page.locator('#pokedex-detail-name').textContent(),/Charmeleon/);
  await page.locator('#pokedex-close').click();
  await page.locator('#pokedex-search').fill('150');
  assert.equal(await page.locator('[data-dex-id="150"]').isDisabled(),true);
  assert.equal(await page.locator('[data-dex-id="150"] img').count(),0);
  assert.equal(await page.locator('[data-dex-id="150"] .dex-placeholder').textContent(),'?');
  assert.ok(!(await page.locator('[data-dex-id="150"]').textContent()).includes('Mewtwo'));
  await page.locator('#pokedex-search').fill('zz-no-result');
  assert.equal(await page.locator('#pokedex-empty').isVisible(),true);
  await page.locator('#pokedex-search').fill('');
  assert.equal((await moveRead()).revision,dex.revision);

  // Inventory browser journey: only the disposable test fixture acquires gear.
  const inventoryRead=async()=>{const q=await page.request.get(origin+'/api/v1/inventory/current');assert.equal(q.status(),200);return q.json();};
  const invBefore=await inventoryRead();
  assert.equal(invBefore.bag.capacity,10);assert.ok(Array.isArray(invBefore.equipment));
  const seededSave=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[registeredId])).rows[0].state;
  const seededRaw=JSON.parse(seededSave.journal.raw);
  seededRaw.inventory={version:1,gear:[{"id":"gear-cap","source":"drop","templateId":"cap","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"hp":2}},{"id":"gear-visor","source":"drop","templateId":"visor","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"speed":2}}],extraBagSlots:2};
  seededRaw.wins=Math.max(4,seededRaw.wins);
  seededSave.journal.raw=JSON.stringify(seededRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[registeredId,JSON.stringify(seededSave)]);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-inventory-item="gear-cap"]').waitFor();
  const inv=await inventoryRead();assert.equal(inv.bag.capacity,12);
  assert.equal(await page.locator('#inventory-bag > .inv-tile').count(),12);
  assert.equal(await page.locator('#inventory-bag [data-empty="true"]').count(),inv.bag.available);
  assert.equal(await page.locator('#inventory-slots [data-equipment-slot]').count(),9);
  assert.equal(await page.locator('#inventory-capacity-track').evaluate(el=>el.value),inv.bag.used);
  await page.locator('[data-bag-gear="gear-cap"]').click();
  await page.locator('#inventory-dialog[open]').waitFor();
  assert.match(await page.locator('#inventory-detail-info').textContent(),/Comum.*Nível exigido: 1/);
  await page.keyboard.press('Escape');
  await page.locator('#inventory-dialog').waitFor({state:'hidden'});
  const stack=inv.bag.stacks[0];if(stack){await page.locator('[data-bag-stack="'+stack.id+'"]').click();await page.locator('#inventory-dialog[open]').waitFor();assert.match(await page.locator('#inventory-detail-info').textContent(),/Quantidade:/);await page.locator('#inventory-close').click();}
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#inventory-bag').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.ok(await page.locator('#inventory-slots').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.ok(await page.locator('#online-roster').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.ok(await page.locator('#pokedex-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.setViewportSize({width:1365,height:768});
  assert.equal((await inventoryRead()).revision,inv.revision);
  const loadoutArgs={actionId:'browser-loadout-invalid-0001',expectedRevision:inv.revision,command:{kind:'equipment',slot:'hat',itemId:'gloves'}};
  assert.equal((await page.request.post(origin+'/api/v1/inventory/loadout',{data:loadoutArgs,headers:{Origin:origin}})).status(),409);
  assert.equal((await page.request.post(origin+'/api/v1/inventory/loadout',{data:{...loadoutArgs,command:{kind:'title',titleId:'gym-leader'}},headers:{Origin:origin}})).status(),400);
  assert.equal((await page.request.post(origin+'/api/v1/inventory/loadout',{data:loadoutArgs,headers:{Origin:'https://attacker.example'}})).ok(),false);
  await page.locator('[data-inventory-item="gear-cap"]').click();
  await page.locator('#inventory-dialog[open]').waitFor();
  await page.locator('#inventory-close').click();
  assert.equal((await inventoryRead()).revision,inv.revision);
  await page.locator('[data-inventory-item="gear-cap"]').click();
  await responseFor(page,'/api/v1/inventory/loadout',()=>page.locator('#inventory-item-action').click());
  await page.getByText('Equipamento ou título atualizado.',{exact:true}).waitFor();
  const equipped=await inventoryRead();assert.equal(equipped.revision,inv.revision+1);
  assert.equal(await page.locator('[data-bag-gear="gear-cap"]').count(),0);
  assert.equal(await page.locator('[data-equipment-slot="hat"] .inv-equipped').count(),1);
  assert.equal(await page.locator('#inventory-bag [data-empty="true"]').count(),equipped.bag.available);
  assert.equal(equipped.totals.hp,inv.totals.hp+2);assert.equal(equipped.equipment.find(e=>e.id==='gear-cap').equipped,true);
  await page.locator('#inventory-filter').selectOption('equipped');
  assert.equal(await page.locator('[data-inventory-item]').count(),1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-inventory-item="gear-cap"]').waitFor();
  assert.equal((await inventoryRead()).equipment.find(e=>e.id==='gear-cap').equipped,true);
  await page.locator('[data-inventory-item="gear-cap"]').click();
  await responseFor(page,'/api/v1/inventory/loadout',()=>page.locator('#inventory-item-action').click());
  await page.getByText('Equipamento ou título atualizado.',{exact:true}).waitFor();
  assert.equal((await inventoryRead()).equipment.find(e=>e.id==='gear-cap').equipped,false);
  page.once('dialog',d=>d.accept());
  await responseFor(page,'/api/v1/inventory/loadout',()=>page.locator('[data-inventory-title="veterano"]').click());
  await page.getByText('Equipamento ou título atualizado.',{exact:true}).waitFor();
  const finalInv=await inventoryRead();assert.equal(finalInv.titles.find(t=>t.id==='veterano').active,true);
  assert.ok(!finalInv.titles.some(t=>t.id==='gym-leader'));
  assert.equal(finalInv.badges.length,8);
  assert.deepEqual(finalInv.bag,inv.bag);
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
  assert.equal((await page.request.get(origin+'/api/v1/inventory/current')).status(),401);
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
  assert.match(await page.locator('#online-roster').textContent(),/Charmeleon · Nível 16/);
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
