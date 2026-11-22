import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import {EXPEDITION_CYCLE_MS,expeditionRegionRates,expeditionProgressFactor} from '@kanto/game-core';
import {expeditionElapsedMs,formatExpeditionDuration} from './expeditionDisplay';
import styles from './ExpeditionScreen.module.css';

interface RegionOption {
  readonly id:number;
  readonly name:string;
  readonly trainerUnlockLevel:number;
  readonly levelMin:number;
  readonly levelMax?:number;
  readonly unlocked:boolean;
}
interface Expedition {
  readonly startedAt:number;
  readonly lastClaimAt:number;
  readonly regionId?:number;
  readonly teamUids?:readonly number[];
}
interface Pending {
  readonly cycles:number;
  readonly coins:number;
  readonly trainerXp:number;
  readonly pokemonXpPerMember:number;
  readonly ballDrops?:Readonly<Record<'poke-ball'|'great-ball'|'ultra-ball',number>>;
}
interface Props {
  readonly expedition:Expedition|null;
  readonly regionName:string;
  readonly options:readonly RegionOption[];
  readonly selectedRegionId:number;
  readonly onSelectRegion:(id:number)=>void;
  readonly leaderName:string;
  readonly leaderLevel:number;
  readonly leaderArt:ReactNode;
  readonly pending:Pending|null;
  readonly activePokemonLevel:number;
  readonly nowMs:number;
  readonly busy:boolean;
  readonly onStart:()=>void;
  readonly onClaim:()=>void;
  readonly onStop:()=>void;
}
const rewards=[
  {key:'cycles',label:'Ciclos completos',icon:'fa-rotate',suffix:''},
  {key:'coins',label:'Moedas',icon:'fa-coins',suffix:'+'},
  {key:'trainerXp',label:'XP treinador',icon:'fa-user-graduate',suffix:'+'},
  {key:'pokemonXpPerMember',label:'XP Pokémon',icon:'fa-bolt',suffix:'+'}
] as const;

export function ExpeditionScreen({
  expedition,regionName,options,selectedRegionId,onSelectRegion,
  leaderName,leaderLevel,leaderArt,pending,activePokemonLevel,nowMs,busy,onStart,onClaim,onStop
}:Props){
  const active=Boolean(expedition);
  // Ao trocar de fase, manter o foco na ação útil; não roubar foco na
  // primeira montagem nem a cada atualização de segundo do cronômetro.
  const previousActive=useRef<boolean|null>(null);
  const titleRef=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(previousActive.current!==null&&previousActive.current!==active)
      titleRef.current?.focus();
    previousActive.current=active;
  },[active]);
  const effectiveRegion=expedition?.regionId??selectedRegionId;
  const rates=expeditionRegionRates(effectiveRegion);
  const levelFactor=expeditionProgressFactor(effectiveRegion,activePokemonLevel);
  const selected=options.find(option=>option.id===selectedRegionId);
  const allowed=Boolean(selected?.unlocked);
  const totalElapsed=expedition?expeditionElapsedMs(expedition.startedAt,nowMs):0;
  const sinceClaim=expedition?expeditionElapsedMs(expedition.lastClaimAt,nowMs):0;
  const cappedMs=Math.min(sinceClaim,8*60*60*1000);
  const remainder=sinceClaim%EXPEDITION_CYCLE_MS;
  const rewardCapReached=active&&sinceClaim>=8*60*60*1000;
  const untilNext=expedition?Math.ceil((EXPEDITION_CYCLE_MS-remainder)/1000):0;
  return <div className={styles.layout}>
    <section className={styles.panel} aria-labelledby="expedition-title" aria-busy={busy}>
      <header className={styles.heading}>
        <span className={styles.eyebrow}><i className="fa-solid fa-compass" aria-hidden="true"/> EXPLORAÇÃO IDLE</span>
        <h2 ref={titleRef} tabIndex={-1} id="expedition-title"><i className="fa-solid fa-map" aria-hidden="true"/> {active?'Expedição em andamento':'Expedição de Kanto'}</h2>
        <p>Explore Kanto para obter moedas, XP e uma pequena quantidade de Pokébolas.
          O ganho cresce com a região, mas diminui quando o Pokémon fica forte demais
          para a área. Até 8 horas de ciclos por resgate.</p>
      </header>
      <div className={styles.destination}>
        <label id="expedition-region-label" htmlFor="expedition-region">
          <i className="fa-solid fa-location-dot" aria-hidden="true"/> Região para expedição
        </label>
        {active
          ?<strong className={styles.activeRegion}>{regionName} <span>· em exploração</span></strong>
          :<select id="expedition-region" className={styles.select} aria-describedby="expedition-region-hint" value={selectedRegionId}
              onChange={event=>onSelectRegion(Number(event.target.value))}>
              {options.map(region=><option key={region.id} value={region.id} disabled={!region.unlocked}>
                {region.name} · Treinador Nv. {region.trainerUnlockLevel} · Pokémon Nv. {region.levelMin}{region.unlocked?'':' (bloqueada)'}
              </option>)}
            </select>}
        {!active&&<small id="expedition-region-hint" className={styles.help}>Regiões indisponíveis ficam desativadas. A expedição não inicia ao mudar a seleção.</small>}
        {!active&&!allowed&&<small role="status" className={styles.warning}>Seu treinador ou Pokémon líder ainda não atende aos requisitos desta região.</small>}
      </div>
      <div className={styles.regionYield} aria-label="Recompensas-base por ciclo nesta região">
        <strong><i className="fa-solid fa-chart-line" aria-hidden="true"/> Por ciclo de 10 segundos</strong>
        <span>{rates.coins} moedas · {rates.trainerXp} XP treinador · {rates.pokemonXp} XP Pokémon</span>
        <small>Faixa ideal: até o nível {(options.find(r=>r.id===effectiveRegion)?.levelMax??10)+2}.
          Com nível superior, o rendimento diminui até zerar. Afinidade somente em batalhas.</small>
        {levelFactor===0&&<small role="status" className={styles.warning}>
          Seu Pokémon está acima do limite de XP desta região.
          Escolha uma região mais avançada para voltar a evoluir.
        </small>}
      </div>
      <div className={styles.partner}>
        <div className={styles.partnerArt}>{leaderArt}</div>
        <div className={styles.partnerInfo}>
          <span><i className="fa-solid fa-crown" aria-hidden="true"/> POKÉMON EXPEDICIONÁRIO</span>
          <strong>{leaderName}</strong>
          <small>Nível {leaderLevel}{active&&expedition?.teamUids?.length?' · UID #'+expedition.teamUids.join(', #'):''}</small>
          <span className={styles.partnerStatus}>{active?'Explorando a região':'Pronto para explorar'}</span>
        </div>
      </div>
      <div className={styles.actions} role="group" aria-label="Ações da expedição">
        {!active
          ?<button type="button" className={styles.primary} disabled={busy||!allowed} aria-disabled={busy||!allowed} onClick={onStart}>
            <i className="fa-solid fa-person-hiking" aria-hidden="true"/> Iniciar expedição
          </button>
          :<>
            <button type="button" className={styles.primary} disabled={busy||!pending?.cycles} aria-disabled={busy||!pending?.cycles} onClick={onClaim}>
              <i className="fa-solid fa-gift" aria-hidden="true"/> Resgatar recompensas
            </button>
            <button type="button" className={styles.secondary} disabled={busy} aria-disabled={busy} onClick={onStop}>
              <i className="fa-solid fa-flag-checkered" aria-hidden="true"/> Encerrar expedição
            </button>
          </>}
      </div>
    </section>
    <section className={styles.panel} aria-labelledby="expedition-rewards-title">
      <header className={styles.heading}>
        <span className={styles.eyebrow}><i className="fa-solid fa-gift" aria-hidden="true"/> PROGRESSO DA EXPEDIÇÃO</span>
        <h2 id="expedition-rewards-title">Recompensas acumuladas</h2>
      </header>
      <div className={styles.timer} role="group" aria-label="Tempo de expedição">
        <div>
          <span><i className="fa-regular fa-clock" aria-hidden="true"/> Tempo total em expedição</span>
          <strong data-testid="expedition-total-time" role="timer" aria-label="Tempo total da expedição" aria-live="off">{formatExpeditionDuration(totalElapsed)}</strong>
          <small>{active?'Desde o início, inclusive após resgates':'O cronômetro inicia ao enviar o Pokémon'}</small>
        </div>
        <i className="fa-solid fa-hourglass-half" aria-hidden="true"/>
      </div>
      <div className={styles.rewardGrid}>
        {rewards.map(reward=><div key={reward.key} className={styles.reward}>
          <div><i className={'fa-solid '+reward.icon} aria-hidden="true"/><small>{reward.label}</small></div>
          <strong>{reward.suffix}{pending?.[reward.key]??0}</strong>
        </div>)}
      </div>
      <div className={styles.expeditionBalls} aria-label="Pokébolas da expedição">
        <strong><i className="fa-solid fa-circle-dot" aria-hidden="true"/> Pokébolas acumuladas</strong>
        <div className={styles.ballPills}>
          <span>Poké Ball <b>+{pending?.ballDrops?.['poke-ball']??0}</b></span>
          {effectiveRegion>=5&&<span>Great Ball <b>+{pending?.ballDrops?.['great-ball']??0}</b></span>}
          {effectiveRegion>=9&&<span>Ultra Ball <b>+{pending?.ballDrops?.['ultra-ball']??0}</b></span>}
        </div>
        <small>Poké Ball: uma por 4h de ciclos elegíveis. Great Ball: uma por 8h
          (áreas 5–10). Ultra Ball: uma por 24h (somente Pico Dracônico e Santuário Lendário).
          O progresso continua entre resgates e só avança quando a região concede recompensas.</small>
      </div>
      <div className={styles.cycleInfo}>
        {active
          ?<>
            {rewardCapReached
              ?<p className={styles.capNotice} role="status"><i className="fa-solid fa-circle-check" aria-hidden="true"/> Limite de 8 horas de recompensas atingido. Resgate para voltar a acumular ciclos.</p>
              :<p><i className="fa-solid fa-rotate" aria-hidden="true"/> Próximo ciclo em <strong data-testid="expedition-next-cycle" aria-live="off">{untilNext}s</strong></p>}
            {!rewardCapReached&&<div className={styles.track} role="progressbar" aria-label="Progresso para o próximo ciclo"
              aria-valuemin={0} aria-valuemax={EXPEDITION_CYCLE_MS}
              aria-valuenow={remainder} aria-valuetext={untilNext+' segundos até o próximo ciclo'}>
              <span style={{width:remainder/EXPEDITION_CYCLE_MS*100+'%'}}/>
            </div>}
            <small>Tempo considerado para recompensas pendentes: {formatExpeditionDuration(cappedMs)} / 08:00:00. O tempo total continua mesmo após alcançar o limite de resgate.</small>
          </>
          :<p><i className="fa-solid fa-circle-info" aria-hidden="true"/> Comece uma expedição para acumular recompensas.</p>}
      </div>
      <p className={styles.disclaimer}><i className="fa-solid fa-shield-halved" aria-hidden="true"/> O relógio usa o horário deste dispositivo. Esta versão alfa não possui proteção contra alterações locais.</p>
    </section>
  </div>;
}
