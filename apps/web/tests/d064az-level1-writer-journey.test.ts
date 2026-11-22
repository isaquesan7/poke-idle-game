/**
 * D064AZ: jornada NORMAL desde nível 1, SEM inserir XP/nível/espécies/itens
 * artificiais no save. Todos os encontros, Pokébolas e expedições passam pelo
 * writer público updatePlaySave, com revisions/receipts reais.
 * Os números são amostras determinísticas, NÃO telemetria de jogadores.
 */
import {describe,it,expect} from 'vitest';
import {createPlaySave,readPlaySave,updatePlaySave} from '../src/play/playSave.js';
import {KANTO_REGIONS,kantoEvolutionOptions} from '@kanto/game-core';

class Storage {
  readonly items=new Map<string,string>();
  getItem(k:string){return this.items.get(k)??null;}
  setItem(k:string,v:string){this.items.set(k,v);}
  removeItem(k:string){this.items.delete(k);}
}
function snapshot(store:Storage){
  const result=readPlaySave(store);
  if(result.status!=='ready')throw Error('Sem progresso no writer');
  return result.snapshot;
}
function game(store:Storage):any{return JSON.parse(snapshot(store).journal.raw);}
function act(store:Storage,action:Parameters<typeof updatePlaySave>[2]){
  return updatePlaySave(store,snapshot(store).revision,action);
}
/** Cobrir pools distintos e níveis via bits altos da seed. */
function seed(starter:number,index:number):number {
  const x=(Math.imul(index+1,0x9e3779b1)^Math.imul(starter+1,0x85ebca6b))>>>0;
  return Math.imul(x^(x>>>16),0xc2b2ae35)>>>0;
}
const starters=[1,4,7] as const;
const samples=72;

describe('D064AZ — progressão inicial real / dificuldade justa',()=>{
  it('não pode explorar região ou expedição de nível superior com starter 1',()=>{
    const store=new Storage();
    expect(createPlaySave(store,'Normal',1,1000,false).status).toBe('ok');
    const initial=game(store);
    expect(initial.trainer.level).toBe(1);
    expect(initial.roster[0].level).toBe(1);
    expect(initial.roster[0].xp).toBe(0);
    expect(act(store,{type:'start-expedition',nowMs:1000,regionId:1}).status)
      .toBe('blocked');
    expect(act(store,{type:'regional-battle',seed:1,regionId:2}).status)
      .toBe('blocked');
    expect(act(store,{type:'evolution',uid:1,targetSpeciesId:2}).status)
      .toBe('blocked');
    expect(snapshot(store).revision).toBe(0);
    expect(game(store)).toEqual(initial);
  });

  it('os 3 iniciais possuem alguma chance de progredir e de abrir expedições legitimamente',()=>{
    const report:Record<string,unknown>={};
    for(const species of starters){
      const store=new Storage();
      expect(createPlaySave(store,'Treinador Inicial',species,1000,false).status)
        .toBe('ok');
      let wins=0,losses=0,captures=0,firstWinAt:number|null=null;
      let firstLevel2At:number|null=null,firstTrainer2At:number|null=null;
      const levels=[game(store).roster[0].level];
      const trainerLevels=[game(store).trainer.level];
      let maxReplayLines=0;
      for(let i=0;i<samples;i++){
        const old=snapshot(store);
        const g=game(store);
        const action=act(store,{
          type:'regional-battle',regionId:1,seed:seed(species,i),
          ballId:(g.ballPocket?.quantities?.['poke-ball']??0)>0?'poke-ball':null
        });
        expect(action.status).toBe('ok');
        expect(snapshot(store).revision).toBe(old.revision+1);
        const now=snapshot(store);
        expect(now.journal.revision).toBe(old.journal.revision+1);
        expect(now.journal.receipts).toHaveLength(now.journal.revision);
        const newGame=game(store);
        expect(newGame.roster[0].uid).toBe(1);
        expect(newGame.roster[0].pokemonId).toBe(species);
        expect(newGame.roster[0].level).toBeGreaterThanOrEqual(g.roster[0].level);
        expect(newGame.trainer.level).toBeGreaterThanOrEqual(g.trainer.level);
        expect(newGame.lastBattle.log).toHaveLength(newGame.lastBattle.frames.length);
        expect(newGame.lastBattle.regionId).toBe(1);
        expect(newGame.lastBattle.wildLevel).toBeGreaterThanOrEqual(2);
        expect(newGame.lastBattle.wildLevel).toBeLessThanOrEqual(10);
        const xpExpected=g.roster[0].level===1&&
          newGame.lastBattle.outcome!=='win'?22:
          newGame.lastBattle.outcome==='win'?20+newGame.lastBattle.wildLevel*6:0;
        expect(newGame.lastBattle.pokemonXp).toBe(xpExpected);
        if(g.roster[0].level===1&&newGame.lastBattle.outcome!=='win'){
          expect(newGame.trainer.xp).toBe(g.trainer.xp);
          expect(newGame.coins).toBe(g.coins);
          expect(newGame.lastBattle.log.at(-1)).toContain('+22 XP');
        }
        maxReplayLines=Math.max(maxReplayLines,newGame.lastBattle.log.length);
        if(newGame.lastBattle.outcome==='win'){
          wins++;
          if(firstWinAt===null)firstWinAt=i+1;
        }else losses++;
        if(newGame.lastBattle.captured)captures++;
        if(newGame.roster[0].level>=2&&firstLevel2At===null)firstLevel2At=i+1;
        if(newGame.trainer.level>=2&&firstTrainer2At===null)firstTrainer2At=i+1;
        levels.push(newGame.roster[0].level);
        trainerLevels.push(newGame.trainer.level);
      }
      const latest=game(store);
      // Diagnosticar todos os iniciais, incluindo casos sem vitórias.
      expect(latest.wins).toBe(wins);
      expect(latest.losses).toBe(losses);
      expect(latest.regionWins[0]).toBe(wins);
      // Cada tentativa de captura depende de vitória e estoque REAL.
      expect(latest.roster.length).toBe(captures+1);
      expect(new Set(latest.roster.map((p:{uid:number})=>p.uid)).size)
        .toBe(latest.roster.length);
      expect(latest.ballPocket.quantities['poke-ball']).toBeGreaterThanOrEqual(0);
      if(latest.roster[0].level>=2){
      const old=snapshot(store);
      // Região 1 exige Pokémon nível2 para expedição, já obtido sem grant.
      const nowMs=1_000_000;
      expect(act(store,{type:'start-expedition',regionId:1,nowMs}).status).toBe('ok');
      expect(game(store).expedition.regionId).toBe(1);
      expect(game(store).expedition.teamUids).toEqual([1]);
      expect(act(store,{type:'claim-expedition',nowMs:nowMs+20_000}).status)
        .toBe('ok');
      expect(game(store).lastClaim.cycles).toBe(2);
      expect(game(store).lastClaim.pokemonXP).toBe(10);
      expect(act(store,{type:'claim-expedition',nowMs:nowMs+20_000}).status)
        .toBe('blocked');
      expect(act(store,{type:'stop-expedition',nowMs:nowMs+30_000}).status)
        .toBe('ok');
      expect(game(store).expedition).toBeNull();
      expect(snapshot(store).revision).toBe(old.revision+3);
      }
      report[String(species)]={
        attempts:samples,wins,losses,winPct:Math.round(wins/samples*10000)/100,
        firstWinAt,firstPokemonLevel2At:firstLevel2At,
        firstTrainerLevel2At:firstTrainer2At,
        finalPokemonLevel:latest.roster[0].level,finalTrainerLevel:latest.trainer.level,
        captures,roster:latest.roster.length,
        lastPokeBalls:latest.ballPocket.quantities['poke-ball'],
        maxReplayLines,levelCheckpoints:[levels[0],levels[12],levels[36],levels[72]],
        trainerCheckpoints:[trainerLevels[0],trainerLevels[12],trainerLevels[36],trainerLevels[72]]
      };
    }
    (globalThis as unknown as {console:{info:(s:string)=>void}}).console.info(
      'D064AZ_LEVEL1_WRITER_REPORT '+JSON.stringify(report));
    // A progressão não exige vitória inicial: 4 derrotas/empates devem
    // ser suficientes para sair do nível 1 e abrir a expedição regional.
    expect(Object.values(report).every((r:any)=>r.firstPokemonLevel2At!==null)).toBe(true);
  },120000);
  it('não presume evolução, pedras, time ou região 9 automaticamente após o grind',()=>{
    for(const starter of starters){
      const store=new Storage();
      expect(createPlaySave(store,'Limites',starter,1000,false).status).toBe('ok');
      const g=game(store);
      expect(g.roster).toHaveLength(1);
      expect(g.team).toEqual([1]);
      expect(g.evolutionStones).toEqual({});
      expect(KANTO_REGIONS.filter(r=>g.trainer.level>=r.trainerUnlockLevel)
        .map(r=>r.id)).toEqual([1]);
      const rule=kantoEvolutionOptions(starter)[0]!;
      expect(rule.trigger).toBe('level');
      expect(act(store,{type:'evolution',uid:1,targetSpeciesId:rule.to}).status)
        .toBe('blocked');
      expect(snapshot(store).revision).toBe(0);
    }
  });
});
