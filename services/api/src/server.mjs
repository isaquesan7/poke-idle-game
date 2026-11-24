/** ONLINE-01: API isolada e NÃO conectada ao /play.
 * Ativação de cadastro requer DATABASE_URL, APP_ORIGIN e
 * ONLINE_REGISTRATION_ENABLED=true. Nunca importa saves locais.
 */
import {createServer} from 'node:http';
import {createProxyReceiver} from './proxyKeyring.mjs';
import {createHash} from 'node:crypto';
import {enqueueAccountMail,mailKeyring} from './accountMailOutbox.mjs';
import pg from 'pg';
import {
  normalizeEmail,validatePassword,validateTrainerName,
  hashPassword,verifyPassword,newSessionToken,tokenDigest,
  sessionCookie,parseSessionCookie
} from './auth.mjs';
import {throttle,requesterIp,issueVerification,consumeVerification} from './authSecurity.mjs';
import {issuePasswordReset,consumePasswordReset} from './passwordReset.mjs';
import {deliverAccountEmail} from './mailer.mjs';
import {regionalPaths,loadRegionalTestKey,regionalExpansionEnabled,readRegionalEncounter,runRegionalCommand} from './regionalHttp.mjs';
import {expeditionHttpEnabled,readExpedition} from './expeditionHttp.mjs';
import {applyExpeditionCommand} from './expeditionWriter.mjs';
import {shopHttpEnabled,readShop} from './shopHttp.mjs';
import {purchaseShopBall} from './shopWriter.mjs';
import {movesHttpEnabled,readMoves} from './movesHttp.mjs';
import {equipPokemonMoves} from './pokemonMoveEquipment.mjs';
import {createFirstAdventure} from './initialAdventure.mjs';
import {applyTrainerInvestment} from './trainerInvestment.mjs';
import {exportAccountData} from './accountPrivacy.mjs';
import {setCollectionTeam} from './collectionTeam.mjs';
import {reserveNextGym} from './gymReservation.mjs';
import {gymPortalEnabled,readCurrentGym} from './gymPortalState.mjs';
import {startReservedGymTurnSession} from './gymTurnSession.mjs';
import {loadGymEntropyKeyringFromEnv} from './gymEntropyKeyring.mjs';
import {
  applyGymTurnWithKeyring,certifyGymWithKeyring,settleGymWithKeyring
} from './gymKeyedOperations.mjs';

const port=Number(process.env.PORT??3001);
const connectionString=process.env.DATABASE_URL;
const appOrigin=process.env.APP_ORIGIN;
if(!connectionString||!appOrigin)throw new Error('DATABASE_URL e APP_ORIGIN são obrigatórios.');
const pool=new pg.Pool({connectionString,max:12,connectionTimeoutMillis:5000,
  idleTimeoutMillis:30000});
// Registration is intentionally a CI-only harness until email verification,
// distributed rate limiting, anti-abuse and game-authoritative saves land.
// Misconfiguring one Railway env variable cannot open public accounts.
const enabled=process.env.NODE_ENV==='test' &&
  process.env.ONLINE_REGISTRATION_ENABLED==='true';
// Test-only signed quota mode; never enabled by a production environment variable.
const signedQuotaTest=enabled&&process.env.ONLINE_SIGNED_QUOTA_TEST_ONLY==='true';
const signedRoutes=new Set(['/api/v1/auth/register','/api/v1/auth/verify',
  '/api/v1/auth/login','/api/v1/auth/request-reset','/api/v1/auth/confirm-reset']);
let signedQuotaReceiver;
if(signedQuotaTest){
  const db=new URL(connectionString);
  const raw=process.env.ONLINE_SIGNED_QUOTA_TEST_KEY??'';
  if(db.protocol!=='postgresql:'||db.hostname!=='127.0.0.1'||db.port!=='55432'||
    db.pathname!=='/kanto_ci'||db.username!=='kanto_ci'||
    process.env.ACCOUNT_DRILL_LOOPBACK_ONLY!=='true'||!/^[a-f0-9]{64}$/.test(raw))
    throw new Error('Signed quota harness requires disposable CI and loopback');
  signedQuotaReceiver=createProxyReceiver({activeHex:raw});
}
// Prepare the reviewed receiver configuration without changing the production
// registration gate. No request or migration is enabled by this mode.
const receiverMode=process.env.ONLINE_SIGNED_QUOTA_MODE;
if(receiverMode!==undefined&&receiverMode!=='reviewed')throw new Error('Invalid quota receiver mode');
if(receiverMode==='reviewed'){
  if(process.env.NODE_ENV!=='production'||signedQuotaTest||
    ['GATEWAY_SIGNING_HEX','GATEWAY_SUBJECT_HEX','ONLINE_SIGNED_QUOTA_TEST_KEY'].some(k=>process.env[k]!==undefined))
    throw new Error('Reviewed receiver requires dedicated API configuration');
  const previousHex=process.env.ONLINE_GATEWAY_RECEIVER_PREVIOUS_HEX;
  const rawCutover=process.env.ONLINE_GATEWAY_RECEIVER_CUTOVER_MS;
  if(rawCutover!==undefined&&!/^\d{1,16}$/.test(rawCutover))throw new Error('Invalid receiver cutover');
  signedQuotaReceiver=createProxyReceiver({activeHex:process.env.ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX,
    ...(previousHex!==undefined?{previousHex}:{}),...(rawCutover!==undefined?{cutoverMs:Number(rawCutover)}:{})});
}
const signedQuotaRequests=new WeakMap();
function quotaSubject(req){return signedQuotaRequests.get(req)?.subject??requesterIp(req);}
// __Host- cookies require Secure in every environment, including CI loopback.
// Chromium may otherwise discard a seemingly successful login session.
const isSecure=true;
const mailMode=process.env.ACCOUNT_MAIL_MODE??'off';
if(!['off','resend','outbox'].includes(mailMode))
  throw new Error('ACCOUNT_MAIL_MODE inválido');
if(mailMode==='outbox'&&!enabled)
  throw new Error('Outbox de contas só pode ser usado no harness de teste');
const outboxKeyring=mailMode==='outbox'?mailKeyring({
  activeId:process.env.ACCOUNT_MAIL_ACTIVE_KEY_ID,
  keys:JSON.parse(process.env.ACCOUNT_MAIL_KEYRING_JSON??'{}')
}):null;
const mailConfigured=mailMode==='resend';
if(mailConfigured&&(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM))
  throw new Error('Configure RESEND_API_KEY e MAIL_FROM');
async function deliver({to,purpose,token,idempotencyKey}){
  if(!mailConfigured)return false;
  await deliverAccountEmail({to,purpose,token,
    origin:appOrigin,key:process.env.RESEND_API_KEY,
    from:process.env.MAIL_FROM,idempotencyKey});
  return true;
}

const throttleSecret=process.env.AUTH_RATE_LIMIT_SECRET;
if(enabled&&(!throttleSecret||throttleSecret.length<32))
  throw new Error('AUTH_RATE_LIMIT_SECRET precisa ter ao menos 32 caracteres');
async function enforceThrottle(req,res,{scope,identifier,limit}){
  const quota=await throttle(pool,{scope,identifier,limit,secret:throttleSecret});
  if(quota.allowed)return true;
  json(res,429,{error:'Muitas tentativas. Tente novamente mais tarde.'},
    {'Retry-After':'900'});
  return false;
}
const json=(res,status,body,headers={})=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(JSON.stringify(body));
};
async function readJsonBytes(req){
  if(!req.headers['content-type']?.startsWith('application/json'))
    throw new Error('Esperado application/json');
  let size=0;const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>16384)throw new Error('Dados excederam o tamanho máximo.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req){
  const bytes=signedQuotaRequests.get(req)?.body??await readJsonBytes(req);
  const input=JSON.parse(bytes.toString('utf8'));
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new Error('Objeto JSON inválido.');
  return input;
}
function requireSameOrigin(req){
  // Mesmo-origin, Secure e SameSite: evita writes cross-site involuntários.
  if(req.headers.origin!==appOrigin)throw new Error('Origem não autorizada.');
}
function credentialCookie(req){
  const token=parseSessionCookie(req.headers.cookie);
  return token?tokenDigest(token):null;
}
async function accountForSession(req){
  const digest=credentialCookie(req);
  if(!digest)return null;
  const result=await pool.query(
    `SELECT a.id,a.email,a.email_verified_at,p.trainer_name FROM game_auth_sessions s
      JOIN game_accounts a ON a.id=s.account_id
      JOIN game_profiles p ON p.account_id=a.id
     WHERE s.token_sha256=$1 AND s.revoked_at IS NULL
       AND s.expires_at>now() AND a.disabled_at IS NULL LIMIT 1`,[digest]);
  return result.rows[0]??null;
}
function rejectCors(res){
  // Não permitir CORS. A futura página / consumirá /api no MESMO host.
  res.setHeader('Vary','Origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
}
const server=createServer(async(req,res)=>{
  rejectCors(res);
  const pathname=new URL(req.url??'/', 'http://internal').pathname;
  try{
    if(pathname==='/health'&&req.method==='GET'){
      await pool.query('SELECT 1');return json(res,200,{ok:true});
    }
    if(pathname==='/api/v1/status'&&req.method==='GET')
      return json(res,200,{stage:'foundation',registrationEnabled:enabled,
        savesEnabled:false});
    if(pathname==='/api/v1/me'&&req.method==='GET'){
      const account=await accountForSession(req);
      return account?json(res,200,{id:account.id,email:account.email,
        trainerName:account.trainer_name}):json(res,401,{error:'Não autenticado'});
    }
    if(!enabled&&pathname.startsWith('/api/v1/auth/'))
      return json(res,503,{error:'Cadastro e login em preparação'});
    if(signedQuotaReceiver&&req.method==='POST'&&signedRoutes.has(pathname)){
      requireSameOrigin(req);
      if(req.url!==pathname)return json(res,400,{error:'Requisição inválida'});
      const assertions=[];
      for(let i=0;i<req.rawHeaders.length;i+=2)
        if(req.rawHeaders[i].toLowerCase()==='x-kanto-proxy-identity')assertions.push(req.rawHeaders[i+1]);
      if(assertions.length!==1||String(req.headers.connection??'').split(',').some(v=>v.trim().toLowerCase()==='x-kanto-proxy-identity'))
        return json(res,403,{error:'Identidade de proxy inválida'});
      const body=await readJsonBytes(req);
      let verified;
      try{
        verified=await signedQuotaReceiver.consume(pool,{assertion:assertions[0],
          method:req.method,path:pathname,body});
      }catch{return json(res,503,{error:'Verificação temporariamente indisponível'});}
      if(!verified)return json(res,403,{error:'Identidade de proxy inválida'});
      signedQuotaRequests.set(req,{subject:verified.subject,body});
    }
    if(pathname==='/api/v1/auth/register'&&req.method==='POST'){
      requireSameOrigin(req);
      const {email,password,trainerName}=await readJson(req);
      const cleanEmail=normalizeEmail(email),cleanName=validateTrainerName(trainerName);
      validatePassword(password);
      if(!await enforceThrottle(req,res,{scope:'register-ip',
        identifier:quotaSubject(req),limit:10}))return;
      if(!await enforceThrottle(req,res,{scope:'register-email',
        identifier:cleanEmail,limit:4}))return;
      const hash=await hashPassword(password);
      const client=await pool.connect();
      let userId,verification;
      try{
        await client.query('BEGIN');
        const account=await client.query(
          'INSERT INTO game_accounts(email,password_hash) VALUES($1,$2) RETURNING id',
          [cleanEmail,hash]);
        userId=account.rows[0].id;
        await client.query(
          'INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',
          [userId,cleanName]);
        verification=await issueVerification(client,userId);
        if(outboxKeyring){
          const verifiedRow=await client.query(`SELECT expires_at FROM game_email_verifications
            WHERE account_id=$1 AND token_sha256=$2`,
            [userId,createHash('sha256').update(verification).digest()]);
          await enqueueAccountMail(client,outboxKeyring,{
            accountId:userId,idempotencyKey:'verify/'+userId,
            purpose:'verify',to:cleanEmail,token:verification,origin:appOrigin,
            expiresAt:verifiedRow.rows[0].expires_at
          });
        }
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      finally{client.release();}
      // Mail transport is optional in tests. The production auth gate remains
      // hard-disabled until verified sender, recovery UI and backups exist.
      const mailed=outboxKeyring?true:await deliver({to:cleanEmail,
        purpose:'verify',token:verification,idempotencyKey:'verify/'+userId});
      return json(res,201,{id:userId,trainerName:cleanName,
        ...(mailed?{}:{verificationToken:verification})});
    }
    if(pathname==='/api/v1/auth/verify'&&req.method==='POST'){
      requireSameOrigin(req);
      if(!await enforceThrottle(req,res,{scope:'verify-ip',
        identifier:quotaSubject(req),limit:20}))return;
      const {token}=await readJson(req);
      const valid=await consumeVerification(pool,token);
      return valid?json(res,200,{verified:true}):
        json(res,400,{error:'Link de verificação inválido ou expirado.'});
    }
    if(pathname==='/api/v1/auth/request-reset'&&req.method==='POST'){
      requireSameOrigin(req);
      const {email}=await readJson(req);
      const cleanEmail=normalizeEmail(email);
      if(!await enforceThrottle(req,res,{scope:'reset-ip',
        identifier:quotaSubject(req),limit:10}))return;
      if(!await enforceThrottle(req,res,{scope:'reset-email',
        identifier:cleanEmail,limit:3}))return;
      const token=await issuePasswordReset(pool,cleanEmail,outboxKeyring?{
        enqueue:async(client,{accountId,token,tokenId,expiresAt})=>
          enqueueAccountMail(client,outboxKeyring,{
            accountId,idempotencyKey:'reset/'+tokenId,
            purpose:'reset',to:cleanEmail,token,origin:appOrigin,expiresAt
          })
      }:undefined);
      if(token&&!outboxKeyring)try{
        await deliver({to:cleanEmail,purpose:'reset',token,
          idempotencyKey:'reset/'+createHash('sha256').update(token).digest('hex').slice(0,32)});
      }catch{
        // Never reveal whether the account exists by the provider status.
        // The next stage adds durable outbox retries; no credentials or token logged.
        console.error('Account mail transport unavailable');
      }
      // No email-account enumeration. Tokens returned ONLY in test harness
      // when mail adapter is disabled, never in any production response.
      return json(res,200,{accepted:true,
        ...(mailMode==='off'&&process.env.NODE_ENV==='test'&&token?
          {testResetToken:token}:{})});
    }
    if(pathname==='/api/v1/auth/confirm-reset'&&req.method==='POST'){
      requireSameOrigin(req);
      if(!await enforceThrottle(req,res,{scope:'reset-confirm-ip',
        identifier:quotaSubject(req),limit:20}))return;
      const {token,password}=await readJson(req);
      validatePassword(password);
      const applied=await consumePasswordReset(pool,token,password);
      return applied?json(res,200,{passwordChanged:true}):
        json(res,400,{error:'Link de redefinição inválido ou expirado.'});
    }
    if(pathname==='/api/v1/auth/login'&&req.method==='POST'){
      requireSameOrigin(req);
      const {email,password}=await readJson(req);
      const cleanEmail=normalizeEmail(email);
      if(typeof password!=='string'||password.length>128)
        return json(res,401,{error:'Credenciais inválidas'});
      if(!await enforceThrottle(req,res,{scope:'login-ip',
        identifier:quotaSubject(req),limit:30}))return;
      if(!await enforceThrottle(req,res,{scope:'login-email',
        identifier:cleanEmail,limit:6}))return;
      const users=await pool.query(
        'SELECT id,password_hash,email_verified_at FROM game_accounts WHERE email=$1 AND disabled_at IS NULL',
        [cleanEmail]);
      const user=users.rows[0];
      if(!user||!await verifyPassword(password,user.password_hash))
        return json(res,401,{error:'Credenciais inválidas'});
      if(!user.email_verified_at)
        return json(res,403,{error:'Verifique seu e-mail antes de entrar.'});
      const token=newSessionToken();
      await pool.query(
        `INSERT INTO game_auth_sessions(account_id,token_sha256,expires_at)
         VALUES($1,$2,now()+interval '7 days')`,[user.id,tokenDigest(token)]);
      return json(res,200,{authenticated:true},{
        'Set-Cookie':sessionCookie(token,{secure:isSecure})});
    }
    if(pathname==='/api/v1/auth/logout'&&req.method==='POST'){
      requireSameOrigin(req);
      const digest=credentialCookie(req);
      if(digest)await pool.query(
        'UPDATE game_auth_sessions SET revoked_at=now() WHERE token_sha256=$1',
        [digest]);
      return json(res,200,{authenticated:false},{
        'Set-Cookie':sessionCookie('',{secure:isSecure,maxAge:0})});
    }
    if(pathname==='/api/v1/account/export'&&req.method==='POST'){
      // ONLINE-01C-23E2: CI-only, same-origin, reauthenticated owner export.
      // No public account data route until LGPD/security review is complete.
      if(!enabled)return json(res,503,{error:'Exportação em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)
        return json(res,403,{error:'Verifique seu e-mail'});
      if(!await enforceThrottle(req,res,{scope:'privacy-export-account',
        identifier:account.id,limit:3}))return;
      const data=await readJson(req);
      if(Object.keys(data).join(',')!=='password')
        return json(res,400,{error:'Requisição inválida'});
      if(typeof data.password!=='string'||data.password.length>128)
        return json(res,401,{error:'Credenciais inválidas'});
      const credentials=await pool.query(
        'SELECT password_hash FROM game_accounts WHERE id=$1 AND disabled_at IS NULL',
        [account.id]);
      if(!credentials.rowCount||
          !await verifyPassword(data.password,credentials.rows[0].password_hash))
        return json(res,401,{error:'Credenciais inválidas'});
      const exported=await exportAccountData(pool,{accountId:account.id});
      if(!exported)return json(res,404,{error:'Conta indisponível'});
      return json(res,200,exported,{'Content-Disposition':
        'attachment; filename="poke-account-export.json"',
        'X-Robots-Tag':'noindex, nofollow'});
    }
    if(pathname==='/api/v1/adventure/start'&&req.method==='POST'){
      // Test-only rollout. NEVER accept a whole save or player-specified
      // wallet, HP, badges, XP, trainer identity or a client clock.
      if(!enabled)return json(res,503,{error:'Aventura online em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)
        return json(res,403,{error:'Verifique seu e-mail antes de jogar'});
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!=='starterId')
        return json(res,400,{error:'Envie somente o inicial selecionado'});
      const outcome=await createFirstAdventure(pool,{
        accountId:account.id,trainerName:account.trainer_name,
        starterId:data.starterId,nowMs:Date.now()});
      if(outcome.status==='exists')
        return json(res,409,{error:'Aventura já iniciada'});
      return json(res,201,{created:true,revision:0,starterId:data.starterId});
    }
    if(pathname==='/api/v1/trainer/invest'&&req.method==='POST'){
      if(!enabled)return json(res,503,{error:'Aventura online em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)return json(res,403,{error:'E-mail não verificado'});
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!=='actionId,expectedRevision,stat')
        return json(res,400,{error:'Ação inválida'});
      const result=await applyTrainerInvestment(pool,{
        accountId:account.id,actionId:data.actionId,
        expectedRevision:data.expectedRevision,stat:data.stat
      });
      const status=result.status==='ok'?200:
        result.status==='missing'?404:result.status==='invalid'?400:409;
      return json(res,status,result.status==='ok'?result:{error:result.status});
    }
    if(['/api/v1/moves/current','/api/v1/moves/equip'].includes(pathname)){
      if(!enabled||!movesHttpEnabled())return json(res,503,{error:'Golpes online em preparação'});
      const read=pathname.endsWith('/current');
      if(req.method!==(read?'GET':'POST')||req.url!==pathname)return json(res,400,{error:'Requisição inválida'});
      if(!read)requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)return json(res,403,{error:'E-mail não verificado'});
      if(read){
        const result=await readMoves(pool,account.id);
        return json(res,result.status==='ok'?200:result.status==='missing-save'?404:409,result);
      }
      if(!await enforceThrottle(req,res,{scope:'moves-account',identifier:account.id,limit:60}))return;
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!=='actionId,expectedRevision,moveNames,pokemonUid')return json(res,400,{error:'Ação inválida'});
      const result=await equipPokemonMoves(pool,{accountId:account.id,...data});
      return json(res,['equipped','replay'].includes(result.status)?200:result.status==='invalid'?400:result.status==='missing-save'?404:409,result);
    }
    if(['/api/v1/shop/current','/api/v1/shop/purchase'].includes(pathname)){
      if(!enabled||!shopHttpEnabled())return json(res,503,{error:'Loja online em preparação'});
      const read=pathname.endsWith('/current');
      if(req.method!==(read?'GET':'POST')||req.url!==pathname)return json(res,400,{error:'Requisição inválida'});
      if(!read)requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)return json(res,403,{error:'E-mail não verificado'});
      if(read){
        const result=await readShop(pool,account.id);
        return json(res,result.status==='ok'?200:result.status==='missing-save'?404:409,result);
      }
      if(!await enforceThrottle(req,res,{scope:'shop-account',identifier:account.id,limit:60}))return;
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!=='actionId,ballId,expectedRevision,quantity')return json(res,400,{error:'Ação inválida'});
      const result=await purchaseShopBall(pool,{accountId:account.id,...data});
      return json(res,result.status==='purchased'?200:result.status==='invalid'?400:result.status==='missing-save'?404:409,result);
    }
    if(['/api/v1/expedition/current','/api/v1/expedition/start','/api/v1/expedition/claim','/api/v1/expedition/stop'].includes(pathname)){
      if(!enabled||!expeditionHttpEnabled())return json(res,503,{error:'Expedições online em preparação'});
      const kind=pathname.split('/').at(-1),read=kind==='current';
      if(req.method!==(read?'GET':'POST')||req.url!==pathname)return json(res,400,{error:'Requisição inválida'});
      if(!read)requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)return json(res,403,{error:'E-mail não verificado'});
      if(read){
        const result=await readExpedition(pool,account.id);
        return json(res,result.status==='ok'?200:result.status==='missing-save'?404:409,result);
      }
      if(!await enforceThrottle(req,res,{scope:'expedition-account',identifier:account.id,limit:60}))return;
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!==(kind==='start'?'actionId,expectedRevision,regionId':'actionId,expectedRevision'))return json(res,400,{error:'Ação inválida'});
      const result=await applyExpeditionCommand(pool,{accountId:account.id,kind,...data});
      return json(res,result.status==='applied'?200:result.status==='invalid'?400:result.status==='missing-save'?404:409,result);
    }
    if(pathname==='/api/v1/region/current'||regionalPaths.includes(pathname)){
      if(!enabled)return json(res,503,{error:'Regiões online em preparação'});
      const read=pathname==='/api/v1/region/current';
      if(req.method!==(read?'GET':'POST')||req.url!==pathname)
        return json(res,400,{error:'Requisição inválida'});
      if(!read)requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)return json(res,403,{error:'E-mail não verificado'});
      let key,expanded;
      try{key=loadRegionalTestKey();expanded=regionalExpansionEnabled();}catch{return json(res,503,{error:'Regiões online em preparação'});}
      if(read){
        const current=await readRegionalEncounter(pool,account.id,expanded);
        return json(res,current.status==='ok'?200:404,current);
      }
      if(!await enforceThrottle(req,res,{scope:'region-action-account',identifier:account.id,limit:300}))return;
      const result=await runRegionalCommand(pool,account.id,pathname.split('/').at(-1),await readJson(req),key,expanded);
      const ok=['reserved','started','applied','certified','paid','finished','replay'].includes(result.status);
      return json(res,ok?200:result.status==='invalid'?400:
        ['missing','missing-save'].includes(result.status)?404:409,result);
    }
    if(pathname==='/api/v1/collection/team'&&req.method==='POST'){
      // ONLINE-01C-23C5: authenticated CI-only Collection team writer.
      // The selected 1–3 real UIDs must already belong to this account.
      // During a Gym encounter, this action is blocked by the canonical
      // server writer, so a battle cannot silently change its frozen team.
      if(!enabled)return json(res,503,{error:'Coleção online em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)
        return json(res,403,{error:'E-mail não verificado'});
      if(!await enforceThrottle(req,res,{scope:'collection-team-account',
        identifier:account.id,limit:60}))return;
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!==
          'actionId,expectedRevision,teamUids')
        return json(res,400,{error:'Ação de Coleção inválida'});
      const result=await setCollectionTeam(pool,{
        accountId:account.id,actionId:data.actionId,
        expectedRevision:data.expectedRevision,teamUids:data.teamUids
      });
      const ok=['set','replay'].includes(result.status);
      const status=ok?200:result.status==='invalid'?400:
        ['missing','missing-save'].includes(result.status)?404:409;
      return json(res,status,ok?result:{error:result.status});
    }
    if(pathname==='/api/v1/gym/current'){
      if(!enabled||!gymPortalEnabled())return json(res,503,{error:'Ginásios online em preparação'});
      if(req.method!=='GET'||req.url!==pathname)return json(res,400,{error:'Requisição inválida'});
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)return json(res,403,{error:'E-mail não verificado'});
      try{loadGymEntropyKeyringFromEnv();}catch{return json(res,503,{error:'Ginásios online em preparação'});}
      const current=await readCurrentGym(pool,account.id);
      return json(res,current.status==='ok'?200:current.status==='missing-save'?404:409,current);
    }
    if((pathname==='/api/v1/gym/reserve'||
        pathname==='/api/v1/gym/start')&&req.method==='POST'){
      // ONLINE-01C-23C2: authenticated CI harness ONLY. Never expose Gym
      // writes in production before verified secrets, restore and beta gates.
      if(!enabled)return json(res,503,{error:'Ginásios online em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)
        return json(res,403,{error:'E-mail não verificado'});
      if(!await enforceThrottle(req,res,{scope:'gym-write-account',
        identifier:account.id,limit:60}))return;
      const data=await readJson(req);
      const isReserve=pathname==='/api/v1/gym/reserve';
      const expected=isReserve?
        'actionId,expectedRevision':'expectedRevision,gymReservationId';
      if(Object.keys(data).sort().join(',')!==expected)
        return json(res,400,{error:'Ação de Ginásio inválida'});
      const result=isReserve?
        await reserveNextGym(pool,{accountId:account.id,
          actionId:data.actionId,expectedRevision:data.expectedRevision}):
        await startReservedGymTurnSession(pool,{accountId:account.id,
          gymReservationId:data.gymReservationId,
          expectedRevision:data.expectedRevision});
      const success=isReserve?
        ['reserved','replay'].includes(result.status):
        ['started','replay'].includes(result.status);
      const status=success?200:
        result.status==='invalid'?400:
        ['missing','missing-save'].includes(result.status)?404:409;
      return json(res,status,success?result:{error:result.status});
    }
    if(pathname==='/api/v1/gym/turn'&&req.method==='POST'){
      // ONLINE-01C-23C3: ONLY in isolated CI/test harness.
      // Secrets, player identity and all RNG stay server-side.
      if(!enabled)return json(res,503,{error:'Ginásios online em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)
        return json(res,403,{error:'E-mail não verificado'});
      if(!await enforceThrottle(req,res,{scope:'gym-turn-account',
        identifier:account.id,limit:150}))return;
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!==
         'action,actionId,expectedRevision,gymReservationId')
        return json(res,400,{error:'Ação de Ginásio inválida'});
      let keyring;
      try{keyring=loadGymEntropyKeyringFromEnv();}
      catch{return json(res,503,{error:'Ginásios online em preparação'});}
      const result=await applyGymTurnWithKeyring(pool,keyring,{
        accountId:account.id,gymReservationId:data.gymReservationId,
        actionId:data.actionId,expectedRevision:data.expectedRevision,
        action:data.action
      });
      const ok=['applied','replay'].includes(result.status);
      const status=ok?200:result.status==='invalid'?400:
        ['missing','missing-save'].includes(result.status)?404:409;
      return json(res,status,ok?result:{
        error:result.status,reason:result.reason??undefined
      });
    }
    if((pathname==='/api/v1/gym/certify'||
        pathname==='/api/v1/gym/settle')&&req.method==='POST'){
      // ONLINE-01C-23C4: same verified account and immutable HMAC replay,
      // test harness ONLY. Real production returns 503 even if flag is set.
      if(!enabled)return json(res,503,{error:'Ginásios online em preparação'});
      requireSameOrigin(req);
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      if(!account.email_verified_at)
        return json(res,403,{error:'E-mail não verificado'});
      if(!await enforceThrottle(req,res,{scope:'gym-final-account',
        identifier:account.id,limit:60}))return;
      const data=await readJson(req);
      if(Object.keys(data).sort().join(',')!==
          'actionId,expectedRevision,gymReservationId')
        return json(res,400,{error:'Ação de Ginásio inválida'});
      let keyring;
      try{keyring=loadGymEntropyKeyringFromEnv();}
      catch{return json(res,503,{error:'Ginásios online em preparação'});}
      const action={
        accountId:account.id,gymReservationId:data.gymReservationId,
        actionId:data.actionId,expectedRevision:data.expectedRevision
      };
      const isCertificate=pathname==='/api/v1/gym/certify';
      const result=isCertificate?
        await certifyGymWithKeyring(pool,keyring,action):
        await settleGymWithKeyring(pool,keyring,action);
      const ok=(isCertificate?['certified','replay']:
        ['paid','replay']).includes(result.status);
      const status=ok?200:result.status==='invalid'?400:
        ['missing','missing-save'].includes(result.status)?404:409;
      return json(res,status,ok?result:{error:result.status});
    }
    if(pathname==='/api/v1/save'&&req.method==='GET'){
      const account=await accountForSession(req);
      if(!account)return json(res,401,{error:'Não autenticado'});
      const result=await pool.query(
        'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1',
        [account.id]);
      if(!result.rowCount)return json(res,404,{error:'Nova conta ainda sem aventura criada'});
      return json(res,200,result.rows[0]);
    }
    if(pathname.startsWith('/api/v1/'))return json(res,404,{error:'Rota não disponível'});
    return json(res,404,{error:'Não encontrado'});
  }catch(error){
    if(error?.code==='23505')return json(res,409,{error:'Conta já cadastrada'});
    if(error instanceof SyntaxError||error instanceof TypeError
      ||String(error?.message??'').includes('Origem')
      ||String(error?.message??'').includes('Esperado')
      ||String(error?.message??'').includes('tamanho máximo'))
      return json(res,400,{error:'Requisição inválida'});
    console.error('online-api error',error?.code??error?.name??'unknown');
    return json(res,500,{error:'Erro interno'});
  }
});
server.requestTimeout=10000;
server.headersTimeout=12000;
const bindHost=process.env.NODE_ENV==='test'&&
  process.env.ACCOUNT_DRILL_LOOPBACK_ONLY==='true'?'127.0.0.1':'0.0.0.0';
server.listen(port,bindHost,()=>{
  console.log('ONLINE-01 API na porta '+server.address().port+'; registro '+(enabled?'habilitado':'desabilitado'));
});
