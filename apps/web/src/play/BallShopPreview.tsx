import {KANTO_BALL_SHOP_CATALOG,KANTO_BALL_SHOP_STATUS} from '@kanto/game-core';
import type {KantoBallId} from '@kanto/game-core';
import styles from './PlayApp.module.css';

interface BallShopPreviewProps {
  readonly coins:number;
  readonly trainerLevel:number;
  readonly quantities:Readonly<Partial<Record<KantoBallId,number>>>;
}
/**
 * D064BP — vitrine de loja sem cobranças enquanto preços não foram aprovados.
 * Nunca cria ações de compra, itens ou transações locais improvisadas.
 */
export function BallShopPreview({coins,trainerLevel,quantities}:BallShopPreviewProps){
  return (
    <section className={styles.panel+' '+styles.shopPreview}
      aria-label="Loja Pokémon em preparação" data-testid="shop-preview">
      <div className={styles.kicker}>LOJA POKÉMON · BASE DE ECONOMIA</div>
      <h2>Pokébolas e suprimentos</h2>
      <p>Consulte os itens e seu estoque. As compras serão habilitadas depois
        que os preços e limites estiverem balanceados para cada região.</p>
      <div className={styles.shopSummary}>
        <div><small>Saldo disponível</small><strong>{coins.toLocaleString('pt-BR')} moedas</strong></div>
        <div><small>Catálogo</small><strong>{KANTO_BALL_SHOP_STATUS==='pricing-pending'
          ?'Preços em avaliação':'Disponível'}</strong></div>
      </div>
      <div className={styles.shopItems}>
        {Object.values(KANTO_BALL_SHOP_CATALOG).map(item=>{
          const unlocked=trainerLevel>=item.trainerUnlockLevel;
          return <article className={styles.shopItem} key={item.id}
            data-testid={'shop-item-'+item.id}>
            <div className={styles.shopIcon} aria-hidden="true">
              <i className={'fa-solid fa-circle '+(
                item.id==='ultra-ball'?'fa-lg':item.id==='great-ball'?'fa-md':'fa-sm'
              )}/>
            </div>
            <div>
              <h3>{item.name}</h3>
              <p>{unlocked?'Liberada pela progressão':'Desbloqueia no nível '+
                item.trainerUnlockLevel+' do treinador'}</p>
              <small>Na mochila: {quantities[item.id]??0}</small>
            </div>
            <strong className={styles.shopPricePending}>Preço a definir</strong>
          </article>;
        })}
      </div>
      <p className={styles.shopPolicyNote} role="status">
        A Master Ball não estará à venda na loja convencional.
        Ultra Ball em batalhas: desde a R7, a cada 15 vitórias válidas.
        Ultra Ball em expedições: apenas nas R9 e R10.
      </p>
    </section>
  );
}
