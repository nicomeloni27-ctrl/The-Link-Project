# ChatGPT integration — deployment checklist

The Link Project has an **unreleased remote MCP endpoint** at `https://the-link-project-ten.vercel.app/api/mcp` using **Supabase-issued OAuth 2.1 user tokens**. All requests run with the **student's own bearer token**; the project must **never** use a service-role token for ChatGPT document or class operations.

> **Do not advertise this as fully connected until the OAuth setup and two real-account tests below pass.** ChatGPT app approval and public availability are controlled by ChatGPT and may require additional review or account eligibility.

## Step 1 — Supabase owner setup (manual)

1. Open **Supabase Dashboard → Authentication → OAuth Server** for project `kkjlfvkbtcjkgourkowa`.
2. Enable the OAuth 2.1 server and enable **dynamic client registration** if offered. If the setting is unavailable, pre-register ChatGPT using the exact client metadata and redirect URL shown during custom app setup.
3. Set **Authorization Path** to `/oauth/consent`. Keep the **Site URL** `https://the-link-project-ten.vercel.app` and allow the OAuth consent route and the sign-in redirects in **Redirect URLs**. This is different from the Google identity provider callback.
4. Require explicit consent. Set trusted redirect restrictions, use asymmetric JWT signing keys when required, and verify OAuth discovery at `https://kkjlfvkbtcjkgourkowa.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
5. Do not put the Google OAuth client secret, Supabase service role key, or any user token in GitHub. The frontend publishable key is intentionally public.

The site serves the OAuth consent page at `/oauth/consent`. It shows the requesting client name, actual redirect URI, scopes, the current student's account, and **Allow access / Decline**. A student who is not signed in can use the Google sign-in option and return to the consent page.

## Step 2 — Vercel

The project already has a Git-connected Vercel app. Merge the reviewed branch only after its preview builds and tests pass. Verify:

- `GET /.well-known/oauth-protected-resource` returns JSON with resource `https://the-link-project-ten.vercel.app/api/mcp` and the project's Supabase authorization server.
- `POST /api/mcp` with a JSON-RPC `initialize` call returns MCP capabilities.
- `POST /api/mcp` with `tools/list` advertises supported actions.
- An unauthenticated `tools/call` returns **401** with a `WWW-Authenticate` challenge.
- An authenticated call uses the signed-in student's real Supabase OAuth token and never a service role token.

The MCP endpoint is stateless JSON-RPC over HTTP and returns JSON responses. It does not implement SSE/event streaming; verify compatibility with the specific ChatGPT MCP client before enabling public use.

## Step 3 — Students connect individually (manual)

1. Sign in to `https://the-link-project-ten.vercel.app` with your own Google/Link account. A new student's dashboard begins with no classes.
2. In ChatGPT settings, find **Apps / custom apps** (availability varies) and create a custom MCP app with server URL `https://the-link-project-ten.vercel.app/api/mcp`.
3. Complete the Supabase OAuth sign-in and examine the consent details. Only click Allow access if you recognize the app and redirect.
4. Ask: **"List my classes in The Link."** Then: **"Create a class called AP Chemistry in The Link."**
5. On the Link website, refresh to see the new class. You can then create units and ask ChatGPT to save text resources.

**Capabilities:** list classes/units, create classes, add units, list documents, save text/Markdown study documents, retrieve text content, or get a short-lived download URL for existing PDFs/images. ChatGPT file attachments are **not automatically transferred** by this endpoint. Upload PDFs/images through The Link's website, then ask ChatGPT to list/retrieve them.

**Status:** ChatGPT manages the connection state, and the Link website currently cannot independently query whether a ChatGPT account is linked. The website explicitly labels this status **unverified**; it must not pretend that pressing "Connect" means linked.

## Step 4 — Two-student security acceptance test (requires two student accounts)

- Sign in as student A and create Class A and Unit A; verify on the website and in ChatGPT.
- Sign in as student B separately and create Class B and Unit B.
- Save a text document with student A; upload a PDF to student B's class through the website.
- Verify A cannot see B's class or document; B cannot see A's class or document.
- Try retrieving B's document UUID using A's OAuth token: expect a not-found error.
- Ensure signed URLs expire and that anonymous requests cannot list documents.
- Verify old accounts retain their current classes, and new accounts have no default classes.
- Check deployment status, logs, and real account Google OAuth callback before declaring the connection production-ready.

**Automated mock tests** are in `tests/mcp.test.mjs`. They demonstrate request handling and simulated account separation but are **not** a substitute for the two real OAuth accounts test.

## Known limitations and next steps

- Class lists are stored in one JSONB row per user. The current website and MCP tools use **last-write-wins** saves; simultaneous editing in two devices can overwrite a recent change. Avoid simultaneous changes until optimistic concurrency is added.
- A nullable `unit_title` column was added without deleting old rows, and the website + MCP tool inputs now support filing under an existing class unit. Existing documents without a unit remain unassigned.
- The existing website may still keep older guest uploads in the browser, while signed-in documents are stored in the private bucket.
- ChatGPT public discoverability is a platform review/availability decision; a deployed MCP endpoint does **not** automatically make a public ChatGPT app.
- This project has not yet passed a two-real-account OAuth acceptance test; do not mark full integration **connected** until it does.

Official references:
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://developers.openai.com/plugins/build/auth
