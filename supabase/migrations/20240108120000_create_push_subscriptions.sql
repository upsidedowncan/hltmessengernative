-- Create table for push subscriptions
create table if not exists push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    subscription jsonb not null,
    created_at timestamptz default now()
);

-- Enable RLS
alter table push_subscriptions enable row level security;

-- Policies
create policy "Users can insert their own subscriptions"
    on push_subscriptions for insert
    with check (auth.uid() = user_id);

create policy "Users can view their own subscriptions"
    on push_subscriptions for select
    using (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
    on push_subscriptions for delete
    using (auth.uid() = user_id);

-- Optional: Index for performance
create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);