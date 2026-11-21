/**
 * D-064Z — laboratório determinístico de cenários econômicos.
 *
 * NÃO é o simulador real de combate: vitória é um parâmetro de cenário,
 * nunca uma previsão gerada pelos atributos da equipe. Nenhum writer, DOM,
 * Storage, relógio ou progresso de usuário é acessado.
 */
import {KANTO_REGIONS,kantoRegionalEncounter} from './kantoRegions.js';
import {d064DraftBattleReward,d064DraftGrantXp} from './regionalEconomyDraft.js';
import type {DraftProgress} from './regionalEconomyDraft.js';
import {d064DraftBallDrop} from '../capture/draftBallSupply.js';
import {resolveKantoCaptureAttempt} from '../capture/regionalCaptureAttempt.js';
import type {KantoBallId} from '../capture/kantoBalls.js';
import type {KantoBallPocketV1} from '../capture/kantoBallPocket.js';

export type DraftCaptureStrategy='none'|'rare-only'|'every-win';
export interface RegionalScenarioInput{
  readonly battles:number;
  readonly winRate:number;
  readonly teamSize:1|2|3;
  readonly seed:number;
  readonly captureStrategy:DraftCaptureStrategy;
}
export interface RegionalScenarioResult{
  readonly input:RegionalScenarioInput;
  readonly wins:number;
  readonly losses:number;
  readonly trainer:DraftProgress;
  readonly team:readonly DraftProgress[];
  readonly coins:number;
  readonly highestRegion:number;
  readonly regionWins:readonly number[];
  readonly regionBattles:readonly number[];
  readonly unlockBattles:readonly (number|null)[];
  readonly ballsEarned:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
  readonly ballsSpent:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
  readonly remainingBalls:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
  readonly rareEncounters:number;
  readonly rareCaptureAttempts:number;
  readonly rareCaptures:number;
  readonly normalCaptures:number;
  readonly missedCaptureOpportunities:number;
}
const valid=(x:number,min:number,max:number)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const keys=['poke-ball','great-ball','ultra-ball'] as const;
type Stocks=Record<(typeof keys)[number],number>;
const blank=():Stocks=>({'poke-ball':0,'great-ball':0,'ultra-ball':0});
/** Um PRNG reproduzível independente da seed entregue ao combate real. */
function randomFactory(seed:number):()=>number{
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
const pickBall=(stocks:Stocks,rare:boolean):Exclude<KantoBallId,'master-ball'>|null=>
  rare?(stocks['ultra-ball']>0?'ultra-ball':null)
    :stocks['poke-ball']>0?'poke-ball'
    :stocks['great-ball']>0?'great-ball'
    :stocks['ultra-ball']>0?'ultra-ball':null;

/**
 * Supõe vitória/derrota com frequência aleatória fixa e distribui combates
 * em rodízio pelos 1–3 UIDs (cada qual ganha XP próprio apenas se vencer).
 * Em cada vitória, "every-win" tenta capturar uma vez; "rare-only" apenas
 * se a espécie sorteada for rara; estoques zerados perdem a oportunidade.
 *
 * Não contempla dano, SP, afinidade, derrotas por matchup, duração,
 * compras nem expedições. A política é cenarizada, NÃO uma regra aprovada.
 */
export function d064SimulateRegionalScenario(input:RegionalScenarioInput):
  RegionalScenarioResult|null{
  if(!valid(input.battles,1,50000)||!Number.isFinite(input.winRate)
    ||input.winRate<0||input.winRate>1
    ||![1,2,3].includes(input.teamSize)
    ||!valid(input.seed,0,0xffffffff)
    ||!['none','rare-only','every-win'].includes(input.captureStrategy))return null;

  // Sorteio do encontro/vitória isolado do sorteio de captura. Assim,
  // diferentes estratégias podem ser comparadas com os mesmos encontros.
  const rng=randomFactory(input.seed);
  const captureRng=randomFactory((input.seed^0xa5a5a5a5)>>>0);
  let trainer:DraftProgress={level:1,xp:0};
  const team:DraftProgress[]=Array.from({length:input.teamSize},()=>({level:5,xp:0}));
  const regionWins=Array<number>(10).fill(0);
  const regionBattles=Array<number>(10).fill(0);
  const unlockBattles:(number|null)[]=Array(10).fill(null);
  unlockBattles[0]=0;
  const earned=blank(),spent=blank(),stock=blank();
  // Kit de 12 bolas é uma hipótese explícita da D-064I.
  stock['poke-ball']=12;
  let wins=0,losses=0,coins=0,rareEncounters=0,
    rareCaptureAttempts=0,rareCaptures=0,normalCaptures=0,
    missedCaptureOpportunities=0;
  for(let b=1;b<=input.battles;b++){
    let region=KANTO_REGIONS[0]!;
    for(const entry of KANTO_REGIONS)
      if(trainer.level>=entry.trainerUnlockLevel)region=entry;
    const activeIndex=(b-1)%input.teamSize;
    const active=team[activeIndex]!;
    const encounter=kantoRegionalEncounter(
      region.id,Math.floor(rng()*4294967296),active.level
    );
    if(!encounter)return null;
    // Sorteia para toda batalha (mesmo sem tentativa) e mantém o mesmo
    // resultado potencial de captura ao comparar estratégias pareadas.
    const captureSeed=Math.floor(captureRng()*4294967296);
    regionBattles[region.id-1]!++;
    const rare=region.rareSpeciesIds.includes(encounter.speciesId);
    if(rare)rareEncounters++;

    if(rng()>=input.winRate){losses++;continue;}
    wins++;
    regionWins[region.id-1]!++;
    const reward=d064DraftBattleReward(encounter.level);
    if(!reward)return null;
    const newTrainer=d064DraftGrantXp('trainer',trainer,reward.trainerXp);
    const newActive=d064DraftGrantXp('pokemon',active,reward.pokemonXp);
    if(!newTrainer||!newActive)return null;
    trainer=newTrainer;team[activeIndex]=newActive;
    coins+=reward.coins;
    if(!Number.isSafeInteger(coins))return null;

    const shouldTry=input.captureStrategy==='every-win'
      ||input.captureStrategy==='rare-only'&&rare;
    if(shouldTry){
      const ball=pickBall(stock,rare);
      if(ball===null)missedCaptureOpportunities++;
      else{
        const attempt=resolveKantoCaptureAttempt({
          regionId:region.id,speciesId:encounter.speciesId,ballId:ball,
          pocket:{version:1,quantities:{...stock}} as KantoBallPocketV1,
          maxHp:100,currentHp:0,
          seed:captureSeed
        });
        if(attempt.status!=='resolved')return null;
        stock[ball]--;spent[ball]++;
        if(rare)rareCaptureAttempts++;
        if(attempt.captured){if(rare)rareCaptures++;else normalCaptures++;}
      }
    }
    // Igual ao reducer D064J: primeiro desconta a tentativa de captura,
    // depois concede a reposição pela vitória. A bola ganha AGORA só pode
    // ser usada no próximo encontro.
    const drop=d064DraftBallDrop(region.id,regionWins[region.id-1]!);
    if(!drop)return null;
    for(const key of keys){stock[key]+=drop[key];earned[key]+=drop[key];}

    for(let i=1;i<KANTO_REGIONS.length;i++)
      if(unlockBattles[i]===null
        &&trainer.level>=KANTO_REGIONS[i]!.trainerUnlockLevel)
        unlockBattles[i]=b;
  }
  let highestRegion=1;
  for(let i=0;i<KANTO_REGIONS.length;i++)if(unlockBattles[i]!==null)highestRegion=i+1;
  return{
    input:{...input},wins,losses,trainer,team,coins,
    highestRegion,regionWins,regionBattles,unlockBattles,
    ballsEarned:earned,ballsSpent:spent,remainingBalls:stock,
    rareEncounters,rareCaptureAttempts,rareCaptures,normalCaptures,
    missedCaptureOpportunities
  };
}
