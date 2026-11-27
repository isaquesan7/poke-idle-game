import test from 'node:test';
import assert from 'node:assert/strict';
import {extractKantoTms} from '../scripts/extract-kanto-tms.mjs';
const m='machine_number,version_group_id,item_id,move_id\n'+Array.from({length:50},(_,i)=>[i+1,7,305+i,100+i].join(',')).join('\n')+'\n101,7,397,15';
const p='pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order\n'+Array.from({length:50},(_,i)=>[1,7,100+i,4,0,''].join(',')).join('\n');
test('extract only FRLG machine permissions for Kanto, excluding HMs and unrelated methods',()=>{
 const result=extractKantoTms(m,p+'\n25,7,100,4,0,\n152,7,100,4,0,\n26,8,100,4,0,\n27,7,100,1,10,\n28,7,15,4,0,');
 assert.equal(result.length,50);assert.deepEqual(result[0].speciesIds,[1,25]);assert.deepEqual(result[49].speciesIds,[1]);
 assert.throws(()=>extractKantoTms(m,p+'\n1,7,100,4,0,'));
 assert.throws(()=>extractKantoTms(m,p+'\n25,7,100,4,1,'));
 assert.throws(()=>extractKantoTms(m,p.split('\n').slice(0,-1).join('\n')));
});
