-- =====================================================================
-- 01_schema.sql  |  Jalankan di Supabase → SQL Editor (sekali saja)
-- Aplikasi Laporan MOS Mingguan
-- =====================================================================

-- ---------- MASTER: AREA ---------------------------------------------
create table if not exists public.areas (
  code        text primary key,          -- ZDJ / BBB / STH
  name        text not null,             -- AREA 1 (ZDJ)
  sort_order  int  not null default 0
);

-- ---------- MASTER: CABANG -------------------------------------------
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,      -- PLANT: SMP, SMD-1, ...
  name        text not null,             -- SAMPIT, SAMARINDA-1, ...
  area_code   text not null references public.areas(code),
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

-- ---------- MASTER: SALESMAN -----------------------------------------
create table if not exists public.salesmen (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  name        text not null,             -- termasuk baris semu: PROJECT, OTHERS, SHN, DEALER
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  unique (branch_id, name)
);

-- ---------- PROFIL USER ----------------------------------------------
-- role 'admin'  : head office, bisa input & ubah semua cabang
-- role 'branch' : hanya boleh input cabangnya sendiri, tapi bisa lihat semua
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'branch' check (role in ('admin','branch')),
  branch_id  uuid references public.branches(id),
  created_at timestamptz not null default now()
);

-- Profil dibuat otomatis begitu user baru ditambahkan lewat Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- DATA LAPORAN ---------------------------------------------
-- Satu baris = satu salesman, satu bulan. Kolom W1..W4 diisi bertahap
-- tiap minggu, persis seperti sheet bulanan di Excel.
create table if not exists public.mos_entries (
  id            uuid primary key default gen_random_uuid(),
  period_year   int  not null,
  period_month  int  not null check (period_month between 1 and 12),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  salesman_id   uuid not null references public.salesmen(id) on delete cascade,

  market_size_year             numeric(18,6) not null default 0,   -- D
  market_size_month            numeric(18,6) not null default 0,   -- E
  lq_tm_w1                     numeric(18,6) not null default 0,   -- F
  lq_tm_w2                     numeric(18,6) not null default 0,   -- G
  lq_tm_w3                     numeric(18,6) not null default 0,   -- H
  lq_tm_w4                     numeric(18,6) not null default 0,   -- I
  lq_lm                        numeric(18,6) not null default 0,   -- J
  ms_teams_schedule            text,   -- L
  kemampuan_po                 text,   -- M
  plan_sales_master            numeric(18,6) not null default 0,   -- N
  act_prtm_w1                  numeric(18,6) not null default 0,   -- O
  act_prtm_w2                  numeric(18,6) not null default 0,   -- P
  act_prtm_w3                  numeric(18,6) not null default 0,   -- Q
  act_prtm_w4                  numeric(18,6) not null default 0,   -- R
  qc_w1_gt80                   numeric(18,6) not null default 0,   -- S
  qc_w1_50_80                  numeric(18,6) not null default 0,   -- T
  qc_w1_lt50                   numeric(18,6) not null default 0,   -- U
  qc_w2_gt80                   numeric(18,6) not null default 0,   -- V
  qc_w2_50_80                  numeric(18,6) not null default 0,   -- W
  qc_w2_lt50                   numeric(18,6) not null default 0,   -- X
  qc_w3_gt80                   numeric(18,6) not null default 0,   -- Y
  qc_w3_50_80                  numeric(18,6) not null default 0,   -- Z
  qc_w3_lt50                   numeric(18,6) not null default 0,   -- AA
  qc_w4_gt80                   numeric(18,6) not null default 0,   -- AB
  qc_w4_50_80                  numeric(18,6) not null default 0,   -- AC
  qc_w4_lt50                   numeric(18,6) not null default 0,   -- AD
  po_non_sap                   numeric(18,6) not null default 0,   -- AE
  ol_min_prtm                  numeric(18,6) not null default 0,   -- AG
  po_last_month                numeric(18,6) not null default 0,   -- AI
  poco_not_active              numeric(18,6) not null default 0,   -- AL
  poco_plafond                 numeric(18,6) not null default 0,   -- AM
  poco_internal                numeric(18,6) not null default 0,   -- AN
  poco_external                numeric(18,6) not null default 0,   -- AO
  prtm_not_active              numeric(18,6) not null default 0,   -- AP
  prtm_plafond                 numeric(18,6) not null default 0,   -- AQ
  prtm_internal                numeric(18,6) not null default 0,   -- AR
  prtm_external                numeric(18,6) not null default 0,   -- AS
  qc_gt80_ready                numeric(18,6) not null default 0,   -- AU
  qc_50_80_ready               numeric(18,6) not null default 0,   -- AV
  po_non_sap_ready             numeric(18,6) not null default 0,   -- AW
  extra_efforts                numeric(18,6) not null default 0,   -- AX
  total_ol_rev_last_week       numeric(18,6) not null default 0,   -- AZ
  ol1                          numeric(18,6) not null default 0,   -- BC
  qc_gt80_dfo_proposed         numeric(18,6) not null default 0,   -- BF
  qc_gt80_dfo_approved         numeric(18,6) not null default 0,   -- BG
  qc_gt80_dfo_eta_tm           numeric(18,6) not null default 0,   -- BH
  po_non_sap_dfo_proposed      numeric(18,6) not null default 0,   -- BI
  po_non_sap_dfo_approved      numeric(18,6) not null default 0,   -- BJ
  po_non_sap_dfo_eta_tm        numeric(18,6) not null default 0,   -- BK
  actual_sales_amount          numeric(18,6) not null default 0,   -- BM
  bo_poco_main_prod            numeric(18,6) not null default 0,   -- BO
  bo_poco_ikd                  numeric(18,6) not null default 0,   -- BP
  bo_poco_bkt                  numeric(18,6) not null default 0,   -- BQ
  bo_prtm_main_prod            numeric(18,6) not null default 0,   -- BS
  bo_prtm_ikd                  numeric(18,6) not null default 0,   -- BT
  bo_prtm_bkt                  numeric(18,6) not null default 0,   -- BU

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (period_year, period_month, salesman_id)
);

create index if not exists mos_entries_period_idx
  on public.mos_entries (period_year, period_month);
create index if not exists mos_entries_branch_idx
  on public.mos_entries (branch_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end; $$;

drop trigger if exists mos_entries_touch on public.mos_entries;
create trigger mos_entries_touch
  before insert or update on public.mos_entries
  for each row execute function public.touch_updated_at();

-- ---------- LOG PERUBAHAN (opsional tapi berguna saat audit) ---------
create table if not exists public.mos_audit (
  id         bigserial primary key,
  entry_id   uuid,
  branch_id  uuid,
  action     text,
  actor      uuid,
  at         timestamptz not null default now(),
  payload    jsonb
);

create or replace function public.log_mos_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mos_audit (entry_id, branch_id, action, actor, payload)
  values (new.id, new.branch_id, tg_op, auth.uid(), to_jsonb(new));
  return new;
end; $$;

drop trigger if exists mos_entries_audit on public.mos_entries;
create trigger mos_entries_audit
  after insert or update on public.mos_entries
  for each row execute function public.log_mos_change();
