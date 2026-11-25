#!/usr/bin/env node
import {evaluateReleaseConfig} from '../src/releaseConfigPreflight.mjs';
try{
 if(process.argv.length!==3)throw Error();
 const result=evaluateReleaseConfig(process.argv[2]);
 console.log(JSON.stringify(result,null,2));
 if(!result.configShapeValid)process.exitCode=1;
}catch{
 console.error('Uso: node scripts/check-release-config.mjs api|web|gateway');
 process.exitCode=2;
}
