/**
 * Batalha v0.2 determinística, sem DOM, PokéAPI, relógio ou Math.random.
 *
 * Reproduz as constantes do combate simplificado v0.1: até 30 turnos,
 * prioridade/velocidade, precisão, dano físico/especial, STAB 1.5,
 * crítico 6,25% ×1.5, variação 0.9–1, efetividade e captura 35% na vitória.
 * Fonte de aleatoriedade: seed uint32 explícito → LCG reproduzível.
 * NÃO é RNG criptográfico, prova antifraude ou cálculo de servidor.
 *
 * Catálogo inicial de espécies e golpes é um SNAPSHOT para rota Alfa;
 * PokéAPI/dados externos poderão ampliar Kanto em uma etapa posterior.
 */
import type { StatValues } from '../stats/types.js';

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

/** 3 iniciais e 8 encontros de rotas Kanto para o primeiro ciclo de batalha. */
export const KANTO_BATTLE_SPECIES: Readonly<Record<number,KantoSpecies>> = {
  1: { id:1,name:'Bulbasaur',types:['grass','poison'],
    base:{hp:45,attack:49,defense:49,specialAttack:65,specialDefense:65,speed:45},move:MOVE.vineWhip },
  4: { id:4,name:'Charmander',types:['fire'],
    base:{hp:39,attack:52,defense:43,specialAttack:60,specialDefense:50,speed:65},move:MOVE.ember },
  7: { id:7,name:'Squirtle',types:['water'],
    base:{hp:44,attack:48,defense:65,specialAttack:50,specialDefense:64,speed:43},move:MOVE.waterGun },
  10: { id:10,name:'Caterpie',types:['bug'],
    base:{hp:45,attack:30,defense:35,specialAttack:20,specialDefense:20,speed:45},move:MOVE.tackle },
  16: { id:16,name:'Pidgey',types:['normal','flying'],
    base:{hp:40,attack:45,defense:40,specialAttack:35,specialDefense:35,speed:56},move:MOVE.gust },
  19: { id:19,name:'Rattata',types:['normal'],
    base:{hp:30,attack:56,defense:35,specialAttack:25,specialDefense:35,speed:72},move:MOVE.quickAttack },
  25: { id:25,name:'Pikachu',types:['electric'],
    base:{hp:35,attack:55,defense:40,specialAttack:50,specialDefense:50,speed:90},move:MOVE.thunderShock },
  37: { id:37,name:'Vulpix',types:['fire'],
    base:{hp:38,attack:41,defense:40,specialAttack:50,specialDefense:65,speed:65},move:MOVE.ember },
  43: { id:43,name:'Oddish',types:['grass','poison'],
    base:{hp:45,attack:50,defense:55,specialAttack:75,specialDefense:65,speed:30},move:MOVE.absorb },
  60: { id:60,name:'Poliwag',types:['water'],
    base:{hp:40,attack:50,defense:40,specialAttack:40,specialDefense:40,speed:90},move:MOVE.bubble },
  74: { id:74,name:'Geodude',types:['rock','ground'],
    base:{hp:40,attack:80,defense:100,specialAttack:30,specialDefense:30,speed:20},move:MOVE.rockThrow }
};

/** Seleção controlada pela seed: nenhum parâmetro de espécie vindo do botão. */
export const KANTO_WILD_POOL = [10,16,19,25,37,43,60,74] as const;

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
