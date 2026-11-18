import {describe,expect,it} from 'vitest';
import {
  KANTO_STATUS_SOURCE_COMMIT,KANTO_SECONDARY_EFFECTS,KANTO_BATTLE_MOVES,
  kantoMoveSecondaryEffect,simulateKantoBattle,kantoDamage
} from '../src/index.js';
import type {Combatant,KantoMove} from '../src/index.js';

const stats={hp:700,attack:45,defense:220,specialAttack:45,specialDefense:220,speed:90};
const ember=KANTO_BATTLE_MOVES.ember!;
const tackle=KANTO_BATTLE_MOVES.tackle!;
function mon(name:string,types:readonly string[],move:KantoMove,
  extra:Partial<Combatant>={}):Combatant {
  return{speciesId:name==='Alvo'?7:4,name,types,level:20,stats,move,rank:0,...extra};
}
function duel(move:KantoMove,targetTypes:readonly string[]=['normal'],seed=23) {
  const player=mon('Atacante',[move.type],move);
  const wild=mon('Alvo',targetTypes,tackle,{stats:{...stats,speed:20}});
  return simulateKantoBattle(player,wild,seed);
}
function saw(move:KantoMove,message:RegExp,types:readonly string[]=['normal']) {
  for(let seed=0;seed<200;seed++) {
    // Seeds espaçadas evitam a correlação dos primeiros rolls de seeds
    // LCG sequenciais na nova cadência limitada por SP.
    const result=duel(move,types,Math.imul(seed+1,2654435761)>>>0);
    if(result.log.some(line=>message.test(line)))return result;
  }
  return null;
}
describe('condições temporárias e efeitos secundários da alfa',()=>{
  it('chances dos cinco golpes refletem dados versionados PokéAPI',()=>{
    expect(KANTO_STATUS_SOURCE_COMMIT)
      .toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
    expect(KANTO_SECONDARY_EFFECTS.ember)
      .toEqual({kind:'status',status:'burn',chance:10});
    expect(KANTO_SECONDARY_EFFECTS['thunder-shock'])
      .toEqual({kind:'status',status:'paralysis',chance:10});
    expect(KANTO_SECONDARY_EFFECTS['poison-sting'])
      .toEqual({kind:'status',status:'poison',chance:30});
    expect(KANTO_SECONDARY_EFFECTS.absorb).toEqual({kind:'drain',percent:50});
    expect(KANTO_SECONDARY_EFFECTS.bubble)
      .toEqual({kind:'speed-drop',chance:10,stages:1});
    expect(kantoMoveSecondaryEffect('tackle')).toBeNull();
  });
  it('queimadura causa dano por turno e divide ataque físico',()=>{
    const result=saw(ember,/ficou queimado/);
    expect(result).not.toBeNull();
    expect(result?.wildStatus).toBe('burn');
    expect(result?.log.some(line=>line.includes('dano por queimadura'))).toBe(true);
    const attacker=mon('Atacante',['normal'],tackle);
    const defender=mon('Alvo',['normal'],tackle);
    expect(kantoDamage(attacker,defender,.8,.8,.5).damage)
      .toBeLessThan(kantoDamage(attacker,defender,.8,.8).damage);
    for(let seed=0;seed<25;seed++)
      expect(duel(ember,['fire'],seed).wildStatus).toBeNull();
  });
  it('envenenamento causa tick, Poison/Steel imunes, status não vaza',()=>{
    const sting=KANTO_BATTLE_MOVES['poison-sting']!;
    const result=saw(sting,/ficou envenenado/);
    expect(result?.wildStatus).toBe('poison');
    expect(result?.log.some(line=>line.includes('dano por envenenamento'))).toBe(true);
    for(const type of ['poison','steel'])
      for(let seed=0;seed<20;seed++)
        expect(duel(sting,[type],seed).wildStatus).toBeNull();
    expect(duel(tackle,['normal'],777).playerStatus).toBeNull();
    expect(duel(tackle,['normal'],777).wildStatus).toBeNull();
  });
  it('paralisia reduz velocidade e pode impedir ação; Ground imune',()=>{
    const move=KANTO_BATTLE_MOVES['thunder-shock']!;
    const result=saw(move,/ficou paralisado/);
    expect(result?.wildStatus).toBe('paralysis');
    expect(result?.log.some(line=>line.includes('não conseguiu agir'))).toBe(true);
    for(let seed=0;seed<25;seed++)
      expect(duel(move,['ground'],seed).wildStatus).toBeNull();
  });
  it('Absorb recupera apenas HP perdido; Bubble diminui Speed',()=>{
    const result=saw(KANTO_BATTLE_MOVES.absorb!,/recuperou \d+ HP/);
    expect(result).not.toBeNull();
    expect(result?.playerRemainingHp).toBeLessThanOrEqual(stats.hp);
    expect(saw(KANTO_BATTLE_MOVES.bubble!,/Velocidade de Alvo diminuiu/)).not.toBeNull();
  });
  it('mesmo seed gera log e condição idênticos, sem captura por derrota',()=>{
    for(const move of [ember,KANTO_BATTLE_MOVES['poison-sting']!,
      KANTO_BATTLE_MOVES['thunder-shock']!,KANTO_BATTLE_MOVES.absorb!]){
      const a=duel(move,['normal'],79);
      expect(duel(move,['normal'],79)).toEqual(a);
      expect(a.turns).toBeLessThanOrEqual(30);
      expect(a.log.at(-1)).toMatch(/Vitória|Empate|Derrota|Captura/);
      if(a.outcome!=='win')expect(a.captured).toBe(false);
    }
  });
});
