import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,KANTO_SUPPORT_MOVES,
  kantoDamage,kantoMoveSpCost,kantoTypeMultiplier,
  pokemonOwnStats,simulateKantoBattle,zeroStats
} from '../src/index.js';
import type {Combatant,KantoBattleResult,KantoMove} from '../src/index.js';

/**
 * D-047 — separar EFEITO DE TIPO de diferenças entre golpe-base e Double Kick.
 * Estatísticas normalizadas exclusivamente para os LUTADORES (fixture real
 * pokemonOwnStats), sem alterar o simulador ou qualquer save. A referência
 * "single Fighting 60" é um EXPERIMENTO DE DANO PURAMENTE EM TESTE: não
 * existe em catálogo, learnset, TM ou interface; não é golpe equipável.
 */
const FAMILY=[29,30,31,32,33,34] as const;
const LEVELS=[15,30,60] as const;
const SEEDS=[0,1,7,19,31,53,107,169] as const;
const RIVALS=[
  19, // Normal / Rattata: Fighting ×2
  74, // Rock/Ground / Geodude: Fighting ×2
  7,  // Water / Squirtle: ×1
  25, // Electric / Pikachu: ×1
  63, // Psychic / Abra: ×0.5
  10, // Bug / Caterpie: ×0.5
  41, // Poison/Flying / Zubat: ×0.25
  92  // Ghost/Poison / Gastly: ×0
] as const;
const BUCKETS=['x2','x1','x0.5','x0.25','x0'] as const;
const kick=KANTO_BATTLE_MOVES['double-kick']!;
const cost=kantoMoveSpCost(kick);
const round=(v:number)=>Math.round(v*100)/100;

function fighter(id:number,level:number):Combatant{
  const c=KANTO_BATTLE_SPECIES[id];
  if(!c)throw new Error('Espécie do teste inválida: '+id);
  return {speciesId:id,name:c.name,types:c.types,level,
    stats:pokemonOwnStats(c.base,level,zeroStats()),move:c.move,rank:0};
}
function bucket(mult:number):string{
  if(![0,0.25,0.5,1,2].includes(mult))
    throw new Error('Tipo fora do recorte de comparação: '+mult);
  return 'x'+mult;
}
const win=(results:readonly KantoBattleResult[])=>round(
  results.filter(r=>r.outcome==='win').length*100/results.length
);
const mean=(values:readonly number[])=>round(
  values.reduce((sum,x)=>sum+x,0)/values.length
);

/**
 * Cada linha do diário deve manter 1 frame inclusive quando Double Kick
 * interrompe após KO no primeiro impacto. Somente o PRIMEIRO consome 18 SP.
 */
function assertKickIntegrity(result:KantoBattleResult):number{
  expect(result.log.length).toBe(result.frames.length);
  expect(result.turns).toBeGreaterThanOrEqual(1);
  expect(result.turns).toBeLessThanOrEqual(30);
  let actions=0;
  for(let i=0;i<result.frames.length;i++){
    const f=result.frames[i]!;
    expect(f.playerSp).toBeGreaterThanOrEqual(0);
    expect(f.playerSp).toBeLessThanOrEqual(result.playerMaxSp);
    expect(f.playerHp).toBeGreaterThanOrEqual(0);
    expect(f.playerHp).toBeLessThanOrEqual(result.playerMaxHp);
    expect(f.wildHp).toBeGreaterThanOrEqual(0);
    expect(f.wildHp).toBeLessThanOrEqual(result.wildMaxHp);
    if(f.actor!=='player'||f.moveName!=='double-kick')continue;
    expect(f.effectiveness).toBeGreaterThan(0);
    expect(f.hitTotal).toBe(2);
    if(f.hitIndex===1){
      actions++;
      expect(f.spCost).toBe(cost);
      if(f.wildHp>0){
        const next=result.frames[i+1]!;
        expect(next.hitIndex).toBe(2);
        expect(next.actor).toBe('player');
        expect(next.moveName).toBe('double-kick');
        expect(next.playerSp).toBe(f.playerSp);
      }
    }else{
      expect(f.hitIndex).toBe(2);
      expect(f.spCost).toBe(0);
      expect(result.frames[i-1]?.hitIndex).toBe(1);
    }
  }
  return actions;
}

describe('D-047 — comparação estratificada Fighting e ação multi-hit',()=>{
  it('compara o mesmo matchup com e sem Double Kick por tipo efetivo',()=>{
    expect(cost).toBe(18);
    const grouped=new Map<string,Array<{
      base:KantoBattleResult;plus:KantoBattleResult;usage:number
    }>>();
    for(const level of LEVELS)for(const id of FAMILY){
      const base=fighter(id,level);
      const enhanced:Combatant={...base,moves:[base.move,kick]};
      for(const foeId of RIVALS){
        const foe=fighter(foeId,level);
        const type=bucket(kantoTypeMultiplier('fighting',foe.types));
        for(const seed of SEEDS){
          const before=simulateKantoBattle(base,foe,seed);
          const after=simulateKantoBattle(enhanced,foe,seed);
          expect(before.frames).toHaveLength(before.log.length);
          expect(before.frames.some(f=>f.moveName==='double-kick')).toBe(false);
          const actions=assertKickIntegrity(after);
          if(type==='x0')expect(actions).toBe(0);
          const entries=grouped.get(type)??[];
          entries.push({base:before,plus:after,usage:actions});
          grouped.set(type,entries);
        }
      }
    }
    expect([...grouped.keys()].sort()).toEqual([...BUCKETS].sort());
    expect([...grouped.values()].reduce((n,arr)=>n+arr.length,0))
      .toBe(FAMILY.length*LEVELS.length*RIVALS.length*SEEDS.length);
    const report:Record<string,unknown>={};
    for(const type of BUCKETS){
      const pairs=grouped.get(type)!;
      const a=pairs.map(x=>x.base),b=pairs.map(x=>x.plus);
      const used=pairs.filter(x=>x.usage>0);
      report[type]={
        pairs:pairs.length,
        controlWinPct:win(a),withKickWinPct:win(b),
        deltaWinPoints:round(win(b)-win(a)),
        averageTurnsControl:mean(a.map(x=>x.turns)),
        averageTurnsWithKick:mean(b.map(x=>x.turns)),
        kickUsagePct:round(used.length*100/pairs.length),
        kickActions:pairs.reduce((n,x)=>n+x.usage,0),
        averageSpRemaining:mean(b.map(x=>x.playerRemainingSp))
      };
    }
    // O efeito esperado vem do catálogo de tipo, não de percentuais arbitrários.
    expect(kantoTypeMultiplier('fighting',['normal'])).toBe(2);
    expect(kantoTypeMultiplier('fighting',['poison','flying'])).toBe(.25);
    expect(kantoTypeMultiplier('fighting',['ghost','poison'])).toBe(0);
    expect((report.x0 as {kickActions:number}).kickActions).toBe(0);
    expect((report.x2 as {kickActions:number}).kickActions).toBeGreaterThan(0);
    (globalThis as unknown as {console:{info:(v:string)=>void}})
      .console.info('D047_MATCHUP_REPORT '+JSON.stringify({
        version:'D-047',source:'paired-deterministic-species',
        warnings:'NOT player telemetry; 6 species x3 levels x8 rivals x8 seeds',
        groups:report
      }));
  },30000);

  it('isola dano 30×2 frente a um ÚNICO golpe de poder 60 do mesmo tipo',()=>{
    const report:Record<string,unknown>={};
    const single:KantoMove={...kick,name:'d047-test-only-single-fighting-60',power:60};
    for(const foeId of RIVALS){
      const foe=fighter(foeId,30);
      const typ=bucket(kantoTypeMultiplier('fighting',foe.types));
      const samples:{two:number;one:number}[]=[];
      for(const id of FAMILY){
        const base=fighter(id,30);
        const two:Combatant={...base,move:kick};
        const one:Combatant={...base,move:single};
        // Mesmos rolls e stats; SEM turno, SP, acerto, custo ou captura.
        for(const roll of [.01,.37,.72]){
          const twoDamage=kantoDamage(two,foe,roll,.5).damage
            +kantoDamage(two,foe,roll,.5).damage;
          const oneDamage=kantoDamage(one,foe,roll,.5).damage;
          samples.push({two:twoDamage,one:oneDamage});
        }
      }
      const row=report[typ] as
        {pairs:number,meanDoubleDamage:number,meanSingleDamage:number}|undefined;
      if(row){
        const n=row.pairs+samples.length;
        report[typ]={
          pairs:n,
          meanDoubleDamage:round((row.meanDoubleDamage*row.pairs+
            samples.reduce((sum,x)=>sum+x.two,0))/n),
          meanSingleDamage:round((row.meanSingleDamage*row.pairs+
            samples.reduce((sum,x)=>sum+x.one,0))/n)
        };
      }else report[typ]={
        pairs:samples.length,
        meanDoubleDamage:mean(samples.map(x=>x.two)),
        meanSingleDamage:mean(samples.map(x=>x.one))
      };
    }
    // Imunidade existe na regra, mas só neste teste existe golpe power60.
    const immune=report.x0 as {meanDoubleDamage:number,meanSingleDamage:number};
    expect(immune.meanDoubleDamage).toBe(0);
    expect(immune.meanSingleDamage).toBe(0);
    (globalThis as unknown as {console:{info:(v:string)=>void}})
      .console.info('D047_POWER60_CONTROL '+JSON.stringify({
        version:'D-047',comparator:'SYNTHETIC power60 physical Fighting',
        note:'damage function only; no SP, PP, learnset or UI; not equipable',
        types:report
      }));
  },30000);
});
