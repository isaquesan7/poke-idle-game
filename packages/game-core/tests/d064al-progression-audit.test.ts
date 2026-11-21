/**
 * D064AL — modelo diagnóstico, NÃO ajusta gameplay.
 * Limitações: 20 vitórias/h, 100% de vitórias, encontros no nível máximo da região,
 * nenhum tempo extra, bolas/drops ignorados e disponibilidade do líder
 * pressuposta. Cenário "mixed" pressupõe 18 ciclos de expedição a cada luta
 * de três minutos; NÃO representa uma sessão observada.
 */
import {describe,it,expect} from 'vitest';
import {KANTO_REGIONS} from '../src/map/kantoRegions.js';
import {grantXp,battleTrainerXp} from '../src/progression/xp.js';
import {expeditionRewards} from '../src/rewards/expedition.js';

type Progress={level:number;xp:number};
type Gate={regionId:number;wins:number;hours:number};
function diagnostic(withExpedition:boolean):{wins:number;trainer:Progress;pokemon:Progress;gates:Gate[]} {
  let trainer:Progress={level:1,xp:0};
  let pokemon:Progress={level:5,xp:0};
  let wins=0;
  const gates:Gate[]=[{regionId:1,wins:0,hours:0}];
  const seen=new Set([1]);
  const idle=expeditionRewards(180000); // 3 minutos, 18 ciclos por batalha
  while(trainer.level<93 && wins<30000) {
    const region=[...KANTO_REGIONS].reverse().find(r=>
      trainer.level>=r.trainerUnlockLevel&&pokemon.level>=r.levelMin);
    if(!region) throw Error('Sem região elegível: progressão travada.');
    const wild=region.levelMax;
    trainer=grantXp('trainer',trainer,battleTrainerXp(wild)+(withExpedition?idle.trainerXp:0));
    pokemon=grantXp('pokemon',pokemon,20+6*wild+(withExpedition?idle.pokemonXpPerMember:0));
    wins++;
    for(const unlocked of KANTO_REGIONS) {
      if(seen.has(unlocked.id)||trainer.level<unlocked.trainerUnlockLevel||
        pokemon.level<unlocked.levelMin)continue;
      gates.push({regionId:unlocked.id,wins,hours:wins/20});
      seen.add(unlocked.id);
    }
  }
  return {wins,trainer,pokemon,gates};
}
describe('D064AL — projeção teórica de progressão, sem alterar regras',()=>{
  it('todos os dez gates são alcançáveis no cenário otimista só com batalhas',()=>{
    const result=diagnostic(false);
    expect(result.trainer.level).toBe(93);
    expect(result.gates.map(g=>g.regionId)).toEqual(KANTO_REGIONS.map(r=>r.id));
    expect(result.wins).toBe(4110);
    console.log('D064AL_BATTLE_ONLY '+JSON.stringify(result));
  });
  it('modelo hipotético batalha+idle mantém progressão e não oculta o custo temporal',()=>{
    const result=diagnostic(true);
    expect(result.trainer.level).toBe(93);
    expect(result.gates).toHaveLength(10);
    expect(result.wins).toBe(3205);
    expect(expeditionRewards(3600000).trainerXp).toBe(1440);
    console.log('D064AL_MIXED_POTENTIAL '+JSON.stringify(result));
  });
  it('todas regiões seguem com gate duplo efetivo e progressão monotônica',()=>{
    for(let i=0;i<KANTO_REGIONS.length;i++){
      const region=KANTO_REGIONS[i]!;
      expect(region.trainerUnlockLevel).toBeGreaterThanOrEqual(i===0?1:KANTO_REGIONS[i-1]!.trainerUnlockLevel);
      expect(region.levelMin).toBeGreaterThanOrEqual(i===0?2:KANTO_REGIONS[i-1]!.levelMin);
      expect(region.levelMin).toBeLessThanOrEqual(region.levelMax);
    }
  });
});
