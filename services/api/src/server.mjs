/** ONLINE-01: API isolada e NÃO conectada ao /play.
 * Ativação de cadastro requer DATABASE_URL, APP_ORIGIN e
 * ONLINE_REGISTRATION_ENABLED=true. Nunca importa saves locais.
 */
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {
  normalizeEmail,validatePassword,validateTrainerName,
  hashPassword,verifyPassword,newSessionToken,tokenDigest,
  sessionCookie,parseSessionCookie
} from './auth.mjs';
import {throttle,requesterIp,issueVerification,consumeVerification} from './authSecurity.mjs';
import {issuePasswordReset,consumePasswordReset} from './passwordReset.mjs';
import {deliverAccountEmail} from './mailer.mjs';

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
const isSecure=process.env.NODE_ENV==='production';
const mailMode=process.env.ACCOUNT_MAIL_MODE??'off';
if(mailMode!=='off'&&mailMode!=='resend')throw new Error('ACCOUNT_MAIL_MODE inválido');
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
async function readJson(req){
  if(!req.headers['content-type']?.startsWith('application/json'))
    throw new Error('Esperado application/json');
  let size=0;const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>16384)throw new Error('Dados excederam o tamanho máximo.');
    chunks.push(chunk);
  }
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
    `SELECT a.id,a.email,p.trainer_name FROM game_auth_sessions s
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
    if(pathname==='/api/v1/auth/register'&&req.method==='POST'){
      requireSameOrigin(req);
      const {email,password,trainerName}=await readJson(req);
      const cleanEmail=normalizeEmail(email),cleanName=validateTrainerName(trainerName);
      validatePassword(password);
      if(!await enforceThrottle(req,res,{scope:'register-ip',
        identifier:requesterIp(req),limit:10}))return;
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
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      finally{client.release();}
      // Mail transport is optional in tests. The production auth gate remains
      // hard-disabled until verified sender, recovery UI and backups exist.
      const mailed=await deliver({to:cleanEmail,purpose:'verify',token:verification,
        idempotencyKey:'verify/'+userId});
      return json(res,201,{id:userId,trainerName:cleanName,
        ...(mailed?{}:{verificationToken:verification})});
    }
    if(pathname==='/api/v1/auth/verify'&&req.method==='POST'){
      requireSameOrigin(req);
      if(!await enforceThrottle(req,res,{scope:'verify-ip',
        identifier:requesterIp(req),limit:20}))return;
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
        identifier:requesterIp(req),limit:10}))return;
      if(!await enforceThrottle(req,res,{scope:'reset-email',
        identifier:cleanEmail,limit:3}))return;
      const token=await issuePasswordReset(pool,cleanEmail);
      if(token)try{
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
        ...(!mailConfigured&&process.env.NODE_ENV==='test'&&token?
          {testResetToken:token}:{})});
    }
    if(pathname==='/api/v1/auth/confirm-reset'&&req.method==='POST'){
      requireSameOrigin(req);
      if(!await enforceThrottle(req,res,{scope:'reset-confirm-ip',
        identifier:requesterIp(req),limit:20}))return;
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
        identifier:requesterIp(req),limit:30}))return;
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
server.listen(port,'0.0.0.0',()=>{
  console.log('ONLINE-01 API na porta '+port+'; registro '+(enabled?'habilitado':'desabilitado'));
});
