/** Only the already-visible pending action, never the frozen private engine. */
export function battlePendingDisplay(fighter){
 const pending=fighter?.hp>0?fighter.pendingAction:null;
 return pending==='solar-beam'||pending==='dig'||pending==='recharge'?pending:null;
}
