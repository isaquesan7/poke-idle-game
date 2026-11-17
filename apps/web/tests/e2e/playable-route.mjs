/** Teste de aceitação da rota /play servida pelo mesmo server.mjs do Railway. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../../../', import.meta.url);
const shots = new URL('artifacts/playable/', root);
await mkdir(shots,{recursive:true});
const PORT = 43117;
const BASE = 'http://127.0.0.1:' + PORT;
const SAVE = 'kanto-idle-play-v02';
const LEGACY = 'kanto-idle-lab-save-v01';
const server = spawn(process.execPath, [new URL('server.mjs',root).pathname], {
  cwd:root.pathname,
  env:{...process.env,PORT:String(PORT)},
  stdio:'pipe'
});
let stderr = '';
server.stderr.on('data',data => { stderr += data.toString(); });

async function ready() {
  for(let i=0;i<80;i++) {
    try { if((await fetch(BASE+'/health')).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('Servidor não iniciou: '+stderr);
}

async function exercise(browser, label, viewport) {
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({key})=>localStorage.setItem(key,'LEGACY-DO-NOT-TOUCH'),{key:LEGACY});
  const response=await page.goto(BASE+'/play',{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  await page.getByRole('heading',{name:'O começo da sua aventura.'}).waitFor();
  await page.getByLabel('Nome do treinador').fill('Treinador Teste');
  await page.getByRole('radio',{name:/Charmander/}).check();
  await page.getByRole('checkbox',{name:/modo demonstração/}).check();
  await page.getByRole('button',{name:'Começar aventura'}).click();
  await page.getByRole('heading',{name:'Bem-vindo de volta, Treinador Teste!'}).waitFor();

  // Pokédex inicial: 151 índices, 1 capturado e 150 ocultos.
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await page.getByRole('heading',{name:'Pokédex de Kanto'}).waitFor();
  assert.equal(await page.getByTestId('pokedex-grid').locator('button').count(),151);
  assert.equal(await page.getByTestId('pokedex-4').isDisabled(),false);
  assert.equal(await page.getByTestId('pokedex-150').isDisabled(),true);
  await page.getByLabel('Buscar na Pokédex').fill('Mewtwo');
  await page.getByText('Nenhum registro corresponde a esta busca.').waitFor();
  await page.getByLabel('Buscar na Pokédex').fill('#150');
  assert.equal(await page.getByTestId('pokedex-150').count(),1);
  await page.getByLabel('Buscar na Pokédex').fill('');
  await page.getByRole('button',{name:'Capturados',exact:true}).click();
  assert.equal(await page.getByTestId('pokedex-grid').locator('button').count(),1);
  await page.getByTestId('pokedex-4').click();
  await page.getByTestId('pokedex-detail').getByRole('heading',{name:'Charmander'}).waitFor();
  await page.getByRole('button',{name:'Fechar detalhes'}).click();
  await page.getByRole('button',{name:'Treinador',exact:true}).click();

  let snapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(snapshot.schemaVersion,2);
  assert.equal(snapshot.revision,0);
  assert.equal(JSON.parse(snapshot.journal.raw).roster[0].pokemonId,4);
  await page.getByRole('button',{name:'Treinador',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar ponto em ATK do treinador'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===1,SAVE);
  await page.getByRole('button',{name:'Pokémon',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar ponto em DEF do Pokémon'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===2,SAVE);
  snapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(JSON.parse(snapshot.journal.raw).trainer.manual.attack,1);
  assert.equal(JSON.parse(snapshot.journal.raw).roster[0].manual.defense,1);

  await page.getByRole('button',{name:'Expedição',exact:true}).click();
  await page.getByRole('button',{name:'Iniciar expedição'}).click();
  await page.getByRole('heading',{name:'Expedição em andamento'}).waitFor();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===3,SAVE);
  // Ensaio em navegador: acelera apenas o cursor do save de teste.
  // Não existe relógio confiável nem anti-cheat nesta versão local.
  await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    game.expedition.startedAt-=31000;
    game.expedition.lastClaimAt-=31000;
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Expedição',exact:true}).click();
  await page.getByRole('button',{name:'Resgatar recompensas'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===4,SAVE);
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const game=JSON.parse(after.journal.raw);
  assert.ok(game.coins>=221, 'Três ciclos devem render pelo menos 21 moedas na demo');
  assert.ok(game.trainer.xp>=12);
  assert.ok(game.roster[0].xp>=15);
  assert.equal(after.revision,4); // 2 pontos, start, claim
  assert.equal(after.journal.receipts.length,2);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  // Arena real: resultado deve vir do motor, nunca de um botão "ganhar".
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByRole('heading',{name:'Arena de batalha'}).waitFor();
  await page.getByRole('button',{name:'Batalhar contra Pokémon selvagem'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===5,SAVE);
  const fought=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const battleSave=JSON.parse(fought.journal.raw);
  assert.equal(battleSave.wins+battleSave.losses,1);
  assert.equal(fought.journal.revision,3);
  assert.equal(fought.journal.receipts.length,3);
  assert.ok(battleSave.seen.includes(battleSave.lastBattle.wildSpeciesId));
  assert.ok(battleSave.lastBattle.log.length>=2);
  assert.ok(battleSave.lastBattle.turns<=30);
  assert.equal(battleSave.lastBattle.battleId,'battle-v02-5');
  // A batalha já está salva, mas o diário deve revelar um evento por vez.
  await page.getByRole('heading',{name:'Batalha em andamento…'}).waitFor();
  const lines=page.getByTestId('battle-log').locator('li');
  assert.ok((await lines.count())<battleSave.lastBattle.log.length);
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-testid="battle-line-progress"]')?.textContent||'';
    return Number(text.split('/')[0])>=2;
  });
  assert.notEqual(await page.getByTestId('battle-clock').textContent(),'00:00.0');
  await page.getByRole('button',{name:'Pausar'}).click();
  const pausedLines=await lines.count();
  await page.waitForTimeout(550);
  assert.equal(await lines.count(),pausedLines,'pausa não pode avançar o diário');
  await page.getByRole('button',{name:'Continuar'}).click();
  await page.getByRole('button',{name:'Alterar velocidade da apresentação'}).click();
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('button',{name:'Reassistir à batalha'}).waitFor();
  assert.equal(await lines.count(),battleSave.lastBattle.log.length);
  const battleSaved=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  await page.getByRole('button',{name:'Reassistir à batalha'}).click();
  await page.getByRole('heading',{name:'Batalha em andamento…'}).waitFor();
  assert.ok((await lines.count())<battleSave.lastBattle.log.length);
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('button',{name:'Reassistir à batalha'}).waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE),battleSaved,
    'replay/pular não podem conceder recompensas novamente');
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await page.getByTestId('pokedex-'+battleSave.lastBattle.wildSpeciesId).waitFor();
  assert.equal(await page.getByTestId('pokedex-'+battleSave.lastBattle.wildSpeciesId).isDisabled(),false);
  await page.getByRole('button',{name:'Vistos',exact:true}).click();
  assert.equal(await page.getByTestId('pokedex-'+battleSave.lastBattle.wildSpeciesId).count(),
    battleSave.lastBattle.captured ? 0 : 1);
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByRole('heading',{name:'Diário de combate'}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByRole('heading',{name:'Diário de combate'}).waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  // Fixtures de TESTE: duas capturas da mesma espécie com UIDs/afinidades diferentes.
  // Nenhuma espécie é concedida no produto pelo botão; aqui simulamos o resultado
  // para testar montagem de equipe sem depender de sorte ou repetições de batalha.
  const [firstUid,secondUid]=await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    const template=game.roster[0];
    const firstUid=game.nextUid++, secondUid=game.nextUid++;
    const manual={hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0};
    game.roster.push(
      {...template,uid:firstUid,pokemonId:16,level:10,xp:0,affinity:12,manual,moveName:'gust',upgrades:{}},
      {...template,uid:secondUid,pokemonId:16,level:12,xp:0,affinity:89,manual:{...manual},moveName:'gust',upgrades:{}}
    );
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
    return [firstUid,secondUid];
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByRole('heading',{name:'Coleção Pokémon'}).waitFor();
  const first=page.getByTestId('pokemon-uid-'+firstUid);
  const second=page.getByTestId('pokemon-uid-'+secondUid);
  await first.waitFor();
  await second.waitFor();
  assert.equal(await first.getByRole('button',{name:'Adicionar UID '+firstUid+' à equipe'}).isDisabled(),true,
    'expedição ativa deve bloquear adições de membros');

  // Fechar expedição antes de mexer no time.
  await page.getByRole('button',{name:'Expedição',exact:true}).click();
  await page.getByRole('button',{name:'Encerrar expedição'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===6,SAVE);
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await first.getByRole('button',{name:'Adicionar UID '+firstUid+' à equipe'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===7,SAVE);
  await second.getByRole('button',{name:'Adicionar UID '+secondUid+' à equipe'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===8,SAVE);
  assert.equal(await page.getByRole('button',{name:'Adicionar UID '+firstUid+' à equipe'}).count(),0);
  await page.getByRole('button',{name:'Tornar líder UID '+firstUid,exact:true}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===9,SAVE);
  let teamSnapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  let teamGame=JSON.parse(teamSnapshot.journal.raw);
  assert.deepEqual(teamGame.team,[firstUid,1,secondUid]);
  assert.equal(teamGame.roster.filter(p=>p.pokemonId===16).length,2);

  // A seleção da espécie não deve misturar UIDs de treinamentos independentes.
  await page.getByLabel('Buscar Pokémon na coleção').fill('pidgey');
  assert.equal(await first.count(),1);
  assert.equal(await second.count(),1);
  await page.getByRole('button',{name:'Na equipe',exact:true}).click();
  assert.equal(await first.count(),1);
  await page.getByRole('button',{name:'Reserva',exact:true}).click();
  assert.equal(await first.count(),0);
  await page.getByRole('button',{name:'Todos',exact:true}).click();
  await second.getByRole('button',{name:'Treinar UID '+secondUid}).click();
  await page.getByText('Instância UID #'+secondUid).waitFor();
  await page.getByRole('button',{name:'Adicionar ponto em SPD do Pokémon'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===10,SAVE);
  teamSnapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  teamGame=JSON.parse(teamSnapshot.journal.raw);
  assert.equal(teamGame.roster.find(p=>p.uid===secondUid).manual.speed,1);
  assert.equal(teamGame.roster.find(p=>p.uid===firstUid).manual.speed,0);

  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByText('Líder:').waitFor();
  await page.getByRole('button',{name:'Batalhar contra Pokémon selvagem'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===11,SAVE);
  const last=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.ok(last.journal.receipts.at(-1).fingerprint.includes('"activeUid":'+firstUid),
    'Arena precisa combater com o UID promovido a líder');
  await page.reload();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  assert.equal(await page.getByTestId('pokemon-uid-'+firstUid).count(),1);
  assert.equal(await page.getByTestId('pokemon-uid-'+secondUid).count(),1);
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await page.getByRole('button',{name:'Capturados',exact:true}).click();
  assert.equal(await page.getByTestId('pokedex-16').count(),1,
    'Dois Pidgey por UID devem contar como uma espécie capturada');
  await page.getByTestId('pokedex-16').click();
  await page.getByTestId('pokedex-detail').getByRole('heading',{name:'Pidgey'}).waitFor();
  assert.equal((await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).team,SAVE))[0],firstUid);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  // Aprendizado FRLG e rank: Pokémon em equipe permanece com UID original.
  await page.getByRole('button',{name:'Pokémon',exact:true}).click();
  await page.getByRole('heading',{name:'Golpes do Pokémon'}).waitFor();
  await page.getByRole('button',{name:'Equipar golpe tackle'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===12,SAVE);
  await page.getByRole('button',{name:'Aprimorar golpe tackle'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===13,SAVE);
  const moved=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw),SAVE);
  assert.equal(moved.roster.find(p=>p.uid===firstUid).moveName,'tackle');
  assert.equal(moved.roster.find(p=>p.uid===firstUid).upgrades.tackle,1);
  assert.equal(moved.roster.find(p=>p.uid===secondUid).manual.speed,1);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  await page.screenshot({path:new URL(label+'-play.png',shots).pathname,fullPage:true,animations:'disabled'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,'Overflow horizontal em '+label+': '+overflow);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(label+': /play, golpes por nível/rank, replay com cronômetro, Pokédex, equipe e reload OK');
}

let browser;
try {
  await ready();
  assert.equal((await fetch(BASE+'/')).status,200,'protótipo v0.1 preservado na raiz');
  assert.equal((await fetch(BASE+'/health')).status,200);
  browser=await chromium.launch({headless:true});
  await exercise(browser,'desktop',{width:1365,height:768});
  await exercise(browser,'mobile',{width:390,height:844});
  console.log('PASS: experiência React jogável no servidor de produção');
} catch(error) {
  console.error(error);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
