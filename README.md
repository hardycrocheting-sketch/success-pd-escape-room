# Success PD Escape Room

Interactive Next.js app for the SUCCESS PD escape room event.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Firebase and admin values.

3. Run the app:

   ```bash
   npm run dev
   ```

## Vercel Environment Variables

Add these variables in the Vercel project settings:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

`ADMIN_SESSION_SECRET` should be a long random value. It can be different from `ADMIN_PASSWORD`.

## Scheduled Alerts

This project does not use Vercel Cron Jobs. Due scheduled alerts are processed while the dashboard or admin console is open, which avoids Vercel Cron plan limits for event use.
