-- Busi Rx Row-Level Security (RLS) Policies for Supabase PostgreSQL

alter table public.user_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.blueprint_items enable row level security;
alter table public.tasks enable row level security;
alter table public.obligations enable row level security;
alter table public.documents enable row level security;
alter table public.team_members enable row level security;
alter table public.financial_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.social_calendar_days enable row level security;

-- Helper function verifying caller owns parent business
create or replace function public.owns_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.owner_id = auth.uid()
  );
$$;

-- User Profiles
create policy "user_profiles_owner_all"
on public.user_profiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Businesses
create policy "businesses_owner_all"
on public.businesses
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- Blueprint Items
create policy "blueprint_items_owner_all"
on public.blueprint_items
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- Tasks (with consequential approval enforcement)
create policy "tasks_owner_select"
on public.tasks
for select
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id));

create policy "tasks_owner_insert"
on public.tasks
for insert
to authenticated
with check (auth.uid() = owner_id and public.owns_business(business_id));

create policy "tasks_owner_update"
on public.tasks
for update
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (
  auth.uid() = owner_id
  and public.owns_business(business_id)
  and (not (requires_explicit_approval and status = 'completed') or explicitly_approved = true)
);

create policy "tasks_owner_delete"
on public.tasks
for delete
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id));

-- Obligations
create policy "obligations_owner_all"
on public.obligations
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- Documents
create policy "documents_owner_all"
on public.documents
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- Team Members
create policy "team_members_owner_all"
on public.team_members
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- Financial Entries
create policy "financial_entries_owner_all"
on public.financial_entries
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- Notifications
create policy "notifications_owner_all"
on public.notifications
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- Audit Logs (append-only: no update allowed)
create policy "audit_logs_owner_select"
on public.audit_logs
for select
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id));

create policy "audit_logs_owner_insert"
on public.audit_logs
for insert
to authenticated
with check (auth.uid() = owner_id and public.owns_business(business_id));

create policy "audit_logs_owner_delete"
on public.audit_logs
for delete
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id));

-- Marketing Campaigns
create policy "marketing_campaigns_owner_all"
on public.marketing_campaigns
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (auth.uid() = owner_id and public.owns_business(business_id));

-- 30-Day Social Media Content Calendar
create policy "social_calendar_days_owner_all"
on public.social_calendar_days
for all
to authenticated
using (auth.uid() = owner_id and public.owns_business(business_id))
with check (
  auth.uid() = owner_id
  and public.owns_business(business_id)
  and (not (requires_external_publish_approval and day_status = 'published') or approved_to_publish = true)
);
