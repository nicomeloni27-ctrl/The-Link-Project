// The Link Project — stateless MCP HTTP endpoint. No service-role credentials.
const SUPA='https://kkjlfvkbtcjkgourkowa.supabase.co';
const KEY='sb_publishable_oj45xpJE4XtmURjAAAguHg_-yDjOLNi';
const ORIGIN='https://the-link-project-ten.vercel.app';
const RESOURCE=ORIGIN+'/api/mcp';
const AUTH=SUPA+'/auth/v1';
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const str=(description,maxLength=90)=>({type:'string',description,maxLength});
const tool=(name,description,inputSchema,readonly=false)=>({name,description,inputSchema,annotations:{readOnlyHint:readonly,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:'oauth2',scopes:[]}],_meta:{'securitySchemes':[{type:'oauth2',scopes:[]}]}});
const TOOLS=[
 tool('list_classes','List the classes and units of the signed-in Link student.',schema({}),true),
 tool('create_class','Create a class for the signed-in Link student.',schema({name:str('Class name',70)},['name'])),
 tool('create_unit','Add a unit to one of the signed-in student\'s classes.',schema({class_id:str('Class ID',120),title:str('Unit title',90)},['class_id','title'])),
 tool('list_documents','List signed-in student documents in a class; optionally filter by class ID.',schema({class_id:str('Optional class ID',120),unit_title:str('Optional unit title',90)}),true),
 tool('save_text_document','Save a UTF-8 text study resource in the signed-in student\'s private document bucket. Use for generated review sheets. For PDFs, upload on The Link website.',schema({class_id:str('Class ID',120),unit_title:str('Optional existing unit title',90),name:str('Document filename ending in .txt or .md',120),content:{type:'string',description:'UTF-8 text, maximum 100000 characters',maxLength:100000}},['class_id','name','content'])),
 tool('save_study_set','Save a study outline, graphs and practice test to the signed-in student\'s own class and unit. Use ONLY user-provided source materials, paraphrase any licensed test questions, and cite sources within each topic and question.',schema({class_id:str('Class ID from list_classes',120),unit_title:str('Existing unit title',90),title:str('Review sheet and test title, e.g. Unit 3 Part 1',140),content:{type:'object',description:'Structured study set: overview string, outline array of {topic,summary,details:string[],practice_example,source}, graphs array of {title,x_label,y_label,note,source,lines:[{label,points:[{x:number,y:number}]}]} (0–100 conceptual), questions array of {id,topic,prompt,options:string[4],correct_index:0–3,explanation,hints:string[4],source}. Include questions ONLY if sourced from user provided questions, otherwise empty array; hints must not reveal the answer.',properties:{overview:{type:'string'},outline:{type:'array',items:{type:'object'}},graphs:{type:'array',items:{type:'object'}},questions:{type:'array',items:{type:'object'}}},required:['overview','outline','graphs','questions'],additionalProperties:false}},['class_id','unit_title','title','content']),
 tool('get_document','Get a signed-in student\'s own document, text content for .txt/.md and temporary signed download URL otherwise.',schema({document_id:str('Document UUID',36)},['document_id']),true)
];
function response(res,status,data,headers={}){res.statusCode=status;for(const [k,v] of Object.entries(headers))res.setHeader(k,v);return res.end(typeof data==='string'?data:JSON.stringify(data))}
function rpc(res,id,result){return response(res,200,{jsonrpc:'2.0',id,result},{'Content-Type':'application/json','Cache-Control':'no-store'})}
function error(res,id,code,message,status=200){return response(res,status,{jsonrpc:'2.0',id,error:{code,message}},{'Content-Type':'application/json','Cache-Control':'no-store'})}
function validName(v,max){if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Error('Invalid name or title');return v.trim()}
async function query(endpoint,token,method='GET',body,extra={}){
 const headers={apikey:KEY,Authorization:'Bearer '+token,Accept:'application/json',...extra};
 if(body!==undefined&&!(body instanceof Uint8Array)&&!headers['Content-Type'])headers['Content-Type']='application/json';
 const r=await fetch(SUPA+endpoint,{method,headers,body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body),redirect:'error'});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!r.ok)throw Error('Backend request failed ('+r.status+'): '+(r.status===409?'Concurrent update: please retry':r.status===401||r.status===403?'not authorized':'check document/class and configuration'));
 return data;
}
async function owner(token){const r=await query('/auth/v1/user',token);if(!r?.id)throw Error('Invalid Link account');return r.id}
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(id);
const uuid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);
async function loadClasses(token,userId){
 const rows=await query('/rest/v1/study_hubs?user_id=eq.'+encodeURIComponent(userId)+'&select=classes',token);
 if(!Array.isArray(rows))throw Error('Class store is unavailable');
 return rows.length?(Array.isArray(rows[0].classes)?rows[0].classes:[]):[];
}
async function saveClasses(token,userId,classes){
 // Existing website uses last-write-wins JSONB; keep this behavior and preserve extra fields.
 await query('/rest/v1/study_hubs?on_conflict=user_id',token,'POST',{user_id:userId,classes,updated_at:new Date().toISOString()},{Prefer:'resolution=merge-duplicates,return=minimal'});
}
async function execute(name,args,token,userId){
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid arguments');
 if(name==='list_classes')return await loadClasses(token,userId);
 if(name==='create_class'){
  const title=validName(args.name,70);const classes=await loadClasses(token,userId);
  if(classes.some(c=>c.name?.toLowerCase()===title.toLowerCase()))throw Error('Class already exists');
  const course={id:'custom-'+crypto.randomUUID(),name:title,description:'Your learning space',icon:'◇',units:[]};
  await saveClasses(token,userId,[...classes,course]);return {created:course};
 }
 if(name==='create_unit'){
  const title=validName(args.title,90),classes=await loadClasses(token,userId);
  if(!safeId(args.class_id))throw Error('Invalid class ID');
  const course=classes.find(c=>c.id===args.class_id);if(!course)throw Error('Class not found in your account');
  if(!Array.isArray(course.units))course.units=[];
  if(course.units.includes(title))throw Error('Unit already exists');
  course.units.push(title);await saveClasses(token,userId,classes);return {class_id:course.id,unit:title};
 }
 if(name==='list_documents'){
  if(args.class_id!==undefined&& !safeId(args.class_id))throw Error('Invalid class ID');
  if(args.class_id){const classes=await loadClasses(token,userId);if(!classes.some(c=>c.id===args.class_id))throw Error('Class not found in your account')}
  if(args.unit_title!==undefined){validName(args.unit_title,90);if(!args.class_id)throw Error('Specify class_id when filtering by unit')}
  const where='user_id=eq.'+encodeURIComponent(userId)+(args.class_id?'&class_id=eq.'+encodeURIComponent(args.class_id):'')+(args.unit_title?'&unit_title=eq.'+encodeURIComponent(args.unit_title):'');
  return await query('/rest/v1/study_documents?'+where+'&select=id,class_id,unit_title,name,mime_type,size_bytes,created_at&order=created_at.desc&limit=100',token);
 }
 if(name==='save_text_document'){
  if(!safeId(args.class_id))throw Error('Invalid class ID');
  const classes=await loadClasses(token,userId);
  const course=classes.find(c=>c.id===args.class_id);if(!course)throw Error('Class not found in your account');
  const unitTitle=args.unit_title===undefined?null:validName(args.unit_title,90);
  if(unitTitle&&!(course.units||[]).includes(unitTitle))throw Error('Unit not found in your class');
  const filename=validName(args.name,120),content=args.content;
  if(filename.includes('/')||filename.includes(String.fromCharCode(92))||!['.txt','.md'].some(x=>filename.toLowerCase().endsWith(x))||typeof content!=='string'||content.length>100000)throw Error('Only .txt and .md text files up to 100000 characters are supported');
  const ext=filename.toLowerCase().endsWith('.md')?'md':'txt',mime=ext==='md'?'text/markdown':'text/plain';
  const bytes=new TextEncoder().encode(content);if(bytes.length>350000)throw Error('Document is too large');
  const path=userId+'/'+crypto.randomUUID()+'.'+ext;
  await query('/storage/v1/object/study-documents/'+path,token,'POST',bytes,{'Content-Type':mime,'x-upsert':'false'});
  try{
   const row=await query('/rest/v1/study_documents',token,'POST',{user_id:userId,class_id:args.class_id,unit_title:unitTitle,name:filename,storage_path:path,mime_type:mime,size_bytes:bytes.length},{Prefer:'return=representation'});
   return {created:row?.[0]&&{id:row[0].id,name:row[0].name,class_id:row[0].class_id,unit_title:unitTitle}};
  }catch(e){await query('/storage/v1/object/study-documents/'+path,token,'DELETE').catch(()=>{});throw e}
 }
 if(name==='save_study_set'){
  if(!safeId(args.class_id))throw Error('Invalid class ID');
  const title=validName(args.title,140),unit=validName(args.unit_title,90);
  const classes=await loadClasses(token,userId),course=classes.find(c=>c.id===args.class_id);
  if(!course||(course.units||[]).includes(unit))throw Error('Unit not found in your Link account');
  const payload=args.content;
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.overview!=='string'||!Array.isArray(payload.outline)||!Array.isArray(payload.graphs)||!Array.isArray(payload.questions))throw Error('Structured outline, graph and question arrays required');
  if(JSON.stringify(payload).length>220000||payload.outline.length>40||payload.graphs.length>8||payload.questions.length>30)throw Error('Study set exceeds size or item limits');
  for(const q of payload.questions){
   if(!q||typeof q.prompt!=='string'||typeof q.topic!=='string'||!Array.isArray(q.options)||q.options.length!==4||!q.options.every(x=>typeof x==='string')||!Array.isArray(q.hints)||q.hints.length!==4||!Number.isInteger(q.correct_index)||q.correct_index<0||q.correct_index>3)throw Error('Each practice question needs four options, four non-revealing hints and a valid key');
  }
  const rows=await query('/rest/v1/study_sets',token,'POST',{user_id:userId,class_id:args.class_id,unit_title:unit,title,source_document_ids:[],content:payload},{Prefer:'return=representation'});
  return {created:rows?.[0]&&{id:rows[0].id,title:rows[0].title,class_id:args.class_id,unit_title:unit}};
 }
 if(name==='get_document'){
  if(!uuid(args.document_id))throw Error('Invalid document ID');
  const rows=await query('/rest/v1/study_documents?id=eq.'+encodeURIComponent(args.document_id)+'&user_id=eq.'+encodeURIComponent(userId)+'&select=id,class_id,unit_title,name,storage_path,mime_type,size_bytes',token);
  const doc=rows?.[0];if(!doc||!doc.storage_path.startsWith(userId+'/'))throw Error('Document not found in your account');
  const url='/storage/v1/object/sign/study-documents/'+doc.storage_path;
  if(['text/plain','text/markdown'].includes(doc.mime_type)&&doc.size_bytes<=350000){
    const r=await fetch(SUPA+'/storage/v1/object/authenticated/study-documents/'+doc.storage_path,{headers:{apikey:KEY,Authorization:'Bearer '+token}});
    if(!r.ok)throw Error('Cannot read document');
    return {id:doc.id,name:doc.name,class_id:doc.class_id,unit_title:doc.unit_title,content:await r.text()};
  }
  const signed=await query(url,token,'POST',{expiresIn:60});
  if(!signed?.signedURL)throw Error('Cannot create download link');
  return {id:doc.id,name:doc.name,class_id:doc.class_id,unit_title:doc.unit_title,temporary_download_url:SUPA+'/storage/v1'+signed.signedURL,expires_in_seconds:60};
 }
 throw Error('Unknown tool');
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,Mcp-Protocol-Version,Mcp-Session-Id');
 if(req.method==='OPTIONS')return response(res,204,'');
 if(req.method==='GET')return response(res,405,{error:'Use POST for MCP JSON-RPC'},{Allow:'POST,OPTIONS','Content-Type':'application/json'});
 if(req.method!=='POST')return response(res,405,'Method not allowed');
 if((Number(req.headers['content-length'])||0)>500000)return response(res,413,{error:'Request too large'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return error(res,null,-32700,'Invalid JSON',400)}
 if(!body||body.jsonrpc!=='2.0'||typeof body.method!=='string')return error(res,body?.id??null,-32600,'Invalid JSON-RPC request',400);
 if(body.method==='notifications/initialized')return response(res,202,'');
 if(body.method==='initialize')return rpc(res,body.id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'The Link Project',version:'0.1.0'}});
 if(body.method==='ping')return rpc(res,body.id,{});
 if(body.method==='tools/list')return rpc(res,body.id,{tools:TOOLS});
 if(body.method!=='tools/call')return error(res,body.id,-32601,'Method not found');
 const authHeader=req.headers.authorization||'';const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():null;
 if(!token)return response(res,401,{error:'unauthorized'},{'Content-Type':'application/json','WWW-Authenticate':'Bearer resource_metadata="'+ORIGIN+'/.well-known/oauth-protected-resource"'});
 const name=body.params?.name;
 if(!TOOLS.some(t=>t.name===name))return error(res,body.id,-32602,'Unknown tool');
 let uid;try{uid=await owner(token)}catch{
  return response(res,401,{error:'invalid_token'},{'Content-Type':'application/json','WWW-Authenticate':'Bearer error="invalid_token", resource_metadata="'+ORIGIN+'/.well-known/oauth-protected-resource"'});
 }
 try{
  const result=await execute(name,body.params?.arguments||{},token,uid);
  return rpc(res,body.id,{content:[{type:'text',text:JSON.stringify(result)}]});
 }catch(e){return rpc(res,body.id,{isError:true,content:[{type:'text',text:e.message||'Operation failed'}]})}
}
