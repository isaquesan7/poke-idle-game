import { LEGACY_EQUIPMENT_SLOTS, LEGACY_ITEMS, STATS } from '@kanto/game-core';
import type { EquipmentSlot, Stat } from '@kanto/game-core';
import type { LegacySave } from '../../storage/legacySave';
import type { TrainerViewModel } from './legacyProjection';
import { STAT_LABELS } from './legacyProjection';
import styles from './TrainerDraftControls.module.css';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  hat: 'Chapéu', jacket: 'Jaqueta', gloves: 'Luvas',
  pants: 'Calça', shoes: 'Sapatos', necklace: 'Colar',
  ring1: 'Anel 1', ring2: 'Anel 2', earrings: 'Brincos'
};

interface Props {
  readonly value: TrainerViewModel;
  readonly save: LegacySave;
  readonly revision: number;
  readonly onInvest: (stat: Stat) => void;
  readonly onEquip: (slot: EquipmentSlot, itemId: string) => void;
}

/**
 * Editor SOMENTE do rascunho v0.2. Não há botão de publicar ou
 * aplicar mudanças ao save v0.1; progresso real permanece intacto.
 */
export function TrainerDraftControls({ value, save, revision, onInvest, onEquip }: Props) {
  const equipped = save.trainer.equipped;
  const selected = equipped && typeof equipped === 'object' && !Array.isArray(equipped)
    ? equipped as Record<string, unknown> : {};

  return (
    <section className={styles.panel} aria-labelledby="draft-controls-heading">
      <h2 id="draft-controls-heading">Simulação de treinamento v0.2</h2>
      <p className={styles.note}>Rascunho revisão {revision}. Estes botões NÃO modificam seu save v0.1 nem concedem recompensas reais.</p>
      <h3>Distribuir pontos (somente simulação)</h3>
      <p className={styles.note}>{value.unspent} pontos não distribuídos · limite manual: 40 em cada atributo.</p>
      <div className={styles.points}>
        {STATS.map(stat => (
          <div className={styles.point} key={stat}>
            <span>{STAT_LABELS[stat]} · {value.manual[stat]}/40</span>
            <button
              type="button"
              disabled={value.unspent <= 0 || value.manual[stat] >= 40}
              onClick={() => onInvest(stat)}
              aria-label={'Simular +1 ' + STAT_LABELS[stat]}
            >+1</button>
          </div>
        ))}
      </div>
      <h3>Equipamentos (somente simulação)</h3>
      <div className={styles.equipment}>
        {LEGACY_EQUIPMENT_SLOTS.map(slot => {
          const actual = typeof selected[slot] === 'string' ? selected[slot] as string : '';
          const available = LEGACY_ITEMS.filter(item => item.slot === slot);
          const recognized = actual === '' || available.some(item => item.id === actual);
          return (
            <label className={styles.equipmentRow} key={slot}>
              <span>{SLOT_LABELS[slot]}</span>
              <select
                aria-label={'Equipamento: ' + SLOT_LABELS[slot]}
                value={actual}
                onChange={event => onEquip(slot, event.target.value)}
              >
                <option value="">— Vazio —</option>
                {!recognized && <option value={actual}>Item não reconhecido (preservado)</option>}
                {available.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <p className={styles.note}>Para manter os resultados, conserve este rascunho na mesma origem do navegador. A simulação não é transferida para o jogo publicado.</p>
    </section>
  );
}
