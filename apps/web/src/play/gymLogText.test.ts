import {describe,it,expect} from 'vitest';
import {gymNarratedLog,prettyMove} from './gymLogText';
import type {GymReplayRound} from './gymSession';
const battler=(name:string)=>({combatant:{name}});
const state=(playerIndex:number,leaderIndex=0)=>({
  player:{activeIndex:playerIndex,fighters:[
    battler('Charmander'),battler('Squirtle'),battler('Poliwag')]},
  leader:{activeIndex:leaderIndex,fighters:[
    battler('Onix'),battler('Geodude'),battler('Graveler')]}
});
function round(before:ReturnType<typeof state>,after:ReturnType<typeof state>,
  line:string):GymReplayRound{
  return {turn:3,lines:[line],before:before as never,after:after as never,
    snapshots:[after as never],frames:[],visual:{} as never};
}
describe('GYM-07 — diário distingue treinadores e Pokémon',()=>{
  it('mostra nome do Pokémon e ataque traduzido, sem rótulos técnicos',()=>{
    const lines=gymNarratedLog([round(state(0),state(0),
      'leader usou basic-attack (1/1), causando 14 de dano (-0 SP).')],
      'Karem','Brock');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Onix usou Ataque Básico');
    expect(lines[0]).toContain('14 de dano em Charmander');
    expect(lines[0]).not.toContain('leader');
  });
  it('atribui substituições ao treinador e identifica a reserva correta',()=>{
    expect(gymNarratedLog([round(state(0),state(1),
      'player substituiu após KO, sem restaurar HP ou SP.')],
      'Karem','Brock')[0]).toContain('Karem substituiu Charmander por Squirtle');
  });
  it('atribui habilidade ao Pokémon e humaniza atributos',()=>{
    const line=gymNarratedLog([round(state(0),state(0),
      'player usou growl e reduziu lower-attack.')],'Karem','Brock')[0]!;
    expect(line).toContain('Charmander usou Growl');
    expect(line).toContain('Ataque');
    expect(line).not.toContain('lower-attack');
    expect(prettyMove('basic-attack')).toBe('Ataque Básico');
  });
  it('atribui preparação e recarga ao Pokémon',()=>{
    expect(gymNarratedLog([round(state(0),state(0),'player preparou solar-beam (-37 SP).')],'Karem','Brock')[0]).toContain('Charmander preparou Solar Beam');
    expect(gymNarratedLog([round(state(0),state(0),'leader recarregou após hyper-beam.')],'Karem','Brock')[0]).toContain('Onix recarregou após Hyper Beam');
  });
  it('nocaute é do Pokémon e decisão da troca é do treinador',()=>{
    const line=gymNarratedLog([round(state(0),state(0),
      'player sofreu KO: aguarda substituição grátis.')],
      'Karem','Brock')[0]!;
    expect(line).toContain('Charmander foi nocauteado');
    expect(line).toContain('Karem precisa enviar outro Pokémon');
  });
});
