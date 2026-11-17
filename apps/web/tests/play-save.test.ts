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
