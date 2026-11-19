import {describe,it,expect} from 'vitest';
import {
  planLegacyEquipmentMigration,applyAuthorizedInventoryGrant
} from '../src/inventory/transactions.js';
import type {InventoryGrantJournal} from '../src/inventory/transactions.js';

const raw=JSON.stringify({
  version:1,trainer:{level:1,xp:0,manual:{},title:'aprendiz',equipped:{hat:'cap',ring1:'ring-a'}},
  coins:123,wins:2,roster:[{uid:1,pokemonId:1}],badges:['boulder'],
  evolutionStones:{'fire-stone':3}
});
function ready():InventoryGrantJournal{
  const migration=planLegacyEquipmentMigration(raw);
  if(migration.status!=='ready')throw Error('Migração de teste inválida');
  return{raw:migration.raw,revision:0,receipts:[]};
}
describe('D-054 — plano explícito de migração, sem concessão automática',()=>{
  it('garante somente itens já equipados, conserva progresso e não altera origem',()=>{
    const migration=planLegacyEquipmentMigration(raw);
    expect(migration.status).toBe('ready');
    if(migration.status!=='ready')return;
    expect(migration.equippedIds).toEqual(['cap','ring-a']);
    const after=JSON.parse(migration.raw);
    expect(after.inventory).toEqual({version:1,ownedEquipment:{cap:1,'ring-a':1},extraBagSlots:0});
    expect(after.trainer).toEqual(JSON.parse(raw).trainer);
    expect(after.coins).toBe(123);
    expect(after.roster).toEqual(JSON.parse(raw).roster);
    expect(after.evolutionStones).toEqual({'fire-stone':3});
    expect(JSON.parse(raw).inventory).toBeUndefined();
    expect(planLegacyEquipmentMigration(migration.raw).status).toBe('already-migrated');
  });
  it('falha fechado para equipamento incompatível, forjado, ledger corrompido',()=>{
    for(const equipped of [{hat:'gloves'},{hat:'forged'},{random:'cap'},{hat:14}]){
      const test=JSON.stringify({...JSON.parse(raw),trainer:{...JSON.parse(raw).trainer,equipped}});
      expect(planLegacyEquipmentMigration(test).status).toBe('invalid');
    }
    expect(planLegacyEquipmentMigration(JSON.stringify({...JSON.parse(raw),inventory:{version:2}})).status).toBe('invalid');
  });
});
describe('D-054 — motor de grant offline, idempotente e sem integração com UI',()=>{
  it('aplica equipamento em uma revisão; repetir mesmo ID não duplica',()=>{
    const before=ready();
    const grant={kind:'equipment' as const,source:'shop' as const,eventId:'shop:example.1',itemId:'gloves',count:1};
    const applied=applyAuthorizedInventoryGrant(before,0,grant);
    expect(applied.status).toBe('applied');
    if(applied.status!=='applied')return;
    expect(applied.journal.revision).toBe(1);
    expect(applied.journal.receipts).toHaveLength(1);
    const next=JSON.parse(applied.journal.raw);
    expect(next.inventory.ownedEquipment).toEqual({cap:1,'ring-a':1,gloves:1});
    expect(next.coins).toBe(123);
    expect(next.trainer).toEqual(JSON.parse(before.raw).trainer);
    expect(next.evolutionStones).toEqual({'fire-stone':3});
    const replay=applyAuthorizedInventoryGrant(applied.journal,0,grant);
    expect(replay.status).toBe('duplicate');
    expect(replay.journal).toBe(applied.journal);
    const conflict=applyAuthorizedInventoryGrant(applied.journal,1,{...grant,count:2});
    expect(conflict.status).toBe('rejected');
    expect(conflict.journal).toBe(applied.journal);
  });
  it('aplica expansão futura de slots sem conceder item mágico',()=>{
    const before=ready();
    const result=applyAuthorizedInventoryGrant(before,0,{kind:'bag-capacity',source:'shop',eventId:'authorized:test.2',slots:5});
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    const after=JSON.parse(result.journal.raw);
    expect(after.inventory.extraBagSlots).toBe(5);
    expect(after.inventory.ownedEquipment).toEqual({cap:1,'ring-a':1});
    expect(after.coins).toBe(123);
  });
  it('bloqueia revisão velha, excesso de estoque, IDs forjados e saves legados',()=>{
    const before=ready();
    const invalid=[
      {kind:'equipment' as const,source:'shop' as const,eventId:'invalid.1',itemId:'made-up',count:1},
      {kind:'equipment' as const,source:'shop' as const,eventId:'invalid.2',itemId:'cap',count:100},
      {kind:'equipment' as const,source:'shop' as const,eventId:'invalid.3',itemId:'cap',count:0},
      {kind:'bag-capacity' as const,source:'shop' as const,eventId:'invalid.4',slots:1001},
      {kind:'bag-capacity' as const,source:'shop' as const,eventId:'invalid.5',slots:-1}
    ];
    for(const grant of invalid){
      const result=applyAuthorizedInventoryGrant(before,0,grant);
      expect(result.status).toBe('rejected');
      expect(result.journal).toBe(before);
    }
    expect(applyAuthorizedInventoryGrant(before,1,{kind:'equipment',source:'shop',eventId:'ok.1',itemId:'cap',count:1}).status).toBe('rejected');
    expect(applyAuthorizedInventoryGrant({raw,revision:0,receipts:[]},0,
      {kind:'equipment',source:'shop',eventId:'ok.2',itemId:'cap',count:1}).status).toBe('rejected');
  });
  it('permite as três origens de equipamento no laboratório, sem atestar drops ou receitas reais',()=>{
    for(const source of ['shop','drop','craft'] as const){
      const before=ready();
      const grant={kind:'equipment' as const,source,eventId:'example:'+source,itemId:'gloves',count:1};
      const result=applyAuthorizedInventoryGrant(before,0,grant);
      expect(result.status).toBe('applied');
      // A fonte é registrada no recibo; autorizar o evento é obrigação do futuro writer.
      if(result.status==='applied')
        expect(result.journal.receipts[0]?.payload).toContain(source);
    }
  });
  it('expansão é exclusiva da Loja; fonte falsa bloqueia todas as categorias',()=>{
    const before=ready();
    for(const source of ['drop','craft','quest',undefined]){
      const result=applyAuthorizedInventoryGrant(before,0,{
        kind:'bag-capacity',source,eventId:'wrong.capacity',slots:5
      } as never);
      expect(result.status).toBe('rejected');
      expect(result.journal).toBe(before);
    }
    for(const source of ['quest',undefined]){
      const result=applyAuthorizedInventoryGrant(before,0,{
        kind:'equipment',source,eventId:'wrong.equip',itemId:'cap',count:1
      } as never);
      expect(result.status).toBe('rejected');
      expect(result.journal).toBe(before);
    }
  });
  it('impede stack acima do máximo e grants em journals adulterados',()=>{
    const before=ready();
    const full=JSON.parse(before.raw);
    full.inventory.ownedEquipment.cap=99;
    const journal={...before,raw:JSON.stringify(full)};
    expect(applyAuthorizedInventoryGrant(journal,0,{kind:'equipment',source:'shop',eventId:'too.many',itemId:'cap',count:1}).status).toBe('rejected');
    expect(applyAuthorizedInventoryGrant({...journal,receipts:[{eventId:'fake',payload:'x'}]},0,
      {kind:'equipment',source:'shop',eventId:'real',itemId:'cap',count:1}).status).toBe('rejected');
  });
});
