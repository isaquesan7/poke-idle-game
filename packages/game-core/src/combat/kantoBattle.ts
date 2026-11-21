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
import { KANTO_LEVELUP_DAMAGE_MOVES } from '../catalog/kantoLevelMoves.js';
import { kantoMoveSecondaryEffect } from './kantoStatusEffects.js';
import {KANTO_SUPPORT_MOVES,kantoSupportEffect} from '../catalog/kantoSupportMoves.js';
import {kantoMoveHitCount} from './kantoMultiHit.js';
import type { KantoBattleStatus } from './kantoStatusEffects.js';
import {
  KANTO_BASIC_ATTACK,KANTO_CONCENTRATE,KANTO_SP_BALANCE,
  kantoMaxSp,kantoMoveSpCost,kantoFocusRecovery
} from './kantoSkillEnergy.js';

export type KantoMove = Readonly<{
  name: string;
  type: string;
  category: 'physical' | 'special' | 'status';
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

/** Dados de dano verificáveis do learnset piloto; preserva 11 movimentos alfa existentes. */
export const KANTO_BATTLE_MOVES: Readonly<Record<string,KantoMove>> =
  { ...KANTO_LEVELUP_DAMAGE_MOVES, ...Object.fromEntries(Object.values(MOVE).map(move=>[move.name,move])) };

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
  /** Opcional para progresso legado: primeiro item é o principal. */
  moves?:readonly KantoMove[];
  ranks?:Readonly<Record<string,number>>;
}>;

export type BattleOutcome = 'win' | 'loss' | 'draw';

/** Um snapshot visual por linha: não é comando para recalcular a batalha. */
export type KantoBattleVisualKind =
  'intro'|'attack'|'miss'|'status'|'heal'|'residual'|'focus'|'outcome'|'info';

export interface KantoBattleVisualFrame {
  readonly playerHp: number;
  readonly wildHp: number;
  readonly kind: KantoBattleVisualKind;
  readonly target: 'player'|'wild'|null;
  /** Valor positivo de dano/recuperação; zero para status ou texto. */
  readonly amount: number;
  /** Trilha adicional de SP, opcional para batalhas de versões anteriores. */
  readonly playerSp?:number;
  readonly wildSp?:number;
  readonly actor?:'player'|'wild';
  readonly moveName?:string;
  readonly moveType?:string;
  readonly spCost?:number;
  /** Somente ação Concentrar; SP já refletido no snapshot por linha. */
  readonly spRecovery?:number;
  readonly critical?:boolean;
  readonly effectiveness?:number;
  /** Acertos por ação (D-045); opcional em replays antigos e golpes de 1 hit. */
  readonly hitIndex?:number;
  readonly hitTotal?:number;
}

export interface KantoBattleResult {
  readonly outcome: BattleOutcome;
  readonly turns: number;
  readonly playerRemainingHp: number;
  readonly wildRemainingHp: number;
  readonly wildSpeciesId: number;
  readonly affinityGain: number | null;
  readonly captured: boolean;
  readonly log: readonly string[];
  /** Identidade e HP no MOMENTO do combate; não reutilizar Pokémon líder atual. */
  readonly playerSpeciesId:number;
  readonly playerName:string;
  readonly playerLevel:number;
  readonly playerMaxHp:number;
  readonly wildMaxHp:number;
  readonly playerMaxSp:number;
  readonly wildMaxSp:number;
  readonly playerRemainingSp:number;
  readonly wildRemainingSp:number;
  /** Trilha visual imutável com cardinalidade e ordem idênticas ao log. */
  readonly frames:readonly KantoBattleVisualFrame[];
  /** Condições apenas do encontro, nunca persistidas no roster. */
  readonly playerStatus: KantoBattleStatus|null;
  readonly wildStatus: KantoBattleStatus|null;
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

function validMove(m:KantoMove|undefined):boolean{
  if(!m||typeof m.name!=='string'||m.name.length<1||m.name.length>100
    ||!TYPES[m.type]||!Number.isFinite(m.accuracy)||m.accuracy<0||m.accuracy>100
    ||!Number.isSafeInteger(m.priority)||m.priority< -7||m.priority>7)return false;
  if(m.name===KANTO_BASIC_ATTACK.name){
    return m.category===KANTO_BASIC_ATTACK.category
      &&m.power===KANTO_BASIC_ATTACK.power
      &&m.type===KANTO_BASIC_ATTACK.type
      &&m.accuracy===KANTO_BASIC_ATTACK.accuracy
      &&m.priority===KANTO_BASIC_ATTACK.priority;
  }
  if(m.category==='status'){
    const canonical=KANTO_SUPPORT_MOVES[m.name];
    return !!canonical&&m.power===0&&m.type===canonical.type
      &&m.accuracy===canonical.accuracy&&m.priority===canonical.priority;
  }
  // Night Shade é a única ofensiva com power:0; validar sempre a ficha fixa.
  if(m.name==='night-shade'){
    const fixed=KANTO_BATTLE_MOVES['night-shade'];
    return !!fixed&&m.type===fixed.type&&m.category===fixed.category
      &&m.power===0&&m.accuracy===fixed.accuracy
      &&m.priority===fixed.priority;
  }
  // D-045: o nome do golpe com 2 hits não pode aceitar potência/tipo adulterados.
  if(m.name==='double-kick'){
    const fixed=KANTO_BATTLE_MOVES['double-kick'];
    return !!fixed&&m.type===fixed.type&&m.category===fixed.category
      &&m.power===fixed.power&&m.accuracy===fixed.accuracy
      &&m.priority===fixed.priority;
  }
  return(m.category==='physical'||m.category==='special')
    &&Number.isFinite(m.power)&&m.power>0&&m.power<=250;
}
function validateCombatant(monster:Combatant,allowInternalBasic=false):void {
  if (!monster || !Number.isSafeInteger(monster.speciesId) || monster.speciesId<1 || monster.speciesId>151
    || typeof monster.name!=='string' || monster.name.length<1 || monster.name.length>80
    || !Number.isSafeInteger(monster.level) || monster.level<1 || monster.level>100
    || !Array.isArray(monster.types) || monster.types.length<1 || monster.types.length>2
    || monster.types.some(type=>!TYPES[type])
    || !Number.isSafeInteger(monster.rank) || monster.rank<0 || monster.rank>10
    || !monster.stats || !validMove(monster.move)
    // Basic Attack só pode ser usado internamente na resolução do golpe.
    || (!allowInternalBasic&&monster.move.name===KANTO_BASIC_ATTACK.name)
    || (monster.moves!==undefined&&(
      !Array.isArray(monster.moves)||monster.moves.length<1||monster.moves.length>4
      ||monster.moves[0]?.name!==monster.move.name
      ||new Set(monster.moves.map(m=>m.name)).size!==monster.moves.length
      ||!monster.moves.every(validMove)
      ||monster.moves.some(m=>m.name===KANTO_BASIC_ATTACK.name)
    ))
    || (monster.ranks!==undefined&&(
      !monster.ranks||typeof monster.ranks!=='object'||Array.isArray(monster.ranks)
      ||!Object.values(monster.ranks).every(r=>Number.isSafeInteger(r)&&r>=0&&r<=10)
    ))
    || !['hp','attack','defense','specialAttack','specialDefense','speed'].every(stat=>{
      const value=monster.stats[stat as keyof StatValues];
      return Number.isSafeInteger(value) && value>0 && value<=100000;
    })) throw new RangeError('Combatente inválido.');
}

/** Cálculo do legado com dois rolls EXPLÍCITOS e reproduzíveis. */
export function kantoDamage(
  attacker:Combatant,defender:Combatant,criticalRoll:number,varianceRoll:number,
  /** Opcional para queimadura: reduz apenas ataque físico (1 ou 0,5). */
  attackScale:number=1
): {readonly damage:number;readonly critical:boolean;readonly effectiveness:number} {
  validateCombatant(attacker,true);validateCombatant(defender,true);
  if(attacker.move.category==='status')throw new RangeError('Golpe sem dano.');
  if (![criticalRoll,varianceRoll].every(v=>Number.isFinite(v)&&v>=0&&v<1)
    || (attackScale!==1&&attackScale!==0.5)) {
    throw new RangeError('Rolagens devem pertencer a [0,1).');
  }
  // D064AS: dano fixo igual ao nível, sem STAB/defesas/crítico/variação.
  // O tipo Ghost ainda bloqueia alvos imunes (Normal); não aplicar resistência.
  if(attacker.move.name==='night-shade'){
    const effectiveness=kantoTypeMultiplier('ghost',defender.types);
    return {damage:effectiveness===0?0:attacker.level,
      critical:false,effectiveness};
  }
  const physical=attacker.move.category==='physical';
  const attack=Math.max(1,Math.floor(
    (physical?attacker.stats.attack:attacker.stats.specialAttack)*(physical?attackScale:1)
  ));
  const defense=Math.max(1,physical?defender.stats.defense:defender.stats.specialDefense);
  const power=Math.max(1,Math.round(attacker.move.power*(1+attacker.rank*.05)));
  const base=Math.floor((((2*attacker.level/5+2)*power*attack/defense)/50)+2);
  // Básico é NEUTRO (sem STAB e sem imunidade/resistência por tipo).
  // Não aplicar essa exceção a Tackle, Scratch ou outros golpes Normais.
  const basic=attacker.move.name===KANTO_BASIC_ATTACK.name;
  const stab=basic?1:attacker.types.includes(attacker.move.type)?1.5:1;
  const critical=criticalRoll<.0625;
  const effectiveness=basic?1:kantoTypeMultiplier(attacker.move.type,defender.types);
  const damage=effectiveness===0?0:
    Math.max(1,Math.floor(base*stab*(critical?1.5:1)*effectiveness*(.9+varianceRoll*.1)));
  return {damage,critical,effectiveness};
}

/**
 * Combate determinístico com condições temporárias.
 * Cada rolagem faz parte do RNG da mesma batalha; replay lê só o log salvo.
 * Status e estágios NÃO são persistidos entre combates.
 */
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
  const playerMaxSp=kantoMaxSp(player.level,player.speciesId),
    wildMaxSp=kantoMaxSp(wild.level,wild.speciesId);
  let playerSp=playerMaxSp,wildSp=wildMaxSp;
  let playerStatus:KantoBattleStatus|null=null,wildStatus:KantoBattleStatus|null=null;
  // D064AR: sono dura 1–3 ações do alvo, nunca atravessa batalhas/saves.
  let playerSleepActions=0,wildSleepActions=0;
  let playerSpeedDrops=0,wildSpeedDrops=0;
  let playerAttackDrops=0,wildAttackDrops=0;
  let playerDefenseDrops=0,wildDefenseDrops=0;
  const pSupportUsed=new Set<string>(),wSupportUsed=new Set<string>();
  let playerSpExhaustionReported=false,wildSpExhaustionReported=false;
  let pFocusUsed=0,wFocusUsed=0;
  let pLastFocus=-100,wLastFocus=-100;
  const log:string[]=[player.name+' (Nv. '+player.level+') vs '+wild.name+' (Nv. '+wild.level+')'];
  const frames:KantoBattleVisualFrame[]=[{
    playerHp,wildHp,playerSp,wildSp,kind:'intro',target:null,amount:0
  }];
  type MoveCue=Pick<KantoBattleVisualFrame,'actor'|'moveName'|'moveType'|'spCost'
    |'spRecovery'|'critical'|'effectiveness'>;
  /** Texto, HP e SP são capturados no MESMO instante para cada evento. */
  const note=(line:string,kind:KantoBattleVisualKind='info',
    target:'player'|'wild'|null=null,amount=0,meta?:MoveCue):void=>{
    log.push(line);
    frames.push({playerHp,wildHp,playerSp,wildSp,kind,target,amount,
      ...(meta??{})});
  };
  const speed=(actor:Combatant):number=>{
    const status=actor===player?playerStatus:wildStatus;
    const drops=actor===player?playerSpeedDrops:wildSpeedDrops;
    const paralysed=status==='paralysis'
      ?Math.max(1,Math.floor(actor.stats.speed/4)):actor.stats.speed;
    // -1 estágio => 2/3, -2 => 1/2, -6 => 1/4.
    return Math.max(1,Math.floor(paralysed*2/(2+drops)));
  };
  const statusAllowed=(status:KantoBattleStatus,target:Combatant):boolean=>
    status==='burn'?!target.types.includes('fire')
      :status==='poison'?!target.types.some(type=>type==='poison'||type==='steel'):true;

  /**
   * IA sem RNG: suporte válido nos dois primeiros turnos, habilidade ofensiva
   * nos turnos ímpares se houver SP, e ataque básico gratuito no intervalo.
   * Isso distribui habilidades e impede "spam" até esgotar a barra.
   */
  const choose=(actor:Combatant,target:Combatant,ownHp:number,targetHp:number,
    targetStatus:KantoBattleStatus|null,attackDrop:number,defenseDrop:number,
    used:Set<string>,ownSp:number,ownMaxSp:number,
    focusUsed:number,lastFocus:number):KantoMove=>{
    const available=actor.moves??[actor.move];
    // D-045: cura própria 1x/batalha apenas quando HP <=50%, se houver SP.
    // Não requer que o inimigo seja atingível por tipo Normal (inclui Ghost).
    const recovery=available.find(move=>{
      if(move.category!=='status'||used.has(move.name)||kantoMoveSpCost(move)>ownSp
        ||turns>26||ownHp>actor.stats.hp*.5||ownHp>=actor.stats.hp)return false;
      return kantoSupportEffect(move.name)?.kind==='heal';
    });
    if(recovery)return recovery;
    if(turns<=2&&ownHp>actor.stats.hp*.35&&targetHp>target.stats.hp*.5){
      const support=available.find(move=>{
        if(move.category!=='status'||used.has(move.name)
          ||kantoMoveSpCost(move)>ownSp)return false;
        const effect=kantoSupportEffect(move.name);
        if(!effect||effect.kind==='heal'
          ||kantoTypeMultiplier(move.type,target.types)===0)return false;
        if(effect.kind==='status')return targetStatus===null&&statusAllowed(effect.status,target);
        return effect.kind==='lower-attack'?attackDrop<3:defenseDrop<3;
      });
      if(support)return support;
    }
    // Concentrar substitui TODO o ataque do turno. IA só descansa se:
    // - está sem SP para qualquer habilidade ofensiva eficaz;
    // - uma recuperação de 30% permitirá usar uma delas;
    // - há HP/tempo para sacrificar a ação;
    // - possui carga e respeita cooldown de 4 rodadas.
    const effective=available.filter(move=>move.category!=='status'
      &&kantoTypeMultiplier(move.type,target.types)>0);
    const cheapest=effective.length?Math.min(...effective.map(kantoMoveSpCost)):Infinity;
    const recovered=kantoFocusRecovery(ownMaxSp,ownSp);
    if(effective.length>0&&ownSp<cheapest
      &&ownSp+recovered>=cheapest
      &&focusUsed<KANTO_SP_BALANCE.maxFocusUses
      &&turns-lastFocus>=KANTO_SP_BALANCE.focusCooldownTurns
      &&turns<=26&&ownHp>actor.stats.hp*.4
      &&targetHp>target.stats.hp*.25)
      return KANTO_CONCENTRATE;
    // Alternância deliberada: todo turno PAR usa básico, sem custo.
    if(turns%KANTO_SP_BALANCE.skillIntervalTurns===0)return KANTO_BASIC_ATTACK;
    const attacks=available.filter(move=>move.category!=='status'
      &&kantoMoveSpCost(move)<=ownSp);
    if(attacks.length===0)return KANTO_BASIC_ATTACK;
    const score=(move:KantoMove):number=>
      move.name==='night-shade'
        ?actor.level*move.accuracy*(kantoTypeMultiplier(move.type,target.types)>0?1:0)
        :(move.name==='night-shade'?actor.level:move.power*kantoMoveHitCount(move.name))
      *move.accuracy*kantoTypeMultiplier(move.type,target.types)
      *(actor.types.includes(move.type)?1.5:1)
      *(move.category==='physical'
        ?actor.stats.attack/Math.max(1,target.stats.defense)
        :actor.stats.specialAttack/Math.max(1,target.stats.specialDefense));
    const best=attacks.reduce((selected,move)=>score(move)>score(selected)?move:selected,attacks[0]!);
    // Não desconsiderar movimentos de poder baixo: drain e status secundário
    // fazem parte da identidade da skill. Com SP e tipo eficaz, utilizá-la.
    return score(best)>0?best:KANTO_BASIC_ATTACK;
  };
  while(turns<30&&playerHp>0&&wildHp>0){
    turns++;
    const playerMove=choose(player,wild,playerHp,wildHp,wildStatus,
      wildAttackDrops,wildDefenseDrops,pSupportUsed,playerSp,playerMaxSp,
      pFocusUsed,pLastFocus);
    const wildMove=choose(wild,player,wildHp,playerHp,playerStatus,
      playerAttackDrops,playerDefenseDrops,wSupportUsed,wildSp,wildMaxSp,
      wFocusUsed,wLastFocus);
    const first=playerMove.priority>wildMove.priority
      || playerMove.priority===wildMove.priority&&(
        speed(player)>speed(wild)||speed(player)===speed(wild)&&roll()<0.5
      );
    const order=first?[player,wild]:[wild,player];
    for(const actor of order){
      if(playerHp===0||wildHp===0)break;
      const isPlayer=actor===player;
      const defender=isPlayer?wild:player;
      const move=isPlayer?playerMove:wildMove;
      const actorStatus=isPlayer?playerStatus:wildStatus;
      if(actorStatus==='sleep'){
        const remaining=isPlayer?playerSleepActions:wildSleepActions;
        if(remaining>0){
          if(isPlayer)playerSleepActions--;else wildSleepActions--;
          note('T'+turns+' · '+actor.name+' está dormindo e não conseguiu agir.',
            'status',isPlayer?'player':'wild');
          continue;
        }
        if(isPlayer)playerStatus=null;else wildStatus=null;
        note('T'+turns+' · '+actor.name+' acordou.','status',isPlayer?'player':'wild');
      }
      if(actorStatus==='paralysis'&&roll()<0.25){
        note('T'+turns+' · '+actor.name+' ficou paralisado e não conseguiu agir.',
          'status',isPlayer?'player':'wild');
        continue;
      }
      const ownSide=isPlayer?'player' as const:'wild' as const;
      const enemySide=isPlayer?'wild' as const:'player' as const;
      if(move.name===KANTO_CONCENTRATE.name){
        const gained=kantoFocusRecovery(isPlayer?playerMaxSp:wildMaxSp,
          isPlayer?playerSp:wildSp);
        if(gained<=0)throw new RangeError('Concentrar escolhido sem SP faltante.');
        if(isPlayer){playerSp+=gained;pFocusUsed++;pLastFocus=turns;}
        else {wildSp+=gained;wFocusUsed++;wLastFocus=turns;}
        note('T'+turns+' · '+actor.name+' usou Concentrar e recuperou '+
          gained+' SP (sem atacar).','focus',ownSide,0,{
            actor:ownSide,moveName:KANTO_CONCENTRATE.name,
            moveType:'typeless',spCost:0,spRecovery:gained
          });
        continue;
      }
      const ownSp=isPlayer?playerSp:wildSp;
      const cost=kantoMoveSpCost(move);
      if(cost>ownSp)throw new RangeError('IA selecionou movimento sem SP.');
      // Pagar ANTES do teste de precisão: erros/imunidade também gastam SP.
      if(isPlayer)playerSp-=cost;else wildSp-=cost;
      if(move.category==='status')(isPlayer?pSupportUsed:wSupportUsed).add(move.name);
      const meta={actor:ownSide,moveName:move.name,
        moveType:move.name===KANTO_BASIC_ATTACK.name?'typeless':move.type,
        spCost:cost};
      const spText=cost?' · -'+cost+' SP':'';
      const isBasic=move.name===KANTO_BASIC_ATTACK.name;
      const displayName=isBasic?'ataque básico':move.name;
      // Comunicar apenas a primeira transição por falta de SP em cada Pokémon.
      const attackSlots=actor.moves??[actor.move];
      const noAttackAffordable=!attackSlots.some(skill=>skill.category!=='status'
        &&kantoMoveSpCost(skill)<=(isPlayer?playerSp:wildSp));
      if(isBasic&&noAttackAffordable
        &&!(isPlayer?playerSpExhaustionReported:wildSpExhaustionReported)){
        if(isPlayer)playerSpExhaustionReported=true;else wildSpExhaustionReported=true;
        note('T'+turns+' · '+actor.name+
          ' ficou sem SP suficiente para habilidades no momento: ataque básico ou Concentrar.');
      }
      if(roll()*100>=move.accuracy){
        note('T'+turns+' · '+actor.name+' errou '+displayName+spText+'.',
          'miss',enemySide,0,meta);
        continue;
      }
      if(move.category==='status'){
        const support=kantoSupportEffect(move.name);
        if(support?.kind==='heal'){
          const before=isPlayer?playerHp:wildHp;
          const restored=Math.min(actor.stats.hp-before,
            Math.max(1,Math.floor(actor.stats.hp*support.healing/100)));
          if(restored>0){
            if(isPlayer)playerHp+=restored;else wildHp+=restored;
            note('T'+turns+' · '+actor.name+' usou recover e recuperou '+
              restored+' HP'+spText+'.','heal',ownSide,restored,meta);
          }else note('T'+turns+' · recover não teve efeito'+spText+'.',
            'info',ownSide,0,meta);
        }else if(!support||kantoTypeMultiplier(move.type,defender.types)===0){
          note('T'+turns+' · '+defender.name+' é imune a '+move.name+spText+'.',
            'status',enemySide,0,meta);
        }else if(support.kind==='status'){
          const current=isPlayer?wildStatus:playerStatus;
          if(current===null&&statusAllowed(support.status,defender)){
            if(isPlayer){
              wildStatus=support.status;
              if(support.status==='sleep')wildSleepActions=1+Math.floor(roll()*3);
            }else{
              playerStatus=support.status;
              if(support.status==='sleep')playerSleepActions=1+Math.floor(roll()*3);
            }
            note('T'+turns+' · '+actor.name+' usou '+move.name+
              ': '+defender.name+' ficou '+
              (support.status==='poison'?'envenenado':support.status==='sleep'?'adormecido':'paralisado')+spText+'.',
              'status',enemySide,0,meta);
          }else note('T'+turns+' · '+move.name+' não teve efeito'+spText+'.',
            'info',enemySide,0,meta);
        }else {
          const drops=support.kind==='lower-attack'
            ?(isPlayer?wildAttackDrops:playerAttackDrops)
            :(isPlayer?wildDefenseDrops:playerDefenseDrops);
          if(drops>=6)note('T'+turns+' · '+move.name+' não teve efeito'+spText+'.',
            'info',enemySide,0,meta);
          else {
            if(support.kind==='lower-attack'){
              if(isPlayer)wildAttackDrops++;else playerAttackDrops++;
            }else if(isPlayer)wildDefenseDrops++;else playerDefenseDrops++;
            note('T'+turns+' · '+actor.name+' usou '+move.name+
              ': '+(support.kind==='lower-attack'?'Ataque':'Defesa')+
              ' de '+defender.name+' diminuiu'+spText+'.',
              'status',enemySide,0,meta);
          }
        }
        continue;
      }
      const ownAttackDrop=isPlayer?playerAttackDrops:wildAttackDrops;
      const foeDefenseDrop=isPlayer?wildDefenseDrops:playerDefenseDrops;
      const stagedActor:Combatant={
        speciesId:actor.speciesId,name:actor.name,types:actor.types,level:actor.level,
        move,rank:isBasic?0:actor.ranks?.[move.name]??(actor.move.name===move.name?actor.rank:0),
        stats:{...actor.stats,attack:Math.max(1,Math.floor(
          actor.stats.attack*2/(2+ownAttackDrop)))}};
      const stagedDefender={...defender,
        stats:{...defender.stats,defense:Math.max(1,Math.floor(
          defender.stats.defense*2/(2+foeDefenseDrop)))}};
      const hitTotal=kantoMoveHitCount(move.name);
      let hit:ReturnType<typeof kantoDamage>|null=null;
      // Double Kick: UMA ação/precisão/custo SP, dois danos com RNG de cada
      // impacto. Cada acerto vira uma linha/frame; interrompe imediatamente
      // no KO ou imunidade. Não reinicia turnos nem duplica recibos.
      for(let index=1;index<=hitTotal;index++){
        hit=kantoDamage(stagedActor,stagedDefender,roll(),roll(),
          actorStatus==='burn'&&move.category==='physical'?0.5:1);
        const hpBeforeHit=isPlayer?wildHp:playerHp;
        if(isPlayer)wildHp=Math.max(0,wildHp-hit.damage);
        else playerHp=Math.max(0,playerHp-hit.damage);
        const effectText=hit.effectiveness===0?' · Imune'
          :hit.effectiveness>=2?' · Super efetivo'
            :hit.effectiveness<1?' · Resistido':'';
        const part=hitTotal>1?' (acerto '+index+'/'+hitTotal+')':'';
        note('T'+turns+' · '+actor.name+' usou '+displayName+part+': '+
          hit.damage+' dano'+(hit.critical?' · CRÍTICO':'')+effectText+
          (index===1?spText:'')+'.',
          'attack',enemySide,Math.min(hpBeforeHit,hit.damage),
          {...meta,...(index>1?{spCost:0}:{}),
            ...(hitTotal>1?{hitIndex:index,hitTotal}:{}),
            critical:hit.critical,effectiveness:hit.effectiveness});
        if(hit.damage===0||(isPlayer?wildHp:playerHp)===0)break;
      }

      // Sem hit efetivo ou alvo já derrotado não há efeitos adicionais.
      if(!hit||hit.damage===0||(isPlayer?wildHp:playerHp)===0)continue;
      const secondary=kantoMoveSecondaryEffect(move.name);
      if(secondary?.kind==='status'&&roll()*100<secondary.chance){
        const targetStatus=isPlayer?wildStatus:playerStatus;
        if(targetStatus===null&&statusAllowed(secondary.status,defender)){
          if(isPlayer)wildStatus=secondary.status;else playerStatus=secondary.status;
          const text=secondary.status==='burn'?'queimado':
            secondary.status==='poison'?'envenenado':'paralisado';
          note('T'+turns+' · '+defender.name+' ficou '+text+'.',
            'status',isPlayer?'wild':'player');
        }
      }else if(secondary?.kind==='drain'){
        const missing=actor.stats.hp-(isPlayer?playerHp:wildHp);
        const restored=Math.min(missing,Math.max(1,Math.floor(hit.damage*secondary.percent/100)));
        if(restored>0){
          if(isPlayer)playerHp+=restored;else wildHp+=restored;
          note('T'+turns+' · '+actor.name+' recuperou '+restored+' HP com '+move.name+'.',
            'heal',isPlayer?'player':'wild',restored);
        }
      }else if(secondary?.kind==='speed-drop'&&roll()*100<secondary.chance){
        const drops=isPlayer?wildSpeedDrops:playerSpeedDrops;
        if(drops<6){
          if(isPlayer)wildSpeedDrops++;else playerSpeedDrops++;
          note('T'+turns+' · Velocidade de '+defender.name+' diminuiu.','status',isPlayer?'wild':'player');
        }
      }
    }
    // HP residual de condições no fim do turno; 1/8 do HP máximo.
    for(const actor of [player,wild]){
      const own=actor===player;
      const status=own?playerStatus:wildStatus;
      const hp=own?playerHp:wildHp;
      if(hp<=0||(status!=='burn'&&status!=='poison'))continue;
      const damage=Math.min(hp,Math.max(1,Math.floor(actor.stats.hp/8)));
      if(own)playerHp-=damage;else wildHp-=damage;
      note('T'+turns+' · '+actor.name+' sofreu '+damage+' dano por '+
        (status==='burn'?'queimadura':'envenenamento')+'.',
        'residual',own?'player':'wild',damage);
    }
  }
  // KO simultâneo pelo dano residual = empate, sem bônus.
  const outcome:BattleOutcome=wildHp===0&&playerHp===0?'draw'
    :wildHp===0?'win':playerHp===0?'loss':'draw';
  const affinityGain=outcome==='win'?2+Math.floor(roll()*4):null;
  const captured=outcome==='win'&&roll()<0.35;
  note(outcome==='win'?'Vitória! Recompensas de combate recebidas.'
    :outcome==='draw'?(playerHp===0?'Empate: ambos os Pokémon desmaiaram.':'Empate: limite de 30 turnos.')
      :'Derrota. Treine seu Pokémon e tente novamente.','outcome');
  if(captured)note('Captura! '+wild.name+' entrou na coleção.','outcome');
  return{
    outcome,turns,playerRemainingHp:playerHp,wildRemainingHp:wildHp,
    playerMaxSp,wildMaxSp,playerRemainingSp:playerSp,wildRemainingSp:wildSp,
    wildSpeciesId:wild.speciesId,affinityGain,captured,log,
    playerStatus,wildStatus,
    playerSpeciesId:player.speciesId,playerName:player.name,playerLevel:player.level,
    playerMaxHp:player.stats.hp,wildMaxHp:wild.stats.hp,frames
  };
}
