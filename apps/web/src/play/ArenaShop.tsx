import {useState} from 'react';
import type {ArenaCommand,ArenaOffer,ArenaShopView} from './onlinePlay';
import {GearArt} from './GearArt';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
import css from './ArenaShop.module.css';
const stats:Record<string,string>={hp:'HP',attack:'Ataque',defense:'Defesa',specialAttack:'Ataque Especial',specialDefense:'Defesa Especial',speed:'Velocidade'};
const rarities:Record<string,string>={common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário'};
const slots:Record<string,string>={hat:'Cabeça',jacket:'Torso',gloves:'Mãos',pants:'Pernas',shoes:'Pés',necklace:'Colar',ring1:'Anel I',ring2:'Anel II',earrings:'Brincos'};
const reasons:Record<string,string>={busy:'Encerre a atividade atual',level:'Nível de treinador insuficiente','weekly-limit':'Limite semanal atingido','bag-full':'Mochila cheia','stack-full':'Limite de unidades atingido','insufficient-points':'Pontos insuficientes'};
type Category='legendary'|'gear'|'tm'|'stone';
const categories:{id:Category;name:string}[]=[{id:'legendary',name:'Lendários exclusivos'},{id:'gear',name:'Outros equipamentos'},{id:'tm',name:'TMs'},{id:'stone',name:'Pedras evolutivas'}];
function Art({offer}:{offer:ArenaOffer}){
 return offer.kind==='gear'?<GearArt id={offer.itemId} rarity={offer.rarity} fallback="fa-shield-halved"/>:<i className={'fa-solid '+(offer.kind==='tm'?'fa-compact-disc':'fa-gem')} aria-hidden="true"/>;
}
export function ArenaShop({view,revision,busy,onAction,onBack,onRefresh}:{view:ArenaShopView;revision:number;busy:boolean;onAction:(c:ArenaCommand,r:number)=>Promise<boolean>;onBack:()=>void;onRefresh:()=>void}){
 const [category,setCategory]=useState<Category>('legendary'),[chosen,setChosen]=useState<string|null>(null),[attributes,setAttributes]=useState<string[]>([]),[notice,setNotice]=useState('');
 const offer=view.offers.find(o=>o.id===chosen);
 const selection=offer?.attributeSelection;
 const filtered=view.offers.filter(o=>category==='legendary'?o.kind==='gear'&&o.rarity==='legendary':category==='gear'?o.kind==='gear'&&o.rarity!=='legendary':o.kind===category);
 const blocked=busy||view.busy;
 function close(){setChosen(null);setAttributes([]);}
 return <div className={css.workspace} data-testid="arena-shop">
  <section className={styles.hero}><div><div className={styles.kicker}>RECOMPENSAS · ARENA SEMANAL</div><h2>Loja da Arena</h2><p>Acumule seus Pontos de Arena ao longo das semanas. Escolha o item que deseja conquistar.</p><strong>Saldo: {view.balance} PA</strong><p>Equipamentos disponíveis nesta semana: {view.gearRemaining}/1</p></div><button type="button" className={styles.secondary} onClick={onBack}>Voltar à Arena</button></section>
  <section className={styles.panel}>
   <div className={css.tabs} aria-label="Categorias da loja">{categories.map(c=><button type="button" key={c.id} aria-pressed={category===c.id} className={category===c.id?styles.primary:styles.secondary} onClick={()=>{setCategory(c.id);setNotice('')}}>{c.name}</button>)}</div>
   {category==='legendary'&&<p>Equipamentos exclusivos de atributos selecionáveis. Escolha quatro atributos distintos, +15 em cada um. Sem sorteio.</p>}
   {view.busy&&<p role="status">Encerre a tentativa ou atividade atual antes de comprar.</p>}
   {notice&&<p role="status">{notice}</p>}
   <button type="button" className={styles.secondary} onClick={onRefresh} disabled={busy}>Atualizar saldo</button>
   <div className={css.grid}>{filtered.map(o=><article key={o.id} className={css.offer} data-legendary={o.kind==='gear'&&o.rarity==='legendary'} data-testid={'arena-offer-'+o.id}>
    <div className={css.art}><Art offer={o}/></div>
    {o.rarity&&<small>{rarities[o.rarity]??o.rarity}</small>}
    <h3>{o.name}</h3>
    {o.gear&&<small>{slots[o.gear.slot]??o.gear.slot} · Nv. {o.gear.requiredLevel}</small>}
    {o.attributeSelection?<strong>4 atributos à sua escolha · +{o.attributeSelection.bonus} cada</strong>:o.gear&&<small>{Object.entries(o.gear.stats).map(([k,v])=>'+'+v+' '+(stats[k]??k)).join(' · ')}</small>}
    <strong>{o.cost} PA</strong><small>Possui: {o.owned} · Restam: {o.remaining}</small>
    {!o.canBuy&&<small>{reasons[o.reason??'']??'Indisponível'}</small>}
    <button type="button" className={styles.primary} disabled={busy} onClick={()=>{setChosen(o.id);setAttributes([]);setNotice('')}}>{o.attributeSelection?'Personalizar':'Ver oferta'}</button>
   </article>)}</div>
  </section>
  {offer&&<RegionDialog title={offer.name} size="compact" onClose={close}>
   <div className={css.modalArt}><Art offer={offer}/></div>
   {selection&&<><p>Equipamento lendário de atributos selecionáveis. Escolha {selection.count} atributos distintos. Cada um recebe +{selection.bonus}.</p>
    <div className={css.attributes}>{selection.options.map(a=><label key={a}><input type="checkbox" checked={attributes.includes(a)} disabled={busy||(!attributes.includes(a)&&attributes.length>=selection.count)} onChange={e=>setAttributes(old=>e.target.checked?[...old,a]:old.filter(x=>x!==a))}/>{stats[a]??a} +{selection.bonus}</label>)}</div>
    <p data-testid="arena-attribute-count">{attributes.length}/{selection.count} selecionados</p>
    <div className={css.preview} data-testid="arena-attribute-preview"><strong>Atributos finais</strong>{attributes.map(a=><span key={a}>+{selection.bonus} {stats[a]??a}</span>)}</div>
   </>}
   {!selection&&offer.gear&&<p>{Object.entries(offer.gear.stats).map(([k,v])=>'+'+v+' '+(stats[k]??k)).join(' · ')}</p>}
   <p>Preço: <strong>{offer.cost} PA</strong> · Saldo: {view.balance} PA</p><p>Saldo após compra: {Math.max(0,view.balance-offer.cost)} PA</p>
   {!offer.canBuy&&<p role="status">{reasons[offer.reason??'']??'Indisponível'}</p>}
   <div className={styles.evolutionConfirmActions}><button type="button" className={styles.secondary} onClick={close}>Cancelar</button><button type="button" className={styles.primary} disabled={blocked||!offer.canBuy||!!selection&&attributes.length!==selection.count} onClick={async()=>{const command:ArenaCommand={type:'purchase',offerId:offer.id,...(selection?{attributes:[...attributes]}:{})};if(await onAction(command,revision)){setNotice(offer.name+' adquirido com sucesso!');close()}}}>Confirmar compra</button></div>
  </RegionDialog>}
 </div>;
}
