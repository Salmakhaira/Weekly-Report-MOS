/**
 * Branch + salesman master data.
 *
 * Extracted verbatim from `WEEKLY REPORT MOS NASIONAL - 2026.xlsx`, sheet
 * "MOS AGUSTUS 2026" (rows 7-94) and sheet "LINK".
 *
 * ASSUMPTION: `region` is not present anywhere in the source files. Grouped by
 * island here so the HO dashboard has something to filter on. Correct as needed.
 *
 * NEED CONFIRMATION: Bandar Lampung appears as plant "BLG" on the MOS sheet but
 * "LPG" on the LINK sheet. "BLG" is used here.
 *
 * ASSUMPTION: this lives in code for V0.1. It becomes an Admin-managed master data
 * table ("manage branch", "manage master data") in a later version.
 */

export interface BranchSeed {
  code: string;
  name: string;
  region: string;
  salesmen: string[];
}

export const BRANCHES: BranchSeed[] = [
  { code: "SMD-1", name: "SAMARINDA-1", region: "Kalimantan", salesmen: ["ADITIA KURNIAWAN", "GERINDRA YONKY", "HENDRA SIHOMBING", "SHN", "OTHERS"] },
  { code: "SMD-2", name: "SAMARINDA-2", region: "Kalimantan", salesmen: ["AGUSTIN PANGGABEAN", "PICASO MARKUS AGAVENTA BANGUN", "OTHERS"] },
  { code: "PLB", name: "PALEMBANG", region: "Sumatera", salesmen: ["M. IQBAL ANDY KURNIAWAN", "M. IKBAL FERDIANSYAH", "SUDARSO", "SHN", "OTHERS"] },
  { code: "BLG", name: "BANDAR LAMPUNG", region: "Sumatera", salesmen: ["M. INDRA ARYANSAYAH", "M. BALDIANSYA DEWANA"] },
  { code: "SMP", name: "SAMPIT", region: "Kalimantan", salesmen: ["ANDREW NOFENESIA", "HADI ISNANDAR", "HENDRA SAPUTRA", "HADI PRAYITNO", "PROJECT", "OTHERS"] },
  { code: "MDN", name: "MEDAN", region: "Sumatera", salesmen: ["YOSRA HADI PUTRA", "M. YUSUF SIPAHUTAR", "DEALER", "SHN", "OTHERS"] },
  { code: "JMB", name: "JAMBI", region: "Sumatera", salesmen: ["ALIF ALVIANTO", "SHN"] },
  { code: "PDG", name: "PADANG", region: "Sumatera", salesmen: ["MUHAMMAD FAQIH ASSHIDIEQ", "OTHERS"] },
  { code: "MKS", name: "MAKASSAR", region: "Sulawesi", salesmen: ["M. FADLY SINGKANG", "WAHYUDDIN ABDULLAH", "ZYAINI BHARKAH"] },
  { code: "PKB", name: "PEKANBARU", region: "Sumatera", salesmen: ["HADY SUDHARSONO", "IRFAN TRIYANTO", "SETIA WANDI", "PROJECT BTM", "OTHERS"] },
  { code: "PTK", name: "PONTIANAK", region: "Kalimantan", salesmen: ["ALPRIMA RAMDHANA", "PUNGKAS PIJAR RAHMANTO", "SETYONO M.T HIDAYAHTULLAH", "M. RAFLY BAGOES IRAWAN", "OTHERS"] },
  { code: "JYP", name: "JAYAPURA", region: "Papua", salesmen: ["HARUN HARYANTO LATUMAHINA", "INDRA THAMRIN", "OTHERS"] },
  { code: "BJM", name: "BANJARMASIN", region: "Kalimantan", salesmen: ["INDRA WINARTA SANDHI", "PAMRIH SANTOSO", "PRIYA LAKSONO", "RONNY FERDIAN"] },
];

export const ROSTER: Record<string, string[]> = Object.fromEntries(
  BRANCHES.map((b) => [b.code, b.salesmen])
);
