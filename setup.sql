-- Промосеть: подготовка базы в Supabase.
-- Откройте SQL Editor в своём проекте Supabase, вставьте этот текст целиком и нажмите Run. Один раз.

-- 1. Таблица для всех данных приложения (проекты, точки, сотрудники, смены, фото)
create table if not exists public.docs (
  col text not null check (col in ('projects','points','promoters','shifts','photos')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
alter table public.docs replica identity full;
alter table public.docs enable row level security;

-- 2. Доступ только для вошедших сотрудников
drop policy if exists "docs read" on public.docs;
drop policy if exists "docs insert" on public.docs;
drop policy if exists "docs update" on public.docs;
drop policy if exists "docs delete" on public.docs;
create policy "docs read"   on public.docs for select to authenticated using (true);
create policy "docs insert" on public.docs for insert to authenticated with check (true);
create policy "docs update" on public.docs for update to authenticated using (true) with check (true);
create policy "docs delete" on public.docs for delete to authenticated using (true);

-- 3. Частичное обновление записи (например, отметить срыв или внести итог смены)
create or replace function public.merge_doc(p_col text, p_id text, p_patch jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.docs set data = data || p_patch, updated_at = now() where col = p_col and id = p_id;
  if not found then raise exception 'Запись не найдена' using errcode = 'P0002'; end if;
end $$;
grant execute on function public.merge_doc(text, text, jsonb) to authenticated;

-- 4. Живые обновления: изменения сразу видны у всех открытых вкладок
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5. Хранилище фотоотчётов
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 20971520, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
drop policy if exists "photos upload" on storage.objects;
drop policy if exists "photos read" on storage.objects;
create policy "photos upload" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "photos read"   on storage.objects for select using (bucket_id = 'photos');
