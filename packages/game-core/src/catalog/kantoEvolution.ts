/**
 * Evoluções nacionais #001–#151 extraídas de pokemon_evolution.csv
 * em PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a, somente formas default e
 * regras de primeira geração até FRLG (version_group <= 7).
 * A evolução é MANUAL na alfa. Trocas constam mas ficam bloqueadas.
 */
export const KANTO_EVOLUTION_SOURCE_COMMIT = 'ac2f1acb055026e3dff1e0aca743bb46256a810a';
export const KANTO_EVOLUTION_STONES = [
  {id:'moon-stone',name:'Pedra da Lua'},
  {id:'fire-stone',name:'Pedra do Fogo'},
  {id:'water-stone',name:'Pedra da Água'},
  {id:'thunder-stone',name:'Pedra do Trovão'},
  {id:'leaf-stone',name:'Pedra da Folha'}
] as const;
export type KantoEvolutionStone = typeof KANTO_EVOLUTION_STONES[number]['id'];
export type KantoEvolutionRule =
  | {readonly from:number;readonly to:number;readonly trigger:'level';readonly minLevel:number}
  | {readonly from:number;readonly to:number;readonly trigger:'stone';readonly stone:KantoEvolutionStone}
  | {readonly from:number;readonly to:number;readonly trigger:'trade'};

export const KANTO_EVOLUTION_RULES: readonly KantoEvolutionRule[] = [
  {from:1,to:2,trigger:'level',minLevel:16},
  {from:2,to:3,trigger:'level',minLevel:32},
  {from:4,to:5,trigger:'level',minLevel:16},
  {from:5,to:6,trigger:'level',minLevel:36},
  {from:7,to:8,trigger:'level',minLevel:16},
  {from:8,to:9,trigger:'level',minLevel:36},
  {from:10,to:11,trigger:'level',minLevel:7},
  {from:11,to:12,trigger:'level',minLevel:10},
  {from:13,to:14,trigger:'level',minLevel:7},
  {from:14,to:15,trigger:'level',minLevel:10},
  {from:16,to:17,trigger:'level',minLevel:18},
  {from:17,to:18,trigger:'level',minLevel:36},
  {from:19,to:20,trigger:'level',minLevel:20},
  {from:21,to:22,trigger:'level',minLevel:20},
  {from:23,to:24,trigger:'level',minLevel:22},
  {from:25,to:26,trigger:'stone',stone:'thunder-stone'},
  {from:27,to:28,trigger:'level',minLevel:22},
  {from:29,to:30,trigger:'level',minLevel:16},
  {from:30,to:31,trigger:'stone',stone:'moon-stone'},
  {from:32,to:33,trigger:'level',minLevel:16},
  {from:33,to:34,trigger:'stone',stone:'moon-stone'},
  {from:35,to:36,trigger:'stone',stone:'moon-stone'},
  {from:37,to:38,trigger:'stone',stone:'fire-stone'},
  {from:39,to:40,trigger:'stone',stone:'moon-stone'},
  {from:41,to:42,trigger:'level',minLevel:22},
  {from:43,to:44,trigger:'level',minLevel:21},
  {from:44,to:45,trigger:'stone',stone:'leaf-stone'},
  {from:46,to:47,trigger:'level',minLevel:24},
  {from:48,to:49,trigger:'level',minLevel:31},
  {from:50,to:51,trigger:'level',minLevel:26},
  {from:52,to:53,trigger:'level',minLevel:28},
  {from:54,to:55,trigger:'level',minLevel:33},
  {from:56,to:57,trigger:'level',minLevel:28},
  {from:58,to:59,trigger:'stone',stone:'fire-stone'},
  {from:60,to:61,trigger:'level',minLevel:25},
  {from:61,to:62,trigger:'stone',stone:'water-stone'},
  {from:63,to:64,trigger:'level',minLevel:16},
  {from:64,to:65,trigger:'trade'},
  {from:66,to:67,trigger:'level',minLevel:28},
  {from:67,to:68,trigger:'trade'},
  {from:69,to:70,trigger:'level',minLevel:21},
  {from:70,to:71,trigger:'stone',stone:'leaf-stone'},
  {from:72,to:73,trigger:'level',minLevel:30},
  {from:74,to:75,trigger:'level',minLevel:25},
  {from:75,to:76,trigger:'trade'},
  {from:77,to:78,trigger:'level',minLevel:40},
  {from:79,to:80,trigger:'level',minLevel:37},
  {from:81,to:82,trigger:'level',minLevel:30},
  {from:84,to:85,trigger:'level',minLevel:31},
  {from:86,to:87,trigger:'level',minLevel:34},
  {from:88,to:89,trigger:'level',minLevel:38},
  {from:90,to:91,trigger:'stone',stone:'water-stone'},
  {from:92,to:93,trigger:'level',minLevel:25},
  {from:93,to:94,trigger:'trade'},
  {from:96,to:97,trigger:'level',minLevel:26},
  {from:98,to:99,trigger:'level',minLevel:28},
  {from:100,to:101,trigger:'level',minLevel:30},
  {from:102,to:103,trigger:'stone',stone:'leaf-stone'},
  {from:104,to:105,trigger:'level',minLevel:28},
  {from:109,to:110,trigger:'level',minLevel:35},
  {from:111,to:112,trigger:'level',minLevel:42},
  {from:116,to:117,trigger:'level',minLevel:32},
  {from:118,to:119,trigger:'level',minLevel:33},
  {from:120,to:121,trigger:'stone',stone:'water-stone'},
  {from:129,to:130,trigger:'level',minLevel:20},
  {from:133,to:134,trigger:'stone',stone:'water-stone'},
  {from:133,to:135,trigger:'stone',stone:'thunder-stone'},
  {from:133,to:136,trigger:'stone',stone:'fire-stone'},
  {from:138,to:139,trigger:'level',minLevel:40},
  {from:140,to:141,trigger:'level',minLevel:40},
  {from:147,to:148,trigger:'level',minLevel:30},
  {from:148,to:149,trigger:'level',minLevel:55},
] as const;

/** Não consulta internet; nunca libera condições não verificadas. */
export function kantoEvolutionOptions(speciesId:number):readonly KantoEvolutionRule[] {
  if(!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151)return [];
  return KANTO_EVOLUTION_RULES.filter(rule=>rule.from===speciesId);
}
