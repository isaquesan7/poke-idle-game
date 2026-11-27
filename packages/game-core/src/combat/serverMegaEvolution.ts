/** MEGA02: pure private transition; the future SQL writer must lock save,
 * check external encounter/expedition activity, revision and action receipt.
 * No acquisition, endpoint or battle integration yet.
 */
import {KANTO_MEGA_FORMS,kantoMegaForm,kantoMegaOptions,quoteKantoMegaChoice,inspectMegaStoneStock} from '../catalog/kantoMegaForms.js';
import {KANTO_GYMS} from '../gyms/kantoGyms.js';
import {masteryBonusFromSave} from '../progression/kantoMastery.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
export const KANTO_MEGA_REQUIREMENTS=Object.freeze({level:100,affinity:100,masteryRank:5,badges:8});
type Student={uid:number;pokemonId:number;level:number;affinity:number;megaForm?:unknown};
function checked(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal'||state.evolutionTestKitClaimed===true)return null;
 const stock=inspectMegaStoneStock(state.megaStoneStock);
 if(!stock||new Set(state.badges).size!==state.badges.length||state.badges.some((id:unknown)=>!KANTO_GYMS.some(g=>g.id===id)))return null;
 const roster=state.roster as Student[];
 if(roster.some(p=>!masteryBonusFromSave(state.research,p.pokemonId)))return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available'||state.pendingRegionalLoot!=null||state.pendingExpeditionLoot!=null;
 return {state,stock,roster,busy};
}
function requirements(c:NonNullable<ReturnType<typeof checked>>,p:Student,stoneId:typeof KANTO_MEGA_FORMS[number]['stoneId']){
 const req=KANTO_MEGA_REQUIREMENTS;
 return {level:p.level>=req.level,affinity:p.affinity>=req.affinity,
  mastery:masteryBonusFromSave(c.state.research,p.pokemonId)!.rank>=req.masteryRank,
  badges:KANTO_GYMS.every(g=>c.state.badges.includes(g.id)),stone:(c.stock[stoneId]??0)>0};
}
export function onlineMegaProjection(raw:string){
 const c=checked(raw);if(!c)return null;
 return {busy:c.busy,requirements:KANTO_MEGA_REQUIREMENTS,
  stones:KANTO_MEGA_FORMS.map(f=>({id:f.stoneId,formId:f.id,quantity:c.stock[f.stoneId]??0})),
  pokemon:c.roster.filter(p=>KANTO_MEGA_FORMS.some(f=>f.speciesId===p.pokemonId)).map(p=>({
   uid:p.uid,speciesId:p.pokemonId,currentForm:kantoMegaForm(p.megaForm)?.id??null,
   options:kantoMegaOptions(p.pokemonId,p.megaForm).map(form=>{
    const met=requirements(c,p,form.stoneId);
    return {form,met,available:!c.busy&&Object.values(met).every(Boolean)};
   })
  }))};
}
export function applyOnlineMegaEvolution(raw:string,command:unknown){
 if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).sort().join(',')!=='formId,uid')return {status:'invalid'} as const;
 const {uid,formId}=command as {uid:unknown;formId:unknown};
 const form=kantoMegaForm(formId);
 if(typeof uid!=='number'||!Number.isSafeInteger(uid)||uid<1||!form)return {status:'invalid'} as const;
 const c=checked(raw);if(!c)return {status:'invalid-save'} as const;
 if(c.busy)return {status:'busy'} as const;
 const p=c.roster.find(p=>p.uid===uid);
 if(!p)return {status:'missing-pokemon'} as const;
 const q=quoteKantoMegaChoice(p,form.id);
 if(q.status!=='ok')return q;
 const met=requirements(c,p,form.stoneId);
 if(!met.level||!met.affinity||!met.mastery||!met.badges)return {status:'requirements',met} as const;
 if(!met.stone)return {status:'no-stock'} as const;
 const quantity=(c.stock[form.stoneId]??0)-1;
 if(quantity===0)delete c.stock[form.stoneId];else c.stock[form.stoneId]=quantity;
 c.state.megaStoneStock=c.stock;p.megaForm=form.id;
 const next=JSON.stringify(c.state);
 if(!checked(next))return {status:'invalid-save'} as const;
 return {...q,raw:next,remaining:quantity} as const;
}
