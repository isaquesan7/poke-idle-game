import {loadCombatAdapter} from './battlePreview.mjs';
export function shopHttpEnabled(env=process.env){
 if(env.NODE_ENV!=='test'||env.ONLINE_REGISTRATION_ENABLED!=='true'||env.ONLINE_SHOP_CI_ONLY!=='true')return false;
 try{const db=new URL(env.DATABASE_URL);return db.protocol==='postgresql:'&&db.hostname==='127.0.0.1'&&db.port==='55432'&&db.username==='kanto_ci'&&db.pathname==='/kanto_ci'&&!db.search;}catch{return false;}
}
export async function readShop(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
 (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
 OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
 FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],core=await loadCombatAdapter();
 const projection=core.onlineShopProjection(row.state?.journal?.raw);
 if(!projection)return {status:'invalid-save'};
 return {status:'ok',revision:Number(row.revision),...projection,busy:row.busy||projection.busy};
}
