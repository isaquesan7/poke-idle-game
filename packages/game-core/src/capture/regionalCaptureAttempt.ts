/**
 * D-064H — resolução DETERMINÍSTICA de tentativa de captura isolada.
 *
 * Regras: espécie deve constar da região, bola existir no bolso, Ultra
 * obrigatória para lendários/míticos, Master bloqueada, UMA bola por
 * tentativa mesmo quando falha. Sem side effects e sem save.
 *
 * A probabilidade continua HIPÓTESE de balanceamento, não fórmula final.
 * O writer futuro deverá validar a vitória do mesmo encontro e fazer
 * débito da bola + eventual criação UID + recibo em uma revisão única.
 */
import type {KantoBallId} from './kantoBalls.js';
import type {KantoBallPocketV1} from './kantoBallPocket.js';
import {spendKantoBallForAttempt} from './kantoBallPocket.js';
import {d064CaptureProjection} from './regionalCaptureProjection.js';

export type KantoCaptureAttempt=
  | {readonly status:'blocked';readonly reason:string}
  | {
      readonly status:'resolved';
      readonly captured:boolean;
      readonly ballId:Exclude<KantoBallId,'master-ball'>;
      readonly pocket:KantoBallPocketV1;
      readonly chance:number;
    };
/** Xorshift + avalancha determinística; não é RNG antifraude. */
function captureRoll(seed:number):number{
  let x=(seed^0x9e3779b9)>>>0;
  x=Math.imul(x^(x>>>16),0x7feb352d)>>>0;
  x=Math.imul(x^(x>>>15),0x846ca68b)>>>0;
  return ((x^(x>>>16))>>>0)/0x100000000;
}
export function resolveKantoCaptureAttempt(input:{
  readonly regionId:number;
  readonly speciesId:number;
  readonly ballId:KantoBallId;
  readonly pocket:KantoBallPocketV1;
  readonly maxHp:number;
  readonly currentHp:number;
  readonly seed:number;
}):KantoCaptureAttempt{
  if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>0xffffffff)
    return{status:'blocked',reason:'Seed de captura inválida.'};
  const projection=d064CaptureProjection(
    input.speciesId,input.regionId,input.ballId,input.maxHp,input.currentHp
  );
  if(!projection)
    return{status:'blocked',reason:'Espécie, região ou Poké Bola incompatíveis.'};
  const spent=spendKantoBallForAttempt(input.pocket,input.ballId,input.speciesId);
  if(spent.status!=='ok')return{status:'blocked',reason:spent.reason};
  return{
    status:'resolved',captured:captureRoll(input.seed)<projection.captureChance,
    ballId:projection.ballId,pocket:spent.pocket,chance:projection.captureChance
  };
}
