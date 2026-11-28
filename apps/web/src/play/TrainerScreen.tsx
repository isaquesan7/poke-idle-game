import {GearArt} from './GearArt';
import {BadgeArt} from './BadgeArt';
import {PokeballArt} from './PokeballArt';
/**
 * D-050 — Perfil do treinador. UI/pontos provisórios: esta tela não grava no
 * clique em +1; somente o comando explícito de confirmação pode persistir.
 * A paleta vem exclusivamente de styles/tokens.css via CSS Modules.
 */
import {useState} from 'react';
import {
  KANTO_GYMS, LEGACY_EQUIPMENT_SLOTS, LEGACY_ITEMS, inspectInventoryOwnership, BASE_BAG_SLOTS, STATS
} from '@kanto/game-core';
import type {EquipmentSlot, Stat, StatValues} from '@kanto/game-core';
import type {TrainerViewModel} from '../features/trainer/legacyProjection';
import {STAT_LABELS} from '../features/trainer/legacyProjection';
import type {LegacySave} from '../storage/legacySave';
import styles from './TrainerScreen.module.css';
import {InventoryGrid,InventoryDialog} from './InventoryGrid';
import {TitlePicker} from './TitlePicker';
import type {InventorySlotItem} from './InventoryGrid';
import type {InventoryView} from './onlinePlay';

type Section='profile'|'equipment'|'bag';
type Draft=Partial<Record<Stat,number>>;

const SLOT_NAMES:Readonly<Record<EquipmentSlot,string>>={
  hat:'Chapéu',jacket:'Jaqueta',gloves:'Luvas',pants:'Calça',
  shoes:'Sapatos',necklace:'Colar',ring1:'Anel 1',ring2:'Anel 2',
  earrings:'Brincos'
};
const SLOT_ICONS:Readonly<Record<EquipmentSlot,string>>={hat:'fa-hat-cowboy',jacket:'fa-vest',gloves:'fa-mitten',pants:'fa-person',shoes:'fa-shoe-prints',necklace:'fa-gem',ring1:'fa-ring',ring2:'fa-ring',earrings:'fa-gem'};
const STAT_ICONS:Readonly<Record<Stat,string>>={hp:'fa-heart-pulse',attack:'fa-khanda',defense:'fa-shield-halved',specialAttack:'fa-wand-magic-sparkles',specialDefense:'fa-shield-heart',speed:'fa-angles-right'};
function Fa({name}:{name:string}){return <i className={'fa-solid '+name} aria-hidden="true"/>;}
function bonusLabel(stats:Partial<StatValues>):string{
  return STATS.filter(stat=>stats[stat]).map(stat=>STAT_LABELS[stat]+' +'+stats[stat]).join(' · ');
}
export interface TrainerScreenProps{
  view:TrainerViewModel;
  data:LegacySave;
  revision:number;
  busy:boolean;
  onInvest:(increments:Draft,revision:number)=>Promise<boolean>;
  onEquip:(slot:EquipmentSlot,itemId:string)=>void;
  onTitle:(titleId:string)=>void;
  onlineInventory?:InventoryView;
  onDiscardGear?:(id:string)=>void;
  onLoot?:(command:Record<string,unknown>)=>void;
  lootBusy?:boolean;
  controlledSection?:Section;
}
export function TrainerScreen({view,data,revision,busy,onInvest,onEquip,onTitle,onlineInventory,onDiscardGear,onLoot,lootBusy=false,controlledSection}:TrainerScreenProps){
  const [localSection,setSection]=useState<Section>('profile');
  const section=controlledSection??localSection;
  const [selectedEquipment,setSelectedEquipment]=useState<string|null>(null);
  const [equipmentFilter,setEquipmentFilter]=useState<'all'|'equipped'>('all');
  const [draft,setDraft]=useState<Draft>({});
  const [draftRevision,setDraftRevision]=useState(revision);
  const [submitting,setSubmitting]=useState(false);
  const [portraitMissing,setPortraitMissing]=useState(false);
  const pending:Draft=draftRevision===revision?draft:{};
  const pendingCount=STATS.reduce((sum,stat)=>sum+(pending[stat]??0),0);
  const hasStaleDraft=draftRevision!==revision&&STATS.some(stat=>(draft[stat]??0)>0);
  const remaining=Math.max(0,view.unspent-pendingCount);
  const equipped=(data.trainer.equipped??{}) as Record<string,string>;
  const stoneStock=(data.evolutionStones??{}) as Record<string,number>;
  const badgeCount=Array.isArray(data.badges)?data.badges.length:0;
  const seenCount=Array.isArray(data.seen)?data.seen.length:0;
  const totalWins=typeof data.wins==='number'&&Number.isSafeInteger(data.wins)?data.wins:0;
  const equippedIds=new Set(Object.values(equipped).filter(Boolean));
  const ownership=inspectInventoryOwnership(data.inventory);
  const legacyCatalog=ownership.status==='legacy-untracked';
  const bagCapacity=onlineInventory?.bag.capacity??(ownership.status==='valid'?BASE_BAG_SLOTS+ownership.inventory.extraBagSlots:BASE_BAG_SLOTS);
  // O catálogo legado ainda NÃO é inventário de propriedade; os equipamentos
  // seguem selecionáveis no laboratório, sem alegar que foram conquistados.
  const equipmentEntries:InventorySlotItem[]=onlineInventory?onlineInventory.equipment.map(item=>({id:item.id,gearTemplateId:item.templateId,rarity:item.rarity,name:item.name,description:item.rarity+' · Nível exigido: '+item.requiredLevel,requiredLevel:item.requiredLevel,levelLocked:!item.canEquip,icon:SLOT_ICONS[item.slot],quantity:1,detail:bonusLabel(item.effectiveStats??item.stats),status:item.equipped?'Equipado':'Não equipado'})):LEGACY_ITEMS
    .filter(item=>legacyCatalog||ownership.status==='valid'&&(ownership.inventory.ownedEquipment[item.id]??0)>0)
    .map(item=>({
    id:item.id,gearTemplateId:item.id,name:item.name,description:'Equipamento de '+SLOT_NAMES[item.slot]+' do catálogo de testes.',
    icon:SLOT_ICONS[item.slot],quantity:ownership.status==='valid'?ownership.inventory.ownedEquipment[item.id]??1:1,
    detail:bonusLabel(item.stats)||'Sem bônus',
    status:equippedIds.has(item.id)?'Equipado':'Não equipado'
  }));
  const visibleEquipment=equipmentFilter==='equipped'
    ? equipmentEntries.filter(item=>equippedIds.has(item.id)):equipmentEntries;
  const equipmentChoice=selectedEquipment
    ? (onlineInventory?onlineInventory.equipment.find(item=>item.id===selectedEquipment):LEGACY_ITEMS.find(item=>item.id===selectedEquipment)):undefined;
  const equipmentEquipped=equipmentChoice!==undefined&&equipped[equipmentChoice.slot]===equipmentChoice.id;
  const onlineChoice=onlineInventory?.equipment.find(item=>item.id===equipmentChoice?.id);
  const equipmentBlocked=busy||!!onlineInventory&&(onlineInventory.busy||(equipmentEquipped?onlineInventory.bag.available===0:!onlineChoice?.canEquip));
  const equippedInSlot=onlineInventory?.equipment.find(item=>item.id===equipped[equipmentChoice?.slot??'']);
  // Apenas stones no save. Cada stack ocupa um espaço, sem concessão.
  const bagEntries:InventorySlotItem[]=onlineInventory?[...onlineInventory.bag.stacks.map(item=>({id:item.id,name:item.name,quantity:item.quantity,description:item.kind==='ball'?'Pokébola':'Pedra de evolução',icon:item.kind==='ball'?'fa-circle':'fa-gem'})),...equipmentEntries.filter(item=>item.status!=='Equipado')]:Object.entries(stoneStock)
    .filter(([,qty])=>Number.isSafeInteger(qty)&&qty>0)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([name,quantity])=>({
      id:name,name:name.replaceAll('-',' '),quantity,
      icon:'fa-gem',description:'Pedra de evolução. Uso somente pelo sistema de evolução.'
    }));


  function stage(stat:Stat){
    if(busy||submitting||remaining<=0||view.manual[stat]+(pending[stat]??0)>=40)return;
    setDraftRevision(revision);
    setDraft({...pending,[stat]:(pending[stat]??0)+1});
  }
  function unstage(stat:Stat){
    if(busy||submitting||(pending[stat]??0)<1)return;
    const next={...pending};
    if(next[stat]===1)delete next[stat];
    else next[stat]=(next[stat]??0)-1;
    setDraft(next);
  }
  function clear(){
    setDraft({});
    setDraftRevision(revision);
  }
  async function confirm(){
    if(busy||submitting||pendingCount<1||draftRevision!==revision)return;
    setSubmitting(true);
    try{
      if(await onInvest(pending,revision))clear();
    }finally{setSubmitting(false);}
  }
  return <section className={styles.screen} aria-label="Perfil do treinador">
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}>TREINADOR · KANTO</span>
        <h2><Fa name="fa-user-astronaut"/> Seu treinador</h2>
        <p>Equipe-se, distribua atributos e acompanhe suas conquistas.</p>
      </div>
    </div>
    {controlledSection===undefined&&<nav className={styles.tabs} aria-label="Seções do treinador">
      {([
        ['profile','fa-user','Perfil'],['equipment','fa-layer-group','Equipamentos'],['bag','fa-bag-shopping','Mochila']
      ] as const).map(([key,icon,label])=>
        <button type="button" key={key} aria-current={section===key?'page':undefined}
          className={section===key?styles.tabActive:styles.tab}
          onClick={()=>setSection(key)}>
          <Fa name={icon}/>{label}
        </button>
      )}
    </nav>}

    {section==='profile'&&<div className={styles.columns}>
      <div className={styles.column}>
        <section className={styles.panel}>
          <div className={styles.profileTop}>
            <div><span className={styles.eyebrow}>TREINADOR · KANTO</span>
              <h3>{view.name}</h3></div>
            <div className={styles.level}><strong>Nv. {view.level}</strong>
              <small>{view.xpNext===null?'Nível máximo':view.xp+' / '+view.xpNext+' XP'}</small></div>
          </div>
          <div className={styles.xp} role="progressbar" aria-label="Experiência do treinador"
            aria-valuemin={0} aria-valuemax={view.xpNext??1}
            aria-valuenow={view.xpNext===null?1:view.xp}>
            <span style={{width:(view.xpNext===null?100:Math.min(100,view.xp/view.xpNext*100))+'%'}}/>
          </div>
          <div className={styles.portraitArea}><div className={styles.stageGrid} aria-hidden="true"/>
            <div className={styles.portraitHalo} aria-hidden="true"/>
            <div className={styles.ring} aria-hidden="true"/>
            {!portraitMissing
              ? <img className={styles.portrait} src="/assets/trainer-original.png"
                  alt="Personagem original do treinador Kanto"
                  onError={()=>setPortraitMissing(true)}/>
              : <div className={styles.portraitPlaceholder} role="img"
                  aria-label="Arte original do treinador pendente de inclusão no repositório">♙</div>}
            <div className={styles.gearLeft}>
              {LEGACY_EQUIPMENT_SLOTS.slice(0,5).map(slot=>
                <GearCard key={slot} slot={slot} selected={equipped[slot]} onlineItem={onlineInventory?.equipment.find(item=>item.id===equipped[slot])}/>)}
            </div>
            <div className={styles.gearRight}>
              {LEGACY_EQUIPMENT_SLOTS.slice(5).map(slot=>
                <GearCard key={slot} slot={slot} selected={equipped[slot]} onlineItem={onlineInventory?.equipment.find(item=>item.id===equipped[slot])}/>)}
            </div>
          </div>
          <p className={styles.hint}>Passe o mouse, toque ou navegue com Tab para ver os detalhes dos equipamentos. Para trocar, abra Equipamentos.</p>
        </section>
      </div>
      <div className={styles.column}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}><h3><Fa name="fa-chart-simple"/> Atributos do treinador</h3>
            <span className={styles.smallTag}>Prévia antes de confirmar</span></div>
          <div className={styles.stats}>
            {STATS.map(stat=>{
              const next=view.totals[stat]+(pending[stat]??0);
              return <div className={styles.stat} key={stat}>
                <span className={styles.statLabel}><Fa name={STAT_ICONS[stat]}/>{STAT_LABELS[stat]}</span>
                <div className={styles.track} aria-hidden="true">
                  <span className={styles.trackPreview} style={{width:Math.max(3,Math.min(100,next/50*100))+'%'}}/>
                  <span className={styles.trackCurrent} style={{width:Math.max(3,Math.min(100,view.totals[stat]/50*100))+'%'}}/>
                </div>
                <strong>{view.totals[stat]}</strong>
                {pending[stat]?<small className={styles.plus}>→ {next}</small>:<small className={styles.noPlus}> </small>}
                <div className={styles.statActions}>
                  {(pending[stat]??0)>0&&<button type="button" className={styles.undoPoint}
                    disabled={busy||submitting} onClick={()=>unstage(stat)}
                    aria-label={'Retirar um ponto da prévia de '+STAT_LABELS[stat]}>−</button>}
                  <button type="button" disabled={busy||submitting||remaining<1||view.manual[stat]+(pending[stat]??0)>=40}
                    onClick={()=>stage(stat)} aria-label={'Pré-visualizar +1 em '+STAT_LABELS[stat]}>+1</button>
                </div>
              </div>;
            })}
          </div>
          <div className={styles.points}><span>Pontos disponíveis: <strong>{remaining}</strong></span>
            <small>Máximo manual: 40 por atributo</small></div>
          {hasStaleDraft&&<p className={styles.staleNotice} role="alert">Seu progresso mudou em outra ação. Refaça a distribuição para manter os valores corretos.</p>}
          {pendingCount>0&&<div className={styles.confirm}>
            <p role="status">Prévia: <strong>{pendingCount} ponto(s)</strong> ainda não aplicados.</p>
            <div>
              <button type="button" className={styles.cancel} onClick={clear}
                disabled={busy||submitting}>Cancelar</button>
              <button type="button" className={styles.confirmButton} onClick={()=>void confirm()}
                disabled={busy||submitting||draftRevision!==revision}>
                {submitting?'Confirmando…':'Confirmar distribuição'}</button>
            </div>
          </div>}
        </section>
        <section className={styles.panel}>
          <h3><Fa name="fa-medal"/> Títulos e Insígnias</h3>
          <div className={styles.titleActive}>
            <span className={styles.titleGlyph}><Fa name="fa-award"/></span>
            <span><small>TÍTULO ATIVO</small><strong>{view.title.name}</strong></span>
          </div>
          <TitlePicker selectedId={view.title.id} disabled={busy||submitting}
            wins={totalWins} seenCount={seenCount} badgeCount={badgeCount} onSelect={onTitle}/>
          <p className={styles.hint}>As insígnias conquistadas concedem bônus permanentes ao treinador.</p>
          <div className={styles.badgeHeading}>Insígnias ({view.badges.length}/8)</div>
          <div className={styles.badges}>
            {KANTO_GYMS.map(gym=>{
              const badge={id:gym.id,name:gym.name,stats:gym.badgeStats};
              const won=view.badges.some(x=>x.id===badge.id);
              return <div key={badge.id} className={won?styles.badgeWon:styles.badgeLocked}
                tabIndex={0} title={badge.name+' · Líder: '+gym.leader+' · '+bonusLabel(badge.stats)}
                aria-label={badge.name+(won?' conquistada':' bloqueada')+'. '+gym.leader+'. Bônus: '+bonusLabel(badge.stats)}>
                <span className={styles.badgeTooltip} aria-hidden="true"><strong>{badge.name}</strong><small>Bônus: {bonusLabel(badge.stats)}</small><small>{won?'Conquistada':'Derrote '+gym.leader}</small></span>
                <span><BadgeArt id={badge.id} earned={won}/></span>
                <strong>{badge.name}</strong><small>{gym.leader}</small>
              </div>;
            })}
          </div>
        </section>
      </div>
    </div>}

    {section==='equipment'&&<section className={styles.panel}>
      <div className={styles.sectionHeader}><h3><Fa name="fa-layer-group"/> Equipamentos</h3>
        <span className={styles.smallTag}>{equippedIds.size} equipados</span>
      </div>
      <p className={styles.hint}>Clique ou toque em um cubo para conferir atributos e equipar/remover.
        {onlineInventory?' Equipamentos individuais do servidor.':legacyCatalog?' No save atual, o catálogo permanece disponível como laboratório até a migração de propriedade.':' Exibindo somente os equipamentos registrados no inventário versionado.'}</p>
      {!onlineInventory&&ownership.status==='invalid'&&<p className={styles.staleNotice} role="alert">Dados de propriedade inválidos. Equipamentos bloqueados por segurança.</p>}
      <div className={styles.inventoryFilters} role="group" aria-label="Filtrar equipamentos">
        <button type="button" className={equipmentFilter==='all'?styles.filterActive:styles.filter}
          aria-pressed={equipmentFilter==='all'} onClick={()=>setEquipmentFilter('all')}>
          Todos ({equipmentEntries.length})</button>
        <button type="button" className={equipmentFilter==='equipped'?styles.filterActive:styles.filter}
          aria-pressed={equipmentFilter==='equipped'} onClick={()=>setEquipmentFilter('equipped')}>
          Equipados ({equippedIds.size})</button>
      </div>
      <InventoryGrid title="Equipamentos" items={visibleEquipment}
        capacity={Math.max(15,equipmentEntries.length)}
        onSelect={setSelectedEquipment}
        actionLabel={item=>item.name+', '+item.status+(item.requiredLevel!==undefined?', nível exigido '+item.requiredLevel:'')+(item.levelLocked?', bloqueado por nível':'')+'. Abrir detalhes'}
      />
    </section>}

    {section==='bag'&&<section className={styles.panel}>
      <div className={styles.sectionHeader}><h3><Fa name="fa-bag-shopping"/> Mochila</h3>
        <span className={styles.smallTag}>Capacidade: {bagCapacity}</span></div>
      <p className={styles.hint}>Cada tipo de item empilhado ocupa um cubo, independentemente da quantidade.
        Passe o mouse ou use o foco do teclado para ver detalhes. No celular, toque no cubo.</p>
      {onlineInventory&&onLoot&&<>
        {onlineInventory.pending&&<section className={styles.panel}><h3>Recompensas regionais pendentes</h3>{onlineInventory.pending.items.map(item=>{const itemId=item.kind==='gear'?item.gear.id:item.itemId;const name=item.kind==='gear'?(LEGACY_ITEMS.find(m=>m.id===item.gear.templateId)?.name??itemId):itemId;const fields={encounterId:onlineInventory.pending!.encounterId,itemId};return <div key={itemId} className={styles.detailActions}><strong>{item.kind==='ball'?<PokeballArt id={itemId}/>:item.kind==='gear'?<GearArt id={item.gear.templateId} rarity={item.gear.rarity} fallback="fa-shield-halved"/>:null} {name}</strong><button type="button" className={styles.confirmButton} disabled={busy} onClick={()=>onLoot({kind:'loot-store',...fields})}>Guardar</button><button type="button" className={styles.cancel} disabled={busy} onClick={()=>{if(window.confirm('Descartar este drop definitivamente?'))onLoot({kind:'loot-discard',...fields});}}>Descartar</button></div>;})}</section>}
        {onlineInventory.expeditionPending&&<section className={styles.panel}><h3>Recompensas da expedição pendentes</h3>{Object.entries(onlineInventory.expeditionPending.quantities).filter(([,n])=>Number(n)>0).map(([itemId,n])=>{const fields={claimAt:onlineInventory.expeditionPending!.claimAt,itemId};const blocked=lootBusy||!onlineInventory.canResolveExpeditionLoot;return <div key={itemId} className={styles.detailActions}><strong><PokeballArt id={itemId}/> {itemId} × {n}</strong><button type="button" className={styles.confirmButton} disabled={blocked} onClick={()=>onLoot({kind:'expedition-loot-store',...fields})}>Guardar</button><button type="button" className={styles.cancel} disabled={blocked} onClick={()=>{if(window.confirm('Descartar estas Pokébolas definitivamente?'))onLoot({kind:'expedition-loot-discard',...fields});}}>Descartar</button></div>;})}</section>}
      </>}
      <InventoryGrid title="Mochila" items={bagEntries} capacity={bagCapacity} onSelect={id=>{if(onlineInventory?.equipment.some(item=>item.id===id))setSelectedEquipment(id);}} selectable={item=>!!onlineInventory?.equipment.some(gear=>gear.id===item.id)}/>
      <p className={styles.hint}>{onlineInventory?'Capacidade e propriedade confirmadas pelo servidor.':'A expansão da mochila será desbloqueada por um item futuro.'}{!onlineInventory&&<>
        A capacidade é informativa até ser ligada às regras de aquisição e ao writer de itens.
        Pokébolas, cura e TMs aparecerão apenas quando forem adquiridos.</>}</p>
    </section>}
      {equipmentChoice&&<InventoryDialog title={equipmentChoice.name}
        onClose={()=>setSelectedEquipment(null)}>
        <div className={styles.detailItem}>
          <span className={styles.detailIcon}><GearArt id={equipmentEntries.find(item=>item.id===equipmentChoice.id)?.gearTemplateId??equipmentChoice.id} rarity={equipmentEntries.find(item=>item.id===equipmentChoice.id)?.rarity} fallback={SLOT_ICONS[equipmentChoice.slot]}/></span>
          <div><strong>{SLOT_NAMES[equipmentChoice.slot]}</strong>
            <p>{onlineInventory?'Equipamento individual do servidor.':'Equipamento de '+SLOT_NAMES[equipmentChoice.slot]+' do catálogo de testes.'}</p></div>
        </div>
        <div className={styles.detailStats}>
          <strong>Atributos</strong><p>{bonusLabel(onlineChoice?.effectiveStats??equipmentChoice.stats)||'Sem bônus adicional'}</p>
          <strong>Status</strong><p>{equipmentEquipped?'Equipado':'Não equipado'}</p>
          {onlineChoice&&<><div className={styles.gearRequirement} data-locked={!onlineChoice.canEquip}><strong>Nível exigido do treinador: {onlineChoice.requiredLevel}</strong><p>Seu nível: {view.level}</p>{!onlineChoice.canEquip?<p role="status"><i className="fa-solid fa-lock" aria-hidden="true"/> Bloqueado por nível. Faltam {Math.max(0,onlineChoice.requiredLevel-view.level)} níveis para equipar.</p>:<p><i className="fa-solid fa-check" aria-hidden="true"/> Requisito de nível atendido.</p>}</div>{onlineInventory?.busy&&<p role="status">Encerre a batalha ou expedição antes de alterar equipamentos.</p>}{equipmentEquipped&&onlineInventory?.bag.available===0&&<p role="status">Libere um espaço na mochila para remover este item.</p>}{!equipmentEquipped&&equippedInSlot&&<p>Substitui {equippedInSlot.name} no slot {SLOT_NAMES[equipmentChoice.slot]}; o item anterior volta à mochila.</p>}</>}
        </div>
        <div className={styles.detailActions}>
          <button type="button" className={styles.cancel} onClick={()=>setSelectedEquipment(null)}>Cancelar</button>
          {onlineInventory&&!equipmentEquipped&&onDiscardGear&&<button type="button" className={styles.cancel} disabled={busy} onClick={()=>{if(window.confirm('Descartar definitivamente este equipamento?')){onDiscardGear(equipmentChoice.id);setSelectedEquipment(null);}}}>Descartar</button>}
          <button type="button" className={styles.confirmButton} disabled={equipmentBlocked}
            onClick={()=>{
              onEquip(equipmentChoice.slot,equipmentEquipped?'':equipmentChoice.id);
              setSelectedEquipment(null);
            }}>
            <Fa name={equipmentEquipped?'fa-xmark':onlineChoice&&!onlineChoice.canEquip?'fa-lock':'fa-check'}/> {equipmentEquipped?'Remover':onlineChoice&&!onlineChoice.canEquip?'Nível insuficiente':'Equipar'}
          </button>
        </div>
      </InventoryDialog>}
  </section>;
}
function GearCard({slot,selected,onlineItem}:{slot:EquipmentSlot;selected:string|undefined;onlineItem?:InventoryView['equipment'][number]|undefined}){
  const item=onlineItem??LEGACY_ITEMS.find(x=>x.slot===slot&&x.id===selected);
  const effective=onlineItem?.effectiveStats??item?.stats;
  const description=item?item.name+' · '+bonusLabel(effective??item.stats):SLOT_NAMES[slot]+' · Vazio';
  return <button type="button" className={styles.gear} title={description}
    aria-label={description}>
    <span className={styles.gearIcon}>{item?<GearArt id={onlineItem?.templateId??item.id} rarity={onlineItem?.rarity} fallback={SLOT_ICONS[slot]}/>:<Fa name={SLOT_ICONS[slot]}/>}</span>
    <span className={styles.gearName}>{item?.name??SLOT_NAMES[slot]}</span>
    <span className={styles.tooltip} aria-hidden="true">{item?bonusLabel(effective??item.stats):'Sem equipamento'}</span>
  </button>;
}
