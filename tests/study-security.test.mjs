import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/generate-study.js';

const A='00000000-0000-0000-0000-000000000001';
const B='00000000-0000-0000-0000-000000000002';
const DOC='11111111-1111-1111-1111-111111111111';
const SET='22222222-2222-2222-2222-222222222222';
const reply=(body,status=200)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function call(){
 const r={statusCode:200,setHeader(){},end(raw){this.json=JSON.parse(raw)}};
 await handler({method:'POST',headers:{authorization:'Bearer student-A'},body:{class_id:'macro',unit_title:'Unit 3',source_document_ids:[DOC]}},r);
 return r;
}
const originalFetch=global.fetch;
const originalKey=process.env.OPENAI_API_KEY;
test('a student cannot generate from another student document',async()=>{
 process.env.OPENAI_API_KEY='fake-test-key';
 let askedOpenAI=false;
 global.fetch=async(url)=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return reply({id:A});
  if(u.includes('/rest/v1/study_hubs?'))return reply([{classes:[{id:'macro',name:'AP Macro',units:['Unit 3']}]}]);
  if(u.includes('/rest/v1/study_generation_requests?'))return reply([]);
  if(u.includes('/rest/v1/study_documents?'))return reply([]); // RLS hides student B's record.
  if(u.includes('api.openai.com'))askedOpenAI=true;
  throw Error('Unexpected route '+u);
 };
 try{
  const result=await call();
  assert.equal(result.statusCode,403);
  assert.match(result.json.error,/sources/);
  assert.equal(askedOpenAI,false);
 }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey}
});
test('generates a private set only when the source is owned and filed in that unit',async()=>{
 process.env.OPENAI_API_KEY='fake-test-key';
 let modelCalls=0,storageCalls=0;
 const generated={title:'Unit 3 Part 1',overview:'GDP and the aggregate model',outline:[{topic:'AD',summary:'Aggregate demand',details:['Components'],practice_example:'Trace the shift',source:'macro.pdf p.1'}],graphs:[],questions:[]};
 global.fetch=async(url,options={})=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return reply({id:A});
  if(u.includes('/rest/v1/study_hubs?'))return reply([{classes:[{id:'macro',name:'AP Macro',units:['Unit 3']}]}]);
  if(u.includes('/rest/v1/study_generation_requests?'))return reply([]);
  if(u.endsWith('/rest/v1/study_generation_requests'))return reply('',201);
  if(u.includes('/rest/v1/study_documents?'))return reply([{id:DOC,name:'macro.pdf',unit_title:'Unit 3',storage_path:A+'/file.pdf',mime_type:'application/pdf',size_bytes:6}]);
  if(u.includes('/storage/v1/object/authenticated/')){storageCalls++;return new Response(new Uint8Array([37,80,68,70,45,49]))}
  if(u.includes('api.openai.com')){
   modelCalls++;assert.ok(options.headers.Authorization.startsWith('Bearer '));
   assert.equal(JSON.parse(options.body).store,false);
   return reply({status:'completed',output_text:JSON.stringify(generated)})
  }
  if(u.endsWith('/rest/v1/study_sets'))return reply([{id:SET,title:generated.title}],201);
  throw Error('Unexpected route '+u);
 };
 try{
  const result=await call();
  assert.equal(result.statusCode,200);
  assert.equal(result.json.id,SET);
  assert.equal(result.json.outline_topics,1);
  assert.equal(modelCalls,1);
  assert.equal(storageCalls,1);
 }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey}
});

test('unfiled source in the same class can generate General Materials without unrelated-unit access',async()=>{
 process.env.OPENAI_API_KEY='fake-test-key';
 let modelCalls=0;
 const generated={title:'Pre-calculus Sequences Review',overview:'Arithmetic and geometric sequences',outline:[],graphs:[],questions:[]};
 global.fetch=async(url,opts={})=>{
  const u=String(url),p=new URL(u).searchParams;
  if(u.endsWith('/auth/v1/user'))return reply({id:A});
  if(u.includes('/rest/v1/study_hubs?'))return reply([{classes:[{id:'precalc',name:'AP Pre-calculus',units:[]}]}]);
  if(u.includes('/rest/v1/study_generation_requests?'))return reply([]);
  if(u.endsWith('/rest/v1/study_generation_requests'))return reply('',201);
  if(u.includes('/rest/v1/study_documents?'))return reply([{id:DOC,name:'Sequences Answer Key.md',unit_title:null,storage_path:A+'/file.md',mime_type:'text/markdown',size_bytes:11}]);
  if(u.includes('/storage/v1/object/authenticated/'))return new Response('a_n = a_1 + (n - 1)d');
  if(u.includes('api.openai.com')){modelCalls++;return reply({status:'completed',output_text:JSON.stringify(generated)})}
  if(u.endsWith('/rest/v1/study_sets'))return reply([{id:SET,title:generated.title}],201);
  throw Error('Unexpected route: '+u);
 };
 try{
  const res={statusCode:200,setHeader(){},end(v){this.json=JSON.parse(v)}};
  await handler({method:'POST',headers:{authorization:'Bearer student-A'},body:{class_id:'precalc',unit_title:'General Materials',source_document_ids:[DOC]}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.json));
  assert.equal(res.json.title,generated.title);
  assert.equal(modelCalls,1);
 }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey}
});
