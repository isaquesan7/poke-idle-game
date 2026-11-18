import {describe,expect,it} from 'vitest';
import {KANTO_BATTLE_SPECIES,KANTO_SUPPORT_MOVES,pokemonOwnStats,
  simulateKantoBattle,zeroStats} from '../src/index.js';
import type {Combatant,KantoBattleResult} from '../src/index.js';

/**
 * D-042: stress diagnóstico, sem alterar motor, save ou dados de produção.
 * A matriz D-040 terminou cedo (p95 9 turnos), então esta amostra ARTIFICIAL
 * fortalece HP/defesas para exercitar 20-30 turnos, SP, Focus e status.
 * Os stats intencionalmente não representam o balanceamento final do jogo.
 */
const SPECIES=[1,4,7,25,74,92,95,143] as const;
const LEVELS=[20,50,100] as const;
const SEEDS=[0,1,7,19,31,53,107,169] as const;
const SUPPORT:Readonly<Record<number,string>>={
  1:'poison-powder',4:'growl',7:'tail-whip',25:'thunder-wave'
};
const MODES=['fortified','status-and-resistance'] as const;

function fighter(speciesId:number,level:number,mode:typeof MODES[number]):Combatant{
  const species=KANTO_BATTLE_SPECIES[speciesId];
  if(!species)throw Error('Espécie ausente');
  const base=pokemonOwnStats(species.base,level,zeroStats());
  const factor=mode==='fortified'?8:5;
  const stats={
    ...base,
    hp:Math.min(100000,base.hp*(mode==='fortified'?5:3)),
    defense:Math.min(100000,base.defense*factor),
    specialDefense:Math.min(100000,base.specialDefense*factor)
  };
  const support=mode==='status-and-resistance'?
    KANTO_SUPPORT_MOVES[SUPPORT[speciesId]??'']:undefined;
  return {
    speciesId,name:species.name,types:species.types,level,stats,
    move:support??species.move,rank:0,
    ...(support?{moves:[support,species.move]}:{})
  };
}

function mean(values:readonly number[]):number{
  return Math.round(values.reduce((sum,x)=>sum+x,0)/values.length*100)/100;
}
function metrics(results:readonly KantoBattleResult[]){
  const turns=results.map(result=>result.turns).sort((a,b)=>a-b);
  const pct=(count:number)=>Math.round(count*10000/results.length)/100;
  const events=results.flatMap(result=>result.frames);
  const focus=events.filter(frame=>frame.kind==='focus');
  return {
    battles:results.length,meanTurns:mean(turns),p95Turns:turns[Math.ceil(turns.length*.95)-1],
    minTurns:turns[0],maxTurns:turns[turns.length-1],
    atLeast20TurnsPct:pct(results.filter(r=>r.turns>=20).length),
    reached30TurnsPct:pct(results.filter(r=>r.turns===30).length),
    drawsPct:pct(results.filter(r=>r.outcome==='draw').length),
    focusActions:focus.length,
    exhaustedSpPct:pct(results.filter(r=>r.playerRemainingSp===0||r.wildRemainingSp===0).length),
    statusEvents:events.filter(frame=>frame.kind==='status'||frame.kind==='residual').length
  };
}

describe('D-042: batalhas resistentes de 20–30 turnos (diagnóstico)',()=>{
  it('mantém frames, HP, SP e Concentrar válidos em 384 cenários adversariais',()=>{
    const groups=new Map<string,KantoBattleResult[]>();
    for(const mode of MODES)for(const level of LEVELS)
      for(let i=0;i<SPECIES.length;i++){
        const pId=SPECIES[i], wId=SPECIES[(i+3)%SPECIES.length];
        if(pId===undefined||wId===undefined)throw Error('fixture inválida');
        const player=fighter(pId,level,mode),wild=fighter(wId,level,mode);
        for(const seed of SEEDS){
          const battle=simulateKantoBattle(player,wild,seed);
          const key=mode+'/'+level;
          const bucket=groups.get(key)??[];
          bucket.push(battle);
          groups.set(key,bucket);
          expect(battle.turns).toBeGreaterThanOrEqual(1);
          expect(battle.turns).toBeLessThanOrEqual(30);
          expect(battle.frames.length).toBe(battle.log.length);
          expect(battle.playerRemainingHp).toBeGreaterThanOrEqual(0);
          expect(battle.wildRemainingHp).toBeGreaterThanOrEqual(0);
          expect(battle.playerRemainingSp).toBeGreaterThanOrEqual(0);
          expect(battle.wildRemainingSp).toBeGreaterThanOrEqual(0);
          expect(battle.playerRemainingSp).toBeLessThanOrEqual(battle.playerMaxSp);
          expect(battle.wildRemainingSp).toBeLessThanOrEqual(battle.wildMaxSp);
          expect(battle.frames.at(-1)?.playerHp).toBe(battle.playerRemainingHp);
          expect(battle.frames.at(-1)?.wildHp).toBe(battle.wildRemainingHp);
          expect(battle.frames.at(-1)?.playerSp).toBe(battle.playerRemainingSp);
          expect(battle.frames.at(-1)?.wildSp).toBe(battle.wildRemainingSp);
          const focusByActor=new Map<'player'|'wild',number[]>();
          battle.frames.forEach((frame,index)=>{
            if(frame.kind!=='focus')return;
            const actor=frame.actor;
            expect(actor==='player'||actor==='wild').toBe(true);
            expect(frame.spRecovery).toBeGreaterThan(0);
            expect(frame.spCost).toBe(0);
            const side=actor as 'player'|'wild';
            const turns=focusByActor.get(side)??[];
            // O frame carrega a linha correspondente, que contém Tn, não
            // inventamos um contador a partir de animações.
            const turnMatch=/^T(\d+)\s/.exec(battle.log[index]??'');
            if(turnMatch){
              const turn=Number(turnMatch[1]);
              if(turns.length>0)expect(turn-turns[turns.length-1]!).toBeGreaterThanOrEqual(4);
              turns.push(turn);
            }
            focusByActor.set(side,turns);
          });
          for(const turns of focusByActor.values())expect(turns.length).toBeLessThanOrEqual(2);
        }
      }

    const all=[...groups.values()].flat();
    expect(groups.size).toBe(6);
    expect(all).toHaveLength(384);
    for(const group of groups.values())expect(group).toHaveLength(64);
    // Cobrir o limite 30 de maneira adversarial; NÃO obrigar o balanceamento
    // real a produzir esta duração artificial.
    expect(all.some(result=>result.turns>=20)).toBe(true);
    expect(all.some(result=>result.turns===30)).toBe(true);
    const segments=Object.fromEntries([...groups].map(([key,r])=>[key,metrics(r)]));
    const report={version:'D-042',type:'artificial-stress-not-player-telemetry',
      total:metrics(all),segments};
    const runner=globalThis as unknown as {console:{info:(message:string)=>void}};
    runner.console.info('D042_LONG_BATTLE_REPORT '+JSON.stringify(report));
  });
});
