/** Explicit public display fields only. No combat stats, moves, seed or hidden effects. */
export function gymPublicSide(p){
 return {activeIndex:p.activeIndex,needsReplacement:p.needsReplacement,voluntarySwitchesUsed:p.voluntarySwitchesUsed,
 fighters:p.fighters.map(f=>({uid:f.uid,speciesId:f.combatant.speciesId,level:f.combatant.level,hp:f.hp,maxHp:f.combatant.stats.hp,sp:f.sp,maxSp:f.maxSp,status:f.status,retreatRecoveriesUsed:f.retreatRecoveriesUsed}))};
}
const display=s=>({player:gymPublicSide(s.player),opponent:gymPublicSide(s.leader)});
export function gymPresentation(before,resolved){
 return {before:display(before),turn:resolved.state.turn,events:resolved.snapshots.map((s,i)=>({display:display(s),frame:resolved.frames[i]}))};
}
