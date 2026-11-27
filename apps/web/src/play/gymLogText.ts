/** GYM-07: apresentação do log, sem alterar linhas autoritativas ou RNG.
 * Quem troca é o treinador; quem executa golpes, status e Concentrar é o Pokémon.
 * Usa snapshots já gravados pelo resolvedor para identificar UIDs ativos.
 */
import type {GymReplayRound} from './gymSession';

export function prettyMove(raw:string):string{
  const known:Record<string,string>={
    'basic-attack':'Ataque Básico','lower-attack':'Ataque',
    'lower-defense':'Defesa','special-defense':'Defesa Especial',
    'speed-drop':'Velocidade'
  };
  return known[raw]??raw.split('-').map(piece=>
    piece.charAt(0).toUpperCase()+piece.slice(1)).join(' ');
}
const partyName=(side:'player'|'leader',trainer:string,leader:string)=>
  side==='player'?trainer:leader;
const activeName=(round:GymReplayRound,index:number,side:'player'|'leader',
  moment:'before'|'after')=>{
  const state=moment==='before'
    ?index===0?round.before:round.snapshots[index-1]!
    :round.snapshots[index]!;
  const party=state[side];
  return party.fighters[party.activeIndex]!.combatant.name;
};
export function gymNarratedLog(
  rounds:readonly GymReplayRound[],trainer:string,leader:string
):readonly string[]{
  return rounds.flatMap(round=>round.lines.map((line,index)=>{
    const m=/^(player|leader)\s+(.+)$/.exec(line);
    if(!m)return 'T'+round.turn+' '+line;
    const side=m[1] as 'player'|'leader',action=m[2]!;
    const other=side==='player'?'leader':'player';
    const pokemon=activeName(round,index,side,'before');
    const foe=activeName(round,index,other,'before');
    const coach=partyName(side,trainer,leader);
    return narrateGymAction(round.turn,action,pokemon,foe,coach,activeName(round,index,side,'after'));
  }));
}

export function narrateGymAction(turn:number,action:string,pokemon:string,foe:string,coach:string,enteredName:string):string{
    let narration:string;
    if(action.startsWith('trocou Pokémon')||action.startsWith('substituiu após KO')){
      const entered=enteredName;
      narration=coach+' substituiu '+pokemon+' por '+entered+
        (action.startsWith('substituiu após KO')?' após o nocaute.':'.');
    }else if(action.startsWith('sofreu KO')){
      narration=pokemon+' foi nocauteado. '+coach+' precisa enviar outro Pokémon.';
    }else if(action.startsWith('usou ')){
      const match=/^usou ([a-zA-Z0-9-]+)(.*)$/.exec(action);
      if(match){
        const move=prettyMove(match[1]!);
        let rest=match[2]!
          .replace(/\blower-attack\b/g,'Ataque')
          .replace(/\blower-defense\b/g,'Defesa')
          .replace(/\blower-special-defense\b/g,'Defesa Especial')
          .replace(/\blow[a-z-]+\b/g,'atributo')
          .replace(/\s*\(\d+\/\d+\)/g,'');
        if(rest.includes('causando '))rest=rest.replace(/causando (\d+) de dano/,'causando $1 de dano em '+foe);
        narration=pokemon+' usou '+move+rest;
      }else narration=pokemon+' '+action;
    }else if(action.startsWith('errou ')){
      narration=pokemon+' '+action.replace(/^errou ([a-z-]+)/,(_,move:string)=>
        'errou '+prettyMove(move));
    }else if(action.startsWith('preparou ')){
      narration=pokemon+' '+action.replace(/^preparou ([a-z-]+)/,(_,move:string)=>'preparou '+prettyMove(move));
    }else if(action.startsWith('recarregou após ')){
      narration=pokemon+' '+action.replace(/^recarregou após ([a-z-]+)/,(_,move:string)=>'recarregou após '+prettyMove(move));
    }else if(/^(sofreu|recebeu|ficou|está|acordou|perdeu|se feriu|recuou|descongelou|roubou|evitou|bloqueou|precisará)/.test(action)){
      narration=pokemon+' '+action;
    }else narration=coach+' '+action;
    return 'T'+turn+' '+narration;
}
