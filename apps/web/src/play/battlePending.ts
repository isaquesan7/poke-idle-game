/** A read-only presentation of the public pending action. Never chooses actions. */
export function battlePendingLabel(pending:unknown):{title:string;detail:string;icon:string}|null{
 switch(pending){
  case 'solar-beam':return {title:'Preparando Solar Beam',detail:'Ataque no próximo turno, sem novo custo de SP.',icon:'fa-sun'};
  case 'dig':return {title:'Subterrâneo · Dig',detail:'Ataque no próximo turno, sem novo custo de SP.',icon:'fa-mountain'};
  case 'recharge':return {title:'Recarregando · Hyper Beam',detail:'Próximo turno sem atacar e sem custo de SP.',icon:'fa-battery-half'};
  default:return null;
 }
}
