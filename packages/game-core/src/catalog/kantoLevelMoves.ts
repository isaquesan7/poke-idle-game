/**
 * PokéAPI verificada: aprendizados por NÍVEL em FireRed/LeafGreen (version_group_id=7).
 * Fonte fixa: PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * data/v2/csv/pokemon_moves.csv (blob f66f614adf535af6940c65f434efe5ddeec4687a)
 * data/v2/csv/moves.csv + types.csv.
 *
 * Alfa simplificada: somente movimentos de dano direto effect_id=1 e os 11
 * golpes já existentes na Arena, mais Double Kick D-045. Efeitos secundários (paralisia,
 * drenagem, etc.) ainda não são simulados. Status, multi-hit, recoil, TM,
 * tutor, egg moves e movimentos sem poder direto NÃO estão incluídos,\n * EXCETO Double Kick D-045 (2 impactos fixos e catálogo pequeno verificado).
 *
 * Poison Sting de Weedle a partir do nível 1 foi conferido também em
 * https://pokemondb.net/pokedex/weedle/moves/3 (FireRed/LeafGreen).
 * Efeitos secundários do dano são tratados no motor de combate.
 *
 * Este é um recorte dos learnsets de versão, NÃO o moveset completo.
 * A fonte não é consultada em runtime. Todos os IDs 1–151 são contemplados;
 * espécies sem golpes elegíveis nessa seleção mantêm seu fallback anterior.
 */
import type { KantoMove } from '../combat/kantoBattle.js';
import { kantoSpecies } from './kantoSpecies.js';

export const KANTO_LEVELUP_SOURCE_COMMIT = 'ac2f1acb055026e3dff1e0aca743bb46256a810a';
export const KANTO_LEVELUP_VERSION_GROUP = 'firered-leafgreen';

/** Metadados oficiais de tipo, categoria, poder, precisão e prioridade. */
const MOVES: readonly KantoMove[] = [{"name":"pound","type":"normal","category":"physical","power":40,"accuracy":100,"priority":0},{"name":"mega-punch","type":"normal","category":"physical","power":80,"accuracy":85,"priority":0},{"name":"scratch","type":"normal","category":"physical","power":40,"accuracy":100,"priority":0},{"name":"vice-grip","type":"normal","category":"physical","power":55,"accuracy":100,"priority":0},{"name":"gust","type":"flying","category":"special","power":40,"accuracy":100,"priority":0},{"name":"wing-attack","type":"flying","category":"physical","power":60,"accuracy":100,"priority":0},{"name":"slam","type":"normal","category":"physical","power":80,"accuracy":75,"priority":0},{"name":"vine-whip","type":"grass","category":"physical","power":45,"accuracy":100,"priority":0},{"name":"mega-kick","type":"normal","category":"physical","power":120,"accuracy":75,"priority":0},{"name":"horn-attack","type":"normal","category":"physical","power":65,"accuracy":100,"priority":0},{"name":"tackle","type":"normal","category":"physical","power":40,"accuracy":100,"priority":0},{"name":"ember","type":"fire","category":"special","power":40,"accuracy":100,"priority":0},{"name":"water-gun","type":"water","category":"special","power":40,"accuracy":100,"priority":0},{"name":"hydro-pump","type":"water","category":"special","power":110,"accuracy":80,"priority":0},{"name":"peck","type":"flying","category":"physical","power":35,"accuracy":100,"priority":0},{"name":"drill-peck","type":"flying","category":"physical","power":80,"accuracy":100,"priority":0},{"name":"absorb","type":"grass","category":"special","power":20,"accuracy":100,"priority":0},{"name":"thunder-shock","type":"electric","category":"special","power":40,"accuracy":100,"priority":0},{"name":"rock-throw","type":"rock","category":"physical","power":50,"accuracy":90,"priority":0},{"name":"quick-attack","type":"normal","category":"physical","power":40,"accuracy":100,"priority":1},{"name":"egg-bomb","type":"normal","category":"physical","power":100,"accuracy":75,"priority":0},{"name":"bubble","type":"water","category":"special","power":40,"accuracy":100,"priority":0},{"name":"megahorn","type":"bug","category":"physical","power":120,"accuracy":85,"priority":0},{"name":"hyper-voice","type":"normal","category":"special","power":90,"accuracy":100,"priority":0},{"name":"poison-sting","type":"poison","category":"physical","power":15,"accuracy":100,"priority":0}];

/** espécie nacional → pares [level, index do MOVES]. */
const LEARNS: Readonly<Record<number,readonly (readonly [number,number])[]>> = {
  1:[[1,10],[10,7]],
  2:[[1,10],[10,7]],
  3:[[1,7],[1,10]],
  4:[[1,2],[7,11]],
  5:[[1,2],[1,11]],
  6:[[1,2],[1,11],[36,5]],
  7:[[1,10],[7,21],[13,12],[47,13]],
  8:[[1,10],[1,21],[13,12],[53,13]],
  9:[[1,10],[1,21],[13,12],[68,13]],
  10:[[1,10]],
  12:[[28,4]],
  13:[[1,24]],
  16:[[1,10],[9,4],[13,19],[25,5]],
  17:[[1,4],[1,10],[13,19],[27,5]],
  18:[[1,4],[1,10],[1,19],[27,5]],
  19:[[1,10],[7,19]],
  20:[[1,10],[1,19]],
  21:[[1,14],[37,15]],
  22:[[1,14],[40,15]],
  25:[[1,17],[11,19],[20,6]],
  26:[[1,17],[1,19]],
  27:[[1,2]],
  28:[[1,2]],
  29:[[1,2]],
  30:[[1,2]],
  31:[[1,2]],
  32:[[1,14],[20,9]],
  33:[[1,14],[22,9]],
  34:[[1,14],[43,22]],
  35:[[1,0]],
  37:[[1,11],[13,19]],
  38:[[1,11],[1,19]],
  39:[[9,0],[44,23]],
  41:[[21,5]],
  42:[[21,5]],
  43:[[1,16]],
  44:[[1,16]],
  45:[[1,16]],
  46:[[1,2]],
  47:[[1,2]],
  48:[[1,10]],
  49:[[1,10],[31,4]],
  50:[[1,2]],
  51:[[1,2]],
  52:[[1,2]],
  53:[[1,2]],
  54:[[1,2],[50,13]],
  55:[[1,2],[58,13]],
  56:[[1,2]],
  57:[[1,2]],
  58:[[7,11]],
  59:[[1,11]],
  60:[[1,21],[13,12],[43,13]],
  61:[[1,12],[1,21],[51,13]],
  62:[[1,12]],
  69:[[1,7],[45,6]],
  70:[[1,7],[54,6]],
  71:[[1,7]],
  72:[[49,13]],
  73:[[55,13]],
  74:[[1,10],[11,18]],
  75:[[1,10],[1,18]],
  76:[[1,10],[1,18]],
  77:[[1,19],[14,11]],
  78:[[1,11],[1,19]],
  79:[[1,10],[13,12]],
  80:[[1,10],[13,12]],
  81:[[1,10],[6,17]],
  82:[[1,10],[1,17]],
  83:[[1,14]],
  84:[[1,14],[37,15]],
  85:[[1,14],[47,15]],
  88:[[1,0]],
  89:[[1,0]],
  90:[[1,10]],
  95:[[1,10],[12,18],[41,6]],
  96:[[1,0]],
  97:[[1,0]],
  98:[[1,21],[12,3]],
  99:[[1,3],[1,21]],
  100:[[1,10]],
  101:[[1,10]],
  103:[[31,20]],
  106:[[46,8]],
  107:[[38,1]],
  108:[[40,6]],
  109:[[1,10]],
  110:[[1,10]],
  111:[[1,9],[57,22]],
  112:[[1,9],[66,22]],
  113:[[1,0],[35,20]],
  114:[[10,16],[22,7],[40,6]],
  115:[[25,1]],
  116:[[1,21],[22,12],[43,13]],
  117:[[1,12],[1,21],[51,13]],
  118:[[1,14],[15,9],[57,22]],
  119:[[1,14],[15,9],[69,22]],
  120:[[1,10],[6,12],[46,13]],
  121:[[1,12]],
  123:[[1,19],[26,5]],
  124:[[1,0]],
  125:[[1,19]],
  126:[[1,11]],
  127:[[1,3]],
  128:[[1,10],[8,9]],
  129:[[15,10]],
  130:[[40,13]],
  131:[[1,12],[49,13]],
  133:[[1,10],[23,19]],
  134:[[1,10],[16,12],[23,19],[52,13]],
  135:[[1,10],[16,17],[23,19]],
  136:[[1,10],[16,11],[23,19]],
  137:[[1,10]],
  138:[[19,12],[55,13]],
  139:[[1,12],[65,13]],
  140:[[1,2],[13,16]],
  141:[[1,2],[1,16]],
  142:[[1,5]],
  143:[[1,10]],
  144:[[1,4]],
  145:[[1,14],[1,17],[49,15]],
  146:[[1,5],[1,11]],
  147:[[29,6]],
  148:[[29,6]],
  149:[[29,6],[55,5]],
  151:[[1,0],[20,1]],
};
/**
 * D-045: Double Kick = 2 acertos FIXOS, 30 de poder por impacto.
 * Learnsets FRLG de Nidoran♀/♂, Nidorina/Nidorino e Nidoqueen/Nidoking.
 * Nas evoluções por pedra o golpe aparece como movimento do nível 1,
 * preservando a possibilidade de reequipar um golpe já aprendido pelo UID.
 * https://pokemondb.net/pokedex/nidoran-f/moves/3
 * https://pokemondb.net/pokedex/nidoran-m/moves/3
 */
const EXTRA_LEVEL_MOVES:Readonly<Record<string,KantoMove>>={
  'double-kick':Object.freeze({
    name:'double-kick',type:'fighting',category:'physical',
    power:30,accuracy:100,priority:0
  })
};
const EXTRA_LEARNS:Readonly<Record<number,readonly (readonly [number,string])[]>>={
  29:[[12,'double-kick']],30:[[12,'double-kick']],31:[[1,'double-kick']],
  32:[[12,'double-kick']],33:[[12,'double-kick']],34:[[1,'double-kick']]
};

export interface KantoLearnableMove {
  readonly move: KantoMove;
  readonly learnedAt: number;
}

/** Retorna apenas golpes validados, desbloqueados e simuláveis pelo motor. */
export function kantoLevelMoves(speciesId:number,level:number):readonly KantoLearnableMove[] {
  if (!kantoSpecies(speciesId) || !Number.isSafeInteger(level) || level<1 || level>100) return [];
  const found=new Map<string,KantoLearnableMove>();
  for (const [learnedAt,index] of LEARNS[speciesId] ?? []) {
    if (learnedAt>level) continue;
    const move=MOVES[index];
    if (move && (!found.has(move.name) || learnedAt<found.get(move.name)!.learnedAt)) {
      found.set(move.name,{move,learnedAt});
    }
  }
  for(const [learnedAt,name] of EXTRA_LEARNS[speciesId]??[]){
    if(learnedAt>level)continue;
    const move=EXTRA_LEVEL_MOVES[name];
    if(move&&(!found.has(name)||learnedAt<found.get(name)!.learnedAt))
      found.set(name,{move,learnedAt});
  }
  return [...found.values()].sort((a,b)=>a.learnedAt-b.learnedAt||a.move.name.localeCompare(b.move.name));
}

/** Nome único → dados de combate verificados no mesmo snapshot. */
export const KANTO_LEVELUP_DAMAGE_MOVES: Readonly<Record<string,KantoMove>> =
  Object.fromEntries([...MOVES,...Object.values(EXTRA_LEVEL_MOVES)].map(move=>[move.name,move]));
