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


# PSCGram Premium UI v2 additions

This version keeps the existing Razorpay/Online Exam files and adds:
- Premium mobile-first home dashboard
- Daily Current Affairs page
- Date/category filter UI
- PSC Quick Fact card
- Premium membership section
- Feature/stat cards
- Admin panel for publishing Daily Current Affairs
- Supabase SQL schema: `daily_current_affairs.sql`

## One-time Supabase step
Open Supabase → SQL Editor → paste/run `daily_current_affairs.sql`.

## Then deploy the whole `pscgram_complete` folder to Vercel.

The Current Affairs page includes safe preview cards if the new table has no entries yet.


### PSC preparation levels
Added dedicated Home sections for **10th Level**, **12th Level**, and **Degree Level** with mobile-friendly cards and links into the exam centre.


## Daily Current Affairs admin
The Admin dashboard now supports **Edit** and **Delete** for published current affairs. Editing loads the existing entry and **Update & Republish** saves the corrected version. Delete is available only to the admin dashboard.


## Premium Membership v6
One-time ₹999 payment gives 1 year of Premium Membership. Run `premium_membership.sql` in Supabase SQL Editor, then deploy `supabase/functions/premium-membership/index.ts` as the `premium-membership` Edge Function with Verify JWT OFF. It uses the existing `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` server secrets.


### v7 fix
Free exams no longer require a paid exam access token. The `paid-exam` Edge Function now allows `start` and `submit` for published free exams while keeping token verification for paid exams.
