/**
 * D064BG — afinidade individual por UID.
 * Após 48h sem participar de uma batalha, perde 1 ponto por dia completo.
 * O cálculo é puro: leituras/reloads não gastam afinidade novamente.
 */
export const AFFINITY_IDLE_DAY_MS=24*60*60*1000;
export const AFFINITY_IDLE_GRACE_DAYS=2;
export const AFFINITY_LOSS_ON_DEFEAT=3;
export const AFFINITY_LOSS_ON_DRAW=1;

export function affinityAfterInactivity(
  currentAffinity:number,lastBattleAt:number,nowMs:number
):number {
  if(!Number.isSafeInteger(currentAffinity)||currentAffinity<0||currentAffinity>100
    ||!Number.isSafeInteger(lastBattleAt)||lastBattleAt<0
    ||!Number.isSafeInteger(nowMs)||nowMs<0)
    throw new RangeError('Afinidade ou horário inválido.');
  const elapsedDays=Math.floor(Math.max(0,nowMs-lastBattleAt)/AFFINITY_IDLE_DAY_MS);
  const penalty=Math.max(0,elapsedDays-AFFINITY_IDLE_GRACE_DAYS+1);
  return Math.max(0,currentAffinity-penalty);
}

/** Para guardar referência sem recalcular o mesmo desconto diariamente.
 * A âncora individual é o instante da última batalha; o escritor persiste
 * uma contagem de dias descontados e só aplica a diferença.
 */
export function affinityIdlePenaltyDays(lastBattleAt:number,nowMs:number):number{
  if(!Number.isSafeInteger(lastBattleAt)||lastBattleAt<0
    ||!Number.isSafeInteger(nowMs)||nowMs<0)
    throw new RangeError('Horário inválido.');
  return Math.max(0,Math.floor(Math.max(0,nowMs-lastBattleAt)/AFFINITY_IDLE_DAY_MS)
    -AFFINITY_IDLE_GRACE_DAYS+1);
}
