import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {KANTO_REGIONS} from '@kanto/game-core';
import {RegionsScreen} from '../src/regions/RegionsScreen';

const props={
  trainerLevel:21,leaderSpeciesId:1,leaderLevel:20,
  selectedRegionId:4,onSelectRegion:(_id:number)=>{},
  balls:{'poke-ball':12,'great-ball':1,'ultra-ball':0},
  wins:[2,3,0,7,0,0,0,0,0,0],seenIds:[1,60,79],capturedIds:[1,60],
  busy:false,onEnterRegion:(_id:number)=>{},onOpenTeam:()=>{}
};
describe('D-064AI — tela de exploração integrada ao perfil',()=>{
  it('exibe as dez regiões e os 151 Pokémon por catálogo sem duplicação',()=>{
    expect(KANTO_REGIONS).toHaveLength(10);
    expect(new Set(KANTO_REGIONS.flatMap(r=>r.speciesIds)).size).toBe(151);
    const markup=renderToStaticMarkup(<RegionsScreen {...props}/>);
    for(const region of KANTO_REGIONS)expect(markup).toContain(region.name);
    expect(markup).toContain('Entrar na região');
    expect(markup).toContain('7');
    expect(markup).toContain('Poké Ball');
    expect(markup).toContain('Pokébolas disponíveis');
    expect(markup).toContain('<b>12</b>');
    expect(markup).toContain('Desconhecido');
  });
  it('região bloqueada não permite batalha mas permanece consultável',()=>{
    const html=renderToStaticMarkup(<RegionsScreen {...props}
      trainerLevel={21} selectedRegionId={9}/>);
    expect(html).toContain('Entrar na região');
    expect(html).toContain('Desbloqueia no nível 82');
    expect(html).toMatch(/disabled=""/);
  });
  it('permite lutar sem bola quando estoque está vazio',()=>{
    const html=renderToStaticMarkup(<RegionsScreen {...props}
      balls={{'poke-ball':0}} />);
    expect(html).toContain('Após vencer você poderá escolher uma Pokébola');
    expect(html).toContain('Entrar na região');
  });
});
