/** Arena-exclusive legendary identities. Never include these templates in
 * LEGACY_ITEMS: ordinary drops and the coin shop use that separate catalog.
 * Art IDs are stable; final images supplied by the owner; use matching gear-*.webp.
 */
import type {EquipmentSlot} from '../stats/trainer.js';
export const ARENA_LEGENDARY_TEMPLATES:readonly {id:string;name:string;slot:EquipmentSlot}[]=[
 {id:'arena-hat',name:'Óculos da Arena',slot:'hat'},
 {id:'arena-jacket',name:'Jaqueta da Arena',slot:'jacket'},
 {id:'arena-gloves',name:'Luvas da Arena',slot:'gloves'},
 {id:'arena-pants',name:'Calça da Arena',slot:'pants'},
 {id:'arena-shoes',name:'Tênis da Arena',slot:'shoes'},
 {id:'arena-necklace',name:'Colar da Arena',slot:'necklace'},
 {id:'arena-ring1',name:'Anel do Desafiante da Arena',slot:'ring1'},
 {id:'arena-ring2',name:'Anel do Campeão da Arena',slot:'ring2'},
 {id:'arena-earrings',name:'Brincos da Arena',slot:'earrings'}
];
export function arenaLegendaryTemplate(id:unknown){return ARENA_LEGENDARY_TEMPLATES.find(t=>t.id===id)??null;}
