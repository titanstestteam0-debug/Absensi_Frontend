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

export function getStoredUser(): { id: number; name: string; email: string; role: string } | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(USER_KEY);
	return raw ? JSON.parse(raw) : null;
}

function setSession(token: string, user: unknown) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
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
	user: { id: number; name: string; email: string; role: 'admin' | 'guru' | 'guru_pengganti' };
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

// ------------------------------------------------------------------
// Rooms (Admin)
// ------------------------------------------------------------------
export interface Room {
	id: number;
	name: string;
	qr_string: string;
	is_active: boolean;
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

export const rejectLeave = (id: number) =>
	request<null>(`/admin/leaves/${id}/reject`, { method: 'PUT' });

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
