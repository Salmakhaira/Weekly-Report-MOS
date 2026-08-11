-- =====================================================================
-- 02_rls.sql  |  Aturan akses. Jalankan setelah 01_schema.sql
--
-- Inti aturannya:
--   • Semua user yang sudah login boleh MELIHAT data seluruh cabang.
--   • MENULIS hanya boleh ke cabang sendiri. Admin boleh ke semua cabang.
-- Aturan ini dipaksakan di database, jadi tetap berlaku walau seseorang
-- mengakali tampilan di browser.
-- =====================================================================

-- Helper: dibaca dengan hak pemilik supaya kebijakan pada tabel profiles
-- tidak memanggil dirinya sendiri (infinite recursion).
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_branch()
returns uuid language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_write_branch(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' or branch_id = target
       from public.profiles where id = auth.uid()),
    false);
$$;

alter table public.areas       enable row level security;
alter table public.branches    enable row level security;
alter table public.salesmen    enable row level security;
alter table public.profiles    enable row level security;
alter table public.mos_entries enable row level security;
alter table public.mos_audit   enable row level security;

-- ---------- MASTER: semua user login boleh baca, hanya admin boleh ubah
drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas
  for select to authenticated using (true);

drop policy if exists areas_write on public.areas;
create policy areas_write on public.areas
  for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches
  for select to authenticated using (true);

drop policy if exists branches_write on public.branches;
create policy branches_write on public.branches
  for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

drop policy if exists salesmen_read on public.salesmen;
create policy salesmen_read on public.salesmen
  for select to authenticated using (true);

drop policy if exists salesmen_write on public.salesmen;
create policy salesmen_write on public.salesmen
  for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- ---------- PROFIL: lihat punya sendiri; admin lihat & atur semua ------
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- ---------- DATA LAPORAN ----------------------------------------------
-- Baca: seluruh cabang, supaya menu View Data bisa menampilkan nasional.
drop policy if exists mos_read_all on public.mos_entries;
create policy mos_read_all on public.mos_entries
  for select to authenticated using (true);

-- Tulis: dibatasi ke cabang milik user.
drop policy if exists mos_insert_own on public.mos_entries;
create policy mos_insert_own on public.mos_entries
  for insert to authenticated
  with check (public.can_write_branch(branch_id));

drop policy if exists mos_update_own on public.mos_entries;
create policy mos_update_own on public.mos_entries
  for update to authenticated
  using (public.can_write_branch(branch_id))
  with check (public.can_write_branch(branch_id));

drop policy if exists mos_delete_own on public.mos_entries;
create policy mos_delete_own on public.mos_entries
  for delete to authenticated
  using (public.can_write_branch(branch_id));

-- Pengaman tambahan: salesman yang dipilih harus benar milik cabang itu.
create or replace function public.assert_salesman_in_branch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.salesmen
                 where id = new.salesman_id and branch_id = new.branch_id) then
    raise exception 'Salesman tidak terdaftar di cabang tersebut.';
  end if;
  return new;
end; $$;

drop trigger if exists mos_entries_check_salesman on public.mos_entries;
create trigger mos_entries_check_salesman
  before insert or update on public.mos_entries
  for each row execute function public.assert_salesman_in_branch();

-- ---------- AUDIT: hanya admin yang boleh membaca ---------------------
drop policy if exists audit_admin_read on public.mos_audit;
create policy audit_admin_read on public.mos_audit
  for select to authenticated using (public.my_role() = 'admin');
