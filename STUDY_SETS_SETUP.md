# Source-grounded study sets — setup and behavior

## What is implemented

For a signed-in student, open a class, create/select a unit, and upload PDF, TXT, MD, PNG, JPEG or WebP sources to the **Private cloud documents** area. The study-set workspace automatically lists only files in that class and unit.

Choose up to four source files and press **Create review sheet + test**. Optionally enable **Generate automatically after uploads** (off by default, since this sends uploaded materials to an external AI provider).

When configured, a server-side OpenAI Responses API call generates a private study-set record with:
- Unit-scoped outline topics and summaries with checkboxes that reveal details and practice examples.
- Source-grounded schematic graphs, explicitly described as conceptual rather than real numerical measurements.
- Multiple-choice questions **only when actual questions are present in the uploaded sources**, paraphrased and labeled as source-adapted rather than official AP material.
- A per-option **Explore this choice** hint that does not disclose the correct answer before submission.
- Per-topic missed-answer rates and attempt counts, saved privately to Supabase.

The progress indicator reports the current stage and is **indeterminate during AI work**, rather than displaying a fabricated percentage. The site saves generated study sets and quiz attempts, so students can revisit them later.

## Required admin setup for real AI generation

The website's ChatGPT MCP OAuth connection lets **ChatGPT call The Link**, not the reverse. It cannot authorize the site to initiate a student's personal ChatGPT chat. Therefore automated upload-to-study-set generation uses a **separate server-side OpenAI API integration**.

1. The site administrator creates an OpenAI API key using their authorized account.
2. In Vercel Project Settings → Environment Variables, add **OPENAI_API_KEY** for Production. Never paste the key into a chat, commit it to GitHub, or put it in frontend code.
3. Optionally add **OPENAI_STUDY_MODEL** (defaults to `gpt-4.1`). Configure an organization/project usage limit and billing alerts; the server caps requests to 5 per student per 24 hours and 2 minutes between requests.
4. Redeploy Production so the function has access to the environment variable. Verify using a small non-sensitive document first.
5. Review the site's AI privacy notice and ensure uploads have appropriate permission to be processed by the AI provider. Do not put sensitive student records into source files.

**Without OPENAI_API_KEY, the endpoint returns HTTP 503 and no files are transmitted to OpenAI.** Upload, class organization and the ChatGPT MCP connection remain usable. This integration does **not** use or expose students' ChatGPT access tokens.

## Source constraints and testing

- For unfinished units, generation only covers content in selected uploaded sources; it does not pull extra external study material.
- No invented official AP questions. If provided files don't contain MCQs, the practice section explicitly states that rather than making unsupported claims.
- Source attribution is produced by a model and should be cross-checked, especially graph labels and question keys.
- PDF file input includes page imagery to handle diagrams; API processing may cost more than plain-text sources.
- Individual sources are limited to 8 MB, combined sources to 12 MB, maximum four files in one generation request.
- Student progress uses attempts in that **unit**, not globally across unrelated classes.
- Uploaded images and PDFs are private in Supabase and streamed to the AI provider only following an explicit click or when the student has opted into auto-generation.
- Student content is sent to the OpenAI API, not automatically into their ChatGPT chat.

## Original AP Macro Unit 3, Part 1

The system supports AP Macroeconomics → Unit 3: National Income and Price Determination. It does **not** import previously sent ChatGPT attachments automatically. Upload the actual permitted AP Macro Unit 3 Part 1 source PDFs into that unit, choose them and generate. Name the source or resulting set 'Unit 3, Part 1' as appropriate. This avoids claiming that the application used materials it never received.

## Future work

- End-to-end real API generation with admin key and model usage verification.
- Two real separate student accounts and cross-account data isolation acceptance test.
- Source-page-specific linking and more rigorous answer-key auditing.
- Avoid last-write-wins class list collisions between the website and ChatGPT; currently the class JSONB document is updated as a whole.
