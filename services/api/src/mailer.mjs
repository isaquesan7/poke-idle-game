/** Resend adapter. Never log tokens, email bodies or API credentials.
 * Works only when account rollout and verified sender are configured.
 * Pure composition / injected fetch keep network tests hermetic.
 */
export function accountEmail({purpose,token,origin}){
  if(!['verify','reset'].includes(purpose)||!(/^[A-Za-z0-9_-]{43}$/).test(token))
    throw new TypeError('Invalid account email request');
  const url=new URL(purpose==='verify'?'/verify-email':'/reset-password',origin);
  if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')
    throw new Error('HTTPS origin required for account emails');
  url.searchParams.set('token',token);
  const verify=purpose==='verify';
  return {
    subject:verify?'Confirme seu e-mail — Poke Idle Game':
      'Redefina sua senha — Poke Idle Game',
    text:(verify?'Confirme sua conta':'Redefina sua senha')+
      ' no Poke Idle Game usando o link abaixo:\n'+url.toString()+
      '\n\nO link expira em '+(verify?'24 horas':'30 minutos')+
      ' e só pode ser utilizado uma vez.\n\nSe você não solicitou isso, ignore esta mensagem.'
  };
}
export async function deliverAccountEmail({to,purpose,token,origin,key,from,
  idempotencyKey,send=fetch}){
  if(typeof key!=='string'||!key.startsWith('re_')||
    typeof from!=='string'||!from.includes('@')||
    typeof to!=='string'||!to.includes('@')||
    !(/^[a-zA-Z0-9_:/.-]{1,180}$/).test(idempotencyKey))
    throw new Error('Email delivery is not configured');
  const message=accountEmail({purpose,token,origin});
  const response=await send('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Content-Type':'application/json',
      'Authorization':'Bearer '+key,
      'Idempotency-Key':idempotencyKey},
    body:JSON.stringify({from,to:[to],...message}),
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error('Email provider delivery failed ('+response.status+')');
  const data=await response.json();
  if(typeof data?.id!=='string')throw new Error('Email provider did not return a receipt');
  return {id:data.id};
}
