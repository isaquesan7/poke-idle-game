import {parseLegacySave} from '../storage/legacySave';
import type {PlayRead,PlaySnapshot,PlayAction} from './playSave';
import {STATS,pokemonMoveSlots} from '@kanto/game-core';
import type {onlineInventoryProjection,onlineShopProjection,onlineExpeditionProjection} from '@kanto/game-core';
import type {PendingRegionalLoot,PendingExpeditionLoot} from '@kanto/game-core';
export type InventoryView=NonNullable<ReturnType<typeof onlineInventoryProjection>> & {revision:number;pending:PendingRegionalLoot|null;expeditionPending:PendingExpeditionLoot|null;canResolveExpeditionLoot:boolean};
export type ShopView=NonNullable<ReturnType<typeof onlineShopProjection>> & {revision:number};
export type ExpeditionView=NonNullable<ReturnType<typeof onlineExpeditionProjection>> & {revision:number;busy:boolean};
export interface OnlineViews {inventory:InventoryView|null;shop:ShopView|null;expedition:ExpeditionView|null;clockOffset:number}
export async function readOnlineViews(revision:number):Promise<OnlineViews>{
 async function load<T>(path:string):Promise<T|null>{try{const r=await get(path);if(!r.ok)return null;const v=await r.json();return v?.status==='ok'&&v.revision===revision?v as T:null;}catch{return null;}}
 const [inventory,shop,expedition]=await Promise.all([load<InventoryView>('inventory/current'),load<ShopView>('shop/current'),load<ExpeditionView>('expedition/current')]);
 return {inventory,shop,expedition,clockOffset:expedition?expedition.serverNowMs-Date.now():0};
}
export async function sendOnlineCommand(path:'inventory/loadout'|'shop/purchase',fields:Record<string,unknown>,revision:number){const r=await post(path,{...fields,actionId:crypto.randomUUID(),expectedRevision:revision});return r.ok;}

type Account={name:string;save:PlayRead};
const get=(path:string)=>fetch('/api/v1/'+path,{credentials:'same-origin',cache:'no-store'});
const post=(path:string,body:unknown)=>fetch('/api/v1/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
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
 case 'trainer-invest-batch':{
  const entries=STATS.filter(k=>(action.increments[k]??0)>0);
  return entries.length===1&&action.increments[entries[0]!]===1?{path:'trainer/invest',fields:{stat:entries[0]}}:null;
 }
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
 case 'move':return action.operation==='upgrade'?{path:'moves/upgrade',fields:{pokemonUid:action.uid,moveName:action.moveName}}:null;
 case 'move-set':{
  const p=data.roster.find(p=>p.uid===action.uid);if(!p)return null;
  let names=[...pokemonMoveSlots(p,typeof p.moveName==='string'?p.moveName:'tackle')];
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
 return response.ok;
}
