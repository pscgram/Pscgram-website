# PSCGram — Complete Premium Website Build

This package is the merged PSCGram build intended for Vercel deployment.

## Included
- Premium redesigned public homepage
- Existing Supabase PDF catalogue + secure Razorpay PDF purchase flow
- Free + Paid Online Exam category
- Paid exam Razorpay flow through `supabase/functions/paid-exam/index.ts`
- Exam timer, question navigation and server-side scoring flow
- Admin login, PDF upload, exam creation, question management, publish/unpublish and free/paid switching
- Terms, Privacy, Refund, Pricing and Contact pages
- Mobile responsive UI

## Important
This build keeps the existing working JavaScript/backend architecture and adds the premium UI around it. Do not upload the separate UI mockup files over the top of this package.

Never add a Razorpay secret or Supabase service-role key to `config.js`.

## Supabase
The existing project URL and publishable browser key remain in `config.js`.

## Paid exams
Run `paid_exam.sql`, deploy `supabase/functions/paid-exam/index.ts`, and keep the required server-side Razorpay/Supabase secrets in Supabase Edge Functions only. The browser does not receive `correct_option` for paid exams.

## Vercel
Upload the contents of this folder to the GitHub repository connected to your Vercel project, or upload this ZIP using the deployment method available in your Vercel account. If your existing Vercel project is already connected to GitHub, push these files to the repository and Vercel will redeploy.
