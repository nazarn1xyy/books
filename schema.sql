-- Create a table for public profiles using Supabase Auth
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  nickname text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for user books
create table user_books (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  title text not null,
  author text,
  cover text,
  description text,
  status text check (status in ('reading', 'plan', 'finished', 'dropped')) default 'reading',
  format text default 'fb2',
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, book_id)
);

-- Enable RLS for user_books
alter table user_books enable row level security;

-- Policies for user_books
create policy "Users can view their own books." on user_books
  for select using (auth.uid() = user_id);

create policy "Users can insert their own books." on user_books
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own books." on user_books
  for update using (auth.uid() = user_id);

create policy "Users can delete their own books." on user_books
  for delete using (auth.uid() = user_id);


-- Create a table for reading progress
create table reading_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  book_id text not null,
  current_page integer default 0,
  total_pages integer default 0,
  last_read bigint default 0, -- Timestamp
  scroll_percentage numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, book_id)
);

-- Enable RLS for reading_progress
alter table reading_progress enable row level security;

-- Policies for reading_progress
create policy "Users can view their own progress." on reading_progress
  for select using (auth.uid() = user_id);

create policy "Users can insert their own progress." on reading_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own progress." on reading_progress
  for update using (auth.uid() = user_id);

-- Quotes Table
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id text not null,
  book_title text,
  book_author text,
  text text not null,
  note text,
  color text default 'yellow',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Favorites Table
create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id text not null,
  book_title text,
  book_author text,
  book_cover text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, book_id)
);

-- Enable RLS for quotes and favorites
alter table public.quotes enable row level security;
alter table public.favorites enable row level security;

-- Policies for quotes
create policy "Users can crud their own quotes" on public.quotes
  for all using (auth.uid() = user_id);

-- Policies for favorites
create policy "Users can crud their own favorites" on public.favorites
  for all using (auth.uid() = user_id);


-- Function to handle new user signup (auto-create profile)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nickname)
  values (new.id, new.email, new.raw_user_meta_data->>'nickname');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
