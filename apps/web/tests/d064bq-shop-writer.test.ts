import {describe,expect,it} from 'vitest';
import {createPlaySave,readPlaySave,updatePlaySave,PLAY_SAVE_KEY} from '../src/play/playSave.js';

function store(){
  const db=new Map<string,string>();
  return {
    getItem:(k:string)=>db.get(k)??null,
    setItem:(k:string,v:string)=>{db.set(k,v);},
    removeItem:(k:string)=>{db.delete(k);}
  };
}
type Storage=ReturnType<typeof store>;
function fixture(storage:Storage,coins=10000,level=55){
  const init=createPlaySave(storage,'Comprador Teste',1,12345,true);
  expect(init.status).toBe('ok');
  if(init.status!=='ok')throw Error('fixture failed');
  const game=JSON.parse(init.snapshot.journal.raw);
  game.coins=coins;
  game.trainer.level=level;
  storage.setItem(PLAY_SAVE_KEY,JSON.stringify({
    ...init.snapshot,journal:{...init.snapshot.journal,raw:JSON.stringify(game)}
  }));
}
const contents=(s:Storage)=>{
  const snapshot=readPlaySave(s);
  if(snapshot.status!=='ready')throw Error('invalid storage');
  return{snapshot:snapshot.snapshot,game:JSON.parse(snapshot.snapshot.journal.raw)};
};
describe('D064BQ: checkout Pokébola com moeda+estoque e receipt atômicos',()=>{
  it('compra no writer REAL, recibo único e preço calculado pelo core, não pelo cliente',()=>{
    const s=store();fixture(s,10000,55);
    const result=updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'shop-v1-unique-1',ballId:'poke-ball',
      quantity:5,unitPrice:1
    });
    expect(result.status).toBe('ok');
    const {snapshot,game}=contents(s);
    expect(snapshot.revision).toBe(1);
    expect(snapshot.journal.revision).toBe(1);
    expect(snapshot.journal.receipts).toHaveLength(1);
    expect(snapshot.journal.receipts[0]?.id).toBe('shop-v1-unique-1');
    expect(game.coins).toBe(7000);
    expect(game.ballPocket.quantities['poke-ball']).toBe(17);
    expect(game.lastShopPurchase).toMatchObject({
      id:'shop-v1-unique-1',ballId:'poke-ball',quantity:5,cost:3000,priceVersion:1
    });
    const exact=JSON.stringify(snapshot);
    expect(updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'shop-v1-unique-1',ballId:'poke-ball',quantity:5
    }).status).toBe('blocked');
    expect(updatePlaySave(s,1,{
      type:'buy-ball',purchaseId:'shop-v1-unique-1',ballId:'poke-ball',quantity:5
    }).status).toBe('blocked');
    expect(JSON.stringify(contents(s).snapshot)).toBe(exact);
  });
  it('só compra Great no nível 20 e Ultra no 55; preços beta e limites são do catálogo',()=>{
    const s=store();fixture(s,25000,19);
    expect(updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'a',ballId:'great-ball',quantity:1
    }).status).toBe('blocked');
    expect(updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'b',ballId:'ultra-ball',quantity:1
    }).status).toBe('blocked');
    const current=contents(s);
    const game=current.game;game.trainer.level=20;
    s.setItem(PLAY_SAVE_KEY,JSON.stringify({...current.snapshot,
      journal:{...current.snapshot.journal,raw:JSON.stringify(game)}}));
    const great=updatePlaySave(s,0,{type:'buy-ball',purchaseId:'c',ballId:'great-ball',quantity:2});
    expect(great.status).toBe('ok');
    expect(contents(s).game.coins).toBe(20200);
    expect(contents(s).game.ballPocket.quantities['great-ball']).toBe(2);
    expect(updatePlaySave(s,1,{
      type:'buy-ball',purchaseId:'d',ballId:'ultra-ball',quantity:1
    }).status).toBe('blocked');
    const current2=contents(s);
    current2.game.trainer.level=55;
    s.setItem(PLAY_SAVE_KEY,JSON.stringify({...current2.snapshot,
      journal:{...current2.snapshot.journal,raw:JSON.stringify(current2.game)}}));
    const ultra=updatePlaySave(s,1,{
      type:'buy-ball',purchaseId:'e',ballId:'ultra-ball',quantity:1
    });
    expect(ultra.status).toBe('ok');
    expect(contents(s).game.coins).toBe(4200);
    expect(contents(s).game.ballPocket.quantities['ultra-ball']).toBe(1);
  });
  it('rejeita Master, preços forjados, valor insuficiente, quantidade e cap sem tocar save',()=>{
    const s=store();fixture(s,200,55);
    const blocked=[
      {type:'buy-ball' as const,purchaseId:'a',ballId:'poke-ball',quantity:1},
      {type:'buy-ball' as const,purchaseId:'b',ballId:'master-ball',quantity:1},
      {type:'buy-ball' as const,purchaseId:'c',ballId:'__proto__',quantity:1},
      {type:'buy-ball' as const,purchaseId:'d',ballId:'great-ball',quantity:26},
      {type:'buy-ball' as const,purchaseId:'e',ballId:'poke-ball',quantity:0},
      {type:'buy-ball' as const,purchaseId:'f',ballId:'poke-ball',quantity:1.2},
    ];
    const before=s.getItem(PLAY_SAVE_KEY);
    for(const act of blocked){
      expect(updatePlaySave(s,0,act).status).toBe('blocked');
      expect(s.getItem(PLAY_SAVE_KEY)).toBe(before);
    }
    const snap=contents(s);
    snap.game.coins=10000;
    snap.game.ballPocket.quantities['poke-ball']=100000;
    s.setItem(PLAY_SAVE_KEY,JSON.stringify({...snap.snapshot,
      journal:{...snap.snapshot.journal,raw:JSON.stringify(snap.game)}}));
    const full=s.getItem(PLAY_SAVE_KEY);
    expect(updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'g',ballId:'poke-ball',quantity:1
    }).status).toBe('blocked');
    expect(s.getItem(PLAY_SAVE_KEY)).toBe(full);
  });
  it('concorrência multiaba: revisão obsoleta falha e segunda compra usa novo recibo',()=>{
    const s=store();fixture(s,5000,55);
    const tabA=updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'tab-a',ballId:'poke-ball',quantity:1
    });
    const tabB=updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'tab-b',ballId:'poke-ball',quantity:1
    });
    expect(tabA.status).toBe('ok');
    expect(tabB.status).toBe('blocked');
    expect(contents(s).game.coins).toBe(4400);
    expect(contents(s).game.ballPocket.quantities['poke-ball']).toBe(13);
    const next=updatePlaySave(s,1,{
      type:'buy-ball',purchaseId:'tab-b',ballId:'poke-ball',quantity:1
    });
    expect(next.status).toBe('ok');
    expect(contents(s).game.coins).toBe(3800);
    expect(contents(s).snapshot.journal.receipts.map((r:{id:string})=>r.id))
      .toEqual(['tab-a','tab-b']);
    expect(readPlaySave(s).status).toBe('ready');
  });
  it('não compra durante replay pendente',()=>{
    const s=store();fixture(s);
    const snap=contents(s);
    snap.game.pendingBattle={
      battleId:'regional-v02-1',seed:0,regionId:1
    };
    s.setItem(PLAY_SAVE_KEY,JSON.stringify({...snap.snapshot,
      journal:{...snap.snapshot.journal,raw:JSON.stringify(snap.game)}}));
    const before=s.getItem(PLAY_SAVE_KEY);
    expect(updatePlaySave(s,0,{
      type:'buy-ball',purchaseId:'during',ballId:'poke-ball',quantity:1
    }).status).toBe('blocked');
    expect(s.getItem(PLAY_SAVE_KEY)).toBe(before);
  });
});
