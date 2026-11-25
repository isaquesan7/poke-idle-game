import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import styles from './RegionsScreen.module.css';
export function RegionDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const node=ref.current;if(!node)return;
  const prior=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';node.showModal();
  return()=>{node.close();document.body.style.overflow=overflow;prior?.focus({preventScroll:true});};
 },[]);
 return <dialog ref={ref} className={styles.modal} aria-label={title} onCancel={e=>{e.preventDefault();close.current();}} onClick={e=>{if(e.target===e.currentTarget)close.current();}}>
  <div className={styles.modalBody}><header className={styles.modalHeader}><h3>{title}</h3><button type="button" className={styles.modalClose} aria-label="Fechar" onClick={()=>close.current()}><i className="fa-solid fa-xmark" aria-hidden="true"/></button></header>{children}</div>
 </dialog>;
}
