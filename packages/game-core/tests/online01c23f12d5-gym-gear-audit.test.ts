/** D5A: paired deterministic balance experiment. No save mutation, NPC
 * tuning, reward grants or fabricated TM. Results are printed to CI logs.
 * Sampled gear is conditional on a drop, not an estimate of time to farm.
 */
import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {KANTO_REGIONS,kantoRegionalSpeciesPool} from '../src/map/kantoRegions.js';
import {kantoCaptureStartingLevel} from '../src/catalog/kantoEvolution.js';
import {KANTO_BATTLE_SPECIES,kantoTypeMultiplier} from '../src/combat/kantoBattle.js';
import {regionalNativeMoves} from '../src/combat/serverInheritedMoves.js';
import {canonicalOnlineGymEquippedMoves,canonicalOnlineGymOpeningState,canonicalOnlineGymTrainerBonuses} from '../src/combat/serverGymPreparation.js';
import {validatedOnlineMoveRanks} from '../src/combat/serverMoveRanks.js';
import {gymPokemonTraining,gymOpponentRanks,prepareGymLeader} from '../src/gyms/gymTactics.js';
import {gymChooseAiAction,resolveGymAiTurn} from '../src/gyms/gymAiTurn.js';
import {GYM_MAX_TURNS} from '../src/gyms/gymTurn.js';
import {rollRegionalLoot} from '../src/inventory/regionalLoot.js';
import {createOnlineDropGear,createOnlineShopGear} from '../src/inventory/onlineOwnership.js';
import type {OnlineGearInstance} from '../src/inventory/onlineOwnership.js';
import {BASIC_GEAR_CATALOG} from '../src/shop/basicGearCatalog.js';
import {STATS} from '../src/stats/types.js';
// Node/Vitest provides console; core deliberately excludes DOM and Node globals.
declare const console:{log(message:string):void};
const modes=['none','shop','sampled','selected'] as const;
type Mode=typeof modes[number];
const seeds=Array.from({length:12},(_,i)=>(Math.imul(i+1,0x9e3779b9)^0x85ebca6b)>>>0);
const uid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function random(seed:number){
 let state=seed>>>0;
 return (max:number)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return Math.floor(state/2**32*max);};
}
const sum=(g:OnlineGearInstance)=>Object.values(g.stats).reduce((a,b)=>a+(b??0),0);
function equipment(level:number,regionId:number,mode:Mode,seed:number){
 if(mode==='none')return [];
 if(mode==='shop'){
  const slots=new Set<string>();
  return BASIC_GEAR_CATALOG.flatMap((o,i)=>{if(slots.has(o.slot))return [];slots.add(o.slot);return [createOnlineShopGear(uid(i+1),o.id)!];});
 }
 const region=KANTO_REGIONS[regionId-1]!,wildLevel=region.levelMin;
 const speciesId=kantoRegionalSpeciesPool(region,wildLevel)[0]!.speciesId;
 const rng=random(seed),items=new Map<string,OnlineGearInstance>();
 // Uniform slot order is forced only to ensure nine slots; the rest of
 // each conditional drop uses the canonical random generation algorithm.
 for(let slot=0;slot<9;slot++){
  let accepted=0;
  for(let i=0;i<256&&accepted<(mode==='selected'?12:1);i++){
   let call=0;
   const roll=rollRegionalLoot({regionId,speciesId,wildLevel,trainerLevel:level,pokemonLevel:level,won:true},
    max=>{call++;return call===1?0:call===2?slot:rng(max);},max=>max-1)!.gear!;
   if(roll.requiredLevel>level)continue;
   const item=createOnlineDropGear(uid(slot*1000+i+1),roll)!;
   if(!item)throw Error('invalid sample');
   const prior=items.get(item.slot);
   if(!prior||sum(item)>sum(prior))items.set(item.slot,item);
   accepted++;
  }
  if(!items.size||items.size!==slot+1)throw Error('no eligible item for slot '+slot);
 }
 return [...items.values()];
}
function teams(gym:typeof KANTO_GYMS[number],level:number){
 const accessible=KANTO_REGIONS.filter(r=>r.trainerUnlockLevel<=gym.trainerLevel&&r.levelMin<=level);
 const excludedNoSharedAttack:number[]=[];
 const candidates=accessible.flatMap(r=>r.speciesIds.filter(id=>!r.rareSpeciesIds.includes(id))).filter(id=>kantoCaptureStartingLevel(id)<=level&&!!KANTO_BATTLE_SPECIES[id]).map(id=>{
  const species=KANTO_BATTLE_SPECIES[id]!;
  // Region fallback moves may cease to be legal in Gym when a real
  // Gym-only psychic attack exists. Sample only slots a player can equip
  // online AND carry into Gym, never manufacture a TM or relax validation.
  const native=[...regionalNativeMoves(id,level).values()].filter(m=>
   canonicalOnlineGymEquippedMoves(id,level,[m.name])!==null);
  const attacks=native.filter(m=>m.category!=='status'&&m.power>0);
  if(!attacks.length){excludedNoSharedAttack.push(id);return null;}
  const score=(m:typeof native[number])=>m.power*m.accuracy/100*(species.types.includes(m.type)?1.5:1)*(m.category==='physical'?species.base.attack:species.base.specialAttack);
  const moves=[...attacks.sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name)).slice(0,3),...native.filter(m=>m.category==='status').slice(0,1)].slice(0,4);
  expect(canonicalOnlineGymEquippedMoves(id,level,moves.map(m=>m.name))).not.toBeNull();
  const base=STATS.reduce((s,k)=>s+species.base[k],0);
  const coverage=gym.team.reduce((s,p)=>s+Math.max(0,...attacks.map(m=>kantoTypeMultiplier(m.type,KANTO_BATTLE_SPECIES[p.speciesId]!.types))),0);
  return {id,species,moves,base,coverage};
 }).filter(x=>x!==null);
 const median=[...candidates].sort((a,b)=>a.base-b.base)[Math.floor(candidates.length/2)]!.base;
 const choose=(strategy:'ordinary'|'mixed'|'counter')=>{
  const sorted=[...candidates].sort((a,b)=>(strategy==='ordinary'?Math.abs(a.base-median)-Math.abs(b.base-median):strategy==='counter'?b.coverage-a.coverage:0)||b.base-a.base||a.id-b.id);
  const distinct=new Set<string>(),chosen:typeof sorted=[];
  for(const p of sorted){const t=p.species.types[0]!;if(distinct.has(t))continue;distinct.add(t);chosen.push(p);if(chosen.length===3)break;}
  if(chosen.length!==3)throw Error('insufficient candidate team');
  return chosen.map((p,i)=>({uid:i+1,pokemonId:p.id,level,affinity:75,
   manual:gymPokemonTraining(p.id,level,p.moves),moveName:p.moves[0]!.name,equippedMoveNames:p.moves.map(m=>m.name),
   upgrades:Object.fromEntries(Object.entries(gymOpponentRanks(p.id,level,p.moves)).filter(([name,n])=>n>0&&regionalNativeMoves(p.id,level).has(name)))}));
 };
 return {excludedNoSharedAttack,regionId:accessible.at(-1)!.id,ordinary:choose('ordinary'),mixed:choose('mixed'),counter:choose('counter')};
}
describe('D5A paired gym balance matrix',()=>{
 for(const gym of KANTO_GYMS)it(gym.leader+' — same team/seed across four gear policies',()=>{
  const level=Math.round((gym.recommendedMinLevel+gym.recommendedMaxLevel)/2),selected=teams(gym,level);
  const rows=[];
  const rareIds=new Set(KANTO_REGIONS.flatMap(r=>r.rareSpeciesIds));
  for(const strategy of ['ordinary','mixed','counter'] as const)expect(selected[strategy].every(p=>!rareIds.has(p.pokemonId))).toBe(true);
  for(const strategy of ['ordinary','mixed','counter'] as const){
   const roster=selected[strategy];
   for(const p of roster){
    expect(canonicalOnlineGymEquippedMoves(p.pokemonId,p.level,p.equippedMoveNames),`Gym slots ${gym.leader} ${p.pokemonId}`).not.toBeNull();
    expect(validatedOnlineMoveRanks(p.pokemonId,p.level,undefined,p.upgrades),`Rank budget ${gym.leader} ${p.pokemonId}`).not.toBeNull();
   }
   for(const mode of modes){
    let wins=0,draws=0,losses=0,turns=0,gearSum=0;
    for(const seed of seeds){
     const gear=equipment(gym.trainerLevel,selected.regionId,mode,seed);
     const raw={version:1,mode:'normal',trainer:{level:gym.trainerLevel,manual:prepareGymLeader(gym).manual,title:'veterano',equipped:Object.fromEntries(gear.map(i=>[i.slot,i.id]))},
      inventory:{version:1,gear,extraBagSlots:0},wins:4,seen:roster.map(p=>p.pokemonId),badges:KANTO_GYMS.slice(0,gym.order-1).map(g=>g.id),
      team:[1,2,3],roster,nextUid:4,expedition:null};
     const opening=canonicalOnlineGymOpeningState(raw);if(!opening)throw Error('invalid audit fixture '+JSON.stringify({gym:gym.leader,strategy,mode,trainerValid:!!canonicalOnlineGymTrainerBonuses(raw),roster}));
     let state=opening.battle;const rng=random(seed);
     for(let step=0;state.outcome==='ongoing'&&step<GYM_MAX_TURNS+8;step++){
      const next=resolveGymAiTurn(state,gymChooseAiAction(state,'player'),rng(2**32));
      if(next.status!=='applied')throw Error(next.reason);state=next.state;
     }
     if(state.outcome==='player-win')wins++;else if(state.outcome==='leader-win')losses++;else if(state.outcome==='draw')draws++;else throw Error('unfinished battle');
     turns+=state.turn;gearSum+=gear.reduce((n,g)=>n+sum(g),0);
    }
    expect(wins+draws+losses).toBe(seeds.length);
    rows.push({strategy,team:roster.map(p=>p.pokemonId),mode,wins,draws,losses,avgTurns:turns/seeds.length,avgGear:gearSum/seeds.length});
   }
  }
  console.log('D5A_GYM_RESULT '+JSON.stringify({gym:gym.leader,level,trainerLevel:gym.trainerLevel,region:selected.regionId,seedCount:seeds.length,excludedNoSharedAttack:selected.excludedNoSharedAttack,rows}));
 },60000);
});
