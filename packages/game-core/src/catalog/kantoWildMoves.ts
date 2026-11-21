/**
 * D064AV — moveset de Pokémon selvagem, calculado dos MESMOS learnsets
 * permitidos ao treinador (FRLG level-up + suportes já executáveis).
 * Sem TM, sem golpes de níveis futuros, sem rank, sem estatísticas ocultas.
 * Não representa quatro golpes históricos exatos do cartucho: é uma seleção
 * transparente de até 3 ofensivos recentes e 1 suporte recente.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
import {kantoLevelMoves} from './kantoLevelMoves.js';
import {kantoSupportMoves} from './kantoSupportMoves.js';

/**
 * Determinístico e sem RNG próprio; a IA do motor escolhe ações
 * exclusivamente dentre este conjunto. Em espécies com nenhum ataque
 * implementado, mantém o golpe padrão provisório da alfa como fallback
 * para o selvagem não ser incapaz de lutar (mesmo fallback do jogador).
 */
export function kantoWildMoveLoadout(
  speciesId:number,level:number,fallback:KantoMove
):readonly KantoMove[]{
  if(!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151
    ||!Number.isSafeInteger(level)||level<1||level>100)
    throw new RangeError('Espécie/nível selvagem inválidos.');
  const attack=kantoLevelMoves(speciesId,level)
    .filter(item=>item.move.category!=='status')
    .sort((a,b)=>b.learnedAt-a.learnedAt||a.move.name.localeCompare(b.move.name))
    .slice(0,3)
    .map(item=>item.move);
  const support=kantoSupportMoves(speciesId,level)
    .sort((a,b)=>b.learnedAt-a.learnedAt||a.move.name.localeCompare(b.move.name))
    .slice(0,1)
    .map(item=>item.move);
  const moves=[...(attack.length?attack:[fallback]),...support];
  return Object.freeze(moves.slice(0,4));
}
