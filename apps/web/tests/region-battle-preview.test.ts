import {describe,expect,it} from 'vitest';
import {previewRegionDemo} from '../src/regions/previewBattle';

describe('D-064AF — combate regional demonstrativo sem progresso',()=>{
  it('executa o motor Kanto deterministicamente para regiões diferentes',()=>{
    for(const regionId of [1,2,4,7,9,10]){
      const request={regionId,leaderSpeciesId:4,leaderLevel:65,seed:20261120};
      const result=previewRegionDemo(request);
      expect(result).not.toBeNull();
      expect(result).toEqual(previewRegionDemo(request));
      if(!result)return;
      expect(result.regionId).toBe(regionId);
      expect(result.wildSpeciesId).toBeGreaterThanOrEqual(1);
      expect(result.wildSpeciesId).toBeLessThanOrEqual(151);
      expect(result.turns).toBeGreaterThanOrEqual(1);
      expect(result.turns).toBeLessThanOrEqual(30);
      expect(result.log.length).toBeGreaterThanOrEqual(2);
      expect(result.playerRemainingHp).toBeLessThanOrEqual(result.playerMaxHp);
      expect(result.wildRemainingHp).toBeLessThanOrEqual(result.wildMaxHp);
      expect(result.log.some(line=>line.startsWith('Captura! '))).toBe(false);
      expect(result.log.some(line=>line.includes('Recompensas de combate recebidas'))).toBe(false);
    }
  });
  it('não reivindica prêmio nem captura na demonstração com vitória',()=>{
    let found=false;
    for(let seed=0;seed<128;seed++){
      const value=previewRegionDemo({
        regionId:1,leaderSpeciesId:4,leaderLevel:75,seed
      });
      if(value?.outcome!=='win')continue;
      found=true;
      expect(value.log).toContain('Vitória na demonstração! Nenhum recurso foi concedido.');
      expect(value.log.find(x=>x.includes('entrou na coleção'))).toBeUndefined();
      break;
    }
    expect(found).toBe(true);
  });
  it('rejeita inputs inválidos, sem exceptions e sem storage',()=>{
    const req={regionId:1,leaderSpeciesId:1,leaderLevel:5,seed:0};
    for(const test of [
      {...req,regionId:0},{...req,regionId:11},
      {...req,leaderSpeciesId:152},{...req,leaderLevel:0},
      {...req,leaderLevel:101},{...req,seed:-1},
      {...req,seed:2**32},{...req,seed:Number.NaN}
    ])expect(previewRegionDemo(test)).toBeNull();
  });
});
