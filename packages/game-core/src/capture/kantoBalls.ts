/**
 * D-064B · Catálogo e política inicial de Poké Bolas de Kanto.
 *
 * Multiplicadores canônicos: Poké Ball 1x, Great Ball 1.5x, Ultra Ball 2x;
 * Master Ball garantia de captura. O uso da Master Ball está RESERVADO
 * para uma ação MANUAL futura, não se aplica automaticamente.
 * Fontes: PokéAPI + Bulbapedia (Catch rate) / Pokémon website.
 *
 * ESTE CONTRATO É PURO: ainda não concede bolas, não gasta itens, não roda
 * RNG e não modifica a captura de 35% publicada. A integração exige writer
 * de inventário atômico e regra de aquisição para saves novos/antigos.
 */
import {kantoSpecies} from '../catalog/kantoSpecies.js';

export type KantoBallId='poke-ball'|'great-ball'|'ultra-ball'|'master-ball';

export interface KantoBallDefinition {
  readonly id:KantoBallId;
  readonly name:string;
  readonly catchModifier:number|null;
  readonly normalCapture:boolean;
  readonly legendaryCapture:boolean;
  readonly automaticUse:boolean;
  readonly conventionalShop:boolean;
}

export const KANTO_BALLS:Readonly<Record<KantoBallId,KantoBallDefinition>>={
  'poke-ball':{
    id:'poke-ball',name:'Poké Ball',catchModifier:1,
    normalCapture:true,legendaryCapture:false,automaticUse:true,conventionalShop:true
  },
  'great-ball':{
    id:'great-ball',name:'Great Ball',catchModifier:1.5,
    normalCapture:true,legendaryCapture:false,automaticUse:true,conventionalShop:true
  },
  'ultra-ball':{
    id:'ultra-ball',name:'Ultra Ball',catchModifier:2,
    normalCapture:true,legendaryCapture:true,automaticUse:true,conventionalShop:true
  },
  'master-ball':{
    id:'master-ball',name:'Master Ball',catchModifier:null,
    normalCapture:false,legendaryCapture:false,automaticUse:false,conventionalShop:false
  }
};

export type KantoBallUseResult=
  | {readonly ok:true;readonly ball:KantoBallDefinition;readonly baseCatchRate:number}
  | {readonly ok:false;readonly reason:string};

/** Este validador de política NÃO consome o item: o writer deve revalidar estoque
 * e autorização por revisão (UID, região, encontro e quantidade) antes do gasto.
 * A cada TENTATIVA de captura, não só a cada sucesso, gasta-se uma bola.
 */
export function canUseKantoBall(
  ballId:string,speciesId:number,quantity:number
):KantoBallUseResult{
  const ball=KANTO_BALLS[ballId as KantoBallId];
  if(!ball||ball.id!==ballId)return {ok:false,reason:'Tipo de Poké Bola desconhecido.'};
  const species=kantoSpecies(speciesId);
  if(!species)return {ok:false,reason:'Espécie inválida.'};
  if(!Number.isSafeInteger(quantity)||quantity<1)
    return {ok:false,reason:'Você não possui esta Poké Bola na mochila.'};
  if(!ball.automaticUse)
    return {ok:false,reason:'Master Ball reservada para uso manual em etapa futura.'};
  const rare=species.legendary||species.mythical;
  if(rare&&!ball.legendaryCapture)
    return {ok:false,reason:'Lendários e míticos exigem Ultra Ball.'};
  if(!rare&&!ball.normalCapture)
    return {ok:false,reason:'Esta Poké Bola não pode ser usada automaticamente.'};
  return {ok:true,ball,baseCatchRate:species.captureRate};
}
