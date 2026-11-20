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
  // D-051: avatar original presente; slot responde a foco e exibe bônus sob demanda.
  const avatar=page.getByRole('img',{name:'Personagem original do treinador Kanto'});
  await avatar.waitFor();
  await page.waitForFunction(()=>{
    const portrait=document.querySelector('img[alt="Personagem original do treinador Kanto"]');
    return portrait?.complete&&portrait.naturalWidth>0;
  });
  // D-051: ícones Font Awesome presentes, título bloqueado indisponível.
  await page.locator('.fa-solid.fa-user').first().waitFor();
  const titleSelect=page.getByRole('button',{name:'Título ativo do treinador'});
  assert.equal(await titleSelect.getAttribute('aria-expanded'),'false');
  await titleSelect.click();
  const choices=page.getByRole('group',{name:'Escolher título do treinador'});
  await choices.getByRole('button',{name:/Aprendiz de Kanto, bônus HP \+1/}).hover();
  await choices.getByText('Bônus: HP +1').waitFor();
  await page.screenshot({path:new URL('trainer-title-list-'+label+'.png',shots).pathname,fullPage:true});
  for(const title of ['Veterano da Arena','Explorador de Kanto','Mestre de Ginásios']){
    assert.equal(await choices.getByRole('button',{name:new RegExp('^'+title)}).getAttribute('aria-disabled'),'true');
  }
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,0);
  await titleSelect.click();
  const boulder=page.getByLabel('Rocha bloqueada. 1 vitórias. Bônus: DEF +1');
  await boulder.focus();
  await boulder.getByText('Bônus: DEF +1').waitFor();
  await page.screenshot({path:new URL('trainer-badge-tooltip-'+label+'.png',shots).pathname,fullPage:true});
  await page.evaluate(()=>{const current=document.activeElement;if(current instanceof HTMLElement)current.blur();});
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,0);
  // D-051: captura de referência REAL do Perfil para revisão desktop/mobile.
  await page.screenshot({path:new URL('trainer-'+label+'.png',shots).pathname,fullPage:true});
  const hat=page.getByRole('button',{name:'Chapéu · Vazio'});
  await hat.focus();
  await hat.getByText('Sem equipamento',{exact:true}).waitFor();
  // D-052: mochila começa com dez cubos; sem criar itens artificiais.
  await page.getByRole('button',{name:'Mochila',exact:true}).click();
  await page.getByRole('region',{name:'Mochila'}).getByText('0 / 10').waitFor();
  assert.equal(await page.getByRole('img',{name:/Espaço vazio/}).count(),10);
  await page.screenshot({path:new URL('inventory-bag-'+label+'.png',shots).pathname,fullPage:true});
  await page.getByRole('button',{name:'Equipamentos',exact:true}).click();
  await page.screenshot({path:new URL('inventory-equipment-'+label+'.png',shots).pathname,fullPage:true});
  await page.getByRole('button',{name:'Boné de Kanto, Não equipado. Abrir detalhes'}).click();
  await page.getByRole('dialog',{name:'Boné de Kanto'}).waitFor();
  assert.equal(await page.getByRole('dialog',{name:'Boné de Kanto'}).evaluate(dialog=>dialog.parentElement?.parentElement===document.body),true);
  assert.ok(await page.getByRole('dialog',{name:'Boné de Kanto'}).evaluate(dialog=>
    Number(getComputedStyle(dialog.parentElement).zIndex)>9999),'Modal deve cobrir botões do jogo');
  await page.getByRole('dialog',{name:'Boné de Kanto'}).getByText('HP +2').waitFor();
  await page.getByRole('dialog',{name:'Boné de Kanto'}).getByRole('button',{name:'Cancelar'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,0);
  await page.getByRole('button',{name:'Perfil',exact:true}).click();
  // D-050: clicar em +1 altera apenas a prévia; nenhum ponto é salvo sem confirmar.
  await page.getByRole('button',{name:'Pré-visualizar +1 em ATK'}).click();
  await page.getByRole('button',{name:'Retirar um ponto da prévia de ATK'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,0);
  await page.getByRole('button',{name:'Pré-visualizar +1 em ATK'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,0);
  await page.getByRole('button',{name:'Cancelar'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,0);
  await page.getByRole('button',{name:'Pré-visualizar +1 em ATK'}).click();
  await page.getByRole('button',{name:'Confirmar distribuição'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===1,SAVE);
  assert.equal(await page.getByText('Progresso salvo neste navegador.').count(),0);
  await page.getByRole('button',{name:'Pokémon',exact:true}).click();
  // D-055: perfil novo usa GIF original e mantém comandos de progresso inalterados.
  await page.getByRole('heading',{name:'Perfil do Pokémon'}).waitFor();
  const pokemonProfile=page.locator('[class*="pokemonWorkspace"]');
  await pokemonProfile.getByRole('img',{name:/charmander/i}).waitFor();
  await page.getByRole('progressbar',{name:'Afinidade do Pokémon'}).waitFor();
  const pokemonTabs=pokemonProfile.getByRole('navigation',{name:'Seções do Pokémon'});
  assert.equal(await pokemonTabs.getByRole('button').count(),3);
  assert.equal(await pokemonTabs.getByRole('button',{name:'Perfil'}).getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#pokemon-attributes').count(),1);
  assert.equal(await page.locator('#pokemon-evolution').count(),0);
  assert.equal(await page.locator('#pokemon-moves').count(),0);
  const untouchedRevision=(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision;
  await pokemonTabs.getByRole('button',{name:'Evolução'}).click();
  await page.getByRole('region',{name:'Evolução do Pokémon'}).waitFor();
  await page.getByText('Treine seu Pokémon para que ele possa evoluir.').waitFor();
  assert.equal(await page.getByText('Receber kit de pedras (teste)').count(),0);
  assert.equal(await page.getByText('Pedras:',{exact:false}).count(),0);
  assert.equal(await page.locator('#pokemon-attributes').count(),0);
  assert.equal(await page.locator('#pokemon-moves').count(),0);
  assert.equal(await page.locator('[class*="pokemonHero"]').count(),0);
  await page.screenshot({path:new URL('pokemon-evolution-'+label+'.png',shots).pathname,fullPage:true});
  await pokemonTabs.getByRole('button',{name:'Golpes'}).click();
  await page.getByRole('region',{name:'Treinar golpes do Pokémon'}).waitFor();
  await page.getByRole('heading',{name:'Golpes equipados'}).waitFor();
  await page.getByRole('heading',{name:'Golpes aprendidos'}).waitFor();
  await page.getByText('Custo do próximo aprimoramento: 1 ponto',{exact:false}).first().waitFor();
  const primaryMove=(await page.locator('[data-testid="equipped-moves"]').innerText()).toLowerCase();
  assert.ok(primaryMove.includes('equipado')||primaryMove.includes('principal'));
  assert.equal(await page.getByText('SP de combate por encontro:',{exact:false}).count(),0);
  assert.equal(await page.getByText('Recorte de movimentos por nível',{exact:false}).count(),0);
  assert.equal(await page.locator('#pokemon-attributes').count(),0);
  assert.equal(await page.locator('#pokemon-evolution').count(),0);
  await page.screenshot({path:new URL('pokemon-moves-'+label+'.png',shots).pathname,fullPage:true});
  await pokemonTabs.getByRole('button',{name:'Perfil'}).click();
  await page.locator('#pokemon-attributes').waitFor();
  assert.equal(await page.locator('#pokemon-evolution').count(),0);
  assert.equal(await page.locator('#pokemon-moves').count(),0);
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,untouchedRevision,
    'Trocar telas Pokémon não pode gerar revisão no save');
  await page.waitForFunction(()=>{
    const hero=document.querySelector('[class*="pokemonHero"] img');
    return hero?.complete && hero.naturalWidth>0;
  });
  await page.screenshot({path:new URL('pokemon-profile-'+label+'.png',shots).pathname,fullPage:true});
  if(label==='desktop'){
    const coords=await page.locator('[class*="pokemonHero"]').boundingBox();
    const training=await page.getByRole('region',{name:'Treinamento Pokémon'}).boundingBox();
    assert.ok(coords&&training&&Math.abs(coords.y-training.y)<70&&training.x>coords.x,
      'Perfil e Treinamento precisam ficar lado a lado no desktop');
  }
  const pokemonTrain=page.getByRole('region',{name:'Treinamento Pokémon'});
  const pointRevision=(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision;
  // HP usa o cálculo real do core (+2 HP final por ponto manual).
  const hpButton=pokemonTrain.getByRole('button',{name:'Pré-visualizar +1 em HP'});
  const hpRow=hpButton.locator('xpath=../..');
  const hpBefore=Number(await hpRow.locator('strong').innerText());
  await hpButton.click();
  await hpRow.getByText('+ 1 → '+(hpBefore+2)).waitFor();
  await pokemonTrain.getByRole('button',{name:'Retirar um ponto da prévia de HP'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,pointRevision);
  await pokemonTrain.getByRole('button',{name:'Pré-visualizar +1 em DEF'}).click();
  await pokemonTrain.getByRole('button',{name:'Retirar um ponto da prévia de DEF'}).click();
  await pokemonTrain.getByRole('button',{name:'Pré-visualizar +1 em DEF'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,pointRevision);
  await pokemonTrain.getByRole('button',{name:'Cancelar'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,pointRevision);
  await pokemonTrain.getByRole('button',{name:'Pré-visualizar +1 em DEF'}).click();
  await pokemonTrain.getByRole('button',{name:'Confirmar distribuição'}).click();
  await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key))?.revision===revision+1,{key:SAVE,revision:pointRevision});
  // O efeito do golpe só aparece na tela exclusiva de Golpes.
  await pokemonTabs.getByRole('button',{name:'Golpes'}).click();
  await page.getByText('10% de queimadura').waitFor();
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
  // A trilha visual é persistida na mesma transação da batalha.
  const visual=battleSave.lastBattle;
  assert.equal(visual.frames.length,visual.log.length);
  assert.equal(visual.frames[0].playerHp,visual.playerMaxHp);
  assert.equal(visual.frames[0].wildHp,visual.wildMaxHp);
  assert.equal(visual.frames.at(-1).playerHp,visual.playerRemainingHp);
  assert.equal(visual.frames.at(-1).wildHp,visual.wildRemainingHp);
  assert.ok(visual.playerMaxSp>=50&&visual.playerMaxSp<=100);
  assert.ok(visual.wildMaxSp>=50&&visual.wildMaxSp<=100);
  assert.ok(visual.frames.filter(frame=>frame.kind==='focus'&&frame.actor==='player').length<=2);
  assert.ok(visual.frames.filter(frame=>frame.kind==='focus'&&frame.actor==='wild').length<=2);
  for(const frame of visual.frames.filter(frame=>frame.kind==='focus')){
    assert.ok(frame.spRecovery>0);
    assert.equal(frame.spCost,0);
    assert.ok(visual.log[visual.frames.indexOf(frame)].includes('Concentrar'));
  }
  assert.equal(visual.frames[0].playerSp,visual.playerMaxSp);
  assert.equal(visual.frames[0].wildSp,visual.wildMaxSp);
  assert.equal(visual.frames.at(-1).playerSp,visual.playerRemainingSp);
  assert.equal(visual.frames.at(-1).wildSp,visual.wildRemainingSp);
  // Com piso 50, uma vitória rápida pode terminar antes do turno par:
  // não exigir ataque básico em toda batalha, mas SEMPRE zero SP quando usado.
  const basics=visual.frames.filter(frame=>frame.moveName==='basic-attack');
  assert.ok(basics.every(frame=>frame.spCost===0),
    'Todo ataque básico registrado deve custar zero SP');
  assert.ok(visual.frames.some(frame=>frame.spCost>0),'Habilidade deve consumir SP');
  // A batalha já está salva, mas o diário deve revelar um evento por vez.
  await page.getByRole('heading',{name:'Batalha em andamento…'}).waitFor();
  // D-041: o GIF é um elemento estável, não deve ser recriado por linha de log.
  const spriteImage=page.getByTestId('battle-visual-player').locator('img');
  await spriteImage.waitFor();
  await page.waitForFunction(()=>{
    const image=document.querySelector('[data-testid="battle-visual-player"] img');
    return image?.complete&&image.naturalWidth>0;
  });
  assert.equal((await spriteImage.getAttribute('src'))?.endsWith('/assets/pokemon-gifs/poke_4.gif'),true);
  assert.equal(await spriteImage.getAttribute('loading'),'eager',
    'sprite ativo da Arena não deve aguardar lazy load fora do viewport desktop');
  await page.evaluate(()=>{
    window.__battleSpriteIdentity=document.querySelector('[data-testid="battle-visual-player"] img');
  });
  const lines=page.getByTestId('battle-log').locator('li');
  const playerHp=page.getByTestId('battle-hp-player-value');
  const wildHp=page.getByTestId('battle-hp-wild-value');
  const playerSp=page.getByTestId('battle-sp-player-value');
  const wildSp=page.getByTestId('battle-sp-wild-value');
  await playerHp.waitFor();
  assert.equal(await playerHp.textContent(),visual.playerMaxHp+' / '+visual.playerMaxHp);
  assert.equal(await wildHp.textContent(),visual.wildMaxHp+' / '+visual.wildMaxHp);
  assert.equal(await playerSp.textContent(),visual.playerMaxSp+' / '+visual.playerMaxSp);
  assert.equal(await wildSp.textContent(),visual.wildMaxSp+' / '+visual.wildMaxSp);
  // Um único índice apresenta linha de log E estado visual, sem novo RNG.
  await page.waitForFunction(key=>{
    const game=JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).lastBattle;
    const label=document.querySelector('[data-testid="battle-line-progress"]')?.textContent||'';
    const visible=Number(label.split('/')[0]);
    if(visible<2)return false;
    const frame=game.frames[visible-1];
    return document.querySelector('[data-testid="battle-hp-player-value"]')?.textContent===
      frame.playerHp+' / '+game.playerMaxHp
      &&document.querySelector('[data-testid="battle-hp-wild-value"]')?.textContent===
      frame.wildHp+' / '+game.wildMaxHp
      &&document.querySelector('[data-testid="battle-sp-player-value"]')?.textContent===
      frame.playerSp+' / '+game.playerMaxSp
      &&document.querySelector('[data-testid="battle-sp-wild-value"]')?.textContent===
      frame.wildSp+' / '+game.wildMaxSp;
  },SAVE);
  assert.ok((await lines.count())<battleSave.lastBattle.log.length);
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-testid="battle-line-progress"]')?.textContent||'';
    return Number(text.split('/')[0])>=2;
  });
  assert.notEqual(await page.getByTestId('battle-clock').textContent(),'00:00.0');
  await page.getByRole('button',{name:'Pausar'}).click();
  const pausedLines=await lines.count();
  const pausedPlayerHp=await playerHp.textContent();
  const pausedWildHp=await wildHp.textContent();
  const pausedPlayerSp=await playerSp.textContent();
  const pausedWildSp=await wildSp.textContent();
  await page.waitForTimeout(550);
  assert.equal(await lines.count(),pausedLines,'pausa não pode avançar o diário');
  assert.equal(await playerHp.textContent(),pausedPlayerHp,'pausa também congela HP');
  assert.equal(await wildHp.textContent(),pausedWildHp,'pausa também congela HP selvagem');
  assert.equal(await playerSp.textContent(),pausedPlayerSp,'pausa congela SP');
  assert.equal(await wildSp.textContent(),pausedWildSp,'pausa congela SP selvagem');
  const panel=page.locator('section[aria-label="Diário de combate"]');
  assert.equal(await panel.getAttribute('tabindex'),'0');
  assert.equal(await page.getByTestId('battle-log').getAttribute('aria-live'),'off');
  assert.equal(await page.getByTestId('battle-clock').getAttribute('aria-live'),'off');
  // Testar Espaço ANTES de avançar: batalhas de teste rápidas podem terminar
  // após duas linhas e não permitir mais despausar um diário já concluído.
  await panel.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Pausar'}).waitFor();
  await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Continuar'}).waitFor();
  await page.getByRole('button',{name:'Avançar uma linha'}).click();
  assert.equal(await lines.count(),pausedLines+1,'passo manual deve avançar 1 evento');
  assert.equal(await page.evaluate(()=>window.__battleSpriteIdentity===
    document.querySelector('[data-testid="battle-visual-player"] img')),true,
  'a identidade do GIF não pode mudar quando avança o diário');
  await panel.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await lines.count(),pausedLines+2,'seta avança 1 evento em pausa');
  assert.equal(await page.evaluate(()=>window.__battleSpriteIdentity===
    document.querySelector('[data-testid="battle-visual-player"] img')),true,
  'o GIF deve permanecer montado mesmo após outra ação');
  // Se o segundo avanço foi o último, reassistir é 100% visual e read-only.
  if(!(await page.getByRole('button',{name:'Continuar'}).count())){
    await page.getByRole('button',{name:'Reassistir à batalha'}).click();
    await page.getByRole('button',{name:'Pausar'}).click();
    await page.getByRole('button',{name:'Continuar'}).waitFor();
  }
  await page.getByRole('button',{name:'Ativar leitura assistiva'}).click();
  await page.getByRole('button',{name:'Desativar leitura assistiva'}).waitFor();
  assert.equal(await page.getByTestId('battle-screenreader-status').getAttribute('aria-live'),'polite');
  await page.getByRole('button',{name:'Continuar'}).click();
  await page.getByRole('button',{name:'Alterar velocidade da apresentação'}).click();
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('button',{name:'Reassistir à batalha'}).waitFor();
  assert.equal(await lines.count(),battleSave.lastBattle.log.length);
  assert.equal(await playerHp.textContent(),visual.playerRemainingHp+' / '+visual.playerMaxHp);
  assert.equal(await wildHp.textContent(),visual.wildRemainingHp+' / '+visual.wildMaxHp);
  assert.equal(await playerSp.textContent(),visual.playerRemainingSp+' / '+visual.playerMaxSp);
  assert.equal(await wildSp.textContent(),visual.wildRemainingSp+' / '+visual.wildMaxSp);
  const battleSaved=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  await page.getByRole('button',{name:'Reassistir à batalha'}).click();
  await page.getByRole('heading',{name:'Batalha em andamento…'}).waitFor();
  assert.ok((await lines.count())<battleSave.lastBattle.log.length);
  await page.getByTestId('battle-hp-player-value').waitFor();
  assert.equal(await playerHp.textContent(),visual.playerMaxHp+' / '+visual.playerMaxHp,
    'Reassistir recomeça com HP cheio, sem recalcular o combate');
  assert.equal(await playerSp.textContent(),visual.playerMaxSp+' / '+visual.playerMaxSp,
    'Reassistir também recomeça SP cheio sem cobrar recursos de novo');
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

  // Reexecuta visualmente um frame Concentrar isolado sem recalcular batalha
  // nem escrever outro receipt. A fixture deriva de um ataque REAL já gasto.
  const focusFixture=structuredClone(fought);
  const focusGame=JSON.parse(focusFixture.journal.raw);
  const recorded=focusGame.lastBattle;
  const skillIndex=recorded.frames.findIndex(frame=>
    frame.actor==='player'&&frame.spCost>0&&frame.playerSp<recorded.playerMaxSp);
  assert.ok(skillIndex>0,'fixture precisa ter golpe com custo SP do parceiro');
  const spent=recorded.frames[skillIndex];
  const gained=Math.min(6,recorded.playerMaxSp-spent.playerSp);
  assert.ok(gained>0);
  const focusLine='T2 · '+recorded.playerName+
    ' usou Concentrar e recuperou '+gained+' SP (sem atacar).';
  recorded.log=[recorded.log[0],recorded.log[skillIndex],focusLine,
    'T3 · A apresentação segue após a recuperação de SP.'];
  const focusFrame={
    ...spent,kind:'focus',target:'player',amount:0,actor:'player',
    moveName:'concentrate',moveType:'typeless',spCost:0,
    spRecovery:gained,playerSp:spent.playerSp+gained
  };
  recorded.frames=[recorded.frames[0],spent,focusFrame,{
    ...focusFrame,kind:'info',target:null,amount:0,
    actor:undefined,moveName:undefined,spCost:undefined,spRecovery:undefined
  }];
  focusFixture.journal.raw=JSON.stringify(focusGame);
  const focusContext=await browser.newContext({viewport,reducedMotion:'reduce'});
  const focusPage=await focusContext.newPage();
  const focusErrors=[];
  focusPage.on('pageerror',error=>focusErrors.push(error.message));
  await focusPage.goto(BASE+'/play');
  await focusPage.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),
    {key:SAVE,seed:focusFixture});
  await focusPage.reload();
  await focusPage.getByRole('button',{name:'Arena',exact:true}).click();
  await focusPage.getByRole('button',{name:'Reassistir à batalha'}).click();
  // Modo acessível desacelera para 3s/linha, deixando o frame Concentrar
  // observável antes do próximo; não modifica o estado salvo.
  await focusPage.getByRole('button',{name:'Ativar leitura assistiva'}).click();
  await focusPage.getByTestId('battle-focus-player').waitFor();
  assert.match(await focusPage.getByTestId('battle-screenreader-status').textContent(),/Concentrar/,
    'modo assistivo anuncia concentração ao chegar no frame');
  await focusPage.getByRole('button',{name:'Pausar'}).click();
  assert.match(await focusPage.getByTestId('battle-focus-player').textContent(),/CONCENTRAR/);
  assert.equal(await focusPage.getByTestId('battle-focus-text-player').textContent()
    .then(s=>s.includes('+'+gained+' SP')),true);
  // D-042: animações completas sempre, inclusive quando o SO solicita redução.
  // Não existe controle visual do jogador e preferências legadas são ignoradas.
  assert.equal(await focusPage.getByLabel('Efeitos visuais da Arena').count(),0);
  assert.notEqual(await focusPage.getByTestId('battle-focus-player').evaluate(el=>
    getComputedStyle(el).animationName),'none',
    'Concentrar deve animar no PC e no celular mesmo com reducedMotion:reduce');
  assert.equal(await focusPage.getByTestId('battle-stage').evaluate(el=>
    el.closest('[data-motion]')?.getAttribute('data-motion')),'full',
    'a Arena sempre usa efeitos completos');
  assert.match(await focusPage.getByTestId('battle-screenreader-status').textContent(),/pausada/,
    'ao pausar, a live region informa a pausa em vez de repetir Concentrar');
  assert.equal(await focusPage.getByTestId('battle-sp-player-value').textContent(),
    (spent.playerSp+gained)+' / '+recorded.playerMaxSp);
  await focusPage.getByRole('button',{name:'Continuar'}).click();
  await focusPage.getByRole('button',{name:'Reassistir à batalha'}).waitFor();
  assert.equal(await focusPage.evaluate(key=>localStorage.getItem(key),SAVE),
    JSON.stringify(focusFixture),'replay Concentrar não pode escrever novo save');
  await focusPage.evaluate(()=>{
    // Simula browser antigo cujo jogador tinha escolhido reduzir movimento.
    localStorage.setItem('kanto-idle-ui-motion-v01','reduce');
  });
  await focusPage.reload();
  await focusPage.getByRole('button',{name:'Arena',exact:true}).click();
  assert.equal(await focusPage.getByLabel('Efeitos visuais da Arena').count(),0,
    'não existe menu de animações no desktop ou celular');
  assert.equal(await focusPage.getByTestId('battle-stage').evaluate(el=>
    el.closest('[data-motion]')?.getAttribute('data-motion')),'full',
    'preferências visuais antigas não podem desativar efeitos');
  assert.equal(await focusPage.evaluate(key=>localStorage.getItem(key),SAVE),
    JSON.stringify(focusFixture),'animação sempre ligada não altera progresso');
  assert.deepEqual(focusErrors,[]);
  await focusContext.close();

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
  // O primeiro combate pode capturar outro Pidgey aleatoriamente: validar somente os UIDs injetados.
  const injectedPidgeys=teamGame.roster.filter(p=>p.uid===firstUid||p.uid===secondUid);
  assert.deepEqual(injectedPidgeys.map(p=>p.uid),[firstUid,secondUid]);
  assert.ok(injectedPidgeys.every(p=>p.pokemonId===16));

  // A seleção da espécie não deve misturar UIDs de treinamentos independentes.
  const collectionRevisionBefore=(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision;
  await page.getByLabel('Buscar Pokémon na coleção').fill('pidgey');
  assert.equal(await first.count(),1);
  assert.equal(await second.count(),1);
  await page.getByRole('combobox',{name:'Ordenar coleção'}).selectOption('level');
  const filteredCards=page.locator('[class*="collectionGrid"] [data-testid^="pokemon-uid-"]');
  assert.equal(await filteredCards.first().getAttribute('data-testid'),'pokemon-uid-'+secondUid,
    'Ordenação por nível deve usar os dados de cada UID');
  await page.getByRole('combobox',{name:'Ordenar coleção'}).selectOption('affinity');
  assert.equal(await filteredCards.first().getAttribute('data-testid'),'pokemon-uid-'+secondUid,
    'Ordenação por afinidade deve usar os dados de cada UID');
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,collectionRevisionBefore,
    'Buscar e ordenar não podem gravar progresso');
  await page.screenshot({path:new URL('collection-'+label+'.png',shots).pathname,fullPage:true});
  await page.getByRole('button',{name:/^Na equipe(?:\s|$)/}).click();
  assert.equal(await first.count(),1);
  await page.getByRole('button',{name:/^Reserva(?:\s|$)/}).click();
  assert.equal(await first.count(),0);
  await page.getByRole('button',{name:/^Todos(?:\s|$)/}).click();
  await second.getByRole('button',{name:'Treinar UID '+secondUid}).click();
  await page.getByText('UID '+secondUid,{exact:false}).waitFor();
  const secondTraining=page.getByRole('region',{name:'Treinamento Pokémon'});
  await secondTraining.getByRole('button',{name:'Pré-visualizar +1 em SPD'}).click();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,9);
  await secondTraining.getByRole('button',{name:'Confirmar distribuição'}).click();
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
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  await page.getByRole('heading',{name:'Golpes do Pokémon'}).waitFor();
  const equipTackle=page.getByRole('button',{name:'Equipar golpe tackle'});
  if(await equipTackle.count()){
    await equipTackle.click();
  }else{
    // Um golpe já presente nos slots nunca mostra Equipar novamente.
    assert.equal(await equipTackle.count(),0);
    await page.getByRole('button',{name:'Tornar principal tackle'}).click();
  }
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===12,SAVE);
  assert.equal(await page.getByRole('button',{name:'Equipar golpe tackle'}).count(),0,
    'Golpe equipado não pode exibir botão de equipar');
  await page.getByRole('button',{name:'Aprimorar golpe tackle'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===13,SAVE);
  const moved=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw),SAVE);
  assert.equal(moved.roster.find(p=>p.uid===firstUid).moveName,'tackle');
  assert.equal(moved.roster.find(p=>p.uid===firstUid).upgrades.tackle,1);
  assert.equal(moved.roster.find(p=>p.uid===secondUid).manual.speed,1);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  // Evolução do líder com UID e golpes previamente aprimorados intactos.
  await page.evaluate(({key,uid})=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    game.roster.find(p=>p.uid===uid).level=18; // fixture alfa para validar requisito oficial Pidgey → Pidgeotto
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
  },{key:SAVE,uid:firstUid});
  await page.reload();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-'+firstUid).getByRole('button',{name:'Treinar UID '+firstUid}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Evolução'}).click();
  await page.getByRole('heading',{name:'Evolução'}).waitFor();
  page.once('dialog',dialog=>void dialog.accept());
  await page.getByRole('button',{name:'Evoluir para Pidgeotto'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===14,SAVE);
  const evolved=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw),SAVE);
  assert.equal(evolved.roster.find(p=>p.uid===firstUid).pokemonId,17);
  assert.equal(evolved.roster.find(p=>p.uid===firstUid).upgrades.tackle,1);
  assert.equal(evolved.team[0],firstUid);
  assert.ok(evolved.caughtSpecies.includes(16)&&evolved.caughtSpecies.includes(17));
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await page.getByRole('button',{name:'Capturados',exact:true}).click();
  assert.equal(await page.getByTestId('pokedex-16').count(),1);
  assert.equal(await page.getByTestId('pokedex-17').count(),1);
  await page.reload();
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByText('Pidgeotto · UID #'+firstUid).first().waitFor();

  // Montagem de 2 golpes no Charmander original, preservando o UID já testado.
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Treinar UID 1'}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  await page.getByRole('heading',{name:'Golpes do Pokémon'}).waitFor();
  await page.getByRole('button',{name:'Adicionar golpe growl'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===15,SAVE);
  let slots=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).roster.find(p=>p.uid===1),SAVE);
  assert.deepEqual(slots.moveNames,['scratch','growl']);
  await page.getByRole('button',{name:'Tornar principal growl'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===16,SAVE);
  slots=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).roster.find(p=>p.uid===1),SAVE);
  assert.deepEqual(slots.moveNames,['growl','scratch']);
  await page.reload();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Treinar UID 1'}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  assert.equal(await page.getByTestId('equipped-moves').getByText(/growl/).count(),1);
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Tornar líder UID 1 pela coleção',exact:true}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===17,SAVE);
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  // Seed FIXA só para esta batalha E2E: contra Caterpie deve usar Growl e
  // em seguida Scratch; sem depender da sorte do encontro no navegador.
  await page.evaluate(()=>{
    const original=window.crypto.getRandomValues.bind(window.crypto);
    Object.defineProperty(window.crypto,'getRandomValues',{
      configurable:true,
      value(array){
        if(array instanceof Uint32Array&&array.length===1){array[0]=0;return array;}
        return original(array);
      }
    });
  });
  await page.getByRole('button',{name:'Batalhar contra Pokémon selvagem'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===18,SAVE);
  const multi=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).lastBattle,SAVE);
  assert.ok(multi.log.some(line=>line.includes('usou growl')),'IA deve usar suporte');
  assert.ok(multi.log.some(line=>line.includes('usou scratch')),'IA deve voltar a causar dano');
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('button',{name:'Reassistir à batalha'}).waitFor();

  // Replay antigo com barras de HP, mas sem SP (save do release D-036):
  // manter HP e não inventar valores de SP.
  await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    game.lastBattle.frames=game.lastBattle.frames.map(({playerSp,wildSp,...frame})=>frame);
    delete game.lastBattle.playerMaxSp;
    delete game.lastBattle.wildMaxSp;
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  assert.equal(await page.getByTestId('battle-hp-player').count(),1);
  assert.equal(await page.getByTestId('battle-sp-player').count(),0);
  assert.equal(await page.getByTestId('battle-sp-wild').count(),0);

  // Save alfa anterior ou frames opcionais corrompidos: não inventar HP nem travar UI.
  await page.screenshot({path:new URL(label+'-play.png',shots).pathname,fullPage:true,animations:'disabled'});
  await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    game.lastBattle.frames=[null];
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByText('Este combate anterior não possui trilha de HP por evento').waitFor();
  assert.equal(await page.getByTestId('battle-hp-player').count(),0);
  assert.equal(await page.getByTestId('battle-hp-wild').count(),0);
  assert.equal(await page.getByTestId('battle-sp-player').count(),0);
  assert.equal(await page.getByTestId('battle-sp-wild').count(),0);
  assert.equal(await page.getByTestId('battle-log').locator('li').count(),multi.log.length);
  // D-058: aprimorar Scratch no slot secundário, mantendo Growl principal e save íntegro.
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Treinar UID 1'}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  const beforeSecondary=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const beforeGame=JSON.parse(beforeSecondary.journal.raw);
  const scratchUpgrade=page.getByRole('button',{name:'Aprimorar golpe scratch'});
  assert.equal(await scratchUpgrade.isEnabled(),true,'Slot secundário equipado deve poder aprimorar');
  await scratchUpgrade.click();
  await page.waitForFunction(({key,rev})=>JSON.parse(localStorage.getItem(key))?.revision===rev+1,
    {key:SAVE,rev:beforeSecondary.revision});
  const afterSecondary=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const afterGame=JSON.parse(afterSecondary.journal.raw);
  const beforeCharmander=beforeGame.roster.find(p=>p.uid===1);
  const afterCharmander=afterGame.roster.find(p=>p.uid===1);
  assert.equal(afterCharmander.moveName,'growl','Aprimorar secundário não pode trocar o principal');
  assert.deepEqual(afterCharmander.moveNames,['growl','scratch']);
  assert.equal(afterCharmander.upgrades.scratch,(beforeCharmander.upgrades?.scratch??0)+1);
  assert.equal(afterGame.coins,beforeGame.coins);
  assert.deepEqual(afterGame.team,beforeGame.team);
  assert.equal(afterSecondary.revision,beforeSecondary.revision+1);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,'Overflow horizontal em '+label+': '+overflow);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(label+': /play, golpes/status, múltiplos slots, replay, evolução e reload OK');
}


/**
 * D-045: usar os controles reais do jogador com espécies/níveis de teste.
 * A injeção é local e só prepara duas capturas; a equipagem, o combate e o
 * recibo passam pelo writer real, sem reexecutar combate durante a reprodução.
 */
async function exerciseNewMoves(browser,label,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BASE+'/play',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Nome do treinador').fill('Teste D045');
  await page.getByRole('radio',{name:/Charmander/}).check();
  await page.getByRole('checkbox',{name:/modo demonstração/}).check();
  await page.getByRole('button',{name:'Começar aventura'}).click();
  await page.getByRole('heading',{name:'Bem-vindo de volta, Teste D045!'}).waitFor();
  const uids=await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    const src=game.roster[0];
    const uidA=Math.max(...game.roster.map(p=>p.uid))+1,uidB=uidA+1;
    game.roster.push(
      {...src,uid:uidA,pokemonId:120,level:15,moveName:'tackle',
        moveNames:['tackle'],upgrades:{},affinity:0},
      {...src,uid:uidB,pokemonId:32,level:12,moveName:'tackle',
        moveNames:['tackle'],upgrades:{},affinity:0}
    );
    game.nextUid=uidB+1;
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
    return {recoverUid:uidA,kickUid:uidB};
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-'+uids.recoverUid)
    .getByRole('button',{name:'Treinar UID '+uids.recoverUid}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  await page.getByRole('heading',{name:'Golpes do Pokémon'}).waitFor();
  await page.getByRole('button',{name:'Adicionar golpe recover'}).click();
  await page.getByTestId('equipped-moves').getByText('recover').waitFor();
  assert.equal(await page.getByText('Recupera até 50% do HP, no máximo 1 vez por batalha').count(),1);
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-'+uids.kickUid)
    .getByRole('button',{name:'Treinar UID '+uids.kickUid}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  await page.getByRole('button',{name:'Adicionar golpe double-kick'}).click();
  await page.getByTestId('equipped-moves').getByText('double-kick').waitFor();
  await page.getByRole('button',{name:'Retirar golpe tackle'}).click();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  const kick=page.getByTestId('pokemon-uid-'+uids.kickUid);
  await kick.getByRole('button',{name:'Adicionar UID '+uids.kickUid+' à equipe'}).click();
  await kick.getByRole('button',{name:'Tornar líder UID '+uids.kickUid+' pela coleção'}).click();
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.evaluate(()=>{
    const original=window.crypto.getRandomValues.bind(window.crypto);
    Object.defineProperty(window.crypto,'getRandomValues',{
      configurable:true,
      value(array){
        if(array instanceof Uint32Array&&array.length===1){array[0]=0;return array;}
        return original(array);
      }
    });
  });
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  await page.getByRole('button',{name:'Batalhar contra Pokémon selvagem'}).click();
  await page.waitForFunction(({key,before})=>
    JSON.parse(localStorage.getItem(key))?.revision>before,
    {key:SAVE,before:before.revision});
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const game=JSON.parse(after.journal.raw);
  const battle=game.lastBattle;
  assert.ok(battle?.frames?.some(f=>f.actor==='player'&&f.moveName==='double-kick'
    &&f.hitIndex===1),'Double Kick equipado deve atingir na Arena');
  assert.equal(battle.frames.length,battle.log.length);
  assert.equal(game.team[0],uids.kickUid);
  assert.equal(after.journal.receipts.length,before.journal.receipts.length+1);
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('button',{name:'Reassistir à batalha'}).click();
  const replay=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(replay.revision,after.revision);
  assert.deepEqual(replay.journal.receipts,after.journal.receipts);
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(label+': Recover/Double Kick por UID, hits e replay sem recompensas extras OK');
}


/** D-052: equipar/remover pela modal real, sem mexer nas outras jornadas. */
async function exerciseInventoryActions(browser,label,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BASE+'/play',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Nome do treinador').fill('Treinador Inventário');
  await page.getByRole('radio',{name:/Charmander/}).check();
  await page.getByRole('checkbox',{name:/modo demonstração/}).check();
  await page.getByRole('button',{name:'Começar aventura'}).click();
  await page.getByRole('button',{name:'Treinador',exact:true}).click();
  await page.getByRole('button',{name:'Equipamentos',exact:true}).click();
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  await page.getByRole('button',{name:'Boné de Kanto, Não equipado. Abrir detalhes'}).click();
  await page.getByRole('dialog',{name:'Boné de Kanto'}).getByRole('button',{name:'Equipar'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===1,SAVE);
  const equipped=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(JSON.parse(equipped.journal.raw).trainer.equipped.hat,'cap');
  const equippedCube=page.getByRole('button',{name:'Boné de Kanto, Equipado. Abrir detalhes'});
  assert.equal(await equippedCube.locator('.fa-circle-check').count(),1);
  await equippedCube.click();
  await page.getByRole('dialog',{name:'Boné de Kanto'}).getByRole('button',{name:'Remover'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===2,SAVE);
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const oldGame=JSON.parse(before.journal.raw),newGame=JSON.parse(after.journal.raw);
  assert.equal(newGame.trainer.equipped.hat,'');
  assert.equal(newGame.coins,oldGame.coins);
  assert.deepEqual(newGame.roster,oldGame.roster);
  assert.equal(newGame.trainer.title,oldGame.trainer.title);
  // D-053: apenas fixture de teste cria ledger; produção não concede itens.
  await page.evaluate(key=>{
    const save=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(save.journal.raw);
    game.inventory={version:1,ownedEquipment:{cap:1},extraBagSlots:5};
    save.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(save));
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Treinador',exact:true}).click();
  await page.getByRole('button',{name:'Equipamentos',exact:true}).click();
  await page.getByRole('button',{name:'Boné de Kanto, Não equipado. Abrir detalhes'}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Jaqueta de Viagem.*Abrir detalhes/}).count(),0);
  await page.getByRole('button',{name:'Mochila',exact:true}).click();
  await page.getByRole('region',{name:'Mochila'}).getByText('0 / 15').waitFor();
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(label+': modal Equipar/Remover, revisão e progresso intacto OK');
}

let browser;
try {
  await ready();
  assert.equal((await fetch(BASE+'/')).status,200,'protótipo v0.1 preservado na raiz');
  assert.equal((await fetch(BASE+'/health')).status,200);
  browser=await chromium.launch({headless:true});
  await exercise(browser,'desktop',{width:1365,height:768});
  await exercise(browser,'mobile',{width:390,height:844});
  await exerciseNewMoves(browser,'desktop',{width:1365,height:768});
  await exerciseNewMoves(browser,'mobile',{width:390,height:844});
  await exerciseInventoryActions(browser,'desktop',{width:1365,height:768});
  await exerciseInventoryActions(browser,'mobile',{width:390,height:844});
  console.log('PASS: experiência React jogável no servidor de produção');
} catch(error) {
  console.error(error);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
