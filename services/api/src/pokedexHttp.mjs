import {loadCombatAdapter} from './battlePreview.mjs';
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function pokedexHttpEnabled(env=process.env){
 return ciOnlineFeatureEnabled('ONLINE_POKEDEX_CI_ONLY',env);
}
export async function readPokedex(pool,accountId){
 const q=await pool.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1',[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],revision=Number(row.revision),save=row.state;
 if(!Number.isSafeInteger(revision)||row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||save.journal?.revision!==revision||typeof save.journal.raw!=='string')return {status:'invalid-save'};
 const core=await loadCombatAdapter();
 const dex=core.onlinePokedexProjection(save.journal.raw);
 if(!dex)return {status:'invalid-save'};
 // One coherent bounded snapshot. Only discovered details, no private journal.
 const details=dex.entries.filter(e=>e.status!=='unknown').map(e=>core.onlinePokedexDetail(save.journal.raw,e.id));
 if(details.some(d=>!d))return {status:'invalid-save'};
 return {status:'ok',revision,...dex,details};
}
