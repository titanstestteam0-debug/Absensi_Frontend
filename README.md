# SIM-Absensi Guru — Admin Portal (Svelte)

Portal admin & guru untuk Sistem Absensi Jam Mengajar Guru berbasis QR Code.
Terhubung ke Backend API (Golang) — lihat `src/lib/api.ts` untuk semua panggilan API.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`, arahkan ke alamat backend Go kamu:
```
VITE_API_BASE_URL=http://localhost:8080/api
```
(Kalau backend jalan di laptop lain, ganti `localhost` dengan IP/host backend-nya.)

## Jalankan

```bash
npm run dev
```
Buka `http://localhost:5173`. Login pakai NIP + password akun yang ada di database
backend (lihat `seed.sql` di project backend untuk akun contoh).

## Yang sudah terhubung ke API

| Fitur | Endpoint backend |
|---|---|
| Login | `POST /api/auth/login` |
| Data Master Guru (list & tambah) | `GET/POST /api/admin/teachers` |
| Data Ruangan & generate QR | `GET/POST /api/admin/rooms` |
| Jadwal Mengajar (list & tambah) | `GET/POST /api/admin/schedules` |
| Cuti — ajukan (guru) | `POST /api/leaves` |
| Cuti — riwayat sendiri (guru) | `GET /api/leaves` |
| Cuti — lihat semua (admin) | `GET /api/admin/leaves` |
| Cuti — setujui/tolak (admin) | `PUT /api/admin/leaves/{id}/approve` `/reject` |
| Laporan rekap bulanan | `GET /api/admin/reports/monthly` |
| Monitoring presensi hari ini | `GET /api/admin/reports/history` |
| Export laporan | CSV di-generate langsung di browser (tombol "Export CSV") |

## Catatan penting

- Scan QR untuk absen **tidak dilakukan di sini** — itu tugas aplikasi Flutter guru.
  Halaman ini murni untuk admin mengelola data & memantau, dan guru mengajukan cuti.
- Token login disimpan di `localStorage` browser; logout akan menghapusnya.
- Kalau backend belum jalan / salah alamat, setiap halaman akan menampilkan pesan
  error merah di bagian atas alih-alih data kosong diam-diam.
