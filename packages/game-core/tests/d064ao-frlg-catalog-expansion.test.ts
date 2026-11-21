import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_MOVES,KANTO_BATTLE_SPECIES,KANTO_FRLG_LEVELUP_ROWS,
  KANTO_FRLG_MOVE_META,KANTO_FRLG_EXECUTABLE_EFFECT_IDS,
  KANTO_MOVE_PP,KANTO_SECONDARY_EFFECTS,
  kantoFrlgLevelMoveCatalog,kantoLevelMoves,kantoSupportMoves,
  kantoMoveSpCost,reducePokemonMoveSlotsJson,kantoTmIsTeachEnabled,
  pokemonOwnStats,zeroStats,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

function fighter(id:number,level:number,moves:readonly KantoMove[]):Combatant{
  const species=KANTO_BATTLE_SPECIES[id]!;
  return {speciesId:id,name:species.name,types:species.types,level,
    stats:pokemonOwnStats(species.base,level,zeroStats()),
    move:moves[0]!,moves,rank:0};
}
describe('D064AO — PokéAPI FRLG completa e catálogo executável controlado',()=>{
  it('cobre 151 Pokémon e 273 golpes distintos de level-up, com 1536 linhas',()=>{
    expect(Object.keys(KANTO_FRLG_LEVELUP_ROWS)).toHaveLength(151);
    expect(Object.keys(KANTO_FRLG_MOVE_META)).toHaveLength(273);
    expect(Object.values(KANTO_FRLG_LEVELUP_ROWS)
      .reduce((n,rows)=>n+rows.length,0)).toBe(1536);
    expect(KANTO_FRLG_EXECUTABLE_EFFECT_IDS.size).toBe(8);
    expect(Object.values(KANTO_FRLG_MOVE_META).filter(x=>
      x.category!=='status'&&x.power!==null&&x.power>0
      &&KANTO_FRLG_EXECUTABLE_EFFECT_IDS.has(x.effectId))).toHaveLength(52);
    for(let id=1;id<=151;id++){
      const records=kantoFrlgLevelMoveCatalog(id,100);
      expect(records.length).toBeGreaterThan(0);
      for(const record of records){
        expect(record.learnedAt).toBeGreaterThanOrEqual(1);
        expect(record.learnedAt).toBeLessThanOrEqual(100);
        expect(record.meta).toBe(KANTO_FRLG_MOVE_META[record.moveId]);
        if(record.executable){
          expect(KANTO_BATTLE_MOVES[record.meta.name]).toBeDefined();
          expect(kantoLevelMoves(id,100).some(x=>x.move.name===record.meta.name)).toBe(true);
          expect(KANTO_MOVE_PP[record.meta.name]).toBe(record.meta.pp);
        }
      }
    }
  });
  it('Gengar ganhou Lick, Shadow Punch e Hypnosis, mantendo outros efeitos bloqueados',()=>{
    const lvl24=kantoLevelMoves(94,24).map(x=>x.move.name);
    const lvl25=kantoLevelMoves(94,25).map(x=>x.move.name);
    expect(lvl24).toContain('lick');
    expect(lvl24).not.toContain('shadow-punch');
    expect(lvl25).toContain('shadow-punch');
    expect(kantoSupportMoves(94,25).map(x=>x.move.name)).toContain('hypnosis');
    expect(lvl25).not.toContain('night-shade');
    // O snapshot de ATAQUES continua somente leitura; Hypnosis é suporte jogável.
    expect(kantoFrlgLevelMoveCatalog(94,100).find(x=>x.meta.name==='hypnosis')?.executable).toBe(false);
    expect(kantoFrlgLevelMoveCatalog(94,100).find(x=>x.meta.name==='night-shade')?.executable).toBe(false);
    expect(kantoLevelMoves(94,100).some(x=>x.move.name==='shadow-ball')).toBe(false);
    expect(kantoTmIsTeachEnabled('tm09',94)).toBe(false);
  });
  it('rejeita manipulação de slots sem aprendizado e mantém legado por UID',()=>{
    const src=JSON.stringify({version:1,badges:[],team:[1],
      roster:[{uid:1,pokemonId:94,level:25,moveName:'tackle',moveNames:['tackle']}]});
    const add=reducePokemonMoveSlotsJson(src,{uid:1,moveName:'shadow-punch',operation:'add'});
    expect(add.status).toBe('ok');
    if(add.status!=='ok')return;
    expect(JSON.parse(add.json).roster[0].moveNames).toEqual(['tackle','shadow-punch']);
    expect(reducePokemonMoveSlotsJson(add.json,{uid:1,moveName:'hypnosis',operation:'add'}).status).toBe('invalid');
    expect(reducePokemonMoveSlotsJson(add.json,{uid:1,moveName:'shadow-ball',operation:'add'}).status).toBe('invalid');
    const earlier=JSON.stringify({version:1,badges:[],team:[1],
      roster:[{uid:1,pokemonId:94,level:24,moveName:'tackle',moveNames:['tackle']}]});
    expect(reducePokemonMoveSlotsJson(earlier,{uid:1,moveName:'shadow-punch',operation:'add'}).status)
      .toBe('invalid');
  });
  it('efetividade, custo de SP, secundários, replay e PP funcionam em 52 golpes',()=>{
    const newly=['lick','shadow-punch','flamethrower','thunderbolt',
      'sludge-bomb','giga-drain','aerial-ace','icy-wind','mach-punch'];
    for(const name of newly){
      const move=KANTO_BATTLE_MOVES[name];
      expect(move).toBeDefined();
      expect(KANTO_MOVE_PP[name]).toBeGreaterThan(0);
      expect(kantoMoveSpCost(move!)).toBeGreaterThanOrEqual(8);
      expect(kantoMoveSpCost(move!)).toBeLessThanOrEqual(40);
    }
    expect(KANTO_SECONDARY_EFFECTS.lick).toEqual({
      kind:'status',status:'paralysis',chance:30
    });
    expect(KANTO_SECONDARY_EFFECTS['giga-drain']).toEqual({kind:'drain',percent:50});
    expect(KANTO_SECONDARY_EFFECTS['icy-wind']).toEqual({
      kind:'speed-drop',chance:100,stages:1
    });
    expect(KANTO_SECONDARY_EFFECTS['flamethrower']).toEqual({
      kind:'status',status:'burn',chance:10
    });
    const moves=[KANTO_BATTLE_SPECIES[94]!.move,
      KANTO_BATTLE_MOVES.lick!,KANTO_BATTLE_MOVES['shadow-punch']!];
    const a=fighter(94,82,moves),b=fighter(130,82,[KANTO_BATTLE_SPECIES[130]!.move]);
    for(let seed=0;seed<24;seed++){
      const result=simulateKantoBattle(a,b,seed);
      const repeat=simulateKantoBattle(a,b,seed);
      expect(result).toEqual(repeat);
      expect(result.frames).toHaveLength(result.log.length);
      expect(result.playerRemainingSp).toBeGreaterThanOrEqual(0);
      expect(result.turns).toBeLessThanOrEqual(30);
    }
    expect(kantoSupportMoves(120,15).some(x=>x.move.name==='recover')).toBe(true);
    expect(KANTO_BATTLE_MOVES['bullet-seed']).toBeUndefined();
  });
});
