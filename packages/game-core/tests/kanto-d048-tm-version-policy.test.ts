import {describe,expect,it} from 'vitest';
import {
  KANTO_TM_SOURCE_COMMIT,KANTO_TM_SOURCE_BLOBS,
  KANTO_TM_VERSION_POLICY,KANTO_TM09_PREVIEW,kantoTmPreview,
  kantoTmIsTeachEnabled,kantoTmPreviewMeanHits,kantoTmPreviewHitCount,
  KANTO_MULTI_HIT_MOVES,KANTO_BATTLE_MOVES,
  kantoLevelMoves,kantoSupportMoves,
  kantoPreviewMoveSpCost,reducePokemonMoveSlotsJson
} from '../src/index.js';

describe('D-048 — fontes FRLG explícitas e barreira de TMs ainda não liberadas',()=>{
  it('reconhece TM09/FRLG/move331 pelo snapshot auditado e metadados GenIII',()=>{
    expect(KANTO_TM_SOURCE_COMMIT)
      .toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
    expect(KANTO_TM_SOURCE_BLOBS.machines)
      .toBe('0ccca49159ef5fde36026f0503296ef766d39ee6');
    expect(KANTO_TM_SOURCE_BLOBS.moves)
      .toBe('a55116329ca22f230fea953de94c2d1dffe2ad0e');
    expect(KANTO_TM_VERSION_POLICY).toMatchObject({
      existingMoveStats:'published-modern-snapshot-preserved',
      newMachineStats:'gen3-historical-explicit',
      learnsetVersionGroup:'firered-leafgreen',
      learnsetVersionGroupId:7,
      learnMethod:'machine',learnMethodId:4,
      targetGeneration:3,releasedMachines:0
    });
    const tm=kantoTmPreview('tm09');
    expect(tm).toBe(KANTO_TM09_PREVIEW);
    expect(tm).toMatchObject({
      machineNumber:9,itemId:313,moveId:331,moveName:'bullet-seed',
      versionGroupId:7,category:'special',powerPerHit:10,
      type:'grass',pp:30,accuracy:100,priority:0,
      state:'not-released',speciesCompatibility:'verified-read-only',
      inventoryEconomy:'not-implemented'
    });
    expect(kantoTmPreview('TM09')).toBeNull();
    expect(kantoTmPreview('tm00')).toBeNull();
    expect(Object.isFrozen(KANTO_TM09_PREVIEW)).toBe(true);
    expect(Object.isFrozen(KANTO_TM09_PREVIEW.hitWeights)).toBe(true);
    expect(Object.isFrozen(KANTO_TM09_PREVIEW.hitWeights[0])).toBe(true);
  });

  it('distribuição GenIII usa pesos 3:3:1:1 e exatamente 3,0 de esperança',()=>{
    const expected=[2,3,4,5];
    expect(KANTO_TM09_PREVIEW.hitWeights.map(x=>x.hits)).toEqual(expected);
    expect(KANTO_TM09_PREVIEW.hitWeights.map(x=>x.weight)).toEqual([3,3,1,1]);
    expect(kantoTmPreviewMeanHits('tm09')).toBe(3.0);
    expect(kantoTmPreviewHitCount('tm09',0)).toBe(2);
    expect(kantoTmPreviewHitCount('tm09',3/8-Number.EPSILON)).toBe(2);
    expect(kantoTmPreviewHitCount('tm09',3/8)).toBe(3);
    expect(kantoTmPreviewHitCount('tm09',6/8)).toBe(4);
    expect(kantoTmPreviewHitCount('tm09',7/8)).toBe(5);
    expect(kantoTmPreviewHitCount('tm09',.999999999)).toBe(5);
    const tally=[0,0,0,0,0,0];
    for(let i=0;i<8000;i++)tally[kantoTmPreviewHitCount('tm09',(i+.5)/8000)]!++;
    expect(tally.slice(2)).toEqual([3000,3000,1000,1000]);
    for(const invalid of [-1,1,1.00001,NaN,Infinity,-Infinity])
      expect(()=>kantoTmPreviewHitCount('tm09',invalid)).toThrow(RangeError);
    expect(()=>kantoTmPreviewHitCount('tm00',.5)).toThrow(RangeError);
    expect(()=>kantoTmPreviewMeanHits('tm00')).toThrow(RangeError);
  });

  it('não muda a prévia moderna nem o elenco executável de 31 golpes',()=>{
    expect(kantoPreviewMoveSpCost({
      name:'bullet-seed',pp:30,power:25,priority:0,
      damage_class:{name:'physical'},
      meta:{category:{name:'damage'},min_hits:2,max_hits:5}
    })).toBeGreaterThan(0);
    expect(KANTO_BATTLE_MOVES['bullet-seed']).toBeUndefined();
    expect(KANTO_MULTI_HIT_MOVES['bullet-seed']).toBeUndefined();
    expect(KANTO_BATTLE_MOVES['double-kick']).toMatchObject({
      power:30,category:'physical'
    });
    expect(kantoSupportMoves(120,15).some(x=>x.move.name==='recover')).toBe(true);
    expect(kantoLevelMoves(32,12).some(x=>x.move.name==='double-kick')).toBe(true);
    expect(KANTO_TM_VERSION_POLICY.releasedMachines).toBe(0);
    for(let speciesId=1;speciesId<=151;speciesId++){
      expect(kantoTmIsTeachEnabled('tm09',speciesId)).toBe(false);
    }
    for(const id of ['TM09','tm00','invalid',''])
      expect(kantoTmIsTeachEnabled(id,1)).toBe(false);
    for(const id of [0,-1,1.5,NaN,Infinity,152])
      expect(kantoTmIsTeachEnabled('tm09',id)).toBe(false);
  });

  it('não escreve inventário nem ensina TM09 com writer de golpes',()=>{
    const saved=JSON.stringify({
      version:1,roster:[{uid:10,pokemonId:1,level:100,
        moveName:'tackle',moveNames:['tackle'],affinity:0}],
      team:[10],badges:[],coins:405,
      evolutionStones:{'leaf-stone':2},
      lastBattle:{log:['combate salvo'],frames:[]}
    });
    for(const operation of ['add','replace-primary'] as const){
      const reply=reducePokemonMoveSlotsJson(saved,{
        uid:10,moveName:'bullet-seed',operation
      });
      expect(reply.status).toBe('invalid');
      expect(JSON.parse(saved).roster[0].moveNames).toEqual(['tackle']);
      expect(JSON.parse(saved).coins).toBe(405);
      expect(JSON.parse(saved).evolutionStones['leaf-stone']).toBe(2);
    }
  });
});
