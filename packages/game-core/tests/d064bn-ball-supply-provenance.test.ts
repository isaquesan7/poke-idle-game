import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,D064_DRAFT_STARTER_BALLS,KANTO_REGION_WINS_CAP,
  d064DraftBallDrop,d064DraftBallSupply,d064BattleBallRoll,
  d064BattleBallDropRates,emptyExpeditionBallProgress,expeditionRewards,
  KANTO_BALLS,inspectKantoBallPocket
} from '../src/index.js';

/** D064BQ: por vitória elegível, RNG reproduzível por encontro, sem marcos. */
describe('D064BQ — proveniência e chances de Poké/Great/Ultra Ball',()=>{
  it('mantém 12 Poké iniciais e impede Master Ball gratuita',()=>{
    expect(D064_DRAFT_STARTER_BALLS).toEqual({
      version:1,quantities:{'poke-ball':12}
    });
    expect(inspectKantoBallPocket(D064_DRAFT_STARTER_BALLS).status).toBe('valid');
    expect(KANTO_BALLS['master-ball'].automaticUse).toBe(false);
    expect(KANTO_BALLS['master-ball'].conventionalShop).toBe(false);
  });

  it('tabela de drops regional é válida e restrição da Ultra vale desde R7',()=>{
    for(const region of KANTO_REGIONS){
      const expected=region.id<=3?{'poke-ball':30,'great-ball':0,'ultra-ball':0}
        :region.id<=6?{'poke-ball':25,'great-ball':14,'ultra-ball':0}
        :region.id<=8?{'poke-ball':18,'great-ball':14,'ultra-ball':5}
        :{'poke-ball':18,'great-ball':14,'ultra-ball':7};
      expect(d064BattleBallDropRates(region.id)).toEqual(expected);
      const chance=Object.values(expected).reduce((sum,n)=>sum+n,0);
      expect(chance).toBeLessThan(100);
      expect(d064DraftBallSupply(region.id,100)).toEqual(expected);
      for(let seed=0;seed<500;seed++){
        const id='regional-v02-'+(seed+1);
        const reward=d064DraftBallDrop(region.id,seed,id);
        expect(reward).not.toBeNull();
        const amount=Object.values(reward!).reduce((sum,n)=>sum+n,0);
        expect(amount).toBeLessThanOrEqual(1);
        expect(reward!['great-ball']).toBe(region.id<4?0:reward!['great-ball']);
        expect(reward!['ultra-ball']).toBe(region.id<7?0:reward!['ultra-ball']);
        expect(d064DraftBallDrop(region.id,seed,id)).toEqual(reward);
      }
    }
  });

  it('o sortudo pode achar uma bola na PRIMEIRA vitória; 15ª não garante Ultra',()=>{
    for(const region of [1,4,7,9]){
      const rate=d064BattleBallDropRates(region)!;
      const sum={'poke-ball':0,'great-ball':0,'ultra-ball':0};
      for(let i=0;i<10000;i++){
        const reward=d064DraftBallDrop(region,i,'regional-v02-'+(i+1))!;
        for(const ball of ['poke-ball','great-ball','ultra-ball'] as const)
          sum[ball]+=reward[ball];
      }
      // A amostra seedada é estatística, não promessa para jogadores.
      for(const ball of ['poke-ball','great-ball','ultra-ball'] as const)
        expect(Math.abs(sum[ball]/100-rate[ball])).toBeLessThan(1.4);
    }
    const six=d064DraftBallDrop(7,12345,'regional-v02-15');
    expect(six).not.toBeNull();
    const zero=Array.from({length:50},(_,i)=>d064DraftBallDrop(7,0,'regional-v02-'+(i+1))!);
    expect(new Set(zero.map(d=>JSON.stringify(d))).size).toBeGreaterThan(1);
    expect(d064BattleBallRoll(7,0,'regional-v02-1')).toBe(
      d064BattleBallRoll(7,0,'regional-v02-1'));
    expect(d064DraftBallDrop(7,0,'replay-forged')).toBeNull();
    expect(d064DraftBallDrop(7,-1,'regional-v02-1')).toBeNull();
    expect(d064DraftBallDrop(11,0,'regional-v02-1')).toBeNull();
    expect(d064DraftBallSupply(7,-1)).toBeNull();
    expect(KANTO_REGION_WINS_CAP).toBe(100000);
  });

  it('Ultra Ball depende de 8640 ciclos elegíveis de expedição nas áreas 9/10',()=>{
    const duration=8*60*60*1000;
    for(const region of KANTO_REGIONS){
      // O líder no cap de cada área evita mudanças de XP na coleta.
      // Se a área não permite Ultra Ball, três claims continuam sem drop.
      const pokemonLevel=region.id<9?region.levelMin:100;
      let progress=emptyExpeditionBallProgress();
      let ultraDrops=0;
      for(let claim=0;claim<3;claim++){
        const reward=expeditionRewards(duration,{
          regionId:region.id,pokemon:[{level:pokemonLevel,xp:0}],
          ballProgress:progress
        });
        expect(reward.affinityGainPerMember).toBe(0);
        ultraDrops+=reward.ballDrops?.['ultra-ball']??0;
        progress={...reward.ballProgress!};
      }
      if(region.id>=9){
        expect(ultraDrops).toBe(1);
        expect(progress['ultra-ball']).toBe(8640);
      }else{
        expect(ultraDrops).toBe(0);
        expect(progress['ultra-ball']).toBe(0);
      }
    }
  });

  it('em região sem prêmio econômico, nem os ciclos de bolas avançam',()=>{
    const before={'poke-ball':1439,'great-ball':2879,'ultra-ball':8639};
    const zero=expeditionRewards(8*60*60*1000,{
      regionId:3,pokemon:[{level:41,xp:0}],ballProgress:before
    });
    expect(zero).toMatchObject({coins:0,trainerXp:0,pokemonXpPerMember:0});
    expect(zero.ballDrops).toEqual(emptyExpeditionBallProgress());
    expect(zero.ballProgress).toEqual(before);
  });
});
