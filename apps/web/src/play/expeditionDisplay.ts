/**
 * D064BH — apresentação de duração, sem alterar writer/recompensas.
 * Usa a data persistida da expedição, não a contagem de ciclos.
 */
export function expeditionElapsedMs(startedAt:number,nowMs:number):number {
  if(!Number.isSafeInteger(startedAt)||startedAt<0
    ||!Number.isSafeInteger(nowMs)||nowMs<0)return 0;
  return Math.max(0,nowMs-startedAt);
}

/** HH:MM:SS para expedições longas, sem reiniciar após 24h. */
export function formatExpeditionDuration(ms:number):string{
  const seconds=Number.isFinite(ms)?Math.floor(Math.max(0,ms)/1000):0;
  const hours=Math.floor(seconds/3600);
  const minutes=Math.floor(seconds%3600/60);
  const rest=seconds%60;
  return [hours,minutes,rest].map(value=>String(value).padStart(2,'0')).join(':');
}

/**
 * O período sem uso é relativo ao último combate por UID; não representa a
 * afinidade já perdida e não escreve no save.
 */
export function timeUntilAffinityLoss(lastUsedAt:number,nowMs:number,daysApplied:number):number {
  if(!Number.isSafeInteger(lastUsedAt)||lastUsedAt<0
    ||!Number.isSafeInteger(nowMs)||nowMs<0
    ||!Number.isSafeInteger(daysApplied)||daysApplied<0)return 0;
  const day=24*60*60*1000;
  const next=lastUsedAt+(daysApplied+2)*day;
  return Math.max(0,next-nowMs);
}
