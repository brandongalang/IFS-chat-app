-- Migration 010: Onboarding Row Level Security Policies
-- Enables RLS and creates secure policies for onboarding tables

-- Enable RLS on all onboarding tables
alter table public.user_onboarding enable row level security;
alter table public.onboarding_questions enable row level security;
alter table public.onboarding_responses enable row level security;

-- user_onboarding policies: Users can only access their own onboarding data
create policy "user_onboarding_select_own" on public.user_onboarding
  for select using (auth.uid() = user_id);

create policy "user_onboarding_insert_own" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

create policy "user_onboarding_update_own" on public.user_onboarding
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_onboarding_delete_own" on public.user_onboarding
  for delete using (auth.uid() = user_id);

-- onboarding_questions policies: Read-only for authenticated users
-- Write operations only allowed via service role (no policies for insert/update/delete)
create policy "onboarding_questions_select_authenticated" on public.onboarding_questions
  for select to authenticated using (active = true);

-- onboarding_responses policies: Users can only access their own responses
create policy "onboarding_responses_select_own" on public.onboarding_responses
  for select using (auth.uid() = user_id);

create policy "onboarding_responses_insert_own" on public.onboarding_responses
  for insert with check (auth.uid() = user_id);

create policy "onboarding_responses_update_own" on public.onboarding_responses
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "onboarding_responses_delete_own" on public.onboarding_responses
  for delete using (auth.uid() = user_id);

-- Comments
comment on policy "user_onboarding_select_own" on public.user_onboarding is 'Users can only view their own onboarding progress';
comment on policy "onboarding_questions_select_authenticated" on public.onboarding_questions is 'Authenticated users can read active questions only';
comment on policy "onboarding_responses_select_own" on public.onboarding_responses is 'Users can only access their own responses for privacy';
