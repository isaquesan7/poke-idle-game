/** ONLINE-01C-23D9 — read-only account-deletion dependency audit.
 * Enumerates actual PostgreSQL FK actions, not guesses based on table names.
 * Does NOT erase, anonymize, disable or export a real user account.
 */
const REQUIRED_ACCOUNT_TABLES=Object.freeze([
  'game_auth_sessions','game_profiles','game_saves','game_action_receipts',
  'game_email_verifications','game_password_resets',
  'game_encounter_reservations','game_wild_turn_receipts',
  'game_pokemon_move_equip_receipts','game_collection_team_receipts',
  'game_gym_reservations','game_gym_turn_receipts','game_account_mail_outbox'
]);
const identifier=/^[a-z_][a-z0-9_]*$/;
export function evaluateAccountErasureGraph(edges){
  if(!Array.isArray(edges))throw new TypeError('FK inventory required');
  const blockers=[],seen=new Set(['game_accounts']);
  let frontier=['game_accounts'];
  const dependencies=[];
  for(let depth=0;frontier.length>0&&depth<100;depth++){
    const next=[];
    for(const edge of edges){
      if(!edge||!identifier.test(edge.parent_table??'')||
        !identifier.test(edge.child_table??'')||
        !identifier.test(edge.parent_schema??'')||
        !identifier.test(edge.child_schema??'')||
        !identifier.test(edge.name??''))
        throw new TypeError('Malformed FK inventory');
      if(!frontier.includes(edge.parent_table))continue;
      dependencies.push({parent:edge.parent_table,child:edge.child_table,
        cascade:edge.delete_action==='c',schema:edge.child_schema});
      if(edge.delete_action!=='c'||edge.child_schema!=='public')
        blockers.push('non_cascading_or_external_fk:'+edge.child_table);
      if(!seen.has(edge.child_table)){
        seen.add(edge.child_table);
        next.push(edge.child_table);
      }
    }
    frontier=next;
  }
  if(frontier.length)blockers.push('dependency_graph_depth_exceeded');
  for(const table of REQUIRED_ACCOUNT_TABLES)
    if(!seen.has(table))blockers.push('required_account_table_unreachable:'+table);
  return {
    readyForIsolatedDeletionDrill:blockers.length===0,
    blockers,
    coveredTables:[...seen].sort(),
    dependencyEdges:dependencies.length,
    note:'Schema-only evidence. Not permission to delete production data or claim LGPD compliance.'
  };
}
export async function inspectAccountErasureGraph(pool){
  const result=await pool.query(`
    SELECT c.conname AS name, p.relname AS parent_table,
      child.relname AS child_table, c.confdeltype AS delete_action,
      pn.nspname AS parent_schema, cn.nspname AS child_schema
    FROM pg_constraint c
    JOIN pg_class p ON p.oid=c.confrelid
    JOIN pg_namespace pn ON pn.oid=p.relnamespace
    JOIN pg_class child ON child.oid=c.conrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace
    WHERE c.contype='f' AND pn.nspname='public'
      AND cn.nspname NOT IN ('pg_catalog','information_schema')
    ORDER BY p.relname,child.relname,c.conname`);
  return evaluateAccountErasureGraph(result.rows);
}
