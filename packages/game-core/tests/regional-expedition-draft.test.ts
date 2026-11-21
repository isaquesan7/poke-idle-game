import {describe,it,expect} from 'vitest';
import {applyRegionalExpeditionDraft,prepareRewardJournal,xpThreshold} from '../src/index.js';

function fixture(level=11,pokemonLevels=[5]){
  const roster=pokemonLevels.map((pokemonLevel,i)=>({
    uid:i+1,pokemonId:4,level:pokemonLevel,xp:0,affinity:0,
    manual:{},moveName:'scratch',upgrades:{}
  }));
  const state={
    version:1,mode:'normal',name:'Regiões',coins:100,wins:0,losses:0,
    trainer:{level,xp:0,manual:{}},team:roster.map(p=>p.uid),
    roster,nextUid:roster.length+1,badges:[],seen:[4],
    expedition:null,lastClaim:null,extra:{preserve:true}
  };
  const journal=prepareRewardJournal(JSON.stringify(state));
  if(!journal)throw Error('Fixture inválida');
  return journal;
}
const cmd=(operation:'start'|'claim'|'stop',nowMs:number,regionId=1,expectedRevision=0)=>({
  operation,nowMs,regionId,expectedRevision,id:'regional-'+operation+'-'+expectedRevision
});

describe('D-064M: expedições regionais no journal experimental',()=>{
  it('Nv. 11 Treinador/Nv.5 Pokémon só acessa Bosque; Colinas exige Nv.10',()=>{
    const initial=fixture();
    expect(applyRegionalExpeditionDraft(initial,cmd('start',1000,2)).status).toBe('rejected');
    const opened=applyRegionalExpeditionDraft(initial,cmd('start',1000,1));
    expect(opened.status).toBe('applied');
    if(opened.status!=='applied')return;
    const first=JSON.parse(opened.journal.raw);
    expect(first.expedition.regionId).toBe(1);
    expect(first.expedition.teamUids).toEqual([1]);
    expect(initial.revision).toBe(0);
    const duplicate=applyRegionalExpeditionDraft(opened.journal,cmd('start',1000,1));
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.journal).toBe(opened.journal);
    const changed=applyRegionalExpeditionDraft(opened.journal,{
      ...cmd('start',1000,2),id:'regional-start-0'
    });
    expect(changed.status).toBe('rejected');
  });
  it('corta XP exatamente no teto, moedas continuam e mudança de área exige stop/start',()=>{
    const base=fixture(11,[9]);
    const current=JSON.parse(base.raw);
    current.roster[0].xp=xpThreshold('pokemon',9)-7;
    const initial=prepareRewardJournal(JSON.stringify(current))!;
    const opened=applyRegionalExpeditionDraft(initial,cmd('start',1000));
    expect(opened.status).toBe('applied');
    if(opened.status!=='applied')return;
    const claim=applyRegionalExpeditionDraft(opened.journal,cmd('claim',1000+3600000,1,1));
    expect(claim.status).toBe('applied');
    if(claim.status!=='applied')return;
    const claimed=JSON.parse(claim.journal.raw);
    expect(claimed.roster[0].level).toBe(10);
    expect(claimed.roster[0].xp).toBe(0);
    expect(claimed.lastClaim.pokemonXpByUid['1']).toBe(7);
    expect(claimed.coins).toBe(2620);
    expect(claimed.trainer.level).toBe(11);
    expect(claimed.trainer.xp).toBe(0);
    expect(claimed.extra).toEqual({preserve:true});
    const another=applyRegionalExpeditionDraft(claim.journal,cmd('claim',1000+7200000,1,2));
    expect(another.status).toBe('applied');
    if(another.status!=='applied')return;
    const later=JSON.parse(another.journal.raw);
    expect(later.roster[0].level).toBe(10);
    expect(later.lastClaim.pokemonXpByUid['1']).toBe(0);
    expect(later.coins).toBe(5140);
    expect(applyRegionalExpeditionDraft(another.journal,cmd('claim',1000+10800000,2,3)).status)
      .toBe('rejected');
    const stopped=applyRegionalExpeditionDraft(another.journal,cmd('stop',1000+10800000,1,3));
    expect(stopped.status).toBe('applied');
    if(stopped.status!=='applied')return;
    expect(JSON.parse(stopped.journal.raw).expedition).toBeNull();
    const next=applyRegionalExpeditionDraft(stopped.journal,cmd('start',1000+10800000,2,4));
    expect(next.status).toBe('applied');
    if(next.status==='applied')expect(JSON.parse(next.journal.raw).expedition.regionId).toBe(2);
  });
  it('trata expedição antiga com respeito, sem migração silenciosa nem perda de ciclos',()=>{
    const initial=fixture();
    const raw=JSON.parse(initial.raw);
    raw.expedition={startedAt:0,lastClaimAt:0,teamUids:[1]};
    const legacy=prepareRewardJournal(JSON.stringify(raw))!;
    const before=legacy.raw;
    expect(applyRegionalExpeditionDraft(legacy,cmd('claim',10000)).status).toBe('rejected');
    expect(applyRegionalExpeditionDraft(legacy,cmd('stop',10000)).status).toBe('rejected');
    expect(legacy.raw).toBe(before);
  });
  it('expedição de equipe mista aplica teto individual, sem saltar XP de um companheiro',()=>{
    const initial=fixture(11,[5,10]);
    const started=applyRegionalExpeditionDraft(initial,cmd('start',1000));
    expect(started.status).toBe('applied');
    if(started.status!=='applied')return;
    const claim=applyRegionalExpeditionDraft(started.journal,cmd('claim',11000,1,1));
    expect(claim.status).toBe('applied');
    if(claim.status!=='applied')return;
    const data=JSON.parse(claim.journal.raw);
    expect(data.lastClaim.pokemonXpByUid).toEqual({'1':5,'2':0});
    expect(data.roster[0].xp).toBe(5);
    expect(data.roster[1].level).toBe(10);
    expect(data.coins).toBe(107);
  });
  it('impede ciclos antecipados, relógio regressivo, replays e saldo duplicado',()=>{
    const initial=fixture();
    const opened=applyRegionalExpeditionDraft(initial,cmd('start',1000));
    expect(opened.status).toBe('applied');
    if(opened.status!=='applied')return;
    expect(applyRegionalExpeditionDraft(opened.journal,cmd('claim',500,1,1)).status).toBe('rejected');
    expect(applyRegionalExpeditionDraft(opened.journal,cmd('claim',1005,1,1)).status).toBe('rejected');
    const stopped=applyRegionalExpeditionDraft(opened.journal,cmd('stop',1005,1,1));
    expect(stopped.status).toBe('applied');
    if(stopped.status==='applied'){
      expect(JSON.parse(stopped.journal.raw).coins).toBe(100);
      expect(applyRegionalExpeditionDraft(stopped.journal,cmd('stop',1005,1,1)).status).toBe('duplicate');
    }
  });
});
