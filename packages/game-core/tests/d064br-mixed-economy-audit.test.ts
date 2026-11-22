import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,KANTO_BALL_SHOP_PRICE_POLICY,quoteKantoBallShopPurchase,
  d064DraftBallDrop,d064BattleBallDropRates,expeditionRewards,
  emptyExpeditionBallProgress,kantoRegionalEncounter,
  resolveKantoCaptureAttempt,battleProgressFactor,scaledRegionalReward,
  D064_DRAFT_STARTER_BALLS
} from '../src/index.js';
import type {KantoBallId,KantoBallPocketV1,KantoShopBallId} from '../src/index.js';

const TYPES=['poke-ball','great-ball','ultra-ball'] as const;
type Stock=Record<(typeof TYPES)[number],number>;
const zero=():Stock=>({'poke-ball':0,'great-ball':0,'ultra-ball':0});

/** D064BR: cenário SINTÉTICO de estresse, sem prometer taxa de vitórias:
 * - 1 Pokémon exatamente no teto de cada região, 1 resgate real de 8h;
 * - 1.000 vitórias econômicas HIPOTÉTICAS (100% win rate, sem ganho de níveis
 *   entre lutas) com seed/encounters/drops reais;
 * - uma tentativa real de captura a cada 3 vitórias, se há bolso e moedas;
 * - compre 5 Poké Balls quando precisar, 1 Ultra só se lendário aparecer
 *   sem estoque; use Great apenas quando Poké não existir.
 * - não modela batalhas perdidas, equipamento, tempo de combate, moves,
 *   evolução, replay ou variedade de escolhas humanas.
 * O propósito é contabilidade e sensibilidade, não telemetria de produção.
 */
function simulateRegion(regionId:number){
  const region=KANTO_REGIONS.find(r=>r.id===regionId)!;
  let coins=0;
  let pocket:KantoBallPocketV1={
    version:1,quantities:{...D064_DRAFT_STARTER_BALLS.quantities}
  };
  const battleDrops=zero(),expeditionDrops=zero(),purchased=zero(),spent=zero();
  let battleCoins=0,expeditionCoins=0,purchaseCoins=0;
  let attempts=0,captures=0,missed=0,rareEncounters=0;
  const reward=expeditionRewards(8*60*60*1000,{
    regionId,pokemon:[{level:region.levelMax,xp:0}],
    ballProgress:emptyExpeditionBallProgress()
  });
  expeditionCoins+=reward.coins;coins+=reward.coins;
  for(const id of TYPES){
    const qty=reward.ballDrops?.[id]??0;
    expeditionDrops[id]+=qty;
    pocket={version:1,quantities:{
      ...pocket.quantities,[id]:(pocket.quantities[id]??0)+qty
    }};
  }
  function buy(ball:KantoShopBallId,quantity:number){
    const quoted=quoteKantoBallShopPurchase({
      coins,pocket,trainerLevel:region.trainerUnlockLevel,
      ballId:ball,quantity
    },KANTO_BALL_SHOP_PRICE_POLICY);
    if(quoted.status!=='quoted')return false;
    coins=quoted.remainingCoins;
    purchaseCoins+=quoted.cost;
    pocket=quoted.pocket;
    purchased[ball]+=quantity;
    return true;
  }
  for(let i=0;i<1000;i++){
    const seed=Math.imul(i+1,0x85ebca6b)>>>0;
    const encounter=kantoRegionalEncounter(regionId,seed,region.levelMax);
    if(!encounter)throw Error('Encontro inválido');
    const factor=battleProgressFactor(region.levelMax,encounter.level);
    if(factor<=0)throw Error('Não era vitória economicamente elegível');
    const received=scaledRegionalReward(25+3*encounter.level,factor);
    coins+=received;battleCoins+=received;
    const drop=d064DraftBallDrop(regionId,seed,'regional-v02-'+(i+1));
    if(!drop)throw Error('Drop ausente');
    for(const id of TYPES){
      battleDrops[id]+=drop[id];
      pocket={version:1,quantities:{
        ...pocket.quantities,[id]:(pocket.quantities[id]??0)+drop[id]
      }};
    }
    if((i+1)%3!==0)continue;
    const rare=region.rareSpeciesIds.includes(encounter.speciesId);
    if(rare)rareEncounters++;
    let ball:KantoShopBallId=rare?'ultra-ball':'poke-ball';
    if(!rare&&(pocket.quantities['poke-ball']??0)===0){
      if((pocket.quantities['great-ball']??0)>0)ball='great-ball';
      else buy('poke-ball',5);
    }
    if(rare&&(pocket.quantities['ultra-ball']??0)===0)buy('ultra-ball',1);
    if((pocket.quantities[ball]??0)===0){missed++;continue;}
    const capture=resolveKantoCaptureAttempt({
      regionId,speciesId:encounter.speciesId,
      ballId:ball,pocket,maxHp:100,currentHp:0,
      seed:(seed^0xa5a5a5a5)>>>0
    });
    if(capture.status!=='resolved')throw Error('Captura não pôde ser resolvida');
    pocket=capture.pocket;
    spent[ball]++;
    attempts++;
    if(capture.captured)captures++;
  }
  const final=zero();
  for(const id of TYPES){
    final[id]=pocket.quantities[id]??0;
    expect(final[id]).toBe( (D064_DRAFT_STARTER_BALLS.quantities[id]??0)
      +battleDrops[id]+expeditionDrops[id]+purchased[id]-spent[id]);
    expect(final[id]).toBeGreaterThanOrEqual(0);
    expect(final[id]).toBeLessThanOrEqual(100000);
  }
  expect(coins).toBe(battleCoins+expeditionCoins-purchaseCoins);
  expect(coins).toBeGreaterThanOrEqual(0);
  expect(attempts+missed).toBe(333);
  expect(captures).toBeLessThanOrEqual(attempts);
  const rates=d064BattleBallDropRates(regionId)!;
  for(const id of TYPES){
    expect(Math.abs(battleDrops[id]-1000*rates[id]/100)).toBeLessThan(35);
  }
  return{
    regionId,battleCoins,expeditionCoins,purchaseCoins,coins,
    attempts,captures,missed,rareEncounters,
    battleDrops,expeditionDrops,purchased,spent,final
  };
}

describe('D064BR — auditoria longitudinal de 1.000 vitórias e compras/capturas',()=>{
  it('conserva cada bola e cada moeda nas quatro bandas da economia real',()=>{
    const samples=[1,4,7,9,10].map(simulateRegion);
    expect(samples).toHaveLength(5);
    expect(samples[0]!.purchased['ultra-ball']).toBe(0);
    expect(samples[1]!.battleDrops['ultra-ball']).toBe(0);
    expect(samples[2]!.battleDrops['ultra-ball']).toBeGreaterThan(0);
    expect(samples[3]!.battleDrops['ultra-ball']).toBeGreaterThan(0);
    expect(samples[4]!.battleDrops['ultra-ball']).toBeGreaterThan(0);
    // O valor beta da Ultra deve permanecer explícito durante o teste.
    expect(KANTO_BALL_SHOP_PRICE_POLICY.unitPrices).toEqual({
      'poke-ball':600,'great-ball':2400,'ultra-ball':16000
    });
    // O cenário é reproduzível; não depender de relógio, Math.random ou rede.
    expect(samples).toEqual([1,4,7,9,10].map(simulateRegion));
  },30000);
  it('cada banda sorteia entre zero e um item e nunca permite Ultra em R1–R6',()=>{
    for(const regionId of [1,4,7,9,10]){
      const rate=d064BattleBallDropRates(regionId)!;
      let none=0;
      for(let i=0;i<5000;i++){
        const seed=Math.imul(i+1,0x85ebca6b)>>>0;
        const drop=d064DraftBallDrop(regionId,seed,'regional-v02-'+(i+1))!;
        const total=TYPES.reduce((sum,key)=>sum+drop[key],0);
        expect(total).toBeLessThanOrEqual(1);
        if(total===0)none++;
        if(regionId<=6)expect(drop['ultra-ball']).toBe(0);
      }
      expect(none).toBeGreaterThan(0);
      expect(none).toBeLessThan(5000);
      expect(rate['ultra-ball']).toBe(regionId>=9?7:regionId>=7?5:0);
    }
  });
});
