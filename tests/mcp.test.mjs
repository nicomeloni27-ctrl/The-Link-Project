import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/mcp.js';

function makeResponse(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v},end(v=''){this.body=v;return this}}}
const userA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function harness(){
 const hubs=new Map([[userA,[{id:'math',name:'Math',units:[],description:'',icon:'◇'}]],[userB,[{id:'history',name:'History',units:[],description:'',icon:'◇'}]]]);
 const sets=[];
 const docs=[{id:'11111111-1111-1111-1111-111111111111',user_id:userB,class_id:'history',storage_path:userB+'/file.txt',name:'Private.txt',mime_type:'text/plain'}];
 const original=globalThis.fetch;
 globalThis.fetch=async (url,opts={})=>{
  const token=(opts.headers?.Authorization||'').replace('Bearer ','');
  const uid=token==='student-a'?userA:token==='student-b'?userB:null;
  const path=new URL(url).pathname,search=new URL(url).searchParams;
  const respond=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
  if(path==='/auth/v1/user')return uid?respond({id:uid}):respond({message:'Unauthorized'},401);
  if(!uid)return respond({message:'Unauthorized'},401);
  if(path==='/rest/v1/study_hubs'&&opts.method==='POST'){const row=JSON.parse(opts.body);if(row.user_id!==uid)return respond({},403);hubs.set(uid,row.classes);return respond(null,201)}
  if(path==='/rest/v1/study_hubs')return respond([{classes:hubs.get(uid)}]);
  if(path==='/rest/v1/study_sets'&&opts.method==='POST'){const row=JSON.parse(opts.body);if(row.user_id!==uid)return respond({},403);const saved={...row,id:'33333333-3333-3333-3333-333333333333'};sets.push(saved);return respond([saved],201)}
  if(path==='/rest/v1/study_documents'&&opts.method==='POST'){const row=JSON.parse(opts.body);if(row.user_id!==uid)return respond({},403);const saved={...row,id:'22222222-2222-2222-2222-222222222222'};docs.push(saved);return respond([saved],201)}
  if(path==='/rest/v1/study_documents')return respond(docs.filter(d=>d.user_id===uid&&(!search.has('id')||search.get('id')==='eq.'+d.id)&&(!search.has('class_id')||search.get('class_id')==='eq.'+d.class_id)&&(!search.has('unit_title')||search.get('unit_title')==='eq.'+d.unit_title)));
  if(path.startsWith('/storage/v1/object/study-documents/'))return respond({},201);
  return respond({},404);
 };
 const call=async(method,token,args={},id=1)=>{
  const req={method:'POST',headers:{authorization:token?'Bearer '+token:''},body:{jsonrpc:'2.0',id,method,params:method==='tools/call'?args:undefined}};
  const res=makeResponse();await handler(req,res);return {status:res.statusCode,data:JSON.parse(res.body)};
 };
 return {call,hubs,restore(){globalThis.fetch=original}};
}
test('MCP metadata and unauthorized calls',async()=>{
 const h=harness();
 try{const init=await h.call('initialize');assert.equal(init.data.result.serverInfo.name,'The Link Project');
 const list=await h.call('tools/list');assert.equal(list.data.result.tools.length,7);
 const noAuth=await h.call('tools/call',null,{name:'list_classes',arguments:{}});assert.equal(noAuth.status,401)}
 finally{h.restore()}
});
test('two students see independent classes and cannot retrieve each other\'s documents',async()=>{
 const h=harness();
 try{
 const run=async(token,name,args={})=>JSON.parse((await h.call('tools/call',token,{name,arguments:args})).data.result.content[0].text);
 const a=await run('student-a','list_classes'),b=await run('student-b','list_classes');
 assert.equal(a[0].name,'Math');assert.equal(b[0].name,'History');
 const created=await run('student-a','create_class',{name:'AP Chemistry'});assert.equal(created.created.name,'AP Chemistry');
 assert.equal((await run('student-b','list_classes')).length,1);
 const forbidden=await h.call('tools/call','student-a',{name:'get_document',arguments:{document_id:'11111111-1111-1111-1111-111111111111'}});
 assert.equal(forbidden.data.result.isError,true);
 assert.match(forbidden.data.result.content[0].text,/not found/);
 }finally{h.restore()}
});

test('student can file a text resource in an existing unit and another student cannot list it',async()=>{
 const h=harness();
 try{
  const run=async(token,name,args={})=>{
   const result=(await h.call('tools/call',token,{name,arguments:args})).data.result;
   assert.equal(result.isError,undefined,JSON.stringify(result));
   return JSON.parse(result.content[0].text);
  };
  await run('student-a','create_unit',{class_id:'math',title:'Unit 3'});
  const saved=await run('student-a','save_text_document',{class_id:'math',unit_title:'Unit 3',name:'Review.md',content:'# Notes'});
  assert.equal(saved.created.unit_title,'Unit 3');
  const a=await run('student-a','list_documents',{class_id:'math',unit_title:'Unit 3'});
  const b=await run('student-b','list_documents',{class_id:'history'});
  assert.equal(a.length,1);assert.equal(a[0].name,'Review.md');
  assert.equal(b.length,1);assert.equal(b[0].name,'Private.txt');
 }finally{h.restore()}
});

test('ChatGPT saves a structured study set only within the signed-in student class and unit',async()=>{
 const h=harness();
 try{
  const run=async(token,name,args)=> (await h.call('tools/call',token,{name,arguments:args})).data.result;
  const content={overview:'Basics',outline:[{topic:'Money',summary:'Definitions',details:['Definition'],practice_example:'Calculate',source:'worksheet'}],graphs:[],questions:[]};
  const missing=await run('student-a','save_study_set',{class_id:'history',unit_title:'Unit 1',title:'Review',content});
  assert.equal(missing.isError,true);
  assert.match(missing.content[0].text,/Unit not found/);
  const createdUnit=await run('student-a','create_unit',{class_id:'math',title:'Unit 3'});
  assert.equal(createdUnit.isError,undefined,JSON.stringify(createdUnit));
  const listed=await run('student-a','list_classes',{});
  assert.ok(JSON.parse(listed.content[0].text).find(c=>c.id==='math')?.units.includes('Unit 3'),JSON.stringify(listed));
  const result=await run('student-a','save_study_set',{class_id:'math',unit_title:'Unit 3',title:'Unit 3 Part 1',content});
  assert.equal(result.isError,undefined,JSON.stringify(result));
  assert.equal(JSON.parse(result.content[0].text).created.title,'Unit 3 Part 1');
  const other=await run('student-b','save_study_set',{class_id:'math',unit_title:'Unit 3',title:'Unauthorized',content});
  assert.equal(other.isError,true);
 }finally{h.restore()}
});
