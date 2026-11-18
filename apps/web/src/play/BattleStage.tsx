import type { ReactNode } from 'react';
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
}
type Side='player'|'wild';

/** Tokens existentes por tipo; sem hardcode de cor por componente. */
const TYPE_COLORS:Readonly<Record<string,string>>={
  fire:styles.battleTypeFire!,water:styles.battleTypeWater!,
  grass:styles.battleTypeGrass!,electric:styles.battleTypeElectric!,
  poison:styles.battleTypePoison!,psychic:styles.battleTypePsychic!
};

/** Mostra o HP exato do registro exibido; não lê nem modifica o save. */
function HealthMeter({side,hp,max}:{
  readonly side:Side;readonly hp:number;readonly max:number
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
        aria-label={side==='player'?'HP do parceiro':'HP do Pokémon selvagem'}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={safeHp}>
        <span className={styles.battleHealthFill} style={{width:percent+'%'}} />
      </div>
    </div>
  );
}

/** SP só aparece quando o combate original salvou ambos os valores exatos. */
function SkillMeter({side,sp,max,focusRecovery}:{
  readonly side:Side;readonly sp:number;readonly max:number;
  readonly focusRecovery:number;
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
        aria-label={side==='player'?'SP do parceiro':'SP do Pokémon selvagem'}
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
function Fighter({side,fighter,frame,maxHp,maxSp,cue,playing}:{
  readonly side:Side;readonly fighter:FighterPanel;
  readonly frame:KantoBattleVisualFrame|null;
  readonly maxHp:number|null;readonly maxSp:number|null;
  readonly cue:string;readonly playing:boolean
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
  const sp=side==='player'?frame?.playerSp:frame?.wildSp;
  return (
    <div className={styles.battleFighter} data-testid={'battle-fighter-'+side}>
      <div className={styles.battleSpriteStage} key={cue+'-'+side}>
        <div className={animateClass}>{fighter.art}</div>
        {(hit||heal)&&<span className={heal?styles.battleFloatHeal:styles.battleFloatDamage}
          data-testid={'battle-impact-'+side} aria-hidden="true">
          {heal?'+':'−'}{frame.amount} HP
        </span>}
        {focus&&<span className={styles.battleFocusBurst}
          data-testid={'battle-focus-'+side} aria-hidden="true">
          <span className={styles.battleFocusSymbol}>✧</span>
          <span>CONCENTRAR</span>
          <strong>+{frame.spRecovery} SP</strong>
        </span>}
        {hit&&typeLabel&&<span data-testid="battle-effectiveness"
          className={styles.battleImpactLabel+' '+typeTone} aria-hidden="true">
          {typeLabel}
        </span>}
      </div>
      <strong>{fighter.name} · Nv. {fighter.level}</strong>
      <small>{side==='player'?'Seu parceiro':'Pokémon selvagem'}</small>
      {frame&&maxHp!==null&&maxHp>0&&(
        <HealthMeter side={side} hp={side==='player'?frame.playerHp:frame.wildHp} max={maxHp} />
      )}
      {typeof sp==='number'&&Number.isSafeInteger(sp)&&maxSp!==null&&maxSp>0
        &&sp>=0&&sp<=maxSp&&(
          <SkillMeter side={side} sp={sp} max={maxSp}
            focusRecovery={focus?(frame.spRecovery??0):0}/>
        )}
    </div>
  );
}

/**
 * Cenário de combate guiado pelo mesmo índice que revela as linhas do diário.
 * Saves anteriores sem trilha são exibidos sem barra/efeitos falsificados.
 */
export function BattleStage({player,wild,frame,playerMaxHp,wildMaxHp,
  playerMaxSp,wildMaxSp,cue,playing}:BattleStageProps) {
  return (
    <div className={styles.battleScene} data-testid="battle-stage">
      <Fighter side="player" fighter={player} frame={frame} maxHp={playerMaxHp}
        maxSp={playerMaxSp} cue={cue} playing={playing}/>
      <span className={styles.vs}>VS</span>
      {wild&&<Fighter side="wild" fighter={wild} frame={frame} maxHp={wildMaxHp}
        maxSp={wildMaxSp} cue={cue} playing={playing}/>}
      {!wild&&<div className={styles.battleFighter}>
        <span className={styles.unknownEnemy}>?</span>
        <strong>Encontro surpresa</strong><small>Pokémon selvagem</small>
      </div>}
      {wild&&!frame&&(
        <p className={styles.battleOldReplayNote}>
          Este combate anterior não possui trilha de HP por evento; o diário continua disponível.
        </p>
      )}
    </div>
  );
}
