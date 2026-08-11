-- =====================================================================
-- 03_seed_master.sql  |  Isi master area, cabang, dan salesman.
-- Datanya diambil persis dari WEEKLY REPORT MOS NASIONAL 2026.
-- Aman dijalankan ulang (pakai on conflict do nothing).
-- =====================================================================

insert into public.areas (code, name, sort_order) values
  ('ZDJ', 'AREA 1 (ZDJ)', 1),
  ('BBB', 'AREA 2 (BBB)', 2),
  ('STH', 'AREA 3 (STH)', 3)
on conflict (code) do nothing;

insert into public.branches (code, name, area_code, sort_order) values
  ('SMD-1', 'SAMARINDA-1',     'ZDJ',  1),
  ('SMD-2', 'SAMARINDA-2',     'ZDJ',  2),
  ('PLB',   'PALEMBANG',       'ZDJ',  3),
  ('BLG',   'BANDAR LAMPUNG',  'ZDJ',  4),
  ('SMP',   'SAMPIT',          'ZDJ',  5),
  ('MDN',   'MEDAN',           'ZDJ',  6),
  ('JMB',   'JAMBI',           'BBB',  7),
  ('PDG',   'PADANG',          'BBB',  8),
  ('MKS',   'MAKASSAR',        'STH',  9),
  ('PKB',   'PEKANBARU',       'STH', 10),
  ('PTK',   'PONTIANAK',       'STH', 11),
  ('JYP',   'JAYAPURA',        'STH', 12),
  ('BJM',   'BANJARMASIN',     'STH', 13)
on conflict (code) do nothing;

-- Baris seperti PROJECT, OTHERS, SHN, DEALER ikut didaftarkan karena di
-- Excel pun mereka menempati baris tersendiri di bawah cabangnya.
with s(branch_code, nama, urut) as (values
  ('SMD-1', 'ADITIA KURNIAWAN', 1), ('SMD-1', 'GERINDRA YONKY', 2),
  ('SMD-1', 'HENDRA SIHOMBING', 3), ('SMD-1', 'SHN', 4), ('SMD-1', 'OTHERS', 5),

  ('SMD-2', 'AGUSTIN PANGGABEAN', 1), ('SMD-2', 'PICASO MARKUS AGAVENTA BANGUN', 2),
  ('SMD-2', 'OTHERS', 3),

  ('PLB', 'M. IQBAL ANDY KURNIAWAN', 1), ('PLB', 'M. IKBAL FERDIANSYAH', 2),
  ('PLB', 'SUDARSO', 3), ('PLB', 'SHN', 4), ('PLB', 'OTHERS', 5),

  ('BLG', 'M. INDRA ARYANSAYAH', 1), ('BLG', 'M. BALDIANSYA DEWANA', 2),

  ('SMP', 'ANDREW NOFENESIA', 1), ('SMP', 'HADI ISNANDAR', 2),
  ('SMP', 'HENDRA SAPUTRA', 3), ('SMP', 'HADI PRAYITNO', 4),
  ('SMP', 'PROJECT', 5), ('SMP', 'OTHERS', 6),

  ('MDN', 'YOSRA HADI PUTRA', 1), ('MDN', 'M. YUSUF SIPAHUTAR', 2),
  ('MDN', 'DEALER', 3), ('MDN', 'SHN', 4), ('MDN', 'OTHERS', 5),

  ('JMB', 'ALIF ALVIANTO', 1), ('JMB', 'SHN', 2),

  ('PDG', 'MUHAMMAD FAQIH ASSHIDIEQ', 1), ('PDG', 'OTHERS', 2),

  ('MKS', 'M. FADLY SINGKANG', 1), ('MKS', 'WAHYUDDIN ABDULLAH', 2),
  ('MKS', 'ZYAINI BHARKAH', 3),

  ('PKB', 'HADY SUDHARSONO', 1), ('PKB', 'IRFAN TRIYANTO', 2),
  ('PKB', 'SETIA WANDI', 3), ('PKB', 'PROJECT BTM', 4), ('PKB', 'OTHERS', 5),

  ('PTK', 'ALPRIMA RAMDHANA', 1), ('PTK', 'PUNGKAS PIJAR RAHMANTO', 2),
  ('PTK', 'SETYONO M.T HIDAYAHTULLAH', 3), ('PTK', 'M. RAFLY BAGOES IRAWAN', 4),
  ('PTK', 'OTHERS', 5),

  ('JYP', 'HARUN HARYANTO LATUMAHINA', 1), ('JYP', 'INDRA THAMRIN', 2),
  ('JYP', 'OTHERS', 3),

  ('BJM', 'INDRA WINARTA SANDHI', 1), ('BJM', 'PAMRIH SANTOSO', 2),
  ('BJM', 'PRIYA LAKSONO', 3), ('BJM', 'RONNY FERDIAN', 4)
)
insert into public.salesmen (branch_id, name, sort_order)
select b.id, s.nama, s.urut
from s join public.branches b on b.code = s.branch_code
on conflict (branch_id, name) do nothing;


-- =====================================================================
-- MENGHUBUNGKAN USER KE CABANG
-- ---------------------------------------------------------------------
-- Buat dulu usernya di Supabase → Authentication → Users → Add user
-- (email + password, centang "Auto Confirm User"). Profil akan terbentuk
-- otomatis dengan role 'branch'. Setelah itu jalankan baris di bawah
-- untuk menentukan cabang dan rolenya.
--
-- Contoh — admin head office:
--   update public.profiles
--      set role = 'admin', full_name = 'Admin Head Office', branch_id = null
--    where email = 'admin@perusahaan.co.id';
--
-- Contoh — user cabang Sampit:
--   update public.profiles
--      set role = 'branch', full_name = 'Admin Sampit',
--          branch_id = (select id from public.branches where code = 'SMP')
--    where email = 'sampit@perusahaan.co.id';
-- =====================================================================
