/**
 * D-064AE — catálogo VISUAL somente leitura para preview da Season 1.
 * Níveis, desbloqueios e exemplos vêm da hipótese regional D064.
 * Dados independentes da economia: NÃO importar journal, capture, storage
 * nem comandos de batalha. Mudanças no catálogo serão sincronizadas
 * com o core somente depois de aprovado o release regional.
 */
export interface PreviewRegion {
  readonly id:number;
  readonly name:string;
  readonly minLevel:number;
  readonly maxLevel:number;
  readonly unlockTrainerLevel:number;
  readonly examples:readonly number[];
}
export const PREVIEW_REGIONS:readonly PreviewRegion[]=[
  {id:1,name:'Bosque Inicial',minLevel:2,maxLevel:10,unlockTrainerLevel:1,examples:[10,16,1,4,7]},
  {id:2,name:'Colinas de Kanto',minLevel:11,maxLevel:20,unlockTrainerLevel:6,examples:[23,35,37,58]},
  {id:3,name:'Caverna Rochosa',minLevel:21,maxLevel:30,unlockTrainerLevel:12,examples:[63,66,74,95]},
  {id:4,name:'Lagos Serenos',minLevel:31,maxLevel:40,unlockTrainerLevel:20,examples:[60,79,116,129]},
  {id:5,name:'Planícies Elétricas',minLevel:41,maxLevel:50,unlockTrainerLevel:30,examples:[25,81,100,111]},
  {id:6,name:'Bosque Nebuloso',minLevel:51,maxLevel:60,unlockTrainerLevel:42,examples:[92,94,2,5,8]},
  {id:7,name:'Costa Oceânica',minLevel:61,maxLevel:70,unlockTrainerLevel:55,examples:[134,135,136,3,6,9]},
  {id:8,name:'Reserva Selvagem',minLevel:71,maxLevel:80,unlockTrainerLevel:69,examples:[65,68,76,133]},
  {id:9,name:'Pico Dracônico',minLevel:81,maxLevel:90,unlockTrainerLevel:82,examples:[147,148,149,144,145,146]},
  {id:10,name:'Santuário Lendário',minLevel:91,maxLevel:100,unlockTrainerLevel:93,examples:[113,123,150,151]}
];
