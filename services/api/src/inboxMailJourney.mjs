/** ONLINE-01C-23E7. Operator-controlled account email journey.
 * Never reads a token from the database or the outbox. The operator supplies
 * the received link. This HTTP exercise is separate from the browser E2E.
 */
export function tokenFromInboxLink(value,origin,purpose){
  let url;
  try{url=new URL(value);}catch{throw new Error('Link de teste inválido');}
  const path=purpose==='verify'?'/verify-email':purpose==='reset'?'/reset-password':null;
  if(!path||url.origin!==origin||url.pathname!==path||url.username||url.password||
    url.hash||[...url.searchParams.keys()].join(',')!=='token'||
    !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('token')??''))
    throw new Error('Link não pertence a este ensaio');
  return url.searchParams.get('token');
}
function requireStatus(response,status,step){
  if(response?.status!==status)throw new Error('Etapa não aprovada: '+step);
  return response;
}
function cookieFrom(response){
  const value=response.headers.get('set-cookie')??'';
  if(!/^__Host-kanto_session=[A-Za-z0-9_-]{43};/.test(value)||
    !/;\s*Secure(?:;|$)/.test(value)||!/;\s*HttpOnly(?:;|$)/.test(value))
    throw new Error('Cookie de sessão inválido');
  return value.split(';')[0];
}
export async function runInboxJourney({request,sendOne,readLink,recipient,origin,
  password,replacement,progress=()=>{}}){
  const registered=requireStatus(await request('/api/v1/auth/register',{
    email:recipient,password,trainerName:'Treinador Teste'}),201,'cadastro');
  if(!registered.data.id||Object.hasOwn(registered.data,'verificationToken'))
    throw new Error('Cadastro deve enfileirar sem expor token');
  requireStatus(await request('/api/v1/auth/login',{email:recipient,password}),
    403,'bloqueio antes da verificação');
  const verifyReceipt=await sendOne('verify');
  progress('verify-provider-accepted',verifyReceipt);
  const verify=tokenFromInboxLink(await readLink('verify'),origin,'verify');
  requireStatus(await request('/api/v1/auth/verify',{token:verify}),200,'verificação');
  requireStatus(await request('/api/v1/auth/verify',{token:verify}),400,'reuso da verificação');
  const login=requireStatus(await request('/api/v1/auth/login',{
    email:recipient,password}),200,'login');
  const oldCookie=cookieFrom(login);
  const me=requireStatus(await request('/api/v1/me',undefined,oldCookie),200,'sessão');
  if(me.data.id!==registered.data.id)throw new Error('Sessão não pertence à conta');
  const reset=requireStatus(await request('/api/v1/auth/request-reset',{
    email:recipient}),200,'solicitação de recuperação');
  if(Object.hasOwn(reset.data,'testResetToken'))throw new Error('Reset expôs token');
  const resetReceipt=await sendOne('reset');
  progress('reset-provider-accepted',resetReceipt);
  if(verifyReceipt.providerMessageId===resetReceipt.providerMessageId)
    throw new Error('Recibos do provedor devem ser distintos');
  const token=tokenFromInboxLink(await readLink('reset'),origin,'reset');
  requireStatus(await request('/api/v1/auth/confirm-reset',{
    token,password:replacement}),200,'redefinição');
  requireStatus(await request('/api/v1/auth/confirm-reset',{
    token,password:replacement}),400,'reuso da recuperação');
  requireStatus(await request('/api/v1/me',undefined,oldCookie),401,'revogação de sessão');
  requireStatus(await request('/api/v1/auth/login',{
    email:recipient,password}),401,'recusa da senha anterior');
  const next=requireStatus(await request('/api/v1/auth/login',{
    email:recipient,password:replacement}),200,'novo login');
  const nextMe=requireStatus(await request('/api/v1/me',undefined,cookieFrom(next)),
    200,'nova sessão');
  if(nextMe.data.id!==registered.data.id)throw new Error('Nova sessão incorreta');
  return {httpJourneyPassed:true,verification:verifyReceipt,reset:resetReceipt,
    inboxLinksConsumed:true,reusedLinksRejected:true,oldSessionRevoked:true,
    oldPasswordRejected:true,providerDeliveryEventVerified:false,
    senderDomainVerified:false,publicRegistrationAuthorized:false};
}
