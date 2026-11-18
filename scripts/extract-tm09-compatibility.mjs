/** D-049: extrator OFFLINE. Não altera catálogo, combate ou saves. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SOURCE=Object.freeze({
 commit:'ac2f1acb055026e3dff1e0aca743bb46256a810a',
 blob:'f66f614adf535af6940c65f434efe5ddeec4687a',
 versionGroup:7, method:4, move:331, speciesMin:1, speciesMax:151
});

/** Calcula o SHA-1 do objeto Git blob, incluindo cabeçalho e bytes originais. */
export function gitBlobSha(bytes){
 return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
}

/** Extrai apenas compatibilidade machine FRLG do CSV verificado; falha fechado. */
export function extractTm09(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/), ids=new Set();
 let scanned=0, matchingRows=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line||line==='pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order')continue;
  const fields=line.split(',');
  if(fields.length!==6||!fields.every(x=>/^\d+$/.test(x.trim())))
   throw new Error(`Linha CSV inválida ${i+1}`);
  scanned++;
  const [pokemon,version,move,method]=fields.map(Number);
  if(pokemon>=SOURCE.speciesMin&&pokemon<=SOURCE.speciesMax&&
    version===SOURCE.versionGroup&&move===SOURCE.move&&method===SOURCE.method){
   matchingRows++;
   if(ids.has(pokemon))throw new Error(`Duplicata TM09 espécie ${pokemon}`);
   ids.add(pokemon);
  }
 }
 if(scanned===0||matchingRows===0)throw new Error('CSV vazio ou sem TM09 — falhar fechado');
 return Object.freeze({
  status:'verified-snapshot-only-not-released',
  sourceCommit:SOURCE.commit,sourceGitBlobSha:SOURCE.blob,
  versionGroupId:SOURCE.versionGroup,learnMethodId:SOURCE.method,moveId:SOURCE.move,
  rowsScanned:scanned,matchingRows,pokemonIds:[...ids].sort((a,b)=>a-b)
 });
}

/** Lê dados locais, confere hash ANTES de gravar novo artefato. */
export async function generate(input,output){
 const bytes=await readFile(input), actual=gitBlobSha(bytes);
 if(actual!==SOURCE.blob)throw new Error(`Snapshot divergente: blob Git ${actual}, esperado ${SOURCE.blob}`);
 const result=extractTm09(bytes.toString('utf8'));
 await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);
 if(!input||!output){
  console.error('Uso: node scripts/extract-tm09-compatibility.mjs <pokemon_moves.csv local> <saida.json nova>');
  process.exitCode=2;
 }else{
  generate(input,output)
   .then(result=>console.info(`Elegibilidade auditada: ${result.pokemonIds.length} IDs; SEM desbloqueio.`))
   .catch(error=>{console.error(error.message);process.exitCode=1;});
 }
}
