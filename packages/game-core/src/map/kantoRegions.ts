/**
 * D-064 / contrato inicial de regiões Kanto (AINDA NÃO conectadas ao combate).
 *
 * As 151 espécies constam em exatamente uma região de acesso garantido
 * por catálogo. Encontros lendários/míticos só nas regiões 9 e 10.
 * Seleção determinística e pools usados tanto para sorteio quanto para UI.
 * NÃO ALTERA a Arena publicada, saves, economia ou roteamento nesta etapa.
 */
import {KANTO_POKEDEX} from '../catalog/kantoSpecies.js';

export interface KantoRegionDefinition {
  readonly id:number;
  readonly name:string;
  readonly levelMin:number;
  readonly levelMax:number;
  readonly trainerUnlockLevel:number;
  readonly speciesIds:readonly number[];
  readonly rareSpeciesIds:readonly number[];
  readonly commonWeight:number;
  readonly rareWeight:number;
}

export const KANTO_REGIONS:readonly KantoRegionDefinition[]=[
  {id:1,name:'Bosque Inicial',levelMin:2,levelMax:10,trainerUnlockLevel:1,
    speciesIds:[10,13,16,19,21,29,32,43,46,48,52,69,1,4,7],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:2,name:'Colinas de Kanto',levelMin:11,levelMax:20,trainerUnlockLevel:10,
    speciesIds:[11,14,17,20,22,23,24,27,28,30,33,35,37,39,41,44,47,49,50,51,53,56,58],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:3,name:'Caverna Rochosa',levelMin:21,levelMax:30,trainerUnlockLevel:20,
    speciesIds:[12,15,40,42,54,55,57,59,63,64,66,67,70,71,72,73,74,75,95],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:4,name:'Lagos Serenos',levelMin:31,levelMax:40,trainerUnlockLevel:30,
    speciesIds:[60,61,62,79,80,86,87,90,91,98,99,116,117,118,119,120,121,129],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:5,name:'Planícies Elétricas',levelMin:41,levelMax:50,trainerUnlockLevel:40,
    speciesIds:[25,26,81,82,100,101,102,103,104,105,106,107,108,109,110,111,112],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:6,name:'Bosque Nebuloso',levelMin:51,levelMax:60,trainerUnlockLevel:50,
    speciesIds:[88,89,92,93,94,96,97,114,122,124,2,5,8],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:7,name:'Costa Oceânica',levelMin:61,levelMax:70,trainerUnlockLevel:60,
    speciesIds:[77,78,83,84,85,134,135,136,138,3,6,9],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:8,name:'Reserva Selvagem',levelMin:71,levelMax:80,trainerUnlockLevel:70,
    speciesIds:[18,31,34,36,38,45,65,68,76,125,126,127,133,140,141],
    rareSpeciesIds:[],commonWeight:1,rareWeight:1},
  {id:9,name:'Pico Dracônico',levelMin:81,levelMax:90,trainerUnlockLevel:80,
    speciesIds:[142,143,147,148,149,130,131,144,145,146],
    rareSpeciesIds:[144,145,146],commonWeight:120,rareWeight:1},
  {id:10,name:'Santuário Lendário',levelMin:91,levelMax:100,trainerUnlockLevel:90,
    speciesIds:[132,137,113,115,123,128,139,150,151],
    rareSpeciesIds:[150,151],commonWeight:240,rareWeight:1}
];

/** Dados oficiais de raridade vêm do catálogo PokéAPI, não das probabilidades
 * regionais. Estes pesos são PRELIMINARES, sujeitos a simulação e aprovação.
 */
export function kantoRegion(id:number):KantoRegionDefinition|undefined {
  return KANTO_REGIONS.find(region=>region.id===id);
}
export function kantoRegionForSpecies(speciesId:number):KantoRegionDefinition|undefined {
  return KANTO_REGIONS.find(region=>region.speciesIds.includes(speciesId));
}
export function kantoRegionalEncounter(regionId:number,seed:number,leaderLevel:number):
  {readonly speciesId:number;readonly level:number}|null {
  const region=kantoRegion(regionId);
  if(!region||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff
    ||!Number.isSafeInteger(leaderLevel)||leaderLevel<1||leaderLevel>100)return null;
  const rare=new Set(region.rareSpeciesIds);
  const weights=region.speciesIds.map(id=>rare.has(id)?region.rareWeight:region.commonWeight);
  const total=weights.reduce((sum,weight)=>sum+weight,0);
  let pick=seed%total;
  let speciesId=region.speciesIds[0]!;
  for(let i=0;i<weights.length;i++){
    pick-=weights[i]!;
    if(pick<0){speciesId=region.speciesIds[i]!;break;}
  }
  const level=Math.max(region.levelMin,
    Math.min(region.levelMax,leaderLevel+((seed>>>16)%5)-2));
  return {speciesId,level};
}

export function kantoRegionCatalogInvariant():boolean {
  const all=KANTO_REGIONS.flatMap(r=>r.speciesIds);
  if(KANTO_REGIONS.length!==10||all.length!==151||new Set(all).size!==151
    ||KANTO_POKEDEX.some(p=>!all.includes(p.id)))return false;
  return KANTO_REGIONS.every((r,i)=>{
    const previous=KANTO_REGIONS[i-1];
    return r.id===i+1&&r.levelMin>=2&&r.levelMin<=r.levelMax
      &&r.levelMax<=(i===9?100:90)
      &&r.commonWeight>0&&r.rareWeight>0
      &&(i===0||previous!==undefined&&r.levelMin===previous.levelMax+1)
      &&r.rareSpeciesIds.every(id=>r.speciesIds.includes(id))
      &&r.speciesIds.every(id=>{
        const species=KANTO_POKEDEX[id-1];
        if(!species)return false;
        if(species.legendary||species.mythical)return i>=8&&r.rareSpeciesIds.includes(id);
        return !r.rareSpeciesIds.includes(id);
      });
  });
}
