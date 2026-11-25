import {loadCombatAdapter} from './battlePreview.mjs';
export function pokedexHttpEnabled(env=process.env){
 if(env.NODE_ENV!=='test'||env.ONLINE_REGISTRATION_ENABLED!=='true'||env.ONLINE_POKEDEX_CI_ONLY!=='true')return false;
 try{const db=new URL(env.DATABASE_URL);return db.protocol==='postgresql:'&&db.hostname==='127.0.0.1'&&db.port==='55432'&&db.username==='kanto_ci'&&db.pathname==='/kanto_ci'&&!db.search;}catch{return false;}
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
