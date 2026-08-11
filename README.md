# Weekly Report MOS — aplikasi input & rekap laporan cabang

Menggantikan alur "tiap cabang isi Excel → kirim ke admin → admin rekap manual"
dengan satu tempat input bersama. Rekap nasional tersusun sendiri begitu cabang menyimpan.

---

## Kenapa HTML + CSS + JavaScript biasa, bukan React

Untuk kebutuhan ini, HTML/CSS/JS polos lebih menguntungkan:

- **Tanpa proses build.** Push ke GitHub, Vercel langsung menayangkan. Tidak ada `npm install`, tidak ada versi Node yang bisa bentrok.
- **Mudah dirawat orang lain.** Siapa pun yang bisa baca HTML bisa mengubah label atau menambah kolom, tanpa harus paham React.
- **Cepat.** Tidak ada bundle framework yang harus diunduh browser; tabel lebar dengan ratusan sel tetap ringan.

Supabase menyediakan database, login, dan aturan hak akses sekaligus,
jadi tidak perlu menulis server sendiri. Anda tetap "tidak menulis SQL" dalam
pemakaian sehari-hari — SQL hanya dijalankan sekali saat menyiapkan tabel.

---

## Isi folder

```
index.html            Halaman login
home.html             Beranda: menu Input Data & View Data
input.html            Form isian per cabang
view.html             Tabel rekap nasional (kolom A–BX)
assets/
  config.js           ← satu-satunya file yang wajib Anda ubah
  schema.js           Definisi seluruh kolom + rumus Excel
  app.js              Koneksi Supabase, penjaga sesi, header
  input.js            Logika form input
  view.js             Logika tabel rekap + ekspor Excel
  style.css           Tampilan
supabase/
  01_schema.sql       Struktur tabel
  02_rls.sql          Aturan hak akses per cabang
  03_seed_master.sql  Daftar area, cabang, salesman
vercel.json
```

---

## Langkah pemasangan

### 1. Siapkan Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan berurutan:
   `01_schema.sql` → `02_rls.sql` → `03_seed_master.sql`.
3. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.

### 2. Buat akun pengguna

Untuk tiap cabang dan untuk admin:

1. **Authentication → Users → Add user**, isi email + password, centang *Auto Confirm User*.
2. Kembali ke **SQL Editor**, tentukan peran dan cabangnya:

```sql
-- admin head office (boleh input semua cabang)
update public.profiles
   set role = 'admin', full_name = 'Admin Head Office', branch_id = null
 where email = 'admin@perusahaan.co.id';

-- user cabang Sampit
update public.profiles
   set role = 'branch', full_name = 'Admin Sampit',
       branch_id = (select id from public.branches where code = 'SMP')
 where email = 'sampit@perusahaan.co.id';
```

### 3. Isi config.js

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

Anon key aman ditaruh di file publik — yang menjaga data adalah aturan RLS di
database, bukan kunci ini. Jangan pernah memasukkan *service_role key* ke sini.

### 4. Push ke GitHub

```bash
git init
git add .
git commit -m "Aplikasi laporan MOS"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

### 5. Tayangkan di Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → pilih repo tadi.
2. Framework Preset: **Other**. Build command dan output directory dikosongkan.
3. **Deploy**.

### 6. Izinkan domainnya di Supabase

Supabase → **Authentication → URL Configuration** → tambahkan URL Vercel Anda
(`https://nama-app.vercel.app`) ke **Site URL** dan **Redirect URLs**.

Setiap `git push` berikutnya otomatis memperbarui situs.

---

## Cara kerja hak akses

| Peran | Input Data | View Data |
|---|---|---|
| `branch` | Hanya cabangnya sendiri | Seluruh cabang |
| `admin` | Semua cabang | Seluruh cabang |

Pembatasannya dipasang di database (`02_rls.sql`), bukan di tampilan. Jadi
seandainya ada yang mengutak-atik halaman lewat browser, database tetap menolak
tulisan ke cabang lain. Ada juga pemeriksaan tambahan: salesman yang dipilih
harus benar terdaftar di cabang yang bersangkutan.

---

## Cara pemakaian sehari-hari

**Orang cabang, tiap minggu:**
Login → Input Data → pilih bulan dan minggu berjalan → isi angka per salesman →
Simpan perubahan. Satu baris per salesman, persis blok cabang di Excel. Kolom
`TOTAL`, `TOTAL OL PRTM`, `BALANCE PRTM`, `TOTAL PO`, dan `TOTAL PO OUTLOOK`
terisi sendiri sambil Anda mengetik.

Kalau data sudah terlanjur ada di Excel, blok selnya bisa disalin lalu
ditempel langsung ke tabel input (Ctrl+V di sel awal).

**Admin head office:**
Login → View Data → pilih periode dan minggu. Tabel sudah lengkap dengan baris
cabang, subtotal per area, TOTAL, dan GRAND TOTAL. Tombol **Unduh Excel**
menghasilkan file `.xlsx` dengan susunan kolom yang sama.

---

## Tentang tombol minggu (W1–W4)

Di Excel, rumus kolom berjalan diganti manual tiap minggu — misalnya
`TOTAL OL PRTM` memakai `ACT PRTM W1` di minggu pertama, lalu diubah ke W2, dan
seterusnya. Di aplikasi ini, pemilih **W1 W2 W3 W4** yang melakukannya. Rumus
yang mengikuti minggu terpilih:

| Kolom | Rumus |
|---|---|
| K — TOTAL | `TM W{n} + LM` |
| AF — TOTAL OL PRTM | `ACT PRTM W{n} + QUOT CONF W{n} >80% + PO NON SAP` |
| AH — BALANCE PRTM | `AF − OL MIN PRTM` |
| AJ — TOTAL PO | `ACT PRTM W{n} + PO LAST MONTH` |
| AK — TOTAL PO OUTLOOK | `AF + PO LAST MONTH` |

Angka minggu-minggu lain tetap tersimpan, hanya tidak dipakai rumus saat itu.
Data disimpan satu baris per salesman per bulan, sama seperti satu sheet bulanan
di Excel yang diisi bertambah tiap minggu.

---

## Kolom AL sampai BX

Sesuai permintaan, **form input dibatasi sampai kolom AK**, sedangkan **tabel
View Data menampilkan sampai kolom BX**. Kolom AL–BX (Outlook Revenue TM, DFO,
Actual Sales, Back Order) sudah disiapkan di database dan sudah muncul di tabel,
tapi belum ada isiannya — jadi untuk sementara nilainya nol.

Kalau nanti mau dibuka: di `assets/schema.js`, ganti `stage2: true` menjadi
`input: true` pada kolom yang diinginkan. Form akan langsung menampilkannya,
tanpa perlu mengubah database atau file lain.

---

## Menambah cabang atau salesman

Lewat SQL Editor:

```sql
-- salesman baru di Sampit
insert into public.salesmen (branch_id, name, sort_order)
values ((select id from public.branches where code = 'SMP'), 'NAMA BARU', 7);

-- menonaktifkan salesman yang pindah (data lamanya tetap tersimpan)
update public.salesmen set is_active = false where name = 'NAMA LAMA';
```

---

## Kalau ada masalah

| Gejala | Penyebab yang biasa |
|---|---|
| Login berhasil tapi muncul "belum punya profil" | Baris di `public.profiles` belum dihubungkan ke cabang. Jalankan `update` di langkah 2. |
| Tabel kosong padahal cabang sudah mengisi | Periode atau tahun yang dipilih berbeda. |
| "Anda tidak punya izin menulis" | User bercabang `SMP` mencoba menyimpan data cabang lain. Ini memang perilaku yang diharapkan. |
| Halaman putih | `config.js` masih berisi nilai contoh, atau URL Vercel belum didaftarkan di Authentication → URL Configuration. |
