# Sales Branch Report Data Monitoring — Prototype V0.1

Vertical slice yang sudah jalan:

```
LOGIN → BRANCH DASHBOARD → UPLOAD EXCEL → VALIDATION → PREVIEW
      → SUBMIT → DATABASE → HO DASHBOARD → VIEW REPORT
```

Plus satu bonus yang sebenarnya masuk V0.2, tapi dipasang lebih awal karena tanpa itu
Change Monitoring cuma tabel kosong: **re-upload period yang sudah SUBMITTED wajib mengisi
Reason for Change**, dan setiap nilai yang berubah tercatat di `change_logs`.

---

## Menjalankan

```bash
npm install
npm run setup      # buat SQLite db + seed data
npm run dev        # http://localhost:3000
```

`npm run db:reset` mengembalikan database ke kondisi seed awal.

### Akun demo

| Email | Password | Role |
|---|---|---|
| `smp@company.com` | `password` | Branch — Sampit |
| `ho@company.com` | `password` | Head Office |
| `admin@company.com` | `password` | Admin |

Setiap cabang punya user sendiri dengan pola `{kodeplant}@company.com`
(`plb@company.com`, `mdn@company.com`, `smd1@company.com`, dst).

---

## Alur demo yang disarankan

1. Login `smp@company.com`. Week 35 statusnya **Not Submitted**.
2. **Upload weekly report** → **Download template**. File `SMP_W35_2026.xlsx` sudah
   terisi kode cabang, period, dan roster salesman Sampit.
3. Isi sheet DATA (baris pertama sudah ada contoh angka), lalu upload.
4. Layar preview menampilkan hasil validasi + roll-up cabang. Belum ada yang tersimpan.
5. **Submit report** → masuk database, redirect ke Report Detail.
6. Login `ho@company.com` → National dashboard, Sampit sudah berubah jadi Submitted.
7. Kembali sebagai Sampit, ubah satu angka di Excel, upload ulang Week 35.
   Sistem minta **Reason for Change**. Setelah submit, cek **Change monitoring**.

Untuk mencoba error handling: masukkan teks di kolom angka, angka negatif, atau
salesman duplikat. Ketiganya memblokir submit dan ditampilkan per baris.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 3 |
| Database | SQLite via Drizzle ORM |
| Excel | ExcelJS (baca + tulis template) |

### Kenapa SQLite, bukan PostgreSQL/Supabase

**ASSUMPTION.** Brief menyebut PostgreSQL/Supabase. Untuk prototype, SQLite dipilih supaya
`npm install && npm run setup` langsung jalan tanpa provisioning apa pun — tidak ada
connection string, tidak ada container.

Drizzle menjaga nama tabel dan kolom tetap sama lintas dialect, jadi pindah ke Supabase
berarti: ganti `drizzle-orm/sqlite-core` → `pg-core` di `src/db/schema.ts`, ganti driver di
`src/db/index.ts`, dan `real` → `numeric` untuk kolom uang. Query di halaman dan API route
tidak berubah.

> Catatan: Prisma dicoba lebih dulu tapi engine binary-nya tidak bisa diunduh di
> environment build saya, sehingga tidak bisa diverifikasi. Kalau tim Anda lebih nyaman
> dengan Prisma, migrasinya lurus — schema di `src/db/schema.ts` sudah 1:1 dengan struktur
> tabel yang Anda tulis di brief.

---

## Struktur folder

```
src/
├── app/
│   ├── login/                       Login + dummy auth
│   ├── (app)/                       Shell dengan sidebar (semua halaman ter-autentikasi)
│   │   ├── branch/                  Dashboard, upload, my reports
│   │   ├── reports/[id]/            Report detail + change history
│   │   └── ho/                      National dashboard, change monitoring
│   └── api/
│       ├── auth/login | logout
│       ├── template/                Generate template Excel per cabang+period
│       └── import/parse | commit    Dua langkah: validasi, lalu tulis
├── db/
│   ├── schema.ts                    7 tabel
│   ├── index.ts                     Koneksi Drizzle
│   └── seed.ts                      Seed data
├── lib/
│   ├── metrics.ts                   Katalog metrik (dipetakan dari header Excel asli)
│   ├── roster.ts                    13 cabang + salesman (diambil dari file nasional)
│   ├── reports.ts                   Roll-up & query bersama
│   ├── excel/template.ts            Generator template
│   ├── excel/parse.ts               Parser + rules validasi
│   ├── session.ts                   Dummy auth
│   └── format.ts                    Formatting Rupiah / persen / tanggal
└── components/                      Sidebar + UI primitives
```

---

## Yang dibaca dari Excel Anda

Temuan yang membentuk desain sistem ini:

**Sheet MOS nasional = konkatenasi vertikal sheet cabang.** `MOS AGUSTUS 2026` (94 baris)
punya layout kolom identik dengan `AGUSTUS 2026` di `Sampit.xlsx`, hanya 13 cabang ditumpuk.
Artinya national report bukan transformasi — di sistem baru cukup satu agregasi query.

**Grain data per salesman, bukan per cabang.** Baris `SMP | SAMPIT` adalah total; di bawahnya
baris per salesman. Struktur ini dipertahankan: kolom `salesman` nullable, `null` = level cabang.
Total cabang dihitung, tidak disimpan.

**File existing sudah rusak.** Baris TOTAL di sheet `AGUSTUS 2026` berisi `#REF!` di sekitar
40 kolom — persis masalah yang ingin dihilangkan.

**Master data diambil verbatim** dari sheet `MOS AGUSTUS 2026`: 13 cabang lengkap dengan
roster salesman. Seed memakai data ini, bukan data karangan.

### Metrik yang dimodelkan di V0.1

Subset representatif, bukan seluruh ~100 kolom:

`PLAN_SALES` · `LIVE_QUOTATION` · `ACTUAL_PRTM` · `PO` · `POCO` · `ACTUAL_SALES` ·
`OUTLOOK_REVENUE` · `BACK_ORDER`

Manual/action plan: `PROBLEM_IDENTIFICATION` · `CORRECTIVE_ACTION` · `PIC` · `DUE_DATE` ·
`STATUS` · `REMARKS`

Sengaja **belum** dimodelkan: bucket quotation confidence (>80% / 50-80% / <50%),
DFO proposed/approved/ETA, split produk POCO & PRTM (MAIN PROD / IKD / BKT), blok carry-over
dan outlook bulan berikutnya.

---

## Model penyimpanan

`weekly_report_details` memakai EAV (`metric_name` / `metric_value`), sesuai saran Anda untuk
tidak mengunci schema terlalu awal. Menambah metrik baru = menambah entry di
`src/lib/metrics.ts` — tidak perlu migration. Trade-off: query agregat butuh pivot, dan
constraint tipe ada di aplikasi, bukan di database. Untuk skala 13 cabang × 52 minggu ini
tidak masalah; kalau nanti dashboard mulai lambat, metrik yang sudah stabil bisa dipromosikan
jadi kolom sungguhan.

---

## Cara kerja import

Dua langkah, tidak pernah satu langkah:

1. `POST /api/import/parse` — baca file, validasi, simpan hasil ke `import_batches`
   berstatus `PENDING`. **Tidak menyentuh `weekly_reports`.**
2. `POST /api/import/commit` — user sudah konfirmasi preview, baru ditulis.

Template membawa sheet **META** berisi `BRANCH_CODE` / `YEAR` / `WEEK`. Server memvalidasi
ini terhadap pilihan user, jadi file cabang lain ditolak — bukan mengandalkan nama file.

### Rules validasi

| Rule | Severity |
|---|---|
| Kode cabang cocok dengan cabang yang dipilih | Error |
| Year + week cocok dengan period yang dipilih | Error |
| Semua kolom wajib ada | Error |
| Nilai numerik bisa di-parse | Error |
| Tidak ada nilai negatif | Error |
| Tidak ada salesman duplikat | Error |
| Salesman ada di roster cabang | Warning |
| PIC terisi pada item action plan | Warning |
| Status termasuk OPEN / ON PROGRESS / CLOSED | Warning |
| Plan Sales 0 padahal Actual Sales > 0 | Warning |

Error memblokir submit. Warning tidak.

### Audit trail

Saat re-upload period yang sudah `SUBMITTED`, commit route membandingkan setiap pasangan
`(salesman, metric)` dengan yang tersimpan. Hanya yang benar-benar berubah yang masuk
`change_logs` — sudah diuji: mengubah 2 angka dari 48 menghasilkan tepat 2 baris log, tanpa
false positive. Baris yang hilang dari file baru juga tercatat (`new_value` = null).

---

## Yang sudah diuji

Diverifikasi lewat HTTP terhadap production build:

- Login benar/salah; guard role (branch user → `/ho` dialihkan; anonim → `/login`)
- Download template, isi, upload, preview, submit, tampil di HO dashboard
- File rusak: teks di kolom angka, angka negatif, salesman duplikat, PIC kosong
  → 3 error + 2 warning, submit terblokir
- File cabang lain ditolak lewat pengecekan META
- Commit ganda pada batch yang sama → HTTP 409
- Re-submit tanpa reason / reason terlalu pendek → HTTP 400
- Re-submit dengan reason → 2 change log tercatat dengan old/new value
- Change monitoring sebagai branch user hanya menampilkan cabangnya sendiri
- Report detail: tabel per salesman, baris total, action plan, change history

---

## ASSUMPTION

Ditandai juga di dalam kode.

1. **Satuan Rp juta.** Cell C1 di sheet Excel berisi `1000000` sebagai pembagi, dan
   `PLAN SALES` = 3549. Semua nilai numerik disimpan dalam juta.
2. **Period = ISO week.** Excel memakai tab bulanan dengan kolom W1–W4 di dalamnya.
   Week 35 di sini jatuh di tab AGUSTUS. → **NEED CONFIRMATION**
3. **Region** tidak ada di file sumber; dikelompokkan per pulau agar filter HO ada isinya.
4. **Password plaintext**, cookie tidak ditandatangani. Prototype saja.
5. **Roster salesman di kode** (`src/lib/roster.ts`), belum master data yang dikelola Admin.
6. **Satu action plan per report.** → **NEED CONFIRMATION**
7. **Achievement = Actual Sales / Plan Sales**, dengan penjagaan pembagi nol.

## NEED CONFIRMATION

1. **Definisi period.** ISO week, atau week-of-month (W1–W4) mengikuti Excel?
2. **Plant code Bandar Lampung.** Sheet MOS menulis `BLG`, sheet LINK menulis `LPG`.
   Dipakai `BLG`.
3. **Beberapa action plan per minggu** per cabang?
4. **Siapa yang boleh historical edit.** Sekarang branch user bisa mengedit period mana pun
   asal memberi reason. Perlu approval HO? Perlu batas waktu (misal hanya 4 minggu terakhir)?
5. **Kolom PLAN.** Sekarang plan ikut di-upload tiap minggu. Biasanya plan ditetapkan sekali
   per bulan/kuartal oleh HO — mungkin lebih tepat jadi master data.
6. **Level agregasi HO.** Perlu region roll-up, atau cukup cabang → nasional?

---

## Belum dikerjakan (V0.2 dan seterusnya)

- Form input untuk action plan (sekarang lewat sheet ACTION PLAN di template)
- Historical edit lewat form, bukan hanya re-upload Excel
- Halaman Admin: manage user, branch, master data, reporting period
- Buka/tutup period otomatis
- Export national recap ke Excel
- Chart tren di dashboard
- Auth sungguhan + password hashing
