/**
 * D-064AC — simulação longitudinal com desfecho do combate REAL.
 * Não reproduz uma sessão de jogador: cada batalha restaura HP e SP,
 * não há equipamentos, títulos, evolução de espécie nem cura/tempo real.
 * Estados, moedas, XP, afinidade e Pokébolas existem SÓ em memória.
 */
import {KANTO_BATTLE_SPECIES} from '../combat/kantoBattle.js';
import {pokemonOwnStats,pokemonFinalStats} from '../stats/pokemon.js';
import {zeroStats} from '../stats/types.js';
import {KANTO_REGIONS,kantoRegionalEncounter} from './kantoRegions.js';
import {previewKantoRegionalBattle} from './regionalBattlePreview.js';
import {d064DraftGrantXp,d064DraftBattleReward} from './regionalEconomyDraft.js';
import type {DraftProgress} from './regionalEconomyDraft.js';
import {d064DraftBallDrop} from '../capture/draftBallSupply.js';
import {resolveKantoCaptureAttempt} from '../capture/regionalCaptureAttempt.js';
import type {KantoBallPocketV1} from '../capture/kantoBallPocket.js';
import type {KantoBallId} from '../capture/kantoBalls.js';

export type RealCapturePolicy='none'|'every-win'|'rare-only'|'new-species';
export type RealTrainingPolicy='base'|'focused';
export interface RealRegionalJourneyInput{
  readonly battles:number;
  readonly seed:number;
  readonly speciesIds:readonly number[];
  readonly capturePolicy:RealCapturePolicy;
  readonly trainingPolicy:RealTrainingPolicy;
}
export interface RealRegionalJourneySummary{
  readonly battles:number;readonly wins:number;readonly losses:number;
  readonly draws:number;readonly trainer:DraftProgress;
  readonly pokemon:readonly (DraftProgress&{readonly speciesId:number;readonly affinity:number})[];
  readonly highestRegion:number;readonly unlockBattles:readonly (number|null)[];
  readonly coins:number;readonly rareEncounters:number;
  readonly captures:number;readonly rareCaptures:number;
  readonly caughtSpeciesCount:number;readonly missedCaptureOpportunities:number;
  readonly ballsEarned:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
  readonly ballsSpent:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
  readonly ballsRemaining:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
  /** Maior sequência sem vitória, inclui empates e derrotas. */
  readonly longestNoWinStreak:number;
  /** Número da última batalha vencida, 0 quando nunca houve vitória. */
  readonly lastWinBattle:number;
  /** Quantas vitórias por região realmente ocorreram. */
  readonly winsByRegion:readonly number[];
}
const keys=['poke-ball','great-ball','ultra-ball'] as const;
type Stock=Record<(typeof keys)[number],number>;
const empty=():Stock=>({'poke-ball':0,'great-ball':0,'ultra-ball':0});
const valid=(v:number,a:number,b:number)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
function rng(seed:number):()=>number{
  let s=seed>>>0;
  return()=>{
    s=(s+0x6d2b79f5)>>>0;
    let x=s;
    x=Math.imul(x^(x>>>15),x|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return((x^(x>>>14))>>>0)/4294967296;
  };
}
function ballFor(stock:Stock,rare:boolean):Exclude<KantoBallId,'master-ball'>|null{
  if(rare)return stock['ultra-ball']>0?'ultra-ball':null;
  return stock['poke-ball']>0?'poke-ball'
    :stock['great-ball']>0?'great-ball'
    :stock['ultra-ball']>0?'ultra-ball':null;
}

/**
 * Joga as batalhas de verdade usando previewKantoRegionalBattle.
 * Liderança roda entre UIDs iniciais; derrotas não concedem recompensas.
 * "focused": hipótese não aprovada de 2 pontos por nível repartidos
 * igualmente em HP/Attack, treinador base 20 em cada atributo e +1
 * afinidade por vitória (máx 100). "base" não investe nem dá bônus.
 */
export function d064SimulateRealRegionalJourney(
  input:RealRegionalJourneyInput
):RealRegionalJourneySummary|null{
  if(!input||!valid(input.battles,1,2500)
    ||!valid(input.seed,0,0xffffffff)
    ||!Array.isArray(input.speciesIds)
    ||input.speciesIds.length<1||input.speciesIds.length>3
    ||input.speciesIds.some(id=>!valid(id,1,151))
    ||new Set(input.speciesIds).size!==input.speciesIds.length
    ||!['none','every-win','rare-only','new-species'].includes(input.capturePolicy)
    ||!['base','focused'].includes(input.trainingPolicy))return null;
  const random=rng(input.seed);
  const captureRandom=rng((input.seed^0xa5a5a5a5)>>>0);
  let trainer:DraftProgress={level:1,xp:0};
  const pokemon=input.speciesIds.map(speciesId=>({
    speciesId,level:5,xp:0,affinity:0
  }));
  const regionWins=Array<number>(10).fill(0);
  const unlockBattles:(number|null)[]=Array(10).fill(null);
  unlockBattles[0]=0;
  const balls=empty(),earned=empty(),spent=empty();
  balls['poke-ball']=12;
  const caught=new Set<number>(input.speciesIds);
  let wins=0,losses=0,draws=0,coins=0,rareEncounters=0,
    captures=0,rareCaptures=0,missedCaptureOpportunities=0;
  let noWinStreak=0,longestNoWinStreak=0,lastWinBattle=0;
  for(let b=1;b<=input.battles;b++){
    let region=KANTO_REGIONS[0]!;
    for(const r of KANTO_REGIONS)
      if(trainer.level>=r.trainerUnlockLevel)region=r;
    const active=pokemon[(b-1)%pokemon.length]!;
    const species=KANTO_BATTLE_SPECIES[active.speciesId];
    if(!species)return null;
    const manual=zeroStats();
    if(input.trainingPolicy==='focused'){
      manual.hp=active.level-1;
      manual.attack=active.level-1;
    }
    // A contribuição do treinador é cenário de laboratório, NÃO a
    // progressão real de equipamentos/atributos do save.
    const stats=input.trainingPolicy==='focused'
      ?pokemonFinalStats(species.base,active.level,manual,{
        hp:20,attack:20,defense:20,specialAttack:20,
        specialDefense:20,speed:20
      },active.affinity)
      :pokemonOwnStats(species.base,active.level,manual);
    const battleSeed=Math.floor(random()*4294967296);
    const captureSeed=Math.floor(captureRandom()*4294967296);
    const encounter=kantoRegionalEncounter(region.id,battleSeed,active.level);
    if(!encounter)return null;
    const rare=region.rareSpeciesIds.includes(encounter.speciesId);
    if(rare)rareEncounters++;
    const simulated=previewKantoRegionalBattle(100,region.id,{
      speciesId:species.id,name:species.name,level:active.level,
      types:species.types,stats,move:species.move,rank:0
    },battleSeed);
    if(simulated.status!=='ready')return null;
    const outcome=simulated.preview.battle.outcome;
    if(outcome!=='win'){
      if(outcome==='loss')losses++;else draws++;
      noWinStreak++;
      longestNoWinStreak=Math.max(longestNoWinStreak,noWinStreak);
      continue;
    }
    noWinStreak=0;
    lastWinBattle=b;
    wins++;
    regionWins[region.id-1]!++;
    const reward=d064DraftBattleReward(encounter.level);
    if(!reward)return null;
    const nextTrainer=d064DraftGrantXp('trainer',trainer,reward.trainerXp);
    const nextPokemon=d064DraftGrantXp('pokemon',active,reward.pokemonXp);
    if(!nextTrainer||!nextPokemon)return null;
    trainer=nextTrainer;
    active.level=nextPokemon.level;
    active.xp=nextPokemon.xp;
    if(input.trainingPolicy==='focused')
      active.affinity=Math.min(100,active.affinity+1);
    coins+=reward.coins;
    if(!Number.isSafeInteger(coins))return null;

    const capture=input.capturePolicy==='every-win'
      ||input.capturePolicy==='rare-only'&&rare
      ||input.capturePolicy==='new-species'&&!caught.has(encounter.speciesId);
    if(capture){
      const ball=ballFor(balls,rare);
      if(ball===null)missedCaptureOpportunities++;
      else{
        const resolved=resolveKantoCaptureAttempt({
          regionId:region.id,speciesId:encounter.speciesId,ballId:ball,
          pocket:{version:1,quantities:{...balls}} as KantoBallPocketV1,
          maxHp:100,currentHp:0,seed:captureSeed
        });
        if(resolved.status!=='resolved')return null;
        balls[ball]--;spent[ball]++;
        if(resolved.captured){
          captures++;if(rare)rareCaptures++;
          caught.add(encounter.speciesId);
        }
      }
    }
    const drop=d064DraftBallDrop(region.id,regionWins[region.id-1]!);
    if(!drop)return null;
    for(const key of keys){balls[key]+=drop[key];earned[key]+=drop[key];}
    for(let i=1;i<KANTO_REGIONS.length;i++)
      if(unlockBattles[i]===null
        &&trainer.level>=KANTO_REGIONS[i]!.trainerUnlockLevel)
        unlockBattles[i]=b;
  }
  let highestRegion=1;
  for(let i=0;i<unlockBattles.length;i++)
    if(unlockBattles[i]!==null)highestRegion=i+1;
  return{
    battles:input.battles,wins,losses,draws,trainer,pokemon,
    highestRegion,unlockBattles,coins,rareEncounters,captures,
    rareCaptures,caughtSpeciesCount:caught.size,missedCaptureOpportunities,
    ballsEarned:earned,ballsSpent:spent,ballsRemaining:balls,
    longestNoWinStreak,lastWinBattle,winsByRegion:regionWins
  };
}
