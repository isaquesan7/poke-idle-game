/**
 * D-052 · Cubos reutilizáveis do inventário de interface.
 * Um stack (itemId + quantidade) ocupa UM cubo; não altera o domínio/save.
 * Tooltip é visual; nome, quantidade e descrição ficam acessíveis por teclado.
 */
import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import styles from './InventoryGrid.module.css';

export interface InventorySlotItem {
  readonly id:string;
  readonly name:string;
  readonly description:string;
  readonly icon:string;
  readonly quantity:number;
  readonly detail?:string;
  readonly status?:string;
}
interface Props {
  title:string;
  items:readonly InventorySlotItem[];
  capacity:number;
  onSelect?:(id:string)=>void;
  actionLabel?:(item:InventorySlotItem)=>string;
  emptyLabel?:string;
}
export function InventoryGrid({title,items,capacity,onSelect,actionLabel,emptyLabel='Espaço vazio'}:Props){
  // Nunca ocultar itens caso um save legado já exceda o limite de exibição.
  const [selected,setSelected]=useState<string|null>(null);
  const total=Math.max(capacity,items.length);
  const slots=Array.from({length:total},(_,i)=>items[i]??null);
  return <section className={styles.inventory} aria-label={title}>
    <div className={styles.summary}>
      <span className={styles.counter}><i className="fa-solid fa-border-all" aria-hidden="true"/>
        <strong>{items.length} / {capacity}</strong><span>espaços ocupados</span>
      </span>
      <div className={styles.capacityTrack} role="progressbar"
        aria-label={'Ocupação da '+title} aria-valuemin={0}
        aria-valuemax={capacity} aria-valuenow={Math.min(capacity,items.length)}>
        <span style={{width:Math.min(100,items.length/capacity*100)+'%'}}/>
      </div>
    </div>
    {items.length>capacity&&<p className={styles.overCapacity} role="status">
      Há itens acima da capacidade visual padrão. Nenhum item foi ocultado ou descartado.
    </p>}
    <div className={styles.grid}>
      {slots.map((item,index)=>item
        ? <button key={item.id} type="button" data-testid={'inventory-item-'+item.id}
          onClick={()=>{setSelected(current=>current===item.id?null:item.id);onSelect?.(item.id);}}
          className={selected===item.id?styles.slotSelected:styles.slotFilled}
          aria-label={actionLabel? actionLabel(item):item.name+', quantidade '+item.quantity+', '+item.description}
          title={item.name}>
            <span className={styles.itemIcon}><i className={'fa-solid '+item.icon} aria-hidden="true"/></span>
            {item.quantity>1&&<span className={styles.quantity} aria-hidden="true">×{item.quantity}</span>}
            {item.status&&<span className={styles.statusDot} aria-hidden="true"/>}
            <span className={styles.tooltip} aria-hidden="true">
              <strong>{item.name}</strong><small>Quantidade: {item.quantity}</small>
              <small>{item.description}</small>
              {item.detail&&<em>{item.detail}</em>}
              {item.status&&<small>{item.status}</small>}
            </span>
          </button>
        : <div key={'empty-'+index} className={styles.slotEmpty}
          role="img" aria-label={emptyLabel+' '+(index+1)}>
          <i className="fa-solid fa-plus" aria-hidden="true"/>
        </div>)}
    </div>
  </section>;
}
export function InventoryDialog({title,children,onClose}:{
  title:string;children:ReactNode;onClose:()=>void;
}){
  const closeRef=useRef<HTMLButtonElement>(null);
  const modalRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement;
    closeRef.current?.focus();
    return ()=>{if(previous instanceof HTMLElement)previous.focus();};
  },[]);
  return <div className={styles.backdrop} onMouseDown={event=>{
    if(event.target===event.currentTarget)onClose();
  }}>
    <div role="dialog" aria-modal="true" aria-label={title}
      className={styles.modal} ref={modalRef} onKeyDown={event=>{
        if(event.key==='Tab'){
          const nodes=Array.from(modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
          const first=nodes[0],last=nodes[nodes.length-1];
          if(first&&last){
            if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
            else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
          }
        }
        if(event.key==='Escape'){event.preventDefault();onClose();}
      }}>
      <div className={styles.modalHead}><h3>{title}</h3>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose}
          aria-label="Fechar detalhes do equipamento"><i className="fa-solid fa-xmark" aria-hidden="true"/></button>
      </div>
      {children}
    </div>
  </div>;
}
