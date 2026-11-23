/** Build the exact canonical frozen battle adapter for a Node-only API image.
 * Requires the monorepo's pinned esbuild (transitive Vite build dependency);
 * never downloads/builds packages in the runtime container.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const output=resolve(process.argv[2]??'services/api/game-core/frozenBattle.mjs');
mkdirSync(dirname(output),{recursive:true});
const command=process.platform==='win32'?'node_modules/.bin/esbuild.cmd':'node_modules/.bin/esbuild';
const result=spawnSync(resolve(command),[
  'packages/game-core/src/combat/serverFrozenBattle.ts',
  '--bundle','--platform=node','--format=esm','--target=node22',
  '--legal-comments=none','--outfile='+output
],{cwd:resolve(import.meta.dirname,'..'),stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
