"use strict";
const LINK_SUPABASE_URL="https://kkjlfvkbtcjkgourkowa.supabase.co";
const LINK_SUPABASE_KEY="sb_publishable_oj45xpJE4XtmURjAAAguHg_-yDjOLNi";
let linkClient=null,linkUser=null,linkReady=false,linkQueue=Promise.resolve();
const syncLabel=document.createElement("span");
syncLabel.className="sync-label";
syncLabel.setAttribute("role","status");
document.querySelector("header").append(syncLabel);
function syncStatus(msg){syncLabel.textContent=msg;}
const stripFiles=()=>data.map(({files,...other})=>({...other}));
const accountKey=id=>"the-link-account-"+id;
const localRead=key=>{try{const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:null;}catch{return null;}};
window.linkSync=()=>{
 if(!linkClient||!linkUser||!linkReady)return;
 const uid=linkUser.id,classes=JSON.parse(JSON.stringify(stripFiles()));
 syncStatus("Saving…");
 linkQueue=linkQueue.catch(()=>{}).then(async()=>{
   if(linkUser?.id!==uid)return;
   const {error}=await linkClient.from("study_hubs").upsert({user_id:uid,classes,updated_at:new Date().toISOString()},{onConflict:"user_id"});
   if(error)throw error;
   syncStatus("Classes synced");
 }).catch(err=>{console.error("Cloud saving error",err);syncStatus("Sync failed; saved locally");});
};
function signedOut(){
 linkUser=null;linkReady=false;window.linkStoreKey=null;
 data=localRead(KEY)||JSON.parse(JSON.stringify(defaults));document.getElementById("signin").textContent="Sign in";
 syncStatus("Saved on this device");home();
}
async function signedIn(user){
 if(linkUser?.id===user.id)return;
 linkUser=user;linkReady=false;window.linkStoreKey=accountKey(user.id);
 document.getElementById("signin").textContent="Sign out";
 const local=localRead(window.linkStoreKey)||localRead(KEY)||JSON.parse(JSON.stringify(defaults));
 data=local;home();syncStatus("Loading classes…");
 try{
   const {data:row,error}=await linkClient.from("study_hubs").select("classes").eq("user_id",user.id).maybeSingle();
   if(error)throw error;
   if(row&&Array.isArray(row.classes)){
     data=row.classes.map(c=>({...c,files:local.find(x=>x.id===c.id)?.files||[]}));
   }else{
     const {error:insertErr}=await linkClient.from("study_hubs").upsert({user_id:user.id,classes:stripFiles()},{onConflict:"user_id"});
     if(insertErr)throw insertErr;
   }
   localStorage.setItem(window.linkStoreKey,JSON.stringify(data));
   linkReady=true;syncStatus("Signed in · Classes synced");home();
 }catch(err){console.error("Cloud loading error",err);syncStatus("Signed in · Run database.sql in Supabase to enable sync");home();}
}
(async()=>{
 try{
   const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
   linkClient=createClient(LINK_SUPABASE_URL,LINK_SUPABASE_KEY,{auth:{flowType:"pkce",persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
   const {data:sessionResult,error}=await linkClient.auth.getSession();
   if(error)throw error;
   if(sessionResult.session?.user)await signedIn(sessionResult.session.user);
   else syncStatus("Saved on this device · Sign in to sync");
   linkClient.auth.onAuthStateChange((_event,session)=>setTimeout(()=>{
     if(session?.user&&!linkUser)signedIn(session.user);
     else if(!session?.user&&linkUser)signedOut();
   },0));
   document.getElementById("signin").onclick=async()=>{
     if(linkUser){const {error}=await linkClient.auth.signOut();if(error)alert(error.message);return;}
     syncStatus("Opening Google sign-in…");
     const {error}=await linkClient.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
     if(error){syncStatus("Google login not configured");alert(error.message);}
   };
 }catch(err){
   console.error("Auth initialization error",err);syncStatus("Sign-in unavailable; device storage still works");
   document.getElementById("signin").onclick=()=>alert("Sign-in service unavailable.");
 }
})();