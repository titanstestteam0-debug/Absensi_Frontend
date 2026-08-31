// src/lib/api.ts
// Client kecil untuk memanggil Backend API (Golang). Semua fungsi di sini
// mengembalikan `data` dari response backend (sudah dibungkus { success, message, data }),
// dan melempar Error(message) kalau backend membalas success: false atau HTTP error.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const TOKEN_KEY = 'absensi_token';
const USER_KEY = 'absensi_user';

export function getToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): {
	id: number;
	name: string;
	email: string;
	photo_url?: string;
	role: string;
} | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(USER_KEY);
	return raw ? JSON.parse(raw) : null;
}

function setSession(token: string, user: unknown) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Perbarui sebagian data user yang sedang login di localStorage (dipakai
// misalnya setelah guru mengganti foto profil), tanpa perlu login ulang.
export function patchStoredUser(patch: Record<string, unknown>) {
	const current = getStoredUser();
	if (!current) return;
	const updated = { ...current, ...patch };
	localStorage.setItem(USER_KEY, JSON.stringify(updated));
	return updated;
}

export function clearSession() {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
}

interface ApiEnvelope<T> {
	success: boolean;
	message?: string;
	data?: T;
}

async function request<T>(
	path: string,
	options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
	const { method = 'GET', body, auth = true } = options;

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (auth) {
		const token = getToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;
	}

	let res: Response;
	try {
		res = await fetch(`${BASE_URL}${path}`, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined
		});
	} catch (err) {
		throw new Error(
			`Tidak bisa menghubungi server API di ${BASE_URL}. Pastikan backend Go sedang berjalan.`
		);
	}

	let json: ApiEnvelope<T> | null = null;
	try {
		json = await res.json();
	} catch {
		// respons kosong / bukan JSON
	}

	if (!res.ok || !json?.success) {
		throw new Error(json?.message || `Request gagal (HTTP ${res.status})`);
	}

	return json.data as T;
}

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
export interface LoginResult {
	token: string;
	user: {
		id: number;
		name: string;
		email: string;
		photo_url?: string;
		role: 'admin' | 'guru' | 'guru_pengganti';
	};
}

export async function login(nip: string, password: string): Promise<LoginResult> {
	const data = await request<LoginResult>('/auth/login', {
		method: 'POST',
		body: { nip, password },
		auth: false
	});
	setSession(data.token, data.user);
	return data;
}

// ------------------------------------------------------------------
// Teachers (Admin)
// ------------------------------------------------------------------
export interface Teacher {
	id: number;
	name: string;
	nip: string;
	email?: string;
	photo_url?: string;
	role: 'admin' | 'guru' | 'guru_pengganti';
	is_active: boolean;
	created_at: string;
}

export const listTeachers = () => request<Teacher[]>('/admin/teachers');

export const createTeacher = (payload: {
	name: string;
	nip: string;
	email?: string;
	password: string;
	role?: string;
}) => request<{ id: number }>('/admin/teachers', { method: 'POST', body: payload });

export const updateTeacher = (
	id: number,
	payload: { name: string; email?: string; role?: string }
) => request<null>(`/admin/teachers/${id}`, { method: 'PUT', body: payload });

export const deleteTeacher = (id: number) =>
	request<null>(`/admin/teachers/${id}`, { method: 'DELETE' });

export const activateTeacher = (id: number) =>
	request<null>(`/admin/teachers/${id}/activate`, { method: 'PUT' });

// ------------------------------------------------------------------
// Rooms (Admin)
// ------------------------------------------------------------------
export interface Room {
	id: number;
	name: string;
	qr_string: string;
	is_active: boolean;
	qr_last_rotated_at?: string;
}

// Bentuk respons endpoint QR (GET /qr dan POST /refresh-qr) — mengembalikan
// qr_string yang sedang berlaku APA ADANYA. QR ini tidak pernah berubah
// sendiri; hanya berganti kalau refreshRoomQR() dipanggil (klik tombol
// "Refresh Sekarang" di UI).
export interface RoomQR {
	id: number;
	name: string;
	qr_string: string;
	is_active: boolean;
	last_rotated_at?: string;
}

export const listRooms = () => request<Room[]>('/admin/rooms');

export const createRoom = (name: string) =>
	request<{ id: number; name: string; qr_string: string }>('/admin/rooms', {
		method: 'POST',
		body: { name }
	});

export const updateRoom = (id: number, name: string) =>
	request<null>(`/admin/rooms/${id}`, { method: 'PUT', body: { name } });

export const deleteRoom = (id: number) =>
	request<null>(`/admin/rooms/${id}`, { method: 'DELETE' });

// Ambil QR yang sedang berlaku untuk sebuah ruangan APA ADANYA — tidak ada
// efek samping/rotasi, aman dipanggil berkali-kali (mis. tiap kali modal
// dibuka) tanpa membuat QR baru.
export const getRoomQR = (id: number) => request<RoomQR>(`/admin/rooms/${id}/qr`);

// Satu-satunya cara qr_string ruangan berganti: dipanggil saat admin sengaja
// menekan tombol "Refresh Sekarang" (misal QR lama dicurigai tersebar, atau
// stiker lama rusak dan perlu dicetak ulang).
export const refreshRoomQR = (id: number) =>
	request<RoomQR>(`/admin/rooms/${id}/refresh-qr`, { method: 'POST' });

// ------------------------------------------------------------------
// Schedules (Admin)
// ------------------------------------------------------------------
export interface Schedule {
	id: number;
	teacher_id: number;
	teacher_name: string;
	room_id: number;
	room_name: string;
	day_of_week: number; // 1=Senin ... 7=Minggu
	start_time: string;
	end_time: string;
	target_jp: number;
	subject?: string;
	is_active: boolean;
}

export const listSchedules = () => request<Schedule[]>('/admin/schedules');

export const createSchedule = (payload: {
	teacher_id: number;
	room_id: number;
	day_of_week: number;
	start_time: string;
	end_time: string;
	target_jp: number;
	subject?: string;
}) => request<{ id: number }>('/admin/schedules', { method: 'POST', body: payload });

export const updateSchedule = (
	id: number,
	payload: {
		teacher_id: number;
		room_id: number;
		day_of_week: number;
		start_time: string;
		end_time: string;
		target_jp: number;
		subject?: string;
	}
) => request<null>(`/admin/schedules/${id}`, { method: 'PUT', body: payload });

export const deleteSchedule = (id: number) =>
	request<null>(`/admin/schedules/${id}`, { method: 'DELETE' });

// ------------------------------------------------------------------
// Leaves / Cuti
// ------------------------------------------------------------------
export interface Leave {
	id: number;
	teacher_id: number;
	teacher_name?: string;
	start_date: string;
	end_date: string;
	leave_type: string;
	reason: string;
	status: 'pending' | 'approved' | 'rejected';
	rejection_reason?: string;
	created_at: string;
}

export const listAllLeaves = () => request<Leave[]>('/admin/leaves');
export const listMyLeaves = () => request<Leave[]>('/leaves');

export const createLeave = (payload: {
	start_date: string;
	end_date: string;
	leave_type: string;
	reason: string;
	attachment_url?: string;
}) => request<{ id: number }>('/leaves', { method: 'POST', body: payload });

export const approveLeave = (id: number) =>
	request<null>(`/admin/leaves/${id}/approve`, { method: 'PUT' });

// Admin wajib mengisi alasan penolakan supaya guru tahu kenapa pengajuannya ditolak.
export const rejectLeave = (id: number, reason: string) =>
	request<null>(`/admin/leaves/${id}/reject`, { method: 'PUT', body: { reason } });

// ------------------------------------------------------------------
// Jenis Cuti/Izin (Master Data) — dulunya hardcode di frontend, sekarang
// dikelola Admin lewat dashboard (GET/POST/PUT/DELETE /api/admin/leave-types).
// ------------------------------------------------------------------
export interface LeaveType {
	id: number;
	code: string;
	label: string;
	is_active: boolean;
	created_at: string;
}

// Dipakai guru untuk mengisi dropdown form pengajuan cuti (hanya yang aktif).
export const listActiveLeaveTypes = () => request<LeaveType[]>('/leave-types');

// Dipakai admin di halaman Master Data Cuti/Izin (termasuk yang nonaktif).
export const listLeaveTypesAdmin = () => request<LeaveType[]>('/admin/leave-types');

export const createLeaveType = (payload: { code: string; label: string }) =>
	request<{ id: number }>('/admin/leave-types', { method: 'POST', body: payload });

export const updateLeaveType = (id: number, payload: { label: string }) =>
	request<null>(`/admin/leave-types/${id}`, { method: 'PUT', body: payload });

export const deleteLeaveType = (id: number) =>
	request<null>(`/admin/leave-types/${id}`, { method: 'DELETE' });

export const activateLeaveType = (id: number) =>
	request<null>(`/admin/leave-types/${id}/activate`, { method: 'PUT' });

// ------------------------------------------------------------------
// Reports (Admin)
// ------------------------------------------------------------------
export interface MonthlyRecapRow {
	teacher_id: number;
	teacher_name: string;
	total_sesi: number;
	sesi_tuntas: number;
	sesi_tidak_tuntas: number;
	total_jp_aktual: number;
	total_jp_target: number;
}

export const getMonthlyReport = (month: number, year: number) =>
	request<MonthlyRecapRow[]>(`/admin/reports/monthly?month=${month}&year=${year}`);

export interface HistoryRow {
	id: number;
	date: string;
	teacher_name: string;
	room_name: string | null;
	clock_in: string | null;
	clock_out: string | null;
	actual_jp: number;
	target_jp: number;
	status: string;
	substitute_name: string | null;
}

export const getHistoryLog = (params: { teacher_id?: number; start?: string; end?: string }) => {
	const qs = new URLSearchParams();
	if (params.teacher_id) qs.set('teacher_id', String(params.teacher_id));
	if (params.start) qs.set('start', params.start);
	if (params.end) qs.set('end', params.end);
	return request<HistoryRow[]>(`/admin/reports/history?${qs.toString()}`);
};

// ------------------------------------------------------------------
// Profil (semua role yang login) — foto profil
// ------------------------------------------------------------------
export interface Profile {
	id: number;
	name: string;
	nip: string;
	email?: string;
	photo_url?: string;
	role: 'admin' | 'guru' | 'guru_pengganti';
	is_active: boolean;
}

export const getMyProfile = () => request<Profile>('/profile');

// photoBase64 harus berupa data URI lengkap, mis. "data:image/jpeg;base64,...."
// (lihat helper fileToDataURL di halaman utama untuk mengonversi dari <input type="file">).
export const updateMyPhoto = (photoBase64: string) =>
	request<{ photo_url: string }>('/profile/photo', {
		method: 'PUT',
		body: { photo_base64: photoBase64 }
	});
