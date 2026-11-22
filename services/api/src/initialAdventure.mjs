/** ONLINE-01C-3: first save created ONLY by the API.
 * Mirrors the currently approved non-demo /play starting policy (D064),
 * NOT copied from localStorage or arbitrary client JSON.
 * Future gameplay actions must be validated server-side before writing.
 */
import {randomUUID} from 'node:crypto';

const STATS=['hp','attack','defense','specialAttack','specialDefense','speed'];
export const STARTER_SPECIES=Object.freeze([1,4,7]);
const blankStats=()=>Object.fromEntries(STATS.map(key=>[key,0]));

export function initialAdventure({trainerName,starterId,nowMs}){
  if(typeof trainerName!=='string'||trainerName.trim().length<2
    ||trainerName.trim().length>24)
    throw new TypeError('Nome de treinador inválido');
  if(!STARTER_SPECIES.includes(starterId))
    throw new TypeError('Inicial inválido');
  if(!Number.isSafeInteger(nowMs)||nowMs<0)
    throw new TypeError('Instante do servidor inválido');
  return {
    version:1,mode:'normal',createdAt:nowMs,name:trainerName.trim(),
    trainer:{level:1,xp:0,manual:blankStats(),equipped:{},title:'aprendiz'},
    coins:0,wins:0,losses:0,seen:[starterId],
    caughtSpecies:[starterId],evolutionStones:{},evolutionTestKitClaimed:false,
    badges:[],
    roster:[{
      uid:1,pokemonId:starterId,level:1,xp:0,manual:blankStats(),
      affinity:0,moveName:starterId===4?'scratch':'tackle',upgrades:{},
      battleRecord:{wins:0,draws:0,losses:0},
      affinityLastUsedAt:nowMs,affinityIdleDaysApplied:0
    }],
    team:[1],nextUid:2,expedition:null,lastClaim:null,
    ballPocket:{version:1,quantities:{'poke-ball':12}},
    expeditionBallProgress:{'poke-ball':0,'great-ball':0,'ultra-ball':0},
    regionWins:Array(10).fill(0)
  };
}
export function firstSave(trainerName,starterId,nowMs){
  const raw=JSON.stringify(initialAdventure({trainerName,starterId,nowMs}));
  return {schemaVersion:2,revision:0,
    journal:{raw,revision:0,receipts:[]}};
}
/** Account identity comes from a verified server session, not request JSON.
 * The only user-controlled field here is starterId, checked against Kanto 1/4/7.
 * Inserts save and receipt together under a PostgreSQL transaction.
 */
export async function createFirstAdventure(pool,{accountId,trainerName,starterId,nowMs}){
  const snapshot=firstSave(trainerName,starterId,nowMs);
  if(typeof accountId!=='string'||!(/^[0-9a-f-]{36}$/i).test(accountId))
    throw new TypeError('Conta inválida');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const inserted=await client.query(
      `INSERT INTO game_saves(account_id,schema_version,revision,state)
       VALUES($1,2,0,$2::jsonb)
       ON CONFLICT(account_id) DO NOTHING RETURNING account_id`,
      [accountId,JSON.stringify(snapshot)]);
    if(!inserted.rowCount){
      await client.query('ROLLBACK');
      return {status:'exists'};
    }
    await client.query(
      `INSERT INTO game_action_receipts
       (account_id,action_id,kind,save_revision)
       VALUES($1,'adventure:create:v1','adventure-initialization',0)`,
      [accountId]);
    await client.query('COMMIT');
    return {status:'created',snapshot};
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}
