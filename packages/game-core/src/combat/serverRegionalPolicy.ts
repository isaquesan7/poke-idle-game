/** Server-only regional policy: the same catalog used by /play.
 * Entropy is supplied by the existing private HMAC adapter; never Math.random,
 * a client seed, or a second manually maintained species/level table.
 */
import {d064CaptureProjection} from '../capture/regionalCaptureProjection.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';
import {kantoRegion,KANTO_REGIONS,kantoRegionalLevel,kantoRegionalSpeciesPool} from '../map/kantoRegions.js';
const validLevel=(value:unknown):value is number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=100;
export function serverRegionalAccess(regionId:number,trainerLevel:unknown):boolean{
  const region=kantoRegion(regionId);
  return !!region&&validLevel(trainerLevel)&&trainerLevel>=region.trainerUnlockLevel;
}
export function serverRegionalOpponent(regionId:number,trainerLevel:unknown,
  speciesId:number,level:unknown):boolean{
  const region=kantoRegion(regionId);
  return !!region&&serverRegionalAccess(regionId,trainerLevel)&&
    validLevel(level)&&kantoRegionalSpeciesPool(region,level).some(entry=>entry.speciesId===speciesId);
}
export function serverRegionalCatalog(trainerLevel:unknown){
  if(!validLevel(trainerLevel))return null;
  return KANTO_REGIONS.map(region=>({
    id:region.id,name:region.name,levelMin:region.levelMin,levelMax:region.levelMax,
    trainerUnlockLevel:region.trainerUnlockLevel,unlocked:serverRegionalAccess(region.id,trainerLevel)
  }));
}
export function serverRegionalRoll(regionId:number,trainerLevel:unknown,leaderLevel:unknown,
  integer:(exclusiveMax:number)=>number){
  const region=kantoRegion(regionId);
  if(!region||!serverRegionalAccess(regionId,trainerLevel)||!validLevel(leaderLevel)||
    typeof integer!=='function')return null;
  // Preserve the historical draw order for pools that are legal across the
  // entire region (including R1 and rare encounters R9/R10).
  const fullPool=kantoRegionalSpeciesPool(region,region.levelMin);
  const fixed=fullPool.length===region.speciesIds.length;
  const fullTotal=fullPool.reduce((n,e)=>n+e.weight,0);
  const fixedPick=fixed?integer(fullTotal):null;
  const offset=integer(5);
  if(!Number.isSafeInteger(offset)||offset<0||offset>=5)return null;
  const level=kantoRegionalLevel(region,leaderLevel,offset);
  const pool=fixed?fullPool:kantoRegionalSpeciesPool(region,level);
  const total=pool.reduce((n,e)=>n+e.weight,0);
  if(!total)return null;
  const pick=fixed?fixedPick:integer(total);
  if(pick===null||!Number.isSafeInteger(pick)||pick<0||pick>=total)return null;
  let remaining=pick;
  for(const entry of pool){
    remaining-=entry.weight;
    if(remaining<0)return {speciesId:entry.speciesId,level};
  }
  return null;
}

/** Advisory legal ball choices, not a capture or wallet writer. */
export function serverRegionalCaptureChoices(regionId:number,speciesId:number,maxHp:number,pocket:unknown){
  const bag=inspectKantoBallPocket(pocket);
  if(bag.status!=='valid')return [];
  return (['poke-ball','great-ball','ultra-ball'] as const).flatMap(ballId=>{
    const quantity=bag.pocket.quantities[ballId]??0;
    return quantity>0&&d064CaptureProjection(speciesId,regionId,ballId,maxHp,0)?
      [{ballId,quantity}]:[];
  });
}
