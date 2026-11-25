-- Busi Rx PostgreSQL Initial Schema Migration (for standalone Supabase PostgreSQL deployments)
-- Note: The live AI Studio runtime uses Firebase Auth + Cloud Firestore (see firestore.rules).

create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  plan_tier text not null default 'free' check (plan_tier in ('free', 'starter_rx', 'business_rx', 'growth_rx')),
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive', 'active', 'past_due', 'canceled', 'unconfigured')),
  stripe_customer_id text,
  stripe_subscription_id text,
  reminder_email_enabled boolean not null default true,
  reminder_in_app_enabled boolean not null default true,
  reminder_lead_days integer not null default 7 check (reminder_lead_days between 1 and 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  industry text not null,
  activity text not null,
  country text not null,
  state_province text not null default '',
  city text not null default '',
  jurisdictions text[] not null default '{}',
  stage text not null check (stage in ('new', 'existing')),
  legal_structure text not null check (legal_structure in ('sole_proprietorship', 'llc', 'corporation', 's_corp', 'partnership', 'nonprofit', 'undecided')),
  employee_count integer not null default 0 check (employee_count >= 0),
  operating_model text not null check (operating_model in ('physical', 'online', 'both')),
  existing_registrations text[] not null default '{}',
  banking_established boolean not null default false,
  bookkeeping_established boolean not null default false,
  offering_type text not null check (offering_type in ('products', 'services', 'both')),
  worker_types text not null check (worker_types in ('none', 'employees', 'contractors', 'both')),
  marketing_channels text[] not null default '{}',
  goals text[] not null default '{}',
  assessment_version integer not null default 1,
  onboarding_complete boolean not null default true,
  blueprint_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blueprint_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  category_number integer not null check (category_number between 1 and 10),
  category_name text not null,
  title text not null,
  description text not null,
  why_it_matters text not null,
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  cadence_type text not null check (cadence_type in ('one_time', 'recurring')),
  suggested_deadline_or_frequency text not null,
  recurrence_interval_days integer not null default 0,
  responsible_person text not null default 'Business Owner',
  applicable_jurisdiction text not null,
  official_source_url text not null default '',
  verification_status text not null check (verification_status in ('verified_requirement', 'recommendation', 'needs_confirmation')),
  completion_status text not null default 'pending_approval' check (completion_status in ('pending_approval', 'approved', 'in_progress', 'completed', 'dismissed')),
  requires_explicit_approval boolean not null default false,
  approved_by_owner boolean not null default false,
  assessment_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  blueprint_item_id uuid references public.blueprint_items(id) on delete set null,
  title text not null,
  description text not null default '',
  category_id text not null,
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  task_type text not null check (task_type in ('one_time', 'recurring')),
  recurrence_interval_days integer not null default 0,
  due_date date,
  next_due_date date,
  assignee text not null default 'Business Owner',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'awaiting_approval', 'completed')),
  requires_explicit_approval boolean not null default false,
  explicitly_approved boolean not null default false,
  consequential_action_type text not null default 'none' check (consequential_action_type in ('none', 'payment', 'legal_filing', 'external_communication')),
  dedupe_key text not null,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, dedupe_key)
);

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('bill', 'license', 'insurance', 'certification')),
  title text not null,
  issuer_or_vendor text not null default '',
  jurisdiction text not null default '',
  reference_number text not null default '',
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD',
  due_or_expiry_date date,
  recurrence_interval_days integer not null default 0,
  status text not null default 'active' check (status in ('active', 'due_soon', 'overdue', 'paid_or_renewed', 'needs_confirmation')),
  official_source_url text not null default '',
  requires_explicit_approval boolean not null default true,
  approved_for_action boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  doc_category text not null check (doc_category in ('formation', 'license', 'tax', 'insurance', 'contract', 'hr', 'financial', 'other')),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null,
  linked_obligation_id uuid references public.obligations(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null default '',
  role_title text not null default '',
  worker_classification text not null check (worker_classification in ('employee_w2', 'contractor_1099', 'owner')),
  certification_name text not null default '',
  certification_expiry date,
  status text not null default 'active' check (status in ('active', 'onboarding', 'offboarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('revenue', 'expense', 'tax_reserve')),
  category text not null,
  description text not null default '',
  amount_cents bigint not null check (amount_cents >= 0),
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null,
  channel text not null check (channel in ('in_app', 'email')),
  title text not null,
  message text not null,
  related_entity_type text not null check (related_entity_type in ('task', 'obligation', 'certification', 'blueprint', 'lead')),
  related_entity_id text not null,
  delivery_status text not null check (delivery_status in ('delivered', 'read', 'skipped_no_email_provider', 'failed')),
  scheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, dedupe_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  actor_email text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  campaign_name text not null,
  goal text not null default '',
  target_metric text not null default '',
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed')),
  requires_external_send_approval boolean not null default true,
  approved_by_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_calendar_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  scheduled_date date not null,
  platform text not null,
  content_pillar text not null,
  topic_title text not null,
  hook_or_angle text not null default '',
  caption_draft text not null default '',
  call_to_action text not null default '',
  mini_tasks text[] not null default '{}',
  completed_mini_tasks text[] not null default '{}',
  requires_external_publish_approval boolean not null default true,
  approved_to_publish boolean not null default false,
  day_status text not null default 'planned' check (day_status in ('planned', 'ready', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, day_number)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  company_or_handle text not null default '',
  email text not null default '',
  phone text not null default '',
  source_channel text not null,
  source_post_day integer not null default 0 check (source_post_day between 0 and 30),
  interest_summary text not null default '',
  estimated_value_cents bigint not null default 0 check (estimated_value_cents >= 0),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost')),
  next_follow_up_date date,
  last_contact_note text not null default '',
  requires_outreach_approval boolean not null default true,
  approved_for_outreach boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
