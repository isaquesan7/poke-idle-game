/** Manual one-message Resend drill; no production or scheduled worker.
 * Input credentials stay in the operator's private process environment.
 */
import {normalizeEmail} from './auth.mjs';
import {mailKeyring} from './accountMailOutbox.mjs';
export function readIsolatedMailDrillConfig(env){
  if(env.NODE_ENV!=='test'||env.ACCOUNT_MAIL_MODE!=='outbox'||
    env.ONLINE_REGISTRATION_ENABLED!=='true'||
    env.MAIL_DRILL_CONFIRM!=='SEND_ONE_REAL_MESSAGE'||
    env.RAILWAY_ENVIRONMENT_ID||env.CI)
    throw new Error('Manual local mail drill only; explicit confirmation required');
  let db,origin;
  try{db=new URL(env.DATABASE_URL);origin=new URL(env.APP_ORIGIN);}
  catch{throw new Error('Local drill database and HTTPS origin required');}
  if(!['postgresql:','postgres:'].includes(db.protocol)||
    !['127.0.0.1','localhost'].includes(db.hostname)||
    db.pathname!=='/kanto_mail_drill'||db.search||db.hash)
    throw new Error('Database must be localhost/kanto_mail_drill with no URI options');
  if(origin.protocol!=='https:'||!['127.0.0.1','localhost'].includes(origin.hostname)||
    origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)
    throw new Error('Use the HTTPS loopback origin of the isolated browser');
  const recipient=normalizeEmail(env.MAIL_DRILL_RECIPIENT);
  if(/\.(?:test|invalid|example|localhost)$/.test(recipient)||
    !/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY??'')||
    typeof env.MAIL_FROM!=='string'||!env.MAIL_FROM.includes('@'))
    throw new Error('Real controlled recipient and Resend sender/key required');
  return {connectionString:env.DATABASE_URL,origin:origin.origin,recipient,
    providerKey:env.RESEND_API_KEY,from:env.MAIL_FROM,
    keyring:mailKeyring({activeId:env.ACCOUNT_MAIL_ACTIVE_KEY_ID,
      keys:JSON.parse(env.ACCOUNT_MAIL_KEYRING_JSON??'{}')})};
}
/** Last-hop recipient check even if a queue row contains unexpected data.
 * Never log the request, link, credentials or provider response.
 */
export function restrictDrillTransport(config,transport=fetch){
  return async(url,options)=>{
    if(url!=='https://api.resend.com/emails'||options?.method!=='POST')
      throw new Error('Unexpected provider operation');
    const body=JSON.parse(options.body);
    if(body.from!==config.from||!Array.isArray(body.to)||body.to.length!==1||
      body.to[0]!==config.recipient||
      typeof body.text!=='string'||
      Object.keys(body).sort().join(',')!=='from,subject,text,to')
      throw new Error('Message is outside controlled recipient scope');
    const urls=body.text.match(/https:\/\/[^\s]+/g)??[];
    if(urls.length!==1)throw new Error('Unexpected verification link');
    const link=new URL(urls[0]);
    if(link.origin!==config.origin||
      !['/verify-email','/reset-password'].includes(link.pathname)||
      !/^[A-Za-z0-9_-]{43}$/.test(link.searchParams.get('token')??'')||
      [...link.searchParams.keys()].join(',')!=='token'||link.hash)
      throw new Error('Unexpected verification link');
    return transport(url,{...options,redirect:'error'});
  };
}
