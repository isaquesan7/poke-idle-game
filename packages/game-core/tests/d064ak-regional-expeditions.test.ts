import { describe, expect, it } from 'vitest';
import { prepareRewardJournal, applyRewardEvent } from '../src/legacy/rewardEvents.js';

function fixture(trainerLevel=20,pokemonLevel=20) {
  return JSON.stringify({
    version:1,trainer:{level:trainerLevel,xp:0},coins:0,wins:0,losses:0,
    nextUid:3,badges:[],team:[1,2],
    roster:[
      {uid:1,pokemonId:1,level:pokemonLevel,xp:0,affinity:0},
      {uid:2,pokemonId:4,level:5,xp:0,affinity:0}
    ],expedition:null,lastClaim:null
  });
}
function start(raw:string,regionId:number) {
  const journal=prepareRewardJournal(raw)!;
  return applyRewardEvent(journal,{
    id:'d064ak-start',expectedRevision:0,type:'start-expedition',nowMs:10000,regionId
  });
}
describe('D064AK — regiões e expedições transacionais',()=>{
  it('impede região bloqueada pelo treinador sem conceder recompensas',()=>{
    const result=start(fixture(20,50),5);
    expect(result.status).toBe('rejected');
    expect(JSON.parse(result.journal.raw).expedition).toBeNull();
    expect(result.journal.revision).toBe(0);
  });
  it('impede região acima do nível do Pokémon líder',()=>{
    const result=start(fixture(21,20),3);
    expect(result.status).toBe('rejected');
    expect(result.journal.revision).toBe(0);
  });
  it('congela região e UID do líder e credita XP somente ao expedicionário',()=>{
    const result=start(fixture(21,21),3);
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    const running=JSON.parse(result.journal.raw);
    expect(running.expedition.regionId).toBe(3);
    expect(running.expedition.teamUids).toEqual([1]);
    const claim=applyRewardEvent(result.journal,{
      id:'d064ak-claim',expectedRevision:1,type:'claim-expedition',nowMs:20000
    });
    expect(claim.status).toBe('applied');
    if(claim.status!=='applied')return;
    const saved=JSON.parse(claim.journal.raw);
    expect(saved.coins).toBe(9); // R3: 9 moedas/ciclo
    expect(saved.roster[0].xp).toBe(7); // R3: 7 XP/ciclo
    expect(saved.roster[1].xp).toBe(0);
    expect(claim.journal.receipts).toHaveLength(2);
    const duplicate=applyRewardEvent(claim.journal,{
      id:'d064ak-claim',expectedRevision:1,type:'claim-expedition',nowMs:20000
    });
    expect(duplicate.status).toBe('duplicate');
  });
  it('preserva expedições antigas e equipes anteriores ao recorte regional',()=>{
    const journal=prepareRewardJournal(fixture())!;
    const result=applyRewardEvent(journal,{
      id:'legacy-start',expectedRevision:0,type:'start-expedition',nowMs:10000
    });
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    expect(JSON.parse(result.journal.raw).expedition.teamUids).toEqual([1,2]);
  });
});
