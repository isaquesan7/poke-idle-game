/** Private owner-only homologation, bound to the already isolated Railway deployment.
 * Public release and CI authorization remain independent.
 */
import {evaluateReleaseConfig} from './releaseConfigPreflight.mjs';
export const HOMOLOGATION_OWNER='owner@homologacao.invalid';
const identity=Object.freeze({
 project:'5e70b6da-2aaa-4d6b-add7-3c69ac44b986',
 environment:'41df5039-d980-437a-ab9c-66b827695c67',
 api:'523ef5c2-4a8c-41da-9d3b-37733cd8f9aa',
 web:'53c40d91-e1b5-453f-8950-c43efdac694c',
 gatewayProject:'b1031f8b-66bb-4173-9cbf-0fec206a6f2d',
 gatewayEnvironment:'7d4158a4-b017-4cdb-bb0c-0e7119e27606',
 gateway:'900db0b8-af72-4bb7-8477-18e331e951fa'
});
export function assertHomologationApiScope(env=process.env){
 const db=new URL(env.DATABASE_URL??'');
 if(env.NODE_ENV!=='production'||env.RAILWAY_PROJECT_ID!==identity.project||
   env.RAILWAY_ENVIRONMENT_ID!==identity.environment||env.RAILWAY_SERVICE_ID!==identity.api||
   env.RAILWAY_ENVIRONMENT_NAME!=='homologacao'||env.ONLINE_RELEASE_MODE!==undefined||
   env.ONLINE_PUBLIC_SAVES_ENABLED!=='false'||env.ONLINE_REGISTRATION_ENABLED!=='false'||
   !['postgres:','postgresql:'].includes(db.protocol)||db.hostname!=='postgres.railway.internal'||
   !db.username||!db.password||db.pathname.length<2||db.hash)
   throw Error('Private homologation scope rejected');
}
export function assertHomologationRuntime(env=process.env){
 assertHomologationApiScope(env);
 const config=evaluateReleaseConfig('api',env);
 if(config.blockers.some(id=>id!=='resend-config')||env.ACCOUNT_MAIL_MODE!=='off'||
   env.RESEND_API_KEY!==undefined||env.MAIL_FROM!==undefined||
   !/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(env.APP_ORIGIN??''))
   throw Error('Private homologation configuration rejected');
}
export async function assertHomologationOwner(pool){
 const result=await pool.query(`SELECT a.email,a.email_verified_at,a.disabled_at,p.account_id
 FROM game_accounts a LEFT JOIN game_profiles p ON p.account_id=a.id LIMIT 2`);
 if(result.rows.length!==1||result.rows[0].email!==HOMOLOGATION_OWNER||
   !result.rows[0].email_verified_at||result.rows[0].disabled_at||!result.rows[0].account_id)
   throw Error('Private homologation requires exactly one provisioned owner account');
}
