-- Migration 009: User Onboarding Schema
-- Creates the core infrastructure for the user onboarding experience
-- Including stages, question bank, responses, and scoring mechanisms

-- Types for onboarding
create type onboarding_stage as enum ('stage1', 'stage2', 'stage3', 'complete');
create type onboarding_question_type as enum ('likert5', 'single_choice', 'multi_select', 'free_text');

-- Core state per user
create table public.user_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_version text not null default 'v1',
  stage onboarding_stage not null default 'stage1',
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 0,
  
  -- derived fields computed from responses
  stage1_scores jsonb not null default '{}'::jsonb, -- theme->score map
  stage2_selected_questions text[] not null default '{}',
  answers_snapshot jsonb not null default '{}'::jsonb -- latest answers per question
);

-- Indexes for user_onboarding
create unique index user_onboarding_user_uidx on public.user_onboarding(user_id);
create index user_onboarding_status_idx on public.user_onboarding(status, updated_at);
create index user_onboarding_stage_idx on public.user_onboarding(stage);

-- Question bank
create table public.onboarding_questions (
  id text primary key, -- e.g., 'S1_Q1', 'S2_Q7', 'S3_Q2'
  stage int not null check (stage in (1,2,3)),
  type onboarding_question_type not null,
  prompt text not null,
  helper text,
  options jsonb not null default '[]'::jsonb, -- [{value,label}] for choices
  active boolean not null default true,
  locale text not null default 'en',
  order_hint int not null default 0,
  
  -- For stage2 selection algorithm (theme->weight mapping)
  theme_weights jsonb not null default '{}'::jsonb,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for onboarding_questions
create index onboarding_questions_stage_idx on public.onboarding_questions(stage, active);
create index onboarding_questions_active_idx on public.onboarding_questions(active);
create index onboarding_questions_theme_gin on public.onboarding_questions using gin (theme_weights);

-- Individual responses (for analytics, resumability, and audit)
create table public.onboarding_responses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.onboarding_questions(id) on delete cascade,
  stage int not null check (stage in (1,2,3)),
  response jsonb not null, -- typed per question type
  created_at timestamptz not null default now()
);

-- Indexes for onboarding_responses
create unique index onboarding_responses_user_q_unique on public.onboarding_responses(user_id, question_id);
create index onboarding_responses_user_idx on public.onboarding_responses(user_id);
create index onboarding_responses_stage_idx on public.onboarding_responses(stage);
create index onboarding_responses_resp_gin on public.onboarding_responses using gin (response);

-- Standard updated_at trigger function (reuse if exists)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Triggers for updated_at
create trigger trg_user_onboarding_updated_at
  before update on public.user_onboarding
  for each row execute function public.set_updated_at();

create trigger trg_onboarding_questions_updated_at
  before update on public.onboarding_questions
  for each row execute function public.set_updated_at();

-- Optimistic concurrency control for user_onboarding
create or replace function public.bump_onboarding_version()
returns trigger language plpgsql as $$
begin
  new.version = old.version + 1;
  new.last_saved_at = now();
  return new;
end $$;

create trigger trg_user_onboarding_version
  before update on public.user_onboarding
  for each row execute function public.bump_onboarding_version();

-- Comments for documentation
comment on table public.user_onboarding is 'Tracks user progress through onboarding stages with autosave and resumability';
comment on table public.onboarding_questions is 'Question bank for all onboarding stages with theme weighting for adaptive selection';
comment on table public.onboarding_responses is 'Individual user responses for analytics and state reconstruction';
comment on column public.user_onboarding.stage1_scores is 'Computed theme scores from Stage 1 responses for Stage 2 selection';
comment on column public.user_onboarding.stage2_selected_questions is 'Locked set of Stage 2 question IDs for consistency';
comment on column public.user_onboarding.answers_snapshot is 'Latest answers by question_id for UI state restoration';
comment on column public.onboarding_questions.theme_weights is 'Theme weights for Stage 2 question selection algorithm';
