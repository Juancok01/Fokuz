create table if not exists public.saved_verses (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    text text not null,
    reference text not null,
    translation text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, reference)
);

alter table public.saved_verses enable row level security;

create policy "Users can view their own saved verses"
    on public.saved_verses for select
    using (auth.uid() = user_id);

create policy "Users can insert their own saved verses"
    on public.saved_verses for insert
    with check (auth.uid() = user_id);

create policy "Users can delete their own saved verses"
    on public.saved_verses for delete
    using (auth.uid() = user_id);
