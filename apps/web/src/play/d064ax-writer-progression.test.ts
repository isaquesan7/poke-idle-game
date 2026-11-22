/** D064AX: trilhas REAIS dos writers v0.2, sem grants ou alteração de gameplay. */
import {describe,expect,it} from 'vitest';
import {
  createPlaySave,readPlaySave,updatePlaySave,PLAY_SAVE_KEY
} from './playSave.js';

class MemoryStorage {
  private readonly data=new Map<string,string>();
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,value);}
  removeItem(key:string){this.data.delete(key);}
}
type Game=Record<string,any>;
const game=(store:MemoryStorage):Game=>{
  const snapshot=readPlaySave(store);
  if(snapshot.status!=='ready')throw Error('save missing');
  return JSON.parse(snapshot.snapshot.journal.raw) as Game;
};
const version=(store:MemoryStorage):number=>{
  const saved=readPlaySave(store);
  if(saved.status!=='ready')throw Error('save missing');
  return saved.snapshot.revision;
};
function act(store:MemoryStorage,action:Parameters<typeof updatePlaySave>[2]){
  return updatePlaySave(store,version(store),action);
}
const seed=(starter:number,i:number)=>
  (Math.imul(starter+1,0x9e3779b9)^Math.imul(i+1,0x85ebca6b))>>>0;

describe('D064AY — nível inicial real',()=>{
  it.each([1,4,7])('inicial #%i começa no nível 1 no modo normal',starter=>{
    const store=new MemoryStorage();
    const created=createPlaySave(store,'Novo treinador',starter,1000,false);
    expect(created.status).toBe('ok');
    const first=game(store);
    expect(first.trainer.level).toBe(1);
    expect(first.roster).toHaveLength(1);
    expect(first.roster[0]).toMatchObject({
      uid:1,pokemonId:starter,level:1,xp:0,affinity:0
    });
    expect(first.team).toEqual([1]);
    expect(version(store)).toBe(0);
    // Salvar o perfil não deve ser confundido com migrar jogadores antigos.
    expect(readPlaySave(store).status).toBe('ready');
    expect(act(store,{type:'evolution',uid:1,targetSpeciesId:
      starter===1?2:starter===4?5:8}).status).toBe('blocked');
    expect(version(store)).toBe(0);
  });
  it('modo demonstração permanece explicitamente no nível 20',()=>{
    const store=new MemoryStorage();
    expect(createPlaySave(store,'Teste rápido',7,1000,true).status).toBe('ok');
    expect(game(store).roster[0].level).toBe(20);
    expect(game(store).trainer.level).toBe(21);
  });
});

describe('D064AX — progressão e IA por writer real',()=>{
  it.each([[1,2],[4,5],[7,8]] as const)(
    'starter %i: evolução válida sem criar UID ou XP, treinamento e encontros com recibo',
    (starter,evolution)=>{
      const store=new MemoryStorage();
      expect(createPlaySave(store,'Auditoria',starter,1000,true).status).toBe('ok');
      const initial=game(store);
      const first=initial.roster[0]!;
      expect(first.level).toBe(20);
      expect(first.pokemonId).toBe(starter);
      expect(first.uid).toBe(1);
      expect(game(store).roster).toHaveLength(1);
      // Limite real do writer. A evolução depende do nível do UID no save,
      // jamais de um estágio fornecido pelo teste.
      const bad=act(store,{type:'evolution',uid:1,targetSpeciesId:150});
      expect(bad.status).toBe('blocked');
      expect(version(store)).toBe(0);
      const evolved=act(store,{type:'evolution',uid:1,targetSpeciesId:evolution});
      expect(evolved.status).toBe('ok');
      const after=game(store).roster[0]!;
      expect(after.uid).toBe(first.uid);
      expect(after.level).toBe(first.level);
      expect(after.xp).toBe(first.xp);
      expect(after.affinity).toBe(first.affinity);
      expect(after.pokemonId).toBe(evolution);
      expect(game(store).team).toEqual([1]);
      expect(act(store,{type:'trainer-invest-batch',increments:{hp:2,defense:2}}).status)
        .toBe('ok');
      expect(act(store,{type:'pokemon-invest-batch',uid:1,increments:{hp:2}}).status)
        .toBe('ok');
      expect(game(store).trainer.manual.hp).toBe(2);
      expect(game(store).roster[0].manual.hp).toBe(2);
      // Batalhas regionais do mesmo sistema publicado; vitórias podem variar.
      // Cada tentativa mantém receipt único, mesmo se for derrota.
      let wins=0;
      for(let i=0;i<12;i++){
        const before=game(store);
        const beforeVersion=version(store);
        const result=act(store,{type:'regional-battle',regionId:1,
          seed:seed(starter,i),ballId:null});
        expect(result.status).toBe('ok');
        const next=game(store);
        expect(version(store)).toBe(beforeVersion+1);
        expect(next.roster[0].uid).toBe(1);
        expect(next.team).toEqual([1]);
        expect(next.lastBattle.regionId).toBe(1);
        expect(next.lastBattle.log).toHaveLength(next.lastBattle.frames.length);
        expect(next.lastBattle.playerSpeciesId).toBe(evolution);
        expect(next.lastBattle.wildSpeciesId).toBeGreaterThanOrEqual(1);
        expect(next.roster[0].level).toBeGreaterThanOrEqual(before.roster[0].level);
        expect(next.trainer.level).toBeGreaterThanOrEqual(before.trainer.level);
        if(next.lastBattle.outcome==='win')wins++;
        expect(readPlaySave(store).status).toBe('ready');
      }
      const final=game(store);
      expect(final.roster[0].pokemonId).toBe(evolution);
      expect(final.roster[0].uid).toBe(1);
      expect(final.roster).toHaveLength(1);
      expect(final.regionWins[0]).toBe(wins);
      const saved=readPlaySave(store);
      expect(saved.status).toBe('ready');
      if(saved.status==='ready'){
        expect(saved.snapshot.journal.receipts).toHaveLength(saved.snapshot.journal.revision);
        expect(saved.snapshot.revision).toBe(15);
        expect(store.getItem(PLAY_SAVE_KEY)).not.toBeNull();
      }
      const blocked=updatePlaySave(store,0,{type:'regional-battle',seed:1,regionId:1});
      expect(blocked.status).toBe('blocked');
      expect(version(store)).toBe(15);
    }
  );
  it('sem modo demo, não concede evolução nem acesso regional antecipado',()=>{
    const store=new MemoryStorage();
    expect(createPlaySave(store,'Normal',1,1000,false).status).toBe('ok');
    const g=game(store);
    expect(g.roster[0].level).toBe(1);
    expect(g.trainer.level).toBe(1);
    expect(act(store,{type:'evolution',uid:1,targetSpeciesId:2}).status).toBe('blocked');
    expect(act(store,{type:'regional-battle',seed:1,regionId:9}).status).toBe('blocked');
    expect(version(store)).toBe(0);
    const result=act(store,{type:'regional-battle',seed:seed(1,0),regionId:1,ballId:null});
    expect(result.status).toBe('ok');
    expect(version(store)).toBe(1);
    const next=game(store);
    expect(next.roster[0].uid).toBe(1);
    expect(next.lastBattle.regionId).toBe(1);
    expect(next.lastBattle.frames).toHaveLength(next.lastBattle.log.length);
    expect(next.regionWins[8]).toBe(0);
  });
});
