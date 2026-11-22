import {describe,it,expect} from 'vitest';
import {applyRewardEvent,prepareRewardJournal} from '../src/legacy/rewardEvents.js';
import {KANTO_GYMS,KANTO_GYM_MASTER_TITLE_STATS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {effectiveLegacyTitle} from '../src/legacy/catalog.js';
import type {RewardJournal,RewardCommand} from '../src/legacy/rewardEvents.js';
import type {GymBattleState} from '../src/gyms/gymBattleState.js';
const zero={hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0};
const starter=prepareGymOpponent(KANTO_GYMS[0]!).team;
const roster=starter.map((c,index)=>({
  uid:index+11,pokemonId:c.speciesId,level:c.level,xp:0,affinity:0,
  manual:{...zero},moveName:c.move.name,upgrades:{}
}));
const raw=()=>JSON.stringify({
  version:1,name:'Teste',mode:'demo',
  coins:500,wins:0,losses:0,trainer:{level:20,xp:0,manual:{...zero},
    title:'aprendiz',equipped:{}},
  badges:[],roster,team:[11,12,13],nextUid:14,seen:[74],
  expedition:null,lastClaim:null
});
function journal():RewardJournal{
  const result=prepareRewardJournal(raw());
  if(!result)throw Error('fixture inválida');
  return result;
}
function victory(gymIndex:number):GymBattleState{
  const opponents=prepareGymOpponent(KANTO_GYMS[gymIndex]!).team;
  const original=createGymBattleState([
    {uid:11,combatant:starter[0]!},
    {uid:12,combatant:starter[1]!},
    {uid:13,combatant:starter[2]!}
  ],opponents);
  return {...original,turn:7,outcome:'player-win',
    leader:{...original.leader,fighters:original.leader.fighters.map(f=>({
      ...f,hp:0
    })) as unknown as typeof original.leader.fighters}};
}
function command(index:number,revision:number,id='gym-'+index):RewardCommand{
  return {type:'gym-victory',id,expectedRevision:revision,
    gymId:KANTO_GYMS[index]!.id,battle:victory(index)};
}
const read=(j:RewardJournal)=>JSON.parse(j.raw) as {
  coins:number;badges:string[];wins:number;trainer:{level:number;xp:number};
  lastGymVictory?:{gymId:string;coins:number;trainerXp:number}
};

describe('GYM-03A — concessão sequencial e idempotente pelo journal',()=>{
  it('Brock: credita somente moedas/XP do catálogo e uma insígnia',()=>{
    const before=journal();
    const first=applyRewardEvent(before,command(0,0));
    expect(first.status).toBe('applied');
    const after=read(first.journal);
    expect(after.badges).toEqual(['boulder']);
    expect(after.coins).toBe(2000);
    expect(after.trainer.level).toBe(20);
    expect(after.trainer.xp).toBe(120);
    expect(after.lastGymVictory).toMatchObject({
      gymId:'boulder',coins:1500,trainerXp:120
    });
    expect(after.wins).toBe(0);
    expect(JSON.parse(before.raw).badges).toEqual([]);
  });
  it('replay do mesmo evento é duplicate; novo ID para ginásio vencido é rejeitado',()=>{
    const first=applyRewardEvent(journal(),command(0,0));
    expect(first.status).toBe('applied');
    const repeated=applyRewardEvent(first.journal,command(0,0));
    expect(repeated.status).toBe('duplicate');
    expect(repeated.journal).toBe(first.journal);
    const newId=applyRewardEvent(first.journal,command(0,1,'other-id'));
    expect(newId.status).toBe('rejected');
    expect(newId.journal).toBe(first.journal);
    expect(read(first.journal).coins).toBe(2000);
  });
  it('recusa fora de ordem, empate, derrota, elenco falsificado e UID externo',()=>{
    const origin=journal();
    const wrong=applyRewardEvent(origin,command(1,0));
    expect(wrong.status).toBe('rejected');
    expect(wrong.journal).toBe(origin);
    for(const outcome of ['draw','leader-win'] as const){
      const c=command(0,0) as Extract<RewardCommand,{type:'gym-victory'}>;
      const failed=applyRewardEvent(origin,{...c,battle:{...c.battle,outcome}});
      expect(failed.status).toBe('rejected');
      expect(failed.journal).toBe(origin);
    }
    const c=command(0,0) as Extract<RewardCommand,{type:'gym-victory'}>;
    const invalid={...c.battle,leader:{...c.battle.leader,
      fighters:c.battle.leader.fighters.map((f,i)=>i===0
        ?{...f,hp:1}:f) as unknown as typeof c.battle.leader.fighters}};
    expect(applyRewardEvent(origin,{...c,battle:invalid}).status).toBe('rejected');
    const unowned={...c.battle,player:{...c.battle.player,
      fighters:c.battle.player.fighters.map((f,i)=>i===0?{...f,uid:999}:f)
        as unknown as typeof c.battle.player.fighters}};
    expect(applyRewardEvent(origin,{...c,battle:unowned}).status).toBe('rejected');
  });
  it('oito ginásios em sequência, moedas únicas e título +12 em seis atributos',()=>{
    let state=journal();
    for(let i=0;i<8;i++){
      const result=applyRewardEvent(state,command(i,state.revision));
      expect(result.status).toBe('applied');
      state=result.journal;
      expect(read(state).badges).toEqual(KANTO_GYMS.slice(0,i+1).map(g=>g.id));
    }
    const final=read(state);
    expect(final.coins).toBe(500+KANTO_GYMS.reduce((v,g)=>v+g.coins,0));
    expect(state.receipts).toHaveLength(8);
    expect(effectiveLegacyTitle('mestre',0,1,8).stats)
      .toEqual(KANTO_GYM_MASTER_TITLE_STATS);
    expect(applyRewardEvent(state,command(7,8,'again')).status).toBe('rejected');
  });
  it('vitórias regionais nunca concedem insígnias',()=>{
    let state=journal();
    for(let i=0;i<24;i++){
      const result=applyRewardEvent(state,{
        type:'battle-result',id:'regional-'+i,expectedRevision:state.revision,
        outcome:'win',activeUid:11,wildLevel:5,affinityGain:2
      });
      expect(result.status).toBe('applied');
      state=result.journal;
    }
    expect(read(state).badges).toEqual([]);
    expect(read(state).wins).toBe(24);
  });
});
