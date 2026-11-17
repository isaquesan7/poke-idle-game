import {describe,expect,it} from 'vitest';
import {
  KANTO_EVOLUTION_RULES,KANTO_EVOLUTION_STONES,KANTO_EVOLUTION_SOURCE_COMMIT,
  kantoEvolutionOptions,kantoSpecies,reduceKantoEvolutionJson
} from '../src/index.js';

const initial=(id=1,level=20)=>({
  version:1,name:'Teste',coins:123,trainer:{level:21},
  roster:[{uid:7,pokemonId:id,level,xp:42,affinity:77,
    manual:{hp:1,attack:2,defense:0,specialAttack:0,specialDefense:0,speed:0},
    moveName:'tackle',upgrades:{tackle:2},custom:'preservado'}],
  team:[7],seen:[id],badges:[],expedition:null,
  evolutionStones:{'moon-stone':1,'water-stone':1},
  lastBattle:{battleId:'original'},caughtSpecies:[id]
});
const run=(game:unknown,action:Parameters<typeof reduceKantoEvolutionJson>[1])=>
  reduceKantoEvolutionJson(JSON.stringify(game),action);

describe('evolução Kanto: fonte e requisitos documentados',()=>{
  it('usa snapshot fixado, targets válidos e não inventa formas fora de Kanto',()=>{
    expect(KANTO_EVOLUTION_SOURCE_COMMIT).toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
    expect(KANTO_EVOLUTION_RULES.length).toBeGreaterThan(65);
    const stoneNames=new Set(KANTO_EVOLUTION_STONES.map(s=>s.id));
    for(const rule of KANTO_EVOLUTION_RULES){
      expect(kantoSpecies(rule.to)?.evolvesFrom).toBe(rule.from);
      if(rule.trigger==='level')expect(rule.minLevel).toBeGreaterThan(0);
      if(rule.trigger==='stone')expect(stoneNames.has(rule.stone)).toBe(true);
    }
    expect(kantoEvolutionOptions(1)[0]).toMatchObject({to:2,trigger:'level',minLevel:16});
    expect(kantoEvolutionOptions(2)[0]).toMatchObject({to:3,minLevel:32});
    expect(kantoEvolutionOptions(25)[0]).toMatchObject({to:26,trigger:'stone',stone:'thunder-stone'});
    expect(kantoEvolutionOptions(133)).toHaveLength(3);
    expect(kantoEvolutionOptions(64)[0]).toMatchObject({to:65,trigger:'trade'});
    expect(kantoEvolutionOptions(151)).toHaveLength(0);
  });

  it('mantém integralmente progresso por UID na evolução nível 16',()=>{
    const game=initial(1,20);
    const result=run(game,{type:'evolve',uid:7,targetSpeciesId:2});
    expect(result.status).toBe('ok');
    if(result.status!=='ok')return;
    const next=JSON.parse(result.json);
    expect(next.roster[0]).toEqual({...game.roster[0],pokemonId:2});
    expect(next.team).toEqual([7]);
    expect(next.caughtSpecies).toEqual([1,2]);
    expect(next.seen).toEqual([1,2]);
    expect(next.coins).toBe(123);
    expect(next.lastBattle).toEqual(game.lastBattle);
    expect(game.roster[0].pokemonId).toBe(1);
    expect(run(game,{type:'evolve',uid:7,targetSpeciesId:3}).status).toBe('invalid');
  });
  it('bloqueia nível insuficiente, troca e destino forjado sem efeitos',()=>{
    const game=initial(1,15);
    for(const [id,to] of [[1,2],[64,65],[1,150]]){
      const source={...game,roster:[{...game.roster[0],pokemonId:id}]};
      const result=run(source,{type:'evolve',uid:7,targetSpeciesId:to});
      expect(result.status).toBe('invalid');
    }
    expect(run({...game,expedition:{startedAt:100}},{type:'evolve',uid:7,targetSpeciesId:2}).status)
      .toBe('invalid');
  });
  it('consome apenas pedra real e respeita ramificações e falta de estoque',()=>{
    const game=initial(133,20);
    const deny=run(game,{type:'evolve',uid:7,targetSpeciesId:135});
    expect(deny.status).toBe('invalid');
    const supplied={...game,evolutionStones:{...game.evolutionStones,'thunder-stone':1}};
    const result=run(supplied,{type:'evolve',uid:7,targetSpeciesId:135});
    expect(result.status).toBe('ok');
    if(result.status!=='ok')return;
    const next=JSON.parse(result.json);
    expect(next.evolutionStones['thunder-stone']).toBe(0);
    expect(next.evolutionStones['water-stone']).toBe(1);
    expect(next.roster[0]).toEqual({...game.roster[0],pokemonId:135});
    expect(run(next,{type:'evolve',uid:7,targetSpeciesId:136}).status).toBe('invalid');
  });
  it('kit alfa é um único resgate, não afeta recompensas de combate',()=>{
    const game=initial(25);
    const result=run(game,{type:'grant-test-kit'});
    expect(result.status).toBe('ok');
    if(result.status!=='ok')return;
    const after=JSON.parse(result.json);
    expect(after.evolutionStones['moon-stone']).toBe(2);
    expect(after.evolutionTestKitClaimed).toBe(true);
    expect(after.coins).toBe(game.coins);
    expect(run(after,{type:'grant-test-kit'}).status).toBe('invalid');
  });
});
