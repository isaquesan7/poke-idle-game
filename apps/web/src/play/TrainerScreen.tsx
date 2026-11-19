/**
 * D-050 — Perfil do treinador. UI/pontos provisórios: esta tela não grava no
 * clique em +1; somente o comando explícito de confirmação pode persistir.
 * A paleta vem exclusivamente de styles/tokens.css via CSS Modules.
 */
import {useState} from 'react';
import {
  LEGACY_BADGES, LEGACY_EQUIPMENT_SLOTS, LEGACY_ITEMS, LEGACY_TITLES, legacyTitleIsUnlocked, STATS
} from '@kanto/game-core';
import type {EquipmentSlot, Stat, StatValues} from '@kanto/game-core';
import type {TrainerViewModel} from '../features/trainer/legacyProjection';
import {STAT_LABELS} from '../features/trainer/legacyProjection';
import type {LegacySave} from '../storage/legacySave';
import styles from './TrainerScreen.module.css';

type Section='profile'|'equipment'|'bag';
type Draft=Partial<Record<Stat,number>>;

const SLOT_NAMES:Readonly<Record<EquipmentSlot,string>>={
  hat:'Chapéu',jacket:'Jaqueta',gloves:'Luvas',pants:'Calça',
  shoes:'Sapatos',necklace:'Colar',ring1:'Anel 1',ring2:'Anel 2',
  earrings:'Brincos'
};
const SLOT_ICONS:Readonly<Record<EquipmentSlot,string>>={hat:'fa-hat-cowboy',jacket:'fa-vest',gloves:'fa-mitten',pants:'fa-person',shoes:'fa-shoe-prints',necklace:'fa-gem',ring1:'fa-ring',ring2:'fa-ring',earrings:'fa-gem'};
const BADGE_ICONS:Readonly<Record<string,string>>={boulder:'fa-mountain',cascade:'fa-droplet',thunder:'fa-bolt',rainbow:'fa-rainbow',soul:'fa-heart',marsh:'fa-water',volcano:'fa-fire',earth:'fa-earth-americas'};
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
}
export function TrainerScreen({view,data,revision,busy,onInvest,onEquip,onTitle}:TrainerScreenProps){
  const [section,setSection]=useState<Section>('profile');
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
    <nav className={styles.tabs} aria-label="Seções do treinador">
      {([
        ['profile','fa-user','Perfil'],['equipment','fa-layer-group','Equipamentos'],['bag','fa-bag-shopping','Mochila']
      ] as const).map(([key,icon,label])=>
        <button type="button" key={key} aria-current={section===key?'page':undefined}
          className={section===key?styles.tabActive:styles.tab}
          onClick={()=>setSection(key)}>
          <Fa name={icon}/>{label}
        </button>
      )}
    </nav>

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
                <GearCard key={slot} slot={slot} selected={equipped[slot]}/>)}
            </div>
            <div className={styles.gearRight}>
              {LEGACY_EQUIPMENT_SLOTS.slice(5).map(slot=>
                <GearCard key={slot} slot={slot} selected={equipped[slot]}/>)}
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
          <label className={styles.titleLabel} htmlFor="trainer-active-title">Escolha seu título</label>
          <select id="trainer-active-title" className={styles.titleSelect} aria-label="Título ativo do treinador"
            disabled={busy||submitting} value={view.title.id}
            onChange={event=>onTitle(event.target.value)}>
            {LEGACY_TITLES.map(title=>{
              const unlocked=legacyTitleIsUnlocked(title.id,totalWins,seenCount,badgeCount);
              const requirement=title.id==='veterano'?'4 vitórias':title.id==='explorador'?'10 vistos':
                title.id==='mestre'?'8 insígnias':'Inicial';
              return <option key={title.id} value={title.id} disabled={!unlocked}>
                {title.name}{unlocked?'':' · Bloqueado ('+requirement+')'}
              </option>;
            })}
          </select>
          <p className={styles.titleHint}>Somente títulos desbloqueados podem ser usados. O bônus do título ativo é aplicado automaticamente.</p>
          <p className={styles.hint}>As insígnias conquistadas concedem bônus permanentes ao treinador.</p>
          <div className={styles.badgeHeading}>Insígnias ({view.badges.length}/8)</div>
          <div className={styles.badges}>
            {LEGACY_BADGES.map(badge=>{
              const won=view.badges.some(x=>x.id===badge.id);
              return <div key={badge.id} className={won?styles.badgeWon:styles.badgeLocked}
                tabIndex={0} title={badge.name+' · '+badge.wins+' vitórias · '+bonusLabel(badge.stats)}
                aria-label={badge.name+(won?' conquistada':' bloqueada')+'. '+badge.wins+' vitórias'}>
                <span><Fa name={BADGE_ICONS[badge.id]??'fa-medal'}/></span>
                <strong>{badge.name}</strong><small>{badge.wins} vitória(s)</small>
              </div>;
            })}
          </div>
        </section>
      </div>
    </div>}

    {section==='equipment'&&<section className={styles.panel}>
      <div className={styles.sectionHeader}><h3>Equipamentos do treinador</h3><span className={styles.smallTag}>{LEGACY_EQUIPMENT_SLOTS.filter(slot=>Boolean(equipped[slot])).length}/9 equipados</span></div>
      <p className={styles.hint}>Catálogo de equipamentos da versão de testes.
        O sistema de obtenção e propriedade dos itens ainda está em desenvolvimento.</p>
      <div className={styles.equipmentGrid}>
        {LEGACY_EQUIPMENT_SLOTS.map(slot=><label className={styles.equipField} key={slot}>
          <span><Fa name={SLOT_ICONS[slot]}/></span>
          <strong>{SLOT_NAMES[slot]}</strong>
          <select aria-label={'Equipamento: '+slot} value={equipped[slot]||''}
            disabled={busy} onChange={event=>onEquip(slot,event.target.value)}>
            <option value="">Sem equipamento</option>
            {LEGACY_ITEMS.filter(item=>item.slot===slot).map(item=>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {equipped[slot]&&<small>Equipado</small>}
        </label>)}
      </div>
      <p className={styles.hint}>Bônus podem ser consultados no perfil com mouse, foco ou toque.</p>
    </section>}

    {section==='bag'&&<section className={styles.panel}>
      <div className={styles.sectionHeader}><h3><Fa name="fa-bag-shopping"/> Mochila</h3><span className={styles.smallTag}>Itens do progresso</span></div>
      <p className={styles.hint}>Itens reais do progresso atual. Cura, Pokébolas e TMs
        aparecerão aqui quando seus sistemas de obtenção e consumo estiverem disponíveis.</p>
      <div className={styles.bagList}>
        {Object.entries(stoneStock).filter(([,qty])=>Number.isSafeInteger(qty)&&qty>0)
          .map(([name,qty])=><div className={styles.bagItem} key={name}>
            <span><Fa name="fa-gem"/></span><strong>{name.replaceAll('-',' ')}</strong><small>×{qty}</small>
          </div>)}
        {!Object.values(stoneStock).some(q=>Number.isSafeInteger(q)&&q>0)
          &&<p>Você ainda não possui itens para exibir.</p>}
      </div>
    </section>}
  </section>;
}
function GearCard({slot,selected}:{slot:EquipmentSlot;selected:string|undefined}){
  const item=LEGACY_ITEMS.find(x=>x.slot===slot&&x.id===selected);
  const description=item?item.name+' · '+bonusLabel(item.stats):SLOT_NAMES[slot]+' · Vazio';
  return <button type="button" className={styles.gear} title={description}
    aria-label={description}>
    <span className={styles.gearIcon}><Fa name={SLOT_ICONS[slot]}/></span>
    <span className={styles.gearName}>{item?.name??SLOT_NAMES[slot]}</span>
    <span className={styles.tooltip} aria-hidden="true">{item?bonusLabel(item.stats):'Sem equipamento'}</span>
  </button>;
}
