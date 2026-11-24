/** Server-only regional policy: the same catalog used by /play.
 * Entropy is supplied by the existing private HMAC adapter; never Math.random,
 * a client seed, or a second manually maintained species/level table.
 */
import {kantoRegion,KANTO_REGIONS} from '../map/kantoRegions.js';
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
    region.speciesIds.includes(speciesId)&&validLevel(level)&&
    level>=region.levelMin&&level<=region.levelMax;
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
  const weights=region.speciesIds.map(id=>region.rareSpeciesIds.includes(id)?region.rareWeight:region.commonWeight);
  const total=weights.reduce((n,w)=>n+w,0);
  const pick=integer(total),offset=integer(5);
  if(!Number.isSafeInteger(pick)||pick<0||pick>=total||
    !Number.isSafeInteger(offset)||offset<0||offset>=5)return null;
  let remaining=pick;
  for(let i=0;i<weights.length;i++){
    remaining-=weights[i]!;
    if(remaining<0)return {
      speciesId:region.speciesIds[i]!,
      level:Math.max(region.levelMin,Math.min(region.levelMax,leaderLevel+offset-2))
    };
  }
  return null;
}
