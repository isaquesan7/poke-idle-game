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
export function webOnlineRoute(path,env=process.env){
 const route=onlineRoute(path);
 if(!route)return null;
 if(route.group==='base')return route;
 if(env.NODE_ENV==='production'&&env.ONLINE_RELEASE_MODE==='reviewed'&&
    env.ONLINE_PUBLIC_SAVES_ENABLED==='true'&&env.ONLINE_GATEWAY_FORWARD_MODE==='reviewed')return route;
 if(env.NODE_ENV!=='test'||(route.flag&&env[route.flag]!=='true'))return null;
 return route;
}
export function signedOnlineRoute(path){return onlineRoute(path)?.signed===true;}
