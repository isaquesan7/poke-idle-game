/** D-064AG: jornada regional escrita pelo mesmo writer da Arena. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const root=new URL('../../../../',import.meta.url);
const port=43125,base='http://127.0.0.1:'+port,key='kanto-idle-play-v02';
const server=spawn(process.execPath,[new URL('server.mjs',root).pathname],{
  cwd:root.pathname,env:{...process.env,PORT:String(port)},stdio:'pipe'
});
let stderr='';
server.stderr.on('data',value=>stderr+=String(value));
async function ready(){
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Servidor não iniciou: '+stderr);
}
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await page.getByLabel('Nome do treinador').fill('Treinador Regional');
    await page.getByRole('radio',{name:/Bulbasaur/}).check();
    await page.getByRole('checkbox',{name:/modo demonstração/}).check();
    await page.getByRole('button',{name:'Começar aventura'}).click();
    await page.getByRole('heading',{name:'Bem-vindo de volta, Treinador Regional!'}).waitFor();
    await page.getByRole('button',{name:'Arena',exact:true}).click();
    const region=page.getByRole('combobox',{name:'Região para batalha'});
    await region.waitFor();
    assert.equal(await region.locator('option[value="5"]').isDisabled(),true,
      'Região 5 deve estar bloqueada para treinador nível 21');
    await region.selectOption('4');
    const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    await page.getByRole('button',{name:'Batalhar na região'}).click();
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===1,key);
    const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const game=JSON.parse(after.journal.raw);
    assert.equal(after.revision,1);
    assert.equal(after.journal.revision,1);
    assert.equal(after.journal.receipts.length,1);
    assert.equal(game.lastBattle.regionId,4);
    assert.equal(game.lastBattle.regionName,'Lagos Serenos');
    assert.ok([60,79,116,129].includes(game.lastBattle.wildSpeciesId));
    assert.ok(game.lastBattle.wildLevel>=31&&game.lastBattle.wildLevel<=40);
    assert.equal(game.lastBattle.log.length,game.lastBattle.frames.length);
    assert.ok(game.lastBattle.battleId.startsWith('regional-v02-'));
    await page.reload();
    const persisted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.deepEqual(persisted,after,'Reabrir não duplica recompensa regional');
    assert.notEqual(before.journal.raw,after.journal.raw);
    assert.deepEqual(errors,[]);
    await context.close();
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
