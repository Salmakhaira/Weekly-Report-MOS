/* =====================================================================
   config.js — isi dua nilai di bawah ini.

   Ambil dari Supabase → Project Settings → Data API / API Keys:
     SUPABASE_URL       = Project URL     (https://xxxx.supabase.co)
     SUPABASE_ANON_KEY  = anon public key

   Anon key memang aman diletakkan di file publik. Yang menjaga data
   tetap aman adalah Row Level Security di 02_rls.sql, bukan kuncinya.
   JANGAN pernah menaruh service_role key di sini.
   ===================================================================== */

export const SUPABASE_URL = 'https://GANTI-DENGAN-PROJECT-ANDA.supabase.co';
export const SUPABASE_ANON_KEY = 'GANTI-DENGAN-ANON-PUBLIC-KEY';

/* Judul yang tampil di header. Ubah sesuai nama perusahaan. */
export const APP_NAME = 'Weekly Report MOS';
export const APP_SUB  = 'Nasional';
