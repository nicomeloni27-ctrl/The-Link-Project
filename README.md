# The Link Project

Free study-hub website (HTML/CSS/JavaScript) with an optional Supabase backend.

## Current features
- New students start with an empty dashboard; existing saved user classes are preserved.
- Custom classes and units.
- Private Supabase document storage for signed-in users; guest uploads are device-only (max 3 MB per file).
- Google sign-in via Supabase Auth.
- Per-student class/unit cloud syncing, unit-level file tags, and a draft authenticated ChatGPT MCP integration.
- Responsive connected-dot background.

## Set up Supabase class syncing
1. Go to https://supabase.com/dashboard/project/kkjlfvkbtcjkgourkowa/sql/new
2. Open `database.sql` in this repository and paste it into the SQL Editor.
3. Review and run it. It creates `public.study_hubs` and row-level security policies, so authenticated users can only access their own record.
4. Class names and units sync after sign-in. Signed-in document uploads are stored in the private Supabase bucket, while guest uploads remain in the browser.

## Configure Google sign-in
1. In Supabase Dashboard open **Authentication → URL Configuration**.
2. Set the **Site URL** to your actual production Vercel URL, for example `https://the-link-project-ten.vercel.app`, if that URL is your working production address.
3. Add that same URL to **Redirect URLs** (also include any other active domain you plan to use).
4. Go to **Authentication → Sign In / Providers → Google**.
5. Use https://console.cloud.google.com/auth/clients to create a **Web application** OAuth client. Complete the Google consent-screen setup if prompted.
6. Set **Authorized JavaScript origin** to your Vercel origin (without trailing slash).
7. Set **Authorized redirect URI** to **https://kkjlfvkbtcjkgourkowa.supabase.co/auth/v1/callback**.
8. Enter the Google Client ID and **Google Client Secret into Supabase's Google provider settings**, then enable and save the provider. Never commit the secret to GitHub, or send it in chat.
9. Use a test Google account if Google's app is in testing mode.

## Technical notes
- The frontend uses the project's **publishable** Supabase key, which is designed to be public. The **service-role/secret** key must never appear in frontend source.
- All remote class data lives in a per-user row with row-level security, configured by `database.sql`.
- The original ChatGPT Work website and its materials were not imported.
- First sign-in asks before importing shared guest classes. Account caches remain separate. Existing cloud classes load before editing is enabled; unsynced local changes can be recovered explicitly.
- Class/unit changes are synced. Signed-in uploads use private cloud storage; guest uploads remain device-only and may be lost if browser data is cleared.
- The ChatGPT integration uses OAuth approval to let ChatGPT work with a student's Link account. It does not access Google Drive, Classroom, or Gmail.


## Production and verification
- Public production address: https://the-link-project-ten.vercel.app
- Share the production address, not a deployment-specific preview URL. Protected deployment URLs can require a Vercel login.
- In Supabase URL Configuration, use the production address as Site URL and allow `https://the-link-project-ten.vercel.app/` as a redirect. Keep any still-used existing URLs.
- Google authorized JavaScript origin: `https://the-link-project-ten.vercel.app`.
- Google callback URI remains `https://kkjlfvkbtcjkgourkowa.supabase.co/auth/v1/callback`.
- Start sign-in using the website's button. Opening the Supabase callback directly cannot work: it has no OAuth state.
- Signing out waits for queued saves and signs out this browser only. Uploads remain device-only.
- Local account caches are not encrypted; use a separate browser profile on shared computers.
- Simultaneous edits on multiple devices currently use last-write-wins behavior. Finish syncing before switching devices.

Run regression checks with `node --test tests/auth.test.cjs`.
The tests use a simulated backend; they do not replace a real Google sign-in and two-device acceptance test.

## ChatGPT integration (not yet generally enabled)

See [CHATGPT_SETUP.md](./CHATGPT_SETUP.md) for the current implementation, setup steps, security acceptance checklist, and remaining manual Supabase OAuth / ChatGPT registration requirements. The MCP endpoint is on a draft pull request until two real student-account OAuth tests succeed. Mock tests alone are not sufficient for production approval.

## Study sets and practice tests (beta branch)
The `feature/study-set-generator` work introduces private student-owned `study_sets`, `study_answers` and `study_generation_requests` tables; their additive migration is applied to Supabase. Students can select sources within a unit to create a review sheet and practice test, expand explanations, view diagrams, request option-specific hints, and track missed questions by topic.

**Automatic generation is not active until the administrator configures a server-side `OPENAI_API_KEY` in Vercel.** This is separate from ChatGPT's OAuth connection and may incur API charges. The browser sends selected document contents to the server, which passes them to the AI provider **only after a generate action or explicit auto-generation opt-in**. See [STUDY_SETS_SETUP.md](STUDY_SETS_SETUP.md) for privacy and configuration.

Once the feature is deployed and the ChatGPT custom MCP app refreshes its tool list, ChatGPT can also use `save_study_set` to file a structured outline/practice test directly into the signed-in student's existing unit. This path uses only material ChatGPT already has access to and does not invoke the separate paid website AI generator.

Because the original AP Macro Unit 3, Part 1 PDFs are not in this repository or Supabase source library, **the system has not yet generated a source-grounded AP Macro Part 1 test**. Upload only materials you have the right to use.
