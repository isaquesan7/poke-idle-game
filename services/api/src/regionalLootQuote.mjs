/** Private HMAC domains: one deterministic roll per certified encounter.
 * No player-controlled seed, gear, stone or reroll.
 */
import {createPrivateBattleRandom} from './battleEntropy.mjs';
export function quoteCertifiedRegionalLoot(core,snapshot,summary,{accountId,encounterId,entropyKey}){
 const gearRng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'wild-battle-gear-drop'});
 const stoneRng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'wild-battle-stone-drop'});
 const input={
  regionId:snapshot.regionId,speciesId:snapshot.opponent.speciesId,
  wildLevel:snapshot.opponent.level,trainerLevel:snapshot.trainer.level,
  pokemonLevel:snapshot.activePokemon.level,won:summary.outcome==='win'
 };
 const loot=core.rollRegionalLoot(input,gearRng.integer,stoneRng.integer);
 if(!loot||snapshot.tmLootVersion===undefined)return loot;
 if(snapshot.tmLootVersion!==1)return null;
 const rng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'wild-battle-tm-drop'});
 const tm=core.rollRegionalMachine(input,rng.integer);
 return tm?{...loot,tmId:tm.tmId}:null;
}
