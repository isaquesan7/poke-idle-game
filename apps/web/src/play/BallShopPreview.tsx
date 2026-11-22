import {useState} from 'react';
import {
  KANTO_BALL_SHOP_CATALOG,KANTO_BALL_SHOP_PRICE_POLICY,
  KANTO_SHOP_BALL_POCKET_CAP
} from '@kanto/game-core';
import type {KantoBallId,KantoShopBallId} from '@kanto/game-core';
import styles from './PlayApp.module.css';

interface BallShopPreviewProps {
  readonly coins:number;
  readonly trainerLevel:number;
  readonly quantities:Readonly<Partial<Record<KantoBallId,number>>>;
  readonly busy:boolean;
  readonly onBuy:(ballId:KantoShopBallId,quantity:number)=>void;
}
const BATCHES=[1,5,10,25,50] as const;

/** O preço é somente para exibição. O writer deriva tudo da política CORE,
 * nunca confia neste campo, nem no custo do DOM ou no valor do select.
 */
export function BallShopPreview({
  coins,trainerLevel,quantities,busy,onBuy
}:BallShopPreviewProps){
  const [batches,setBatches]=useState<Record<KantoShopBallId,number>>({
    'poke-ball':1,'great-ball':1,'ultra-ball':1
  });
  return(
    <section className={styles.panel+' '+styles.shopPreview}
      aria-label="Loja Pokémon" data-testid="shop-preview">
      <div className={styles.kicker}>LOJA POKÉMON · PREÇOS BETA</div>
      <h2>Pokébolas e suprimentos</h2>
      <p>Use moedas conquistadas em batalhas e expedições para completar sua mochila.
        Os itens são entregues imediatamente após a confirmação da compra.</p>
      <div className={styles.shopSummary}>
        <div><small>Saldo disponível</small><strong data-testid="shop-coins">
          {coins.toLocaleString('pt-BR')} moedas</strong></div>
        <div><small>Política de preços</small><strong>Beta v{KANTO_BALL_SHOP_PRICE_POLICY.version}</strong></div>
      </div>
      <div className={styles.shopItems}>
        {Object.values(KANTO_BALL_SHOP_CATALOG).map(item=>{
          const unlocked=trainerLevel>=item.trainerUnlockLevel;
          const unit=KANTO_BALL_SHOP_PRICE_POLICY.unitPrices[item.id];
          const quantity=batches[item.id];
          const cost=unit*quantity;
          const balance=quantities[item.id]??0;
          const canBuy=unlocked&&!busy&&coins>=cost
            &&balance+quantity<=KANTO_SHOP_BALL_POCKET_CAP;
          return <article className={styles.shopItem} key={item.id}
            data-testid={'shop-item-'+item.id}>
            <div className={styles.shopIcon} aria-hidden="true">
              <i className="fa-solid fa-circle"/>
            </div>
            <div>
              <h3>{item.name}</h3>
              <p>{unlocked?'Disponível para comprar':'Desbloqueia no nível '+
                item.trainerUnlockLevel+' do treinador'}</p>
              <small>Na mochila: {balance}</small>
              <div className={styles.shopPurchaseControls}>
                <label htmlFor={'shop-batch-'+item.id}>Quantidade</label>
                <select id={'shop-batch-'+item.id}
                  aria-label={'Quantidade de '+item.name}
                  value={quantity} disabled={!unlocked||busy}
                  onChange={event=>setBatches(current=>({
                    ...current,[item.id]:Number(event.target.value)
                  }))}>
                  {BATCHES.filter(n=>n<=item.maxPerPurchase).map(n=>
                    <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" className={styles.primary}
                  data-testid={'shop-buy-'+item.id} disabled={!canBuy}
                  onClick={()=>onBuy(item.id,quantity)}>
                  Comprar {item.name}
                </button>
              </div>
            </div>
            <div className={styles.shopPriceGroup}>
              <strong>{unit.toLocaleString('pt-BR')} moedas</strong>
              <small>cada · Total: {cost.toLocaleString('pt-BR')}</small>
            </div>
          </article>;
        })}
      </div>
      <p className={styles.shopPolicyNote}>
        As Pokébolas também são encontradas aleatoriamente após vitórias
        regionais. Ultra Ball: em batalhas desde a região 7; nas expedições,
        somente nas regiões 9 e 10. A Master Ball não está à venda.
      </p>
    </section>
  );
}
