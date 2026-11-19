/** D-056: distribuição Pokémon atomicamente validada por UID e uma revisão. */
import {describe,it,expect} from 'vitest';
import {PLAY_SAVE_KEY,createPlaySave,updatePlaySave,readPlaySave} from './playSave';
import type {PlayStorage} from './playSave';

function fixture(){
  const map=new Map<string,string>();
  const storage:PlayStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>{map.set(key,value);},
    removeItem:key=>{map.delete(key);}
  };
  if(createPlaySave(storage,'Treinador',4,1000,true).status!=='ok')throw Error('Save de teste inválido');
  return{storage,map};
}
describe('D-056 — lote de pontos Pokémon',()=>{
  it('aplica dois atributos de um único UID em uma revisão sem efeitos colaterais',()=>{
    const {storage,map}=fixture();
    const before=JSON.parse(map.get(PLAY_SAVE_KEY)!);
    const result=updatePlaySave(storage,0,{
      type:'pokemon-invest-batch',uid:1,increments:{hp:2,defense:3}
    });
    expect(result.status).toBe('ok');
    const after=JSON.parse(map.get(PLAY_SAVE_KEY)!);
    const oldGame=JSON.parse(before.journal.raw),game=JSON.parse(after.journal.raw);
    expect(after.revision).toBe(1);
    expect(game.roster[0].manual.hp).toBe(2);
    expect(game.roster[0].manual.defense).toBe(3);
    expect(game.coins).toBe(oldGame.coins);
    expect(game.trainer).toEqual(oldGame.trainer);
    expect(game.roster[0].uid).toBe(oldGame.roster[0].uid);
    expect(game.roster[0].level).toBe(oldGame.roster[0].level);
    expect(readPlaySave(storage).status).toBe('ready');
    expect(updatePlaySave(storage,0,{type:'pokemon-invest-batch',uid:1,increments:{speed:1}}).status).toBe('blocked');
  });
  it('falha completamente quando o último incremento excede orçamento',()=>{
    const {storage,map}=fixture(),before=map.get(PLAY_SAVE_KEY);
    expect(updatePlaySave(storage,0,{
      type:'pokemon-invest-batch',uid:1,increments:{hp:20,attack:20}
    }).status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).toBe(before);
  });
  it('rejeita UID falso, lote vazio, números inválidos e revisões obsoletas',()=>{
    const increments=[{}, {hp:0}, {hp:-1}, {hp:1.2}, {hp:199}, {unknown:1}];
    for(const entry of increments){
      const {storage,map}=fixture(),before=map.get(PLAY_SAVE_KEY);
      expect(updatePlaySave(storage,0,{
        type:'pokemon-invest-batch',uid:1,increments:entry as never
      }).status).toBe('blocked');
      expect(map.get(PLAY_SAVE_KEY)).toBe(before);
    }
    const {storage,map}=fixture(),before=map.get(PLAY_SAVE_KEY);
    expect(updatePlaySave(storage,0,{
      type:'pokemon-invest-batch',uid:999,increments:{hp:1}
    }).status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).toBe(before);
    expect(updatePlaySave(storage,3,{
      type:'pokemon-invest-batch',uid:1,increments:{hp:1}
    }).status).toBe('blocked');
  });
});
