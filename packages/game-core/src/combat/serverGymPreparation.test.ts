import {describe,expect,it} from 'vitest';
import {
  canonicalOnlineGymTrainerBonuses,canonicalOnlineGymEquippedMoves,
  canonicalOnlineGymPreparation,canonicalOnlineGymOpeningState
} from './serverGymPreparation.js';
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
  inventory?:{version:number;extraBagSlots:number;
    ownedEquipment:Record<string,number>};
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
    team:[1,2,3],nextUid:4,expedition:null
  };
}
describe('ONLINE-01C-23B2B authoritative Kanto Gym preparation',()=>{
  it('reconstructs legacy frozen openings without new leader metadata',()=>{
    const raw=fixture(),legacy=canonicalOnlineGymOpeningState(raw,true)!;
    const modern=canonicalOnlineGymOpeningState(raw)!;
    expect(legacy.preparation.leaderTrainer).toBeUndefined();
    expect(modern.preparation.leaderTrainer?.level).toBe(12);
    expect(legacy.preparation.leaderTeam.every(p=>p.rank===0&&Object.keys(p.ranks??{}).length===0)).toBe(true);
    expect(legacy.preparation.player).toEqual(modern.preparation.player);
    expect(legacy.battle.leader.fighters[0]!.combatant.stats).not.toEqual(modern.battle.leader.fighters[0]!.combatant.stats);
    expect(canonicalOnlineGymOpeningState(raw,true)).toEqual(legacy);
  });
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
    raw.trainer.equipped={hat:'cap',gloves:'gloves'};
    expect(canonicalOnlineGymTrainerBonuses(raw)).toBeNull();
    raw.inventory={version:1,extraBagSlots:0,
      ownedEquipment:{cap:1,gloves:1}};
    const owned=canonicalOnlineGymTrainerBonuses(raw)!;
    expect(owned.equipment).toEqual([
      {slot:'hat',itemId:'cap'},{slot:'gloves',itemId:'gloves'}
    ]);
    expect(owned.totals.hp).toBe(3);
    expect(owned.totals.attack).toBe(3);
    const copied=copy(raw);
    copied.inventory!.ownedEquipment.cap=0;
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
    copied.inventory!.ownedEquipment={visor:1,gloves:1};
    expect(canonicalOnlineGymTrainerBonuses(copied)).toBeNull();
    copied.inventory!.ownedEquipment={cap:1,gloves:1};
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
