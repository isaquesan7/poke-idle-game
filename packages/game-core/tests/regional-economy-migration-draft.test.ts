import {describe,it,expect} from 'vitest';
import {
  prepareRewardJournal,migrateD064EconomyDraft,
  d064DraftConvertLegacyXp,D064_EXPERIMENTAL_ECONOMY_VERSION,
  xpThreshold,d064DraftXpThreshold,applyRegionalBattleDraft,d064DraftBattleReward
} from '../src/index.js';

const source=()=>({
  version:1,mode:'normal',name:'Kanto',coins:444,wins:9,losses:1,
  trainer:{level:10,xp:Math.floor(xpThreshold('trainer',10)/2),manual:{}},
  roster:[
    {uid:1,pokemonId:4,level:15,xp:Math.floor(xpThreshold('pokemon',15)/2),affinity:20,manual:{},moveName:'scratch',upgrades:{}},
    {uid:2,pokemonId:16,level:100,xp:0,affinity:99,manual:{},moveName:'tackle',upgrades:{}}
  ],team:[1,2],nextUid:3,badges:[],seen:[4,16],
  expedition:{startedAt:1000,lastClaimAt:2000,teamUids:[1]},
  lastClaim:{coins:7,cycles:1},ballPocket:{version:1,quantities:{'poke-ball':4}},
  extra:{source:'unchanged'}
});
function journal(value:Record<string,unknown>=source()){
  const j=prepareRewardJournal(JSON.stringify(value));
  if(!j)throw Error('Fixture inválida');
  return j;
}
const cmd={id:'d064-economy-migration',expectedRevision:0};

describe('D-064P — migração de XP sem perder níveis existentes',()=>{
  it('preserva todos os níveis, moedas, equipe, Poké Bolas e Expedição antiga',()=>{
    const original=journal();
    const changed=migrateD064EconomyDraft(original,cmd);
    expect(changed.status).toBe('applied');
    if(changed.status!=='applied')return;
    const initial=JSON.parse(original.raw);
    const updated=JSON.parse(changed.journal.raw);
    expect(updated.economyVersion).toBe(D064_EXPERIMENTAL_ECONOMY_VERSION);
    expect(updated.trainer.level).toBe(10);
    expect(updated.roster.map((p:{level:number})=>p.level)).toEqual([15,100]);
    expect(updated.roster[1].xp).toBe(0);
    expect(updated.coins).toBe(initial.coins);
    expect(updated.ballPocket).toEqual(initial.ballPocket);
    expect(updated.expedition).toEqual(initial.expedition);
    expect(updated.extra).toEqual(initial.extra);
    expect(updated.trainer.xp).toBe(d064DraftConvertLegacyXp('trainer',10,initial.trainer.xp));
    expect(updated.roster[0].xp).toBe(d064DraftConvertLegacyXp('pokemon',15,initial.roster[0].xp));
    const second=migrateD064EconomyDraft(changed.journal,cmd);
    expect(second.status).toBe('duplicate');
    expect(second.journal).toBe(changed.journal);
    expect(migrateD064EconomyDraft(changed.journal,{
      id:'another-attempt',expectedRevision:1
    }).status).toBe('rejected');
    expect(original.raw).toContain('"coins":444');
  });
  it('a fração de progresso de XP fica próxima à fração anterior, sem subir de nível',()=>{
    for(const kind of ['trainer','pokemon'] as const){
      for(const level of [1,5,10,25,50,75,99]){
        const previous=xpThreshold(kind,level);
        const newer=d064DraftXpThreshold(kind,level)!;
        for(const fraction of [0,0.1,0.5,0.9,0.999]){
          const xp=Math.floor((previous-1)*fraction);
          const converted=d064DraftConvertLegacyXp(kind,level,xp)!;
          expect(converted).toBeGreaterThanOrEqual(0);
          expect(converted).toBeLessThan(newer);
          // Arredondamento para baixo perde no máximo 1 XP do novo limiar.
          expect(Math.abs(converted/newer-xp/previous)).toBeLessThanOrEqual(1/newer);
        }
      }
    }
    expect(d064DraftConvertLegacyXp('trainer',100,0)).toBe(0);
    expect(d064DraftConvertLegacyXp('trainer',100,4)).toBeNull();
  });
  it('comando stale, XP inválido e marcadores existentes são rejeitados sem write',()=>{
    const initial=journal();
    expect(migrateD064EconomyDraft(initial,{id:'stale',expectedRevision:5}).status).toBe('rejected');
    const invalid=source();
    invalid.trainer.xp=xpThreshold('trainer',10);
    expect(migrateD064EconomyDraft(journal(invalid),cmd).status).toBe('rejected');
    const tagged=journal({...source(),economyVersion:D064_EXPERIMENTAL_ECONOMY_VERSION});
    expect(migrateD064EconomyDraft(tagged,cmd).status).toBe('rejected');
    expect(initial.revision).toBe(0);
  });
  it('após migração, recompensa regional usa curva nova e recibo separado',()=>{
    const first=migrateD064EconomyDraft(journal(),cmd);
    expect(first.status).toBe('applied');
    if(first.status!=='applied')return;
    const original=JSON.parse(first.journal.raw);
    const battle=applyRegionalBattleDraft(first.journal,{
      id:'regional-after-migration',expectedRevision:1,
      regionId:1,seed:2,activeUid:1,outcome:'win',affinityGain:3
    });
    expect(battle.status).toBe('applied');
    if(battle.status!=='applied')return;
    const updated=JSON.parse(battle.journal.raw);
    const reward=d064DraftBattleReward(10)!;
    expect(updated.coins).toBe(original.coins+reward.coins);
    expect(updated.economyVersion).toBe(D064_EXPERIMENTAL_ECONOMY_VERSION);
    expect(updated.trainer.level).toBe(original.trainer.level);
    expect(updated.trainer.xp).toBe(original.trainer.xp+reward.trainerXp);
    expect(updated.roster[0].level).toBe(original.roster[0].level);
    expect(updated.roster[0].xp).toBe(original.roster[0].xp+reward.pokemonXp);
    expect(updated.ballPocket).toEqual(original.ballPocket);
    expect(updated.expedition).toEqual(original.expedition);
    expect(battle.journal.receipts).toHaveLength(2);
    expect(applyRegionalBattleDraft(battle.journal,{
      id:'regional-after-migration',expectedRevision:1,
      regionId:1,seed:2,activeUid:1,outcome:'win',affinityGain:3
    }).status).toBe('duplicate');
  });
  it('migração não altera os resultados da Arena antiga; economia ainda é hipotética',()=>{
    const initial=journal();
    const converted=migrateD064EconomyDraft(initial,cmd);
    expect(converted.status).toBe('applied');
    if(converted.status!=='applied')return;
    const before=converted.journal.raw;
    // Apenas a migração foi aplicada; nenhum evento de batalha implícito.
    expect(JSON.parse(before).wins).toBe(9);
    expect(JSON.parse(before).roster).toHaveLength(2);
    expect(initial.raw).not.toBe(before);
  });
});
