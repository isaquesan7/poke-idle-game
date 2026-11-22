import {d064DraftBallDrop} from '@kanto/game-core';
import {describe,expect,it} from 'vitest';
import {
  createPlaySave,PLAY_SAVE_KEY,readPlaySave,updatePlaySave
} from '../src/play/playSave.js';

function store(){
  const data=new Map<string,string>();
  return {
    getItem:(key:string)=>data.get(key)??null,
    setItem:(key:string,value:string)=>{data.set(key,value);},
    removeItem:(key:string)=>{data.delete(key);}
  };
}

/** D064BQ: usar o writer real de batalha para validar sorteio
 * por seed + encontro e recibo, nunca por número fixo de vitórias.
 * Progresso avançado nos testes apenas; não altera o jogo publicado.
 */
describe('D064BQ — drops aleatórios no writer jogável',()=>{
  it('15ª vitória em R7 NÃO garante Ultra: resultado depende do seed e do encontro',()=>{
    const storage=store();
    const initial=createPlaySave(storage,'Auditoria Ultra',7,100_000);
    expect(initial.status).toBe('ok');
    if(initial.status!=='ok')return;
    const game=JSON.parse(initial.snapshot.journal.raw);
    game.trainer.level=55; // R7 exige treinador Lv55
    game.roster[0].pokemonId=9; // Blastoise como exemplo de save avançado
    game.roster[0].level=69;
    game.roster[0].moveName='water-gun';
    game.regionWins[6]=14; // não é mais marco fixo de Ultra
    game.ballPocket={version:1,quantities:{
      'poke-ball':12,'great-ball':0,'ultra-ball':0
    }};
    const fixture={...initial.snapshot,journal:{
      ...initial.snapshot.journal,raw:JSON.stringify(game)
    }};
    storage.setItem(PLAY_SAVE_KEY,JSON.stringify(fixture));
    const result=updatePlaySave(storage,0,{
      type:'regional-battle',regionId:7,seed:0,ballId:null
    });
    expect(result.status).toBe('ok');
    if(result.status!=='ok')return;
    const saved=JSON.parse(result.snapshot.journal.raw);
    expect(saved.lastBattle.outcome).toBe('win');
    expect(saved.lastBattle.regionId).toBe(7);
    expect(saved.regionWins[6]).toBe(15);
    expect(saved.wins).toBe(1);
    const rolled=d064DraftBallDrop(7,0,'regional-v02-1')!;
    expect(saved.lastBattle.ballDrops).toEqual(rolled);
    expect(saved.ballPocket.quantities).toMatchObject({
      'poke-ball':12+rolled['poke-ball'],
      'great-ball':rolled['great-ball'],
      'ultra-ball':rolled['ultra-ball']
    });
    expect(saved.coins).toBeGreaterThan(game.coins);
    expect(result.snapshot.journal.receipts).toHaveLength(1);
    const stale=updatePlaySave(storage,0,{
      type:'regional-battle',regionId:7,seed:0,ballId:null
    });
    expect(stale.status).toBe('blocked');
    const reread=readPlaySave(storage);
    expect(reread.status).toBe('ready');
    if(reread.status==='ready')expect(reread.snapshot).toEqual(result.snapshot);
  });
  it('100 mil vitórias regionais saturam sem corromper o save nem impedir novo combate',()=>{
    const storage=store();
    const initial=createPlaySave(storage,'Teto Regional',7,100_000);
    expect(initial.status).toBe('ok');
    if(initial.status!=='ok')return;
    const game=JSON.parse(initial.snapshot.journal.raw);
    game.trainer.level=55;
    game.roster[0].pokemonId=9;
    game.roster[0].level=69;
    game.roster[0].moveName='water-gun';
    game.regionWins[6]=100000;
    game.ballPocket={version:1,quantities:{
      'poke-ball':12,'great-ball':3,'ultra-ball':0
    }};
    storage.setItem(PLAY_SAVE_KEY,JSON.stringify({
      ...initial.snapshot,journal:{
        ...initial.snapshot.journal,raw:JSON.stringify(game)
      }
    }));
    const totals={'poke-ball':12,'great-ball':3,'ultra-ball':0};
    for(let revision=0;revision<2;revision++){
      const result=updatePlaySave(storage,revision,{
        type:'regional-battle',regionId:7,seed:0,ballId:null
      });
      expect(result.status).toBe('ok');
      if(result.status!=='ok')return;
      const saved=JSON.parse(result.snapshot.journal.raw);
      expect(saved.lastBattle.outcome).toBe('win');
      expect(saved.regionWins[6]).toBe(100000);
      expect(saved.wins).toBe(revision+1);
      expect(saved.coins).toBeGreaterThan(game.coins);
      const rolled=d064DraftBallDrop(7,0,'regional-v02-'+(revision+1))!;
      for(const id of ['poke-ball','great-ball','ultra-ball'] as const)
        totals[id]+=rolled[id];
      expect(saved.lastBattle.ballDrops).toEqual(rolled);
      expect(saved.ballPocket.quantities).toMatchObject(totals);
      expect(result.snapshot.journal.receipts).toHaveLength(revision+1);
      expect(readPlaySave(storage).status).toBe('ready');
    }
  });
});
