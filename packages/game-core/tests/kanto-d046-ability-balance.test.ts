import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,KANTO_BATTLE_MOVES,KANTO_SUPPORT_MOVES,
  kantoLevelMoves,kantoSupportMoves,kantoMoveSpCost,
  pokemonOwnStats,simulateKantoBattle,zeroStats
} from '../src/index.js';
import type {Combatant,KantoBattleResult,KantoBattleVisualFrame} from '../src/index.js';

/**
 * D-046 — A/B por mesma espécie, nível, rival, seed e stats.
 * A: golpe ofensivo original. B: o mesmo golpe + Recover/Double Kick.
 * Nenhuma seed, golpe ou stat é inventado em tempo de jogo; alterações em
 * fixtures pressure/fortified são intencionalmente ARTIFICIAIS e apenas CI.
 *
 * Não são amostras de usuários, matchmaking real ou exigência de win rate.
 * Novas habilidades podem alterar a ordem de consumo RNG em B: pareamento
 * isola a configuração inicial, NÃO força os mesmos rolls posteriores.
 */
const RECOVER_IDS=[120,121] as const;
const DOUBLE_IDS=[29,30,31,32,33,34] as const;
const LEVELS=[15,30,60] as const;
const FOES=[1,4,7,25,74,92,95,143] as const;
const SEEDS=[0,1,7,19,31,53,107,169] as const;
const MODES=['normal','fortified','pressure'] as const;
type Mode=typeof MODES[number];
type Ability='recover'|'double-kick';
type Pair={control:KantoBattleResult;withSkill:KantoBattleResult};
type Frame=KantoBattleVisualFrame;

function fighter(id:number,level:number,mode:Mode,side:'player'|'wild'):Combatant{
  const species=KANTO_BATTLE_SPECIES[id];
  if(!species)throw Error('Espécie inválida: '+id);
  const base=pokemonOwnStats(species.base,level,zeroStats());
  // Fortified provoca duração30 por HP e resistência; pressure provoca
  // oportunidades de cura sem assumir regras novas na build pública.
  const stats=mode==='normal'?base:mode==='fortified'?{
    ...base,
    hp:base.hp*4,defense:base.defense*5,specialDefense:base.specialDefense*5
  }:{
    ...base,
    hp:base.hp*3,
    attack:side==='wild'?base.attack*2:base.attack,
    specialAttack:side==='wild'?base.specialAttack*2:base.specialAttack,
    defense:side==='wild'?base.defense*2:base.defense,
    specialDefense:side==='wild'?base.specialDefense*2:base.specialDefense
  };
  return {speciesId:id,name:species.name,types:species.types,level,
    stats,move:species.move,rank:0};
}

function pct(n:number,total:number):number{
  return Math.round(n*10000/total)/100;
}
const round=(n:number)=>Math.round(n*100)/100;
function mean(values:readonly number[]):number{
  if(!values.length)throw Error('Amostra vazia');
  return round(values.reduce((sum,v)=>sum+v,0)/values.length);
}
function percentile(values:readonly number[],p:number):number{
  if(!values.length)throw Error('Amostra vazia');
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.ceil(sorted.length*p)-1]!;
}
function summary(results:readonly KantoBattleResult[]){
  const n=results.length;
  if(!n)throw Error('Grupo vazio');
  const frames=results.flatMap(r=>r.frames);
  const paid=frames.filter(f=>(f.spCost??0)>0);
  const focus=frames.filter(f=>f.kind==='focus');
  const recover=frames.filter(f=>f.moveName==='recover');
  const kick=frames.filter(f=>f.moveName==='double-kick');
  const kicks=kick.filter(f=>f.hitIndex===1);
  const hpHealed=recover.filter(f=>f.kind==='heal')
    .reduce((sum,f)=>sum+f.amount,0);
  return {
    n,
    winPct:pct(results.filter(r=>r.outcome==='win').length,n),
    lossPct:pct(results.filter(r=>r.outcome==='loss').length,n),
    drawPct:pct(results.filter(r=>r.outcome==='draw').length,n),
    meanTurns:mean(results.map(r=>r.turns)),
    p50Turns:percentile(results.map(r=>r.turns),.5),
    p95Turns:percentile(results.map(r=>r.turns),.95),
    at30Pct:pct(results.filter(r=>r.turns===30).length,n),
    withFocusPct:pct(results.filter(r=>r.frames.some(f=>f.kind==='focus')).length,n),
    meanFocusActions:round(focus.length/n),
    meanPaidActions:round(paid.length/n),
    meanSpSpent:round(paid.reduce((sum,f)=>sum+(f.spCost??0),0)/n),
    meanPlayerSpRemaining:mean(results.map(r=>r.playerRemainingSp)),
    meanPlayerHpFraction:round(results.reduce((sum,r)=>
      sum+r.playerRemainingHp/r.playerMaxHp,0)/n),
    meanJournalLines:mean(results.map(r=>r.log.length)),
    withRecoverPct:pct(results.filter(r=>r.frames.some(f=>
      f.actor==='player'&&f.moveName==='recover')).length,n),
    recoverActions:recover.length,
    meanRecoveredHp:round(hpHealed/n),
    withDoubleKickPct:pct(results.filter(r=>r.frames.some(f=>
      f.actor==='player'&&f.moveName==='double-kick'&&f.hitIndex===1)).length,n),
    doubleKickActions:kicks.length,
    doubleKickHits:kick.length,
    meanHitsPerKick:kicks.length?round(kick.length/kicks.length):0
  };
}

/** Guardar integridade INCLUINDO as micro-linhas de golpes de 2 hits. */
function validate(result:KantoBattleResult,ability:Ability,enhanced:boolean){
  expect(result.turns).toBeGreaterThanOrEqual(1);
  expect(result.turns).toBeLessThanOrEqual(30);
  expect(result.frames).toHaveLength(result.log.length);
  expect(result.frames.at(-1)?.playerHp).toBe(result.playerRemainingHp);
  expect(result.frames.at(-1)?.wildHp).toBe(result.wildRemainingHp);
  expect(result.frames.at(-1)?.playerSp).toBe(result.playerRemainingSp);
  expect(result.frames.at(-1)?.wildSp).toBe(result.wildRemainingSp);
  let selfHeals=0;
  for(let i=0;i<result.frames.length;i++){
    const frame=result.frames[i]!,prev=result.frames[i-1];
    expect(frame.playerHp).toBeGreaterThanOrEqual(0);
    expect(frame.wildHp).toBeGreaterThanOrEqual(0);
    expect(frame.playerHp).toBeLessThanOrEqual(result.playerMaxHp);
    expect(frame.wildHp).toBeLessThanOrEqual(result.wildMaxHp);
    expect(frame.playerSp).toBeGreaterThanOrEqual(0);
    expect(frame.wildSp).toBeGreaterThanOrEqual(0);
    expect(frame.playerSp).toBeLessThanOrEqual(result.playerMaxSp);
    expect(frame.wildSp).toBeLessThanOrEqual(result.wildMaxSp);
    if(!prev)continue;
    const deltaP=prev.playerSp!-frame.playerSp!;
    const deltaW=prev.wildSp!-frame.wildSp!;
    if(frame.kind==='focus'){
      expect(frame.spRecovery).toBeGreaterThan(0);
      expect(deltaP+deltaW).toBe(-(frame.spRecovery??0));
      expect(frame.spCost).toBe(0);
    }else{
      expect(deltaP+deltaW).toBe(frame.spCost??0);
      expect(deltaP).toBeGreaterThanOrEqual(0);
      expect(deltaW).toBeGreaterThanOrEqual(0);
    }
    if(frame.moveName==='recover'&&frame.actor==='player'){
      expect(enhanced&&ability==='recover').toBe(true);
      expect(frame.kind).toBe('heal');
      expect(frame.target).toBe('player');
      expect(frame.spCost).toBe(36);
      expect(frame.amount).toBeGreaterThan(0);
      expect(frame.amount).toBeLessThanOrEqual(Math.floor(result.playerMaxHp/2));
      expect(frame.playerHp-prev.playerHp).toBe(frame.amount);
      expect(prev.playerHp).toBeLessThanOrEqual(result.playerMaxHp/2);
      expect(frame.wildHp).toBe(prev.wildHp);
      const turn=Number(/^T(\d+)/.exec(result.log[i]??'')?.[1]);
      expect(turn).toBeLessThanOrEqual(26);
      selfHeals++;
    }
    if(frame.moveName==='double-kick'&&frame.actor==='player'){
      expect(enhanced&&ability==='double-kick').toBe(true);
      expect(frame.kind).toBe('attack');
      expect(frame.hitTotal).toBe(2);
      expect(frame.target).toBe('wild');
      if(frame.hitIndex===1){
        expect(frame.spCost).toBe(18);
        if(frame.wildHp>0&&frame.effectiveness!==0){
          const second=result.frames[i+1];
          expect(second?.moveName).toBe('double-kick');
          expect(second?.actor).toBe('player');
          expect(second?.hitIndex).toBe(2);
          expect(second?.playerSp).toBe(frame.playerSp);
          expect(second?.spCost).toBe(0);
          expect((second?.wildHp??Infinity)).toBeLessThanOrEqual(frame.wildHp);
        }
      }else if(frame.hitIndex===2){
        expect(frame.spCost).toBe(0);
        expect(prev.hitIndex).toBe(1);
        expect(frame.playerHp).toBe(prev.playerHp);
        expect(frame.playerSp).toBe(prev.playerSp);
      }else throw Error('hitIndex inesperado');
    }
  }
  expect(selfHeals).toBeLessThanOrEqual(1);
  if(!enhanced){
    expect(result.frames.some(f=>f.moveName==='recover'
      ||f.moveName==='double-kick')).toBe(false);
  }
}

/**
 * Cada versão do relatório identifica seus cenários:
 * - controle e melhoria compartilham matchup e seed;
 * - não forçar índices RNG após a divergência de ações;
 * - não comparar artificial pressure diretamente com encontros normais.
 */
describe('D-046 — balanceamento pareado Recover/Double Kick',()=>{
  it('mede normal + dois tipos de stress, preservando invariantes e replay',()=>{
    const buckets=new Map<string,Pair[]>();
    let totalPairs=0;
    let heals=0,hits=0,criticalHits=0;
    for(const mode of MODES)for(const level of LEVELS)
      for(const ability of ['recover','double-kick'] as const){
        const ids=ability==='recover'?RECOVER_IDS:DOUBLE_IDS;
        const move=ability==='recover'?KANTO_SUPPORT_MOVES.recover!
          :KANTO_BATTLE_MOVES['double-kick']!;
        expect(kantoMoveSpCost(move)).toBe(ability==='recover'?36:18);
        for(const id of ids)for(const foeId of FOES){
          const base=fighter(id,level,mode,'player');
          const foe=fighter(foeId,level,mode,'wild');
          const learnable=ability==='recover'
            ?kantoSupportMoves(id,level):kantoLevelMoves(id,level);
          expect(learnable.some(x=>x.move.name===move.name)).toBe(true);
          const withSkill:Combatant={...base,moves:[base.move,move]};
          for(const seed of SEEDS){
            const control=simulateKantoBattle(base,foe,seed);
            const enhanced=simulateKantoBattle(withSkill,foe,seed);
            validate(control,ability,false);
            validate(enhanced,ability,true);
            // Repetição amostrada: o RNG não depende de relógio/navegador.
            if(seed===SEEDS[0]&&foeId===FOES[0])
              expect(simulateKantoBattle(withSkill,foe,seed)).toEqual(enhanced);
            const key=mode+'/'+ability+'/'+level;
            const pairs=buckets.get(key)??[];
            pairs.push({control,withSkill:enhanced});
            buckets.set(key,pairs);
            totalPairs++;
            heals+=enhanced.frames.filter(f=>f.actor==='player'
              &&f.kind==='heal'&&f.moveName==='recover').length;
            const strikes=enhanced.frames.filter(f=>f.actor==='player'
              &&f.moveName==='double-kick');
            hits+=strikes.length;
            criticalHits+=strikes.filter(f=>f.critical).length;
          }
        }
      }

    expect(totalPairs).toBe(3*3*(2+6)*8*8);
    expect(buckets.size).toBe(3*3*2);
    const sections:Record<string,unknown>={};
    for(const [key,pairs] of buckets){
      const [mode,ability]=key.split('/');
      const n=mode&&ability==='recover'?2*FOES.length*SEEDS.length:
        6*FOES.length*SEEDS.length;
      expect(pairs).toHaveLength(n);
      const before=summary(pairs.map(x=>x.control));
      const after=summary(pairs.map(x=>x.withSkill));
      sections[key]={
        matchedPairs:pairs.length,control:before,enabled:after,
        delta:{
          winPct:round(after.winPct-before.winPct),
          drawPct:round(after.drawPct-before.drawPct),
          meanTurns:round(after.meanTurns-before.meanTurns),
          at30Pct:round(after.at30Pct-before.at30Pct),
          meanPaidActions:round(after.meanPaidActions-before.meanPaidActions),
          meanSpSpent:round(after.meanSpSpent-before.meanSpSpent),
          meanJournalLines:round(after.meanJournalLines-before.meanJournalLines)
        }
      };
    }
    expect(heals).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
    expect(criticalHits).toBeGreaterThan(0);
    const report={
      version:'D-046',
      source:'deterministic-paired-fixtures',
      note:'NOT player telemetry; pressure and fortified have synthetic stats',
      pairedBattles:totalPairs,
      simulatedBattles:totalPairs*2,
      recoverUses:heals,
      doubleKickHitEvents:hits,
      doubleKickCriticalHits:criticalHits,
      segments:sections
    };
    const runner=globalThis as unknown as {console:{info:(s:string)=>void}};
    runner.console.info('D046_BALANCE_REPORT '+JSON.stringify(report));
  });
});
