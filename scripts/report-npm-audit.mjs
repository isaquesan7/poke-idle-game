#!/usr/bin/env node
/**
 * D-040: classificador de relatórios npm audit (somente leitura).
 * Separa dependências de runtime das ferramentas de desenvolvimento,
 * sem atualizar versões ou tratar severidade como prova de exploração.
 */
import {readFileSync,writeFileSync} from 'node:fs';

const SEVERITIES=['critical','high','moderate','low','info'];
const safe=(value)=>typeof value==='string'?value:'desconhecido';

function readReport(path){
  const report=JSON.parse(readFileSync(path,'utf8'));
  if(!report||typeof report!=='object'||Array.isArray(report)
    ||report.error||!report.vulnerabilities
    ||typeof report.vulnerabilities!=='object')
    throw new Error('npm audit indisponível ou JSON sem vulnerabilities: '+path);
  return report;
}
function row(name,details){
  const via=Array.isArray(details.via)?details.via:[];
  const advisories=via.filter(entry=>typeof entry==='object'&&entry!==null)
    .map(entry=>({title:safe(entry.title),url:safe(entry.url)}));
  return {
    package:name,severity:safe(details.severity),
    direct:details.isDirect===true,range:safe(details.range),
    fix:details.fixAvailable===false?'sem correção automática'
      :details.fixAvailable===true?'npm audit fix disponível'
        :details.fixAvailable&&typeof details.fixAvailable==='object'
          ?'requer '+safe(details.fixAvailable.name)+'@'+safe(details.fixAvailable.version)
          :'indefinida',
    advisories
  };
}
function summarize(report){
  const rows=Object.entries(report.vulnerabilities)
    .map(([name,details])=>row(name,details))
    .sort((a,b)=>SEVERITIES.indexOf(a.severity)-SEVERITIES.indexOf(b.severity)
      ||a.package.localeCompare(b.package));
  const bySeverity=Object.fromEntries(SEVERITIES.map(severity=>[
    severity,rows.filter(item=>item.severity===severity).length
  ]));
  return {total:rows.length,bySeverity,direct:rows.filter(item=>item.direct).length,rows};
}
function markdown(runtime,all){
  const head=[
    '# D-040 — Inventário npm audit (pré-beta)',
    '',
    'Leitura do lockfile vigente; vulnerabilidade reportada não comprova impacto explorável no jogo.',
    'Não atualizar pacotes automaticamente, especialmente com `npm audit fix --force`.',
    '',
    '| Escopo | Total | Crítico | Alto | Moderado | Baixo | Diretas |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...[['Produção (`--omit=dev`)',runtime],['Todas as dependências',all]].map(([label,r])=>
      '| '+label+' | '+r.total+' | '+r.bySeverity.critical+' | '+r.bySeverity.high+
      ' | '+r.bySeverity.moderate+' | '+r.bySeverity.low+' | '+r.direct+' |'),
    '',
    '## Dependências em produção',
    ''
  ];
  const prod=runtime.rows.length?runtime.rows.map(r=>
    '- **'+r.package+'** ('+r.severity+', '+(r.direct?'direta':'transitiva')+
    ', faixa `'+r.range+'`): '+r.fix+
    (r.advisories.length?' — '+r.advisories.map(a=>a.title).join('; '):'')):
    ['Nenhuma entrada de vulnerabilidade reportada pelo npm audit no escopo de produção.'];
  const dev=all.rows.filter(r=>!runtime.rows.some(p=>p.package===r.package));
  return [...head,...prod,'','## Apenas no inventário completo (tipicamente desenvolvimento)','',
    ...(dev.length?dev.map(r=>'- **'+r.package+'** ('+r.severity+'): '+r.fix):
      ['Nenhuma entrada adicional.']),
    '',
    '## Pendências para decisão humana','',
    '- Verificar caminho de dependências, exposição real, versões corrigidas e changelogs.',
    '- Executar TypeScript, Vitest, build, E2E desktop/mobile e GIFs antes de atualizar lockfile.',
    '- Repetir auditoria ao preparar beta; este resultado é um snapshot temporal.',
    ''
  ].join('\n');
}

const [allPath,prodPath,outputPath='audit-summary.md']=process.argv.slice(2);
if(!allPath||!prodPath){
  process.stderr.write('Uso: node scripts/report-npm-audit.mjs <all.json> <prod.json> [saida.md]\n');
  process.exitCode=2;
}else{
  try{
    const all=summarize(readReport(allPath));
    const production=summarize(readReport(prodPath));
    const report=markdown(production,all);
    writeFileSync(outputPath,report,'utf8');
    process.stdout.write(report+'\n');
  }catch(error){
    process.stderr.write('Auditoria inconclusiva: '+String(error)+'\n');
    process.exitCode=2;
  }
}
