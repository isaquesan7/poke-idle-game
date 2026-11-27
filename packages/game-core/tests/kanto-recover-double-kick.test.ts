import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_MOVES,KANTO_BATTLE_SPECIES,KANTO_SUPPORT_MOVES,
  KANTO_MULTI_HIT_MOVES,kantoMoveHitCount,kantoLevelMoves,kantoSupportMoves,
  kantoMovePp,kantoMoveSpCost,kantoDamage,simulateKantoBattle,
  reducePokemonMoveSlotsJson
} from '../src/index.js';
import type {Combatant,KantoBattleResult} from '../src/index.js';

/**
 * D-045: primeiro recorte de golpes efetivos novo na v0.2.
 * Fontes: PokéAPI CSV fixado e tabela FRLG de pokemondb.net/moves/3.
 * Cenários de HP/defesa intencionalmente ARTIFICIAIS para stress de mecânica.
 */
const double=KANTO_BATTLE_MOVES['double-kick']!;
const recover=KANTO_SUPPORT_MOVES.recover!;
const tackle=KANTO_BATTLE_MOVES.tackle!;

const player=(overrides:Partial<Combatant>={}):Combatant=>({
  speciesId:32,name:'Nidoran♂',types:['poison'],level:20,
  stats:{hp:250,attack:100,defense:75,specialAttack:45,specialDefense:75,speed:90},
  rank:0,move:double,moves:[double,tackle],...overrides
});
const opponent=(overrides:Partial<Combatant>={}):Combatant=>({
  speciesId:74,name:'Geodude',types:['rock','ground'],level:20,
  stats:{hp:900,attack:25,defense:100,specialAttack:30,specialDefense:110,speed:20},
  rank:0,move:tackle,...overrides
});
function bounds(battle:KantoBattleResult):void{
  expect(battle.frames).toHaveLength(battle.log.length);
  expect(battle.turns).toBeGreaterThanOrEqual(1);
  expect(battle.turns).toBeLessThanOrEqual(30);
  for(const f of battle.frames){
    expect(f.playerHp).toBeGreaterThanOrEqual(0);
    expect(f.wildHp).toBeGreaterThanOrEqual(0);
    expect(f.playerHp).toBeLessThanOrEqual(battle.playerMaxHp);
    expect(f.wildHp).toBeLessThanOrEqual(battle.wildMaxHp);
    expect(f.playerSp).toBeGreaterThanOrEqual(0);
    expect(f.wildSp).toBeGreaterThanOrEqual(0);
    expect(f.playerSp).toBeLessThanOrEqual(battle.playerMaxSp);
    expect(f.wildSp).toBeLessThanOrEqual(battle.wildMaxSp);
  }
  expect(battle.frames.at(-1)?.playerHp).toBe(battle.playerRemainingHp);
  expect(battle.frames.at(-1)?.wildHp).toBe(battle.wildRemainingHp);
  expect(battle.frames.at(-1)?.playerSp).toBe(battle.playerRemainingSp);
  expect(battle.frames.at(-1)?.wildSp).toBe(battle.wildRemainingSp);
}

describe('D-045 — Recover e Double Kick com learnset/PP versionados',()=>{
  it('desbloqueia Double Kick pelo nível certo e respeita a família evolutiva',()=>{
    expect(double).toEqual({name:'double-kick',type:'fighting',category:'physical',
      power:30,accuracy:100,priority:0});
    expect(KANTO_MULTI_HIT_MOVES['double-kick']).toEqual({minHits:2,maxHits:2});
    expect(kantoMoveHitCount('double-kick')).toBe(2);
    expect(kantoMoveHitCount('bullet-seed')).toBe(2);
    expect(KANTO_BATTLE_MOVES['bullet-seed']).toBeUndefined();
    expect(kantoMovePp('double-kick')).toBe(30);
    expect(kantoMoveSpCost(double)).toBe(18);
    for(const id of [29,30,32,33]){
      expect(kantoLevelMoves(id,11).map(x=>x.move.name)).not.toContain('double-kick');
      expect(kantoLevelMoves(id,12).find(x=>x.move.name==='double-kick')?.learnedAt).toBe(12);
    }
    for(const id of [31,34]){
      expect(kantoLevelMoves(id,1).find(x=>x.move.name==='double-kick')?.learnedAt).toBe(1);
    }
    expect(kantoLevelMoves(4,50).map(x=>x.move.name)).not.toContain('double-kick');
  });

  it('desbloqueia Recover apenas no recorte da linha Staryu',()=>{
    expect(recover).toEqual({name:'recover',type:'normal',category:'status',
      power:0,accuracy:100,priority:0});
    expect(kantoMovePp('recover')).toBe(5);
    expect(kantoMoveSpCost(recover)).toBe(36);
    expect(kantoSupportMoves(120,14).map(x=>x.move.name)).not.toContain('recover');
    expect(kantoSupportMoves(120,15).find(x=>x.move.name==='recover')?.learnedAt).toBe(15);
    expect(kantoSupportMoves(121,1).find(x=>x.move.name==='recover')?.learnedAt).toBe(1);
    for(const id of [1,4,7,25,92])expect(kantoSupportMoves(id,100)
      .map(x=>x.move.name)).not.toContain('recover');
  });

  it('writer de slots rejeita level baixo, não inventa TM e mantém UID',()=>{
    const save=(id:number,level:number)=>JSON.stringify({
      version:1,roster:[{uid:9,pokemonId:id,level,moveName:'tackle'}],
      team:[9],badges:[],coins:123
    });
    const add=(id:number,level:number,name:string)=>reducePokemonMoveSlotsJson(
      save(id,level),{uid:9,moveName:name,operation:'add'});
    expect(add(32,11,'double-kick').status).toBe('invalid');
    const ok=add(32,12,'double-kick');
    expect(ok.status).toBe('ok');
    if(ok.status==='ok'){
      const parsed=JSON.parse(ok.json);
      expect(parsed.roster[0].moveNames).toEqual(['tackle','double-kick']);
      expect(parsed.roster[0].uid).toBe(9);
      expect(parsed.coins).toBe(123);
    }
    expect(add(120,14,'recover').status).toBe('invalid');
    expect(add(120,15,'recover').status).toBe('ok');
    expect(add(1,100,'recover').status).toBe('invalid');
    expect(add(1,100,'bullet-seed').status).toBe('invalid');
  });

  it('dois impactos por ação: uma cobrança, dois registros, seed determinística',()=>{
    let firstHits=0,secondHits=0;
    for(let seed=0;seed<64;seed++){
      const battle=simulateKantoBattle(player(),opponent(),seed);
      expect(simulateKantoBattle(player(),opponent(),seed)).toEqual(battle);
      bounds(battle);
      for(let i=0;i<battle.frames.length;i++){
        const f=battle.frames[i]!;
        if(f.moveName!=='double-kick'||f.actor!=='player')continue;
        if(f.hitIndex===1){
          firstHits++;
          expect(f.hitTotal).toBe(2);
          expect(f.spCost).toBe(18);
          expect(f.kind).toBe('attack');
          expect(battle.log[i]).toMatch(/acerto 1\/2.*-18 SP/);
          const prior=battle.frames[i-1]!;
          expect(prior.playerSp!-f.playerSp!).toBe(18);
          if(f.wildHp>0&&f.effectiveness!==0){
            const second=battle.frames[i+1]!;
            expect(second.hitIndex).toBe(2);
            expect(second.hitTotal).toBe(2);
            expect(second.moveName).toBe('double-kick');
            expect(second.spCost).toBe(0);
            expect(second.playerSp).toBe(f.playerSp);
            expect(second.playerHp).toBe(f.playerHp);
            expect(second.wildHp).toBeLessThan(f.wildHp);
            expect(battle.log[i+1]).toMatch(/acerto 2\/2/);
            expect(battle.log[i+1]).not.toContain('SP');
            secondHits++;
          }
        }
      }
    }
    expect(firstHits).toBeGreaterThan(0);
    expect(secondHits).toBeGreaterThan(0);
  });

  it('não cria segundo hit após KO e não atravessa imunidade Ghost',()=>{
    const quick=simulateKantoBattle(player(),opponent({
      stats:{...opponent().stats,hp:1}
    }),41);
    bounds(quick);
    const strikes=quick.frames.filter(f=>f.moveName==='double-kick');
    expect(strikes.length).toBe(1);
    expect(strikes[0]?.hitIndex).toBe(1);
    expect(quick.outcome).toBe('win');

    const ghost=opponent({speciesId:92,types:['ghost','poison']});
    expect(kantoDamage(player(),ghost,.3,.4).effectiveness).toBe(0);
    const result=simulateKantoBattle(player({moves:[double]}),ghost,41);
    bounds(result);
    expect(result.frames.some(f=>f.moveName==='double-kick')).toBe(false);
    expect(result.frames.some(f=>f.moveName==='basic-attack'&&f.actor==='player')).toBe(true);
    expect(()=>simulateKantoBattle(player({move:{...double,power:250},
      moves:[{...double,power:250},tackle]}),opponent(),8)).toThrow();
  });

  it('Recover recupera HP somente próprio, exige SP e não vira loop de cura',()=>{
    const a=player({speciesId:120,name:'Staryu',types:['water'],move:recover,
      moves:[recover,tackle],
      stats:{hp:120,attack:40,defense:70,specialAttack:50,specialDefense:70,speed:75}});
    const b=opponent({speciesId:19,name:'Rattata',types:['normal'],
      stats:{hp:950,attack:180,defense:120,specialAttack:50,specialDefense:90,speed:35}});
    let restores=0;
    for(let seed=0;seed<40;seed++){
      const battle=simulateKantoBattle(a,b,seed);
      bounds(battle);
      expect(simulateKantoBattle(a,b,seed)).toEqual(battle);
      const heals=battle.frames.map((f,i)=>({f,i}))
        .filter(x=>x.f.actor==='player'&&x.f.moveName==='recover');
      expect(heals.length).toBeLessThanOrEqual(1);
      for(const {f,i} of heals){
        restores++;
        expect(f.kind).toBe('heal');
        expect(f.target).toBe('player');
        expect(f.amount).toBeGreaterThan(0);
        expect(f.amount).toBeLessThanOrEqual(Math.floor(a.stats.hp/2));
        expect(f.spCost).toBe(36);
        expect(f.playerHp).toBeLessThanOrEqual(a.stats.hp);
        const prior=battle.frames[i-1]!;
        expect(f.playerHp-prior.playerHp).toBe(f.amount);
        expect(prior.playerSp!-f.playerSp!).toBe(36);
        expect(prior.wildHp).toBe(f.wildHp);
        expect(battle.log[i]).toMatch(/usou recover e recuperou .* HP.*-36 SP/);
      }
    }
    expect(restores).toBeGreaterThan(0);
  });

  it('cura em alvo Ghost não sofre imunidade Normal e custo não vira dano',()=>{
    const a=player({speciesId:120,name:'Staryu',types:['water'],move:recover,
      moves:[recover,tackle],
      stats:{hp:120,attack:40,defense:70,specialAttack:50,specialDefense:70,speed:75}});
    const foe=opponent({speciesId:92,types:['ghost','poison'],
      stats:{hp:1200,attack:180,defense:120,specialAttack:50,specialDefense:90,speed:30}});
    const battle=simulateKantoBattle(a,foe,12);
    bounds(battle);
    expect(battle.frames.some(f=>f.kind==='heal'&&f.moveName==='recover'
      &&f.target==='player')).toBe(true);
    expect(battle.log.some(line=>line.includes('é imune a recover'))).toBe(false);
  });
});
