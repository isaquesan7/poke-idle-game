#!/usr/bin/env node
/** Offline evidence checker. Input is a local, sanitized JSON file only. */
import {readFileSync} from 'node:fs';
import {evaluateBetaReadiness} from '../src/betaReadiness.mjs';
const file=process.argv[2];
if(!file||process.argv.length!==3){
  console.error('Uso: node scripts/check-beta-readiness.mjs <evidencias-sanitizadas.json>');
  process.exitCode=2;
}else{
  try{
    const input=JSON.parse(readFileSync(file,'utf8'));
    const result=evaluateBetaReadiness(input);
    console.log(JSON.stringify(result,null,2));
    if(!result.ready)process.exitCode=1;
  }catch{
    // No filenames, raw payloads, stack traces, tokens or credentials in errors.
    console.error('Falha ao ler ou validar evidências JSON locais.');
    process.exitCode=2;
  }
}
