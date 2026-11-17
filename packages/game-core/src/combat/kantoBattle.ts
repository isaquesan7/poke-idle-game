/**
 * Batalha v0.2 determinística, sem DOM, PokéAPI, relógio ou Math.random.
 *
 * Reproduz as constantes do combate simplificado v0.1: até 30 turnos,
 * prioridade/velocidade, precisão, dano físico/especial, STAB 1.5,
 * crítico 6,25% ×1.5, variação 0.9–1, efetividade e captura 35% na vitória.
 * Fonte de aleatoriedade: seed uint32 explícito → LCG reproduzível.
 * NÃO é RNG criptográfico, prova antifraude ou cálculo de servidor.
 *
 * Dados-base das 151 espécies são um snapshot oficial da PokéAPI;
 * movimentos automáticos das espécies novas são PROVISÓRIOS (não learnsets);
 * PokéAPI/dados externos poderão ampliar Kanto em uma etapa posterior.
 */
import type { StatValues } from '../stats/types.js';
import { KANTO_POKEDEX } from '../catalog/kantoSpecies.js';

export type KantoMove = Readonly<{
  name: string;
  type: string;
  category: 'physical' | 'special';
  power: number;
  accuracy: number;
  priority: number;
}>;

export type KantoSpecies = Readonly<{
  id: number;
  name: string;
  types: readonly string[];
  base: Readonly<StatValues>;
  move: KantoMove;
}>;

const MOVE = {
  tackle: { name:'tackle', type:'normal', category:'physical', power:40, accuracy:100, priority:0 },
  scratch: { name:'scratch', type:'normal', category:'physical', power:40, accuracy:100, priority:0 },
  quickAttack: { name:'quick-attack', type:'normal', category:'physical', power:40, accuracy:100, priority:1 },
  vineWhip: { name:'vine-whip', type:'grass', category:'physical', power:45, accuracy:100, priority:0 },
  ember: { name:'ember', type:'fire', category:'special', power:40, accuracy:100, priority:0 },
  waterGun: { name:'water-gun', type:'water', category:'special', power:40, accuracy:100, priority:0 },
  gust: { name:'gust', type:'flying', category:'special', power:40, accuracy:100, priority:0 },
  thunderShock: { name:'thunder-shock', type:'electric', category:'special', power:40, accuracy:100, priority:0 },
  absorb: { name:'absorb', type:'grass', category:'special', power:20, accuracy:100, priority:0 },
  rockThrow: { name:'rock-throw', type:'rock', category:'physical', power:50, accuracy:90, priority:0 },
  bubble: { name:'bubble', type:'water', category:'special', power:40, accuracy:100, priority:0 }
} as const satisfies Record<string, KantoMove>;

/** Golpes do catálogo de alfa; troca de golpe futura buscará catálogo completo. */
export const KANTO_BATTLE_MOVES: Readonly<Record<string,KantoMove>> =
  Object.fromEntries(Object.values(MOVE).map(move=>[move.name,move]));

/**
 * Todas as 151 espécies podem compor combatentes.
 * Golpes padrão desta primeira extensão são PROVISÓRIOS e por tipo;
 * NÃO representam a lista de aprendizado validada da PokéAPI.
 * Os 11 movimentos já usados na Arena anterior são preservados.
 */
const PRIMARY_MOVES: Readonly<Record<string,KantoMove>> = {
  normal:MOVE.tackle,bug:MOVE.tackle,poison:MOVE.tackle,
  fighting:MOVE.tackle,psychic:MOVE.tackle,ghost:MOVE.tackle,
  ground:MOVE.tackle,ice:MOVE.tackle,dragon:MOVE.tackle,fairy:MOVE.tackle,
  dark:MOVE.tackle,steel:MOVE.tackle,
  grass:MOVE.vineWhip,fire:MOVE.ember,water:MOVE.waterGun,
  flying:MOVE.gust,electric:MOVE.thunderShock,rock:MOVE.rockThrow
};
const ORIGINAL_ARENA_MOVES: Readonly<Record<number,KantoMove>> = {
  1:MOVE.vineWhip,4:MOVE.ember,7:MOVE.waterGun,
  10:MOVE.tackle,16:MOVE.gust,19:MOVE.quickAttack,
  25:MOVE.thunderShock,37:MOVE.ember,43:MOVE.absorb,
  60:MOVE.bubble,74:MOVE.rockThrow
};
export const KANTO_BATTLE_SPECIES: Readonly<Record<number,KantoSpecies>> =
  Object.fromEntries(KANTO_POKEDEX.map(species=>[
    species.id,{
      id:species.id,name:species.name,types:species.types,
      base:species.base,
      move:ORIGINAL_ARENA_MOVES[species.id] ??
        PRIMARY_MOVES[species.types[0]!] ?? MOVE.tackle
    }
  ]));

/**
 * Pool piloto expandida: 54 espécies não lendárias, incluindo os oito
 * encontros originais (ordem preservada para seed 0 = Caterpie).
 * O catálogo de espécies contém 151, mas nem todas surgem na Arena ainda.
 */
export const KANTO_WILD_POOL = [
  10,16,19,25,37,43,60,74,
  13,21,23,27,29,32,35,39,41,46,48,50,52,54,56,58,
  63,66,69,72,77,79,81,83,84,86,88,90,92,95,96,98,
  100,102,104,109,111,116,118,120,123,129,133,137,140,147
] as const;

export type Combatant = Readonly<{
  speciesId: number;
  name: string;
  level: number;
  types: readonly string[];
  stats: Readonly<StatValues>;
  move: KantoMove;
  rank: number;
}>;

export type BattleOutcome = 'win' | 'loss' | 'draw';

export interface KantoBattleResult {
  readonly outcome: BattleOutcome;
  readonly turns: number;
  readonly playerRemainingHp: number;
  readonly wildRemainingHp: number;
  readonly wildSpeciesId: number;
  readonly affinityGain: number | null;
  readonly captured: boolean;
  readonly log: readonly string[];
}

type Relation = { double?: readonly string[]; half?: readonly string[]; none?: readonly string[] };
/** Eficácias de ataque modernas para os tipos Kanto, multiplicadas por defensor. */
const TYPES: Readonly<Record<string,Relation>> = {
  normal:{half:['rock','steel'],none:['ghost']},
  fire:{double:['grass','ice','bug','steel'],half:['fire','water','rock','dragon']},
  water:{double:['fire','ground','rock'],half:['water','grass','dragon']},
  electric:{double:['water','flying'],half:['electric','grass','dragon'],none:['ground']},
  grass:{double:['water','ground','rock'],half:['fire','grass','poison','flying','bug','dragon','steel']},
  ice:{double:['grass','ground','flying','dragon'],half:['fire','water','ice','steel']},
  fighting:{double:['normal','ice','rock','dark','steel'],half:['poison','flying','psychic','bug','fairy'],none:['ghost']},
  poison:{double:['grass','fairy'],half:['poison','ground','rock','ghost'],none:['steel']},
  ground:{double:['fire','electric','poison','rock','steel'],half:['grass','bug'],none:['flying']},
  flying:{double:['grass','fighting','bug'],half:['electric','rock','steel']},
  psychic:{double:['fighting','poison'],half:['psychic','steel'],none:['dark']},
  bug:{double:['grass','psychic','dark'],half:['fire','fighting','poison','flying','ghost','steel','fairy']},
  rock:{double:['fire','ice','flying','bug'],half:['fighting','ground','steel']},
  ghost:{double:['psychic','ghost'],half:['dark'],none:['normal']},
  dragon:{double:['dragon'],half:['steel'],none:['fairy']},
  dark:{double:['psychic','ghost'],half:['fighting','dark','fairy']},
  steel:{double:['ice','rock','fairy'],half:['fire','water','electric','steel']},
  fairy:{double:['fighting','dragon','dark'],half:['fire','poison','steel']}
};

export function kantoTypeMultiplier(moveType:string, defenderTypes:readonly string[]):number {
  const relation = TYPES[moveType];
  if (!relation || defenderTypes.length < 1 || defenderTypes.length > 2
    || defenderTypes.some(type=>!TYPES[type])) throw new RangeError('Tipos inválidos.');
  return defenderTypes.reduce((total,type)=>total*(
    relation.none?.includes(type) ? 0
      : relation.double?.includes(type) ? 2
        : relation.half?.includes(type) ? 0.5 : 1
  ),1);
}

function validateCombatant(monster:Combatant):void {
  if (!monster || !Number.isSafeInteger(monster.speciesId) || monster.speciesId<1 || monster.speciesId>151
    || typeof monster.name!=='string' || monster.name.length<1 || monster.name.length>80
    || !Number.isSafeInteger(monster.level) || monster.level<1 || monster.level>100
    || !Array.isArray(monster.types) || monster.types.length<1 || monster.types.length>2
    || monster.types.some(type=>!TYPES[type])
    || !Number.isSafeInteger(monster.rank) || monster.rank<0 || monster.rank>10
    || !monster.stats || !monster.move || !TYPES[monster.move.type]
    || !['physical','special'].includes(monster.move.category)
    || !Number.isFinite(monster.move.power) || monster.move.power<=0 || monster.move.power>250
    || !Number.isFinite(monster.move.accuracy) || monster.move.accuracy<0 || monster.move.accuracy>100
    || !Number.isSafeInteger(monster.move.priority)
    || monster.move.priority< -7 || monster.move.priority>7
    || !['hp','attack','defense','specialAttack','specialDefense','speed'].every(stat=>{
      const value=monster.stats[stat as keyof StatValues];
      return Number.isSafeInteger(value) && value>0 && value<=100000;
    })) throw new RangeError('Combatente inválido.');
}

/** Cálculo do legado com dois rolls EXPLÍCITOS e reproduzíveis. */
export function kantoDamage(
  attacker:Combatant,defender:Combatant,criticalRoll:number,varianceRoll:number
): {readonly damage:number;readonly critical:boolean;readonly effectiveness:number} {
  validateCombatant(attacker);validateCombatant(defender);
  if (![criticalRoll,varianceRoll].every(v=>Number.isFinite(v)&&v>=0&&v<1)) {
    throw new RangeError('Rolagens devem pertencer a [0,1).');
  }
  const physical=attacker.move.category==='physical';
  const attack=Math.max(1,physical?attacker.stats.attack:attacker.stats.specialAttack);
  const defense=Math.max(1,physical?defender.stats.defense:defender.stats.specialDefense);
  const power=Math.max(1,Math.round(attacker.move.power*(1+attacker.rank*.05)));
  const base=Math.floor((((2*attacker.level/5+2)*power*attack/defense)/50)+2);
  const stab=attacker.types.includes(attacker.move.type)?1.5:1;
  const critical=criticalRoll<.0625;
  const effectiveness=kantoTypeMultiplier(attacker.move.type,defender.types);
  const damage=effectiveness===0?0:
    Math.max(1,Math.floor(base*stab*(critical?1.5:1)*effectiveness*(.9+varianceRoll*.1)));
  return {damage,critical,effectiveness};
}

/** Não usa Date, Math.random, estado global ou backend. */
export function simulateKantoBattle(
  player:Combatant,wild:Combatant,seed:number
):KantoBattleResult {
  validateCombatant(player);validateCombatant(wild);
  if (!Number.isSafeInteger(seed) || seed<0 || seed>0xffffffff) {
    throw new RangeError('Seed uint32 inválida.');
  }
  let state=seed>>>0;
  const roll=():number => {
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    return state/0x100000000;
  };
  let playerHp=player.stats.hp,wildHp=wild.stats.hp,turns=0;
  const log:string[]=[`${player.name} (Nv. ${player.level}) vs ${wild.name} (Nv. ${wild.level})`];
  while (turns<30 && playerHp>0 && wildHp>0) {
    turns++;
    let playerFirst=player.move.priority>wild.move.priority
      || player.move.priority===wild.move.priority && (
        player.stats.speed>wild.stats.speed
        || player.stats.speed===wild.stats.speed && roll()<.5
      );
    const order=playerFirst ? [player,wild] : [wild,player];
    for (const actor of order) {
      if (playerHp===0||wildHp===0) break;
      if (roll()*100>actor.move.accuracy) {
        log.push(`T${turns} · ${actor.name} errou ${actor.move.name}.`);
        continue;
      }
      const hit=kantoDamage(actor,actor===player?wild:player,roll(),roll());
      if (actor===player) wildHp=Math.max(0,wildHp-hit.damage);
      else playerHp=Math.max(0,playerHp-hit.damage);
      const effect=hit.effectiveness===0?' · Imune'
        : hit.effectiveness>=2?' · Super efetivo'
          : hit.effectiveness<1?' · Resistido':'';
      log.push(`T${turns} · ${actor.name} usou ${actor.move.name}: ${hit.damage} dano${hit.critical?' · CRÍTICO':''}${effect}.`);
    }
  }
  const outcome:BattleOutcome=wildHp===0&&playerHp>0?'win'
    : playerHp>0&&wildHp>0?'draw':'loss';
  const affinityGain=outcome==='win'?2+Math.floor(roll()*4):null;
  const captured=outcome==='win'&&roll()<.35;
  log.push(outcome==='win'?'Vitória! Recompensas de combate recebidas.'
    : outcome==='draw'?'Empate: limite de 30 turnos.'
      :'Derrota. Treine seu Pokémon e tente novamente.');
  if (captured) log.push(`Captura! ${wild.name} entrou na coleção.`);
  return {
    outcome,turns,playerRemainingHp:playerHp,wildRemainingHp:wildHp,
    wildSpeciesId:wild.speciesId,affinityGain,captured,log
  };
}
