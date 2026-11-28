/** REF01: approved material costs, independent of gold and base affixes. */
import type {LootRarity} from './regionalLoot.js';
import type {StatBonus} from '../stats/types.js';
export const REFORGE_SALVAGE:Readonly<Record<LootRarity,number>>=Object.freeze({common:5,uncommon:10,rare:25,epic:60,legendary:150});
const FIRST_COST:Readonly<Record<LootRarity,number>>={common:10,uncommon:20,rare:40,epic:80,legendary:150};
const CHANCES=[
 [100,0,0],[85,15,0],[65,25,10],[40,40,20],[20,45,35],[10,40,50]
] as const;
export const REFORGE_FRAGMENT_CAP=1_000_000_000;
export function reforgeMaxRank(rarity:LootRarity){return rarity==='legendary'?6:5;}
export function validReforgeRank(rarity:LootRarity,rank:unknown):rank is number{
 return typeof rank==='number'&&Number.isSafeInteger(rank)&&rank>=0&&rank<=reforgeMaxRank(rarity);
}
export function reforgeQuote(rarity:LootRarity,rank:number){
 if(!validReforgeRank(rarity,rank)||rank===reforgeMaxRank(rarity))return null;
 const [success,stay,regress]=CHANCES[rank]!;
 return {rank,target:rank+1,cost:FIRST_COST[rarity]*2**rank,success,stay,regress,bonusPercent:(rank+1)*10};
}
/** Base rolls are immutable; compute the effective stats exactly once. */
export function reforgeStats(base:Readonly<StatBonus>,rank:number):StatBonus{
 if(!Number.isSafeInteger(rank)||rank<0||rank>6)throw new RangeError('Invalid reinforcement rank');
 return Object.fromEntries(Object.entries(base).map(([key,value])=>[key,Math.floor(value*(100+10*rank)/100)])) as StatBonus;
}
/** Additional salvage scales with achieved rank, not the amount ever spent. */
export function reforgeSalvage(rarity:LootRarity,rank:number){
 if(!validReforgeRank(rarity,rank))return null;
 return Math.floor(REFORGE_SALVAGE[rarity]*(100+10*rank)/100);
}
export function reforgeRoll(rarity:LootRarity,rank:number,roll:number){
 const q=reforgeQuote(rarity,rank);
 if(!q||!Number.isSafeInteger(roll)||roll<0||roll>=10000)return null;
 if(roll<q.success*100)return {outcome:'success',rank:rank+1} as const;
 if(roll<(q.success+q.stay)*100)return {outcome:'stay',rank} as const;
 return {outcome:'regress',rank:rank-1} as const;
}
