import test from 'node:test';
import assert from 'node:assert/strict';
import {battlePendingDisplay} from '../src/battlePendingDisplay.mjs';
import {gymPublicSide} from '../src/gymPresentation.mjs';
test('public projection exposes only allowed pending action on living fighter',()=>{
 for(const pendingAction of ['solar-beam','dig','recharge'])assert.equal(battlePendingDisplay({hp:1,pendingAction}),pendingAction);
 for(const actor of [null,undefined,{hp:0,pendingAction:'dig'},{hp:2,pendingAction:'invalid'},{hp:2}])assert.equal(battlePendingDisplay(actor),null);
 const fighter={hp:10,pendingAction:'dig',combatant:{speciesId:4,level:20,stats:{hp:40},moves:['private']}};
 const side=gymPublicSide({activeIndex:0,fighters:[fighter]});
 assert.equal(side.fighters[0].pendingAction,'dig');assert.equal(Object.hasOwn(side.fighters[0],'combatant'),false);
});
