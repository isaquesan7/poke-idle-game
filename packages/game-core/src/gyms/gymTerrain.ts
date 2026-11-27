/** Project terrain mapping: one stable terrain per region, not per encounter.
 * FRLG Secret Power: grass poison, long grass sleep, rock flinch, water attack drop,
 * indoor paralysis. Hills and peaks use rock; foggy forest uses long grass.
 * This adaptation never changes attack type or permanent stats.
 */
export type SecretPowerEffect='poison'|'sleep'|'flinch'|'attack-drop'|'paralysis';
export function gymSecretPowerEffect(regionId:number|undefined):SecretPowerEffect{
 switch(regionId){
  case 1:case 5:case 8:return 'poison';
  case 6:return 'sleep';
  case 2:case 3:case 9:return 'flinch';
  case 4:case 7:return 'attack-drop';
  default:return 'paralysis';
 }
}
export function gymSnatchable(name:string):boolean{
 return ['recover','rest','bulk-up','calm-mind','double-team','reflect','light-screen','safeguard'].includes(name);
}
