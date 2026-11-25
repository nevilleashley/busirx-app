# Busi Rx — Setup, Security & Deployment Guide

**Tagline:** The Prescription for a Healthier Business.

## 1. Architecture Overview
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend (`server.ts`)**: Express API server with Firebase Admin token verification, `zod` schema validation, `express-rate-limit`, Gemini `@google/genai` (`gemini-4-hydrogen`), Stripe Checkout + verified webhook endpoint, and background scheduler heartbeat
- **Live AI Studio Persistence & Auth**: Firebase Authentication (Google Sign-In + Email Verification gate) and Cloud Firestore with Eight-Pillars `firestore.rules`
- **Standalone Supabase SQL Artifacts**: Complete PostgreSQL schema, RLS policies, and private Storage bucket policies included in `/supabase/migrations/`

## 2. Environment Variables
Copy `.env.example` and configure secrets in your hosting environment (Cloud Run / AI Studio Secrets):
- `GEMINI_API_KEY`: Required for server-side blueprint generation and Busi Rx AI Assistant
- `APP_URL`: Public URL of the deployed Cloud Run service (used for Stripe Checkout redirects)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_RX`, `STRIPE_PRICE_BUSINESS_RX`, `STRIPE_PRICE_GROWTH_RX`: Required before enabling live paid subscriptions
- `RESEND_API_KEY`, `EMAIL_FROM`: Optional external email dispatch provider (in-app notifications always work)

## 3. Production Readiness & Honest Verification Gate
Before accepting paying customers:
1. Configure live Stripe keys, create the $8 Starter Rx, $17 Business Rx, and $26 Growth Rx recurring prices in Stripe Dashboard, and register `POST /api/billing/webhook` with `STRIPE_WEBHOOK_SECRET`.
2. Deploy `storage.rules` if using Firebase Storage binary uploads, or apply `/supabase/migrations/*.sql` if running against Supabase PostgreSQL.
3. Run `npm test`, `npm run lint`, and `npm run build` and verify against a real Firebase Emulator / staging Stripe webhook test (`stripe trigger checkout.session.completed`).

## 4. Google Cloud Run Deployment
```bash
gcloud builds submit --tag gcr.io/<PROJECT_ID>/busirx
gcloud run deploy busirx \
  --image gcr.io/<PROJECT_ID>/busirx \
  --platform managed \
  --port 3000 \
  --allow-unauthenticated
```
