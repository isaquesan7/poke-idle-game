/**
 * D-064E — CURVA EXPERIMENTAL para simulação, não ligada a saves ou recompensas.
 * A função puramente matemática permite comparar economia, jogo e expedição
 * antes de habilitar mudanças reais. NUNCA chamar do writer sem aprovação
 * da curva e testes de migração dos jogadores.
 */
import {KANTO_REGIONS} from './kantoRegions.js';

export type RegionalDraftReward={
  readonly coins:number;
  readonly trainerXp:number;
  readonly pokemonXp:number;
};
const validLevel=(level:number)=>Number.isSafeInteger(level)&&level>=1&&level<=100;

/** XP necessário para avançar do nível L ao L+1. */
export function d064DraftXpThreshold(kind:'trainer'|'pokemon',level:number):number|null{
  if(!validLevel(level)||level===100)return null;
  return kind==='trainer'
    ?110+21*level+Math.ceil(0.8*level*level)
    :55+14*level+Math.ceil(0.55*level*level);
}
/** Recompensas hipotéticas por vitória contra nível W. */
export function d064DraftBattleReward(wildLevel:number):RegionalDraftReward|null{
  if(!validLevel(wildLevel))return null;
  return {
    coins:5+wildLevel,
    trainerXp:10+Math.ceil(1.5*wildLevel),
    pokemonXp:22+Math.ceil(3.5*wildLevel)
  };
}
export type DraftProgress={readonly level:number;readonly xp:number};

/** Applies experimental XP within the D-064 curve. Not for live saves:
 * legacy XP values require a migration plan before switching thresholds. */
export function d064DraftGrantXp(
  kind:'trainer'|'pokemon',previous:DraftProgress,amount:number
):DraftProgress|null{
  if(!validLevel(previous.level)||!Number.isSafeInteger(previous.xp)||previous.xp<0
    ||!Number.isSafeInteger(amount)||amount<0
    ||!Number.isSafeInteger(previous.xp+amount))
    return null;
  const limit=d064DraftXpThreshold(kind,previous.level);
  if(limit!==null&&previous.xp>=limit)return null;
  return applyDraftXp(kind,previous,amount);
}
function applyDraftXp(kind:'trainer'|'pokemon',state:DraftProgress,grant:number):DraftProgress{
  let level=state.level,xp=state.xp+grant;
  while(level<100){
    const threshold=d064DraftXpThreshold(kind,level);
    if(threshold===null||xp<threshold)break;
    xp-=threshold;level++;
  }
  return {level,xp:level===100?0:xp};
}
/** Simulação simplificada para auditar acessibilidade do mapa e curva longa.
 * Assume TODAS as batalhas vencidas, zero expedições e inimigo situado entre
 * limite regional e nível do parceiro. É teto otimista de evolução, não tempo.
 */
export function d064DraftSimulateWins(maxWins:number):{
  readonly trainer:DraftProgress;
  readonly pokemon:DraftProgress;
  readonly totalCoins:number;
  readonly milestoneWins:Readonly<Record<string,number>>;
}|null{
  if(!Number.isSafeInteger(maxWins)||maxWins<1||maxWins>100000)return null;
  let trainer:DraftProgress={level:1,xp:0};
  let pokemon:DraftProgress={level:5,xp:0};
  let totalCoins=0;
  const milestoneWins:Record<string,number>={};
  for(let wins=1;wins<=maxWins;wins++){
    let region=KANTO_REGIONS[0]!;
    for(const r of KANTO_REGIONS)if(trainer.level>=r.trainerUnlockLevel)region=r;
    const wild=Math.max(region.levelMin,Math.min(region.levelMax,pokemon.level));
    const reward=d064DraftBattleReward(wild)!;
    trainer=applyDraftXp('trainer',trainer,reward.trainerXp);
    pokemon=applyDraftXp('pokemon',pokemon,reward.pokemonXp);
    totalCoins+=reward.coins;
    for(const milestone of [10,20,40,60,80,100]){
      if(trainer.level>=milestone&&!milestoneWins['trainer-'+milestone])
        milestoneWins['trainer-'+milestone]=wins;
      if(pokemon.level>=milestone&&!milestoneWins['pokemon-'+milestone])
        milestoneWins['pokemon-'+milestone]=wins;
    }
  }
  return {trainer,pokemon,totalCoins,milestoneWins};
}
