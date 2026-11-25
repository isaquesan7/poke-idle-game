import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, Ref } from 'react';
import type { KantoBattleVisualFrame } from '@kanto/game-core';
import styles from './PlayApp.module.css';

interface FighterPanel {
  readonly name:string;
  readonly level:number;
  readonly art:ReactNode;
}
interface BattleStageProps {
  readonly player:FighterPanel;
  readonly wild:FighterPanel|null;
  readonly frame:KantoBattleVisualFrame|null;
  readonly playerMaxHp:number|null;
  readonly wildMaxHp:number|null;
  readonly playerMaxSp:number|null;
  readonly wildMaxSp:number|null;
  /** Identifica uma nova linha do replay; a animação nunca tem RNG próprio. */
  readonly cue:string;
  readonly playing:boolean;
  /** Foco programático no palco ao iniciar/entrar em um encontro. */
  readonly stageRef?:Ref<HTMLDivElement>;
  /** Efeito visual breve somente depois do writer confirmar o novo nível. */
  readonly levelUp?:boolean;
  /** Rótulo contextual: selvagem na região, adversário oficial no Ginásio. */
  readonly opponentLabel?:string;
  readonly vitals?:{playerHp:number;wildHp:number;playerSp:number;wildSp:number};
}
type Side='player'|'wild';

/** Tokens existentes por tipo; sem hardcode de cor por componente. */
const TYPE_COLORS:Readonly<Record<string,string>>={
  fire:styles.battleTypeFire!,water:styles.battleTypeWater!,
  grass:styles.battleTypeGrass!,electric:styles.battleTypeElectric!,
  poison:styles.battleTypePoison!,psychic:styles.battleTypePsychic!
};

/** Mostra o HP exato do registro exibido; não lê nem modifica o save. */
function HealthMeter({side,hp,max,opponentLabel}:{
  readonly side:Side;readonly hp:number;readonly max:number;readonly opponentLabel:string
}) {
  const safeHp=Math.max(0,Math.min(max,hp));
  const percent=Math.max(0,Math.min(100,safeHp/max*100));
  return (
    <div className={styles.battleHealth} data-testid={'battle-hp-'+side}>
      <div className={styles.battleHealthHeading}>
        <span>HP</span>
        <strong data-testid={'battle-hp-'+side+'-value'}>{safeHp} / {max}</strong>
      </div>
      <div className={styles.battleHealthTrack} role="progressbar"
        aria-label={side==='player'?'HP do parceiro':'HP '+opponentLabel}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={safeHp}>
        <span className={styles.battleHealthFill} style={{width:percent+'%'}} />
      </div>
    </div>
  );
}

/** SP só aparece quando o combate original salvou ambos os valores exatos. */
function SkillMeter({side,sp,max,focusRecovery,opponentLabel}:{
  readonly side:Side;readonly sp:number;readonly max:number;
  readonly focusRecovery:number;readonly opponentLabel:string;
}) {
  const safeSp=Math.max(0,Math.min(max,sp));
  const percent=Math.max(0,Math.min(100,safeSp/max*100));
  return (
    <div className={styles.battleSp+
      (focusRecovery>0?' '+styles.battleSpCharging:'')}
      data-testid={'battle-sp-'+side}>
      <div className={styles.battleHealthHeading}>
        <span>SP</span>
        <strong data-testid={'battle-sp-'+side+'-value'}>{safeSp} / {max}</strong>
      </div>
      <div className={styles.battleSpTrack} role="progressbar"
        aria-label={side==='player'?'SP do parceiro':'SP '+opponentLabel}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={safeSp}>
        <span className={styles.battleSpFill} style={{width:percent+'%'}} />
      </div>
      {focusRecovery>0&&<small className={styles.battleFocusDescription}
        data-testid={'battle-focus-text-'+side}>
        Concentrar · +{focusRecovery} SP · sem atacar
      </small>}
      {safeSp===0&&<small className={styles.battleSpEmpty}>
        Sem SP · ataque básico ou Concentrar
      </small>}
    </div>
  );
}

/** Somente as alterações já reveladas pelo log acionam efeito visual. */
function Fighter({side,fighter,frame,maxHp,maxSp,cue,playing,levelUp,opponentLabel,vitals}:{
  readonly side:Side;readonly fighter:FighterPanel;
  readonly frame:KantoBattleVisualFrame|null;
  readonly maxHp:number|null;readonly maxSp:number|null;
  readonly cue:string;readonly playing:boolean;readonly levelUp:boolean;
  readonly opponentLabel:string;
  readonly vitals?:{playerHp:number;wildHp:number;playerSp:number;wildSp:number}|undefined;
}) {
  const targeted=playing&&frame?.target===side;
  const hit=targeted&&(frame.kind==='attack'||frame.kind==='residual')&&frame.amount>0;
  const heal=targeted&&frame.kind==='heal'&&frame.amount>0;
  const focus=targeted&&frame.kind==='focus'&&Number.isSafeInteger(frame.spRecovery)
    &&(frame.spRecovery??0)>0;
  const status=targeted&&frame.kind==='status';
  const critical=hit&&frame.critical===true;
  const typeTone=hit?(TYPE_COLORS[frame.moveType??'']??styles.battleTypeDefault):'';
  const animateClass=hit
    ?critical?styles.battleSpriteCritical:styles.battleSpriteHit
    :focus?styles.battleSpriteFocus
      :heal?styles.battleSpriteHeal:status?styles.battleSpriteStatus:styles.battleSpriteIdle;
  const effective=hit?(frame.effectiveness??1):1;
  const typeLabel=critical?'CRÍTICO!'
    :effective>=2?'SUPER EFETIVO!'
      :effective===0?'IMUNE'
        :effective<1?'RESISTIDO':'';
  // Somente o HP do frame já exibido determina o desmaio.
  // Sem frame válido não inventar KO para saves antigos.
  const hp=side==='player'?(frame?.playerHp??vitals?.playerHp):(frame?.wildHp??vitals?.wildHp);
  const knockedOut=hp===0;
  const sp=side==='player'?(frame?.playerSp??vitals?.playerSp):(frame?.wildSp??vitals?.wildSp);
  const animatedSprite=useRef<HTMLDivElement|null>(null);

  useLayoutEffect(()=>{
    // D-041: reinicia só a animação CSS do impacto. Remontar o palco
    // reiniciava também o GIF do Pokémon a cada linha do diário (900 ms).
    // O elemento <img> permanece o MESMO ao avançar e reassistir.
    if(!playing||(!hit&&!heal&&!status&&!focus))return;
    for(const animation of animatedSprite.current?.getAnimations({subtree:false})??[]){
      animation.cancel();
      animation.play();
    }
  },[cue,playing,hit,heal,status,focus,knockedOut]);

  return (
    <div className={styles.battleFighter} data-testid={'battle-fighter-'+side}>
      <div className={styles.battleSpriteStage}>
        <div className={knockedOut?styles.battleSpriteFainted+(hit?' '+styles.battleSpriteKoImpact:''):animateClass} ref={animatedSprite}
          data-testid={'battle-visual-'+side} data-fainted={knockedOut?'true':'false'}>{fighter.art}</div>
        {side==='player'&&levelUp&&<span
          className={styles.battleLevelUpBurst} role="status" aria-live="polite"
          data-testid="battle-level-up">LEVEL UP!</span>}
        {knockedOut&&<span className={styles.battleFaintedLabel} role="status"
          data-testid={'battle-fainted-'+side}>Nocauteado</span>}
        {(hit||heal)&&<span key={cue+'-impact-'+side}
          className={heal?styles.battleFloatHeal:styles.battleFloatDamage}
          data-testid={'battle-impact-'+side} aria-hidden="true">
          {heal?'+':'−'}{frame.amount} HP
        </span>}
        {focus&&<span key={cue+'-focus-'+side} className={styles.battleFocusBurst}
          data-testid={'battle-focus-'+side} aria-hidden="true">
          <span className={styles.battleFocusSymbol}>✧</span>
          <span>CONCENTRAR</span>
          <strong>+{frame.spRecovery} SP</strong>
        </span>}
        {hit&&typeLabel&&<span key={cue+'-type-'+side} data-testid="battle-effectiveness"
          className={styles.battleImpactLabel+' '+typeTone} aria-hidden="true">
          {typeLabel}
        </span>}
      </div>
      <strong>{fighter.name} · Nv. {fighter.level}</strong>
      <small>{side==='player'?'Seu parceiro':opponentLabel}</small>
      {hp!==undefined&&maxHp!==null&&maxHp>0&&(
        <HealthMeter side={side} hp={hp} max={maxHp} opponentLabel={opponentLabel} />
      )}
      {typeof sp==='number'&&Number.isSafeInteger(sp)&&maxSp!==null&&maxSp>0
        &&sp>=0&&sp<=maxSp&&(
          <SkillMeter side={side} sp={sp} max={maxSp}
            focusRecovery={focus?(frame.spRecovery??0):0} opponentLabel={opponentLabel}/>
        )}
    </div>
  );
}

/**
 * Cenário de combate guiado pelo mesmo índice que revela as linhas do diário.
 * Saves anteriores sem trilha são exibidos sem barra/efeitos falsificados.
 */
export function BattleStage({player,wild,frame,playerMaxHp,wildMaxHp,
  playerMaxSp,wildMaxSp,cue,playing,stageRef,levelUp=false,
  opponentLabel='Pokémon selvagem',vitals}:BattleStageProps) {
  return (
    <div className={styles.battleScene} data-testid="battle-stage"
      ref={stageRef} tabIndex={-1} role="region" aria-label="Área do combate">
      <Fighter side="player" fighter={player} frame={frame} maxHp={playerMaxHp}
        maxSp={playerMaxSp} cue={cue} playing={playing} levelUp={levelUp} opponentLabel={opponentLabel} vitals={vitals}/>
      <span className={styles.vs}>VS</span>
      {wild&&<Fighter side="wild" fighter={wild} frame={frame} maxHp={wildMaxHp}
        maxSp={wildMaxSp} cue={cue} playing={playing} levelUp={false} opponentLabel={opponentLabel} vitals={vitals}/>}
      {!wild&&<div className={styles.battleFighter}>
        <span className={styles.unknownEnemy}>?</span>
        <strong>Encontro surpresa</strong><small>Pokémon selvagem</small>
      </div>}
      {wild&&!frame&&!vitals&&(
        <p className={styles.battleOldReplayNote}>
          Este combate anterior não possui trilha de HP por evento; o diário continua disponível.
        </p>
      )}
    </div>
  );
}
