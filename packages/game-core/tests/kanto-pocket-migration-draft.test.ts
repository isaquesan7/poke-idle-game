import {describe,it,expect} from 'vitest';
import {prepareRewardJournal,migrateD064PocketDraft} from '../src/index.js';

const origin=()=>({
  version:1,mode:'normal',name:'Legacy',coins:600,wins:10,losses:2,
  trainer:{level:11,xp:12,manual:{}},
  roster:[{uid:1,pokemonId:4,level:5,xp:15,affinity:1,manual:{},moveName:'scratch',upgrades:{}}],
  team:[1],nextUid:2,badges:[],seen:[4],caughtSpecies:[4],
  expedition:{startedAt:0,lastClaimAt:10000,teamUids:[1]},
  lastClaim:{coins:7,trainerXP:4,pokemonXP:5,cycles:1},
  extra:{saveData:'intact'}
});
function fixture(value:Record<string,unknown>=origin()){
  const journal=prepareRewardJournal(JSON.stringify(value));
  if(!journal)throw new Error('Fixture legada inválida');
  return journal;
}
const command=(policy:'legacy-empty'|'starter-proposal'='legacy-empty')=>({
  id:'d064-pocket-migration',expectedRevision:0,policy
});
describe('D-064N — migração de Poké Bolas sem risco para saves antigos',()=>{
  it('preserva XP, moedas, equipe, UID, expedição legada e objetos desconhecidos',()=>{
    const initial=fixture();
    const result=migrateD064PocketDraft(initial,command());
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    const before=JSON.parse(initial.raw);
    const after=JSON.parse(result.journal.raw);
    expect(after.ballPocket).toEqual({version:1,quantities:{}});
    delete after.ballPocket;
    expect(after).toEqual(before);
    expect(result.journal.revision).toBe(1);
    expect(result.journal.receipts).toHaveLength(1);
    expect(initial.revision).toBe(0);
    const duplicate=migrateD064PocketDraft(result.journal,command());
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.journal).toBe(result.journal);
    expect(migrateD064PocketDraft(result.journal,command('starter-proposal')).status).toBe('rejected');
  });
  it('kit de 12 bolas somente se a política explícita autorizar',()=>{
    const initial=fixture();
    const result=migrateD064PocketDraft(initial,command('starter-proposal'));
    expect(result.status).toBe('applied');
    if(result.status==='applied'){
      expect(JSON.parse(result.journal.raw).ballPocket.quantities).toEqual({'poke-ball':12});
      expect(migrateD064PocketDraft(result.journal,{
        id:'outra-tentativa',expectedRevision:1,policy:'starter-proposal'
      }).status).toBe('rejected');
    }
  });
  it('não sobrescreve bolso antigo parcialmente inválido',()=>{
    const previous=origin();
    const invalid=fixture({...previous,ballPocket:{version:1,quantities:{'great-ball':-1}}});
    expect(migrateD064PocketDraft(invalid,command()).status).toBe('rejected');
    const valid=fixture({...previous,ballPocket:{version:1,quantities:{'great-ball':7}}});
    expect(migrateD064PocketDraft(valid,command('starter-proposal')).status).toBe('rejected');
  });
  it('não aceita command stale, política desconhecida ou JSON sem formato',()=>{
    const initial=fixture();
    expect(migrateD064PocketDraft(initial,{
      id:'mig-old',expectedRevision:3,policy:'starter-proposal'
    }).status).toBe('rejected');
    const before=initial.raw;
    expect(migrateD064PocketDraft(initial,{
      id:'mig-unknown',expectedRevision:0,policy:'fake' as 'legacy-empty'
    }).status).toBe('rejected');
    expect(before).toBe(initial.raw);
  });
});
