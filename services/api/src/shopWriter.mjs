import {randomUUID} from 'node:crypto';
/** Private PostgreSQL shop writer; no route or release flag in 23F9A. */
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,96}$/;
const rollback=async(c,result)=>{await c.query('ROLLBACK');return result;};
export async function purchaseShopBall(pool,params){
 if(!params||Object.keys(params).sort().join(',')!=='accountId,actionId,ballId,expectedRevision,quantity'||
  typeof params.accountId!=='string'||!UUID.test(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
  !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
  !['poke-ball','great-ball','ultra-ball'].includes(params.ballId)||!Number.isSafeInteger(params.quantity)||params.quantity<1||params.quantity>50)return {status:'invalid'};
 const {accountId,actionId,ballId,expectedRevision,quantity}=params;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const earlier=await c.query('SELECT 1 FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(earlier.rowCount)return await rollback(c,{status:'duplicate'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||revision!==expectedRevision)return await rollback(c,{status:'stale'});
  if(row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||
   save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter();
  const projection=core.onlineShopProjection(save.journal.raw);
  if(!projection)return await rollback(c,{status:'invalid-save'});
  if(projection.busy)return await rollback(c,{status:'busy'});
  const raw=core.applyOnlineShopPurchase(save.journal.raw,actionId,ballId,quantity);
  if(typeof raw!=='string')return await rollback(c,{status:'unavailable'});
  const nextRevision=revision+1;
  const next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,'shop-purchase',nextRevision]);
  await c.query('COMMIT');
  return {status:'purchased',revision:nextRevision,purchase:JSON.parse(raw).lastShopPurchase};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}

/** Reuses the same account lock, receipt and revision policy as ball checkout. */
export async function purchaseShopGear(pool,params){
 if(!params||Object.keys(params).sort().join(',')!=='accountId,actionId,expectedRevision,templateId'||
  typeof params.accountId!=='string'||!UUID.test(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
  !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||typeof params.templateId!=='string'||!/^[a-z][a-z-]{1,40}$/.test(params.templateId))return {status:'invalid'};
 const {accountId,actionId,expectedRevision,templateId}=params,c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const earlier=await c.query('SELECT 1 FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(earlier.rowCount)return await rollback(c,{status:'duplicate'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||revision!==expectedRevision)return await rollback(c,{status:'stale'});
  if(row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter(),projection=core.onlineShopProjection(save.journal.raw);
  if(!projection)return await rollback(c,{status:'invalid-save'});
  if(projection.busy)return await rollback(c,{status:'busy'});
  if(!projection.gearItems.some(i=>i.id===templateId))return await rollback(c,{status:'invalid'});
  const result=core.applyOnlineGearPurchase(save.journal.raw,templateId,randomUUID());
  if(!result)return await rollback(c,{status:'unavailable'});
  const nextRevision=revision+1,next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw:result.raw}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,'shop-gear-purchase',nextRevision]);
  await c.query('COMMIT');return {status:'purchased',revision:nextRevision,purchase:result.purchase};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}

/** Atomic mixed checkout with one revision and one receipt. */
export async function purchaseShopCart(pool,params){
 if(!params||Object.keys(params).sort().join(',')!=='accountId,actionId,expectedRevision,items'||
  typeof params.accountId!=='string'||!UUID.test(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
  !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||!Array.isArray(params.items)||params.items.length<1||params.items.length>17||params.items.some(x=>!x||Object.keys(x).sort().join(',')!=='itemId,quantity'||typeof x.itemId!=='string'||!/^[a-z][a-z-]{1,40}$/.test(x.itemId)||!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>50)||new Set(params.items.map(x=>x.itemId)).size!==params.items.length)return {status:'invalid'};
 const {accountId,actionId,expectedRevision,templateId}=params,c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const earlier=await c.query('SELECT 1 FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(earlier.rowCount)return await rollback(c,{status:'duplicate'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||revision!==expectedRevision)return await rollback(c,{status:'stale'});
  if(row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter(),projection=core.onlineShopProjection(save.journal.raw);
  if(!projection)return await rollback(c,{status:'invalid-save'});
  if(projection.busy)return await rollback(c,{status:'busy'});
  // All purchases are evaluated against an in-memory candidate under one lock.
  // No intermediate save or receipt is persisted; any failure rolls back the entire cart.
  let raw=save.journal.raw;const purchases=[];
  for(const {itemId,quantity} of items){
   if(projection.items.some(i=>i.id===itemId)){
    const next=core.applyOnlineShopPurchase(raw,randomUUID(),itemId,quantity);
    if(!next)return await rollback(c,{status:'unavailable'});
    raw=next;purchases.push(JSON.parse(raw).lastShopPurchase);
   }else if(projection.gearItems.some(i=>i.id===itemId)){
    if(quantity>10)return await rollback(c,{status:'invalid'});
    for(let i=0;i<quantity;i++){
     const next=core.applyOnlineGearPurchase(raw,itemId,randomUUID());
     if(!next)return await rollback(c,{status:'unavailable'});
     raw=next.raw;purchases.push(next.purchase);
    }
   }else return await rollback(c,{status:'invalid'});
  }
  const result={raw,purchase:{items:purchases,cost:projection.coins-JSON.parse(raw).coins}};
  const nextRevision=revision+1,next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw:result.raw}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,'shop-purchase',nextRevision]);
  await c.query('COMMIT');return {status:'purchased',revision:nextRevision,purchase:result.purchase};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
