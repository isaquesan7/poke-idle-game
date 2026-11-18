import {describe,expect,it} from 'vitest';
import {stdout} from 'node:process';
import {
  KANTO_BATTLE_SPECIES,KANTO_SUPPORT_MOVES,pokemonOwnStats,simulateKantoBattle,zeroStats
} from '../src/index.js';
import type {Combatant,KantoBattleResult} from '../src/index.js';

/**
 * D-040: relatório REPRODUZÍVEL das mesmas 1.920 combinações da D-039.
 * É diagnóstico, não telemetria de usuários nem critério para alterar regras.
 * Seeds, espécies e níveis são fixos para permitir comparar releases.
 */
const BASE_IDS=[1,4,7,10,25,37,43,60,74,92,94,95,113,129,131,143,150,151] as const;
const BASE_LEVELS=[5,25,60,100] as const;
const BASE_SEEDS=[0,1,7,19,31,53,107,169,239,345,777,1024,4556,99991,149331,987654] as const;
const SUPPORT_IDS=[
  {id:1,name:'poison-powder'},
  {id:4,name:'growl'},
  {id:7,name:'tail-whip'},
  {id:25,name:'thunder-wave'}
] as const;
const SUPPORT_TARGETS=[1,4,7,25,74,92,95,143] as const;
const SUPPORT_LEVELS=[20,50,100] as const;
const SUPPORT_SEEDS=[0,1,7,19,31,53,107,169] as const;

function combatant(id:number,level:number):Combatant{
  const species=KANTO_BATTLE_SPECIES[id];
  if(!species)throw new Error('Espécie ausente: '+id);
  return {
    speciesId:id,name:species.name,types:species.types,level,
    stats:pokemonOwnStats(species.base,level,zeroStats()),
    move:species.move,rank:0
  };
}

function summarize(results:readonly KantoBattleResult[]){
  const n=results.length;
  if(n<1)throw new Error('Amostra vazia.');
  const turns=results.map(result=>result.turns).sort((a,b)=>a-b);
  const count=(predicate:(result:KantoBattleResult)=>boolean)=>
    results.filter(predicate).length;
  const frames=results.flatMap(result=>result.frames);
  const focus=frames.filter(frame=>frame.kind==='focus');
  const skills=frames.filter(frame=>(frame.spCost??0)>0);
  const basic=frames.filter(frame=>frame.moveName==='basic-attack');
  const round=(value:number)=>Math.round(value*100)/100;
  const pct=(numerator:number)=>round(numerator*100/n);
  return {
    samples:n,
    playerWinPct:pct(count(result=>result.outcome==='win')),
    playerLossPct:pct(count(result=>result.outcome==='loss')),
    drawPct:pct(count(result=>result.outcome==='draw')),
    meanTurns:round(turns.reduce((sum,turn)=>sum+turn,0)/n),
    p50Turns:turns[Math.ceil(n*.50)-1],
    p95Turns:turns[Math.ceil(n*.95)-1],
    reachedTurnLimitPct:pct(count(result=>result.turns===30)),
    battlesWithFocusPct:pct(count(result=>result.frames.some(frame=>frame.kind==='focus'))),
    focusActions:focus.length,
    basicActions:basic.length,
    paidSkillActions:skills.length,
    meanSkillSpSpent:round(skills.reduce((sum,frame)=>sum+(frame.spCost??0),0)/n),
    meanFocusSpRecovered:round(focus.reduce((sum,frame)=>sum+(frame.spRecovery??0),0)/n),
    meanPlayerSpRemaining:round(results.reduce((sum,result)=>sum+result.playerRemainingSp,0)/n)
  };
}

describe('D-040: diagnóstico reproduzível de balanceamento da Arena',()=>{
  it('publica métricas por cenário/nível sem alterar save, combate ou RNG',()=>{
    const grouped=new Map<string,KantoBattleResult[]>();
    const add=(scenario:string,level:number,result:KantoBattleResult)=>{
      const key=scenario+'/'+level;
      const bucket=grouped.get(key)??[];
      bucket.push(result);
      grouped.set(key,bucket);
      expect(result.turns).toBeGreaterThanOrEqual(1);
      expect(result.turns).toBeLessThanOrEqual(30);
      expect(result.frames).toHaveLength(result.log.length);
      expect(result.playerRemainingSp).toBeGreaterThanOrEqual(0);
      expect(result.wildRemainingSp).toBeGreaterThanOrEqual(0);
    };

    for(const level of BASE_LEVELS)for(const id of BASE_IDS){
      const player=combatant(id,level);
      const index=BASE_IDS.indexOf(id);
      const foeId=BASE_IDS[(index+7)%BASE_IDS.length];
      if(foeId===undefined)throw new Error('Rival ausente.');
      const foe=combatant(foeId,level);
      for(const seed of BASE_SEEDS)
        add('baseline',level,simulateKantoBattle(player,foe,seed));
    }

    for(const level of SUPPORT_LEVELS)
      for(const {id,name} of SUPPORT_IDS)
        for(const foeId of SUPPORT_TARGETS){
          const base=combatant(id,level);
          const support=KANTO_SUPPORT_MOVES[name];
          if(!support)throw new Error('Suporte ausente: '+name);
          const player:Combatant={
            ...base,move:support,moves:[support,base.move]
          };
          const foe=combatant(foeId,level);
          for(const seed of SUPPORT_SEEDS)
            add('support',level,simulateKantoBattle(player,foe,seed));
        }

    const all=[...grouped.values()].flat();
    expect(grouped.size).toBe(7);
    expect(all).toHaveLength(1920);
    for(const [key,matches] of grouped){
      expect(matches).toHaveLength(key.startsWith('baseline/')?288:256);
    }

    const sections=Object.fromEntries(
      [...grouped].map(([key,matches])=>[key,summarize(matches)])
    );
    const report={
      version:'D-040',source:'snapshot D-039',method:'deterministic-not-player-telemetry',
      total:summarize(all),segments:sections
    };
    // Saída intencional e versionável no log de CI para revisão do design.
    stdout.write('D040_BALANCE_REPORT '+JSON.stringify(report)+'\n');
    expect(report.total.samples).toBe(1920);
    expect(report.total.p95Turns).toBeLessThanOrEqual(30);
  });
});
