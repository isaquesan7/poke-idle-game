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
  const api=launch(process.execPath,['services/api/src/server.mjs'],{
    NODE_ENV:'test',ONLINE_REGISTRATION_ENABLED:'true',
    ACCOUNT_MAIL_MODE:'off',PORT:String(apiPort),APP_ORIGIN:origin
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
