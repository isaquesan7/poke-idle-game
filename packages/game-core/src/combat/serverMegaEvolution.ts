/** Santuário Mega: pure eligibility and individual entitlements.
 * The victory reducer is PRIVATE: only a future certified trial writer may
 * call it, inside an account/save/encounter lock. Never expose it as an HTTP
 * action or accept an outcome from the browser. No wild drops or shared stock.
 */
import {KANTO_MEGA_FORMS,kantoMegaForm,kantoMegaOptions,quoteKantoMegaChoice} from '../catalog/kantoMegaForms.js';
import type {KantoMegaForm,KantoMegaFormId} from '../catalog/kantoMegaForms.js';
import {KANTO_GYMS} from '../gyms/kantoGyms.js';
import {masteryBonusFromSave} from '../progression/kantoMastery.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
export const KANTO_MEGA_REQUIREMENTS=Object.freeze({level:100,affinity:100,masteryRank:5,badges:8});
const names:Record<KantoMegaFormId,string>={
 'venusaur-mega':'Desafio da Natureza','charizard-mega-x':'Desafio da Chama Dracônica',
 'charizard-mega-y':'Desafio da Chama Solar','blastoise-mega':'Desafio das Marés'
};
type Student={uid:number;pokemonId:number;level:number;affinity:number;megaForm?:unknown;megaTrialForm?:unknown};
function checked(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal'||state.evolutionTestKitClaimed===true||state.megaStoneStock!==undefined)return null;
 if(new Set(state.badges).size!==state.badges.length||state.badges.some((id:unknown)=>!KANTO_GYMS.some(g=>g.id===id)))return null;
 const roster=state.roster as Student[];
 if(roster.some(p=>!masteryBonusFromSave(state.research,p.pokemonId)))return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available'||state.pendingRegionalLoot!=null||state.pendingExpeditionLoot!=null;
 return {state,roster,busy};
}
function requirements(c:NonNullable<ReturnType<typeof checked>>,p:Student){
 const req=KANTO_MEGA_REQUIREMENTS;
 return {level:p.level>=req.level,affinity:p.affinity>=req.affinity,
  mastery:masteryBonusFromSave(c.state.research,p.pokemonId)!.rank>=req.masteryRank,
  badges:KANTO_GYMS.every(g=>c.state.badges.includes(g.id))};
}
function choice(command:unknown){
 if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).sort().join(',')!=='formId,uid')return null;
 const {uid,formId}=command as {uid:unknown;formId:unknown};
 const form=kantoMegaForm(formId);
 return typeof uid==='number'&&Number.isSafeInteger(uid)&&uid>0&&form?{uid,form}:null;
}
function boundStone(p:Student,form:KantoMegaForm){return p.megaForm===undefined&&p.megaTrialForm===form.id;}
export function onlineMegaProjection(raw:string){
 const c=checked(raw);if(!c)return null;
 const unlocked=(speciesId:number)=>masteryBonusFromSave(c.state.research,speciesId)?.rank===5;
 const visible=KANTO_MEGA_FORMS.some(f=>unlocked(f.speciesId));
 return {visible,busy:c.busy,requirements:KANTO_MEGA_REQUIREMENTS,
  challenges:KANTO_MEGA_FORMS.map(form=>({form,name:names[form.id],unlocked:unlocked(form.speciesId)})),
  stones:c.roster.flatMap(p=>KANTO_MEGA_FORMS.filter(f=>boundStone(p,f)).map(f=>({id:f.stoneId,formId:f.id,uid:p.uid,quantity:1}))),
  pokemon:c.roster.filter(p=>KANTO_MEGA_FORMS.some(f=>f.speciesId===p.pokemonId)).map(p=>{
   const met=requirements(c,p);
   const earned=kantoMegaForm(p.megaTrialForm);
   const pass=p.megaForm!==undefined||earned?'consumed':Object.values(met).every(Boolean)?'available':'locked';
   return {uid:p.uid,speciesId:p.pokemonId,currentForm:kantoMegaForm(p.megaForm)?.id??null,
    pass,earnedForm:earned?.id??null,options:kantoMegaOptions(p.pokemonId,p.megaForm).map(form=>({
     form,name:names[form.id],met:{...met,stone:boundStone(p,form)},
     canChallenge:!c.busy&&pass==='available',available:!c.busy&&Object.values(met).every(Boolean)&&boundStone(p,form)
    }))};
  })};
}
/** Eligibility must be evaluated again when reserving AND settling a trial. */
export function quoteOnlineMegaTrial(raw:string,command:unknown){
 const target=choice(command);if(!target)return {status:'invalid'} as const;
 const c=checked(raw);if(!c)return {status:'invalid-save'} as const;
 if(c.busy)return {status:'busy'} as const;
 const p=c.roster.find(p=>p.uid===target.uid);
 if(!p)return {status:'missing-pokemon'} as const;
 const q=quoteKantoMegaChoice(p,target.form.id);if(q.status!=='ok')return q;
 if(p.megaTrialForm!==undefined)return {status:'pass-consumed'} as const;
 const met=requirements(c,p);
 if(!Object.values(met).every(Boolean))return {status:'requirements',met} as const;
 return {...q,challenge:names[target.form.id]} as const;
}
/** Internal transition only, after a server-verified 1v1 victory.
 * Defeat/draw never call this reducer. No generic stock to transfer. */
export function applyCertifiedMegaTrialVictory(raw:string,command:unknown){
 const q=quoteOnlineMegaTrial(raw,command);if(q.status!=='ok')return q;
 const c=checked(raw)!;
 const p=c.roster.find(p=>p.uid===q.uid)!;
 p.megaTrialForm=q.formId;
 const next=JSON.stringify(c.state);
 if(!checked(next))return {status:'invalid-save'} as const;
 return {...q,raw:next} as const;
}
export function applyOnlineMegaEvolution(raw:string,command:unknown){
 const target=choice(command);if(!target)return {status:'invalid'} as const;
 const c=checked(raw);if(!c)return {status:'invalid-save'} as const;
 if(c.busy)return {status:'busy'} as const;
 const p=c.roster.find(p=>p.uid===target.uid);
 if(!p)return {status:'missing-pokemon'} as const;
 const q=quoteKantoMegaChoice(p,target.form.id);if(q.status!=='ok')return q;
 const met=requirements(c,p);
 if(!Object.values(met).every(Boolean))return {status:'requirements',met} as const;
 if(!boundStone(p,target.form))return {status:'no-stock'} as const;
 p.megaForm=target.form.id; // retain earned form as permanent consumed-pass proof
 const next=JSON.stringify(c.state);
 if(!checked(next))return {status:'invalid-save'} as const;
 return {...q,raw:next,remaining:0} as const;
}
