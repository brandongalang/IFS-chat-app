-- Creates a trigger that fires when a new user is created in the auth.users table.
-- This trigger creates a corresponding entry in the public.users table.

-- 1. Create the function to be called by the trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- 2. Create the trigger that calls the function.
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
