/** Manual local-only rehearsal. Requires a freshly migrated disposable
 * kanto_mail_drill database and the canonical CORE_BUNDLE_PATH.
 * Secrets are not printed, written to files, or passed to the API subprocess.
 */
import pg from 'pg';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {readIsolatedMailDrillConfig,restrictDrillTransport} from '../src/isolatedMailDrill.mjs';
import {processOneAccountMail} from '../src/accountMailOutbox.mjs';
import {runInboxJourney} from '../src/inboxMailJourney.mjs';

const env=process.env;
let child,pool,terminal;
const origin='https://127.0.0.1:43223';
let step='configuração';
try{
  if(env.CI||env.RAILWAY_ENVIRONMENT_ID||env.NODE_ENV!=='test'||
    env.MAIL_DRILL_CONFIRM!=='SEND_ONE_REAL_MESSAGE'||!process.stdin.isTTY||
    !process.stdout.isTTY)throw new Error('manual local only');
  if(env.MAIL_FROM&&env.MAIL_FROM!=='onboarding@resend.dev')
    throw new Error('test sender only');
  const silent=new Writable({write(_chunk,_encoding,callback){callback();}});
  terminal=createInterface({input:process.stdin,output:silent,terminal:true});
  async function ask(prompt){
    process.stdout.write(prompt+' ');
    try{return (await terminal.question('')).trim();}
    finally{process.stdout.write('\n');}
  }
  const recipient=await ask('E-mail da sua própria conta Resend (entrada oculta):');
  const providerKey=await ask('Chave de envio Resend (entrada oculta):');
  const key= randomBytes(32).toString('base64');
  const configEnv={...env,APP_ORIGIN:origin,MAIL_DRILL_RECIPIENT:recipient,
    RESEND_API_KEY:providerKey,MAIL_FROM:'onboarding@resend.dev',
    ACCOUNT_MAIL_MODE:'outbox',ONLINE_REGISTRATION_ENABLED:'true',
    ACCOUNT_MAIL_ACTIVE_KEY_ID:'drill',
    ACCOUNT_MAIL_KEYRING_JSON:JSON.stringify({drill:key}),
    AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex')};
  const config=readIsolatedMailDrillConfig(configEnv);
  if(new URL(config.connectionString).hostname!=='127.0.0.1')
    throw new Error('explicit IPv4 loopback required');
  pool=new pg.Pool({connectionString:config.connectionString,
    max:2,connectionTimeoutMillis:5000,statement_timeout:10000});
  const inventory=(await pool.query(`SELECT current_database() AS db,
    inet_server_addr()::text AS addr,
    (SELECT count(*)::int FROM game_accounts) AS accounts,
    (SELECT count(*)::int FROM game_account_mail_outbox) AS mails,
    (SELECT count(*)::int FROM game_schema_migrations) AS migrations`)).rows[0];
  if(inventory.db!=='kanto_mail_drill'||inventory.accounts!==0||
    inventory.mails!==0||inventory.migrations!==25)
    throw new Error('fresh migrated dedicated database required');
  step='inicialização da API local';
  // Do not inherit the provider key or unrelated secrets into the child.
  const childEnv=Object.fromEntries(Object.entries(env).filter(([name])=>
    /^(PATH|Path|SystemRoot|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|CORE_BUNDLE_PATH)$/i.test(name)));
  for(const name of ['DATABASE_URL','APP_ORIGIN','NODE_ENV',
    'ONLINE_REGISTRATION_ENABLED','ACCOUNT_MAIL_MODE','ACCOUNT_MAIL_ACTIVE_KEY_ID',
    'ACCOUNT_MAIL_KEYRING_JSON','AUTH_RATE_LIMIT_SECRET'])
    childEnv[name]=configEnv[name];
  childEnv.PORT='0';
  childEnv.ACCOUNT_DRILL_LOOPBACK_ONLY='true';
  child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url),env:childEnv,
    stdio:['ignore','pipe','ignore']});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('API startup timeout')),15000);
    const finish=(error,value)=>{clearTimeout(timer);error?reject(error):resolve(value);};
    let buffer='';
    child.stdout.on('data',chunk=>{
      buffer=(buffer+chunk.toString()).slice(-4096);
      const m=/ONLINE-01 API na porta (\d+); registro habilitado/.exec(buffer);
      if(m)finish(null,Number(m[1]));
    });
    child.once('error',e=>finish(e));
    child.once('exit',()=>finish(new Error('API exited')));
  });
  async function request(path,body,cookie){
    const response=await fetch('http://127.0.0.1:'+port+path,{
      method:body?'POST':'GET',redirect:'error',
      headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),
        ...(cookie?{Cookie:cookie}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    return {status:response.status,headers:response.headers,data:await response.json()};
  }
  const health=await request('/health');
  if(health.status!==200)throw new Error('database health failed');
  async function sendOne(purpose){
    step='envio '+purpose;
    const count=(await pool.query('SELECT count(*)::int AS total FROM game_accounts')).rows[0].total;
    if(count!==1)throw new Error('unexpected accounts');
    const pending=(await pool.query(`SELECT purpose FROM game_account_mail_outbox
      WHERE status='pending'`)).rows;
    if(pending.length!==1||pending[0].purpose!==purpose)throw new Error('unexpected pending mail');
    const approval=await ask('Digite ENVIAR para autorizar uma única mensagem '+purpose+':');
    if(approval!=='ENVIAR')throw new Error('not confirmed');
    const result=await processOneAccountMail(pool,{
      keyring:config.keyring,from:config.from,providerKey:config.providerKey,
      send:restrictDrillTransport(config)});
    if(result.status!=='delivered')throw new Error('provider not accepted');
    const receipt=(await pool.query(`SELECT purpose,provider_receipt,delivered_at
      FROM game_account_mail_outbox WHERE id=$1`,[result.id])).rows[0];
    if(receipt?.purpose!==purpose||!/^[A-Za-z0-9_.:-]{6,128}$/.test(receipt.provider_receipt??''))
      throw new Error('unexpected receipt');
    return {providerMessageId:receipt.provider_receipt,
      acknowledgedAtUtc:new Date(receipt.delivered_at).toISOString()};
  }
  step='jornada de conta';
  const report=await runInboxJourney({request,sendOne,recipient:config.recipient,origin,
    password:randomBytes(32).toString('base64url'),
    replacement:randomBytes(32).toString('base64url'),
    progress:(label,receipt)=>console.log(JSON.stringify({status:label,...receipt})),
    readLink:async purpose=>{
      step='link recebido '+purpose;
      return ask('Copie o endereço completo do link recebido por e-mail (não abra; entrada oculta):');
    }});
  console.log(JSON.stringify(report,null,2));
}catch{
  console.error('Ensaio interrompido na etapa: '+step+'. Nenhum segredo será exibido. Não repita no mesmo banco; investigue e recrie somente a base local de ensaio.');
  process.exitCode=1;
}finally{
  terminal?.close();
  if(child&&child.exitCode===null&&child.signalCode===null){
    const done=once(child,'exit').catch(()=>{});
    child.kill();
    await Promise.race([done,new Promise(resolve=>setTimeout(resolve,3000))]);
  }
  await pool?.end();
}
