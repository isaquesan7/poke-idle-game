/** D6G — centralized CI-only feature policy. No production activation path. */
export const CI_FEATURE_FLAGS=Object.freeze([
  'ONLINE_EXPEDITION_CI_ONLY',
  'ONLINE_SHOP_CI_ONLY',
  'ONLINE_MOVES_CI_ONLY',
  'ONLINE_EVOLUTION_CI_ONLY',
  'ONLINE_POKEMON_TRAINING_CI_ONLY',
  'ONLINE_POKEDEX_CI_ONLY',
  'ONLINE_TRAINER_LOADOUT_CI_ONLY',
  'ONLINE_GYM_PORTAL_CI_ONLY'
]);
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
