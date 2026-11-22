import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,D064_DRAFT_STARTER_BALLS,KANTO_REGION_WINS_CAP,
  d064DraftBallDrop,emptyExpeditionBallProgress,expeditionRewards,
  KANTO_BALLS,inspectKantoBallPocket
} from '../src/index.js';
import {d064DraftBallSupply} from '../src/capture/draftBallSupply.js';

/**
 * D064BO — combate concede Ultra desde R7 (1/15 vitórias);
 * expedição concede Ultra apenas R9/R10 (1/24h elegíveis).
 * O draftBallDrop participa do writer REAL e exige regressão.
 */
describe('D064BN — proveniência de Poké/Great/Ultra Ball',()=>{
  it('mantém kit inicial de 12 Poké Balls e proíbe Master Ball gratuita',()=>{
    expect(D064_DRAFT_STARTER_BALLS).toEqual({
      version:1,quantities:{'poke-ball':12}
    });
    expect(inspectKantoBallPocket(D064_DRAFT_STARTER_BALLS).status).toBe('valid');
    expect(KANTO_BALLS['master-ball'].automaticUse).toBe(false);
    expect(KANTO_BALLS['master-ball'].conventionalShop).toBe(false);
  });

  it('D064BO: Ultra em combate desde R7 e Poké/Great preservadas',()=>{
    for(const region of KANTO_REGIONS){
      for(let wins=1;wins<=105;wins++){
        const reward=d064DraftBallDrop(region.id,wins);
        expect(reward).not.toBeNull();
        expect(reward).toEqual({
          'poke-ball':region.id<=6&&wins%3===0?1:0,
          'great-ball':region.id>=4&&wins%7===0?1:0,
          'ultra-ball':region.id>=7&&wins%15===0?1:0
        });
      }
      for(const wins of [0,1,2,3,7,15,30,105,999]){
        const aggregate=d064DraftBallSupply(region.id,wins);
        expect(aggregate).toEqual({
          'poke-ball':region.id<=6?Math.floor(wins/3):0,
          'great-ball':region.id>=4?Math.floor(wins/7):0,
          'ultra-ball':region.id>=7?Math.floor(wins/15):0
        });
      }
    }
    expect(d064DraftBallDrop(11,15)).toBeNull();
    expect(d064DraftBallSupply(0,15)).toBeNull();
    expect(d064DraftBallDrop(7,0)).toBeNull();
    expect(KANTO_REGION_WINS_CAP).toBe(100000);
    expect(d064DraftBallDrop(7,KANTO_REGION_WINS_CAP)).not.toBeNull();
    expect(d064DraftBallDrop(7,KANTO_REGION_WINS_CAP+1)).toBeNull();
    expect(d064DraftBallSupply(7,KANTO_REGION_WINS_CAP+1)).toBeNull();
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
