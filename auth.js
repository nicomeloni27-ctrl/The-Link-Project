"use strict";
const LINK_SUPABASE_URL = "https://kkjlfvkbtcjkgourkowa.supabase.co";
const LINK_SUPABASE_KEY = "sb_publishable_oj45xpJE4XtmURjAAAguHg_-yDjOLNi";
let linkClient = null, linkUser = null, linkReady = false;
let linkQueue = Promise.resolve(), linkEpoch = 0, linkRevision = 0;
const syncLabel = document.createElement("span");
syncLabel.className = "sync-label";
syncLabel.setAttribute("role", "status");
document.querySelector("header").append(syncLabel);
const retrySync = document.createElement("button");
retrySync.textContent = "Retry sync";
retrySync.hidden = true;
document.querySelector("header").append(retrySync);
const signinButton = document.getElementById("signin");
const clone = value => JSON.parse(JSON.stringify(value));
const stripFiles = (classes = data) => classes.map(({files, ...other}) => other);
const accountKey = id => "the-link-account-" + id;
const pendingKey = id => accountKey(id) + "-pending";
const localRead = key => { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : null; } catch { return null; } };
const hasPending = id => { try { return localStorage.getItem(pendingKey(id)) === "true"; } catch { return false; } };
function syncStatus(message) { syncLabel.textContent = message; }
function lockEditing(locked) {
  window.linkEditingLocked = locked;
  for (const id of ["addClass", "addUnit", "upload"]) document.getElementById(id).disabled = locked;
  document.querySelectorAll(".remove").forEach(button => button.disabled = locked);
}
function showSyncError(error) {
  const code = error?.code;
  syncStatus(code === "42P01" || code === "PGRST205" ? "Class storage needs setup · Retry sync" :
    code === "42501" ? "Class storage access denied · Retry sync" : "Sync unavailable · Your local copy is preserved");
  retrySync.hidden = false;
}
window.linkSync = () => {
  if (!linkClient || !linkUser || !linkReady) return Promise.resolve(false);
  const uid = linkUser.id, epoch = linkEpoch, revision = ++linkRevision;
  const classes = clone(stripFiles());
  try { localStorage.setItem(pendingKey(uid), "true"); } catch { /* Current data can still be sent. */ }
  syncStatus("Saving…");
  linkQueue = linkQueue.catch(() => false).then(async () => {
    if (epoch !== linkEpoch || linkUser?.id !== uid) return false;
    const {error} = await linkClient.from("study_hubs").upsert({user_id: uid, classes, updated_at: new Date().toISOString()}, {onConflict: "user_id"});
    if (error) throw error;
    if (epoch === linkEpoch && revision === linkRevision) {
      try { localStorage.removeItem(pendingKey(uid)); } catch { /* Keep conservative recovery marker. */ }
      syncStatus("Classes synced"); retrySync.hidden = true;
    }
    return true;
  }).catch(error => {
    if (epoch === linkEpoch) showSyncError(error);
    return false;
  });
  return linkQueue;
};
function signedOut() {
  ++linkEpoch;
  linkUser = null; linkReady = false; window.linkStoreKey = null;
  data = localRead(KEY) || clone(defaults);
  signinButton.textContent = "Sign in";
  retrySync.hidden = true;
  home(); lockEditing(false);
  syncStatus("Saved on this device · Sign in to sync");
}
async function signedIn(user, reload = false) {
  if (linkUser?.id === user.id && !reload) return;
  const epoch = ++linkEpoch, key = accountKey(user.id);
  linkUser = user; linkReady = false; window.linkStoreKey = key;
  signinButton.textContent = "Sign out";
  // Never borrow another account's or a shared guest's data automatically.
  const local = localRead(key) || clone(defaults);
  data = local; home(); lockEditing(true); syncStatus("Loading classes…");
  try {
    const {data: row, error} = await linkClient.from("study_hubs").select("classes").eq("user_id", user.id).maybeSingle();
    if (epoch !== linkEpoch) return;
    if (error) throw error;
    let shouldSave = !row;
    if (row) {
      if (!Array.isArray(row.classes)) throw new Error("Invalid class data");
      const recover = hasPending(user.id) && confirm("This browser has unsynced changes. OK: upload this browser's classes. Cancel: use the cloud classes (a local recovery copy will be kept).");
      if (recover) shouldSave = true;
      else {
        if (hasPending(user.id)) localStorage.setItem(key + "-recovery-" + Date.now(), JSON.stringify(local));
        data = row.classes.map(c => ({...c, files: local.find(x => x.id === c.id)?.files || []}));
        localStorage.removeItem(pendingKey(user.id));
      }
    } else if (!localRead(key)) {
      const guest = localRead(KEY);
      if (guest && confirm("Import the guest classes saved in this browser into your new account? Only choose OK if these are your classes.")) data = clone(guest);
    }
    localStorage.setItem(key, JSON.stringify(data));
    linkReady = true; home(); lockEditing(false); retrySync.hidden = true;
    syncStatus("Signed in · Classes synced");
    if (shouldSave) await window.linkSync();
  } catch (error) {
    if (epoch !== linkEpoch) return;
    // Do not permit edits until the cloud load completes: an unseen cloud row
    // must never be overwritten by defaults or a stale browser cache.
    showSyncError(error);
  }
}
retrySync.onclick = () => {
  if (!linkUser) return;
  if (linkReady) window.linkSync(); else signedIn(linkUser, true);
};
window.addEventListener("online", () => { if (linkUser) retrySync.onclick(); });
window.addEventListener("beforeunload", event => {
  if (linkUser && hasPending(linkUser.id)) { event.preventDefault(); event.returnValue = ""; }
});
async function initializeAuth() {
  lockEditing(true); signinButton.disabled = true; syncStatus("Connecting…");
  try {
    const {createClient} = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    linkClient = createClient(LINK_SUPABASE_URL, LINK_SUPABASE_KEY, {auth: {flowType: "pkce", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true}});
    const {data: result, error} = await linkClient.auth.getSession();
    // Register after initial SDK initialization, before the asynchronous hub read.
    linkClient.auth.onAuthStateChange((_event, session) => setTimeout(() => {
      if (session?.user && session.user.id !== linkUser?.id) signedIn(session.user);
      else if (!session?.user && linkUser) signedOut();
    }, 0));
    if (error) {
      syncStatus("Sign-in did not finish · Please try Sign in again");
      lockEditing(false);
    } else if (result.session?.user) await signedIn(result.session.user);
    else {
      lockEditing(false);
      syncStatus(window.linkOAuthError ? "Google sign-in was not completed · Please try again" : "Saved on this device · Sign in to sync");
    }
    if (location.search.includes("code=") || window.linkOAuthError) history.replaceState(null, "", location.pathname + "#/");
    signinButton.onclick = async () => {
      signinButton.disabled = true;
      try {
        if (linkUser) {
          lockEditing(true);
          await linkQueue;
          if (hasPending(linkUser.id) && !confirm("Some changes are saved only in this browser. Sign out anyway? They will be available when you return to this account here.")) return;
          const {error} = await linkClient.auth.signOut({scope: "local"});
          if (error) throw error;
          signedOut();
        } else {
          syncStatus("Opening Google sign-in…");
          const {error} = await linkClient.auth.signInWithOAuth({provider: "google", options: {redirectTo: location.origin + "/"}});
          if (error) throw error;
        }
      } catch { syncStatus("Sign-in or sign-out failed · Please try again"); }
      finally { signinButton.disabled = false; lockEditing(Boolean(linkUser && !linkReady)); }
    };
  } catch {
    lockEditing(false);
    syncStatus("Sign-in unavailable · Device storage still works");
    signinButton.onclick = () => initializeAuth();
  } finally { signinButton.disabled = false; }
}
initializeAuth();
