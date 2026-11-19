/**
 * Dados de laboratório da v0.1, transcritos de index.html em 2026-11-16.
 * Este catálogo é de COMPATIBILIDADE: não cria novas raridades ou bônus.
 * Nenhum item ou título aqui altera o save do jogador.
 */
import type { StatBonus, StatValues } from '../stats/types.js';
import type { EquipmentSlot } from '../stats/trainer.js';

export interface LegacyItem {
  readonly id: string;
  readonly name: string;
  readonly slot: EquipmentSlot;
  readonly stats: StatBonus;
}

export interface LegacyBadge {
  readonly id: string;
  readonly name: string;
  readonly wins: number;
  readonly stats: StatBonus;
}

export interface LegacyTitle {
  readonly id: string;
  readonly name: string;
  readonly stats: StatBonus;
}

export const LEGACY_ITEMS: readonly LegacyItem[] = [
  { id: 'cap', slot: 'hat', name: 'Boné de Kanto', stats: { hp: 2 } },
  { id: 'visor', slot: 'hat', name: 'Viseira Tática', stats: { speed: 2 } },
  { id: 'coat', slot: 'jacket', name: 'Jaqueta de Viagem', stats: { defense: 3 } },
  { id: 'battle-jacket', slot: 'jacket', name: 'Jaqueta Reforçada', stats: { hp: 2, specialDefense: 1 } },
  { id: 'gloves', slot: 'gloves', name: 'Luvas de Treino', stats: { attack: 3 } },
  { id: 'gloves-tech', slot: 'gloves', name: 'Luvas Táticas', stats: { specialAttack: 3 } },
  { id: 'pants', slot: 'pants', name: 'Calça Resistente', stats: { specialDefense: 3 } },
  { id: 'shoes', slot: 'shoes', name: 'Tênis de Corrida', stats: { speed: 3 } },
  { id: 'necklace', slot: 'necklace', name: 'Colar Brilhante', stats: { specialAttack: 2 } },
  { id: 'ring-a', slot: 'ring1', name: 'Anel da Força', stats: { attack: 2 } },
  { id: 'ring-b', slot: 'ring1', name: 'Anel da Vida', stats: { hp: 2 } },
  { id: 'ring-c', slot: 'ring2', name: 'Anel da Defesa', stats: { defense: 2 } },
  { id: 'ring-d', slot: 'ring2', name: 'Anel da Agilidade', stats: { speed: 2 } },
  { id: 'earrings', slot: 'earrings', name: 'Brincos de Técnica', stats: { specialAttack: 2 } }
];

export const LEGACY_BADGES: readonly LegacyBadge[] = [
  { id: 'boulder', name: 'Rocha', wins: 1, stats: { defense: 1 } },
  { id: 'cascade', name: 'Cascata', wins: 3, stats: { hp: 1 } },
  { id: 'thunder', name: 'Trovão', wins: 5, stats: { speed: 1 } },
  { id: 'rainbow', name: 'Arco-íris', wins: 8, stats: { specialAttack: 1 } },
  { id: 'soul', name: 'Alma', wins: 11, stats: { specialDefense: 1 } },
  { id: 'marsh', name: 'Pântano', wins: 15, stats: { specialAttack: 1 } },
  { id: 'volcano', name: 'Vulcão', wins: 19, stats: { attack: 1 } },
  { id: 'earth', name: 'Terra', wins: 24, stats: { defense: 1 } }
];

export const LEGACY_TITLES: readonly LegacyTitle[] = [
  { id: 'aprendiz', name: 'Aprendiz de Kanto', stats: { hp: 1 } },
  { id: 'veterano', name: 'Veterano da Arena', stats: { attack: 2 } },
  { id: 'explorador', name: 'Explorador de Kanto', stats: { speed: 2 } },
  { id: 'mestre', name: 'Mestre de Ginásios', stats: { attack: 2, specialAttack: 2 } }
];

/** Regras originais de desbloqueio; compartilhadas entre projeção e writer. */
export function legacyTitleIsUnlocked(id:string,wins:number,seenCount:number,badgeCount:number):boolean {
  return id==='aprendiz'
    || id==='veterano' && wins>=4
    || id==='explorador' && seenCount>=10
    || id==='mestre' && badgeCount===8;
}

/** Repete o guard de título que a v0.1 aplica ao renderizar (sem escrever save). */
export function effectiveLegacyTitle(
  selectedId: unknown, wins: number, seenCount: number, badgeCount: number
): LegacyTitle {
  const selected = LEGACY_TITLES.find(x => x.id === selectedId);
  const valid = selected && legacyTitleIsUnlocked(selected.id,wins,seenCount,badgeCount);
  return valid && selected ? selected : LEGACY_TITLES[0]!;
}

export interface LegacySpecies {
  readonly id: number;
  readonly name: string;
  readonly base: Readonly<StatValues>;
}

/** Apenas as três espécies com snapshot estático na v0.1; demais vêm do cache. */
export const LEGACY_STARTERS: Readonly<Record<number, LegacySpecies>> = {
  1: {
    id: 1, name: 'Bulbasaur',
    base: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 }
  },
  4: {
    id: 4, name: 'Charmander',
    base: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 }
  },
  7: {
    id: 7, name: 'Squirtle',
    base: { hp: 44, attack: 48, defense: 65, specialAttack: 50, specialDefense: 64, speed: 43 }
  }
};
