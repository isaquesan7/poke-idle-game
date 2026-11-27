/** Offline source-pinned FRLG catalogue compatibility, not a runtime grant. */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {gitBlobSha,SOURCE} from './extract-tm09-compatibility.mjs';
const MACHINE_BLOB='0ccca49159ef5fde36026f0503296ef766d39ee6';
export function extractKantoTms(machineText,learnsetText){
 const machines=new Map();
 for(const [i,line] of machineText.trim().split(/\r?\n/).entries()){
  if(i===0){if(line!=='machine_number,version_group_id,item_id,move_id')throw Error('Invalid machines header');continue;}
  const f=line.split(',');
  if(f.length!==4||!f.every(v=>/^\d+$/.test(v)))throw Error('Invalid machine row');
  const [n,v,item,move]=f.map(Number);
  if(v!==7||n<1||n>50)continue;
  if(machines.has(move)||[...machines.values()].some(x=>x.number===n||x.itemId===item))throw Error('Duplicate machine');
  machines.set(move,{number:n,itemId:item,moveId:move,speciesIds:new Set()});
 }
 if(machines.size!==50)throw Error('Incomplete FRLG machines');
 // The pinned source may carry additional columns (e.g. mastery).
 // Resolve required fields by exact header names, not fixed row width.
 const [header,...lines]=learnsetText.trim().split(/\r?\n/);
 const columns=header.split(',').map(x=>x.trim());
 const required=['pokemon_id','version_group_id','move_id','pokemon_move_method_id','level'];
 const indices=required.map(x=>columns.indexOf(x));
 if(new Set(columns).size!==columns.length||indices.some(i=>i<0))throw Error('Invalid learnset header: '+header);
 let scanned=0;
 for(const [i,line] of lines.entries()){
  const f=line.split(',');
  if(f.length!==columns.length||!indices.slice(0,4).every(j=>/^\d+$/.test(f[j].trim())))throw Error('Invalid learnset row '+(i+2));
  scanned++;
  const [species,version,move,method]=indices.slice(0,4).map(j=>Number(f[j]));
  const levelText=f[indices[4]].trim();
  if(!/^\d*$/.test(levelText))throw Error('Invalid level '+(i+2));
  const level=levelText===''?null:Number(levelText);
  if(species<1||species>151||version!==7||method!==4)continue;
  const tm=machines.get(move);if(!tm)continue;
  if(level!==0||tm.speciesIds.has(species))throw Error('Invalid or duplicate compatibility');
  tm.speciesIds.add(species);
 }
 if(scanned===0)throw Error('Empty learnset');
 const result=[...machines.values()].sort((a,b)=>a.number-b.number).map(x=>({...x,speciesIds:[...x.speciesIds].sort((a,b)=>a-b)}));
 if(result.some(x=>!x.speciesIds.length))throw Error('Incomplete FRLG compatibility');
 return result;
}
export async function generate(machinePath,learnsetPath,output){
 const [m,p]=await Promise.all([readFile(machinePath),readFile(learnsetPath)]);
 if(gitBlobSha(m)!==MACHINE_BLOB||gitBlobSha(p)!==SOURCE.blob)throw Error('Pinned PokéAPI blob mismatch');
 const machines=extractKantoTms(m.toString('utf8'),p.toString('utf8'));
 const result={sourceCommit:SOURCE.commit,machinesBlob:MACHINE_BLOB,pokemonMovesBlob:SOURCE.blob,versionGroupId:7,learnMethodId:4,machines};
 await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 // Compact, independently inspectable output for CI review; not a live game write.
 for(const tm of machines)console.log('TM_SNAPSHOT '+JSON.stringify(tm));
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [m,p,out]=process.argv.slice(2);
 if(!m||!p||!out){console.error('Usage: node scripts/extract-kanto-tms.mjs machines.csv pokemon_moves.csv output.json');process.exitCode=1;}
 else generate(m,p,out).catch(e=>{console.error(e.message);process.exitCode=1;});
}
