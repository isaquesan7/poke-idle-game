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
  /** Identifica uma nova linha do replay; a animação nunca tem RNG próprio. */
  readonly cue:string;
  readonly playing:boolean;
}
type Side='player'|'wild';

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

/** Somente as alterações já reveladas pelo log acionam efeito visual. */
function Fighter({side,fighter,frame,maxHp,cue,playing}:{
  readonly side:Side;readonly fighter:FighterPanel;
  readonly frame:KantoBattleVisualFrame|null;
  readonly maxHp:number|null;readonly cue:string;readonly playing:boolean
}) {
  const targeted=playing&&frame?.target===side;
  const hit=targeted&&(frame.kind==='attack'||frame.kind==='residual')&&frame.amount>0;
  const heal=targeted&&frame.kind==='heal'&&frame.amount>0;
  const status=targeted&&frame.kind==='status';
  const animateClass=hit?styles.battleSpriteHit:
    heal?styles.battleSpriteHeal:status?styles.battleSpriteStatus:styles.battleSpriteIdle;
  return (
    <div className={styles.battleFighter} data-testid={'battle-fighter-'+side}>
      <div className={styles.battleSpriteStage} key={cue+'-'+side}>
        <div className={animateClass}>{fighter.art}</div>
        {(hit||heal)&&<span className={heal?styles.battleFloatHeal:styles.battleFloatDamage}
          data-testid={'battle-impact-'+side} aria-hidden="true">
          {heal?'+':'−'}{frame.amount} HP
        </span>}
      </div>
      <strong>{fighter.name} · Nv. {fighter.level}</strong>
      <small>{side==='player'?'Seu parceiro':'Pokémon selvagem'}</small>
      {frame&&maxHp!==null&&maxHp>0&&(
        <HealthMeter side={side} hp={side==='player'?frame.playerHp:frame.wildHp} max={maxHp} />
      )}
    </div>
  );
}

/**
 * Cenário de combate guiado pelo mesmo índice que revela as linhas do diário.
 * Saves anteriores sem trilha são exibidos sem barra/efeitos falsificados.
 */
export function BattleStage({player,wild,frame,playerMaxHp,wildMaxHp,cue,playing}:BattleStageProps) {
  return (
    <div className={styles.battleScene} data-testid="battle-stage">
      <Fighter side="player" fighter={player} frame={frame} maxHp={playerMaxHp}
        cue={cue} playing={playing}/>
      <span className={styles.vs}>VS</span>
      {wild&&<Fighter side="wild" fighter={wild} frame={frame} maxHp={wildMaxHp}
        cue={cue} playing={playing}/>}
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
