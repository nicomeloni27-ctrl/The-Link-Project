import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/generate-study.js';
const call=async(method,headers={})=>{
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}};
 await handler({method,headers,body:{}},res);return res;
};
test('study generation only accepts POST',async()=>{
 const r=await call('GET');assert.equal(r.statusCode,405);
});
test('study generation requires a signed-in student',async()=>{
 const r=await call('POST');assert.equal(r.statusCode,401);
});
test('study generation safely refuses when private AI key is absent',async()=>{
 const original=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 try{const r=await call('POST',{authorization:'Bearer testing'});assert.equal(r.statusCode,503);assert.match(r.body.error,/not configured/)}
 finally{if(original!==undefined)process.env.OPENAI_API_KEY=original}
});
