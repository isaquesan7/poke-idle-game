import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PREVIEW_REGIONS} from '../src/regions/previewCatalog';
import {RegionsPreview} from '../src/regions/RegionsPreview';

describe('D-064AE — catálogo regional público somente leitura',()=>{
  it('usa dez áreas únicas com níveis crescentes e exemplos válidos',()=>{
    expect(PREVIEW_REGIONS).toHaveLength(10);
    expect(PREVIEW_REGIONS.map(r=>r.id)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(new Set(PREVIEW_REGIONS.map(r=>r.name)).size).toBe(10);
    expect(PREVIEW_REGIONS[0]?.unlockTrainerLevel).toBe(1);
    expect(PREVIEW_REGIONS[9]?.unlockTrainerLevel).toBe(93);
    let previous=0;
    for(const region of PREVIEW_REGIONS){
      expect(region.minLevel).toBeGreaterThan(previous);
      expect(region.maxLevel).toBeGreaterThanOrEqual(region.minLevel);
      expect(region.examples.length).toBeGreaterThan(0);
      expect(region.examples.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=151)).toBe(true);
      previous=region.maxLevel;
    }
  });
  it('renderiza sem Storage, comandos de save ou recompensas',()=>{
    const markup=renderToStaticMarkup(<RegionsPreview/>);
    for(const region of PREVIEW_REGIONS){
      expect(markup).toContain(region.name);
    }
    expect(markup).toContain('Prévia de regiões');
    expect(markup).toContain('Nenhum progresso do jogador');
    expect(markup).toContain('aria-pressed');
    expect(markup).not.toContain('Capturar agora');
    expect(markup).not.toContain('Iniciar batalha');
    expect(markup).not.toContain('Receber recompensa');
  });
});
