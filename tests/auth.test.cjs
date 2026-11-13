const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('auth.js', 'utf8').replace(/initializeAuth\(\);\s*$/, '');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(rows = new Map(), cached = {}) {
  const storage = new Map(Object.entries(cached));
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent: '', disabled: false, hidden: false, append() {}, setAttribute() {}});
    return nodes.get(id);
  };
  let release, paused = false, fail = false;
  const writes = [];
  const client = {from() { return {
    select() {return {eq(_, uid) {return {async maybeSingle() {
      if (paused) await new Promise(resolve => release = resolve);
      if (fail) return {error: {code: 'network'}};
      return {data: rows.has(uid) ? {classes: structuredClone(rows.get(uid))} : null};
    }}}}},
    async upsert(row) {
      writes.push(structuredClone(row));
      if (fail) return {error: {code: 'network'}};
      rows.set(row.user_id, structuredClone(row.classes)); return {};
    }
  }}};
  const ctx = vm.createContext({
    document: {createElement: () => node(Symbol()), querySelector: () => node('header'), querySelectorAll: () => [], getElementById: node},
    window: {addEventListener() {}}, localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k)},
    defaults: [{id:'macro',units:[],files:[]}], data: [], KEY: 'guest', home() {}, confirm: () => true,
    location: {origin:'https://example.com',pathname:'/',search:'',hash:'#/'}, history: {replaceState() {}}, setTimeout, console,
    client
  });
  vm.runInContext(source + '\nlinkClient = client;', ctx);
  return {ctx,rows,storage,writes,nodes,run: code => vm.runInContext(code,ctx),pause:()=>paused=true,release:()=>release(),fail:v=>fail=v};
}
test('separate browser sessions retrieve own saved classes without copying files',async()=>{
 const rows=new Map(),a=harness(rows);
 await a.run('signedIn({id:"A"})');
 a.run('data.push({id:"custom",units:["Unit 1"],files:[{name:"local"}]})');
 await a.run('window.linkSync()');
 const second=harness(rows);await second.run('signedIn({id:"A"})');
 assert.equal(second.run('data[1].units[0]'),'Unit 1');
 assert.equal(second.run('data[1].files.length'),0);
 assert.equal(rows.get('A')[1].files,undefined);
 const b=harness(rows);await b.run('signedIn({id:"B"})');assert.equal(b.run('data.length'),1);
});
test('late account load cannot restore data after sign-out',async()=>{
 const h=harness(new Map([['A',[{id:'private',units:[]}]]]));h.pause();
 const loading=h.run('signedIn({id:"A"})');await tick();h.run('signedOut()');h.release();await loading;
 assert.equal(h.run('linkUser'),null);assert.equal(h.run('data[0].id'),'macro');assert.equal(h.writes.length,0);
});
test('loading blocks editing and failure never overwrites unseen cloud data',async()=>{
 const h=harness();h.fail(true);await h.run('signedIn({id:"A"})');
 assert.equal(h.run('window.linkEditingLocked'),true);assert.equal(h.run('linkReady'),false);
 await h.run('window.linkSync()');assert.equal(h.writes.length,0);
});
test('failed saves survive reload and can be recovered',async()=>{
 const rows=new Map([['A',[{id:'macro',units:[]}]]]);const h=harness(rows);await h.run('signedIn({id:"A"})');
 h.fail(true);h.run('data[0].units.push("Offline edit");localStorage.setItem(accountKey("A"),JSON.stringify(data))');
 assert.equal(await h.run('window.linkSync()'),false);assert.equal(h.storage.get('the-link-account-A-pending'),'true');
 const recovered=harness(rows,Object.fromEntries(h.storage));await recovered.run('signedIn({id:"A"})');
 assert.equal(rows.get('A')[0].units[0],'Offline edit');assert.equal(recovered.storage.has('the-link-account-A-pending'),false);
});
test('queued saves from an ended session do not run for another account',async()=>{
 const h=harness();await h.run('signedIn({id:"A"})');h.writes.length=0;
 const saving=h.run('window.linkSync()');h.run('signedOut()');await saving;assert.equal(h.writes.length,0);
});
test('a new account does not silently inherit shared guest data',async()=>{
 const h=harness(new Map(),{guest:JSON.stringify([{id:'someone-else',units:[],files:[]}])});h.ctx.confirm=()=>false;
 await h.run('signedIn({id:"B"})');assert.equal(h.run('data[0].id'),'macro');
});
