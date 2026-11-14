// Run with: node tests/i18n.test.cjs. Uses only Node built-ins.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const zh=JSON.parse(fs.readFileSync(path.join(root,'locales/zh.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'locales/en.json'),'utf8'));
assert.deepEqual(Object.keys(zh).sort(),Object.keys(en).sort());
for(const key of Object.keys(zh)){
 const params=s=>[...s.matchAll(/\{(p\d+)(?::[^{}]*)?\}/g)].map(m=>m[1]).sort();
 assert.deepEqual(params(zh[key]),params(en[key]),'Parameter mismatch: '+key);
 assert(!/[\u3400-\u9fff]/.test(en[key]),'Chinese in English message: '+key);
}
const storage=new Map();
const ctx=vm.createContext({console,URLSearchParams,Intl,setTimeout,clearTimeout,location:{search:'?qa=locale'},document:{documentElement:{},querySelector:()=>null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{addEventListener:()=>{}}});
for(const name of ['i18n.js','data.js','photos.js','art.js','live-map.js','risk-3d.js','app.js']){
 let code=fs.readFileSync(path.join(root,name),'utf8');if(name==='app.js')code=code.replace(/\nboot\(\);\s*$/,'');vm.runInContext(code,ctx,{filename:name});
}
function initialLanguage(search,saved){
 const c=vm.createContext({URLSearchParams,Intl,location:{search},document:{documentElement:{}},localStorage:{getItem:()=>JSON.stringify(saved)},window:{}});
 vm.runInContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8'),c);
 return c.window.HeatShieldI18n.getLanguage();
}
assert.equal(initialLanguage('?lang=en',{}),'en');
assert.equal(initialLanguage('?lang=en',{language:'zh'}),'zh');
assert.equal(initialLanguage('?lang=invalid',{language:'invalid'}),'zh');
let rendered=0;
for(const language of ['zh','en'])for(const city of ['phoenix','nyc','houston','las_vegas','miami'])for(const theme of ['light','dark'])for(const manager of [false,true]){
 vm.runInContext(`S.language=${JSON.stringify(language)};window.HeatShieldI18n.setLanguage(S.language);S.city=${JSON.stringify(city)};S.theme=${JSON.stringify(theme)};S.manager=${manager};S.plan=true;S.followed=[followKey(neighborhoods()[0])];S.favorites=[favoriteKey(facilities()[0])];`,ctx);
 const results=vm.runInContext(`Object.entries({...pages,welcome,choose,launchScreen,skeleton,mainHeader,nav}).map(([name,fn])=>[name,fn()])`,ctx);
 for(const [name,html] of results){
  assert(!/undefined|\bNaN\b|\[object Object\]|\{p\d+\}/.test(html),name+' has broken content');
  if(language==='en'){
   const checked=html.replaceAll('简体中文','').replace(/<option value="zh"[\s\S]*?<\/option>/g,'');
   assert(!/[\u3400-\u9fff]/.test(checked),'Chinese remains in '+name+': '+checked.match(/.{0,25}[\u3400-\u9fff].{0,35}/)?.[0]);
  }
  rendered++;
 }
 const branches=vm.runInContext(`(()=>{const r=[];for(const layer of ['temperature','probability','heatmap','3d']){S.layer=layer;r.push(map())}S.layer='risk';S.analysis='genetic';r.push(analysis());S.analysis='social';S.tab='official';r.push(alerts());S.tab='community';for(const status of ['draft','confirmed','active','complete']){S.taskStatus=status;r.push(task())}for(const modal of ['cities','photos','directions','manager','confirm-task','connection','map-source'])r.push(modalContent(modal));return r})()`,ctx);
 for(const html of branches){if(language==='en')assert(!/[\u3400-\u9fff]/.test(html),'Chinese remains in a secondary state');assert(!/undefined|\{p\d+\}/.test(html));rendered++}
}
assert.deepEqual(vm.runInContext('[...window.HeatShieldI18n.missing]',ctx).length,0);
vm.runInContext("S.language='en';window.HeatShieldI18n.setLanguage('en')",ctx);
assert.equal(vm.runInContext("tr('{p0} 处符合条件',{p0:1})",ctx),'1 match');
assert.equal(vm.runInContext("tr('{p0} 处符合条件',{p0:2})",ctx),'2 matches');
assert.equal(vm.runInContext("tr('{p0} 人',{p0:1})",ctx),'1 person');
assert.equal(vm.runInContext("tr('{p0} 人',{p0:2000})",ctx),'2,000 people');
assert.equal(vm.runInContext("formatHours('10:00-18:00')",ctx),'10:00 AM–6:00 PM');
const before=vm.runInContext('JSON.stringify({city:S.city,followed:S.followed,favorites:S.favorites})',ctx);
vm.runInContext("S.language='zh';window.HeatShieldI18n.setLanguage('zh');save()",ctx);
assert.equal(vm.runInContext('JSON.stringify({city:S.city,followed:S.followed,favorites:S.favorites})',ctx),before);
assert.equal(JSON.parse(storage.get('heatshield.app.v3.qa')).language,'zh');
console.log(`PASS: ${Object.keys(en).length} bilingual messages, ${rendered} page/state combinations, plural forms, and saved data integrity.`);
