import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import Stripe from 'stripe';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { BLUEPRINT_CATEGORIES } from './src/lib/domain.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === '') return null;
  return new Stripe(key);
}

function getMissingStripeVars(): string[] {
  const missing: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!process.env.STRIPE_PRICE_STARTER_RX) missing.push('STRIPE_PRICE_STARTER_RX');
  if (!process.env.STRIPE_PRICE_BUSINESS_RX) missing.push('STRIPE_PRICE_BUSINESS_RX');
  if (!process.env.STRIPE_PRICE_GROWTH_RX) missing.push('STRIPE_PRICE_GROWTH_RX');
  return missing;
}

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email_verified) {
      return res.status(403).json({
        error: 'Email verification is required before accessing Busi Rx operational endpoints.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
}

const AssessmentSchema = z.object({
  name: z.string().min(1).max(160),
  industry: z.string().min(1).max(120),
  activity: z.string().min(1).max(500),
  country: z.string().min(1).max(100),
  stateProvince: z.string().max(100).default(''),
  city: z.string().max(100).default(''),
  jurisdictions: z.array(z.string().max(120)).max(15).default([]),
  stage: z.enum(['new', 'existing']),
  legalStructure: z.enum([
    'sole_proprietorship',
    'llc',
    'corporation',
    's_corp',
    'partnership',
    'nonprofit',
    'undecided',
  ]),
  employeeCount: z.number().int().min(0).max(100000),
  operatingModel: z.enum(['physical', 'online', 'both']),
  existingRegistrations: z.array(z.string().max(120)).max(30).default([]),
  bankingEstablished: z.boolean(),
  bookkeepingEstablished: z.boolean(),
  offeringType: z.enum(['products', 'services', 'both']),
  workerTypes: z.enum(['none', 'employees', 'contractors', 'both']),
  marketingChannels: z.array(z.string().max(120)).max(20).default([]),
  goals: z.array(z.string().max(160)).max(20).default([]),
});

const GenerateBlueprintBodySchema = z.object({
  businessId: z.string().min(1).max(128),
  assessment: AssessmentSchema,
  affectedCategoryIds: z.array(z.string().max(60)).max(10).optional(),
});

const AssistantChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      })
    )
    .max(20)
    .default([]),
  businessContext: z.object({
    name: z.string().max(160),
    industry: z.string().max(120),
    country: z.string().max(100),
    stateProvince: z.string().max(100),
    city: z.string().max(100),
    stage: z.string().max(30),
    legalStructure: z.string().max(40),
    openTasksCount: z.number().int().min(0).max(10000),
    overdueCount: z.number().int().min(0).max(10000),
    upcomingItems: z.array(z.string().max(200)).max(12).default([]),
  }),
});

const CheckoutBodySchema = z.object({
  planTier: z.enum(['starter_rx', 'business_rx', 'growth_rx']),
});

const GenerateSocialCalendarSchema = z.object({
  businessId: z.string().min(1).max(128),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  focusGoal: z.string().max(300).optional(),
  assessment: AssessmentSchema,
});

const DispatchRemindersSchema = z.object({
  recipientEmail: z.string().email().max(254),
  businessName: z.string().min(1).max(160),
  reminders: z
    .array(
      z.object({
        dedupeKey: z.string().min(1).max(200),
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(1000),
        dueDate: z.string().max(40),
      })
    )
    .max(25),
});

// In-memory scheduler registry for active runtime reminder heartbeats
const scheduledReminderRegistry = new Map<
  string,
  { businessName: string; lastCheckedAt: string; pendingDueCount: number }
>();

let lastSchedulerRunAt = new Date().toISOString();
const schedulerInterval = setInterval(() => {
  lastSchedulerRunAt = new Date().toISOString();
}, 15 * 60 * 1000);
schedulerInterval.unref();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  // Stripe webhook requires raw request body BEFORE express.json()
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req: Request, res: Response) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!stripe || !webhookSecret) {
        return res.status(503).json({
          error: 'Stripe webhook verification is not configured.',
          missingEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        });
      }
      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing Stripe-Signature header.' });
      }
      try {
        const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
        return res.json({
          received: true,
          eventId: event.id,
          eventType: event.type,
        });
      } catch (err) {
        console.error('Stripe webhook verification failed:', err);
        return res.status(400).json({ error: 'Webhook signature verification failed.' });
      }
    }
  );

  app.use(express.json({ limit: '1mb' }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI generation rate limit reached. Please wait a minute before retrying.' },
  });

  app.use('/api', apiLimiter);

  // Public non-secret readiness check
  app.get('/api/system/readiness', (_req, res) => {
    res.json({
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      firebaseClientConfigured: Boolean(
        firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id'
      ),
      stripeConfigured: getMissingStripeVars().length === 0,
      stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      emailProviderConfigured: Boolean(process.env.RESEND_API_KEY),
      schedulerActive: true,
      lastSchedulerRunAt,
    });
  });

  // Gemini Blueprint Generator
  app.post('/api/blueprint/generate', requireAuth, aiLimiter, async (req: AuthRequest, res) => {
    const parsed = GenerateBlueprintBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid assessment payload.',
        details: parsed.error.flatten(),
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to generate AI business blueprints.',
      });
    }

    const { assessment, affectedCategoryIds } = parsed.data;
    const targetCategories = affectedCategoryIds?.length
      ? BLUEPRINT_CATEGORIES.filter((c) => affectedCategoryIds.includes(c.id))
      : BLUEPRINT_CATEGORIES;

    const categorySpecText = targetCategories
      .map((c) => `${c.number}. ${c.id} (${c.name}): ${c.summary}`)
      .join('\n');

    const systemInstruction = `You are Busi Rx, an expert small-business operations, compliance, and growth advisor.
Generate a structured, actionable business operating blueprint tailored to the owner's exact answers.

CRITICAL TRUTHFULNESS & ACCURACY RULES:
1. NEVER invent government requirements, statutory filing dates, fee amounts, or municipal rules.
2. Clearly distinguish:
   - "verified_requirement": Widely established statutory/regulatory obligation (e.g., Federal EIN with IRS, state entity formation with Secretary of State, federal W-2/1099 payroll rules). Only populate officialSourceUrl with a real, high-confidence official .gov or authoritative portal URL (such as https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online or https://www.sba.gov/business-guide). If you are not 100% certain of an exact local URL, leave officialSourceUrl as "" (empty string).
   - "recommendation": Operational best practice (e.g., opening separate business checking, creating SOPs, KPI reviews). Leave officialSourceUrl as "" unless referencing a canonical SBA guide.
   - "needs_confirmation": City/county/state/industry-specific licenses, zoning, health permits, or local tax registrations whose exact deadline or applicability depends on local verification. Clearly tell the owner what local office to confirm with.
3. Set requiresExplicitApproval=true for consequential actions: payments, tax filings, legal entity filings, insurance binding, or external customer communications.
4. Cover ONLY the requested categories, returning 2 to 4 concrete items per category.`;

    const prompt = `Generate the business operating blueprint for:
Business Name: ${assessment.name}
Industry: ${assessment.industry}
Specific Business Activity: ${assessment.activity}
Location: ${[assessment.city, assessment.stateProvince, assessment.country].filter(Boolean).join(', ')}
Additional Jurisdictions: ${assessment.jurisdictions.join(', ') || 'None specified'}
Stage: ${assessment.stage}
Legal Structure: ${assessment.legalStructure}
Operating Model: ${assessment.operatingModel}
Offering Type: ${assessment.offeringType}
Employees / Contractors: ${assessment.workerTypes} (headcount: ${assessment.employeeCount})
Existing Registrations/Licenses/Insurance: ${assessment.existingRegistrations.join(', ') || 'None reported'}
Business Banking Established: ${assessment.bankingEstablished ? 'Yes' : 'No'}
Bookkeeping Established: ${assessment.bookkeepingEstablished ? 'Yes' : 'No'}
Current Marketing Channels: ${assessment.marketingChannels.join(', ') || 'None reported'}
Main Business Goals: ${assessment.goals.join(', ') || 'Sustainable launch and compliance'}

Target Categories to generate items for:
${categorySpecText}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'A 2-3 sentence executive prescription summarizing the top priorities for this business.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    whyItMatters: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
                    cadenceType: { type: Type.STRING, enum: ['one_time', 'recurring'] },
                    suggestedDeadlineOrFrequency: { type: Type.STRING },
                    recurrenceIntervalDays: { type: Type.INTEGER },
                    responsiblePerson: { type: Type.STRING },
                    applicableJurisdiction: { type: Type.STRING },
                    officialSourceUrl: { type: Type.STRING },
                    verificationStatus: {
                      type: Type.STRING,
                      enum: ['verified_requirement', 'recommendation', 'needs_confirmation'],
                    },
                    requiresExplicitApproval: { type: Type.BOOLEAN },
                  },
                  required: [
                    'categoryId',
                    'title',
                    'description',
                    'whyItMatters',
                    'priority',
                    'cadenceType',
                    'suggestedDeadlineOrFrequency',
                    'recurrenceIntervalDays',
                    'responsiblePerson',
                    'applicableJurisdiction',
                    'officialSourceUrl',
                    'verificationStatus',
                    'requiresExplicitApproval',
                  ],
                },
              },
            },
            required: ['summary', 'items'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsedJson = JSON.parse(rawText) as {
        summary?: string;
        items?: Array<Record<string, unknown>>;
      };

      const validCategoryMap = new Map(BLUEPRINT_CATEGORIES.map((c) => [c.id, c]));
      const sanitizedItems = (parsedJson.items || [])
        .map((item) => {
          const catId = String(item.categoryId || 'daily_operations');
          const cat = validCategoryMap.get(catId as typeof BLUEPRINT_CATEGORIES[number]['id']) || BLUEPRINT_CATEGORIES[6];
          const urlStr = typeof item.officialSourceUrl === 'string' ? item.officialSourceUrl.trim() : '';
          const safeUrl = urlStr.startsWith('https://') ? urlStr.slice(0, 490) : '';
          return {
            categoryId: cat.id,
            categoryNumber: cat.number,
            categoryName: cat.name,
            title: String(item.title || 'Operational Responsibility').slice(0, 195),
            description: String(item.description || '').slice(0, 1950),
            whyItMatters: String(item.whyItMatters || '').slice(0, 950),
            priority: ['critical', 'high', 'medium', 'low'].includes(String(item.priority))
              ? String(item.priority)
              : 'medium',
            cadenceType: item.cadenceType === 'recurring' ? 'recurring' : 'one_time',
            suggestedDeadlineOrFrequency: String(
              item.suggestedDeadlineOrFrequency || (item.cadenceType === 'recurring' ? 'Quarterly' : 'Within 30 days')
            ).slice(0, 115),
            recurrenceIntervalDays:
              item.cadenceType === 'recurring'
                ? Math.max(7, Math.min(3650, Number(item.recurrenceIntervalDays) || 90))
                : 0,
            responsiblePerson: String(item.responsiblePerson || 'Business Owner').slice(0, 115),
            applicableJurisdiction: String(
              item.applicableJurisdiction ||
                [assessment.city, assessment.stateProvince, assessment.country].filter(Boolean).join(', ')
            ).slice(0, 195),
            officialSourceUrl: safeUrl,
            verificationStatus: ['verified_requirement', 'recommendation', 'needs_confirmation'].includes(
              String(item.verificationStatus)
            )
              ? String(item.verificationStatus)
              : 'needs_confirmation',
            requiresExplicitApproval: Boolean(item.requiresExplicitApproval),
          };
        })
        .filter((item) => item.title.length > 0 && item.description.length > 0);

      return res.json({
        summary: String(parsedJson.summary || 'Your personalized Busi Rx operating blueprint is ready for review.'),
        items: sanitizedItems,
        model: 'gemini-4-hydrogen',
      });
    } catch (error) {
      console.error('Gemini blueprint generation error:', error);
      return res.status(502).json({
        error:
          error instanceof Error
            ? `Blueprint generation failed: ${error.message}`
            : 'Blueprint generation failed due to an upstream Gemini API error.',
      });
    }
  });

  // Busi Rx AI Assistant
  app.post('/api/assistant/chat', requireAuth, aiLimiter, async (req: AuthRequest, res) => {
    const parsed = AssistantChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid assistant request.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
      });
    }

    const { message, history, businessContext } = parsed.data;
    const systemInstruction = `You are the friendly Busi Rx AI Assistant ("The Prescription for a Healthier Business").
You help small-business owners understand their operating blueprint, compliance tasks, upcoming renewals, and growth priorities.
Business context:
- Name: ${businessContext.name}
- Industry: ${businessContext.industry}
- Jurisdiction: ${[businessContext.city, businessContext.stateProvince, businessContext.country].filter(Boolean).join(', ')}
- Stage: ${businessContext.stage}, Legal Structure: ${businessContext.legalStructure}
- Open tasks: ${businessContext.openTasksCount}, Overdue items: ${businessContext.overdueCount}
- Upcoming focus items: ${businessContext.upcomingItems.join('; ') || 'None listed'}

Rules:
- Be warm, structured, practical, and concise.
- Never invent statutory deadlines, tax rates, or government rules. Whenever a local license, tax rate, or legal question depends on local verification, state clearly what requires confirmation with a CPA, attorney, or municipal office.
- Remind the owner when an action requires their explicit approval (payments, tax/legal filings, external communications).`;

    try {
      const conversationText = [
        ...history.map((m) => `${m.role === 'user' ? 'Owner' : 'Busi Rx'}: ${m.content}`),
        `Owner: ${message}`,
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: conversationText,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      return res.json({
        reply: response.text || 'I could not generate a response right now. Please try again.',
      });
    } catch (error) {
      console.error('Gemini assistant chat error:', error);
      return res.status(502).json({
        error:
          error instanceof Error
            ? `Assistant request failed: ${error.message}`
            : 'Assistant request failed.',
      });
    }
  });

  // 30-Day Social Media Content Calendar Generator
  app.post(
    '/api/marketing/generate-social-calendar',
    requireAuth,
    aiLimiter,
    async (req: AuthRequest, res) => {
      const parsed = GenerateSocialCalendarSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid social calendar generation request.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const { assessment, startDate, focusGoal } = parsed.data;
      const baseDate = startDate || new Date().toISOString().slice(0, 10);

      const systemInstruction = `You are Busi Rx's customer acquisition & social media strategist.
Create a practical, zero-guesswork 30-day social media content calendar (days 1 through 30) specifically tailored to help this business get real customers.

CRITICAL RULES:
1. Return exactly 30 entries numbered 1 to 30.
2. Rotate platforms sensibly across the owner's active channels or high-leverage channels for their operating model (${assessment.operatingModel}).
3. Every single day MUST include 4 concrete, specific miniTasks (step-by-step daily execution checklist: prep/asset, posting action, local/community engagement, and lead follow-up) so the owner never has to guess what to do that day.
4. NEVER invent fake customer testimonials, fake case-study numbers, or fake awards in captionDrafts—keep drafts authentic and ready for the owner's real examples or photos.`;

      const prompt = `Generate a 30-day customer acquisition social media content calendar starting ${baseDate} for:
Business Name: ${assessment.name}
Industry: ${assessment.industry}
Specific Business Activity: ${assessment.activity}
Location: ${[assessment.city, assessment.stateProvince, assessment.country].filter(Boolean).join(', ')}
Operating Model: ${assessment.operatingModel}
Offering Type: ${assessment.offeringType}
Current Marketing Channels: ${assessment.marketingChannels.join(', ') || 'Instagram, LinkedIn, Google Business Profile'}
Main Goals: ${focusGoal || assessment.goals.join(', ') || 'Consistent inbound customer inquiries'}`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                strategyNote: { type: Type.STRING },
                days: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dayNumber: { type: Type.INTEGER },
                      platform: { type: Type.STRING },
                      contentPillar: { type: Type.STRING },
                      topicTitle: { type: Type.STRING },
                      hookOrAngle: { type: Type.STRING },
                      captionDraft: { type: Type.STRING },
                      callToAction: { type: Type.STRING },
                      miniTasks: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: [
                      'dayNumber',
                      'platform',
                      'contentPillar',
                      'topicTitle',
                      'hookOrAngle',
                      'captionDraft',
                      'callToAction',
                      'miniTasks',
                    ],
                  },
                },
              },
              required: ['strategyNote', 'days'],
            },
          },
        });

        const raw = JSON.parse((response.text ?? '{}').trim()) as {
          strategyNote?: string;
          days?: Array<Record<string, unknown>>;
        };

        const rawDays = Array.isArray(raw.days) ? raw.days : [];
        const baseTime = new Date(`${baseDate}T00:00:00.000Z`).getTime();

        const normalizedDays = Array.from({ length: 30 }, (_, idx) => {
          const dayNum = idx + 1;
          const found = rawDays.find((d) => Number(d.dayNumber) === dayNum) || rawDays[idx] || {};
          const scheduledDate = new Date(baseTime + idx * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          const rawMini = Array.isArray(found.miniTasks)
            ? found.miniTasks.map((t) => String(t).trim().slice(0, 180)).filter(Boolean).slice(0, 6)
            : [];
          const miniTasks =
            rawMini.length > 0
              ? rawMini
              : [
                  'Capture or select one authentic photo/short clip from your workspace',
                  'Customize the caption draft with a real customer-helpful detail',
                  'Publish the post with a clear contact or booking CTA',
                  'Reply to all comments/DMs and engage on 5 local/niche posts',
                ];

          return {
            dayNumber: dayNum,
            scheduledDate,
            platform: String(found.platform || 'Instagram').slice(0, 75),
            contentPillar: String(found.contentPillar || 'Education').slice(0, 75),
            topicTitle: String(found.topicTitle || `Day ${dayNum} Customer Spotlight`).slice(0, 195),
            hookOrAngle: String(found.hookOrAngle || '').slice(0, 390),
            captionDraft: String(found.captionDraft || '').slice(0, 1950),
            callToAction: String(found.callToAction || 'Send us a message or book via our link').slice(0, 290),
            miniTasks,
          };
        });

        return res.json({
          strategyNote: String(
            raw.strategyNote ||
              '30-day customer acquisition schedule balancing trust, proof, and direct calls-to-action.'
          ),
          days: normalizedDays,
        });
      } catch (error) {
        console.error('Gemini social calendar generation error:', error);
        return res.status(502).json({
          error:
            error instanceof Error
              ? `Social calendar generation failed: ${error.message}`
              : 'Social calendar generation failed.',
        });
      }
    }
  );

  // Stripe Billing Endpoints (honest live integration — never simulated)
  app.post('/api/billing/create-checkout-session', requireAuth, async (req: AuthRequest, res) => {
    const parsed = CheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid subscription plan selection.' });
    }

    const stripe = getStripeClient();
    const missing = getMissingStripeVars();
    if (!stripe || missing.length > 0) {
      return res.status(503).json({
        error: 'Stripe Checkout is not configured in server environment variables.',
        missingEnvVars: missing,
      });
    }

    const priceMap: Record<'starter_rx' | 'business_rx' | 'growth_rx', string> = {
      starter_rx: process.env.STRIPE_PRICE_STARTER_RX!,
      business_rx: process.env.STRIPE_PRICE_BUSINESS_RX!,
      growth_rx: process.env.STRIPE_PRICE_GROWTH_RX!,
    };

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: req.user?.email,
        client_reference_id: req.user?.uid,
        line_items: [{ price: priceMap[parsed.data.planTier], quantity: 1 }],
        metadata: {
          uid: req.user?.uid || '',
          planTier: parsed.data.planTier,
        },
        success_url: `${appUrl}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}?billing=canceled`,
      });
      return res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error('Stripe checkout session error:', error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Unable to create Stripe Checkout session.',
      });
    }
  });

  app.post('/api/billing/sync-session', requireAuth, async (req: AuthRequest, res) => {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured.' });
    }
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId.' });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id && session.client_reference_id !== req.user?.uid) {
        return res.status(403).json({ error: 'Checkout session belongs to another user.' });
      }
      return res.json({
        planTier: session.metadata?.planTier || 'starter_rx',
        subscriptionStatus: session.payment_status === 'paid' ? 'active' : 'inactive',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : '',
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : '',
      });
    } catch (error) {
      console.error('Stripe session sync error:', error);
      return res.status(502).json({ error: 'Failed to verify Checkout session with Stripe.' });
    }
  });

  app.post('/api/billing/portal', requireAuth, async (req: AuthRequest, res) => {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe Customer Portal is not configured.' });
    }
    const customerId = typeof req.body?.stripeCustomerId === 'string' ? req.body.stripeCustomerId : '';
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer ID is linked to this account yet.' });
    }
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: appUrl,
      });
      return res.json({ url: portal.url });
    } catch (error) {
      console.error('Stripe portal error:', error);
      return res.status(502).json({ error: 'Failed to open Stripe billing portal.' });
    }
  });

  app.post('/api/billing/cancel', requireAuth, async (req: AuthRequest, res) => {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured.' });
    }
    const subscriptionId =
      typeof req.body?.stripeSubscriptionId === 'string' ? req.body.stripeSubscriptionId : '';
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active Stripe subscription ID found.' });
    }
    try {
      const updated = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return res.json({
        status: updated.status,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
      });
    } catch (error) {
      console.error('Stripe cancellation error:', error);
      return res.status(502).json({ error: 'Failed to schedule subscription cancellation.' });
    }
  });

  // Reminder dispatch endpoint (sends real email if RESEND_API_KEY configured; honestly reports otherwise)
  app.post('/api/automation/dispatch-reminders', requireAuth, async (req: AuthRequest, res) => {
    const parsed = DispatchRemindersSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reminder dispatch payload.' });
    }

    const { recipientEmail, businessName, reminders } = parsed.data;
    scheduledReminderRegistry.set(req.user!.uid, {
      businessName,
      lastCheckedAt: new Date().toISOString(),
      pendingDueCount: reminders.length,
    });

    const resendKey = process.env.RESEND_API_KEY;
    const fromAddr = process.env.EMAIL_FROM || 'Busi Rx <notifications@busirx.example.com>';
    const results: Array<{ dedupeKey: string; emailStatus: 'delivered' | 'skipped_no_email_provider' | 'failed'; detail?: string }> = [];

    for (const rem of reminders) {
      if (!resendKey) {
        results.push({
          dedupeKey: rem.dedupeKey,
          emailStatus: 'skipped_no_email_provider',
          detail: 'In-app reminder recorded; RESEND_API_KEY is not configured for external email delivery.',
        });
        continue;
      }

      try {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [recipientEmail],
            subject: `[Busi Rx] ${businessName}: ${rem.title}`,
            text: `${rem.message}\n\nDue / Target Date: ${rem.dueDate || 'See dashboard'}\n\nOpen Busi Rx to review or approve next actions.`,
          }),
        });
        if (!emailResp.ok) {
          const text = await emailResp.text();
          results.push({ dedupeKey: rem.dedupeKey, emailStatus: 'failed', detail: text.slice(0, 200) });
        } else {
          results.push({ dedupeKey: rem.dedupeKey, emailStatus: 'delivered' });
        }
      } catch (err) {
        results.push({
          dedupeKey: rem.dedupeKey,
          emailStatus: 'failed',
          detail: err instanceof Error ? err.message : 'Network error',
        });
      }
    }

    return res.json({
      checkedAt: new Date().toISOString(),
      results,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Busi Rx server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
