import { describe, expect, it } from 'vitest';
import {
  PLAY_SAVE_KEY, createPlaySave, readPlaySave, resetPlaySave, updatePlaySave
} from '../src/play/playSave';
import type { PlayStorage } from '../src/play/playSave';

function memory() {
  const map = new Map<string, string>();
  const storage: PlayStorage = {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: key => { map.delete(key); }
  };
  return { map, storage };
}
function current(storage: PlayStorage) {
  const result = readPlaySave(storage);
  if (result.status !== 'ready') throw Error('Save não está pronto');
  return result.snapshot;
}
function state(storage: PlayStorage) {
  return JSON.parse(current(storage).journal.raw) as {
    name: string; mode: string; coins: number;
    trainer: { level: number; xp: number; manual: Record<string, number> };
    roster: Array<{ uid: number; pokemonId: number; level: number; xp: number; manual: Record<string, number> }>;
    expedition: { startedAt: number; lastClaimAt: number } | null
  };
}

describe('primeiro save jogável v0.2, sem dependência da origem legada', () => {
  it('cria treinador e Charmander com schema 2 e save normal separado', () => {
    const { storage, map } = memory();
    map.set('kanto-idle-lab-save-v01', 'legado-intacto');
    expect(readPlaySave(storage).status).toBe('absent');
    expect(createPlaySave(storage, '  Ash  ', 4, 100000).status).toBe('ok');
    expect(current(storage).revision).toBe(0);
    expect(current(storage).journal.revision).toBe(0);
    expect(state(storage).name).toBe('Ash');
    expect(state(storage).trainer.level).toBe(1);
    expect(state(storage).roster[0]?.pokemonId).toBe(4);
    expect(state(storage).roster[0]?.level).toBe(5);
    expect(map.get('kanto-idle-lab-save-v01')).toBe('legado-intacto');
    expect(createPlaySave(storage, 'Outro', 1, 100000).status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).toBeTruthy();
  });

  it('rejeita nome, inicial, tempo e formato desconhecido sem sobrescrever', () => {
    const { storage, map } = memory();
    expect(createPlaySave(storage, 'X', 1, 1000).status).toBe('blocked');
    expect(createPlaySave(storage, 'Ash', 25, 1000).status).toBe('blocked');
    expect(createPlaySave(storage, 'Ash', 1, -1).status).toBe('blocked');
    expect(readPlaySave(storage).status).toBe('absent');
    map.set(PLAY_SAVE_KEY, '{"schemaVersion":3}');
    expect(readPlaySave(storage).status).toBe('invalid');
    expect(createPlaySave(storage, 'Ash', 1, 1000).status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).toBe('{"schemaVersion":3}');
  });

  it('treina Pokémon desde nível 5, respeitando orçamento individual, sem mudar treinador', () => {
    const { storage } = memory();
    createPlaySave(storage, 'Misty', 7, 1000);
    expect(updatePlaySave(storage, 0, {
      type: 'trainer', value: { type: 'invest', stat: 'hp' }
    }).status).toBe('blocked'); // treinador normal nível 1
    for (let i = 0; i < 8; i++) {
      expect(updatePlaySave(storage, i, {
        type: 'pokemon', value: { type: 'invest-pokemon', uid: 1, stat: 'defense' }
      }).status).toBe('ok');
    }
    expect(state(storage).roster[0]?.manual.defense).toBe(8);
    expect(state(storage).trainer.manual.defense).toBe(0);
    expect(updatePlaySave(storage, 8, {
      type: 'pokemon', value: { type: 'invest-pokemon', uid: 1, stat: 'defense' }
    }).status).toBe('blocked');
    expect(updatePlaySave(storage, 8, {
      type: 'pokemon', value: { type: 'reset-pokemon', uid: 1 }
    }).status).toBe('ok');
    expect(state(storage).roster[0]?.manual.defense).toBe(0);
    expect(current(storage).revision).toBe(9);
  });

  it('modo demonstração habilita treino do treinador e mantém teto 40 por atributo', () => {
    const { storage } = memory();
    expect(createPlaySave(storage, 'Red', 1, 1000, true).status).toBe('ok');
    expect(state(storage).trainer.level).toBe(21);
    for (let i = 0; i < 40; i++) {
      expect(updatePlaySave(storage, i, {
        type: 'trainer', value: { type: 'invest', stat: 'attack' }
      }).status).toBe('ok');
    }
    expect(state(storage).trainer.manual.attack).toBe(40);
    expect(updatePlaySave(storage, 40, {
      type: 'trainer', value: { type: 'invest', stat: 'attack' }
    }).status).toBe('blocked');
    expect(current(storage).revision).toBe(40);
  });

  it('expedição recebe 2 ciclos uma vez, rejeita claim repetido e permite encerrar', () => {
    const { storage } = memory();
    createPlaySave(storage, 'Blue', 1, 1000);
    expect(updatePlaySave(storage, 0, {type:'start-expedition', nowMs:100000}).status).toBe('ok');
    expect(current(storage).revision).toBe(1);
    expect(updatePlaySave(storage, 1, {type:'claim-expedition', nowMs:120000}).status).toBe('ok');
    expect(state(storage).coins).toBe(14);
    expect(state(storage).trainer.xp).toBe(8);
    expect(state(storage).roster[0]?.xp).toBe(10);
    expect(current(storage).journal.revision).toBe(2);
    expect(current(storage).journal.receipts).toHaveLength(2);
    expect(updatePlaySave(storage, 2, {type:'claim-expedition', nowMs:120000}).status).toBe('blocked');
    expect(updatePlaySave(storage, 2, {type:'stop-expedition', nowMs:130000}).status).toBe('ok');
    expect(state(storage).coins).toBe(21);
    expect(state(storage).expedition).toBeNull();
    expect(updatePlaySave(storage, 3, {type:'stop-expedition', nowMs:140000}).status).toBe('blocked');
    expect(current(storage).journal.receipts).toHaveLength(3);
    expect(current(storage).revision).toBe(3);
  });

  it('duas abas com revisão observada antiga não sobrescrevem a primeira', () => {
    const { storage } = memory();
    createPlaySave(storage, 'Leaf', 4, 1000, true);
    expect(updatePlaySave(storage, 0, {
      type:'trainer',value:{type:'invest',stat:'speed'}
    }).status).toBe('ok');
    expect(updatePlaySave(storage, 0, {
      type:'trainer',value:{type:'invest',stat:'hp'}
    }).status).toBe('blocked');
    expect(state(storage).trainer.manual.speed).toBe(1);
    expect(state(storage).trainer.manual.hp).toBe(0);
    expect(current(storage).revision).toBe(1);
  });

  it('reload preserva moedas, recibos, XP e treino; reset apaga somente save alfa', () => {
    const { storage, map } = memory();
    map.set('kanto-idle-lab-save-v01', '{"original":true}');
    createPlaySave(storage, 'Leaf', 4, 1000);
    updatePlaySave(storage, 0, {type:'start-expedition',nowMs:10000});
    updatePlaySave(storage, 1, {type:'claim-expedition',nowMs:30000});
    const snapshot = current(storage);
    expect(readPlaySave(storage)).toEqual({status:'ready',snapshot});
    expect(state(storage).coins).toBe(14);
    expect(resetPlaySave(storage)).toBe(true);
    expect(readPlaySave(storage).status).toBe('absent');
    expect(map.get('kanto-idle-lab-save-v01')).toBe('{"original":true}');
  });

  it('falha de quota e readback não são relatados como sucesso', () => {
    const storage: PlayStorage = {
      getItem:()=>null, setItem:()=>{throw Error('quota');}, removeItem:()=>{}
    };
    expect(createPlaySave(storage,'Leaf',1,1000).status).toBe('blocked');
    const { storage: other } = memory();
    createPlaySave(other,'Leaf',1,1000);
    const raw = other.getItem(PLAY_SAVE_KEY)!;
    const failing: PlayStorage = {
      getItem:()=>raw, setItem:()=>{throw Error('quota');}, removeItem:()=>{}
    };
    expect(updatePlaySave(failing,0,{type:'start-expedition',nowMs:10000}).status).toBe('blocked');
  });
});

describe('batalha real na v0.2: combate + recompensas + captura em uma escrita',()=>{
  it('não permite ao botão declarar vitória; calcula resultado pela seed no core',()=>{
    const {storage,map}=memory();
    map.set('kanto-idle-lab-save-v01','legacy-untouched');
    expect(createPlaySave(storage,'Arena',4,1000,true).status).toBe('ok');
    const outcome=updatePlaySave(storage,0,{type:'battle',seed:0});
    expect(outcome.status).toBe('ok');
    const snapshot=current(storage);
    const game=JSON.parse(snapshot.journal.raw) as {
      wins:number; losses:number; seen:number[]; coins:number;
      roster:Array<{uid:number;pokemonId:number}>;
      lastBattle:{outcome:'win'|'loss'|'draw';wildSpeciesId:number;wildName:string;
        log:string[];captured:boolean;turns:number};
    };
    expect(game.wins+game.losses).toBe(1);
    expect(snapshot.revision).toBe(1);
    expect(snapshot.journal.revision).toBe(1);
    expect(snapshot.journal.receipts).toHaveLength(1);
    expect(snapshot.journal.receipts[0]?.id).toBe('battle-v02-1');
    expect(game.lastBattle.wildSpeciesId).toBe(10); // seed 0 = Caterpie
    expect(game.seen).toContain(10);
    expect(game.lastBattle.log.length).toBeGreaterThan(1);
    expect(game.lastBattle.turns).toBeGreaterThan(0);
    expect(game.lastBattle.turns).toBeLessThanOrEqual(30);
    expect(game.lastBattle.captured).toBe(game.roster.length>1);
    expect(map.get('kanto-idle-lab-save-v01')).toBe('legacy-untouched');
    expect(updatePlaySave(storage,0,{type:'battle',seed:0}).status).toBe('blocked');
    expect(current(storage)).toEqual(snapshot);
  });

  it('captura gera UID individual e mantém saldo/XP sem conceder duas vezes',()=>{
    let found=false;
    for(let seed=0;seed<600&&!found;seed++){
      const {storage}=memory();
      createPlaySave(storage,'Captura',7,1000,true);
      const outcome=updatePlaySave(storage,0,{type:'battle',seed});
      expect(outcome.status).toBe('ok');
      const snapshot=current(storage);
      const game=JSON.parse(snapshot.journal.raw) as {
        wins:number;coins:number;nextUid:number;
        roster:Array<{uid:number;pokemonId:number}>;
        lastBattle:{captured:boolean;outcome:string;wildSpeciesId:number};
      };
      if(!game.lastBattle.captured)continue;
      found=true;
      expect(game.lastBattle.outcome).toBe('win');
      expect(game.wins).toBe(1);
      expect(game.roster).toHaveLength(2);
      expect(game.roster[1]?.uid).toBe(2);
      expect(game.roster[1]?.pokemonId).toBe(game.lastBattle.wildSpeciesId);
      expect(game.nextUid).toBe(3);
      expect(game.coins).toBeGreaterThan(200);
      expect(updatePlaySave(storage,0,{type:'battle',seed}).status).toBe('blocked');
      expect(current(storage)).toEqual(snapshot);
    }
    expect(found).toBe(true);
  });

  it('rejeita seed fora do uint32 sem alterar qualquer estado',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Segurança',1,1000);
    const original=storage.getItem(PLAY_SAVE_KEY);
    for (const seed of [-1,2**32,1.4,NaN]) {
      expect(updatePlaySave(storage,0,{type:'battle',seed}).status).toBe('blocked');
    }
    expect(storage.getItem(PLAY_SAVE_KEY)).toBe(original);
  });

  it('expedição e batalha compartilham revisão externa mas recibos internos únicos',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Jornada',7,1000,true);
    expect(updatePlaySave(storage,0,{type:'start-expedition',nowMs:10000}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'battle',seed:35}).status).toBe('ok');
    expect(updatePlaySave(storage,2,{type:'claim-expedition',nowMs:30000}).status).toBe('ok');
    const snapshot=current(storage);
    expect(snapshot.revision).toBe(3);
    expect(snapshot.journal.revision).toBe(3);
    expect(snapshot.journal.receipts.map(r=>r.id)).toEqual(['idle-v02-1','battle-v02-2','idle-v02-3']);
    const game=JSON.parse(snapshot.journal.raw) as {lastBattle:unknown;coins:number;expedition:unknown};
    expect(game.lastBattle).not.toBeNull();
    expect(game.expedition).not.toBeNull();
  });
});

/** Fixtures de teste apenas: simula capturas válidas para exercitar UID sem sorteio. */
function addCapturedFixtures(storage: PlayStorage): void {
  const snapshot=current(storage);
  const game=JSON.parse(snapshot.journal.raw) as {
    roster: Array<{uid:number;pokemonId:number;level:number;xp:number;affinity:number;
      manual:Record<string,number>;moveName:string;upgrades:Record<string,number>}>;
    nextUid:number;
  };
  const sample=game.roster[0]!;
  game.roster.push(
    {...sample,uid:2,pokemonId:16,level:10,xp:3,affinity:15,
      manual:{...sample.manual,attack:0,defense:0,hp:0,specialAttack:0,specialDefense:0,speed:0},
      moveName:'gust',upgrades:{}},
    {...sample,uid:3,pokemonId:16,level:12,xp:7,affinity:85,
      manual:{hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0},
      moveName:'gust',upgrades:{}},
    {...sample,uid:4,pokemonId:19,level:8,xp:0,affinity:0,
      manual:{hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0},
      moveName:'quick-attack',upgrades:{}}
  );
  game.nextUid=5;
  storage.setItem(PLAY_SAVE_KEY,JSON.stringify({
    ...snapshot,journal:{...snapshot.journal,raw:JSON.stringify(game)}
  }));
}

describe('coleção e liderança: UIDs distintos no save jogável',()=>{
  it('permite duas capturas da mesma espécie, com XP/afinidade/atributos separados',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Colecionador',4,1000,true);
    addCapturedFixtures(storage);
    let currentGame=JSON.parse(current(storage).journal.raw) as {
      roster:Array<{uid:number;pokemonId:number;xp:number;affinity:number;
        manual:Record<string,number>}>;team:number[];nextUid:number
    };
    expect(currentGame.roster.filter(p=>p.pokemonId===16)).toHaveLength(2);
    expect(currentGame.roster.find(p=>p.uid===2)?.affinity).toBe(15);
    expect(currentGame.roster.find(p=>p.uid===3)?.affinity).toBe(85);
    expect(updatePlaySave(storage,0,{type:'pokemon',
      value:{type:'invest-pokemon',uid:3,stat:'speed'}}).status).toBe('ok');
    currentGame=JSON.parse(current(storage).journal.raw);
    expect(currentGame.roster.find(p=>p.uid===3)?.manual.speed).toBe(1);
    expect(currentGame.roster.find(p=>p.uid===2)?.manual.speed).toBe(0);
    expect(currentGame.roster.find(p=>p.uid===2)?.xp).toBe(3);
    expect(currentGame.roster.find(p=>p.uid===3)?.xp).toBe(7);
    expect(currentGame.nextUid).toBe(5);
  });

  it('adiciona até 3, escolhe líder por UID, rejeita quarto e registra líder na batalha',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Equipe',4,1000,true);
    addCapturedFixtures(storage);
    expect(updatePlaySave(storage,0,{type:'pokemon',
      value:{type:'set-active',uid:2}}).status).toBe('blocked');
    expect(updatePlaySave(storage,0,{type:'pokemon',
      value:{type:'add-team',uid:2}}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'pokemon',
      value:{type:'add-team',uid:3}}).status).toBe('ok');
    expect(updatePlaySave(storage,2,{type:'pokemon',
      value:{type:'add-team',uid:4}}).status).toBe('blocked');
    expect(updatePlaySave(storage,2,{type:'pokemon',
      value:{type:'set-active',uid:3}}).status).toBe('ok');
    let game=JSON.parse(current(storage).journal.raw) as {
      team:number[];roster:Array<{uid:number;xp:number;pokemonId:number}>;
      lastBattle?:{wildSpeciesId:number};
    };
    expect(game.team).toEqual([3,1,2]);
    expect(game.roster.find(p=>p.uid===2)?.pokemonId).toBe(16);
    expect(game.roster.find(p=>p.uid===3)?.pokemonId).toBe(16);
    expect(updatePlaySave(storage,3,{type:'battle',seed:12345}).status).toBe('ok');
    const currentSnapshot=current(storage);
    game=JSON.parse(currentSnapshot.journal.raw);
    expect(game.lastBattle?.wildSpeciesId).toBeGreaterThan(0);
    const battleReceipt=currentSnapshot.journal.receipts.find(r=>r.id==='battle-v02-4');
    expect(battleReceipt?.fingerprint).toContain('"activeUid":3');
    expect(currentSnapshot.revision).toBe(4);
    expect(currentSnapshot.journal.revision).toBe(1);
    expect(updatePlaySave(storage,3,{type:'battle',seed:12345}).status).toBe('blocked');
  });

  it('bloqueia toda mudança da equipe durante expedição, sem bloquear treino individual',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Expedição',7,1000,true);
    addCapturedFixtures(storage);
    expect(updatePlaySave(storage,0,{type:'pokemon',
      value:{type:'add-team',uid:2}}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'start-expedition',nowMs:100000}).status).toBe('ok');
    const before=storage.getItem(PLAY_SAVE_KEY);
    for(const value of [
      {type:'add-team' as const,uid:3},
      {type:'remove-team' as const,uid:2},
      {type:'set-active' as const,uid:2}
    ]){
      expect(updatePlaySave(storage,2,{type:'pokemon',value}).status).toBe('blocked');
      expect(storage.getItem(PLAY_SAVE_KEY)).toBe(before);
    }
    expect(updatePlaySave(storage,2,{type:'pokemon',
      value:{type:'invest-pokemon',uid:3,stat:'hp'}}).status).toBe('ok');
    expect(updatePlaySave(storage,3,{type:'stop-expedition',nowMs:100001}).status).toBe('ok');
    expect(updatePlaySave(storage,4,{type:'pokemon',
      value:{type:'set-active',uid:2}}).status).toBe('ok');
    const game=JSON.parse(current(storage).journal.raw) as {team:number[]};
    expect(game.team).toEqual([2,1]);
  });

  it('não permite remover o único Pokémon da equipe, mas mantém UIDs da coleção',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Coleção',1,1000);
    addCapturedFixtures(storage);
    expect(updatePlaySave(storage,0,{type:'pokemon',
      value:{type:'remove-team',uid:1}}).status).toBe('blocked');
    expect(updatePlaySave(storage,0,{type:'pokemon',
      value:{type:'add-team',uid:2}}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'pokemon',
      value:{type:'remove-team',uid:1}}).status).toBe('ok');
    const game=JSON.parse(current(storage).journal.raw) as {
      team:number[];roster:Array<{uid:number}>;nextUid:number
    };
    expect(game.team).toEqual([2]);
    expect(game.roster.map(p=>p.uid)).toEqual([1,2,3,4]);
    expect(game.nextUid).toBe(5);
  });
});

describe('golpes verificados por espécie e nível na v0.2',()=>{
  it('seleciona Ember em Charmander nv20, melhora rank e usa no combate salvo',()=>{
    const {storage}=memory();
    expect(createPlaySave(storage,'Golpes',4,1000,true).status).toBe('ok');
    expect(updatePlaySave(storage,0,{type:'move',uid:1,moveName:'ember',operation:'select'}).status).toBe('ok');
    let game=JSON.parse(current(storage).journal.raw) as {
      roster:Array<{uid:number;moveName:string;upgrades:Record<string,number>}>
      lastBattle?:{log:string[];battleId:string};
    };
    expect(game.roster[0]?.moveName).toBe('ember');
    expect(updatePlaySave(storage,1,{type:'move',uid:1,moveName:'ember',operation:'upgrade'}).status).toBe('ok');
    game=JSON.parse(current(storage).journal.raw);
    expect(game.roster[0]?.upgrades.ember).toBe(1);
    expect(current(storage).journal.receipts).toHaveLength(0);
    expect(current(storage).revision).toBe(2);
    expect(updatePlaySave(storage,2,{type:'battle',seed:0}).status).toBe('ok');
    game=JSON.parse(current(storage).journal.raw);
    expect(game.lastBattle?.log.some(line=>line.includes('usou ember'))).toBe(true);
    expect(game.lastBattle?.battleId).toBe('battle-v02-3');
    expect(current(storage).journal.receipts).toHaveLength(1);
    expect(updatePlaySave(storage,2,{type:'battle',seed:0}).status).toBe('blocked');
  });

  it('bloqueia golpes de outra espécie, níveis acima, sem dano e UID inexistente',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Pokémon',4,1000);
    const original=storage.getItem(PLAY_SAVE_KEY);
    const invalid=[
      {type:'move' as const,uid:1,moveName:'ember',operation:'select' as const}, // Nv 5
      {type:'move' as const,uid:1,moveName:'water-gun',operation:'select' as const},
      {type:'move' as const,uid:1,moveName:'hydro-pump',operation:'select' as const},
      {type:'move' as const,uid:999,moveName:'scratch',operation:'select' as const},
      {type:'move' as const,uid:1,moveName:'growl',operation:'select' as const},
      {type:'move' as const,uid:1,moveName:'ember',operation:'upgrade' as const}
    ];
    for(const action of invalid){
      expect(updatePlaySave(storage,0,action).status).toBe('blocked');
      expect(storage.getItem(PLAY_SAVE_KEY)).toBe(original);
    }
  });

  it('impede gasto além do orçamento, mantém revisões e chaves legadas',()=>{
    const {storage,map}=memory();
    map.set('kanto-idle-lab-save-v01','KEEP');
    createPlaySave(storage,'Ranks',4,1000,true);
    expect(updatePlaySave(storage,0,{type:'move',uid:1,moveName:'scratch',operation:'upgrade'}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'move',uid:1,moveName:'scratch',operation:'upgrade'}).status).toBe('ok');
    expect(updatePlaySave(storage,2,{type:'move',uid:1,moveName:'scratch',operation:'upgrade'}).status).toBe('ok');
    expect(updatePlaySave(storage,3,{type:'move',uid:1,moveName:'scratch',operation:'upgrade'}).status).toBe('blocked'); // teto Nv20 =3
    expect(updatePlaySave(storage,3,{type:'move',uid:1,moveName:'ember',operation:'select'}).status).toBe('ok');
    expect(updatePlaySave(storage,4,{type:'move',uid:1,moveName:'ember',operation:'upgrade'}).status).toBe('ok');
    expect(updatePlaySave(storage,5,{type:'move',uid:1,moveName:'ember',operation:'upgrade'}).status).toBe('blocked');
    const game=JSON.parse(current(storage).journal.raw) as {
      roster:Array<{uid:number;moveName:string;upgrades:Record<string,number>}>
    };
    expect(game.roster[0]?.upgrades).toEqual({scratch:3,ember:1});
    expect(game.roster[0]?.moveName).toBe('ember');
    expect(current(storage).revision).toBe(5);
    expect(current(storage).journal.revision).toBe(0);
    expect(map.get('kanto-idle-lab-save-v01')).toBe('KEEP');
  });
});


describe('evolução por UID na persistência alfa, sem recompensa duplicada',()=>{
  it('evolui Charmander demo com revisão única e preserva UID/XP/golpes/equipe',()=>{
    const {storage,map}=memory();
    map.set('kanto-idle-lab-save-v01','original');
    expect(createPlaySave(storage,'Red',4,1000,true).status).toBe('ok');
    expect(updatePlaySave(storage,0,{type:'pokemon',value:{type:'invest-pokemon',uid:1,stat:'attack'}}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'move',uid:1,moveName:'ember',operation:'select'}).status).toBe('ok');
    expect(updatePlaySave(storage,2,{type:'move',uid:1,moveName:'ember',operation:'upgrade'}).status).toBe('ok');
    const before=current(storage);
    const old=JSON.parse(before.journal.raw);
    const result=updatePlaySave(storage,3,{type:'evolution',uid:1,targetSpeciesId:5});
    expect(result.status).toBe('ok');
    const after=current(storage);
    const evolved=JSON.parse(after.journal.raw);
    expect(after.revision).toBe(4);
    expect(after.journal.receipts).toEqual(before.journal.receipts);
    expect(after.journal.revision).toBe(before.journal.revision);
    expect(evolved.roster[0]).toEqual({...old.roster[0],pokemonId:5});
    expect(evolved.team).toEqual([1]);
    expect(evolved.caughtSpecies).toEqual([4,5]);
    expect(evolved.seen).toEqual([4,5]);
    expect(map.get('kanto-idle-lab-save-v01')).toBe('original');
    expect(updatePlaySave(storage,3,{type:'evolution',uid:1,targetSpeciesId:5}).status).toBe('blocked');
    expect(updatePlaySave(storage,4,{type:'evolution',uid:1,targetSpeciesId:6}).status).toBe('blocked');
    expect(current(storage)).toEqual(after);
  });
  it('concede apenas um kit de pedras, consume no stone e preserva saldo',()=>{
    const {storage}=memory();
    createPlaySave(storage,'Leaf',1,1000,true);
    const starter=current(storage);
    const raw=JSON.parse(starter.journal.raw);
    raw.roster[0].pokemonId=25;raw.roster[0].level=20;
    raw.seen=[25];raw.caughtSpecies=[25];
    storage.setItem(PLAY_SAVE_KEY,JSON.stringify({...starter,journal:{...starter.journal,raw:JSON.stringify(raw)}}));
    expect(updatePlaySave(storage,0,{type:'evolution',uid:1,targetSpeciesId:26}).status).toBe('blocked');
    expect(updatePlaySave(storage,0,{type:'evolution-test-kit'}).status).toBe('ok');
    expect(updatePlaySave(storage,1,{type:'evolution-test-kit'}).status).toBe('blocked');
    expect(updatePlaySave(storage,1,{type:'evolution',uid:1,targetSpeciesId:26}).status).toBe('ok');
    const evolved=JSON.parse(current(storage).journal.raw);
    expect(evolved.roster[0].pokemonId).toBe(26);
    expect(evolved.evolutionStones['thunder-stone']).toBe(0);
    expect(evolved.caughtSpecies).toEqual([25,26]);
    expect(evolved.coins).toBe(raw.coins);
    expect(current(storage).journal.receipts).toEqual([]);
  });
});
