-- WasteWiseWeb — SQL only: tables, RLS, triggers, storage policies (run in Supabase SQL Editor).
-- Enable extensions if needed
-- create extension if not exists "uuid-ossp";

-- Profiles link auth users to app role
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin')),
  updated_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  name text not null,
  roll_number text not null,
  email text not null unique,
  face_registered boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
  date date not null,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'attended', 'no_show')),
  attended_at timestamptz,
  created_at timestamptz default now(),
  unique (student_id, meal_type, date)
);

create table if not exists public.guest_passes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guest_name text not null,
  relation text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
  date date not null,
  qr_code text not null unique,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  scanned_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  description text not null,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

create table if not exists public.waste_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
  waste_kg numeric(10,2) not null,
  logged_by uuid references auth.users,
  created_at timestamptz default now(),
  unique (date, meal_type)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_bookings_date on public.bookings(date);
create index if not exists idx_bookings_student on public.bookings(student_id);
create index if not exists idx_guest_passes_date on public.guest_passes(date);
create index if not exists idx_waste_log_date on public.waste_log(date);

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
-- If this errors on older Postgres, use: execute procedure public.handle_new_user();
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.bookings enable row level security;
alter table public.guest_passes enable row level security;
alter table public.complaints enable row level security;
alter table public.announcements enable row level security;
alter table public.waste_log enable row level security;
alter table public.leave_requests enable row level security;

-- Helper: is admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

-- Helper: current student id
create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());

-- Students
create policy "students_select" on public.students for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "students_insert" on public.students for insert
  with check (user_id = auth.uid());
create policy "students_update" on public.students for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Bookings
create policy "bookings_all_student" on public.bookings for all
  using (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  )
  with check (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  );

-- Guest passes
create policy "guest_passes_all" on public.guest_passes for all
  using (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  )
  with check (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  );

-- Complaints
create policy "complaints_select" on public.complaints for select
  using (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  );
create policy "complaints_insert" on public.complaints for insert
  with check (student_id = public.current_student_id());
create policy "complaints_update" on public.complaints for update
  using (public.is_admin(auth.uid()));

-- Announcements: students read, admins all
create policy "announcements_read" on public.announcements for select
  using (true);
create policy "announcements_write" on public.announcements for insert
  with check (public.is_admin(auth.uid()));

-- Waste log
create policy "waste_read" on public.waste_log for select using (true);
create policy "waste_write" on public.waste_log for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Leave
create policy "leave_all" on public.leave_requests for all
  using (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  )
  with check (
    student_id = public.current_student_id()
    or public.is_admin(auth.uid())
  );

-- Storage bucket (create in Dashboard > Storage, name: complaint-photos)
-- Policy example for authenticated upload:
-- insert policy: bucket_id = 'complaint-photos' and auth.role() = 'authenticated'

-- Promote a user to admin (SQL Editor): 
-- update public.profiles set role = 'admin' where id = '<auth_user_uuid>';

-- Public bucket for complaint photos (Storage)
insert into storage.buckets (id, name, public)
values ('complaint-photos', 'complaint-photos', true)
on conflict (id) do nothing;

create policy "Complaint photos public read"
on storage.objects for select
using (bucket_id = 'complaint-photos');

create policy "Complaint photos auth upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'complaint-photos');

create policy "Complaint photos auth update own"
on storage.objects for update
to authenticated
using (bucket_id = 'complaint-photos');
