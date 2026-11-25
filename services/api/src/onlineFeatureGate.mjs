/** D6G — centralized CI-only feature policy. No production activation path. */
import {CI_FEATURE_FLAGS} from './onlineRoutePolicy.mjs';
export {CI_FEATURE_FLAGS};
export function disposableOnlineDatabase(env=process.env){
  try{
    const db=new URL(env.DATABASE_URL);
    return db.protocol==='postgresql:'&&db.hostname==='127.0.0.1'&&db.port==='55432'&&
      db.username==='kanto_ci'&&db.pathname==='/kanto_ci'&&!db.search;
  }catch{return false;}
}
export function ciOnlineFeatureEnabled(flag,env=process.env){
  return CI_FEATURE_FLAGS.includes(flag)&&env.NODE_ENV==='test'&&
    env.ONLINE_REGISTRATION_ENABLED==='true'&&env[flag]==='true'&&
    disposableOnlineDatabase(env);
}
