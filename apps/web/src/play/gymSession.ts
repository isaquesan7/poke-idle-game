/**
 * GYM-03B — sessão persistida no MESMO journal do save v0.2.
 *
 * A equipe de três UIDs já foi definida na Coleção. O comando de início
 * recebe SOMENTE seed; não permite escolher nem trocar participantes no
 * Ginásio. Cada comando reconstrói o combate do elenco salvo
 * e reproduz TODO o transcript antes de modificá-lo. Um commit por ação.
 *
 * Importante: armazenamento local e seed fornecida pelo navegador NÃO
 * oferecem antifraude de servidor. Este writer é transacional somente para
 * abas cooperativas sob PLAY_LOCK_NAME / CAS em updatePlaySave.
 */
import {
  KANTO_GYMS, KANTO_BATTLE_SPECIES, KANTO_BATTLE_MOVES,
  KANTO_SUPPORT_MOVES, KANTO_GYM_MASTER_TITLE_STATS,
  LEGACY_ITEMS, STATS, trainerTotals, pokemonFinalStats,
  pokemonMoveSlots, effectiveLegacyTitle, prepareGymOpponent,
  kantoNextGym, createGymBattleState, resolveGymAiTurn,
  applyRewardEvent, gymPsychicLevelMoves
} from '@kanto/game-core';
import type {
  RewardJournal, GymBattleState, GymTurnAction, Combatant, StatValues
} from '@kanto/game-core';

type Entry=Record<string,unknown>;
const rec=(v:unknown):v is Entry=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nat=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const seedOk=(v:unknown):v is number=>nat(v)&&v<=0xffffffff;
export interface GymSessionV1 {
  readonly version:1;
  readonly id:string;
  readonly gymId:string;
  readonly uids:readonly [number,number,number];
  readonly seed:number;
  readonly actions:readonly GymTurnAction[];
}
export type GymSessionCommand=
  | {readonly type:'gym-start';readonly seed:number}
  | {readonly type:'gym-turn';readonly sessionId:string;readonly action:GymTurnAction}
  | {readonly type:'gym-finish';readonly sessionId:string}
  | {readonly type:'gym-abandon';readonly sessionId:string};
export type GymSessionResult=
  | {readonly status:'ok';readonly journal:RewardJournal}
  | {readonly status:'blocked';readonly reason:string};
const blocked=(reason:string):GymSessionResult=>({status:'blocked',reason});
const toJournal=(journal:RewardJournal,game:Entry):GymSessionResult=>({
  status:'ok',journal:{...journal,raw:JSON.stringify(game)}
});
function read(raw:string):Entry|null{
  try{const v:unknown=JSON.parse(raw);return rec(v)?v:null;}
  catch{return null;}
}
function readSession(v:unknown):GymSessionV1|null{
  if(!rec(v)||v.version!==1||typeof v.id!=='string'
    ||!/^gym-v02-[1-9][0-9]*$/.test(v.id)
    ||typeof v.gymId!=='string'||!seedOk(v.seed)
    ||!Array.isArray(v.uids)||v.uids.length!==3
    ||!v.uids.every((uid:unknown)=>nat(uid)&&uid>0)
    ||new Set(v.uids).size!==3
    ||!Array.isArray(v.actions)||v.actions.length>144)return null;
  const actions:GymTurnAction[]=[];
  for(const a of v.actions){
    if(!rec(a))return null;
    if(a.kind==='basic'||a.kind==='focus')actions.push({kind:a.kind});
    else if(a.kind==='switch'&&nat(a.toIndex)&&a.toIndex<3)
      actions.push({kind:'switch',toIndex:a.toIndex});
    else if(a.kind==='move'&&typeof a.moveName==='string'
      &&/^[a-z][a-z-]{0,49}$/.test(a.moveName))
      actions.push({kind:'move',moveName:a.moveName});
    else return null;
  }
  return {version:1,id:v.id,gymId:v.gymId,
    uids:v.uids as [number,number,number],seed:v.seed,actions};
}
function buildStart(game:Entry,session:GymSessionV1):GymBattleState{
  // A equipe travada no início precisa seguir idêntica à seleção da Coleção.
  // O writer também bloqueia mudanças de equipe enquanto houver gymSession.
  if(!Array.isArray(game.team)||game.team.length!==3||
    game.team.some((uid,i)=>uid!==session.uids[i]))
    throw new RangeError('A equipe foi alterada após entrar no Ginásio.');
  if(!Array.isArray(game.badges)||!game.badges.every(id=>typeof id==='string')
    ||!Array.isArray(game.roster)||!rec(game.trainer)
    ||!rec(game.trainer.manual)||!Array.isArray(game.seen)
    ||!nat(game.wins))throw new RangeError('Perfil inválido para Ginásios.');
  const gym=kantoNextGym(game.badges);
  if(!gym||gym.id!==session.gymId)
    throw new RangeError('Ginásio não é o próximo desafio.');
  const trainer=game.trainer;
  const trainerManual=trainer.manual as Entry;
  const earnedBadges=game.badges as string[];
  const manual={} as StatValues;
  for(const stat of STATS){
    const n=trainerManual[stat]??0;
    if(!nat(n)||n>40)throw new RangeError('Pontos de treinador inválidos.');
    manual[stat]=n;
  }
  const equipped=rec(trainer.equipped)?trainer.equipped:{};
  const gear=LEGACY_ITEMS.filter(item=>equipped[item.slot]===item.id);
  const badges=KANTO_GYMS.filter(item=>earnedBadges.includes(item.id))
    .map(item=>({id:item.id,stats:item.badgeStats}));
  const title=effectiveLegacyTitle(trainer.title,game.wins as number,
    game.seen.length,game.badges.length);
  // O título Mestre somente é desbloqueado após as oito insígnias.
  // KANTO_GYM_MASTER_TITLE_STATS é lido pelo catálogo do título.
  void KANTO_GYM_MASTER_TITLE_STATS;
  const totals=trainerTotals({
    manual,equipment:gear.map(item=>({slot:item.slot,stats:item.stats})),
    activeTitle:title.stats,badges
  });
  const roster=game.roster;
  const team=session.uids.map(uid=>{
    const p=roster.find((entry:unknown)=>rec(entry)&&entry.uid===uid);
    if(!rec(p)||!nat(p.level)||p.level<1||p.level>100
      ||!nat(p.pokemonId)||p.pokemonId<1||p.pokemonId>151
      ||!nat(p.affinity)||p.affinity>100||!rec(p.manual))
      throw new RangeError('Pokémon não pertence ao treinador ou é inválido.');
    const species=KANTO_BATTLE_SPECIES[p.pokemonId];
    if(!species)throw new RangeError('Espécie de Pokémon indisponível.');
    const manualPokemon={} as StatValues;
    for(const stat of STATS){
      const n=p.manual[stat]??0;
      if(!nat(n)||n>200)throw new RangeError('Atributos do Pokémon inválidos.');
      manualPokemon[stat]=n;
    }
    const slots=pokemonMoveSlots(p,species.move.name);
    if(slots.length<1||slots.length>4||new Set(slots).size!==slots.length)
      throw new RangeError('Golpes equipados inválidos.');
    const psychic=gymPsychicLevelMoves(species.id,p.level)
      .map(x=>x.move);
    const moves=slots.map(name=>KANTO_BATTLE_MOVES[name]
      ??KANTO_SUPPORT_MOVES[name]??psychic.find(m=>m.name===name));
    if(moves.some(m=>!m))
      throw new RangeError('Golpe não executável em Ginásio.');
    const ranks=rec(p.upgrades)?p.upgrades:{};
    const combatant:Combatant={
      speciesId:species.id,name:species.name,level:p.level,
      types:species.types,
      stats:pokemonFinalStats(species.base,p.level,manualPokemon,totals,p.affinity),
      move:moves[0]!,moves:moves as NonNullable<Combatant['moves']>,
      rank:nat(ranks[moves[0]!.name])?ranks[moves[0]!.name] as number:0,
      ranks:ranks as NonNullable<Combatant['ranks']>
    };
    return {uid,combatant};
  });
  const gymTeam=prepareGymOpponent(gym).team;
  return createGymBattleState(
    team as [typeof team[0],typeof team[0],typeof team[0]],gymTeam
  );
}
/**
 * Reproduz contra a MESMA IA e a mesma seed. A cada turno:
 * seed seguinte = seedAfter do resolvedor; a troca pós-KO não inventa
 * rolagens e não avança o contador de rodada.
 */
/** Variações observadas no estado de cada ação, não novos ataques/rolls. */
export interface GymVisualDelta {
  readonly playerLostHp:boolean;
  readonly leaderLostHp:boolean;
  readonly playerGainedHp:boolean;
  readonly leaderGainedHp:boolean;
  readonly playerGainedSp:boolean;
  readonly leaderGainedSp:boolean;
  readonly playerSwitched:boolean;
  readonly leaderSwitched:boolean;
  readonly playerKo:boolean;
  readonly leaderKo:boolean;
}
export interface GymReplayRound {
  readonly turn:number;
  readonly lines:readonly string[];
  readonly visual:GymVisualDelta;
  /** Snapshots somente leitura para alimentar o MESMO palco regional. */
  readonly before:GymBattleState;
  readonly after:GymBattleState;
  readonly frames:readonly import('@kanto/game-core').KantoBattleVisualFrame[];
  readonly snapshots:readonly GymBattleState[];
}
export interface GymReplayTrace {
  readonly state:GymBattleState;
  /** Log calculado novamente pelo motor, nunca aceito do cliente. */
  readonly rounds:readonly GymReplayRound[];
}
function gymRoundVisual(before:GymBattleState,after:GymBattleState):GymVisualDelta{
  const side=(name:'player'|'leader')=>{
    const b=before[name],a=after[name];
    // Comparar a mesma instância ativa ANTES do turno: troca não é dano.
    const previous=b.fighters[b.activeIndex]!;
    const current=a.fighters[b.activeIndex]!;
    return {
      lostHp:current.hp<previous.hp,
      gainedHp:current.hp>previous.hp,
      gainedSp:current.sp>previous.sp,
      switched:a.activeIndex!==b.activeIndex,
      ko:previous.hp>0&&current.hp===0
    };
  };
  const p=side('player'),l=side('leader');
  return {
    playerLostHp:p.lostHp,leaderLostHp:l.lostHp,
    playerGainedHp:p.gainedHp,leaderGainedHp:l.gainedHp,
    playerGainedSp:p.gainedSp,leaderGainedSp:l.gainedSp,
    playerSwitched:p.switched,leaderSwitched:l.switched,
    playerKo:p.ko,leaderKo:l.ko
  };
}
/** Replay único: o histórico visível é derivado do motor/seed persistidos,
 * sem criar rolls, turnos ou mutações adicionais no save. */
export function replayGymSessionTrace(game:Entry,session:GymSessionV1):GymReplayTrace{
  let state=buildStart(game,session);
  let seed=session.seed;
  const rounds:GymReplayRound[]=[];
  for(const action of session.actions){
    if(state.outcome!=='ongoing')
      throw new RangeError('Transcript contém ações após a conclusão.');
    const result=resolveGymAiTurn(state,action,seed);
    if(result.status!=='applied')
      throw new RangeError('Transcript de Ginásio contém ação ilegal.');
    const before=state;
    const visual=gymRoundVisual(state,result.state);
    state=result.state;
    seed=result.seedAfter;
    rounds.push({turn:state.turn,lines:result.log,visual,before,after:state,
      frames:result.frames,snapshots:result.snapshots});
  }
  return {state,rounds};
}
export function replayGymSession(game:Entry,session:GymSessionV1):GymBattleState{
  return replayGymSessionTrace(game,session).state;
}
export function runGymSessionCommand(
  journal:RewardJournal,action:GymSessionCommand,
  nextRevision:number
):GymSessionResult{
  const game=read(journal.raw);
  if(!game||!nat(nextRevision)||nextRevision<1)
    return blocked('Save de Ginásio inválido.');
  // Recusar sessões paralelas ao replay regional/expedição.
  if(game.pendingBattle||game.expedition!==null
    ||rec(game.lastBattle)&&game.lastBattle.captureStatus==='available')
    return blocked('Conclua a batalha, captura ou expedição em andamento.');
  const pending=game.gymSession;
  if(action.type==='gym-start'){
    if(pending!==undefined&&pending!==null)
      return blocked('Já existe um confronto de Ginásio em andamento.');
    if(!seedOk(action.seed)||Object.hasOwn(action,'uids'))
      return blocked('Defina sua equipe na Coleção antes do Ginásio; seleção no desafio não é permitida.');
    if(!Array.isArray(game.team)||game.team.length!==3||
      new Set(game.team).size!==3||
      !game.team.every(uid=>nat(uid)&&uid>0))
      return blocked('Defina exatamente três Pokémon distintos na Coleção antes de entrar no Ginásio.');
    if(!Array.isArray(game.badges))return blocked('Insígnias inválidas.');
    const gym=kantoNextGym(game.badges);
    if(!gym)return blocked('Nenhum Ginásio desbloqueado.');
    const session:GymSessionV1={
      version:1,id:'gym-v02-'+nextRevision,gymId:gym.id,
      uids:[...game.team] as [number,number,number],
      seed:action.seed,actions:[]
    };
    try{replayGymSession(game,session);}
    catch(e){return blocked(e instanceof Error?e.message:'Equipe inválida.');}
    game.gymSession=session;
    return toJournal(journal,game);
  }
  const session=readSession(pending);
  if(!session||action.sessionId!==session.id)
    return blocked('Sessão inexistente, alterada ou desatualizada.');
  let state:GymBattleState;
  try{state=replayGymSession(game,session);}
  catch(e){return blocked(e instanceof Error?e.message:'Sessão não verificável.');}
  if(action.type==='gym-abandon'){
    delete game.gymSession;
    game.lastGymOutcome={gymId:session.gymId,outcome:'abandoned'};
    return toJournal(journal,game);
  }
  if(action.type==='gym-turn'){
    if(state.outcome!=='ongoing'||session.actions.length>=144)
      return blocked('Confronto encerrado ou limite de ações atingido.');
    if(!rec(action.action))return blocked('Ação do treinador inválida.');
    const proposed=readSession({...session,actions:[...session.actions,action.action]});
    if(!proposed)return blocked('Ação desconhecida.');
    try{state=replayGymSession(game,proposed);}
    catch(e){return blocked(e instanceof Error?e.message:'Ação ilegal.');}
    game.gymSession=proposed;
    return toJournal(journal,game);
  }
  if(state.outcome==='ongoing')
    return blocked('O Ginásio ainda não terminou.');
  delete game.gymSession;
  if(state.outcome!=='player-win'){
    game.lastGymOutcome={gymId:session.gymId,outcome:state.outcome};
    return toJournal(journal,game);
  }
  // Mesmo commit de save: recompensa e remoção da sessão.
  // Replay do botão depois deste commit fica bloqueado pela sessão ausente.
  const award=applyRewardEvent({...journal,raw:JSON.stringify(game)},{
    type:'gym-victory',id:session.id,expectedRevision:journal.revision,
    gymId:session.gymId,battle:state
  });
  return award.status==='applied'
    ?{status:'ok',journal:award.journal}
    :blocked(award.status==='rejected'?award.reason:'Prêmio já processado.');
}
