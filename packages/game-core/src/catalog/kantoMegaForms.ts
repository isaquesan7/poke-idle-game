/** MEGA01 — permanent individual forms; keep the national Kanto species ID.
 * Source pinned to the existing PokéAPI snapshot:
 * PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * data/v2/csv/pokemon.csv a425fe0fda9d4682cc016225a642518d789d1ab3
 * pokemon_stats.csv fb76eeb810892440b5b2b2e148688a131452a1a4
 * pokemon_types.csv 5567064b22c77c4082c1dfb30674102c669968d8
 * types.csv d0ec10c324fb7d1529269ddbffac4778fdf99836
 * items.csv 133b896382cb3f3d3e668f6bae3a56b21cd81814
 * IDs 10033–10036 are form/asset IDs, NEVER capture, roster species or dex IDs.
 * No grants, battle-time transformation, reversal, passive abilities or runtime API.
 */
import {kantoSpecies} from './kantoSpecies.js';
import type {StatValues} from '../stats/types.js';
export const KANTO_MEGA_SOURCE_COMMIT='ac2f1acb055026e3dff1e0aca743bb46256a810a';
export type KantoMegaFormId='venusaur-mega'|'charizard-mega-x'|'charizard-mega-y'|'blastoise-mega';
export type KantoMegaStoneId='venusaurite'|'charizardite-x'|'charizardite-y'|'blastoisinite';
export interface KantoMegaForm {
 readonly id:KantoMegaFormId;
 readonly speciesId:3|6|9;
 readonly pokemonApiId:10033|10034|10035|10036;
 readonly name:string;
 readonly stoneId:KantoMegaStoneId;
 readonly stoneApiId:698|699|700|717;
 readonly types:readonly string[];
 readonly base:Readonly<StatValues>;
}
function freezeForm(form:KantoMegaForm):KantoMegaForm{
 return Object.freeze({...form,types:Object.freeze([...form.types]),base:Object.freeze({...form.base})});
}
export const KANTO_MEGA_FORMS:readonly KantoMegaForm[]=Object.freeze([
 freezeForm({id:'venusaur-mega',speciesId:3,pokemonApiId:10033,name:'Mega Venusaur',stoneId:'venusaurite',stoneApiId:698,types:['grass','poison'],base:{hp:80,attack:100,defense:123,specialAttack:122,specialDefense:120,speed:80}}),
 freezeForm({id:'charizard-mega-x',speciesId:6,pokemonApiId:10034,name:'Mega Charizard X',stoneId:'charizardite-x',stoneApiId:699,types:['fire','dragon'],base:{hp:78,attack:130,defense:111,specialAttack:130,specialDefense:85,speed:100}}),
 freezeForm({id:'charizard-mega-y',speciesId:6,pokemonApiId:10035,name:'Mega Charizard Y',stoneId:'charizardite-y',stoneApiId:717,types:['fire','flying'],base:{hp:78,attack:104,defense:78,specialAttack:159,specialDefense:115,speed:100}}),
 freezeForm({id:'blastoise-mega',speciesId:9,pokemonApiId:10036,name:'Mega Blastoise',stoneId:'blastoisinite',stoneApiId:700,types:['water'],base:{hp:79,attack:103,defense:120,specialAttack:135,specialDefense:115,speed:78}})
]);
export function kantoMegaForm(id:unknown):KantoMegaForm|null{
 return typeof id==='string'?KANTO_MEGA_FORMS.find(f=>f.id===id)??null:null;
}
/** Structural eligibility only; economic/level requirements belong to the writer.
 * A chosen permanent form has no subsequent Mega choices, including X/Y.
 * Reject malformed form/species pairs instead of falling back to ordinary form.
 */
export function kantoMegaOptions(speciesId:number,currentForm:unknown=undefined):readonly KantoMegaForm[]{
 if(!kantoSpecies(speciesId)||currentForm!==undefined)return [];
 return KANTO_MEGA_FORMS.filter(f=>f.speciesId===speciesId);
}
/** Shared read model for future roster, art, stats and combat integration.
 * Never replaces the national ID or uses the remote form ID as a species ID.
 */
export function kantoPokemonFormProfile(speciesId:number,formId:unknown=undefined){
 const species=kantoSpecies(speciesId);
 if(!species)return null;
 if(formId===undefined)return {speciesId:species.id,formId:null,artId:species.id,name:species.name,types:species.types,base:species.base};
 const form=kantoMegaForm(formId);
 if(!form||form.speciesId!==species.id)return null;
 return {speciesId:species.id,formId:form.id,artId:form.pokemonApiId,name:form.name,types:form.types,base:form.base};
}
/** Pure quote; no persisted mutation/consumption. A transaction must enforce
 * the confirmed requirements and inventory before applying this single UID.
 */
export function quoteKantoMegaChoice(pokemon:{uid:number;pokemonId:number;megaForm?:unknown},target:unknown){
 if(!pokemon||!Number.isSafeInteger(pokemon.uid)||pokemon.uid<1||!kantoPokemonFormProfile(pokemon.pokemonId,pokemon.megaForm))
  return {status:'invalid-pokemon'} as const;
 if(pokemon.megaForm!==undefined)return {status:'already-mega'} as const;
 const form=kantoMegaForm(target);
 if(!form||form.speciesId!==pokemon.pokemonId)return {status:'incompatible'} as const;
 return {status:'ok',uid:pokemon.uid,speciesId:pokemon.pokemonId,formId:form.id,stoneId:form.stoneId} as const;
}

/** A successful trial is a permanent individual entitlement. An evolved
 * specimen must retain the matching proof; unbound stones are never legal. */
export function validKantoMegaEntitlement(speciesId:number,formId:unknown,trialForm:unknown){
 if(!kantoPokemonFormProfile(speciesId,formId))return false;
 if(trialForm===undefined)return formId===undefined;
 const trial=kantoMegaForm(trialForm);
 return !!trial&&trial.speciesId===speciesId&&(formId===undefined||formId===trialForm);
}
