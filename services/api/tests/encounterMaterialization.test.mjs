import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FIRST_REGION_SPECIES} from '../src/encounterMaterialization.mjs';

test('region 1 species and levels exactly match the game-core regional catalog',async()=>{
 const code=await readFile(new URL('../../../packages/game-core/src/map/kantoRegions.ts',import.meta.url),'utf8');
 const region=/\{id:1,name:'Bosque Inicial',levelMin:(\d+),levelMax:(\d+),trainerUnlockLevel:(\d+),\s*speciesIds:\[([^\]]+)\],\s*rareSpeciesIds:\[([^\]]*)\],commonWeight:(\d+),rareWeight:(\d+)\}/.exec(code);
 assert.ok(region,'R1 catalog shape changed: review and sync server encounter rules');
 const species=region[4].split(',').map(Number);
 assert.deepEqual(FIRST_REGION_SPECIES,species);
 assert.equal(Number(region[1]),2);
 assert.equal(Number(region[2]),10);
 assert.equal(Number(region[3]),1);
 assert.equal(region[5].trim(),'');
 assert.equal(Number(region[6]),1);
 assert.equal(Number(region[7]),1);
 assert.equal(new Set(FIRST_REGION_SPECIES).size,FIRST_REGION_SPECIES.length);
});
