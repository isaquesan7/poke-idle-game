import {GearArt} from './GearArt';
import {PokeballArt,PokeballSymbol} from './PokeballArt';
import {useState} from 'react';
import {KANTO_BALL_SHOP_CATALOG,KANTO_BALL_SHOP_PRICE_POLICY,KANTO_SHOP_BALL_POCKET_CAP} from '@kanto/game-core';
import type {KantoBallId,KantoShopBallId} from '@kanto/game-core';
import styles from './PlayApp.module.css';
import type {ShopView} from './onlinePlay';
import {RegionDialog} from '../regions/RegionDialog';

interface BallShopPreviewProps {
 readonly coins:number;readonly trainerLevel:number;
 readonly quantities:Readonly<Partial<Record<KantoBallId,number>>>;
 readonly busy:boolean;readonly onBuy:(ballId:KantoShopBallId,quantity:number)=>void;
 readonly onlineShop?:ShopView;
 readonly onCheckout?:(items:readonly {itemId:string;quantity:number}[])=>Promise<boolean>;
}
const BATCHES=[1,5,10,25,50] as const;
const categories=[{id:'balls',name:'Pokébolas',icon:'fa-circle-dot'},{id:'gear',name:'Equipamentos',icon:'fa-shield-halved'},{id:'expanders',name:'Expansores',icon:'fa-bag-shopping'}] as const;
const slotIcons:Record<string,string>={hat:'fa-hat-cowboy',jacket:'fa-shirt',gloves:'fa-hand',pants:'fa-shirt',shoes:'fa-shoe-prints',necklace:'fa-gem',ring1:'fa-ring',ring2:'fa-ring',earrings:'fa-gem'};
type Offer={id:string;name:string;price:number;icon:string;description:string;max:number;category:typeof categories[number]['id']};
export function BallShopPreview({coins,trainerLevel,quantities,busy,onBuy,onlineShop,onCheckout}:BallShopPreviewProps){
 const [category,setCategory]=useState<Offer['category']>('balls');
 const [batches,setBatches]=useState<Record<KantoShopBallId,number>>({'poke-ball':1,'great-ball':1,'ultra-ball':1});
 const [cart,setCart]=useState<Record<string,number>>({});
 const [checking,setChecking]=useState(false);
 const [cartOpen,setCartOpen]=useState(false);
 const offers:Offer[]=[...Object.values(KANTO_BALL_SHOP_CATALOG).map(item=>{
   const remote=onlineShop?.items.find(x=>x.id===item.id);
   const price=remote?.unitPrice??KANTO_BALL_SHOP_PRICE_POLICY.unitPrices[item.id];
   const owned=remote?.owned??quantities[item.id]??0;
   const unlocked=remote?.unlocked??trainerLevel>=item.trainerUnlockLevel;
   return {id:item.id,name:item.name,price,icon:'fa-circle-dot',description:unlocked?'Na mochila: '+owned:'Desbloqueia no nível '+item.trainerUnlockLevel,
    max:remote?.maxAffordable??(unlocked?Math.min(item.maxPerPurchase,KANTO_SHOP_BALL_POCKET_CAP-owned,Math.floor(coins/price)):0),category:'balls' as const};
 }),...(onlineShop?.gearItems??[]).map(item=>({id:item.id,name:item.name,price:item.unitPrice,icon:slotIcons[item.slot]??'fa-shield-halved',description:'Comum · Nv. '+item.requiredLevel+' · Possui '+item.owned,max:item.canBuy?Math.min(10,Math.floor(coins/item.unitPrice)):0,category:'gear' as const}))];
 const lines=Object.entries(cart).flatMap(([id,quantity])=>{const offer=offers.find(o=>o.id===id);return offer?[{offer,quantity}]:[]});
 const total=lines.reduce((sum,{offer,quantity})=>sum+offer.price*quantity,0);
 const locked=busy||checking;
 const valid=lines.length>0&&total<=coins&&lines.every(({offer,quantity})=>quantity<=offer.max);
 const add=(offer:Offer,quantity:number)=>setCart(old=>({...old,[offer.id]:Math.min(offer.max,(old[offer.id]??0)+quantity)}));
 async function checkout(){if(!onCheckout||locked||!valid)return;setChecking(true);try{if(await onCheckout(lines.map(({offer,quantity})=>({itemId:offer.id,quantity}))))setCart({});}finally{setChecking(false);}}
 return <section className={styles.panel+' '+styles.shopPreview} aria-label="Loja Pokémon" data-testid="shop-preview">
  <div className={styles.kicker}>LOJA POKÉMON · PREÇOS BETA</div><h2>Pokébolas e suprimentos</h2>
  <div className={styles.shopSummary}><div><small>Saldo disponível</small><strong data-testid="shop-coins">{coins.toLocaleString('pt-BR')} moedas</strong></div>{onCheckout&&<div className={styles.shopCartSummary}><small>Carrinho de compras</small><button type="button" className={styles.primary} aria-haspopup="dialog" onClick={()=>setCartOpen(true)}><i className="fa-solid fa-cart-shopping" aria-hidden="true"/> Abrir carrinho <span className={styles.cartCount}>{lines.reduce((n,x)=>n+x.quantity,0)}</span></button><strong>{total.toLocaleString('pt-BR')} moedas</strong></div>}</div>
  <div className={styles.shopCategories} role="group" aria-label="Categorias da loja">{categories.map(c=><button type="button" key={c.id} className={category===c.id?styles.primary:styles.secondary} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.id==='balls'?<PokeballSymbol/>:<i className={'fa-solid '+c.icon} aria-hidden="true"/>} {c.name}</button>)}</div>
  <div className={styles.shopItems}>{offers.filter(o=>o.category===category).map(item=>{
   const ball=item.category==='balls'?item.id as KantoShopBallId:null;
   const quantity=ball?batches[ball]:1;
   const canBuy=!locked&&item.max>=(cart[item.id]??0)+quantity&&total+item.price*quantity<=coins;
   return <article key={item.id} className={styles.shopItem} data-testid={'shop-item-'+item.id}><div className={styles.shopIcon}>{ball?<PokeballArt id={ball}/>:item.category==='gear'?<GearArt id={item.id} rarity="common" fallback={item.icon}/>:<i className={'fa-solid '+item.icon} aria-hidden="true"/>}</div><div><h3>{item.name}</h3><small>{item.description}</small></div><div className={styles.shopPriceGroup}><strong>{item.price.toLocaleString('pt-BR')} moedas</strong><small>cada · Total: {(item.price*quantity).toLocaleString('pt-BR')}</small></div>
   <div className={styles.shopPurchaseControls}>{ball&&<><label htmlFor={'shop-batch-'+ball}>Quantidade</label><select id={'shop-batch-'+ball} aria-label={'Quantidade de '+item.name} value={quantity} disabled={locked||item.max===0} onChange={event=>setBatches(old=>({...old,[ball]:Number(event.target.value)}))}>{BATCHES.filter(n=>n<=KANTO_BALL_SHOP_CATALOG[ball].maxPerPurchase).map(n=><option key={n} value={n}>{n}</option>)}</select></>}
   <button type="button" className={styles.primary} data-testid={'shop-buy-'+item.id} disabled={!canBuy} onClick={()=>onCheckout?add(item,quantity):ball&&onBuy(ball,quantity)}>{onCheckout?'Adicionar ao carrinho':'Comprar '+item.name}</button></div></article>;
  })}{category==='expanders'&&<article className={styles.shopItem}><div className={styles.shopIcon}><i className="fa-solid fa-bag-shopping" aria-hidden="true"/></div><h3>Expansor de mochila</h3><p>+{onlineShop?.bagExpander.slots??5} espaços</p><button type="button" className={styles.secondary} disabled>Em preparação</button></article>}</div>
  {onCheckout&&cartOpen&&<RegionDialog title="Carrinho de compras" onClose={()=>{if(!checking)setCartOpen(false);}}><section className={styles.shopCart} aria-label="Itens do carrinho">{!lines.length?<p>Adicione itens para comprar de uma vez.</p>:lines.map(({offer,quantity})=><div key={offer.id} className={styles.shopCartLine}><span>{offer.category==='balls'?<PokeballArt id={offer.id}/>:offer.category==='gear'?<GearArt id={offer.id} rarity="common" fallback={offer.icon}/>:null} {offer.name} × {quantity}</span><strong>{(offer.price*quantity).toLocaleString('pt-BR')} moedas</strong><button type="button" className={styles.secondary} disabled={locked} aria-label={'Remover '+offer.name+' do carrinho'} onClick={()=>setCart(old=>{const next={...old};delete next[offer.id];return next;})}>Remover</button></div>)}<strong>Total: {total.toLocaleString('pt-BR')} moedas</strong><button type="button" className={styles.primary} disabled={locked||!valid} onClick={()=>void checkout()}>{checking?'Confirmando…':'Finalizar compra'}</button><small>Compra única: se faltar saldo, espaço ou nível, nenhum item será comprado.</small><button type="button" className={styles.secondary} disabled={checking} onClick={()=>setCartOpen(false)}>Continuar comprando</button></section></RegionDialog>}
 </section>;
}
