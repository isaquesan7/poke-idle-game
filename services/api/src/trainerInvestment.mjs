/** ONLINE-01C-6: first server-authoritative action.
 * Only one manually distributed trainer point can be invested per request.
 * No coins/experience/levels/captures/badges arrive from the client.
 */
export const TRAINER_STATS=Object.freeze([
  'hp','attack','defense','specialAttack','specialDefense','speed'
]);
export function investTrainerPoint(save,stat){
  if(!TRAINER_STATS.includes(stat)||!save||save.schemaVersion!==2||
      !save.journal||typeof save.journal.raw!=='string')
    return {status:'invalid'};
  let state;
  try{state=JSON.parse(save.journal.raw);}catch{return {status:'invalid'};}
  if(state?.version!==1||!state.trainer||!state.trainer.manual||
      Array.isArray(state.trainer.manual))
    return {status:'invalid'};
  const level=state.trainer.level,manual=state.trainer.manual;
  if(!Number.isSafeInteger(level)||level<1||level>100||
      Object.keys(manual).some(k=>!TRAINER_STATS.includes(k))||
      !TRAINER_STATS.every(k=>Number.isSafeInteger(manual[k])&&
        manual[k]>=0&&manual[k]<=40))
    return {status:'invalid'};
  const spent=TRAINER_STATS.reduce((total,key)=>total+manual[key],0);
  if(spent>(level-1)*2||spent>=(level-1)*2||manual[stat]>=40)
    return {status:'unavailable'};
  state.trainer.manual[stat]+=1;
  const next=structuredClone(save);
  next.journal.raw=JSON.stringify(state);
  // A journal receipt remains a separate durable DB record, never client-set.
  return {status:'ok',next,allocated:state.trainer.manual[stat]};
}
export async function applyTrainerInvestment(pool,{accountId,actionId,expectedRevision,stat}){
  if(typeof accountId!=='string'||!(/^[0-9a-f-]{36}$/i).test(accountId)||
      typeof actionId!=='string'||!(/^[A-Za-z0-9_-]{12,100}$/).test(actionId)||
      !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      !TRAINER_STATS.includes(stat))
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const rows=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!rows.rowCount){await client.query('ROLLBACK');return {status:'missing'};}
    const receipt=await client.query(
      'SELECT save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(receipt.rowCount){await client.query('ROLLBACK');return {status:'duplicate'};}
    const current=rows.rows[0],revision=Number(current.revision);
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision){
      await client.query('ROLLBACK');return {status:'stale'};
    }
    const save=current.state;
    if(current.schema_version!==2||save?.revision!==revision||
       save?.journal?.revision!==revision){
      await client.query('ROLLBACK');return {status:'invalid'};
    }
    const gymBusy=await client.query(
      "SELECT id FROM game_gym_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(gymBusy.rowCount){
      await client.query('ROLLBACK');return {status:'busy'};
    }
    const applied=investTrainerPoint(save,stat);
    if(applied.status!=='ok'){
      await client.query('ROLLBACK');return {status:applied.status};
    }
    const nextRevision=revision+1;
    applied.next.revision=nextRevision;
    applied.next.journal.revision=nextRevision;
    await client.query(
      'UPDATE game_saves SET state=$2::jsonb,revision=$3,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(applied.next),nextRevision]);
    await client.query(
      'INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',
      [accountId,actionId,'trainer-invest',nextRevision]);
    await client.query('COMMIT');
    return {status:'ok',revision:nextRevision,stat,allocated:applied.allocated};
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}
