/** ONLINE-01C-23D8: internal, read-only data portability draft.
 * Trusted backend call ONLY; no HTTP endpoint, no access token in export.
 * This is NOT a complete LGPD subject-access/erasure implementation.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxReceipts=10000;

/** Return only allowlisted, owner-scoped fields with a consistent snapshot. */
export async function exportAccountData(pool,{accountId}={}){
  if(typeof accountId!=='string'||!uuid.test(accountId))
    throw new TypeError('Trusted accountId UUID required');
  const client=await pool.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result=await client.query(
      `SELECT a.id,a.email,a.email_verified_at,a.created_at,a.updated_at,
         p.trainer_name,p.created_at AS profile_created_at
       FROM game_accounts a
       JOIN game_profiles p ON p.account_id=a.id
       WHERE a.id=$1 AND a.disabled_at IS NULL`,[accountId]);
    if(!result.rowCount){await client.query('ROLLBACK');return null;}
    const account=result.rows[0];
    const save=await client.query(
      `SELECT schema_version,revision,state,updated_at FROM game_saves
       WHERE account_id=$1`,[accountId]);
    const receipts=await client.query(
      `SELECT action_id,kind,save_revision,created_at
       FROM game_action_receipts WHERE account_id=$1
       ORDER BY created_at,id LIMIT $2`,[accountId,maxReceipts+1]);
    if(receipts.rows.length>maxReceipts)
      throw new Error('Export exceeds safe receipt limit; requires paginated review');
    await client.query('COMMIT');
    return {
      format:'poke-account-portability-draft-v1',
      coverage:'profile, gameplay save and action receipts only; NOT complete LGPD export',
      account:{id:account.id,email:account.email,
        emailVerifiedAt:account.email_verified_at,
        createdAt:account.created_at,updatedAt:account.updated_at},
      profile:{trainerName:account.trainer_name,createdAt:account.profile_created_at},
      gameplay:save.rowCount?{
        schemaVersion:save.rows[0].schema_version,
        revision:String(save.rows[0].revision),
        state:save.rows[0].state,updatedAt:save.rows[0].updated_at
      }:null,
      actions:receipts.rows.map(item=>({
        actionId:item.action_id,kind:item.kind,
        saveRevision:String(item.save_revision),createdAt:item.created_at
      }))
    };
  }catch(error){
    try{await client.query('ROLLBACK');}catch{}
    throw error;
  }finally{client.release();}
}
