import type {ServerClockSample} from './expeditionDisplay';
import {parseLegacySave} from '../storage/legacySave';
import type {PlayRead,PlaySnapshot,PlayAction} from './playSave';
import type {GymTurnAction,KantoBattleVisualFrame} from '@kanto/game-core';
export type Actor={speciesId:number;level?:number;hp:number;maxHp:number;sp:number;maxSp:number;status:string|null};
export type Party={activeIndex:number;needsReplacement:boolean;fighters:Actor[]};
export type Encounter={id:string;phase:'reserved'|'await-player'|'resolved'|'certified'|'paid';turn:number;outcome:string|null;log:string[];recommendedAction:GymTurnAction|null};
export type RegionEncounter=Encounter&{regionId:number;level:number;playerLevel:number;player:Actor|null;wild:Actor|null;frames:KantoBattleVisualFrame[];captureChoices:{ballId:string;quantity:number}[]};
export type GymDisplay={player:Party;opponent:Party};
export type GymPresentation={before:GymDisplay;events:{display:GymDisplay;frame:KantoBattleVisualFrame}[];turn:number;logOffset:number};
export type GymEncounter=Encounter&{presentation:GymPresentation|null;narration:({turn:number;side:'player'|'opponent';actor:number;foe:number;entered:number}|null)[];gymId:string;leader:string;actionNumber:number;player:Party|null;opponent:Party|null};
export type RegionView={revision:number;encounter:RegionEncounter|null;pendingLoot:boolean;regions:{id:number;unlocked:boolean}[]};
export type GymView={revision:number;gym:GymEncounter|null;canReserve:boolean;nextGym:{gymId:string;leader:string;leaderLevel:number;teamUids:number[]}|null};
import {pokemonMoveSlots} from '@kanto/game-core';
import type {LegacyPokemon} from '../storage/legacySave';
/** The server's authoritative slots are not the local save's moveNames. */
export function onlineMoveSlots(p:LegacyPokemon,fallback:string):readonly string[]{
 const slots=p.equippedMoveNames;
 return Array.isArray(slots)&&slots.length>=1&&slots.length<=4&&slots.every(n=>typeof n==='string')&&new Set(slots).size===slots.length
  ?slots as string[]:pokemonMoveSlots({moveName:p.moveName},fallback);
}
export type RegionalReward={outcome:string;trainerXp:number;pokemonXp:number;coins:number;loot:{stored:RegionalDrop[];pending:RegionalDrop[]};capture:'captured'|'failed'|'skipped'|null};
type RegionalDrop={kind:'ball'|'stone';itemId:string;quantity:number}|{kind:'gear';gear:{templateId:string;rarity:string}};
import type {onlineInventoryProjection,onlineShopProjection,onlineExpeditionProjection} from '@kanto/game-core';
import type {PendingRegionalLoot,PendingExpeditionLoot} from '@kanto/game-core';
export type InventoryView=NonNullable<ReturnType<typeof onlineInventoryProjection>> & {revision:number;pending:PendingRegionalLoot|null;expeditionPending:PendingExpeditionLoot|null;canResolveExpeditionLoot:boolean};
export type ShopView=NonNullable<ReturnType<typeof onlineShopProjection>> & {revision:number};
export type ExpeditionView=NonNullable<ReturnType<typeof onlineExpeditionProjection>> & {revision:number;busy:boolean};
import type {onlineMasteryProjection} from '@kanto/game-core';
export type MasteryView=NonNullable<ReturnType<typeof onlineMasteryProjection>> & {revision:number};
export interface OnlineViews {mastery?:MasteryView|null;inventory:InventoryView|null;shop:ShopView|null;expedition:ExpeditionView|null;expeditionClock:ServerClockSample|null;region:RegionView|null;gym:GymView|null}
export async function readOnlineViews(revision:number):Promise<OnlineViews>{
 async function load<T>(path:string):Promise<T|null>{try{const r=await get(path);if(!r.ok)return null;const v=await r.json();return v?.status==='ok'&&v.revision===revision?v as T:null;}catch{return null;}}
 const expeditionRequest=load<ExpeditionView>('expedition/current').then(expedition=>({expedition,expeditionClock:expedition?{serverNowMs:expedition.serverNowMs,receivedAt:performance.now()}:null}));
 const [inventory,shop,expeditionResult,region,gym,mastery]=await Promise.all([load<InventoryView>('inventory/current'),load<ShopView>('shop/current'),expeditionRequest,load<RegionView>('region/current'),load<GymView>('gym/current'),load<MasteryView>('mastery/current')]);
 return {inventory,shop,...expeditionResult,region,gym,mastery};
}
export async function sendOnlineCommand(path:'inventory/loadout'|'shop/purchase'|'mastery/research',fields:Record<string,unknown>,revision:number){
 const r=await post(path,{...fields,actionId:crypto.randomUUID(),expectedRevision:revision});
 // Consume the complete server receipt before triggering a new refresh.
 const receipt=await r.json();
 if(!r.ok)return false;
 if(path==='mastery/research')return receipt?.status==='applied'&&receipt.revision===revision+1;
 if(path==='shop/purchase'&&Array.isArray(fields.items))return receipt?.status==='purchased'&&receipt.revision===revision+1&&Array.isArray(receipt.purchase?.items)&&receipt.purchase.items.length>0;
 return true;
}

type Account={name:string;save:PlayRead};
// The private web proxy already bounds the upstream request. Also bound the
// browser's full response (including body reads) so a lost connection never
// leaves an action pending forever. Do not automatically retry mutations.
const get=(path:string)=>fetch('/api/v1/'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
const post=(path:string,body:unknown)=>fetch('/api/v1/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
export function parseOnlineSnapshot(input:unknown):PlayRead{
 if(!input||typeof input!=='object')return {status:'invalid'};
 const row=input as {schema_version?:unknown;revision?:unknown;state?:PlaySnapshot};
 if(typeof row.revision!=='string'&&typeof row.revision!=='number')return {status:'invalid'};
 const rev=Number(row.revision),s=row.state;
 if(row.schema_version!==2||!Number.isSafeInteger(rev)||rev<0||s?.schemaVersion!==2||s.revision!==rev||s.journal?.revision!==rev||typeof s.journal.raw!=='string')return {status:'invalid'};
 const parsed=parseLegacySave(s.journal.raw);
 if(parsed.status!=='valid')return {status:'invalid'};
 const {roster,team}=parsed.save,uids=new Set(roster.map(p=>p.uid));
 if(uids.size!==roster.length||team.length<1||team.length>3||new Set(team).size!==team.length||!team.every(uid=>uids.has(uid))||roster.some(p=>p.uid<1||p.pokemonId<1||p.pokemonId>151))return {status:'invalid'};
 return {status:'ready',snapshot:s};
}
export async function readOnlineAccount():Promise<Account>{
 const me=await get('me');
 if(me.status===401){window.location.replace('/');throw Error('Sessão encerrada.');}
 if(!me.ok)throw Error('Conta indisponível.');
 const user=await me.json();
 if(typeof user.trainerName!=='string')throw Error('Conta inválida.');
 const save=await get('save');
 if(save.status===401){window.location.replace('/');throw Error('Sessão encerrada.');}
 if(save.status===404)return {name:user.trainerName,save:{status:'absent'}};
 if(!save.ok)throw Error('Progresso indisponível.');
 return {name:user.trainerName,save:parseOnlineSnapshot(await save.json())};
}
export async function startOnline(starterId:number){return post('adventure/start',{starterId});}
export async function logoutOnline(){const r=await post('auth/logout',{});if(!r.ok)throw Error('Não foi possível sair.');window.location.replace('/');}
export function onlineCommand(action:PlayAction,snapshot:PlaySnapshot):{path:string;fields:Record<string,unknown>}|null{
 const game=parseLegacySave(snapshot.journal.raw);
 if(game.status!=='valid')return null;
 const data=game.save;
 switch(action.type){
 case 'pokemon-invest-batch':return {path:'pokemon-training/train',fields:{pokemonUid:action.uid,increments:action.increments,reset:false}};
 case 'evolution':return {path:'evolution/evolve',fields:{pokemonUid:action.uid,targetSpeciesId:action.targetSpeciesId}};
 case 'buy-ball':return {path:'shop/purchase',fields:{ballId:action.ballId,quantity:action.quantity}};
 case 'start-expedition':return {path:'expedition/start',fields:{regionId:action.regionId}};
 case 'claim-expedition':return {path:'expedition/claim',fields:{}};
 case 'stop-expedition':return {path:'expedition/stop',fields:{}};
 case 'trainer-invest-batch':return {path:'trainer/invest',fields:{increments:action.increments}};
 case 'trainer':return action.value.type==='title'?{path:'inventory/loadout',fields:{command:{kind:'title',titleId:action.value.titleId}}}:action.value.type==='equip'?{path:'inventory/loadout',fields:{command:{kind:'equipment',slot:action.value.slot,itemId:action.value.itemId||null}}}:null;
 case 'pokemon':{
  const a=action.value;
  if(a.type==='reset-pokemon')return {path:'pokemon-training/train',fields:{pokemonUid:a.uid,increments:{},reset:true}};
  const team=[...data.team];
  if(a.type==='add-team'&&!team.includes(a.uid)&&team.length<3)team.push(a.uid);
  else if(a.type==='remove-team'&&team.includes(a.uid)&&team.length>1)team.splice(team.indexOf(a.uid),1);
  else if(a.type==='set-active'&&team.includes(a.uid)){team.splice(team.indexOf(a.uid),1);team.unshift(a.uid);}
  else return null;
  return {path:'collection/team',fields:{teamUids:team}};
 }
 case 'move':{
  if(action.operation==='upgrade')return {path:'moves/upgrade',fields:{pokemonUid:action.uid,moveName:action.moveName}};
  const p=data.roster.find(p=>p.uid===action.uid);if(!p)return null;
  const current=[...onlineMoveSlots(p,typeof p.moveName==='string'?p.moveName:'tackle')];
  const names=current.includes(action.moveName)?[action.moveName,...current.filter(n=>n!==action.moveName)]:[action.moveName,...current.slice(1)];
  return {path:'moves/equip',fields:{pokemonUid:action.uid,moveNames:names}};
 }
 case 'move-set':{
  const p=data.roster.find(p=>p.uid===action.uid);if(!p)return null;
  let names=[...onlineMoveSlots(p,typeof p.moveName==='string'?p.moveName:'tackle')];
  if(action.operation==='add'&&!names.includes(action.moveName))names.push(action.moveName);
  else if(action.operation==='remove'&&names.includes(action.moveName)&&names.length>1)names=names.filter(n=>n!==action.moveName);
  else if(action.operation==='primary'&&names.includes(action.moveName))names=[action.moveName,...names.filter(n=>n!==action.moveName)];
  else return null;
  return {path:'moves/equip',fields:{pokemonUid:action.uid,moveNames:names}};
 }
 default:return null;
 }
}
export async function sendOnlineAction(action:PlayAction,snapshot:PlaySnapshot){
 const command=onlineCommand(action,snapshot);
 if(!command)return false;
 const response=await post(command.path,{...command.fields,actionId:crypto.randomUUID(),expectedRevision:snapshot.revision});
 // Read the entire reply before refreshing or closing the action. In
 // particular, trainer investment confirms the actual atomic revision.
 const receipt=await response.json();
 if(!response.ok)return false;
 if(action.type==='trainer-invest-batch')return receipt?.status==='ok'&&
   receipt.revision===snapshot.revision+1&&
   !!receipt.allocated&&Object.entries(action.increments).every(([stat,n])=>
     typeof receipt.allocated[stat]==='number'&&receipt.allocated[stat]>=Number(n));
 return true;
}

/** Only server-provided encounter IDs, revisions and legal decisions are sent. */
export async function onlineBattleCommand(mode:'region'|'gym',view:RegionView|GymView,command:'open'|'turn'|'reward'|'finish',regionId:number,choice?:string){
 const send=async(kind:string,fields:Record<string,unknown>)=>{const r=await post(mode+'/'+kind,fields);if(!r.ok)throw Error('Ação de combate recusada');return await r.json();};
 const aid=()=>crypto.randomUUID();let rev=view.revision;
 let e='encounter' in view?view.encounter:view.gym;
 const key=mode==='region'?'encounterId':'gymReservationId';
 if(command==='open'){
  if(!e){const v=await send('reserve',{actionId:aid(),expectedRevision:rev,...(mode==='region'?{regionId}:{})});rev=v.revision;e=mode==='region'?v.encounter:{id:v.gymReservationId,phase:'reserved'};}
  if(e?.phase==='reserved')await send('start',{[key]:e.id,expectedRevision:rev});return;
 }
 if(!e)throw Error('Combate indisponível');
 if(command==='turn'){if(e.phase!=='await-player'||!e.recommendedAction)throw Error('Sem ação legal');await send('turn',{[key]:e.id,actionId:aid(),expectedRevision:rev,action:e.recommendedAction});return;}
 if(command==='reward'){if(e.phase==='resolved'){const v=await send('certify',{[key]:e.id,actionId:aid(),expectedRevision:rev});rev=v.revision;}else if(e.phase!=='certified')throw Error('Resultado indisponível');await send('settle',{[key]:e.id,actionId:aid(),expectedRevision:rev});return;}
 if(mode==='region'&&e.phase==='paid'&&choice)return await send('finish',{[key]:e.id,actionId:aid(),expectedRevision:rev,choice});
 throw Error('Ação indisponível');
}
