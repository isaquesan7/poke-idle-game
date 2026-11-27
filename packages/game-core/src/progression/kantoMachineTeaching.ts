/** Pure candidate only: production caller must supply the pinned compatibility
 * and approved executable catalogue, never values provided by a client.
 * Learning does not occupy an equipped slot; equip separately at any time. */
import {kantoMachine,inspectMachineStock} from '../catalog/kantoMachines.js';
import type {KantoMachineId,MachineStock} from '../catalog/kantoMachines.js';
export type MachineLesson=Readonly<{tmId:KantoMachineId;speciesId:number}>;
export type MachineStudent=Readonly<{uid:number;speciesId:number;lessons?:readonly MachineLesson[];knownMoveNames:readonly string[]}>;
export type MachineTeachingPolicy=Readonly<{
 compatibleSpecies:(id:KantoMachineId)=>readonly number[]|undefined;
 executableMove:(name:string)=>boolean;
}>;
export function planMachineTeaching(input:{stock:unknown;student:MachineStudent;busy:boolean;tmId:unknown},policy:MachineTeachingPolicy){
 const stock=inspectMachineStock(input.stock),tm=kantoMachine(input.tmId),p=input.student;
 if(!stock||!tm||!Number.isSafeInteger(p.uid)||p.uid<1||!Number.isSafeInteger(p.speciesId)||p.speciesId<1||p.speciesId>151)return {status:'invalid'} as const;
 if(input.busy)return {status:'busy'} as const;
 if(!policy.executableMove(tm.moveName))return {status:'unavailable'} as const;
 if(!policy.compatibleSpecies(tm.id)?.includes(p.speciesId))return {status:'incompatible'} as const;
 const lessons=p.lessons??[];
 if(!Array.isArray(lessons)||lessons.some(l=>!l||!kantoMachine(l.tmId)||!Number.isSafeInteger(l.speciesId)||!policy.compatibleSpecies(l.tmId)?.includes(l.speciesId))||new Set(lessons.map(l=>l.tmId)).size!==lessons.length)return {status:'invalid'} as const;
 if(lessons.some(l=>l.tmId===tm.id)||p.knownMoveNames.includes(tm.moveName))return {status:'already-learned'} as const;
 const count=stock[tm.id]??0;
 if(count<1)return {status:'no-stock'} as const;
 const next:MachineStock={...stock};
 if(count===1)delete next[tm.id];else next[tm.id]=count-1;
 return {status:'ok',uid:p.uid,tmId:tm.id,moveName:tm.moveName,stock:next,lessons:[...lessons,{tmId:tm.id,speciesId:p.speciesId}]} as const;
}
