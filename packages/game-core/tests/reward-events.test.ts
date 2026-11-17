import { describe, expect, it } from 'vitest';
import {
  applyRewardEvent, prepareRewardJournal
} from '../src/index.js';
import type {
  RewardCommand, RewardJournal, RewardEventResult
} from '../src/index.js';

const pokemon=(uid:number,level=20)=>({
  uid,pokemonId:1,level,xp:12,affinity:uid===1?73:10,
  manual:{hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0},
  moveName:'vine-whip',upgrades:{'vine-whip':1},custom:'Pokémon 🌿'
});
const source=()=>({
  version:1,name:'Kanto',coins:321,wins:0,losses:0,mode:'demo',
  trainer:{level:21,xp:16,manual:{attack:39},title:'aprendiz'},
  roster:[pokemon(1),pokemon(2)],team:[1,2],nextUid:3,
  badges:[] as string[],seen:[1,4],expedition:null as null | {
    startedAt:number;lastClaimAt:number;teamUids:number[]
  },lastClaim:null as null | Record<string,unknown>,
  customRoot:{original:true},otherSaveField:'não alterar'
});
const raw=JSON.stringify(source());

function journal(r=raw):RewardJournal {
  const j=prepareRewardJournal(r);
  if(!j)throw Error('fixture inválida');
  return j;
}
function applied(j:RewardJournal,c:RewardCommand):RewardJournal {
  const result=applyRewardEvent(j,c);
  expect(result.status,JSON.stringify(result)).toBe('applied');
  return result.journal;
}
function rejected(j:RewardJournal,c:RewardCommand):void {
  const before=JSON.stringify(j);
  const outcome=applyRewardEvent(j,c);
  expect(outcome.status,JSON.stringify(outcome)).toBe('rejected');
  expect(outcome.journal).toBe(j);
  expect(JSON.stringify(j)).toBe(before);
}
type BattleCommand = Extract<RewardCommand,{type:'battle-result'}>;
const battle=(id='b1',expectedRevision=0):BattleCommand=>({
  type:'battle-result',id,expectedRevision,activeUid:1,wildLevel:10,
  outcome:'win',affinityGain:3,
  capture:{pokemonId:25,moveName:'thunder-shock'}
});
const noCapture=(id:string,expectedRevision=0):BattleCommand=>({
  type:'battle-result',id,expectedRevision,activeUid:1,wildLevel:10,
  outcome:'win',affinityGain:3
});
const start=(id='s1',expectedRevision=0,nowMs=100000):RewardCommand=>({
  type:'start-expedition',id,expectedRevision,nowMs
});
const claim=(id='c1',expectedRevision=1,nowMs=130000):Extract<RewardCommand,{type:'claim-expedition'}>=>({
  type:'claim-expedition',id,expectedRevision,nowMs
});
const stop=(id='stop1',expectedRevision=2,nowMs=140000):RewardCommand=>({
  type:'stop-expedition',id,expectedRevision,nowMs
});
const parsed=(j:RewardJournal):ReturnType<typeof source>=>JSON.parse(j.raw) as ReturnType<typeof source>;

describe('journal de eventos idempotentes v0.2 (somente RAM)',()=>{
  it('recusa JSON inválido e versões desconhecidas antes de criar envelope',()=>{
    expect(prepareRewardJournal('{broken')).toBeNull();
    expect(prepareRewardJournal(JSON.stringify({...source(),version:2}))).toBeNull();
    expect(prepareRewardJournal(JSON.stringify({...source(),team:[1,1]}))).toBeNull();
    expect(prepareRewardJournal(JSON.stringify({...source(),nextUid:2}))).toBeNull();
    expect(prepareRewardJournal(JSON.stringify({...source(),roster:[]}))).toBeNull();
  });

  it('vitória+captura são evento único; ID e UID não duplicam com replay',()=>{
    const original=journal();
    const first=applied(original,battle());
    const save=parsed(first);
    expect(first.revision).toBe(1);
    expect(first.receipts).toHaveLength(1);
    expect(save.wins).toBe(1);
    expect(save.losses).toBe(0);
    expect(save.coins).toBe(321+25+30);
    expect(save.trainer.xp).toBe(16+30+70);
    expect(save.roster[0]?.xp).toBe(12+20+60);
    expect(save.roster[0]?.affinity).toBe(76);
    expect(save.roster).toHaveLength(3);
    expect(save.roster[2]).toMatchObject({
      uid:3,pokemonId:25,level:10,xp:0,affinity:0,
      moveName:'thunder-shock',upgrades:{}
    });
    expect(save.nextUid).toBe(4);
    expect(save.team).toEqual([1,2]);
    expect(save.roster[1]).toEqual(source().roster[1]);
    expect(save.customRoot).toEqual({original:true});
    expect(save.otherSaveField).toBe('não alterar');
    const repeat=applyRewardEvent(first,battle());
    expect(repeat.status).toBe('duplicate');
    expect(repeat.journal).toBe(first);
    expect(parsed(first).nextUid).toBe(4);
    expect(original.raw).toBe(raw);
    expect(original.receipts).toHaveLength(0);
  });

  it('mesmo ID com payload diferente é conflito, inclusive captura alterada',()=>{
    const a=applied(journal(),battle());
    rejected(a,{...battle(),capture:{pokemonId:151}});
    rejected(a,{...battle(),wildLevel:30});
    rejected(a,{...battle(),expectedRevision:1});
  });

  it('duas abas com revision 0: primeira aplica, segunda deve recarregar',()=>{
    const old=journal();
    const a=applied(old,battle('battle-a'));
    rejected(a,battle('battle-b',0));
    expect(parsed(a).coins).toBe(376);
    expect(parsed(old).coins).toBe(321);
    expect(applyRewardEvent(a,battle('battle-a')).status).toBe('duplicate');
    // Importantíssimo: dois envelopes INDEPENDENTES ainda poderiam divergir.
    const independent=applied(old,battle('battle-b',0));
    expect(parsed(independent).coins).toBe(376);
    expect(independent.receipts[0]?.id).toBe('battle-b');
    expect(a.receipts[0]?.id).toBe('battle-a');
  });

  it('não concede recompensas ao perder nem no empate (contados como derrota pela v0.1)',()=>{
    const loss:RewardCommand={
      type:'battle-result',id:'loss',expectedRevision:0,
      outcome:'loss',activeUid:1,wildLevel:10
    };
    const first=applied(journal(),loss);
    expect(parsed(first).losses).toBe(1);
    expect(parsed(first).wins).toBe(0);
    expect(parsed(first).coins).toBe(321);
    expect(parsed(first).roster).toEqual(source().roster);
    const draw=applied(first,{...loss,id:'draw',expectedRevision:1,outcome:'draw'});
    expect(parsed(draw).losses).toBe(2);
    expect(parsed(draw).coins).toBe(321);
    expect(applyRewardEvent(first,loss).status).toBe('duplicate');
  });

  it('desbloqueia insígnias UMA vez por vitória e não duplica títulos',()=>{
    const enriched={...source(),wins:2,badges:['boulder']};
    let j=journal(JSON.stringify(enriched));
    j=applied(j,noCapture('win-3'));
    expect(parsed(j).badges).toEqual(['boulder','cascade']);
    j=applied(j,noCapture('win-4',1));
    expect(parsed(j).badges).toEqual(['boulder','cascade']);
    expect(parsed(j).trainer.title).toBe('aprendiz');
  });

  it('recusa bônus e captura forjados em derrota, nível, UID e afinidade inválidos',()=>{
    const j=journal();
    rejected(j,{...battle(),outcome:'loss'});
    rejected(j,{...battle(),outcome:'draw'});
    rejected(j,{...battle(),affinityGain:9});
    rejected(j,{...battle(),affinityGain:0});
    rejected(j,{...battle(),wildLevel:101});
    rejected(j,{...battle(),wildLevel:1});
    rejected(j,{...battle(),activeUid:2}); // apenas líder do time
    rejected(j,{...battle(),capture:{pokemonId:152}});
    rejected(j,{...battle(),capture:{pokemonId:25,moveName:''}});
    rejected(j,{...battle(),id:' espaço'});
    rejected(j,{...battle(),expectedRevision:-1});
    rejected(j,{...battle(),type:'unexpected' as 'battle-result'});
  });
});

describe('expedição: claim/stop em snapshot puro e replays protegidos',()=>{
  it('start não duplicado; 3 ciclos resgatam valores exatos e tempo avança para nowMs',()=>{
    let j=applied(journal(),start());
    expect(parsed(j).expedition).toEqual({
      startedAt:100000,lastClaimAt:100000,teamUids:[1,2]
    });
    expect(applyRewardEvent(j,start()).status).toBe('duplicate');
    rejected(j,start('another',1)); // já ativa
    j=applied(j,claim());
    const s=parsed(j);
    expect(j.revision).toBe(2);
    expect(s.coins).toBe(342);
    expect(s.trainer.xp).toBe(28);
    expect(s.roster[0]?.xp).toBe(27);
    expect(s.roster[1]?.xp).toBe(27);
    expect(s.roster[0]?.affinity).toBe(74);
    expect(s.roster[1]?.affinity).toBe(11);
    expect(s.expedition?.lastClaimAt).toBe(130000);
    expect(s.lastClaim).toEqual({
      coins:21,trainerXP:12,pokemonXP:15,cycles:3
    });
    expect(applyRewardEvent(j,claim()).status).toBe('duplicate');
    rejected(j,claim('another-id',1,130000));
    rejected(j,claim('too-soon',2,139999));
    expect(parsed(j).coins).toBe(342);
  });

  it('stop resgata o último ciclo uma vez e fecha expedição no MESMO evento',()=>{
    let j=applied(journal(),start());
    j=applied(j,claim());
    j=applied(j,stop());
    expect(parsed(j).expedition).toBeNull();
    expect(parsed(j).coins).toBe(349); // 321 +21+7
    expect(parsed(j).trainer.xp).toBe(32);
    expect(parsed(j).roster[0]?.xp).toBe(32);
    expect(applyRewardEvent(j,stop()).status).toBe('duplicate');
    rejected(j,claim('later',3,150000));
    rejected(j,stop('second-stop',3,150000));
  });

  it('stop sem ciclos completos fecha sem gerar XP/moedas extras',()=>{
    let j=applied(journal(),start());
    j=applied(j,{...stop('early',1,101000)});
    expect(parsed(j).expedition).toBeNull();
    expect(parsed(j).lastClaim).toBeNull();
    expect(parsed(j).coins).toBe(321);
  });

  it('8h de máximo por claim, afinidade 100 cap e level 100 cap',()=>{
    const v=source();
    v.roster[0]!.affinity=99;
    v.roster[0]!.level=100;
    v.roster[0]!.xp=0;
    let j=applied(journal(JSON.stringify(v)),start());
    j=applied(j,claim('big',1,100000+12*3600000));
    const s=parsed(j);
    expect(s.coins).toBe(321+20160);
    expect(s.lastClaim?.cycles).toBe(2880);
    expect(s.roster[0]?.affinity).toBe(100);
    expect(s.roster[0]?.level).toBe(100);
    expect(s.roster[0]?.xp).toBe(0);
    expect(s.expedition?.lastClaimAt).toBe(100000+12*3600000);
  });

  it('rejeita relógio retrocedido, nenhuma expedição, fonte inconsistente e IDs ruins',()=>{
    const base=journal();
    rejected(base,claim());
    rejected(base,stop());
    rejected(base,{...start(),nowMs:-1});
    let j=applied(base,start());
    rejected(j,claim('past',1,99999));
    rejected(j,claim('empty',1,109999));
    const corrupt=source();
    corrupt.expedition={startedAt:1,lastClaimAt:10,teamUids:[404]};
    expect(prepareRewardJournal(JSON.stringify(corrupt))).toBeNull();
    const forged:RewardJournal={...j,revision:9};
    rejected(forged,claim());
    const missing:RewardJournal={...j,receipts:[]};
    rejected(missing,claim());
    const collision:RewardJournal={...j,receipts:[...j.receipts,j.receipts[0]!]};
    rejected(collision,claim());
  });

  it('cursor de claim prevalece sobre ID novo; retries de stale são recusadas',()=>{
    let j=applied(journal(),start('begin'));
    const old=j;
    j=applied(j,claim('one',1,130000));
    rejected(j,claim('two',1,130000));
    // Mesmo timestamp com revisão fresca NÃO pode receber outra vez.
    rejected(j,claim('two',2,130000));
    expect(parsed(j).coins).toBe(342);
    // Outro snapshot ainda poderia aceitar: writer único ainda é exigido.
    const fork=applied(old,claim('two',1,130000));
    expect(parsed(fork).coins).toBe(342);
  });
});
