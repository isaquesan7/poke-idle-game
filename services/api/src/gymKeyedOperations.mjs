/** INTERNAL Gym keyring adapter: never choose a secret from a browser request.
 * The authoritative writers still hold save→Gym locks and check HMAC proofs
 * inside their own transaction. This preliminary read only chooses a key ID.
 */
import {applyReservedGymTurn} from './gymTurnAction.mjs';
import {auditReservedGymBattle} from './gymReplayAudit.mjs';
import {certifyReservedGymBattle} from './gymCertificate.mjs';
import {settleCertifiedGym} from './gymSettlement.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function historicalContext(pool,keyring,{accountId,gymReservationId}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof gymReservationId!=='string'||!UUID.test(gymReservationId)||
     !keyring||typeof keyring.resolve!=='function')
    return {status:'invalid'};
  const row=await pool.query(
    `SELECT turn_entropy_key_id,turn_entropy_proof
       FROM game_gym_reservations WHERE account_id=$1 AND id=$2`,
    [accountId,gymReservationId]);
  if(!row.rowCount)return {status:'missing'};
  const result=keyring.resolve({
    accountId,gymReservationId,
    keyId:row.rows[0].turn_entropy_key_id,
    storedProof:row.rows[0].turn_entropy_proof
  });
  if(!['new','legacy','resolved'].includes(result.status))return result;
  return {status:'ready',entropyKey:result.key,entropyKeyId:result.id};
}
/** New server integrations should use THIS adapter for all actions.
 * Rotating the active key does not change an already-started reservation.
 */
export async function applyGymTurnWithKeyring(pool,keyring,params){
  const selected=await historicalContext(pool,keyring,params);
  if(selected.status!=='ready')return {status:selected.status};
  return applyReservedGymTurn(pool,{
    ...params,entropyKey:selected.entropyKey,entropyKeyId:selected.entropyKeyId
  });
}
export async function auditGymWithKeyring(pool,keyring,params){
  const selected=await historicalContext(pool,keyring,params);
  if(selected.status!=='ready')return {status:selected.status};
  return auditReservedGymBattle(pool,{
    ...params,entropyKey:selected.entropyKey
  });
}
export async function certifyGymWithKeyring(pool,keyring,params){
  const selected=await historicalContext(pool,keyring,params);
  if(selected.status!=='ready')return {status:selected.status};
  return certifyReservedGymBattle(pool,{
    ...params,entropyKey:selected.entropyKey
  });
}
export async function settleGymWithKeyring(pool,keyring,params){
  const selected=await historicalContext(pool,keyring,params);
  if(selected.status!=='ready')return {status:selected.status};
  return settleCertifiedGym(pool,{
    ...params,entropyKey:selected.entropyKey
  });
}
