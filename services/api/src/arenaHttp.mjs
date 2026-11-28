/** Read-only private projection. Authenticated route adapter, CI-only until complete release. */
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function arenaHttpEnabled(env=process.env){return ciOnlineFeatureEnabled('ONLINE_ARENA_CI_ONLY',env);}
import {loadCombatAdapter} from './battlePreview.mjs';
export async function readArena(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
 floor(extract(epoch from clock_timestamp())*1000)::bigint AS ms,
 (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
 OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
 FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],revision=Number(row.revision),save=row.state;
 if(!Number.isSafeInteger(revision)||revision<0||save?.schemaVersion!==2||save.revision!==revision||
  save.journal?.revision!==revision||typeof save.journal.raw!=='string')return {status:'invalid-save'};
 const core=await loadCombatAdapter(),view=core.onlineArenaPublicProjection(save.journal.raw,Number(row.ms));
 if(!view)return {status:'invalid-save'};
 const shop=core.onlineArenaShopProjection(save.journal.raw,Number(row.ms));
 if(!shop)return {status:'invalid-save'};
 const state=JSON.parse(save.journal.raw);
 const last=state.lastArenaDuel??state.lastArenaAction?.result?.duel;
 return {status:'ok',revision,serverNowMs:Number(row.ms),...view,busy:row.busy||view.busy,
  shop:{...shop,busy:row.busy||shop.busy,offers:shop.offers.map(o=>row.busy?{...o,canBuy:false,reason:'busy'}:o)},
  lastDuel:last?.weekStartMs===view.startMs?last:null};
}
