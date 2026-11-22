import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt=promisify(scryptCallback);
const PREFIX='scrypt-v1';
export function normalizeEmail(value){
  if(typeof value!=='string')throw new TypeError('E-mail inválido.');
  const email=value.trim().toLowerCase();
  if(email.length<5||email.length>254||!/^\S+@\S+\.\S+$/.test(email))
    throw new TypeError('E-mail inválido.');
  return email;
}
export function validatePassword(password){
  if(typeof password!=='string'||password.length<12||password.length>128
    ||password.includes('\0'))throw new TypeError('Use uma senha de 12 a 128 caracteres.');
  return password;
}
export function validateTrainerName(name){
  if(typeof name!=='string'||name.trim().length<2||name.trim().length>24
    ||/[\u0000-\u001f\u007f]/.test(name))
    throw new TypeError('Nome do treinador deve ter entre 2 e 24 caracteres.');
  return name.trim();
}
export async function hashPassword(password){
  validatePassword(password);
  const salt=randomBytes(24);
  const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:32*1024*1024});
  return [PREFIX,salt.toString('hex'),hash.toString('hex')].join('$');
}
export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||typeof encoded!=='string')return false;
  const bits=encoded.split('$');
  if(bits.length!==3||bits[0]!==PREFIX||!(/^[a-f\d]{48}$/).test(bits[1])
    ||!(/^[a-f\d]{128}$/).test(bits[2]))return false;
  const expected=Buffer.from(bits[2],'hex');
  const actual=await scrypt(password,Buffer.from(bits[1],'hex'),64,
    {N:16384,r:8,p:1,maxmem:32*1024*1024});
  return timingSafeEqual(actual,expected);
}
export function newSessionToken(){return randomBytes(32).toString('base64url');}
export function tokenDigest(token){return createHash('sha256').update(token).digest();}
export function sessionCookie(token,{secure=true,maxAge=604800}={}){
  const flags=[`__Host-kanto_session=${token}`,'HttpOnly','Path=/',
    'SameSite=Lax',`Max-Age=${maxAge}`];
  if(secure)flags.push('Secure');
  return flags.join('; ');
}
export function parseSessionCookie(cookie=''){
  const match=/(?:^|;\s*)__Host-kanto_session=([A-Za-z0-9_-]{30,100})(?:;|$)/.exec(cookie);
  return match?.[1]??null;
}
