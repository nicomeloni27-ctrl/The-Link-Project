"use strict";
// Per-student source-grounded review sheets, practice tests and learning progress.
const studyPanel=document.createElement("article");studyPanel.className="panel study-panel";
document.querySelector("#course").append(studyPanel);
const S=(tag,txt="",cls="")=>{const n=document.createElement(tag);n.textContent=txt;if(cls)n.className=cls;return n};
const studyState={classId:null,unit:"",docs:[],sets:[],answers:[],current:null,chosen:new Map(),busy:false,epoch:0,aiReady:false};
function boxLine(parent,...children){const d=S("div","","study-row");d.append(...children);parent.append(d);return d}
const heading=S("div","","heading");heading.append(S("h2","Study sets & practice tests"));
const unitSelect=S("select");unitSelect.setAttribute("aria-label","Choose study unit");unitSelect.className="study-select";
const autoLabel=S("label","","study-auto"),auto=S("input");auto.type="checkbox";autoLabel.append(auto,document.createTextNode(" Generate automatically after uploads (sends selected files to the AI service)"));
const note=S("p","Use your own PDF, image or text sources. Upload questions from your materials to include source-grounded multiple choice. AI-generated questions are adaptations, not official AP exam items.","note");
const sourceTitle=S("h3","Source documents");const sourceList=S("div");
const actions=S("div","","study-actions"),generateBtn=S("button","Create review sheet + test"),refreshBtn=S("button","Refresh study sets");refreshBtn.className="link";
actions.append(generateBtn,refreshBtn);
const progressArea=S("div","","study-progress");progressArea.hidden=true;const progressLabel=S("p","","note");progressLabel.setAttribute("role","status");const progress=S("progress");progress.max=100;progress.value=0;progressArea.append(progressLabel,progress);
const status=S("p","","note");status.setAttribute("role","status");
const aiAvailability=S("p","Checking whether automatic AI generation is available…","note");
const setList=S("div");const display=S("div");
studyPanel.append(heading,unitSelect,autoLabel,note,aiAvailability,sourceTitle,sourceList,actions,progressArea,status,setList,display);
function key(){return "link-ai-auto-"+(window.linkDocumentsUser?.id||"guest")}
auto.onchange=()=>{if(!studyState.aiReady){auto.checked=false;return}localStorage.setItem(key(),auto.checked?"true":"false")};
unitSelect.onchange=()=>{studyState.unit=unitSelect.value;window.linkPreferredUploadUnit=studyState.unit;if(window.linkUploadUnitSelect)window.linkUploadUnitSelect.value=studyState.unit;loadWorkspace()};
refreshBtn.onclick=()=>loadWorkspace();
generateBtn.onclick=()=>runGeneration();
function setStatus(s){status.textContent=s}
async function checkAI(){
 try{const r=await fetch("/api/generate-study",{method:"GET"});const result=await r.json();studyState.aiReady=r.ok&&result.configured===true}
 catch{studyState.aiReady=false}
 auto.disabled=!studyState.aiReady;
 if(!studyState.aiReady){auto.checked=false;generateBtn.disabled=true;aiAvailability.textContent="Automatic AI generation is not configured yet. Existing study sets can be opened here; the site administrator must configure the server-side OpenAI API integration."}
 else{generateBtn.disabled=studyState.busy;aiAvailability.textContent="AI generation is available. Enable automatic generation only if you agree to send the selected sources to the AI provider."}
}
function busy(on,label){studyState.busy=on;generateBtn.disabled=on||!studyState.aiReady;progressArea.hidden=!on;if(on){progress.value=20;progressLabel.textContent=label}else progress.value=0}
async function authenticated(){
 const client=window.linkDocumentsClient,user=window.linkDocumentsUser;
 if(!client||!user)throw Error("Sign in to create and save private study sets");
 const {data:{session}}=await client.auth.getSession();
 if(!session?.access_token)throw Error("Session expired. Sign in again.");
 return {client,user,token:session.access_token};
}
function checkboxDocs(){
 return [...sourceList.querySelectorAll("input[type=checkbox]:checked")].map(x=>x.value);
}
async function loadWorkspace(){
 const epoch=++studyState.epoch,classId=active,unit=studyState.unit;
 studyState.classId=classId;studyState.docs=[];studyState.sets=[];studyState.answers=[];studyState.current=null;sourceList.replaceChildren();setList.replaceChildren();display.replaceChildren();
 const priorStats=studyPanel.querySelector(".study-stats");if(priorStats)priorStats.remove();
 if(!classId)return;
 const course=data.find(c=>c.id===classId);
 unitSelect.replaceChildren();
 const units=course?.units||[];
 if(!units.length){unitSelect.append(new Option("Add a unit to create a study set",""));studyState.unit="";setStatus("Add a unit and upload study materials first.");return}
 for(const name of units)unitSelect.append(new Option(name,name));
 if(!units.includes(unit))studyState.unit=units[0];
 unitSelect.value=studyState.unit;
 window.linkPreferredUploadUnit=studyState.unit;
 if(window.linkUploadUnitSelect&&[...window.linkUploadUnitSelect.options].some(x=>x.value===studyState.unit))window.linkUploadUnitSelect.value=studyState.unit;
 auto.checked=studyState.aiReady&&localStorage.getItem(key())==="true";
 if(!window.linkDocumentsUser||!window.linkDocumentsClient){setStatus("Sign in to use AI study sets and save quiz progress.");return}
 try{
  const {client,user}=await authenticated();
  const [docs,sets,unitSets]=await Promise.all([
   client.from("study_documents").select("id,name,unit_title,created_at").eq("user_id",user.id).eq("class_id",classId).eq("unit_title",studyState.unit).order("created_at",{ascending:false}),
   client.from("study_sets").select("id,title,content,created_at").eq("user_id",user.id).eq("class_id",classId).eq("unit_title",studyState.unit).order("created_at",{ascending:false}).limit(20),
   client.from("study_sets").select("id").eq("user_id",user.id).eq("class_id",classId).eq("unit_title",studyState.unit).limit(200)
  ]);
  if(epoch!==studyState.epoch)return;
  for(const r of [docs,sets,unitSets])if(r.error)throw Error(r.error.message);
  studyState.docs=docs.data||[];studyState.sets=sets.data||[];
  let answers=[];
  if(unitSets.data?.length){
   const ids=unitSets.data.map(s=>s.id);
   const got=await client.from("study_answers").select("set_id,topic,correct,chosen_index,question_id,created_at").eq("user_id",user.id).in("set_id",ids).order("created_at",{ascending:false}).limit(1000);
   if(got.error)throw Error(got.error.message);answers=got.data||[];
  }
  if(epoch!==studyState.epoch)return;studyState.answers=answers;
  renderSources();renderSets();renderProgress();
  setStatus(studyState.docs.length?studyState.docs.length+" source document(s) in "+studyState.unit+". Choose sources and generate a study set.":"No sources in this unit. Choose the unit before uploading PDFs or other materials.");
 }catch(e){setStatus("Study sets unavailable: "+e.message)}
}
function renderSources(){
 sourceList.replaceChildren();
 if(!studyState.docs.length){sourceList.append(S("p","No cloud documents filed under this unit.","empty"));return}
 studyState.docs.forEach(d=>{const label=S("label","","study-source"),check=S("input");check.type="checkbox";check.value=d.id;check.checked=true;label.append(check,S("span",d.name));sourceList.append(label)});
}
function renderSets(){
 setList.replaceChildren();
 const h=S("h3","Generated review sheets & tests");setList.append(h);
 if(!studyState.sets.length){setList.append(S("p","No generated study sets yet.","empty"));return}
 for(const s of studyState.sets){
  const line=S("div","","item"),left=S("span",s.title+" · "+new Date(s.created_at).toLocaleDateString());
  const btn=S("button","Open");btn.onclick=()=>showSet(s);
  line.append(left,btn);setList.append(line)
 }
}
async function runGeneration(preselected){
 if(studyState.busy)return;
 if(!studyState.aiReady){setStatus("Automatic AI generation is not configured yet.");return}
 const classId=active,unit=studyState.unit,ids=preselected||checkboxDocs();
 if(!classId||!unit){setStatus("Add or select a unit.");return}
 if(!ids.length){setStatus("Select at least one source document before generating.");return}
 if(ids.length>4){setStatus("Select at most four documents per generation.");return}
 try{
  const {token}=await authenticated();
  busy(true,"Step 1 of 3 · Gathering private source documents");
  progress.value=30;
  // This indicator stays in the analysis stage until the server responds; no fake percentage.
  progressLabel.textContent="Step 2 of 3 · AI analyzing sources and creating the outline, graphs and practice test…";
  progress.removeAttribute("value");setStatus("Generation in progress. Keep this tab open.");
  const response=await fetch("/api/generate-study",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({class_id:classId,unit_title:unit,source_document_ids:ids})});
  const json=await response.json().catch(()=>({error:"Server returned an unexpected response"}));
  if(!response.ok)throw Error(json.error||"Could not generate study set");
  progress.value=100;progressLabel.textContent="Step 3 of 3 · Saved to this unit";
  setStatus("Created: "+json.title+" · "+json.outline_topics+" topics, "+json.graphs+" graphs, "+json.questions+" source-adapted questions.");
  await loadWorkspace();
 }catch(e){setStatus("Generation not completed: "+e.message)}
 finally{busy(false)}
}
function showSet(set){
 studyState.current=set;studyState.chosen=new Map();display.replaceChildren();
 const wrap=S("div","","study-content"),head=S("div","","heading");
 const title=S("h3",set.title),buttons=S("div","","study-actions"),outlineBtn=S("button","Review sheet"),testBtn=S("button","Practice test");
 buttons.append(outlineBtn,testBtn);head.append(title,buttons);wrap.append(head);
 const area=S("div");wrap.append(area);display.append(wrap);
 outlineBtn.onclick=()=>renderOutline(set.content,area);
 testBtn.onclick=()=>renderTest(set,area);
 renderOutline(set.content,area);display.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderOutline(c,area){
 area.replaceChildren();area.append(S("p",c.overview||""));
 area.append(S("p","Check each topic to expand its explanation and practice example.","note"));
 (c.outline||[]).forEach(t=>{
  const block=S("div","","study-topic"),label=S("label","","study-topic-title"),check=S("input");
  check.type="checkbox";const details=S("div","","study-details");details.hidden=true;
  label.append(check,S("strong",t.topic));block.append(label,S("p",t.summary||""),details);
  check.onchange=()=>details.hidden=!check.checked;
  const ul=S("ul");for(const d of t.details||[])ul.append(S("li",d));
  details.append(ul,S("h4","Practice example"),S("p",t.practice_example||"No source-based example available."),S("p","Source: "+(t.source||"Not specified"),"note"));
  area.append(block)
 });
 if(c.graphs?.length){area.append(S("h3","Graphs and diagrams"));renderGraphs(c.graphs,area)}
}
function renderGraphs(graphs,area){
 const gallery=S("div","","study-graphs");
 for(const g of graphs){
  const block=S("div","","study-graph");block.append(S("h4",g.title||"Study graph"));
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 340 240");svg.setAttribute("role","img");svg.setAttribute("aria-label",g.title||"Graph");svg.classList.add("graph-svg");
  function node(tag,attrs,txt){
   const el=document.createElementNS("http://www.w3.org/2000/svg",tag);
   for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
   if(txt!==undefined)el.textContent=txt;svg.append(el);return el;
  }
  node("line",{x1:44,y1:198,x2:322,y2:198,stroke:"#b8d7fc","stroke-width":2});
  node("line",{x1:44,y1:198,x2:44,y2:16,stroke:"#b8d7fc","stroke-width":2});
  node("text",{x:178,y:231,fill:"#e8f2ff","text-anchor":"middle","font-size":11},g.x_label||"X");
  node("text",{x:6,y:14,fill:"#e8f2ff","font-size":11},g.y_label||"Y");
  const colors=["#7cd6ff","#f8d478","#e6a2f3","#8ce3b2"];
  (g.lines||[]).slice(0,4).forEach((line,i)=>{
   const pts=(line.points||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,15);
   if(pts.length<2)return;
   const coordinates=pts.map(p=>(44+Math.max(0,Math.min(100,p.x))*2.68)+","+(198-Math.max(0,Math.min(100,p.y))*1.75)).join(" ");
   node("polyline",{points:coordinates,fill:"none",stroke:colors[i],"stroke-width":3,"stroke-linecap":"round"});
   node("text",{x:230,y:25+i*17,fill:colors[i],"font-size":11},(line.label||"Line").slice(0,20))
  });
  block.append(svg,S("p",g.note||"Conceptual schematic; not observed data.","note"),S("p","Source: "+(g.source||"Not specified"),"note"));gallery.append(block);
 }area.append(gallery)
}
function renderTest(set,area){
 area.replaceChildren();const c=set.content||{};
 area.append(S("p","Choose an option to record an answer. Use “Explore this choice” first to get a hint without revealing the correct answer.","note"));
 if(c.graphs?.length){area.append(S("h3","Graph reference gallery"));renderGraphs(c.graphs,area)}
 const qlist=c.questions||[];
 if(!qlist.length){area.append(S("p","No multiple-choice questions were present in the uploaded sources. Add documents containing actual questions; the generator does not invent official AP items.","empty"));return}
 qlist.forEach((q,i)=>{
  const card=S("div","","study-question");
  card.append(S("h4",(i+1)+". "+q.prompt),S("p","Topic: "+q.topic+" · Source: "+q.source,"note"));
  const feedback=S("p","","study-feedback"),hint=S("p","","study-hint");
  const choices=S("div","","study-choices"),btns=[];
  q.options.forEach((opt,j)=>{
   const row=S("div","","study-choice"),choose=S("button",String.fromCharCode(65+j)+". "+opt),explore=S("button","Explore this choice");explore.className="link";
   choose.onclick=async()=>{
    if(studyState.chosen.has(q.id))return;
    studyState.chosen.set(q.id,j);
    const right=j===q.correct_index;
    feedback.textContent=right?"Correct. "+q.explanation:"Incorrect. "+q.explanation;
    feedback.className="study-feedback "+(right?"correct":"incorrect");
    btns.forEach(b=>b.disabled=true);
    try{
     const {client,user}=await authenticated();
     const {error}=await client.from("study_answers").insert({user_id:user.id,set_id:set.id,question_id:q.id,topic:q.topic,chosen_index:j,correct:right});
     if(error)throw Error(error.message);
     const {data:rows}=await client.from("study_answers").select("set_id,topic,correct,chosen_index,question_id,created_at").eq("user_id",user.id).eq("set_id",set.id);
     if(rows){studyState.answers=studyState.answers.filter(a=>a.set_id!==set.id).concat(rows);renderProgress()}
    }catch(e){feedback.textContent+=" (Your answer was not saved: "+e.message+")"}
   };
   explore.onclick=()=>{hint.textContent="Consider this option: "+(q.hints?.[j]||"Which relationship in the source material supports this?")};
   btns.push(choose);row.append(choose,explore);choices.append(row)
  });
  card.append(choices,hint,feedback);area.append(card)
 });
}
function renderProgress(){
 const previous=studyPanel.querySelector(".study-stats");if(previous)previous.remove();
 const stats=S("section","","study-stats");stats.append(S("h3","Practice accuracy by topic"));
 const grouped=new Map();
 for(const a of studyState.answers){const topic=a.topic||"Other";const x=grouped.get(topic)||{total:0,wrong:0};x.total++;if(!a.correct)x.wrong++;grouped.set(topic,x)}
 if(!grouped.size){stats.append(S("p","Answer questions to track your strengths and areas to review.","empty"))}
 else for(const [topic,v] of [...grouped.entries()].sort((a,b)=>b[1].wrong/b[1].total-a[1].wrong/a[1].total)){
  const rate=Math.round(100*v.wrong/v.total),line=S("div","","study-stat");
  const top=S("div","","study-stat-label");top.append(S("span",topic),S("strong",rate+"% missed · "+v.total+" attempt(s)"));
  const track=S("div","","study-stat-track"),bar=S("div","","study-stat-bar");bar.style.width=rate+"%";track.append(bar);line.append(top,track);stats.append(line)
 }
 setList.after(stats);
}
window.refreshStudyWorkspace=loadWorkspace;
checkAI();
window.studyOnUploaded=async function(uploaded,classId,unit){
 if(!uploaded.length||classId!==active)return;
 if(studyState.unit!==unit){studyState.unit=unit;await loadWorkspace()}else await loadWorkspace();
 if(auto.checked&&unit&&uploaded.length<=4){
  setStatus("New sources uploaded. Starting automatic generation as requested…");
  await runGeneration(uploaded);
 }else if(auto.checked&&!unit){setStatus("Select a unit before uploading to use automatic study-set generation.")}
};
loadWorkspace();
