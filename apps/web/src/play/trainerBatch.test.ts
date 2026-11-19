/** D-050 — pontos de treinador são confirmados em UM commit; sem escrita na prévia. */
import {describe,it,expect} from 'vitest';
import {
  PLAY_SAVE_KEY,createPlaySave,readPlaySave,updatePlaySave
} from './playSave';
import type {PlayStorage} from './playSave';

function makeStorage(){
  const map=new Map<string,string>();
  const storage:PlayStorage={
    getItem:(key)=>map.get(key)??null,
    setItem:(key,value)=>{map.set(key,value);},
    removeItem:(key)=>{map.delete(key);}
  };
  const created=createPlaySave(storage,'Treinador Teste',1,1000,true);
  if(created.status!=='ok')throw Error('save inicial inesperado');
  return {storage,map};
}
describe('D050 — prévia segura e commit atômico de atributos',()=>{
  it('confirma um lote em UMA revisão e preserva os demais dados',()=>{
    const {storage,map}=makeStorage();
    const before=map.get(PLAY_SAVE_KEY)!;
    const original=JSON.parse(before);
    expect(original.revision).toBe(0);
    const result=updatePlaySave(storage,0,{
      type:'trainer-invest-batch',
      increments:{hp:2,attack:3}
    });
    expect(result.status).toBe('ok');
    const after=JSON.parse(map.get(PLAY_SAVE_KEY)!);
    const game=JSON.parse(after.journal.raw);
    expect(after.revision).toBe(1);
    expect(game.trainer.manual.hp).toBe(2);
    expect(game.trainer.manual.attack).toBe(3);
    expect(game.coins).toBe(JSON.parse(original.journal.raw).coins);
    expect(game.roster).toEqual(JSON.parse(original.journal.raw).roster);
    expect(readPlaySave(storage).status).toBe('ready');
  });
  it('rejeita erro no último ponto sem consumos parciais',()=>{
    const {storage,map}=makeStorage();
    const before=map.get(PLAY_SAVE_KEY)!;
    const response=updatePlaySave(storage,0,{
      type:'trainer-invest-batch',increments:{hp:40,attack:1}
    });
    expect(response.status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).toBe(before);
  });
  it('rejeita lote vazio, valores negativos, fracionários e revisão velha',()=>{
    const invalid=[{}, {hp:0}, {hp:-1}, {hp:1.5}, {hp:41}];
    for(const increments of invalid){
      const {storage,map}=makeStorage(),before=map.get(PLAY_SAVE_KEY);
      expect(updatePlaySave(storage,0,{
        type:'trainer-invest-batch',increments
      }).status).toBe('blocked');
      expect(map.get(PLAY_SAVE_KEY)).toBe(before);
    }
    const {storage}=makeStorage();
    expect(updatePlaySave(storage,99,{
      type:'trainer-invest-batch',increments:{hp:1}
    }).status).toBe('blocked');
  });
});


describe('D-051 — título ativo no writer versionado',()=>{
  it('rejeita título ainda bloqueado sem alterar um byte do save',()=>{
    const {storage,map}=makeStorage();
    const before=map.get(PLAY_SAVE_KEY)!;
    const result=updatePlaySave(storage,0,{type:'trainer',value:{type:'title',titleId:'mestre'}});
    expect(result.status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).toBe(before);
  });
  it('persiste título desbloqueado em uma revisão e preserva recompensas',()=>{
    const {storage,map}=makeStorage();
    const snapshot=JSON.parse(map.get(PLAY_SAVE_KEY)!);
    const game=JSON.parse(snapshot.journal.raw);
    game.wins=4; // fixture de elegibilidade; sem gerar recompensas reais
    snapshot.journal.raw=JSON.stringify(game);
    map.set(PLAY_SAVE_KEY,JSON.stringify(snapshot));
    const result=updatePlaySave(storage,0,{type:'trainer',value:{type:'title',titleId:'veterano'}});
    expect(result.status).toBe('ok');
    const saved=readPlaySave(storage);
    expect(saved.status).toBe('ready');
    if(saved.status!=='ready')return;
    expect(saved.snapshot.revision).toBe(1);
    const next=JSON.parse(saved.snapshot.journal.raw);
    expect(next.trainer.title).toBe('veterano');
    expect(next.coins).toBe(game.coins);
    expect(next.wins).toBe(4);
    expect(next.roster).toEqual(game.roster);
    expect(updatePlaySave(storage,0,{type:'trainer',value:{type:'title',titleId:'aprendiz'}}).status).toBe('blocked');
  });
});
