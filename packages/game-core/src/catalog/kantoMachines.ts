/** FRLG TM01–TM50 identities from pinned PokéAPI machines.csv + moves.csv.
 * Identity is not eligibility, executable move metadata, or an acquisition rule.
 * HMs 101–108 deliberately excluded. No runtime requests. */
import {KANTO_TM_SOURCE_COMMIT,KANTO_TM_SOURCE_BLOBS} from './kantoTmPreview.js';
export const KANTO_MACHINE_SOURCE=Object.freeze({commit:KANTO_TM_SOURCE_COMMIT,machines:KANTO_TM_SOURCE_BLOBS.machines,moves:KANTO_TM_SOURCE_BLOBS.moves,pokemonMoves:KANTO_TM_SOURCE_BLOBS.pokemonMoves,versionGroupId:7,learnMethodId:4});
export const KANTO_MACHINES=Object.freeze([
 Object.freeze({"number":1,"id":"tm01","itemId":305,"moveId":264,"moveName":"focus-punch"}),
 Object.freeze({"number":2,"id":"tm02","itemId":306,"moveId":337,"moveName":"dragon-claw"}),
 Object.freeze({"number":3,"id":"tm03","itemId":307,"moveId":352,"moveName":"water-pulse"}),
 Object.freeze({"number":4,"id":"tm04","itemId":308,"moveId":347,"moveName":"calm-mind"}),
 Object.freeze({"number":5,"id":"tm05","itemId":309,"moveId":46,"moveName":"roar"}),
 Object.freeze({"number":6,"id":"tm06","itemId":310,"moveId":92,"moveName":"toxic"}),
 Object.freeze({"number":7,"id":"tm07","itemId":311,"moveId":258,"moveName":"hail"}),
 Object.freeze({"number":8,"id":"tm08","itemId":312,"moveId":339,"moveName":"bulk-up"}),
 Object.freeze({"number":9,"id":"tm09","itemId":313,"moveId":331,"moveName":"bullet-seed"}),
 Object.freeze({"number":10,"id":"tm10","itemId":314,"moveId":237,"moveName":"hidden-power"}),
 Object.freeze({"number":11,"id":"tm11","itemId":315,"moveId":241,"moveName":"sunny-day"}),
 Object.freeze({"number":12,"id":"tm12","itemId":316,"moveId":269,"moveName":"taunt"}),
 Object.freeze({"number":13,"id":"tm13","itemId":317,"moveId":58,"moveName":"ice-beam"}),
 Object.freeze({"number":14,"id":"tm14","itemId":318,"moveId":59,"moveName":"blizzard"}),
 Object.freeze({"number":15,"id":"tm15","itemId":319,"moveId":63,"moveName":"hyper-beam"}),
 Object.freeze({"number":16,"id":"tm16","itemId":320,"moveId":113,"moveName":"light-screen"}),
 Object.freeze({"number":17,"id":"tm17","itemId":321,"moveId":182,"moveName":"protect"}),
 Object.freeze({"number":18,"id":"tm18","itemId":322,"moveId":240,"moveName":"rain-dance"}),
 Object.freeze({"number":19,"id":"tm19","itemId":323,"moveId":202,"moveName":"giga-drain"}),
 Object.freeze({"number":20,"id":"tm20","itemId":324,"moveId":219,"moveName":"safeguard"}),
 Object.freeze({"number":21,"id":"tm21","itemId":325,"moveId":218,"moveName":"frustration"}),
 Object.freeze({"number":22,"id":"tm22","itemId":326,"moveId":76,"moveName":"solar-beam"}),
 Object.freeze({"number":23,"id":"tm23","itemId":327,"moveId":231,"moveName":"iron-tail"}),
 Object.freeze({"number":24,"id":"tm24","itemId":328,"moveId":85,"moveName":"thunderbolt"}),
 Object.freeze({"number":25,"id":"tm25","itemId":329,"moveId":87,"moveName":"thunder"}),
 Object.freeze({"number":26,"id":"tm26","itemId":330,"moveId":89,"moveName":"earthquake"}),
 Object.freeze({"number":27,"id":"tm27","itemId":331,"moveId":216,"moveName":"return"}),
 Object.freeze({"number":28,"id":"tm28","itemId":332,"moveId":91,"moveName":"dig"}),
 Object.freeze({"number":29,"id":"tm29","itemId":333,"moveId":94,"moveName":"psychic"}),
 Object.freeze({"number":30,"id":"tm30","itemId":334,"moveId":247,"moveName":"shadow-ball"}),
 Object.freeze({"number":31,"id":"tm31","itemId":335,"moveId":280,"moveName":"brick-break"}),
 Object.freeze({"number":32,"id":"tm32","itemId":336,"moveId":104,"moveName":"double-team"}),
 Object.freeze({"number":33,"id":"tm33","itemId":337,"moveId":115,"moveName":"reflect"}),
 Object.freeze({"number":34,"id":"tm34","itemId":338,"moveId":351,"moveName":"shock-wave"}),
 Object.freeze({"number":35,"id":"tm35","itemId":339,"moveId":53,"moveName":"flamethrower"}),
 Object.freeze({"number":36,"id":"tm36","itemId":340,"moveId":188,"moveName":"sludge-bomb"}),
 Object.freeze({"number":37,"id":"tm37","itemId":341,"moveId":201,"moveName":"sandstorm"}),
 Object.freeze({"number":38,"id":"tm38","itemId":342,"moveId":126,"moveName":"fire-blast"}),
 Object.freeze({"number":39,"id":"tm39","itemId":343,"moveId":317,"moveName":"rock-tomb"}),
 Object.freeze({"number":40,"id":"tm40","itemId":344,"moveId":332,"moveName":"aerial-ace"}),
 Object.freeze({"number":41,"id":"tm41","itemId":345,"moveId":259,"moveName":"torment"}),
 Object.freeze({"number":42,"id":"tm42","itemId":346,"moveId":263,"moveName":"facade"}),
 Object.freeze({"number":43,"id":"tm43","itemId":347,"moveId":290,"moveName":"secret-power"}),
 Object.freeze({"number":44,"id":"tm44","itemId":348,"moveId":156,"moveName":"rest"}),
 Object.freeze({"number":45,"id":"tm45","itemId":349,"moveId":213,"moveName":"attract"}),
 Object.freeze({"number":46,"id":"tm46","itemId":350,"moveId":168,"moveName":"thief"}),
 Object.freeze({"number":47,"id":"tm47","itemId":351,"moveId":211,"moveName":"steel-wing"}),
 Object.freeze({"number":48,"id":"tm48","itemId":352,"moveId":285,"moveName":"skill-swap"}),
 Object.freeze({"number":49,"id":"tm49","itemId":353,"moveId":289,"moveName":"snatch"}),
 Object.freeze({"number":50,"id":"tm50","itemId":354,"moveId":315,"moveName":"overheat"}),
] as const);
export type KantoMachine=typeof KANTO_MACHINES[number];
export type KantoMachineId=KantoMachine['id'];
export function kantoMachine(id:unknown):KantoMachine|null{
 return KANTO_MACHINES.find(tm=>tm.id===id)??null;
}
/** Optional independent pocket, not extra backpack gear slots. No initial grants.
 * Strict validation; caps are intentionally left to the future economy policy. */
export type MachineStock=Partial<Record<KantoMachineId,number>>;
export function inspectMachineStock(input:unknown):MachineStock|null{
 if(input===undefined)return {};
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const stock:MachineStock={};
 for(const [id,count] of Object.entries(input)){
  const machine=kantoMachine(id);
  if(!machine||typeof count!=='number'||!Number.isSafeInteger(count)||count<0)return null;
  if(count>0)stock[machine.id]=count;
 }
 return stock;
}
