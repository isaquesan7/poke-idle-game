/** D6J — public route metadata shared by Web and API. No secrets, DB, or release switch. */
const groups=[
 ['base',null,['GET status','GET me','GET save','POST auth/register','POST auth/verify','POST auth/login','POST auth/logout','POST auth/request-reset','POST auth/confirm-reset','POST adventure/start','POST trainer/invest']],
 ['collection',null,['POST collection/team']],
 ['region',null,['GET region/current','POST region/reserve','POST region/start','POST region/turn','POST region/certify','POST region/settle','POST region/finish']],
 ['expedition','ONLINE_EXPEDITION_CI_ONLY',['GET expedition/current','POST expedition/start','POST expedition/claim','POST expedition/stop']],
 ['shop','ONLINE_SHOP_CI_ONLY',['GET shop/current','POST shop/purchase']],
 ['moves','ONLINE_MOVES_CI_ONLY',['GET moves/current','POST moves/equip','POST moves/upgrade']],
 ['evolution','ONLINE_EVOLUTION_CI_ONLY',['GET evolution/current','POST evolution/evolve']],
 ['pokemon-training','ONLINE_POKEMON_TRAINING_CI_ONLY',['GET pokemon-training/current','POST pokemon-training/train']],
 ['pokedex','ONLINE_POKEDEX_CI_ONLY',['GET pokedex/current']],
 ['inventory','ONLINE_TRAINER_LOADOUT_CI_ONLY',['GET inventory/current','POST inventory/loadout']],
 ['tm','ONLINE_TM_CI_ONLY',['GET tm/current','POST tm/teach']],
 ['mega','ONLINE_MEGA_CI_ONLY',['GET mega/current','POST mega/challenge','POST mega/evolve']],
 ['arena','ONLINE_ARENA_CI_ONLY',['GET arena/current','POST arena/start','POST arena/challenge','POST arena/abandon']],
 ['mastery','ONLINE_MASTERY_CI_ONLY',['GET mastery/current','POST mastery/research']],
 ['gym','ONLINE_GYM_PORTAL_CI_ONLY',['GET gym/current','POST gym/reserve','POST gym/start','POST gym/turn','POST gym/certify','POST gym/settle']]
];
export const CI_FEATURE_FLAGS=Object.freeze(groups.flatMap(([,flag])=>flag?[flag]:[]));
export const ONLINE_ROUTES=Object.freeze(groups.flatMap(([group,flag,entries])=>entries.map(entry=>{
 const [method,name]=entry.split(' ');
 return Object.freeze({path:'/api/v1/'+name,method,group,flag,signed:group==='base'&&name.startsWith('auth/')&&name!=='auth/logout'});
})));
const byPath=new Map(ONLINE_ROUTES.map(route=>[route.path,route]));
export function onlineRoute(path){return byPath.get(path)??null;}
export function onlineRouteGroup(path,group){return onlineRoute(path)?.group===group;}
export function privateHomologationRole(role,env=process.env){
 const ids=role==='web'?['5e70b6da-2aaa-4d6b-add7-3c69ac44b986','41df5039-d980-437a-ab9c-66b827695c67','53c40d91-e1b5-453f-8950-c43efdac694c']:
 role==='gateway'?['b1031f8b-66bb-4173-9cbf-0fec206a6f2d','7d4158a4-b017-4cdb-bb0c-0e7119e27606','900db0b8-af72-4bb7-8477-18e331e951fa']:null;
 return !!ids&&env.NODE_ENV==='production'&&env.RAILWAY_ENVIRONMENT_NAME==='homologacao'&&
  env.RAILWAY_PROJECT_ID===ids[0]&&env.RAILWAY_ENVIRONMENT_ID===ids[1]&&env.RAILWAY_SERVICE_ID===ids[2]&&
  env.ONLINE_HOMOLOGATION_ENABLED==='true'&&env.ONLINE_PUBLIC_SAVES_ENABLED==='false'&&
  env.ONLINE_RELEASE_MODE===undefined&&env.ONLINE_REGISTRATION_ENABLED!== 'true';
}
export function webOnlineRoute(path,env=process.env){
 const route=onlineRoute(path);
 if(!route)return null;
 if(route.group==='base')return route;
 if(privateHomologationRole('web',env)&&env.ONLINE_GATEWAY_FORWARD_MODE==='reviewed')return route;
 if(env.NODE_ENV==='production'&&env.ONLINE_RELEASE_MODE==='reviewed'&&
    env.ONLINE_PUBLIC_SAVES_ENABLED==='true'&&env.ONLINE_GATEWAY_FORWARD_MODE==='reviewed')return route;
 if(env.NODE_ENV!=='test'||(route.flag&&env[route.flag]!=='true'))return null;
 return route;
}
export function signedOnlineRoute(path){return onlineRoute(path)?.signed===true;}
