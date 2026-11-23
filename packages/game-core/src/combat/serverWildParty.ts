/** ONLINE-01C-23B1: frozen REAL 2–3 trainer members versus ONE R1 wild.
 * Never auto-equip learned moves or reuse fallen sentinel as a fighter.
 */
import {canonicalFrozenCombatants} from './serverFrozenBattle.js';
import type {ServerBattleSnapshotV3} from './serverFrozenBattle.js';
import type {Combatant} from './kantoBattle.js';

export function canonicalFrozenWildParty(snapshot:unknown):
  {readonly party:readonly Combatant[];readonly wild:Combatant}|null{
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))
    return null;
  const s=snapshot as ServerBattleSnapshotV3;
  if(s.version!==3)return null;
  const lead=canonicalFrozenCombatants(snapshot);
  if(!lead)return null; // validates every UID, slot and equipment.
  const party=s.party.map(p=>canonicalFrozenCombatants({
    version:2,regionId:s.regionId,opponent:s.opponent,
    trainer:s.trainer,activePokemon:p
  })?.player);
  if(party.some(p=>!p))return null;
  return {party:party as Combatant[],wild:lead.wild};
}
