import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAccountErasureGraph} from '../src/accountErasureAudit.mjs';
const required=['game_auth_sessions','game_profiles','game_saves',
 'game_action_receipts','game_email_verifications','game_password_resets',
 'game_encounter_reservations','game_wild_turn_receipts',
 'game_pokemon_move_equip_receipts','game_collection_team_receipts',
 'game_gym_reservations','game_gym_turn_receipts','game_account_mail_outbox'];
const edges=()=>required.map((child_table,i)=>({
  name:'fk_'+i,parent_table:'game_accounts',child_table,
  parent_schema:'public',child_schema:'public',delete_action:'c'
}));
test('23D9: complete real-cascade shape admits isolated dry-run only',()=>{
  const result=evaluateAccountErasureGraph(edges());
  assert.equal(result.readyForIsolatedDeletionDrill,true);
  assert.equal(result.dependencyEdges,required.length);
});
test('23D9: missing foreign key cannot be silently assumed',()=>{
  const data=edges().filter(edge=>edge.child_table!=='game_saves');
  const result=evaluateAccountErasureGraph(data);
  assert.equal(result.readyForIsolatedDeletionDrill,false);
  assert.ok(result.blockers.includes('required_account_table_unreachable:game_saves'));
});
test('23D9: RESTRICT/SET NULL or external schema dependent is a hard blocker',()=>{
  const data=edges();
  data[0].delete_action='r';data[1].child_schema='external';
  const r=evaluateAccountErasureGraph(data);
  assert.ok(r.blockers.some(x=>x.includes('game_auth_sessions')));
  assert.ok(r.blockers.some(x=>x.includes('game_profiles')));
});
test('23D9: transitive non-cascading FK is detected',()=>{
  const data=edges();
  data.push({name:'dependent_fk',parent_table:'game_gym_reservations',
    child_table:'future_privacy_archive',parent_schema:'public',
    child_schema:'public',delete_action:'a'});
  assert.ok(evaluateAccountErasureGraph(data).blockers.some(x=>
    x.includes('future_privacy_archive')));
});
test('23D9: untrusted catalog shape fails closed',()=>{
  assert.throws(()=>evaluateAccountErasureGraph(null),TypeError);
  const data=edges();data.push({name:'unsafe-fk',parent_table:'game_accounts',
    child_table:'foreign',parent_schema:'public',child_schema:'public',
    delete_action:'c'});
  assert.throws(()=>evaluateAccountErasureGraph(data),TypeError);
});
