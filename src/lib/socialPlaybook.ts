import { addDaysIso, formatIsoDate } from './domain.ts';
import type { BusinessAssessmentInput, SocialCalendarDay } from '../types/busirx.ts';

export type GeneratedSocialDayDraft = Omit<
  SocialCalendarDay,
  | 'id'
  | 'businessId'
  | 'ownerUid'
  | 'completedMiniTasks'
  | 'requiresExternalPublishApproval'
  | 'approvedToPublish'
  | 'dayStatus'
  | 'createdAt'
  | 'updatedAt'
>;

interface DayTemplateSpec {
  contentPillar: string;
  topicTitle: (ctx: TemplateContext) => string;
  hookOrAngle: (ctx: TemplateContext) => string;
  captionDraft: (ctx: TemplateContext) => string;
  callToAction: (ctx: TemplateContext) => string;
  miniTasks: (ctx: TemplateContext) => string[];
}

interface TemplateContext {
  businessName: string;
  industry: string;
  activity: string;
  locationLabel: string;
  offeringPhrase: string;
  primaryGoal: string;
}

const DEFAULT_PLATFORMS = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Google Business Profile',
  'TikTok',
];

function resolveChannels(assessment: BusinessAssessmentInput): string[] {
  const cleaned = (assessment.marketingChannels || [])
    .map((c) => c.trim())
    .filter(Boolean);
  if (cleaned.length >= 2) return cleaned;
  if (assessment.operatingModel === 'physical') {
    return ['Google Business Profile', 'Instagram', 'Facebook', 'TikTok'];
  }
  if (assessment.offeringType === 'services') {
    return ['LinkedIn', 'Instagram', 'Google Business Profile', 'Facebook'];
  }
  return DEFAULT_PLATFORMS;
}

const THIRTY_DAY_TEMPLATES: DayTemplateSpec[] = [
  {
    contentPillar: 'Brand Story & Mission',
    topicTitle: (c) => `Why We Built ${c.businessName}`,
    hookOrAngle: (c) => `Photo of you in your workspace + overlay: "The problem in ${c.industry} that sparked ${c.businessName}."`,
    captionDraft: (c) =>
      `People often ask why we started ${c.businessName}${c.locationLabel ? ` in ${c.locationLabel}` : ''}.\n\nWhen we looked closely at ${c.industry}, we saw customers tired of guesswork and slow follow-through. Our focus on ${c.activity} exists to deliver dependable ${c.offeringPhrase} you can count on from day one.\n\nIf you're looking for help with ${c.activity}, our doors (and inbox) are open.`,
    callToAction: () => `Send us a direct message with "START" or tap our bio link to inquire today.`,
    miniTasks: (c) => [
      `Snap one clear photo of your workspace, tools, or finished work for ${c.businessName}`,
      `Customize the opening sentence with the real milestone that motivated your launch`,
      `Publish the post and pin it to the top of your profile for new visitors`,
      `Reply to every comment and log any interested commenters in Generated Leads`,
    ],
  },
  {
    contentPillar: 'Problem & Solution',
    topicTitle: (c) => `The #1 Mistake Customers Make Before Calling a ${c.industry} Pro`,
    hookOrAngle: () => `Bold 1-line text graphic: "Stop wasting money on this common mistake before you book."`,
    captionDraft: (c) =>
      `Most people who reach out to ${c.businessName} for ${c.activity} tell us the exact same story—they tried a quick shortcut first and ended up spending twice as much time and money.\n\nHere is what to check before you commit:\n1. Clarify the real outcome you need\n2. Confirm what is included upfront\n3. Ask how ongoing support works\n\nSave this checklist so you never get caught off guard.`,
    callToAction: () => `Comment "CHECKLIST" or message us if you want our team to review your current setup.`,
    miniTasks: () => [
      `Write the 3 bullets in simple everyday words your ideal buyer uses`,
      `Publish as a carousel or clean 3-point graphic`,
      `Leave 5 helpful, non-spammy comments on local community or niche posts`,
      `Send a quick follow-up DM to anyone who saves or comments on the post`,
    ],
  },
  {
    contentPillar: 'Behind the Scenes',
    topicTitle: (c) => `Inside a Real Day at ${c.businessName}`,
    hookOrAngle: () => `15-second vertical clip or 3-photo sequence showing prep, execution, and quality check.`,
    captionDraft: (c) =>
      `What goes into delivering great ${c.offeringPhrase} in ${c.industry}? Today's behind-the-scenes snapshot from ${c.businessName}${c.locationLabel ? ` (${c.locationLabel})` : ''} shows the prep work our clients rarely see—double-checking details before anything goes out the door.\n\nQuality isn't an accident; it's a repeatable checklist.`,
    callToAction: (c) => `Need ${c.activity} handled properly? Message us to check our next open slot.`,
    miniTasks: () => [
      `Record 3 short 4-second clips or take 3 photos of today's real work in progress`,
      `Add captions or alt text describing what makes your process thorough`,
      `Post on your primary channel and reshare to Stories with a Poll sticker`,
      `Follow up with Story poll voters and add warm replies to Generated Leads`,
    ],
  },
  {
    contentPillar: 'Direct Offer',
    topicTitle: (c) => `How to Work With ${c.businessName} This Month`,
    hookOrAngle: () => `Clean service/product menu card: "3 ways we can help you right now."`,
    captionDraft: (c) =>
      `Not sure where to start with ${c.businessName}? Here is how new customers work with us for ${c.activity}:\n\n• Option 1: Starter Consultation / First Order\n• Option 2: Core ${c.offeringPhrase} Package\n• Option 3: Ongoing Support & Maintenance\n\nClear pricing, clear timelines, and real accountability.`,
    callToAction: () => `DM us "OPTIONS" or visit our profile link to request pricing and availability.`,
    miniTasks: (c) => [
      `Fill in your actual 3 starter offers and turnaround times before posting`,
      `Verify your contact link, phone number, or booking URL works on mobile`,
      `Publish the post and add the same update to Google Business Profile`,
      `Add every inquiry received today into the Generated Leads tracker`,
    ],
  },
  {
    contentPillar: 'Educational Quick Tip',
    topicTitle: (c) => `60-Second Tip for Better Results in ${c.industry}`,
    hookOrAngle: () => `Talking-head or crisp graphic: "One quick 60-second fix you can apply today."`,
    captionDraft: (c) =>
      `Quick tip from the ${c.businessName} team: you don't always need a massive overhaul to see better results with ${c.activity}.\n\nSpend 10 minutes this week reviewing your biggest bottleneck—whether it's timing, materials, or consistency—and fix that single step first.\n\nHave a specific question? Drop it below and we'll answer right in the comments.`,
    callToAction: (c) => `Comment your biggest question about ${c.activity} and we'll reply personally.`,
    miniTasks: () => [
      `Pick one genuine FAQ your customers ask every week`,
      `Publish a concise 3-sentence tip with zero jargon`,
      `Engage for 10 minutes with 5 complementary local or industry businesses`,
      `DM commenters who ask detailed questions and invite them to a quick call`,
    ],
  },
  {
    contentPillar: 'Customer Proof & Trust',
    topicTitle: (c) => `What Customers Notice Most About ${c.businessName}`,
    hookOrAngle: () => `Real customer review quote card or authentic delivery/project photo.`,
    captionDraft: (c) =>
      `Nothing builds confidence like clear communication and delivering what was promised.\n\nAt ${c.businessName}, we measure every job by whether a customer would gladly recommend us to a neighbor or colleague${c.locationLabel ? ` in ${c.locationLabel}` : ''}.\n\nIf you've worked with us recently, we'd love to hear how your experience went!`,
    callToAction: (c) => `Ready to experience stress-free ${c.activity}? Send us a message for an estimate.`,
    miniTasks: () => [
      `Pull one real customer quote or review you received (never fabricate quotes)`,
      `Pair the quote with a real photo of your workspace or finished deliverable`,
      `Tag or thank your community and share the post`,
      `Reach out to 2 past buyers to ask for a fresh Google review`,
    ],
  },
  {
    contentPillar: 'Weekly Wrap & Lead Callout',
    topicTitle: (c) => `This Week's Open Availability at ${c.businessName}`,
    hookOrAngle: () => `Simple calendar graphic: "Booking slots open for next week."`,
    captionDraft: (c) =>
      `Wrapping up the week at ${c.businessName}! We just opened our calendar for next week's ${c.activity} projects${c.locationLabel ? ` across ${c.locationLabel}` : ''}.\n\nIf you've been meaning to check this off your list, message us today so we can reserve a spot before the schedule fills up.`,
    callToAction: () => `Reply "NEXT WEEK" or tap our booking link to claim a spot.`,
    miniTasks: () => [
      `Check your actual calendar for open hours or inventory capacity next week`,
      `Post your availability update across Stories and your feed`,
      `Review all Week 1 DMs and comments and log any missed prospects in Generated Leads`,
      `Send one polite check-in message to any open lead from Days 1–6`,
    ],
  },
  {
    contentPillar: 'Myth vs. Reality',
    topicTitle: (c) => `Myth vs. Reality in ${c.industry}`,
    hookOrAngle: () => `Split comparison graphic: "What most people assume vs. what actually works."`,
    captionDraft: (c) =>
      `Let's clear up a common myth around ${c.activity}:\n\nMyth: You have to wait until everything is in crisis mode to call an expert.\nReality: Addressing small issues early with ${c.businessName} saves money, protects quality, and keeps your schedule predictable.\n\nWhich myth have you heard most often?`,
    callToAction: () => `Message us with your situation and we'll give you an honest next-step recommendation.`,
    miniTasks: (c) => [
      `Write one real misconception buyers have before purchasing ${c.offeringPhrase}`,
      `Format as a clean 2-column or 2-slide comparison`,
      `Publish and ask a simple yes/no question in the first comment`,
      `Invite commenters who agree into a direct conversation`,
    ],
  },
  {
    contentPillar: 'Process Walkthrough',
    topicTitle: (c) => `Step-by-Step: What Happens After You Contact ${c.businessName}`,
    hookOrAngle: () => `Numbered 1-2-3 roadmap visual: "From first message to completed result."`,
    captionDraft: (c) =>
      `Thinking about reaching out to ${c.businessName} for ${c.activity}? Here is exactly what happens—zero surprises:\n\n1. Quick 5-minute discovery message or call\n2. Clear scope, timeline, and upfront price\n3. Execution and follow-up check-in\n\nSimple, transparent, and built around your schedule.`,
    callToAction: () => `Ready for Step 1? Send us a quick DM or request an estimate via our link.`,
    miniTasks: () => [
      `Confirm your inquiry form, email, and phone line are monitored today`,
      `Share the 3-step roadmap graphic so hesitant buyers feel comfortable reaching out`,
      `Update your Google Business Profile description with the same 3-step promise`,
      `Add any new inbound messages straight into Generated Leads`,
    ],
  },
  {
    contentPillar: 'Local & Niche Spotlight',
    topicTitle: (c) => `Serving Customers ${c.locationLabel ? `Across ${c.locationLabel}` : 'In Our Community'}`,
    hookOrAngle: () => `Neighborhood or workspace photo: "Proud to support local businesses and neighbors."`,
    captionDraft: (c) =>
      `We love serving customers${c.locationLabel ? ` right here in ${c.locationLabel}` : ''} through ${c.businessName}.\n\nEvery order and project helps us keep investing in better ${c.offeringPhrase} and faster turnaround for our community. Tag a local business or friend who should know what we do!`,
    callToAction: () => `Local referral? Send this post to a friend and message us for priority scheduling.`,
    miniTasks: () => [
      `Take a photo showing your local storefront, neighborhood landmark, or shipping desk`,
      `Mention 2–3 complementary local businesses you genuinely respect`,
      `Use 3–5 specific local or industry hashtags (avoid spammy hashtag walls)`,
      `Follow up with any local owners who reply or reshare`,
    ],
  },
  {
    contentPillar: 'FAQ Answer',
    topicTitle: (c) => `How Much Time (or Budget) Does ${c.activity} Actually Take?`,
    hookOrAngle: () => `Text-on-photo hook: "Honest answer to our #1 most-asked question."`,
    captionDraft: (c) =>
      `One of the smartest questions new clients ask ${c.businessName} is: "What should I realistically expect for timeline and budget?"\n\nThe honest answer depends on three things: scope, timing, and whether foundational pieces are already in place. That's why we review those three factors with you before you spend a dollar.`,
    callToAction: () => `Want a personalized ballpark for your needs? Message us "QUOTE" anytime.`,
    miniTasks: () => [
      `Write down your real turnaround window so customers know what to expect`,
      `Publish the post and save the answer in your phone notes for fast DM replies`,
      `Reply to 5 prospective customer posts or local group questions usefully`,
      `Update lead stages in Generated Leads for everyone contacted this week`,
    ],
  },
  {
    contentPillar: 'Before & After / Transformation',
    topicTitle: (c) => `Before vs. After: Why Details Matter in ${c.industry}`,
    hookOrAngle: () => `Side-by-side comparison photo or workflow breakdown showing messy vs. organized.`,
    captionDraft: (c) =>
      `The difference between "good enough" and reliable ${c.offeringPhrase} shows up in the details.\n\nSwipe/look at how ${c.businessName} takes ${c.activity} from disorganized and stressful to structured and ready for results.\n\nWant this kind of clarity for your own project or purchase?`,
    callToAction: () => `DM us "BEFORE" if you want us to take a look at what you have today.`,
    miniTasks: () => [
      `Choose a real before-and-after example or workflow comparison from your work`,
      `Point out 2 specific improvements clearly in the caption`,
      `Cross-post to LinkedIn or Facebook for broader organic reach`,
      `Message 2 qualified leads in your pipeline with a link to this example`,
    ],
  },
  {
    contentPillar: 'Tools & Standards',
    topicTitle: (c) => `What We Use at ${c.businessName} to Keep Quality Consistent`,
    hookOrAngle: () => `Flat-lay photo of your tools, materials, or checklists: "Our non-negotiables."`,
    captionDraft: (c) =>
      `Customers don't just buy ${c.offeringPhrase}—they buy peace of mind.\n\nAt ${c.businessName}, we stick to vetted materials, clean workflows, and written checklists for every ${c.activity} engagement so results stay consistent even on busy weeks.`,
    callToAction: () => `Ask us about our quality standards—drop a comment or send a DM.`,
    miniTasks: () => [
      `Photograph the tools, packaging, or checklist you rely on daily`,
      `Write 2 sentences explaining why that standard protects the customer`,
      `Publish and add a link to your website or contact form in Stories`,
      `Check your email inbox and social DMs twice today so response time stays under 2 hours`,
    ],
  },
  {
    contentPillar: 'Mid-Month Direct Invitation',
    topicTitle: (c) => `2 Weeks In: Here Is How We Can Help You Hit Your Goals`,
    hookOrAngle: (c) => `Direct founder note graphic: "Looking for dependable help with ${c.activity}?"`,
    captionDraft: (c) =>
      `Quick mid-month check-in from ${c.businessName}: if ${c.activity} has been sitting on your to-do list, let's take it off your plate.\n\nWe currently have availability for new customers looking for ${c.offeringPhrase}${c.locationLabel ? ` in ${c.locationLabel}` : ''}. No pushy sales pitch—just a straightforward plan to get it done.`,
    callToAction: () => `Reply "INFO" or message us directly and we'll send our quick starter guide.`,
    miniTasks: () => [
      `Review Days 1–13 performance to see which topic got the most saves or replies`,
      `Post this direct invitation across your highest-performing channel`,
      `Send polite follow-up messages to every lead currently in "New" or "Contacted" stage`,
      `Schedule follow-up dates in Generated Leads for anyone who hasn't replied yet`,
    ],
  },
  {
    contentPillar: 'Case Walkthrough',
    topicTitle: (c) => `How a Typical Customer Uses ${c.businessName}`,
    hookOrAngle: () => `Story-style post: "What it looks like to go from frustrated to sorted."`,
    captionDraft: (c) =>
      `Most buyers find ${c.businessName} when they want ${c.activity} handled cleanly without chasing multiple vendors.\n\nFirst, we listen to what's slowing them down. Next, we put a realistic schedule on paper. Finally, we deliver ${c.offeringPhrase} with zero hidden surprises.\n\nSound like what you need right now?`,
    callToAction: () => `Send us 2 sentences about what you need and we'll tell you honestly how we can help.`,
    miniTasks: () => [
      `Outline one typical customer scenario accurately (no made-up metrics)`,
      `Publish the post and highlight the easiest way to contact you`,
      `Search 5 relevant local/industry hashtags and leave thoughtful comments`,
      `Log any new profile visitors who message or inquire`,
    ],
  },
  {
    contentPillar: 'Checklist / Saveable Resource',
    topicTitle: (c) => `Save-Worthy ${c.industry} Readiness Checklist`,
    hookOrAngle: () => `Clean 5-bullet checklist graphic designed to be bookmarked and shared.`,
    captionDraft: (c) =>
      `Bookmark this 5-point readiness checklist from ${c.businessName} before your next ${c.activity} decision:\n\n☑ Clear goal and timeline\n☑ Written scope of work\n☑ Verified vendor credentials\n☑ Transparent payment terms\n☑ Post-delivery support plan\n\nSave this post so you have it handy whenever you need it.`,
    callToAction: () => `Want us to handle all 5 steps for you? Send a DM to get started.`,
    miniTasks: (c) => [
      `Tailor the 5 checkboxes specifically to ${c.activity}`,
      `Post as a high-contrast saveable graphic`,
      `Share the graphic inside one relevant local or industry group (following group rules)`,
      `Thank anyone who shares your post and invite questions via DM`,
    ],
  },
  {
    contentPillar: 'Founder Perspective',
    topicTitle: (c) => `What We Learned Serving ${c.industry} Clients`,
    hookOrAngle: (c) => `Portrait of founder/team: "3 truths we stand by at ${c.businessName}."`,
    captionDraft: (c) =>
      `Three principles that guide every decision at ${c.businessName}:\n\n1. Show up when you say you will\n2. Explain options in plain language\n3. Stand behind the finished work\n\nSimple habits are rare—and they're the main reason customers stay with us.`,
    callToAction: () => `Looking for a partner you don't have to micromanage? Message us today.`,
    miniTasks: () => [
      `Pair a natural photo of yourself or your team with these 3 principles`,
      `Publish on LinkedIn and Instagram/Facebook`,
      `Connect with 5 potential partners or referral sources in your network`,
      `Review your Generated Leads pipeline and mark any approved follow-ups`,
    ],
  },
  {
    contentPillar: 'Product / Service Deep Dive',
    topicTitle: (c) => `Spotlight: Inside Our Core ${c.offeringPhrase} Offering`,
    hookOrAngle: () => `Close-up photo or screen capture showing exactly what the customer receives.`,
    captionDraft: (c) =>
      `A closer look at one of our most-requested offerings at ${c.businessName}: ${c.activity}.\n\nHere is what's included, who it's built for, and how quickly we can get you up and running. Whether you're starting fresh or upgrading what you already have, this solves the bottleneck fast.`,
    callToAction: () => `Comment "DETAILS" or message us to see if this fits your timeline.`,
    miniTasks: () => [
      `List 3 concrete deliverables included in your core offer`,
      `Add a clear photo showing what the buyer actually receives`,
      `Publish the spotlight and add the offer photo to Google Business Profile`,
      `DM warm leads who asked for pricing earlier this month`,
    ],
  },
  {
    contentPillar: 'Objection Buster',
    topicTitle: (c) => `"Can I Just Wait Until Later?" — When Timing Matters`,
    hookOrAngle: (c) => `Bold text hook: "Why putting off ${c.activity} usually costs more later."`,
    captionDraft: (c) =>
      `Totally fair question: "Do I really need to tackle ${c.activity} this month, or can it wait?"\n\nWaiting rarely makes things simpler or cheaper. Getting a straightforward baseline in place now with ${c.businessName} gives you breathing room and prevents rush fees down the road.`,
    callToAction: () => `Not ready to buy today? Message us anyway—we're happy to help you plan the right timing.`,
    miniTasks: () => [
      `Write the top hesitation buyers tell you when they delay`,
      `Respond empathetically with a low-pressure next step`,
      `Post to your feed and add a Story link or DM prompt`,
      `Check in politely with any "Proposal Sent" leads`,
    ],
  },
  {
    contentPillar: 'Community & Partnerships',
    topicTitle: (c) => `Who We Love Partnering With in ${c.industry}`,
    hookOrAngle: () => `Collaboration callout post: "Great businesses grow faster together."`,
    captionDraft: (c) =>
      `At ${c.businessName}, some of our favorite customer relationships start through referrals from complementary pros${c.locationLabel ? ` in ${c.locationLabel}` : ''}.\n\nIf you serve similar customers and want a reliable ${c.activity} partner you can trust with your clients, let's connect!`,
    callToAction: () => `Tag a fellow business owner or DM us "PARTNER" to grab a quick coffee/call.`,
    miniTasks: () => [
      `Make a list of 5 non-competing businesses who serve your same customer`,
      `Publish the partner callout and tag 1–2 businesses you already know`,
      `Send 3 genuine intro DMs to local/niche partners`,
      `Record any partner contacts in Generated Leads with channel "Referral"`,
    ],
  },
  {
    contentPillar: '3-Week Review & Social Proof',
    topicTitle: (c) => `Why Clarity Beats Complexity Every Time`,
    hookOrAngle: () => `Clean quote graphic: "You shouldn't need a manual just to hire help."`,
    captionDraft: (c) =>
      `A big reason people avoid starting ${c.activity} is feeling overwhelmed by conflicting advice.\n\nOur job at ${c.businessName} is to simplify the noise into clear, doable steps so you can focus on running your life and business while getting real results.`,
    callToAction: () => `Send us one question you've been stuck on and we'll give you a straight answer.`,
    miniTasks: () => [
      `Share a short post contrasting confusion vs. a clear plan`,
      `Reply to every active comment thread within an hour of posting`,
      `Review all active leads and clear overdue follow-up dates`,
      `Update your profile bio CTA to match this week's top offer`,
    ],
  },
  {
    contentPillar: 'How to Prepare',
    topicTitle: (c) => `3 Things to Have Ready Before Booking ${c.businessName}`,
    hookOrAngle: () => `Practical prep card: "How to get 2x faster turnaround from day one."`,
    captionDraft: (c) =>
      `Want the smoothest possible experience when booking ${c.businessName} for ${c.activity}? Have these three details handy:\n\n1. Your target completion date\n2. Any existing constraints or must-haves\n3. Your preferred way to stay updated\n\nThat's all we need to map out your next step.`,
    callToAction: () => `Have those 3 details ready? Message us now and we'll get your quote moving.`,
    miniTasks: () => [
      `Confirm your 3 intake questions match your actual onboarding workflow`,
      `Publish the prep guide and pin it to Stories Highlights`,
      `Engage with 5 recent followers or page likers by thanking them`,
      `Convert any ready lead into a scheduled call or invoice task`,
    ],
  },
  {
    contentPillar: 'Mini Case Breakdown',
    topicTitle: (c) => `Solving a Real ${c.industry} Bottleneck in Plain English`,
    hookOrAngle: () => `Problem-to-solution carousel or single-image breakdown.`,
    captionDraft: (c) =>
      `Here is a classic ${c.activity} bottleneck we see all the time—and how we solve it at ${c.businessName}:\n\nProblem: Unclear expectations and stalled follow-through.\nFix: Clear milestones, transparent check-ins, and quality ${c.offeringPhrase} built to last.\n\nSimple execution wins every time.`,
    callToAction: () => `Facing a similar bottleneck? DM us "SOLVE" and let's look at it together.`,
    miniTasks: () => [
      `Describe one real problem your service/product fixes cleanly`,
      `Include one clear photo or diagram showing the solution`,
      `Cross-post to your secondary channel with a tailored opening line`,
      `Send follow-up check-ins to 3 qualified leads in your pipeline`,
    ],
  },
  {
    contentPillar: 'Trust & Transparency',
    topicTitle: (c) => `What We Never Do at ${c.businessName}`,
    hookOrAngle: () => `Bold honesty hook: "3 shortcuts we refuse to take—even if they're faster."`,
    captionDraft: (c) =>
      `Customers deserve to know what a company stands for. At ${c.businessName}, here are three things we never do:\n\n✕ Surprise fees after work starts\n✕ Disappear when you ask for an update\n✕ Cut corners on ${c.activity} quality\n\nThat standard protects your budget and your peace of mind.`,
    callToAction: () => `Ready to work with a team that keeps its word? Message us to connect.`,
    miniTasks: () => [
      `Customize the 3 "Never Do" commitments to match your business values`,
      `Post as a clean bold-text card`,
      `Reply to comments and thank supporters`,
      `Review all "Won" leads and ensure their onboarding tasks are underway`,
    ],
  },
  {
    contentPillar: 'Comparison Guide',
    topicTitle: (c) => `DIY vs. Hiring ${c.businessName}: An Honest Breakdown`,
    hookOrAngle: () => `Fair comparison graphic: "When to do it yourself vs. when to bring us in."`,
    captionDraft: (c) =>
      `Should you handle ${c.activity} yourself or hire ${c.businessName}? Here is our honest take:\n\n• DIY makes sense when you have plenty of spare time and low risk.\n• Hiring ${c.businessName} makes sense when speed, consistency, and avoiding costly rework matter.\n\nWe'll always tell you which route makes more sense for you.`,
    callToAction: () => `Still weighing DIY vs. done-for-you? Send us a quick message and we'll shoot you straight.`,
    miniTasks: () => [
      `Be genuinely helpful—share when DIY works so trust skyrockets`,
      `Publish and ask followers which stage they're in`,
      `Send 3 helpful replies in local/niche threads where people ask DIY questions`,
      `Add new inquiries to Generated Leads and set next follow-up dates`,
    ],
  },
  {
    contentPillar: 'Quick Win Offer',
    topicTitle: (c) => `Start Small With ${c.businessName}`,
    hookOrAngle: () => `Low-friction offer card: "Not ready for the big package? Start here."`,
    captionDraft: (c) =>
      `You don't have to commit to a massive project on day one with ${c.businessName}.\n\nStart with an initial ${c.activity} review, starter order, or focused session so you can see our quality firsthand before scaling up.`,
    callToAction: () => `DM us "STARTER" to learn how our introductory option works.`,
    miniTasks: () => [
      `Define one clear low-risk entry offer you can fulfill easily this week`,
      `Post it with direct instructions on how to book or buy`,
      `Email or message existing warm leads inviting them to start small`,
      `Track every response inside Generated Leads`,
    ],
  },
  {
    contentPillar: 'Customer Experience',
    topicTitle: (c) => `What Support Looks Like After You Buy From ${c.businessName}`,
    hookOrAngle: () => `Photo of delivery, follow-up, or support check-in: "We don't vanish after checkout."`,
    captionDraft: (c) =>
      `Too many companies treat the sale like the finish line. At ${c.businessName}, post-purchase support for ${c.offeringPhrase} is built right into our process.\n\nWe check in, answer questions, and make sure you're actually getting the value you paid for.`,
    callToAction: (c) => `Want that level of care for your next ${c.activity} need? Send us a message today.`,
    miniTasks: (c) => [
      `Check in on 2 recent customers to confirm everything is going great`,
      `Publish the post highlighting your real follow-up commitment`,
      `Share a customer-helpful tip on Google Business Profile`,
      `Ask happy customers if they know anyone else who needs ${c.activity}`,
    ],
  },
  {
    contentPillar: 'Urgency & Capacity',
    topicTitle: (c) => `Limited Spots Left for This Month's Schedule`,
    hookOrAngle: () => `Clean notice graphic: "Final openings remaining for this month."`,
    captionDraft: (c) =>
      `Heads up! As we wrap up the month at ${c.businessName}, we only have a few openings left before our next schedule cycle begins.\n\nIf getting ${c.activity} squared away is on your goal list (${c.primaryGoal}), now is the best window to lock in your spot.`,
    callToAction: () => `Message us "SPOT" today and we'll reply with the exact openings left.`,
    miniTasks: () => [
      `Check your real remaining capacity so urgency is 100% honest`,
      `Publish across your main feed and Stories`,
      `Follow up once with every open lead in "Qualified" or "Proposal Sent"`,
      `Log closed deals as "Won" in Generated Leads and record revenue in Financial Ledger`,
    ],
  },
  {
    contentPillar: 'Referral Appreciation',
    topicTitle: (c) => `Thank You for Sharing ${c.businessName}`,
    hookOrAngle: () => `Warm thank-you graphic: "Word of mouth keeps small businesses thriving."`,
    captionDraft: (c) =>
      `A huge thank you to everyone who has liked, commented, saved a post, or sent a friend to ${c.businessName}${c.locationLabel ? ` in ${c.locationLabel}` : ''} this month!\n\nEvery referral and kind word directly supports our mission of delivering trustworthy ${c.offeringPhrase}.`,
    callToAction: (c) => `Know someone who needs ${c.activity}? Share this post or introduce us in a quick DM.`,
    miniTasks: () => [
      `Reply personally to anyone who has engaged with your posts this month`,
      `Publish the appreciation post`,
      `Tag or thank partners who referred business your way`,
      `Audit your Generated Leads pipeline and clear any stale notes`,
    ],
  },
  {
    contentPillar: '30-Day Recap & Next Month Kickoff',
    topicTitle: (c) => `Next Month Starts Now: Book Your ${c.activity} With ${c.businessName}`,
    hookOrAngle: () => `Strong summary visual: "30 days of showing up—ready for your turn?"`,
    captionDraft: (c) =>
      `That's a wrap on 30 days of sharing how ${c.businessName} approaches ${c.activity} in ${c.industry}!\n\nWhether you've been following quietly or waiting for the right moment to reach out, next month's calendar is officially open. Let's make progress on ${c.primaryGoal} together.`,
    callToAction: () => `DM us "READY" or book via our bio link to kick off next month strong.`,
    miniTasks: () => [
      `Review which 3 posts of the 30 days produced the most leads and saves`,
      `Publish the Day 30 wrap-up invitation`,
      `Review all leads in Generated Leads and schedule next month's follow-ups`,
      `Optionally click "Tailor 30 Days with Gemini AI" to refresh next month's calendar`,
    ],
  },
];

export function buildStarterSocialCalendarDays(
  assessment: BusinessAssessmentInput,
  startDate?: string,
  focusGoal?: string
): { strategyNote: string; days: GeneratedSocialDayDraft[] } {
  const baseDate =
    startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? startDate
      : formatIsoDate(new Date());

  const locationLabel = [assessment.city, assessment.stateProvince]
    .filter(Boolean)
    .join(', ');

  const offeringPhrase =
    assessment.offeringType === 'products'
      ? 'products'
      : assessment.offeringType === 'services'
      ? 'services'
      : 'products and services';

  const ctx: TemplateContext = {
    businessName: assessment.name || 'Your Business',
    industry: assessment.industry || 'your industry',
    activity: assessment.activity || 'your core work',
    locationLabel,
    offeringPhrase,
    primaryGoal:
      (focusGoal && focusGoal.trim()) ||
      assessment.goals?.[0] ||
      'consistent new customer inquiries',
  };

  const platforms = resolveChannels(assessment);

  const days: GeneratedSocialDayDraft[] = THIRTY_DAY_TEMPLATES.map((tpl, idx) => {
    const dayNumber = idx + 1;
    return {
      dayNumber,
      scheduledDate: addDaysIso(baseDate, idx),
      platform: platforms[idx % platforms.length],
      contentPillar: tpl.contentPillar,
      topicTitle: tpl.topicTitle(ctx).slice(0, 195),
      hookOrAngle: tpl.hookOrAngle(ctx).slice(0, 390),
      captionDraft: tpl.captionDraft(ctx).slice(0, 1950),
      callToAction: tpl.callToAction(ctx).slice(0, 290),
      miniTasks: tpl.miniTasks(ctx).map((t) => t.slice(0, 180)),
    };
  });

  return {
    strategyNote: `30-day ready-to-post customer acquisition calendar tailored to ${ctx.businessName} (${ctx.industry}). Customize any caption or click "Tailor 30 Days with Gemini AI" for fresh variations.`,
    days,
  };
}
