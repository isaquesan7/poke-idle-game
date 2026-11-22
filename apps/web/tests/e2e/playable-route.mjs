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


/** D-064AJ: a batalha não existe na navegação; replay somente após entrar na região. */
async function openSavedBattle(page){
  await page.getByRole('button',{name:'Regiões',exact:true}).click();
  await page.getByRole('button',{name:'Rever último combate nesta região'}).click();
}


/**
 * D064AX: medir intervalos de APRESENTAÇÃO no Chromium real.
 * Coleta performance.now() no browser via MutationObserver, não Date do host.
 * Um único replay por velocidade, não altera o save nem o motor de combate.
 */
async function measureReplayTiming(page,speed,label){
  await page.getByRole('button',{name:'Reassistir à batalha'}).click();
  if(speed===2)await page.getByRole('button',{name:'Alterar velocidade da apresentação'}).click();
  await page.evaluate(()=>{
    const text=()=>document.querySelector('[data-testid="battle-line-progress"]')?.textContent||'';
    let count=Number(text().split('/')[0]);
    const ticks=[performance.now()];
    const observer=new MutationObserver(()=>{
      const next=Number(text().split('/')[0]);
      if(Number.isFinite(next)&&next>count){
        count=next;ticks.push(performance.now());
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    window.__d064axReplay={ticks,observer};
  });
  await page.waitForFunction(()=>window.__d064axReplay?.ticks.length>=3,
    null,{timeout:10000});
  const data=await page.evaluate(()=>{
    const metric=window.__d064axReplay;
    metric.observer.disconnect();
    const intervals=metric.ticks.slice(1).map((at,i)=>at-metric.ticks[i]);
    delete window.__d064axReplay;
    return intervals;
  });
  assert.equal(data.length>=2,true,'replay deve apresentar múltiplas linhas');
  // Cronômetro de navegador real; limites generosos para carga de CI.
  assert.ok(data.every(ms=>ms>80&&ms<3300),
    'progressão temporal inválida: '+data.join(', '));
  const mean=Math.round(data.reduce((a,b)=>a+b,0)/data.length);
  console.log('D064AX_BROWSER_PLAYBACK '+JSON.stringify({
    label,speed,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),
    intervalsMs:data.map(ms=>Math.round(ms)),meanIntervalMs:mean
  }));
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('button',{name:'Reassistir à batalha'}).waitFor();
  return mean;
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
  const dexSaveBefore=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  const dexTile=page.getByTestId('pokedex-4');
  await dexTile.click();
  const encyclopedia=page.getByTestId('pokedex-detail');
  await encyclopedia.getByRole('heading',{name:'Charmander'}).waitFor();
  // D-062: o scroll do documento e do portal usam a mesma paleta Kanto Dark.
  const scrollStyle=await page.evaluate(()=>{
    const root=getComputedStyle(document.documentElement);
    const modal=getComputedStyle(document.querySelector('[data-testid="pokedex-detail"]'));
    return {
      rootWidth:root.scrollbarWidth,modalWidth:modal.scrollbarWidth,
      rootColor:root.scrollbarColor,modalColor:modal.scrollbarColor,
      track:root.getPropertyValue('--scrollbar-track').trim(),
      thumb:root.getPropertyValue('--scrollbar-thumb').trim()
    };
  });
  assert.equal(scrollStyle.rootWidth,'thin');
  assert.equal(scrollStyle.modalWidth,'thin');
  assert.equal(scrollStyle.rootColor,scrollStyle.modalColor);
  assert.ok(scrollStyle.track&&scrollStyle.thumb,'Scrollbar precisa herdar os tokens globais');
  assert.equal(await encyclopedia.getAttribute('aria-modal'),'true');
  assert.equal(await encyclopedia.evaluate(node=>node.parentElement?.parentElement===document.body),true,
    'Modal enciclopédico deve ficar em portal independente da grade');
  await encyclopedia.getByRole('region',{name:'Atributos base'}).getByText('Ataque especial').waitFor();
  await encyclopedia.getByRole('region',{name:'Vantagens de tipo'}).getByText('Água · 2×').waitFor();
  await encyclopedia.getByRole('region',{name:'Golpes e técnicas'}).getByText('Ember').waitFor();
  await encyclopedia.getByText('uma espécie ainda não descoberta',{exact:false}).waitFor();
  assert.equal(await page.getByTestId('pokedex-150').count(),0,
    'Filtro de capturados não deve revelar registros desconhecidos');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden',
    'Modal deve travar rolagem do fundo');
  await page.screenshot({path:new URL('pokedex-modal-'+label+'.png',shots).pathname,fullPage:true});
  await page.keyboard.press('Escape');
  assert.equal(await page.getByTestId('pokedex-detail').count(),0,'Escape fecha modal');
  assert.equal(await dexTile.evaluate(node=>document.activeElement===node),true,
    'Fechar o modal restaura foco no cartão da Pokédex');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE),dexSaveBefore,
    'Consultar enciclopédia nunca grava progresso');
  await dexTile.click();
  await encyclopedia.getByRole('button',{name:'Fechar detalhes'}).click();
  assert.equal(await encyclopedia.count(),0);
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
  const starterXp=await page.evaluate(key=>{
    const game=JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw);
    return game.roster.find(p=>p.uid===1);
  },SAVE);
  const starterXpMax=starterXp.level>=100?1:65+starterXp.level*22;
  const pokemonXpBar=page.getByRole('progressbar',{name:'Experiência do Pokémon UID 1'});
  await pokemonXpBar.waitFor();
  assert.equal(await pokemonXpBar.getAttribute('aria-valuemax'),String(starterXpMax));
  assert.equal(await pokemonXpBar.getAttribute('aria-valuenow'),
    String(starterXp.level>=100?1:starterXp.xp));
  if(starterXp.level<100)
    await page.getByText('Faltam '+(starterXpMax-starterXp.xp)+' XP para o nível '+(starterXp.level+1)+'.').waitFor();
  assert.equal(await page.getByTestId('pokemon-xp').count(),1,
    'Perfil do Pokémon deve mostrar XP individual sem modificar save');
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
  // D-060: o +1 Pokémon deve brilhar no hover como o botão dos atributos do Treinador.
  const pokemonPlus=pokemonTrain.getByRole('button',{name:'Pré-visualizar +1 em ATK'});
  const glowBefore=await pokemonPlus.evaluate(button=>getComputedStyle(button).boxShadow);
  await pokemonPlus.hover();
  await page.waitForFunction(()=>document.querySelector('#pokemon-attributes button[aria-label="Pré-visualizar +1 em ATK"]')?.matches(':hover'));
  const glowAfter=await pokemonPlus.evaluate(button=>getComputedStyle(button).boxShadow);
  assert.notEqual(glowBefore,glowAfter,'Atributos Pokémon devem ter brilho ao passar o mouse');
  const pointRevision=(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision;
  // HP usa o cálculo real do core (+2 HP final por ponto manual).
  const hpButton=pokemonTrain.getByRole('button',{name:'Pré-visualizar +1 em HP'});
  const hpRow=hpButton.locator('xpath=../..');
  const hpBefore=Number(await hpRow.locator('strong').innerText());
  await hpButton.click();
  await hpRow.getByText('→ '+(hpBefore+2)).waitFor();
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
  const expeditionSelect=page.getByRole('combobox',{name:'Região para expedição'});
  await expeditionSelect.waitFor();
  assert.equal(await expeditionSelect.getAttribute('aria-describedby'),'expedition-region-hint');
  // Demo inicia com Pokémon Lv20: Colinas de Kanto é a área adequada,
  // enquanto Bosque Inicial já reduz recompensas por sobre-nível.
  await expeditionSelect.selectOption('2');
  await expeditionSelect.focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button',{name:'Iniciar expedição'}).evaluate(node=>node===document.activeElement),
    true,'teclado deve alcançar Iniciar expedição após seletor regional');
  assert.ok(await page.getByRole('timer',{name:'Tempo total da expedição'}).count());
  await page.getByRole('button',{name:'Iniciar expedição'}).click();
  await page.getByRole('heading',{name:'Expedição em andamento'}).waitFor();
  await page.waitForFunction(()=>
    document.activeElement?.id==='expedition-title'
      &&document.activeElement.textContent?.includes('Expedição em andamento'));
  assert.equal(await page.getByRole('heading',{name:'Expedição em andamento'}).getAttribute('tabindex'),'-1');
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===3,SAVE);
  await page.getByRole('timer',{name:'Tempo total da expedição'}).waitFor();
  assert.match(await page.getByTestId('expedition-total-time').innerText(),/^\d{2,}:\d{2}:\d{2}$/);
  await page.getByRole('progressbar',{name:'Progresso para o próximo ciclo'}).waitFor();
  const timerLive=await page.getByRole('timer',{name:'Tempo total da expedição'}).getAttribute('aria-live');
  assert.equal(timerLive,'off','atualizações por segundo não devem interromper leitores de tela');
  const expeditionWidth=await page.getByRole('region',{name:'Expedição em andamento'}).evaluate(
    node=>({right:node.getBoundingClientRect().right,width:window.innerWidth}));
  assert.ok(expeditionWidth.right<=expeditionWidth.width+2,
    'painel de expedição não deve causar overflow horizontal no mobile');
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
  const elapsedBeforeClaim=await page.getByTestId('expedition-total-time').innerText();
  assert.ok(Number(elapsedBeforeClaim.slice(0,2))*3600+
    Number(elapsedBeforeClaim.slice(3,5))*60+Number(elapsedBeforeClaim.slice(6,8))>=31,
    'Tempo total deve incluir duração anterior ao reload');
  await page.getByRole('button',{name:'Resgatar recompensas'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===4,SAVE);
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const game=JSON.parse(after.journal.raw);
  assert.ok(game.coins>=221, 'Três ciclos devem render pelo menos 21 moedas na demo');
  assert.ok(game.trainer.xp>=12);
  assert.ok(game.roster[0].xp>=15);
  assert.equal(after.revision,4); // 2 pontos, start, claim
  assert.equal(after.journal.receipts.length,2);
  const elapsedAfterClaim=await page.getByTestId('expedition-total-time').innerText();
  assert.ok(elapsedAfterClaim>=elapsedBeforeClaim,
    'Resgatar recompensas não pode reiniciar cronômetro total');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  // Combate apenas após escolher a região; o resultado vem do motor.
  await page.getByRole('button',{name:'Regiões',exact:true}).click();
  await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Arena',exact:true}).count(),0);
  await page.getByRole('button',{name:/Entrar na região/}).click();
  await page.getByRole('button',{name:'Batalhar na região'}).click();
  await page.getByRole('heading',{name:'Batalha no Bosque Inicial'}).waitFor();
  // D-063: a visão inicial da Arena apresenta líder, indicadores e ação
  // principal; as informações do motor não devem poluir a tela do jogador.
  const arenaLeader=page.getByLabel('Líder do combate');
  await arenaLeader.getByText('Charmander').waitFor();
  assert.equal(await arenaLeader.getByText('UID #1',{exact:false}).count(),1);
  const arenaStats=page.getByLabel('Desempenho na região');
  await arenaStats.getByText('Vitórias').waitFor();
  await arenaStats.getByText('Empates').waitFor();
  await arenaStats.getByText('Derrotas').waitFor();
  assert.equal(await arenaStats.getByText('Insígnias').count(),0);
  assert.equal(await page.getByText('SP individual (50–100)',{exact:false}).count(),0,
    'A Arena não deve mostrar fórmulas internas ao jogador');

  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===5,SAVE);
  const fought=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const battleSave=JSON.parse(fought.journal.raw);
  // D064BE: stage de batalha ainda NÃO concede XP, vitória, nível ou bola.
  assert.equal(battleSave.wins+battleSave.losses,0);
  assert.equal(fought.journal.revision,2);
  assert.equal(fought.journal.receipts.length,2);
  assert.ok(battleSave.pendingBattle,'Batalha deve persistir pendente');
  const visual=battleSave.pendingBattle.preview;
  battleSave.lastBattle=visual; // referência só no teste, sem regravar localStorage
  assert.ok(visual.log.length>=2);
  assert.ok(visual.turns<=30);
  assert.equal(visual.battleId,'regional-v02-5');
  // A trilha visual é armazenada no pending até o final do replay.
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
    const saved=JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw);
    const game=saved.pendingBattle?.preview??saved.lastBattle;
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
  // D-064AG: em máquinas lentas, o replay curto pode terminar entre
  // comandos de teclado no mobile. Reinicie e pause apenas o replay visual
  // antes de validar a leitura assistiva; não altere o save.
  if(!(await page.getByRole('button',{name:'Ativar leitura assistiva'}).count())){
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
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision>=6,SAVE);
  let afterFirstBattleRevision=6;
  let confirmed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  let confirmedGame=JSON.parse(confirmed.journal.raw);
  assert.equal(confirmed.journal.revision,3,'um recibo único no fim do replay');
  assert.equal(confirmedGame.wins+confirmedGame.losses,1);
  assert.ok(confirmedGame.seen.includes(visual.wildSpeciesId));
  // D064BF: KO fica cinza e claramente indicado apenas quando o HP revelado é zero.
  for(const side of ['player','wild']){
    const finalHp=side==='player'?visual.playerRemainingHp:visual.wildRemainingHp;
    const fighter=page.getByTestId('battle-visual-'+side);
    assert.equal(await fighter.getAttribute('data-fainted'),finalHp===0?'true':'false');
    assert.equal(await page.getByTestId('battle-fainted-'+side).count(),finalHp===0?1:0);
  }
  // O Level Up é exclusivamente efeito da confirmação — não um prêmio no replay.
  const settledActive=confirmedGame.roster.find(p=>p.uid===1);
  if(settledActive&&settledActive.level>visual.playerLevel){
    await page.getByTestId('battle-level-up').waitFor();
    await page.getByText(/LEVEL UP!/).waitFor();
    assert.ok((await page.getByTestId('battle-level-up').innerText()).includes(
      'nível '+settledActive.level));
  }else{
    assert.equal(await page.getByTestId('battle-level-up').count(),0);
  }
  if(confirmedGame.lastBattle.captureStatus==='available'){
    await page.getByRole('button',{name:'Seguir sem capturar'}).click();
    afterFirstBattleRevision++;
    await page.waitForFunction(({key,revision})=>
      JSON.parse(localStorage.getItem(key))?.revision===revision,
      {key:SAVE,revision:afterFirstBattleRevision});
  }
  const firstBattleOffset=afterFirstBattleRevision-5;
  await page.getByRole('button',{name:'Reassistir à batalha'}).waitFor();
  assert.equal(await lines.count(),battleSave.lastBattle.log.length);
  assert.equal(await playerHp.textContent(),visual.playerRemainingHp+' / '+visual.playerMaxHp);
  assert.equal(await wildHp.textContent(),visual.wildRemainingHp+' / '+visual.wildMaxHp);
  assert.equal(await playerSp.textContent(),visual.playerRemainingSp+' / '+visual.playerMaxSp);
  assert.equal(await wildSp.textContent(),visual.wildRemainingSp+' / '+visual.wildMaxSp);
  // D064AX: medir 1× e 2× em browser REAL após a batalha ter sido salva.
  const beforeTiming=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  const timing1x=await measureReplayTiming(page,1,label);
  const timing2x=await measureReplayTiming(page,2,label);
  assert.ok(timing2x<timing1x*1.25,
    'velocidade 2× deve manter cadência próxima ou superior a 1×');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE),beforeTiming,
    'medição do replay não pode alterar o save nem recompensas');
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
  await page.getByRole('heading',{name:'Pokémon encontrados nesta área'}).waitFor();
  assert.equal(await page.locator('[class*="encounterGrid"] [class*="encounterCard"]').count(),15,
    'A região inicial deve listar apenas as 15 espécies de seu catálogo');
  await page.screenshot({path:new URL('arena-'+label+'.png',shots).pathname,fullPage:true});
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await page.getByTestId('pokedex-'+battleSave.lastBattle.wildSpeciesId).waitFor();
  assert.equal(await page.getByTestId('pokedex-'+battleSave.lastBattle.wildSpeciesId).isDisabled(),false);
  await page.getByRole('button',{name:'Vistos',exact:true}).click();
  // D064AK: o filtro "Vistos" contém apenas espécies ainda não capturadas.
  // O encontro atual pode repetir uma espécie capturada anteriormente.
  const wildId=battleSave.lastBattle.wildSpeciesId;
  const caughtIds=new Set([
    ...(Array.isArray(battleSave.caughtSpecies)?battleSave.caughtSpecies:[]),
    ...battleSave.roster.map(member=>member.pokemonId)
  ]);
  assert.equal(await page.getByTestId('pokedex-'+wildId).count(),
    caughtIds.has(wildId)?0:1);
  await openSavedBattle(page);
  await page.getByRole('heading',{name:'Diário de combate'}).waitFor();
  await page.reload();
  await openSavedBattle(page);
  await page.getByRole('heading',{name:'Diário de combate'}).waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  // Reexecuta visualmente um frame Concentrar isolado sem recalcular batalha
  // nem escrever outro receipt. A fixture usa custo SP REAL de um ataque pago.
  // Em encontros curtos pode ocorrer apenas ataque pago do selvagem:
  // nesse caso projetamos o mesmo custo num frame sintético do parceiro
  // SOMENTE para testar o playback, nunca o combate ou o save do jogador.
  const focusFixture=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const focusGame=JSON.parse(focusFixture.journal.raw);
  const recorded=focusGame.lastBattle;
  const playerSkillIndex=recorded.frames.findIndex(frame=>
    frame.actor==='player'&&frame.spCost>0&&frame.playerSp<recorded.playerMaxSp);
  const skillIndex=playerSkillIndex>0?playerSkillIndex:
    recorded.frames.findIndex(frame=>frame.spCost>0);
  assert.ok(skillIndex>0,'fixture precisa ter ataque real com custo SP');
  const sourceSpent=recorded.frames[skillIndex];
  const spent=playerSkillIndex>0?sourceSpent:{
    ...sourceSpent,actor:'player',target:'wild',
    playerSp:Math.max(0,recorded.playerMaxSp-sourceSpent.spCost)
  };
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
  await openSavedBattle(focusPage);
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
  await openSavedBattle(focusPage);
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
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:6+firstBattleOffset});
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await first.getByRole('button',{name:'Adicionar UID '+firstUid+' à equipe'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:7+firstBattleOffset});
  await second.getByRole('button',{name:'Adicionar UID '+secondUid+' à equipe'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:8+firstBattleOffset});
  assert.equal(await page.getByRole('button',{name:'Adicionar UID '+firstUid+' à equipe'}).count(),0);
  await page.getByRole('button',{name:'Tornar líder UID '+firstUid,exact:true}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:9+firstBattleOffset});
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
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,9+firstBattleOffset);
  await secondTraining.getByRole('button',{name:'Confirmar distribuição'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:10+firstBattleOffset});
  teamSnapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  teamGame=JSON.parse(teamSnapshot.journal.raw);
  assert.equal(teamGame.roster.find(p=>p.uid===secondUid).manual.speed,1);
  assert.equal(teamGame.roster.find(p=>p.uid===firstUid).manual.speed,0);

  await page.getByRole('button',{name:'Regiões',exact:true}).click();
  await page.getByRole('button',{name:/Entrar na região/}).click();
  await page.getByRole('button',{name:'Batalhar na região'}).click();
  await page.getByLabel('Líder do combate').getByText('UID #'+firstUid,{exact:false}).waitFor();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:11+firstBattleOffset});
  const stagedTeamFight=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.ok(JSON.parse(stagedTeamFight.journal.raw).pendingBattle,
    'a batalha da equipe deve permanecer pendente antes da apresentação');
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:12+firstBattleOffset});
  let secondBattleOffset=firstBattleOffset+1;
  const last=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.ok(last.journal.receipts.at(-1).fingerprint.includes('"activeUid":'+firstUid),
    'Arena precisa combater com o UID promovido a líder');
  // A oferta pós-vitória bloqueia uma nova luta até ser resolvida. Como
  // o objetivo deste trecho é testar os UIDs, dispensar sem gastar bola.
  if(JSON.parse(last.journal.raw).lastBattle.captureStatus==='available'){
    await page.getByRole('button',{name:'Seguir sem capturar'}).click();
    secondBattleOffset++;
    await page.waitForFunction(({key,revision})=>
      JSON.parse(localStorage.getItem(key))?.revision===revision,
      {key:SAVE,revision:12+secondBattleOffset-1});
  }
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
  await page.getByTestId('pokedex-detail').getByRole('button',{name:'Fechar detalhes'}).click();
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
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:12+secondBattleOffset});
  assert.equal(await page.getByRole('button',{name:'Equipar golpe tackle'}).count(),0,
    'Golpe equipado não pode exibir botão de equipar');
  await page.getByRole('button',{name:'Aprimorar golpe tackle'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:13+secondBattleOffset});
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
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:14+secondBattleOffset});
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
  await openSavedBattle(page);
  await page.getByLabel('Líder do combate').getByText('Pidgeotto').waitFor();
  await page.getByLabel('Líder do combate').getByText('UID #'+firstUid,{exact:false}).waitFor();

  // Montagem de 2 golpes no Charmander original, preservando o UID já testado.
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Treinar UID 1'}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  await page.getByRole('heading',{name:'Golpes do Pokémon'}).waitFor();
  await page.getByRole('button',{name:'Adicionar golpe growl'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:15+secondBattleOffset});
  let slots=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).roster.find(p=>p.uid===1),SAVE);
  assert.deepEqual(slots.moveNames,['scratch','growl']);
  await page.getByRole('button',{name:'Tornar principal growl'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:16+secondBattleOffset});
  slots=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw).roster.find(p=>p.uid===1),SAVE);
  assert.deepEqual(slots.moveNames,['growl','scratch']);
  await page.reload();
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Treinar UID 1'}).click();
  await page.getByRole('navigation',{name:'Seções do Pokémon'}).getByRole('button',{name:'Golpes'}).click();
  assert.equal(await page.getByTestId('equipped-moves').getByText(/growl/).count(),1);
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  await page.getByTestId('pokemon-uid-1').getByRole('button',{name:'Tornar líder UID 1 pela coleção',exact:true}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:17+secondBattleOffset});
  await page.getByRole('button',{name:'Regiões',exact:true}).click();
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
  await page.getByRole('button',{name:/Entrar na região/}).click();
  await page.getByRole('button',{name:'Batalhar na região'}).click();
  await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:18+secondBattleOffset});
  const multi=await page.evaluate(key=>{
    const saved=JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw);
    return saved.pendingBattle?.preview??saved.lastBattle;
  },SAVE);
  assert.ok(multi.log.some(line=>line.includes('usou growl')),'IA deve usar suporte');
  assert.ok(multi.log.some(line=>line.includes('usou scratch')),'IA deve voltar a causar dano');
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:19+secondBattleOffset});
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
  await openSavedBattle(page);
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
  await openSavedBattle(page);
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
  // D-060: gerir os slots pelo topo sem perder o exemplar, mantendo 1–3 membros.
  await page.getByRole('button',{name:'Coleção',exact:true}).click();
  assert.equal(await page.locator('[class*="collectionAffinityMini"]').count(),0,
    'Coleção não deve exibir barras de afinidade');
  const currentSlots=page.locator('[data-testid^="team-slot-"]');
  assert.equal(await currentSlots.count(),3);
  const leaderSlot=page.getByTestId('team-slot-0');
  const otherSlot=page.getByTestId('team-slot-1');
  assert.equal(await leaderSlot.getByRole('button',{name:/Treinar UID .* pelo slot da equipe/}).count(),1);
  assert.equal(await leaderSlot.getByRole('button',{name:/Remover UID .* pelo slot da equipe/}).count(),1);
  assert.equal(await leaderSlot.getByRole('button',{name:/Tornar líder UID/}).count(),0);
  assert.equal(await otherSlot.getByRole('button',{name:/Tornar líder UID/}).count(),1);
  const beforeRemove=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const memberUid=JSON.parse(beforeRemove.journal.raw).team[1];
  await otherSlot.getByRole('button',{name:'Remover UID '+memberUid+' pelo slot da equipe'}).click();
  await page.waitForFunction(({key,rev})=>JSON.parse(localStorage.getItem(key))?.revision===rev+1,
    {key:SAVE,rev:beforeRemove.revision});
  const afterRemove=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const afterRemoveGame=JSON.parse(afterRemove.journal.raw);
  assert.equal(afterRemoveGame.team.includes(memberUid),false);
  assert.ok(afterRemoveGame.roster.some(p=>p.uid===memberUid),'Retirar do slot não remove da coleção');
  await page.getByTestId('pokemon-uid-'+memberUid)
    .getByRole('button',{name:'Adicionar UID '+memberUid+' à equipe'}).click();
  await page.waitForFunction(({key,rev})=>JSON.parse(localStorage.getItem(key))?.revision===rev+2,
    {key:SAVE,rev:beforeRemove.revision});
  const restored=JSON.parse((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).journal.raw);
  assert.equal(restored.team.length,3);
  assert.ok(restored.team.includes(memberUid));
  const revisionBeforeTopTraining=(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision;
  const currentLeaderUid=restored.team[0];
  await page.getByTestId('team-slot-0')
    .getByRole('button',{name:'Treinar UID '+currentLeaderUid+' pelo slot da equipe'}).click();
  await page.getByText('UID '+currentLeaderUid,{exact:false}).waitFor();
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).revision,revisionBeforeTopTraining,
    'Abrir Treinar pelo slot não pode gerar gravação');
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
  await page.getByRole('button',{name:'Regiões',exact:true}).click();
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
  await page.getByRole('button',{name:/Entrar na região/}).click();
  await page.getByRole('button',{name:'Batalhar na região'}).click();
  await page.waitForFunction(({key,before})=>
    JSON.parse(localStorage.getItem(key))?.revision>before,
    {key:SAVE,before:before.revision});
  const staged=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const stagedGame=JSON.parse(staged.journal.raw);
  const battle=stagedGame.pendingBattle?.preview;
  assert.ok(battle?.frames?.some(f=>f.actor==='player'&&f.moveName==='double-kick'
    &&f.hitIndex===1),'Double Kick equipado deve atingir na Arena');
  assert.equal(battle.frames.length,battle.log.length);
  assert.equal(stagedGame.team[0],uids.kickUid);
  assert.equal(staged.journal.receipts.length,before.journal.receipts.length,
    'nenhum prêmio até acabar o replay Double Kick');
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.waitForFunction(({key,revision})=>
    JSON.parse(localStorage.getItem(key))?.revision===revision,
    {key:SAVE,revision:before.revision+2});
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(after.journal.receipts.length,before.journal.receipts.length+1);
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


/** D064BF: nível realmente confirmado só após concluir a apresentação. */
async function exerciseGuaranteedLevelUp(browser,label,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/play');
  await page.getByLabel('Nome do treinador').fill('Teste Level Up');
  await page.getByRole('radio',{name:/Charmander/}).check();
  await page.getByRole('checkbox',{name:/modo demonstração/}).check();
  await page.getByRole('button',{name:'Começar aventura'}).click();
  await page.getByRole('heading',{name:'Bem-vindo de volta, Teste Level Up!'}).waitFor();
  await page.waitForFunction(key=>Boolean(localStorage.getItem(key)),SAVE);
  const before=await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    const leader=game.roster.find(p=>p.uid===game.team[0]);
    leader.xp=65+leader.level*22-1;
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
    return {level:leader.level,xp:leader.xp};
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Pokémon',exact:true}).click();
  const xp=page.getByRole('progressbar',{name:'Experiência do Pokémon UID 1'});
  assert.equal(await xp.getAttribute('aria-valuenow'),String(before.xp));
  await page.getByRole('button',{name:'Regiões',exact:true}).click();
  await page.evaluate(()=>{
    const original=window.crypto.getRandomValues.bind(window.crypto);
    Object.defineProperty(window.crypto,'getRandomValues',{
      configurable:true,value(array){
        if(array instanceof Uint32Array&&array.length===1){array[0]=0;return array;}
        return original(array);
      }
    });
  });
  await page.getByRole('button',{name:/Entrar na região/}).click();
  await page.getByRole('button',{name:'Batalhar na região'}).click();
  await page.getByRole('heading',{name:'Batalha em andamento…'}).waitFor();
  const staged=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw),SAVE);
  assert.equal(staged.roster[0].level,before.level);
  assert.equal(staged.roster[0].xp,before.xp);
  assert.equal(await page.getByTestId('battle-level-up').count(),0);
  assert.equal(await page.getByTestId('battle-visual-wild').getAttribute('data-fainted'),'false');
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  await page.getByRole('heading',{name:'Vitória!'}).waitFor();
  const finished=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).journal.raw),SAVE);
  assert.ok(finished.roster[0].level>before.level,'vitória deve conceder nível ao Pokémon');
  await page.getByTestId('battle-level-up').waitFor();
  assert.match(await page.getByTestId('battle-level-up').textContent(),/LEVEL UP!/);
  assert.equal(await page.getByTestId('battle-visual-wild').getAttribute('data-fainted'),'true');
  assert.equal(await page.getByTestId('battle-fainted-wild').count(),1);
  const after=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  await page.getByRole('button',{name:'Reassistir à batalha'}).click();
  assert.equal(await page.getByTestId('battle-level-up').count(),0,
    'replay não deve festejar nível ganho uma segunda vez');
  await page.getByRole('button',{name:'Pular apresentação'}).click();
  assert.equal(await page.getByTestId('battle-level-up').count(),0);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE),after,
    'replay e animação de nocaute não escrevem no save');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(label+': XP/Level Up e KO visual confirmados no final, sem antecipar ou duplicar');
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
  await exerciseGuaranteedLevelUp(browser,'desktop',{width:1365,height:768});
  await exerciseGuaranteedLevelUp(browser,'mobile',{width:390,height:844});
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
