/** Explicit historical TM-only combat metadata from D048. Type-only
 * dependency avoids a cycle with the shared battle engine. Not a learnset.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
import {KANTO_TM09_PREVIEW} from './kantoTmPreview.js';
const tm=KANTO_TM09_PREVIEW;
export const KANTO_TM09_COMBAT_MOVE:KantoMove=Object.freeze({
 name:tm.moveName,type:tm.type,category:tm.category,power:tm.powerPerHit,
 accuracy:tm.accuracy,priority:tm.priority
});
