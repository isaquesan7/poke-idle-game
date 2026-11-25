/** Private HMAC domains: one deterministic roll per certified encounter.
 * No player-controlled seed, gear, stone or reroll.
 */
import {createPrivateBattleRandom} from './battleEntropy.mjs';
export function quoteCertifiedRegionalLoot(core,snapshot,summary,{accountId,encounterId,entropyKey}){
 const gearRng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'wild-battle-gear-drop'});
 const stoneRng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'wild-battle-stone-drop'});
 return core.rollRegionalLoot({
  regionId:snapshot.regionId,speciesId:snapshot.opponent.speciesId,
  wildLevel:snapshot.opponent.level,trainerLevel:snapshot.trainer.level,
  pokemonLevel:snapshot.activePokemon.level,won:summary.outcome==='win'
 },gearRng.integer,stoneRng.integer);
}
