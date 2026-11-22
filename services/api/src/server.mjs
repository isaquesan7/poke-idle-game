/** ONLINE-01: API isolada e NÃO conectada ao /play.
 * Ativação de cadastro requer DATABASE_URL, APP_ORIGIN e
 * ONLINE_REGISTRATION_ENABLED=true. Nunca importa saves locais.
 */
import {createServer} from 'node:http';
import pg from 'pg';
import {
  normalizeEmail,validatePassword,validateTrainerName,
  hashPassword,verifyPassword,newSessionToken,tokenDigest,
  sessionCookie,parseSessionCookie
} from './auth.mjs';

const port=Number(process.env.PORT??3001);
const connectionString=process.env.DATABASE_URL;
const appOrigin=process.env.APP_ORIGIN;
if(!connectionString||!appOrigin)throw new Error('DATABASE_URL e APP_ORIGIN são obrigatórios.');
const pool=new pg.Pool({connectionString,max:12,connectionTimeoutMillis:5000,
  idleTimeoutMillis:30000});
const enabled=process.env.ONLINE_REGISTRATION_ENABLED==='true';
const isSecure=process.env.NODE_ENV==='production';
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
      const hash=await hashPassword(validatePassword(password));
      const client=await pool.connect();
      let userId;
      try{
        await client.query('BEGIN');
        const account=await client.query(
          'INSERT INTO game_accounts(email,password_hash) VALUES($1,$2) RETURNING id',
          [cleanEmail,hash]);
        userId=account.rows[0].id;
        await client.query(
          'INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',
          [userId,cleanName]);
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      finally{client.release();}
      return json(res,201,{id:userId,trainerName:cleanName});
    }
    if(pathname==='/api/v1/auth/login'&&req.method==='POST'){
      requireSameOrigin(req);
      const {email,password}=await readJson(req);
      const cleanEmail=normalizeEmail(email);
      if(typeof password!=='string'||password.length>128)
        return json(res,401,{error:'Credenciais inválidas'});
      const users=await pool.query(
        'SELECT id,password_hash FROM game_accounts WHERE email=$1 AND disabled_at IS NULL',
        [cleanEmail]);
      const user=users.rows[0];
      if(!user||!await verifyPassword(password,user.password_hash))
        return json(res,401,{error:'Credenciais inválidas'});
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
