"use strict";
const cloudBox=document.createElement("article");cloudBox.className="panel";
const cloudHeading=document.createElement("h2");cloudHeading.textContent="Private cloud documents";
const cloudStatus=document.createElement("p");cloudStatus.className="note";
const cloudList=document.createElement("div");cloudBox.append(cloudHeading,cloudStatus,cloudList);
document.querySelector("#course .columns").append(cloudBox);
let cloudEpoch=0;
window.refreshCloudDocs=async function(){
 const epoch=++cloudEpoch,client=window.linkDocumentsClient,uid=window.linkDocumentsUser?.id,classId=active;
 cloudList.replaceChildren();
 if(!classId)return;
 if(!uid||!client){cloudStatus.textContent="Sign in to sync documents across devices.";return}
 cloudStatus.textContent="Loading documents…";
 const {data:rows,error}=await client.from("study_documents").select("id,name,storage_path").eq("user_id",uid).eq("class_id",classId).order("created_at",{ascending:false});
 if(epoch!==cloudEpoch)return;
 if(error){cloudStatus.textContent="Document list unavailable.";return}
 cloudStatus.textContent=rows.length?rows.length+" saved document(s)":"No cloud documents yet.";
 for(const file of rows){
  const line=document.createElement("div");line.className="item";
  const view=document.createElement("button");view.className="link";view.textContent=file.name;
  view.onclick=async()=>{const {data,error}=await client.storage.from("study-documents").createSignedUrl(file.storage_path,60);if(error){alert("Could not open document.");return}window.open(data.signedUrl,"_blank","noopener,noreferrer")};
  const del=document.createElement("button");del.textContent="×";del.className="remove";del.setAttribute("aria-label","Delete document");
  del.onclick=async()=>{if(!confirm("Delete this document?"))return;const {error}=await client.storage.from("study-documents").remove([file.storage_path]);if(error){alert("Delete failed.");return}await client.from("study_documents").delete().eq("id",file.id).eq("user_id",uid);window.refreshCloudDocs()};
  line.append(view,del);cloudList.append(line);
 }
};
window.linkCloudUpload=async function(files,classId){
 const client=window.linkDocumentsClient,uid=window.linkDocumentsUser?.id;
 if(!client||!uid){alert("Please sign in first.");return}
 for(const file of files){
  if(file.size>10485760){alert("10 MB maximum: "+file.name);continue}
  const ext=file.name.split(".").pop().toLowerCase();
  const mime={pdf:"application/pdf",txt:"text/plain",md:"text/markdown",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp"}[ext];
  if(!mime){alert("Unsupported file: "+file.name);continue}
  const path=uid+"/"+crypto.randomUUID()+"."+ext;
  cloudStatus.textContent="Uploading "+file.name+"…";
  const {error}=await client.storage.from("study-documents").upload(path,file,{contentType:mime});
  if(error){alert("Upload failed: "+file.name);continue}
  const saved=await client.from("study_documents").insert({user_id:uid,class_id:classId,name:file.name.slice(0,255),storage_path:path,mime_type:mime,size_bytes:file.size});
  if(saved.error){await client.storage.from("study-documents").remove([path]);alert("Saving document record failed.");}
 }
 window.refreshCloudDocs();
};
