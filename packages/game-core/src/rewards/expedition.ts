/** D064BJ: cálculo puro de expedição, idêntico no writer e na interface.
 * Todos os valores são por resgate, limitados a 8h (2880 ciclos).
 * A evolução do nível DURANTE a simulação evita conceder 8h de XP de uma
 * região inicial a um Pokémon que já deixou a faixa adequada.
 */
import {grantXp} from '../progression/xp.js';
import type {LevelProgress} from '../progression/xp.js';
import {expeditionProgressFactor,expeditionRegionRates,scaledRegionalReward}
  from './regionProgression.js';

export const EXPEDITION_CYCLE_MS=10000;
export const MAX_EXPEDITION_CYCLES=2880;
export type ExpeditionBallKind='poke-ball'|'great-ball'|'ultra-ball';
export type ExpeditionBallProgress=Record<ExpeditionBallKind,number>;
export const EXPEDITION_BALL_PERIODS:Readonly<ExpeditionBallProgress>={
  'poke-ball':1440, // uma a cada 4h de ciclos elegíveis
  'great-ball':2880, // uma a cada 8h, a partir da quinta área
  'ultra-ball':8640 // uma a cada 24h, exclusivamente áreas 9 e 10
};
export function emptyExpeditionBallProgress():ExpeditionBallProgress{
  return {'poke-ball':0,'great-ball':0,'ultra-ball':0};
}
export interface ExpeditionContext {
  readonly regionId:number;
  readonly pokemon:readonly LevelProgress[];
  readonly ballProgress?:Readonly<Partial<ExpeditionBallProgress>>;
  readonly masteryXpPercent?:number;
  readonly masteryXpRemainder?:number;
}
export interface ExpeditionRewards {
  readonly cycles:number;
  readonly coins:number;
  readonly trainerXp:number;
  readonly pokemonXpPerMember:number;
  /** XP real por posição na equipe bloqueada pela expedição. */
  readonly pokemonXpByMember?:readonly number[];
  readonly ballDrops?:Readonly<ExpeditionBallProgress>;
  readonly ballProgress?:Readonly<ExpeditionBallProgress>;
  /** Mantido somente para ler caller antigo; sempre zero nesta versão. */
  readonly affinityGainPerMember:number;
  readonly masteryXpRemainder?:number;
}
const safe=(v:unknown):v is number=>
  typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;

export function expeditionRewards(elapsedMs:number,context?:ExpeditionContext):ExpeditionRewards{
  const elapsed=Number.isFinite(elapsedMs)?Math.max(0,elapsedMs):0;
  const cycles=Math.min(MAX_EXPEDITION_CYCLES,Math.floor(elapsed/EXPEDITION_CYCLE_MS));
  if(!context){
    // Saves antigos sem regionId mantêm a taxa histórica, mas nunca afinidade.
    return {cycles,coins:cycles*7,trainerXp:cycles*4,
      pokemonXpPerMember:cycles*5,affinityGainPerMember:0};
  }
  const rates=expeditionRegionRates(context.regionId);
  if(!Array.isArray(context.pokemon)||!context.pokemon.length
    ||context.pokemon.length>3)throw new RangeError('Equipe de expedição inválida.');
  const profiles=context.pokemon.map(value=>{
    if(!Number.isSafeInteger(value.level)||value.level<1||value.level>100
      ||!safe(value.xp))throw new RangeError('Nível/XP da expedição inválido.');
    return {level:value.level,xp:value.xp};
  });
  const progress=emptyExpeditionBallProgress();
  for(const kind of Object.keys(progress) as ExpeditionBallKind[]){
    const n=context.ballProgress?.[kind]??0;
    if(!safe(n))throw new RangeError('Progresso de Pokébolas inválido.');
    progress[kind]=n;
  }
  const percent=context.masteryXpPercent??0;
  let remainder=context.masteryXpRemainder??0;
  if(![0,2,5,10].includes(percent)||!safe(remainder)||remainder>=100||(!percent&&remainder!==0))throw new RangeError('Invalid expedition mastery');
  const drops=emptyExpeditionBallProgress();
  const xpByMember=profiles.map(()=>0);
  let coins=0,trainerXp=0;
  for(let i=0;i<cycles;i++){
    const leaderFactor=expeditionProgressFactor(context.regionId,profiles[0]!.level);
    const earnedCoins=scaledRegionalReward(rates.coins,leaderFactor);
    const earnedTrainerXp=scaledRegionalReward(rates.trainerXp,leaderFactor);
    coins+=earnedCoins;
    trainerXp+=earnedTrainerXp;
    // D064BS: somente o primeiro UID da composição, líder ao iniciar
    // a expedição, recebe XP. Os outros membros não progridem neste modo.
    const current=profiles[0]!;
    const factor=expeditionProgressFactor(context.regionId,current.level);
    const base=current.level===100?0:scaledRegionalReward(rates.pokemonXp,factor);
    const extra=base*percent+remainder;
    const gained=base+Math.floor(extra/100);
    remainder=extra%100;
    xpByMember[0]!+=gained;
    if(gained>0)profiles[0]=grantXp('pokemon',current,gained);
    // Se o fator não entrega nenhuma moeda/XP após arredondamento, o ciclo
    // não deve alimentar a reposição de Pokébolas indefinidamente.
    if(leaderFactor>0&&(earnedCoins>0||earnedTrainerXp>0)){
      const eligible:ExpeditionBallKind[]=['poke-ball'];
      if(context.regionId>=5)eligible.push('great-ball');
      if(context.regionId>=9)eligible.push('ultra-ball');
      for(const kind of eligible){
        const prior=progress[kind];
        if(!Number.isSafeInteger(prior+1))throw new RangeError('Progresso da expedição esgotado.');
        progress[kind]=prior+1;
        if(Math.floor(progress[kind]/EXPEDITION_BALL_PERIODS[kind])>
          Math.floor(prior/EXPEDITION_BALL_PERIODS[kind]))drops[kind]++;
      }
    }
  }
  return {cycles,coins,trainerXp,pokemonXpPerMember:xpByMember[0]??0,
    pokemonXpByMember:xpByMember,ballDrops:drops,ballProgress:progress,
    affinityGainPerMember:0,...(percent?{masteryXpRemainder:remainder}:{})};
}
