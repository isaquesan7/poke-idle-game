import type {OnlineInventory} from '../inventory/onlineOwnership.js';
import {describe,expect,it} from 'vitest';
import {
  canonicalOnlineGymTrainerBonuses,canonicalOnlineGymEquippedMoves,
  canonicalOnlineGymPreparation,canonicalOnlineGymOpeningState,canonicalOnlineOwnedCombatant
} from './serverGymPreparation.js';
import {regionalNativeMoves} from './serverInheritedMoves.js';
import {createOnlineArenaGear} from '../inventory/onlineOwnership.js';
import {ARENA_LEGENDARY_TEMPLATES} from '../shop/arenaGearCatalog.js';
import {pokemonFinalStats,pokemonMasteryStats} from '../stats/pokemon.js';
import {kantoPokemonFormProfile} from '../catalog/kantoMegaForms.js';
import {STATS} from '../stats/types.js';
import {canonicalFrozenCombatants,frozenValidatedEquippedMoves} from './serverFrozenBattle.js';
import {gymPsychicLevelMoves} from '../gyms/gymPsychicMoves.js';
import {resolveGymTurn} from '../gyms/gymTurn.js';
import {KANTO_GYMS,KANTO_GYM_MASTER_TITLE_STATS} from '../gyms/kantoGyms.js';

type Stats={hp:number;attack:number;defense:number;specialAttack:number;
  specialDefense:number;speed:number};
interface Fixture {
  version:number;mode:string;wins:number;seen:number[];badges:string[];
  trainer:{level:number;xp:number;manual:Stats;
    equipped:Record<string,string>;title:string};
  roster:Array<{uid:number;pokemonId:number;level:number;affinity:number;
    manual:Stats;moveName:string;equippedMoveNames:string[];
    upgrades:Record<string,number>}>;
  team:number[];nextUid:number;expedition:unknown;
  inventory:OnlineInventory;
  gymSession?:unknown;pendingBattle?:unknown;lastBattle?:unknown;
}
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const blank=():Stats=>({
  hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0
});
function fixture():Fixture{
  return {
    version:1,mode:'normal',wins:0,seen:[4,7,25],badges:[],
    trainer:{level:1,xp:0,manual:blank(),equipped:{},title:'aprendiz'},
    roster:[
      {uid:1,pokemonId:4,level:20,affinity:0,manual:blank(),
        moveName:'scratch',
        equippedMoveNames:['scratch','ember','growl'],upgrades:{}},
      {uid:2,pokemonId:7,level:20,affinity:0,manual:blank(),
        moveName:'tackle',
        equippedMoveNames:['tackle','water-gun','tail-whip'],upgrades:{}},
      {uid:3,pokemonId:25,level:20,affinity:0,manual:blank(),
        moveName:'thunder-shock',
        equippedMoveNames:['thunder-shock','quick-attack','growl'],upgrades:{}}
    ],
    team:[1,2,3],nextUid:4,expedition:null,inventory:{version:1,gear:[],extraBagSlots:0}
  };
}
describe('ONLINE-01C-23B2B authoritative Kanto Gym preparation',()=>{
  it('uses exactly the ordered Collection team and canonical Brock 3v3, with HP/SP per UID',()=>{
    const source=fixture();
    const result=canonicalOnlineGymOpeningState(source);
    expect(result).not.toBeNull();
    const {preparation,battle}=result!;
    expect(preparation.version).toBe(1);
    expect(preparation.gymId).toBe('boulder');
    expect(preparation.leader).toBe('Brock');
    expect(preparation.teamUids).toEqual([1,2,3]);
    expect(preparation.player.map(member=>member.uid)).toEqual([1,2,3]);
    expect(preparation.leaderTeam.map(member=>member.speciesId))
      .toEqual([74,27,95]);
    expect(preparation.trainer.totals.hp).toBe(1); // Apprentice title only.
    expect(preparation.player[0].combatant.moves?.map(m=>m.name))
      .toEqual(['scratch','ember','growl']);
    expect(battle.player.fighters.map(f=>f.uid)).toEqual([1,2,3]);
    expect(battle.leader.fighters.map(f=>f.uid)).toEqual([null,null,null]);
    expect(battle.player.fighters.map(f=>f.hp))
      .toEqual(preparation.player.map(p=>p.combatant.stats.hp));
    expect(battle.player.fighters.every(f=>f.sp===f.maxSp)).toBe(true);
    expect(battle.outcome).toBe('ongoing');
    source.team=[3,1,2];
    const reordered=canonicalOnlineGymPreparation(source)!;
    expect(reordered.teamUids).toEqual([3,1,2]);
    expect(reordered.player.map(p=>p.combatant.speciesId))
      .toEqual([25,4,7]);
    expect(source.roster).toHaveLength(3);
    expect(source.badges).toEqual([]);
  });

  it('requires owned items and uses ONLY existing catalog bonuses',()=>{
    const raw=fixture();
    const base=canonicalOnlineGymTrainerBonuses(raw)!;
    expect(base.equipment).toEqual([]);
    expect(base.activeTitle).toBe('aprendiz');
    expect(base.totals).toEqual({...blank(),hp:1});
    raw.trainer.equipped={hat:'gear-cap',gloves:'gear-gloves'};
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
    raw.inventory={version:1,extraBagSlots:0,gear:[{"id":"gear-cap","source":"drop","templateId":"cap","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"hp":2}},{"id":"gear-gloves","source":"drop","templateId":"gloves","slot":"gloves","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"attack":2}}]};
    const owned=canonicalOnlineGymTrainerBonuses(raw)!;
    expect(owned.equipment).toEqual([
      {slot:'hat',itemId:'gear-cap'},{slot:'gloves',itemId:'gear-gloves'}
    ]);
    expect(owned.totals.hp).toBe(3);
    expect(owned.totals.attack).toBe(2);
    const copied=copy(raw);
    copied.inventory={...copied.inventory,gear:[]};
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
    copied.inventory={...copied.inventory,gear:[{"id":"gear-visor","source":"drop","templateId":"visor","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"speed":2}},{"id":"gear-gloves","source":"drop","templateId":"gloves","slot":"gloves","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"attack":2}}]};
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
    copied.inventory=copy(raw.inventory);
    copied.trainer.equipped={hat:'coat'};
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
    copied.trainer.equipped={hat:'not-a-real-item'};
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
    copied.trainer.equipped={other:'cap'};
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
  });

  it('validates achievements, canonical gym badges and unlocked titles',()=>{
    const raw=fixture();
    raw.trainer.title='veterano';
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
    raw.wins=4;
    expect(canonicalOnlineGymTrainerBonuses(raw)?.totals.attack).toBe(2);
    raw.trainer.title='explorador';
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
    raw.seen=Array.from({length:10},(_,i)=>i+1);
    expect(canonicalOnlineGymTrainerBonuses(raw)?.totals.speed).toBe(2);
    raw.trainer.title='aprendiz';
    raw.badges=['boulder'];
    const cascade=canonicalOnlineGymPreparation(raw)!;
    expect(cascade.gymId).toBe('cascade');
    expect(cascade.trainer.badges).toEqual(['boulder']);
    expect(cascade.trainer.totals.hp).toBe(3);
    expect(cascade.trainer.totals.defense).toBe(4);
    raw.badges=['cascade'];
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
    raw.badges=['boulder','boulder'];
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
    raw.badges=KANTO_GYMS.map(g=>g.id);
    raw.trainer.title='mestre';
    const finished=canonicalOnlineGymTrainerBonuses(raw)!;
    expect(finished.totals.attack).toBeGreaterThanOrEqual(
      KANTO_GYM_MASTER_TITLE_STATS.attack!);
    expect(canonicalOnlineGymPreparation(raw)).toBeNull();
    // A complete trainer has no ninth Kanto Gym.
    raw.badges=[];
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
  });

  it('freezes ranks independently for all three members and leaves untrained slots at zero',()=>{
    const raw=fixture();
    raw.roster[0]!.upgrades={scratch:3};
    raw.roster[1]!.upgrades={'water-gun':2};
    const prepared=canonicalOnlineGymOpeningState(raw)!;
    expect(prepared.preparation.player[0].combatant.ranks).toEqual({scratch:3,ember:0,growl:0});
    expect(prepared.preparation.player[1].combatant.ranks).toEqual({tackle:0,'water-gun':2,'tail-whip':0});
    expect(prepared.battle.player.fighters[1].combatant.ranks).toEqual({tackle:0,'water-gun':2,'tail-whip':0});
    expect(prepared.preparation.player[2].combatant.ranks).toEqual({});
    raw.roster[0]!.upgrades={scratch:3,ember:2};
    expect(canonicalOnlineGymPreparation(raw)).toBeNull();
  });
  it('rank affects actual Gym turn damage only for the upgraded slot, with unchanged SP cost',()=>{
    const raw=fixture(),plain=canonicalOnlineGymOpeningState(raw)!;
    raw.roster[0]!.upgrades={ember:3};
    const ranked=canonicalOnlineGymOpeningState(raw)!;
    const basic={kind:'basic'} as const;
    const hit=(battle:typeof plain.battle,action:Parameters<typeof resolveGymTurn>[1],seed:number)=>{
      const result=resolveGymTurn(battle,action,basic,seed);
      if(result.status!=='applied')throw Error('expected applied Gym turn');
      return {damage:battle.leader.fighters[0]!.hp-result.state.leader.fighters[0]!.hp,
        sp:result.state.player.fighters[0]!.sp};
    };
    let improved=0;
    for(let seed=1;seed<=32;seed++){
      const action={kind:'move',moveName:'ember'} as const;
      const a=hit(plain.battle,action,seed),b=hit(ranked.battle,action,seed);
      expect(b.damage).toBeGreaterThanOrEqual(a.damage);
      expect(b.sp).toBe(a.sp);
      if(b.damage>a.damage)improved++;
      for(const other of [basic,{kind:'move',moveName:'scratch'} as const]){
        expect(hit(ranked.battle,other,seed)).toEqual(hit(plain.battle,other,seed));
      }
    }
    expect(improved).toBeGreaterThan(0);
  });
  it('blocks arbitrary stats, future/TM/foreign moves, duplicate UIDs and unearned ranks',()=>{
    const raw=fixture();
    expect(canonicalOnlineGymEquippedMoves(25,20,
      ['thunder-shock','quick-attack'])?.length).toBe(2);
    expect(canonicalOnlineGymEquippedMoves(25,1,
      ['thunder-shock','quick-attack'])).toBeNull();
    expect(canonicalOnlineGymEquippedMoves(25,20,
      ['hydro-pump'])).toBeNull();
    expect(canonicalOnlineGymEquippedMoves(25,20,
      ['thunder-shock','thunder-shock'])).toBeNull();
    const make=(edit:(obj:ReturnType<typeof fixture>)=>void)=>{
      const p=copy(raw);edit(p);
      return canonicalOnlineGymPreparation(p);
    };
    expect(make(p=>{p.team=[1,2]})).toBeNull();
    expect(make(p=>{p.team=[1,1,3]})).toBeNull();
    expect(make(p=>{p.team=[1,2,99]})).toBeNull();
    expect(make(p=>{p.roster[1]!.uid=1})).toBeNull();
    expect(make(p=>{p.roster[1]!.manual.attack=40})).toBeNull();
    expect(make(p=>{p.trainer.manual.attack=40})).toBeNull();
    expect(make(p=>{p.roster[1]!.upgrades={'tackle':4}})).toBeNull();
    expect(make(p=>{p.roster[1]!.equippedMoveNames=['tackle','hydro-pump']}))
      .toBeNull();
    expect(make(p=>{p.roster[1]!.equippedMoveNames=['tackle','tackle']}))
      .toBeNull();
    expect(make(p=>{p.expedition={startedAt:1}})).toBeNull();
    expect(make(p=>{p.gymSession={id:'forged'}})).toBeNull();
    expect(make(p=>{p.pendingBattle={regionId:1}})).toBeNull();
    expect(make(p=>{p.lastBattle={captureStatus:'available'}})).toBeNull();
  });
});


describe('D6B — shared online Collection move legality',()=>{
  it('accepts every valid regional slot with identical move data at every species and level',()=>{
    const mismatches:string[]=[];
    for(let species=1;species<=151;species++)for(let level=1;level<=100;level++){
      const names=[...regionalNativeMoves(species,level).keys()];
      for(let i=0;i<names.length;i+=4){
        const slots=names.slice(i,i+4);
        const regional=frozenValidatedEquippedMoves(species,level,slots);
        if(!regional)continue;
        const gym=canonicalOnlineGymEquippedMoves(species,level,slots);
        if(JSON.stringify(gym)!==JSON.stringify(regional))mismatches.push(
          species+':'+level+':'+slots.join(','));
      }
    }
    expect(mismatches).toEqual([]);
  },60000);
  it('prepares a real trio with the previously rejected fallback slots, ranks and Gym turn',()=>{
    const raw=fixture();
    for(const [index,species,level] of [[0,12,23],[1,64,23],[2,65,71]] as const){
      const native=[...regionalNativeMoves(species,level).values()];
      const attack=native.find(m=>m.category!=='status'&&m.power>0);
      expect(attack).toBeDefined();
      expect(gymPsychicLevelMoves(species,level).some(m=>m.move.category!=='status')).toBe(true);
      raw.roster[index]={uid:index+1,pokemonId:species,level,affinity:0,
        manual:blank(),moveName:attack!.name,equippedMoveNames:[attack!.name],
        upgrades:{[attack!.name]:1}};
    }
    raw.seen=raw.roster.map(p=>p.pokemonId);
    const opening=canonicalOnlineGymOpeningState(raw);
    expect(opening).not.toBeNull();
    for(const [index,p] of raw.roster.entries()){
      expect(opening!.preparation.player[index]!.combatant.moves).toEqual(
        frozenValidatedEquippedMoves(p.pokemonId,p.level,p.equippedMoveNames));
      expect(opening!.preparation.player[index]!.combatant.ranks).toEqual(p.upgrades);
    }
    const action={kind:'move',moveName:raw.roster[0]!.moveName} as const;
    expect(resolveGymTurn(opening!.battle,action,{kind:'basic'},17).status).toBe('applied');
  });
  it('preserves existing Gym psychic level-up permission without granting foreign or NPC TM moves',()=>{
    expect(canonicalOnlineGymEquippedMoves(64,60,['psychic'])?.[0]?.name).toBe('psychic');
    expect(canonicalOnlineGymEquippedMoves(25,20,['hydro-pump'])).toBeNull();
    expect(canonicalOnlineGymEquippedMoves(109,60,['toxic'])).toBeNull();
    expect(canonicalOnlineGymEquippedMoves(64,60,['calm-mind'])).toBeNull();
    expect(canonicalOnlineGymEquippedMoves(64,60,['tackle','tackle'])).toBeNull();
  });
});

it('mastery affects only members of the mastered family, not Gym NPCs',()=>{
 const raw=fixture(),plain=canonicalOnlineGymPreparation(raw)!;
 const boosted=canonicalOnlineGymPreparation({...raw,research:{points:{'4':100}}})!;
 expect(boosted.player[0].combatant.stats).toEqual(Object.fromEntries(Object.entries(plain.player[0].combatant.stats).map(([k,v])=>[k,Math.floor(v*1.03)])));
 expect(boosted.player.slice(1)).toEqual(plain.player.slice(1));
 expect(boosted.leaderTeam).toEqual(plain.leaderTeam);
});

describe('REF02B canonical reinforcement and Arena set combat parity',()=>{
 it('uses effective affixes once, applies a flat tier only to the selected leader, and agrees with frozen Region stats',()=>{
  const source=fixture();source.trainer.level=100;
  const gear=ARENA_LEGENDARY_TEMPLATES.map((t,i)=>createOnlineArenaGear('01234567-89ab-4cde-8fab-'+String(i+1).padStart(12,'0'),'arena-legendary-'+t.slot,['hp','attack','defense','speed'])!);
  source.inventory={version:1,extraBagSlots:10,gear:gear.map((g,i)=>i===0?{...g,enhancement:6}:g)};
  for(const count of [3,6,9]){
   source.trainer.equipped=Object.fromEntries(gear.slice(0,count).map(g=>[g.slot,g.id]));
   const b=canonicalOnlineGymTrainerBonuses(source)!;
   const tier=count===3?3:count===6?6:10;
   expect(b.arenaSet).toMatchObject({count,bonus:tier});
   expect(b.totals.hp).toBe(1+15*count+9);
   const gym=canonicalOnlineGymPreparation(source)!;
   for(const [index,p] of source.roster.entries()){
    const base=pokemonMasteryStats(pokemonFinalStats(kantoPokemonFormProfile(p.pokemonId,undefined)!.base,p.level,p.manual,b.totals,p.affinity),0);
    const fighter=canonicalOnlineOwnedCombatant({...source},p,b)!;
    for(const s of STATS)expect(fighter.stats[s]).toBe(base[s]+(index===0?tier:0));
    expect(gym.player[index]?.combatant.stats).toEqual(fighter.stats);
   }
   const p=source.roster[0]!;
   const snap={version:2,regionId:1,opponent:{speciesId:10,level:2},trainer:{...source.trainer,wins:source.wins,seen:source.seen,badges:source.badges,inventory:source.inventory},activePokemon:{uid:p.uid,speciesId:p.pokemonId,level:p.level,affinity:p.affinity,manual:p.manual,moveName:p.moveName,moveNames:p.equippedMoveNames,upgrades:p.upgrades}};
   expect(canonicalFrozenCombatants(snap)?.player.stats).toEqual(gym.player[0].combatant.stats);
   source.team=[2,1,3];
   const moved=canonicalOnlineGymPreparation(source)!;
   for(const s of STATS){
    expect(moved.player[0].combatant.stats[s]).toBe(gym.player[1].combatant.stats[s]+tier);
    expect(moved.player[1].combatant.stats[s]).toBe(gym.player[0].combatant.stats[s]-tier);
   }
   source.team=[1,2,3];
  }
  expect(source.inventory.gear[0]?.stats.hp).toBe(15);
 });
});
