import {describe,expect,it} from 'vitest';
import {
  KANTO_BALL_SHOP_CATALOG,KANTO_BALL_SHOP_STATUS,
  KANTO_BALL_SHOP_PRICE_POLICY,
  quoteKantoBallShopPurchase,
  d064DraftBallDrop,d064BattleBallDropRates,expeditionRewards,emptyExpeditionBallProgress
} from '../src/index.js';
import type {KantoShopPricePolicy,KantoBallPocketV1} from '../src/index.js';

/** Apenas para cenários em testes — PREÇOS NÃO SÃO PUBLICADOS. */
const hypothetical:KantoShopPricePolicy={
  version:1,unitPrices:{'poke-ball':600,'great-ball':2400,'ultra-ball':16000}
};
const pocket=(poke:number,great=0,ultra=0):KantoBallPocketV1=>({
  version:1,quantities:{'poke-ball':poke,'great-ball':great,'ultra-ball':ultra}
});
const input=(ballId:string,quantity:number,coins=32000,trainerLevel=55,
  bag=pocket(12,5,2))=>({ballId,quantity,coins,trainerLevel,pocket:bag});
describe('D064BP — fundação segura de loja, ainda sem preços aprovados',()=>{
  it('não vende itens sem política de preço explícita e não vende Master Ball',()=>{
    expect(KANTO_BALL_SHOP_STATUS).toBe('open');
    expect(KANTO_BALL_SHOP_PRICE_POLICY).toEqual(hypothetical);
    expect(Object.keys(KANTO_BALL_SHOP_CATALOG)).toEqual([
      'poke-ball','great-ball','ultra-ball'
    ]);
    expect(quoteKantoBallShopPurchase(input('poke-ball',1),null)).toMatchObject({
      status:'blocked'
    });
    expect(quoteKantoBallShopPurchase(input('master-ball',1),hypothetical)).toMatchObject({
      status:'blocked'
    });
    expect(quoteKantoBallShopPurchase(input('__proto__',1),hypothetical)).toMatchObject({
      status:'blocked'
    });
  });
  it('preço é fixado pelo contrato confiável; nunca enviado pelo botão',()=>{
    const result=quoteKantoBallShopPurchase(input('ultra-ball',2),hypothetical);
    expect(result).toEqual({
      status:'quoted',cost:32000,remainingCoins:0,policyVersion:1,
      pocket:pocket(12,5,4)
    });
    expect(quoteKantoBallShopPurchase(input('ultra-ball',3),hypothetical)).toMatchObject({
      status:'blocked',reason:'Moedas insuficientes.'
    });
    expect(quoteKantoBallShopPurchase(input('poke-ball',2),hypothetical)).toMatchObject({
      status:'quoted',cost:1200,remainingCoins:30800
    });
  });
  it('trava itens antes do nível, grandes lotes, saldo negativo e bolso no teto',()=>{
    expect(quoteKantoBallShopPurchase(input('ultra-ball',1,32000,54),hypothetical))
      .toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('great-ball',1,32000,19),hypothetical))
      .toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('poke-ball',51),hypothetical))
      .toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('poke-ball',0),hypothetical))
      .toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('ultra-ball',1,-10),hypothetical))
      .toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('poke-ball',2,32000,55,pocket(99999)),hypothetical))
      .toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('poke-ball',1,32000,55,pocket(99999)),hypothetical))
      .toMatchObject({status:'quoted',pocket:pocket(100000)});
  });
  it('rejeita preço manipulado/ausente e não muta política, saldo ou bolso original',()=>{
    const policy={version:1,unitPrices:{
      'poke-ball':600,'great-ball':2400,'ultra-ball':16000
    }} as const;
    const original=pocket(12,5,2);
    const result=quoteKantoBallShopPurchase(
      input('great-ball',3,32000,55,original),policy
    );
    expect(result).toMatchObject({
      status:'quoted',cost:7200,remainingCoins:24800,
      pocket:pocket(12,8,2)
    });
    expect(original).toEqual(pocket(12,5,2));
    expect(policy.unitPrices['great-ball']).toBe(2400);
    expect(quoteKantoBallShopPurchase(input('poke-ball',1),{
      version:1,unitPrices:{'poke-ball':0,'great-ball':2400,'ultra-ball':16000}
    })).toMatchObject({status:'blocked'});
    expect(quoteKantoBallShopPurchase(input('poke-ball',1),{
      version:1,unitPrices:{'poke-ball':600,'great-ball':2400,'ultra-ball':1.5}
    })).toMatchObject({status:'blocked'});
  });
  it('Ultra em batalhas R7+ é INDEPENDENTE de Ultra em expedições R9/10',()=>{
    for(let region=1;region<=10;region++){
      const rates=d064BattleBallDropRates(region)!;
      expect(rates['ultra-ball']).toBe(region<=6?0:region<=8?5:7);
      const battle=d064DraftBallDrop(region,15,'regional-v02-15');
      expect(battle).not.toBeNull();
      if(region<=6)expect(battle?.['ultra-ball']).toBe(0);
      const expedition=expeditionRewards(8*60*60*1000,{
        regionId:region,pokemon:[{level:region<=8?10*region:100,xp:0}],
        ballProgress:emptyExpeditionBallProgress()
      });
      expect(expedition.ballDrops?.['ultra-ball']).toBe(0);
      expect(expedition.ballProgress?.['ultra-ball']).toBe(region>=9?2880:0);
    }
  });
});
