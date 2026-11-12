# The Link Project

Free study-hub website (HTML/CSS/JavaScript) with an optional Supabase backend.

## Current features
- Six default class cards, including AP Macroeconomics.
- Custom classes and units.
- Device-only file uploads (max 3 MB per file).
- Google OAuth sign-in wired through Supabase (requires provider configuration).
- Per-student class/unit cloud syncing when the SQL setup has been run.
- Responsive connected-dot background.

## Set up Supabase class syncing
1. Go to https://supabase.com/dashboard/project/kkjlfvkbtcjkgourkowa/sql/new
2. Open `database.sql` in this repository and paste it into the SQL Editor.
3. Review and run it. It creates `public.study_hubs` and row-level security policies, so authenticated users can only access their own record.
4. Class names and units sync after sign-in. Uploaded documents currently remain only in the originating browser; they are NOT uploaded to Supabase.

## Configure Google sign-in
1. In Supabase Dashboard open **Authentication → URL Configuration**.
2. Set the **Site URL** to your actual production Vercel URL, for example `https://the-link-project-e8yts90fs-the-link-project.vercel.app`, if that URL is your working production address.
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
- When signing in for the first time, locally saved classes can initialize the user's empty cloud record; an existing cloud record takes priority.
- Class/unit changes are synced; file uploads are **local only**. Local browser storage is limited, and files can be lost if browser data is cleared.
- The app does not request Google Drive, Classroom, Gmail, or ChatGPT account access.
