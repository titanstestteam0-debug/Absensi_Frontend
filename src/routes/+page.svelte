<script lang="ts">
	import {
		login,
		clearSession,
		getStoredUser,
		getToken,
		patchStoredUser,
		listTeachers,
		createTeacher,
		updateTeacher,
		deleteTeacher,
		activateTeacher,
		listRooms,
		createRoom,
		updateRoom,
		deleteRoom,
		getRoomQR,
		refreshRoomQR,
		listSchedules,
		listSchedulePeriods,
		createSchedule,
		updateSchedule,
		deleteSchedule,
		duplicateSchedule,
		listAllLeaves,
		listMyLeaves,
		createLeave,
		adminCreateLeave,
		approveLeave,
		rejectLeave,
		listActiveLeaveTypes,
		listLeaveTypesAdmin,
		createLeaveType,
		updateLeaveType,
		deleteLeaveType,
		getMonthlyReport,
		getHistoryLog,
		getDailyReport,
		getSubstituteReport,
		getAnnualReport,
		updateMyPhoto,
		type Teacher,
		type Room,
		type Schedule,
		type SchedulePeriod,
		type Leave,
		type LeaveType,
		type MonthlyRecapRow,
		type HistoryRow,
		type DailyReport,
		type SubstituteReport,
		type AnnualReport
	} from '$lib/api';

	// ------------------------------------------------------------------
	// 1. Sesi / Autentikasi (terhubung ke POST /api/auth/login)
	// ------------------------------------------------------------------
	let currentUser = $state(getStoredUser());
	let isLoggedIn = $state(!!getStoredUser() && !!getToken());
	let loginInput = $state({ nip: '', password: '' });
	let loginError = $state('');
	let loginLoading = $state(false);

	let activeTab = $state('dashboard');
	let globalError = $state('');

	const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
	const now = new Date();

	async function handleLogin(e: Event) {
		e.preventDefault();
		loginError = '';
		if (!loginInput.nip || !loginInput.password) {
			loginError = 'Isi NIP dan password!';
			return;
		}
		loginLoading = true;
		try {
			const result = await login(loginInput.nip, loginInput.password);
			currentUser = result.user;
			isLoggedIn = true;
			activeTab = 'dashboard';
			await loadEverythingForRole();
		} catch (err) {
			loginError = err instanceof Error ? err.message : 'Login gagal';
		} finally {
			loginLoading = false;
		}
	}

	function handleLogout() {
		clearSession();
		currentUser = null;
		isLoggedIn = false;
		loginInput = { nip: '', password: '' };
	}

	// ------------------------------------------------------------------
	// 1b. Foto Profil (PUT /api/profile/photo) — dipakai admin & guru
	// ------------------------------------------------------------------
	let showModalFoto = $state(false);
	let fotoPreview = $state<string | null>(null); // data URI, buat preview sebelum disimpan
	let fotoError = $state('');
	let fotoLoading = $state(false);

	function openModalFoto() {
		fotoPreview = null;
		fotoError = '';
		showModalFoto = true;
	}

	function fileToDataURL(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error('Gagal membaca file'));
			reader.readAsDataURL(file);
		});
	}

	async function handlePickFoto(e: Event) {
		fotoError = '';
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
			fotoError = 'Format harus JPEG, PNG, atau WEBP';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			fotoError = 'Ukuran file maksimal 2MB';
			return;
		}

		try {
			fotoPreview = await fileToDataURL(file);
		} catch (err) {
			fotoError = err instanceof Error ? err.message : 'Gagal membaca file gambar';
		}
	}

	async function handleSaveFoto() {
		if (!fotoPreview) {
			fotoError = 'Pilih foto terlebih dahulu';
			return;
		}
		fotoLoading = true;
		fotoError = '';
		try {
			const res = await updateMyPhoto(fotoPreview);
			currentUser = patchStoredUser({ photo_url: res.photo_url }) ?? currentUser;
			showModalFoto = false;
			fotoPreview = null;
			// Kalau admin, refresh Data Master Guru supaya foto barunya ikut tampil di tabel.
			if (currentUser?.role === 'admin') {
				await loadTeachers();
			}
		} catch (err) {
			fotoError = err instanceof Error ? err.message : 'Gagal menyimpan foto profil';
		} finally {
			fotoLoading = false;
		}
	}

	// ------------------------------------------------------------------
	// 2. Data Master Guru (GET/POST /api/admin/teachers)
	// ------------------------------------------------------------------
	let teachers = $state<Teacher[]>([]);
	let teachersLoading = $state(false);
	let showModalGuru = $state(false);
	let newGuru = $state({ name: '', nip: '', email: '', password: '', role: 'guru' });
	let guruFormError = $state('');

	let showModalEditGuru = $state(false);
	let editGuruId = $state<number | null>(null);
	let editGuru = $state({ name: '', email: '', role: 'guru' });
	let editGuruFormError = $state('');

	async function loadTeachers() {
		teachersLoading = true;
		try {
			teachers = (await listTeachers()) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat data guru';
		} finally {
			teachersLoading = false;
		}
	}

	function roleLabel(role: string) {
		switch (role) {
			case 'admin':
				return 'Admin';
			case 'guru_pengganti':
				return 'Guru Pengganti';
			case 'guru':
				return 'Guru';
			default:
				return role;
		}
	}

	async function handleAddGuru(e: Event) {
		e.preventDefault();
		guruFormError = '';
		if (!newGuru.name || !newGuru.nip || !newGuru.password) {
			guruFormError = 'Nama, NIP, dan password wajib diisi';
			return;
		}
		try {
			await createTeacher(newGuru);
			newGuru = { name: '', nip: '', email: '', password: '', role: 'guru' };
			showModalGuru = false;
			await loadTeachers();
		} catch (err) {
			guruFormError = err instanceof Error ? err.message : 'Gagal menyimpan guru';
		}
	}

	function openEditGuru(t: Teacher) {
		editGuruId = t.id;
		editGuru = { name: t.name, email: t.email ?? '', role: t.role };
		editGuruFormError = '';
		showModalEditGuru = true;
	}

	async function handleEditGuru(e: Event) {
		e.preventDefault();
		editGuruFormError = '';
		if (!editGuru.name || editGuruId === null) {
			editGuruFormError = 'Nama wajib diisi';
			return;
		}
		try {
			await updateTeacher(editGuruId, editGuru);
			showModalEditGuru = false;
			await loadTeachers();
		} catch (err) {
			editGuruFormError = err instanceof Error ? err.message : 'Gagal memperbarui guru';
		}
	}

	async function handleDeleteGuru(t: Teacher) {
		if (!confirm(`Nonaktifkan guru "${t.name}"? Guru yang nonaktif tidak bisa login/presensi.`)) return;
		try {
			await deleteTeacher(t.id);
			await loadTeachers();
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal menonaktifkan guru';
		}
	}

	async function handleActivateGuru(t: Teacher) {
		if (!confirm(`Aktifkan kembali guru "${t.name}"?`)) return;
		try {
			await activateTeacher(t.id);
			await loadTeachers();
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal mengaktifkan guru';
		}
	}

	// ------------------------------------------------------------------
	// 3. Data Ruangan & QR (GET/POST /api/admin/rooms)
	// ------------------------------------------------------------------
	let rooms = $state<Room[]>([]);
	let roomsLoading = $state(false);
	let showModalRuangan = $state(false);
	let newRuanganName = $state('');
	let ruanganFormError = $state('');
	let showModalQR = $state(false);
	let selectedRoom = $state<Room | null>(null);

	// --- QR (manual refresh) di dalam modal. QR TIDAK pernah berganti sendiri
	// -- hanya berubah kalau admin menekan tombol "Refresh Sekarang" -- supaya
	// QR yang sudah dicetak/ditempel di kelas tetap valid dan bisa dipakai
	// berulang kali sampai memang sengaja di-refresh. ---
	let qrLoading = $state(false);
	let qrError = $state('');
	let qrCurrentString = $state('');
	let qrLastRotatedAt = $state('');

	async function loadRooms() {
		roomsLoading = true;
		try {
			rooms = (await listRooms()) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat data ruangan';
		} finally {
			roomsLoading = false;
		}
	}

	async function handleAddRuangan(e: Event) {
		e.preventDefault();
		ruanganFormError = '';
		if (!newRuanganName) {
			ruanganFormError = 'Nama ruangan wajib diisi';
			return;
		}
		try {
			await createRoom(newRuanganName);
			newRuanganName = '';
			showModalRuangan = false;
			await loadRooms();
		} catch (err) {
			ruanganFormError = err instanceof Error ? err.message : 'Gagal membuat ruangan';
		}
	}

	function formatRotatedAt(iso: string) {
		if (!iso) return '-';
		try {
			return new Date(iso).toLocaleString('id-ID', {
				dateStyle: 'medium',
				timeStyle: 'short'
			});
		} catch {
			return iso;
		}
	}

	// Ambil QR ruangan APA ADANYA (tidak membuat/mengganti QR baru). Aman
	// dipanggil setiap kali modal dibuka, karena tidak ada efek samping.
	async function loadCurrentQR(roomId: number) {
		qrLoading = true;
		try {
			const data = await getRoomQR(roomId);
			qrCurrentString = data.qr_string;
			qrLastRotatedAt = data.last_rotated_at ?? '';
			qrError = '';
		} catch (err) {
			qrError = err instanceof Error ? err.message : 'Gagal memuat QR';
		} finally {
			qrLoading = false;
		}
	}

	// Satu-satunya cara QR ruangan berganti: admin sengaja menekan tombol ini.
	async function handleRefreshQRNow() {
		if (!selectedRoom) return;
		if (
			!confirm(
				'QR lama akan berhenti berlaku dan diganti QR baru. Stiker/cetakan QR lama harus dicetak ulang. Lanjutkan?'
			)
		) {
			return;
		}
		qrLoading = true;
		try {
			const data = await refreshRoomQR(selectedRoom.id);
			qrCurrentString = data.qr_string;
			qrLastRotatedAt = data.last_rotated_at ?? '';
			qrError = '';
			await loadRooms();
		} catch (err) {
			qrError = err instanceof Error ? err.message : 'Gagal me-refresh QR';
		} finally {
			qrLoading = false;
		}
	}

	async function openQRModal(room: Room) {
		selectedRoom = room;
		showModalQR = true;
		qrError = '';
		qrCurrentString = '';
		qrLastRotatedAt = '';
		await loadCurrentQR(room.id);
	}

	function closeQRModal() {
		showModalQR = false;
	}

	// Cetak kartu QR ruangan (area #qr-print-area saja, lihat CSS @media print
	// di layout.css / style global).
	function handlePrintQR() {
		window.print();
	}

	let showModalEditRuangan = $state(false);
	let editRuanganId = $state<number | null>(null);
	let editRuanganName = $state('');
	let editRuanganFormError = $state('');

	function openEditRuangan(r: Room) {
		editRuanganId = r.id;
		editRuanganName = r.name;
		editRuanganFormError = '';
		showModalEditRuangan = true;
	}

	async function handleEditRuangan(e: Event) {
		e.preventDefault();
		editRuanganFormError = '';
		if (!editRuanganName || editRuanganId === null) {
			editRuanganFormError = 'Nama ruangan wajib diisi';
			return;
		}
		try {
			await updateRoom(editRuanganId, editRuanganName);
			showModalEditRuangan = false;
			await loadRooms();
		} catch (err) {
			editRuanganFormError = err instanceof Error ? err.message : 'Gagal memperbarui ruangan';
		}
	}

	async function handleDeleteRuangan(r: Room) {
		if (!confirm(`Nonaktifkan ruangan "${r.name}"?`)) return;
		try {
			await deleteRoom(r.id);
			await loadRooms();
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal menonaktifkan ruangan';
		}
	}

	// ------------------------------------------------------------------
	// 4. Jadwal Mengajar (GET/POST /api/admin/schedules)
	// ------------------------------------------------------------------
	let schedules = $state<Schedule[]>([]);
	let schedulesLoading = $state(false);

	// --- Filter Bulan: jadwal sekarang terikat periode (bulan/tahun), tiap
	// bulan bisa punya susunan berbeda, riwayat bulan lama tetap tersimpan. ---
	let scheduleMonth = $state(now.getMonth() + 1);
	let scheduleYear = $state(now.getFullYear());
	let schedulePeriods = $state<SchedulePeriod[]>([]);

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

	function monthName(m: number) {
		return new Date(2000, m - 1, 1).toLocaleString('id-ID', { month: 'long' });
	}

	// --- Popup pemilih Bulan/Tahun (gaya kalender: navigasi tahun + grid 12 bulan) ---
	let showMonthPicker = $state(false);
	let pickerYear = $state(now.getFullYear());

	function openMonthPicker() {
		pickerYear = scheduleYear;
		showMonthPicker = true;
	}

	function selectPeriod(month: number, year: number) {
		scheduleMonth = month;
		scheduleYear = year;
		showMonthPicker = false;
		loadSchedules();
	}

	// Bulan-tahun yang sudah punya data jadwal tersimpan (ditandai titik kecil
	// di grid popup), termasuk riwayat lama.
	function periodHasData(month: number, year: number) {
		return schedulePeriods.some((p) => p.month === month && p.year === year);
	}

	async function loadSchedules() {
		schedulesLoading = true;
		try {
			schedules = (await listSchedules(scheduleMonth, scheduleYear)) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat jadwal';
		} finally {
			schedulesLoading = false;
		}
	}

	async function loadSchedulePeriods() {
		try {
			schedulePeriods = (await listSchedulePeriods()) || [];
		} catch {
			// non-fatal -- filter bulan tetap jalan meski daftar riwayat ini gagal dimuat
		}
	}

	let showModalJadwal = $state(false);
	let newJadwal = $state({
		teacher_id: 0,
		room_id: 0,
		day_of_week: 1,
		period_month: now.getMonth() + 1,
		period_year: now.getFullYear(),
		start_time: '07:00',
		end_time: '08:00',
		target_jp: 1,
		subject: ''
	});
	let jadwalFormError = $state('');

	// Default periode jadwal baru mengikuti bulan yang SEDANG difilter/dilihat
	// admin, supaya jadwal yang baru dibuat langsung muncul di grid.
	function openAddJadwal() {
		newJadwal = {
			teacher_id: 0,
			room_id: 0,
			day_of_week: 1,
			period_month: scheduleMonth,
			period_year: scheduleYear,
			start_time: '07:00',
			end_time: '08:00',
			target_jp: 1,
			subject: ''
		};
		jadwalFormError = '';
		showModalJadwal = true;
	}

	async function handleAddJadwal(e: Event) {
		e.preventDefault();
		jadwalFormError = '';
		if (!newJadwal.teacher_id || !newJadwal.room_id) {
			jadwalFormError = 'Pilih guru dan ruangan terlebih dahulu';
			return;
		}
		try {
			await createSchedule({
				...newJadwal,
				start_time: newJadwal.start_time + ':00',
				end_time: newJadwal.end_time + ':00'
			});
			showModalJadwal = false;
			await loadSchedulePeriods();
			await loadSchedules();
		} catch (err) {
			jadwalFormError = err instanceof Error ? err.message : 'Gagal menyimpan jadwal';
		}
	}

	let showModalEditJadwal = $state(false);
	let editJadwalId = $state<number | null>(null);
	let editJadwal = $state({
		teacher_id: 0,
		room_id: 0,
		day_of_week: 1,
		period_month: now.getMonth() + 1,
		period_year: now.getFullYear(),
		start_time: '07:00',
		end_time: '08:00',
		target_jp: 1,
		subject: ''
	});
	let editJadwalFormError = $state('');

	// --- Duplikasi jadwal ke bulan lain: shortcut supaya admin tidak perlu
	// input ulang dari nol tiap bulan baru kalau susunannya sama/mirip. ---
	let duplicateTargetMonth = $state(now.getMonth() + 1);
	let duplicateTargetYear = $state(now.getFullYear());
	let duplicateLoading = $state(false);
	let duplicateMessage = $state('');

	function openEditJadwal(s: Schedule) {
		editJadwalId = s.id;
		editJadwal = {
			teacher_id: s.teacher_id,
			room_id: s.room_id,
			day_of_week: s.day_of_week,
			period_month: s.period_month,
			period_year: s.period_year,
			start_time: s.start_time ? s.start_time.slice(0, 5) : '07:00',
			end_time: s.end_time ? s.end_time.slice(0, 5) : '08:00',
			target_jp: s.target_jp,
			subject: s.subject ?? ''
		};
		editJadwalFormError = '';
		duplicateMessage = '';
		// Default target duplikasi: bulan berikutnya dari jadwal ini.
		const next = new Date(s.period_year, s.period_month, 1); // period_month sudah 1-based, jadi ini otomatis +1 bulan
		duplicateTargetMonth = next.getMonth() + 1;
		duplicateTargetYear = next.getFullYear();
		showModalEditJadwal = true;
	}

	async function handleEditJadwal(e: Event) {
		e.preventDefault();
		editJadwalFormError = '';
		if (!editJadwal.teacher_id || !editJadwal.room_id || editJadwalId === null) {
			editJadwalFormError = 'Pilih guru dan ruangan terlebih dahulu';
			return;
		}
		try {
			await updateSchedule(editJadwalId, {
				...editJadwal,
				start_time: editJadwal.start_time + ':00',
				end_time: editJadwal.end_time + ':00'
			});
			showModalEditJadwal = false;
			await loadSchedulePeriods();
			await loadSchedules();
		} catch (err) {
			editJadwalFormError = err instanceof Error ? err.message : 'Gagal memperbarui jadwal';
		}
	}

	async function handleDuplicateJadwal() {
		if (editJadwalId === null) return;
		duplicateMessage = '';
		duplicateLoading = true;
		try {
			await duplicateSchedule(editJadwalId, duplicateTargetMonth, duplicateTargetYear);
			duplicateMessage = `✅ Berhasil diduplikasi ke ${monthName(duplicateTargetMonth)} ${duplicateTargetYear}`;
			await loadSchedulePeriods();
			if (duplicateTargetMonth === scheduleMonth && duplicateTargetYear === scheduleYear) {
				await loadSchedules();
			}
		} catch (err) {
			duplicateMessage = '';
			editJadwalFormError = err instanceof Error ? err.message : 'Gagal menduplikasi jadwal';
		} finally {
			duplicateLoading = false;
		}
	}

	async function handleDeleteJadwal(s: Schedule) {
		if (!confirm(`Nonaktifkan jadwal "${s.teacher_name}" di "${s.room_name}"?`)) return;
		try {
			await deleteSchedule(s.id);
			await loadSchedules();
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal menonaktifkan jadwal';
		}
	}

	// --- Tampilan grid Jadwal Mengajar (kalender mingguan per jam) ---
	let filterTeacherId = $state<number | ''>('');
	let filterRoomId = $state<number | ''>('');

	const filteredSchedules = $derived(
		schedules.filter(
			(s) =>
				(filterTeacherId === '' || s.teacher_id === Number(filterTeacherId)) &&
				(filterRoomId === '' || s.room_id === Number(filterRoomId))
		)
	);

	function timeToHourFloat(t: string): number {
		const [h, m] = t.split(':').map(Number);
		return h + (m || 0) / 60;
	}

	// Rentang jam default 07:00-17:00, otomatis melebar kalau ada jadwal
	// yang mulai lebih pagi atau berakhir lebih malam dari itu.
	const GRID_DEFAULT_MIN_HOUR = 7;
	const GRID_DEFAULT_MAX_HOUR = 17;

	const gridHourRange = $derived.by(() => {
		let minHour = GRID_DEFAULT_MIN_HOUR;
		let maxHour = GRID_DEFAULT_MAX_HOUR;
		for (const s of filteredSchedules) {
			const startH = Math.floor(timeToHourFloat(s.start_time));
			const endH = Math.min(23, Math.ceil(timeToHourFloat(s.end_time)));
			if (startH < minHour) minHour = startH;
			if (endH > maxHour) maxHour = endH;
		}
		const hours: number[] = [];
		for (let h = minHour; h < maxHour; h++) hours.push(h);
		return hours;
	});

	// Palet warna per guru (dipilih berdasarkan teacher_id supaya konsisten
	// di grid maupun legend selama sesi ini).
	const TEACHER_COLORS = [
		{ bg: 'bg-blue-600', hex: '#2563eb' },
		{ bg: 'bg-rose-500', hex: '#f43f5e' },
		{ bg: 'bg-emerald-600', hex: '#059669' },
		{ bg: 'bg-amber-500', hex: '#f59e0b' },
		{ bg: 'bg-purple-600', hex: '#9333ea' },
		{ bg: 'bg-cyan-600', hex: '#0891b2' },
		{ bg: 'bg-orange-600', hex: '#ea580c' },
		{ bg: 'bg-pink-600', hex: '#db2777' },
		{ bg: 'bg-lime-600', hex: '#65a30d' },
		{ bg: 'bg-indigo-600', hex: '#4f46e5' }
	];

	function teacherColor(teacherId: number) {
		return TEACHER_COLORS[teacherId % TEACHER_COLORS.length];
	}

	// Legend di bawah grid: setiap guru yang tampil di grid + total JP
	// mengajarnya minggu ini (jumlah target_jp seluruh jadwalnya).
	const teacherLegend = $derived.by(() => {
		const map = new Map<number, { name: string; jp: number }>();
		for (const s of filteredSchedules) {
			const cur = map.get(s.teacher_id) ?? { name: s.teacher_name, jp: 0 };
			cur.jp += s.target_jp;
			map.set(s.teacher_id, cur);
		}
		return Array.from(map.entries())
			.map(([teacher_id, v]) => ({ teacher_id, ...v }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	// ------------------------------------------------------------------
	// 5. Cuti / Izin (GET/POST /api/leaves, /api/admin/leaves, approve/reject)
	// ------------------------------------------------------------------
	let leaves = $state<Leave[]>([]);
	let leavesLoading = $state(false);
	let showModalAjukanCuti = $state(false);
	let newCuti = $state({ start_date: '', end_date: '', leave_type: '', reason: '' });
	let cutiFormError = $state('');

	// Jenis cuti/izin yang aktif, dipakai untuk mengisi dropdown form
	// pengajuan cuti guru. Diambil dari master data (bukan hardcode lagi).
	let leaveTypes = $state<LeaveType[]>([]);

	async function loadLeaveTypes() {
		try {
			leaveTypes = (await listActiveLeaveTypes()) || [];
			if (!newCuti.leave_type && leaveTypes.length > 0) {
				newCuti.leave_type = leaveTypes[0].code;
			}
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat jenis cuti/izin';
		}
	}

	function leaveTypeLabel(code: string) {
		return leaveTypes.find((lt) => lt.code === code)?.label ?? leaveTypesAdmin.find((lt) => lt.code === code)?.label ?? code;
	}

	// --- Modal alasan penolakan (admin wajib isi saat menolak cuti) ---
	let showModalTolakCuti = $state(false);
	let tolakCutiTarget = $state<Leave | null>(null);
	let tolakCutiReason = $state('');
	let tolakCutiFormError = $state('');
	let tolakCutiLoading = $state(false);

	async function loadLeaves() {
		leavesLoading = true;
		try {
			const res = currentUser?.role === 'admin' ? await listAllLeaves() : await listMyLeaves();
			leaves = Array.isArray(res) ? res : [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat data cuti';
			leaves = [];
		} finally {
			leavesLoading = false;
		}
	}

	async function handleAjukanCuti(e: Event) {
		e.preventDefault();
		cutiFormError = '';
		if (!newCuti.start_date || !newCuti.end_date || !newCuti.leave_type || !newCuti.reason) {
			cutiFormError = 'Semua field wajib diisi';
			return;
		}
		try {
			await createLeave(newCuti);
			newCuti = { start_date: '', end_date: '', leave_type: leaveTypes[0]?.code ?? '', reason: '' };
			showModalAjukanCuti = false;
			await loadLeaves();
		} catch (err) {
			cutiFormError = err instanceof Error ? err.message : 'Gagal mengajukan cuti';
		}
	}

	// --- Admin membantu mengajukan cuti/izin atas nama guru -- LANGSUNG
	// disetujui otomatis, tanpa perlu melalui alur pending->approve, untuk
	// kondisi darurat/mendadak yang sudah dikomunikasikan langsung ke admin. ---
	let showModalAjukanCutiAdmin = $state(false);
	let newCutiAdmin = $state({ teacher_id: '', start_date: '', end_date: '', leave_type: '', reason: '' });
	let cutiAdminFormError = $state('');

	function openAjukanCutiAdmin() {
		newCutiAdmin = {
			teacher_id: '',
			start_date: '',
			end_date: '',
			leave_type: leaveTypesAdmin[0]?.code ?? leaveTypes[0]?.code ?? '',
			reason: ''
		};
		cutiAdminFormError = '';
		showModalAjukanCutiAdmin = true;
	}

	async function handleAjukanCutiAdmin(e: Event) {
		e.preventDefault();
		cutiAdminFormError = '';
		if (
			!newCutiAdmin.teacher_id ||
			!newCutiAdmin.start_date ||
			!newCutiAdmin.end_date ||
			!newCutiAdmin.leave_type ||
			!newCutiAdmin.reason
		) {
			cutiAdminFormError = 'Semua field wajib diisi';
			return;
		}
		try {
			await adminCreateLeave({
				...newCutiAdmin,
				teacher_id: Number(newCutiAdmin.teacher_id)
			});
			showModalAjukanCutiAdmin = false;
			await loadLeaves();
		} catch (err) {
			cutiAdminFormError = err instanceof Error ? err.message : 'Gagal mengajukan cuti untuk guru';
		}
	}

	async function handleApprove(id: number) {
		try {
			await approveLeave(id);
			await loadLeaves();
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal menyetujui cuti';
		}
	}

	// Membuka modal untuk minta alasan penolakan dulu, bukan langsung menolak.
	function openTolakCuti(c: Leave) {
		tolakCutiTarget = c;
		tolakCutiReason = '';
		tolakCutiFormError = '';
		showModalTolakCuti = true;
	}

	async function handleReject(e: Event) {
		e.preventDefault();
		tolakCutiFormError = '';
		if (!tolakCutiTarget) return;
		if (!tolakCutiReason.trim()) {
			tolakCutiFormError = 'Alasan penolakan wajib diisi';
			return;
		}
		tolakCutiLoading = true;
		try {
			await rejectLeave(tolakCutiTarget.id, tolakCutiReason.trim());
			showModalTolakCuti = false;
			tolakCutiTarget = null;
			await loadLeaves();
		} catch (err) {
			tolakCutiFormError = err instanceof Error ? err.message : 'Gagal menolak cuti';
		} finally {
			tolakCutiLoading = false;
		}
	}

	// ------------------------------------------------------------------
	// 5b. Master Data Jenis Cuti/Izin (Admin) — GET/POST/PUT/DELETE
	// /api/admin/leave-types. Sebelumnya jenis cuti di-hardcode di kode
	// frontend (hanya "Sakit" & "Izin Dinas Luar"); sekarang admin bisa
	// menambah/mengubah/menonaktifkan sendiri lewat dashboard ini.
	// ------------------------------------------------------------------
	let leaveTypesAdmin = $state<LeaveType[]>([]);
	let leaveTypesAdminLoading = $state(false);

	let showModalLeaveType = $state(false);
	let newLeaveType = $state({ code: '', label: '' });
	let leaveTypeFormError = $state('');

	let showModalEditLeaveType = $state(false);
	let editLeaveTypeId = $state<number | null>(null);
	let editLeaveType = $state({ label: '' });
	let editLeaveTypeFormError = $state('');

	async function loadLeaveTypesAdmin() {
		leaveTypesAdminLoading = true;
		try {
			leaveTypesAdmin = (await listLeaveTypesAdmin()) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat master data jenis cuti/izin';
		} finally {
			leaveTypesAdminLoading = false;
		}
	}

	async function handleAddLeaveType(e: Event) {
		e.preventDefault();
		leaveTypeFormError = '';
		if (!newLeaveType.label.trim()) {
			leaveTypeFormError = 'Nama jenis cuti/izin wajib diisi';
			return;
		}
		try {
			await createLeaveType(newLeaveType);
			newLeaveType = { code: '', label: '' };
			showModalLeaveType = false;
			await loadLeaveTypesAdmin();
			await loadLeaveTypes();
		} catch (err) {
			leaveTypeFormError = err instanceof Error ? err.message : 'Gagal menambah jenis cuti/izin';
		}
	}

	function openEditLeaveType(lt: LeaveType) {
		editLeaveTypeId = lt.id;
		editLeaveType = { label: lt.label };
		editLeaveTypeFormError = '';
		showModalEditLeaveType = true;
	}

	async function handleEditLeaveType(e: Event) {
		e.preventDefault();
		editLeaveTypeFormError = '';
		if (!editLeaveType.label.trim() || editLeaveTypeId === null) {
			editLeaveTypeFormError = 'Nama jenis cuti/izin wajib diisi';
			return;
		}
		try {
			await updateLeaveType(editLeaveTypeId, editLeaveType);
			showModalEditLeaveType = false;
			await loadLeaveTypesAdmin();
			await loadLeaveTypes();
		} catch (err) {
			editLeaveTypeFormError = err instanceof Error ? err.message : 'Gagal memperbarui jenis cuti/izin';
		}
	}

	async function handleDeleteLeaveType(lt: LeaveType) {
		if (
			!confirm(
				`Hapus permanen jenis cuti/izin "${lt.label}"? Riwayat pengajuan cuti lama yang sudah memakai jenis ini tetap akan tampil, tapi jenis ini tidak akan muncul lagi di dropdown pengajuan guru. Tindakan ini tidak bisa dibatalkan.`
			)
		)
			return;
		try {
			await deleteLeaveType(lt.id);
			await loadLeaveTypesAdmin();
			await loadLeaveTypes();
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal menghapus jenis cuti/izin';
		}
	}

	// ------------------------------------------------------------------
	// 6. Laporan (GET /api/admin/reports/monthly, /daily, /substitutes, /annual, /history)
	// ------------------------------------------------------------------

	// Sub-tab di dalam halaman Laporan: Bulanan / Harian / Guru Pengganti / Tahunan.
	let reportSubTab = $state<'bulanan' | 'harian' | 'pengganti' | 'tahunan'>('bulanan');

	let reportMonth = $state(now.getMonth() + 1);
	let reportYear = $state(now.getFullYear());
	let monthlyRecap = $state<MonthlyRecapRow[]>([]);
	let reportLoading = $state(false);

	async function loadMonthlyReport() {
		reportLoading = true;
		try {
			monthlyRecap = (await getMonthlyReport(reportMonth, reportYear)) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat laporan bulanan';
		} finally {
			reportLoading = false;
		}
	}

	function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
		const csv = [header, ...rows]
			.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
			.join('\n');
		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportReportCSV() {
		const header = [
			'Nama Guru',
			'Total Sesi',
			'Tuntas',
			'Tidak Tuntas',
			'JP Aktual',
			'JP Target',
			'Sesi sbg Guru Pengganti',
			'JP sbg Guru Pengganti',
			'Sesi Digantikan',
			'Jumlah Cuti'
		];
		const rows = monthlyRecap.map((r) => [
			r.teacher_name,
			r.total_sesi,
			r.sesi_tuntas,
			r.sesi_tidak_tuntas,
			r.total_jp_aktual,
			r.total_jp_target,
			r.sesi_sebagai_pengganti,
			r.jp_sebagai_pengganti,
			r.sesi_digantikan,
			r.jumlah_cuti
		]);
		downloadCSV(`rekap-bulanan-${reportYear}-${String(reportMonth).padStart(2, '0')}.csv`, header, rows);
	}

	// --- 6b. Laporan Absensi Harian: dari tanggal 1 s/d hari ini, start_day
	// bisa digeser admin (dibatasi tetap di bulan yang sama oleh backend). ---
	let dailyYear = $state(now.getFullYear());
	let dailyMonth = $state(now.getMonth() + 1);
	let dailyStartDay = $state(1);
	let dailyReport = $state<DailyReport | null>(null);
	let dailyLoading = $state(false);
	let dailyError = $state('');

	// Batas atas input tanggal mulai: jumlah hari di bulan yang dipilih.
	function daysInSelectedDailyMonth() {
		return new Date(dailyYear, dailyMonth, 0).getDate();
	}

	async function loadDailyReport() {
		dailyLoading = true;
		dailyError = '';
		try {
			dailyReport = await getDailyReport(dailyYear, dailyMonth, dailyStartDay);
		} catch (err) {
			dailyError = err instanceof Error ? err.message : 'Gagal memuat laporan harian';
			dailyReport = null;
		} finally {
			dailyLoading = false;
		}
	}

	function exportDailyReportCSV() {
		if (!dailyReport) return;
		const header = [
			'Tanggal',
			'Total Sesi',
			'Tuntas',
			'Tidak Tuntas',
			'Berlangsung',
			'Jumlah Guru Hadir',
			'Sesi Digantikan',
			'Total JP Aktual'
		];
		const rows = dailyReport.days.map((d) => [
			d.date,
			d.total_sesi,
			d.sesi_tuntas,
			d.sesi_tidak_tuntas,
			d.sesi_berlangsung,
			d.jumlah_guru_hadir,
			d.sesi_digantikan,
			d.total_jp_aktual
		]);
		downloadCSV(`absen-harian-${dailyReport.start_date}_sd_${dailyReport.end_date}.csv`, header, rows);
	}

	// --- 6c. Rekap sebagai Guru Pengganti (inval) -- tidak terikat target JP. ---
	let subStart = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
	let subEnd = $state(now.toISOString().slice(0, 10));
	let subTeacherId = $state('');
	let subReport = $state<SubstituteReport | null>(null);
	let subLoading = $state(false);

	async function loadSubstituteReport() {
		subLoading = true;
		try {
			subReport = await getSubstituteReport({
				start: subStart || undefined,
				end: subEnd || undefined,
				teacher_id: subTeacherId ? Number(subTeacherId) : undefined
			});
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat rekap guru pengganti';
			subReport = null;
		} finally {
			subLoading = false;
		}
	}

	function exportSubstituteReportCSV() {
		if (!subReport) return;
		const header = ['Tanggal', 'Guru Pengganti', 'Menggantikan', 'Ruangan', 'Jam Masuk', 'Jam Keluar', 'JP Aktual'];
		const rows = subReport.sessions.map((s) => [
			s.date,
			s.substitute_name,
			s.original_teacher_name,
			s.room_name ?? '-',
			s.clock_in ?? '-',
			s.clock_out ?? '-',
			s.actual_jp
		]);
		downloadCSV(`rekap-guru-pengganti-${subStart || 'semua'}_sd_${subEnd || 'semua'}.csv`, header, rows);
	}

	// --- 6d. Laporan Tahunan / Individu per guru: 12 bulan, dipakai untuk
	// export CSV individu & melihat konsistensi kehadiran guru selama setahun. ---
	let annualYear = $state(now.getFullYear());
	let annualTeacherId = $state('');
	let annualReport = $state<AnnualReport | null>(null);
	let annualLoading = $state(false);

	async function loadAnnualReport() {
		if (!annualTeacherId) return;
		annualLoading = true;
		try {
			annualReport = await getAnnualReport(annualYear, Number(annualTeacherId));
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat laporan tahunan';
			annualReport = null;
		} finally {
			annualLoading = false;
		}
	}

	// "Laporan CSV Individu": ringkasan setahun penuh untuk SATU guru --
	// jadwal tetap, sebagai guru pengganti, jumlah cuti, dan status konsisten
	// per bulan, siap dibuka di Excel/Sheets.
	function exportAnnualReportCSV() {
		if (!annualReport) return;
		const header = [
			'Bulan',
			'Total Sesi',
			'Tuntas',
			'Tidak Tuntas',
			'JP Aktual',
			'JP Target',
			'Sesi sbg Guru Pengganti',
			'JP sbg Guru Pengganti',
			'Jumlah Cuti',
			'Konsisten'
		];
		const rows = annualReport.months.map((m) => [
			m.month_name,
			m.total_sesi,
			m.sesi_tuntas,
			m.sesi_tidak_tuntas,
			m.jp_aktual,
			m.jp_target,
			m.sesi_sebagai_pengganti,
			m.jp_sebagai_pengganti,
			m.jumlah_cuti,
			m.has_data ? (m.consistent ? 'Ya' : 'Tidak') : '-'
		]);
		rows.push([
			'TOTAL SETAHUN',
			annualReport.total_sesi,
			annualReport.total_sesi_tuntas,
			annualReport.total_sesi_tidak_tuntas,
			annualReport.total_jp_aktual,
			annualReport.total_jp_target,
			annualReport.total_sesi_sebagai_pengganti,
			annualReport.total_jp_sebagai_pengganti,
			annualReport.total_jumlah_cuti,
			annualReport.konsisten_setahun ? 'Ya' : 'Tidak'
		]);
		downloadCSV(
			`laporan-individu-${annualReport.teacher_name.replace(/\s+/g, '_')}-${annualReport.year}.csv`,
			header,
			rows
		);
	}

	// ------------------------------------------------------------------
	// 7. Dashboard: history hari ini (GET /api/admin/reports/history)
	// ------------------------------------------------------------------
	let todayHistory = $state<HistoryRow[]>([]);
	let todayLoading = $state(false);

	async function loadTodayHistory() {
		todayLoading = true;
		try {
			const today = new Date().toISOString().slice(0, 10);
			todayHistory = (await getHistoryLog({ start: today, end: today })) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat monitoring hari ini';
		} finally {
			todayLoading = false;
		}
	}

	async function loadEverythingForRole() {
		globalError = '';
		if (currentUser?.role === 'admin') {
			await Promise.all([
				loadTeachers(),
				loadRooms(),
				loadSchedules(),
				loadSchedulePeriods(),
				loadLeaves(),
				loadTodayHistory(),
				loadLeaveTypesAdmin()
			]);
			await loadMonthlyReport();
		} else {
			await Promise.all([loadLeaves(), loadLeaveTypes()]);
		}
	}

	$effect(() => {
		if (isLoggedIn && currentUser) {
			loadEverythingForRole();
		}
	});

	const pendingLeavesCount = $derived(
		Array.isArray(leaves) ? leaves.filter((l) => l.status === 'pending').length : 0
	);
</script>

<!-- ================= MODAL LOGIN (terhubung ke API) ================= -->
{#if !isLoggedIn}
	<div class="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-6 text-center text-white space-y-2 border-b-4 border-amber-400">
				<div class="w-12 h-12 bg-blue-800 rounded-xl mx-auto flex items-center justify-center text-2xl font-black text-amber-400 shadow-inner">
					🏫
				</div>
				<h2 class="text-xl font-black tracking-wide">SIM-ABSENSI GURU</h2>
				<p class="text-xs text-blue-200">Masuk sebagai Admin atau Guru (akun dari database)</p>
			</div>

			<form onsubmit={handleLogin} class="p-6 space-y-4">
				{#if loginError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs font-semibold">
						{loginError}
					</div>
				{/if}

				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">NIP</label>
					<input type="text" bind:value={loginInput.nip} placeholder="Contoh: 198000000001" required class="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Password</label>
					<input type="password" bind:value={loginInput.password} required class="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>

				<div class="pt-2">
					<button type="submit" disabled={loginLoading} class="w-full py-3 bg-blue-900 text-white rounded-xl text-sm font-bold cursor-pointer border-0 hover:bg-blue-950 transition shadow-md disabled:opacity-50">
						{loginLoading ? 'Memproses...' : 'Masuk ke Portal 🚀'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= DASHBOARD UTAMA ================= -->
{#if isLoggedIn && currentUser}
<div class="min-h-screen bg-slate-100 text-slate-800 font-sans">
	<header class="bg-blue-900 text-white shadow-md border-b-4 border-amber-400">
		<div class="max-w-7xl mx-auto px-6 py-3.5 flex justify-between items-center">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center text-xl font-black text-amber-400 border border-blue-700 shadow-inner">
					🏫
				</div>
				<div>
					<h1 class="text-lg font-bold tracking-wide leading-tight">SIM-ABSENSI GURU</h1>
					<p class="text-xs text-blue-200">Sistem Presensi Mengajar berbasis QR Code</p>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<div class="text-right hidden sm:block">
					<p class="text-sm font-bold text-amber-300 leading-tight">{currentUser.name}</p>
					<p class="text-xs text-blue-200">
						{currentUser.role === 'admin' ? '👑 Admin' : '👨‍🏫 Guru Pengajar'}
					</p>
				</div>
				<button
					type="button"
					title="Ubah foto profil"
					onclick={openModalFoto}
					class="w-9 h-9 bg-amber-400 text-blue-950 font-black rounded-full flex items-center justify-center text-xs shadow border-2 border-white cursor-pointer hover:opacity-90 overflow-hidden">
					{#if currentUser.photo_url}
						<img src={currentUser.photo_url} alt="Foto profil" class="w-full h-full object-cover" />
					{:else}
						{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'G'}
					{/if}
				</button>
				<button
					type="button"
					title="Keluar"
					onclick={handleLogout}
					class="w-9 h-9 bg-slate-100 text-slate-600 font-black rounded-full flex items-center justify-center text-sm shadow border-2 border-white cursor-pointer hover:bg-slate-200">
					⏻
				</button>
			</div>
		</div>
	</header>

	{#if globalError}
		<div class="max-w-7xl mx-auto px-6 pt-4">
			<div class="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-sm font-semibold flex justify-between items-center">
				<span>⚠️ {globalError}</span>
				<button type="button" onclick={() => (globalError = '')} class="border-0 bg-transparent cursor-pointer font-bold">✕</button>
			</div>
		</div>
	{/if}

	<div class="max-w-7xl mx-auto px-6 py-6 flex gap-6">
		<aside class="w-64 flex-shrink-0">
			<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
				<div class="bg-slate-50 px-4 py-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
					Menu {currentUser.role === 'admin' ? 'Administrator' : 'Guru'}
				</div>
				<nav class="p-2 space-y-1">
					<button type="button" onclick={() => (activeTab = 'dashboard')}
						class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'dashboard' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
						<span>📊</span> Dashboard
					</button>

					{#if currentUser.role === 'admin'}
						<button type="button" onclick={() => (activeTab = 'guru')}
							class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'guru' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
							<span>👨‍🏫</span> Data Master Guru
						</button>

						<button type="button" onclick={() => (activeTab = 'ruangan')}
							class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'ruangan' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
							<span>🏫</span> Data Ruangan & QR
						</button>

						<button type="button" onclick={() => (activeTab = 'jadwal')}
							class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'jadwal' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
							<span>📅</span> Jadwal Mengajar
						</button>

						<button type="button" onclick={() => (activeTab = 'jenis-cuti')}
							class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'jenis-cuti' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
							<span>🗂️</span> Master Data Cuti/Izin
						</button>
					{/if}

					<button type="button" onclick={() => (activeTab = 'cuti')}
						class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'cuti' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
						<div class="flex items-center gap-3">
							<span>✉️</span> {currentUser.role === 'admin' ? 'Persetujuan Cuti' : 'Pengajuan Cuti / Izin'}
						</div>
						{#if currentUser.role === 'admin' && pendingLeavesCount > 0}
							<span class="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{pendingLeavesCount}</span>
						{/if}
					</button>

					{#if currentUser.role === 'admin'}
						<button type="button" onclick={() => (activeTab = 'laporan')}
							class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border-0 {activeTab === 'laporan' ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-800' : 'text-slate-600 hover:bg-slate-50'}">
							<span>📈</span> Laporan Rekap
						</button>
					{/if}
				</nav>
			</div>
		</aside>

		<main class="flex-1 space-y-6">

			<!-- TAB: DASHBOARD -->
			{#if activeTab === 'dashboard'}
				<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
					<div>
						<h2 class="text-xl font-bold text-slate-800">Selamat Datang, {currentUser.name}! 👋</h2>
						<p class="text-slate-500 text-sm mt-0.5">
							{currentUser.role === 'admin'
								? 'Portal pusat monitoring presensi mengajar guru dan pengelolaan QR ruangan.'
								: 'Portal guru untuk melihat riwayat presensi dan mengajukan cuti.'}
						</p>
					</div>
				</div>

				{#if currentUser.role === 'admin'}
					<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-800">
							<p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Guru</p>
							<p class="text-2xl font-black text-slate-800 mt-2">{teachers.length} Guru</p>
						</div>
						<div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-600">
							<p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ruangan Kelas</p>
							<p class="text-2xl font-black text-slate-800 mt-2">{rooms.length} Ruang</p>
						</div>
						<div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600">
							<p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Hadir Hari Ini</p>
							<p class="text-2xl font-black text-emerald-600 mt-2">{todayHistory.length} Sesi</p>
						</div>
						<div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-amber-500">
							<p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pengajuan Cuti</p>
							<p class="text-2xl font-black text-amber-600 mt-2">{pendingLeavesCount} Berkas</p>
						</div>
					</div>

					<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
						<div class="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
							<h3 class="font-bold text-slate-800 text-base">Monitoring Presensi Hari Ini</h3>
							<button type="button" onclick={loadTodayHistory}
								class="bg-slate-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-slate-800 transition shadow-sm">
								🔄 Refresh
							</button>
						</div>
						<div class="p-6">
							{#if todayLoading}
								<p class="text-sm text-slate-400">Memuat...</p>
							{:else if todayHistory.length === 0}
								<p class="text-sm text-slate-400">Belum ada guru yang scan hari ini. Presensi masuk lewat aplikasi Flutter guru.</p>
							{:else}
								<table class="w-full text-left text-sm border-collapse">
									<thead>
										<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
											<th class="py-3 px-4">Nama Guru</th>
											<th class="py-3 px-4">Ruangan</th>
											<th class="py-3 px-4">Scan Masuk</th>
											<th class="py-3 px-4">Scan Keluar</th>
											<th class="py-3 px-4">Status</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100">
										{#each todayHistory as row}
											<tr class="hover:bg-slate-50">
												<td class="py-3.5 px-4 font-semibold text-slate-800">
													{row.teacher_name}{#if row.substitute_name} <span class="text-xs text-amber-600">(digantikan {row.substitute_name})</span>{/if}
												</td>
												<td class="py-3.5 px-4 text-slate-600">{row.room_name ?? '-'}</td>
												<td class="py-3.5 px-4 text-slate-600 font-mono text-xs">{row.clock_in ?? '-'}</td>
												<td class="py-3.5 px-4 text-slate-600 font-mono text-xs">{row.clock_out ?? '-'}</td>
												<td class="py-3.5 px-4">
													<span class="px-3 py-1 rounded-full text-xs font-bold inline-block
														{row.status === 'tuntas' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
														 row.status === 'tidak_tuntas' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
														 'bg-slate-100 text-slate-700 border border-slate-200'}">
														{row.status}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					</div>
				{:else}
					<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
						<p class="text-sm text-slate-500">Gunakan aplikasi Flutter untuk melakukan scan absen. Di sini kamu bisa mengajukan cuti/izin lewat menu di samping.</p>
					</div>
				{/if}

			<!-- TAB: DATA GURU -->
			{:else if activeTab === 'guru' && currentUser.role === 'admin'}
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<div class="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
						<div>
							<h2 class="text-lg font-bold text-slate-800">Data Master Guru</h2>
							<p class="text-xs text-slate-500">Daftar tenaga pengajar terdaftar di sistem (dari database).</p>
						</div>
						<button type="button" onclick={() => (showModalGuru = true)}
							class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition flex items-center gap-1.5 shadow-sm">
							<span>+</span> Tambah Guru Baru
						</button>
					</div>
					<div class="p-6">
						{#if teachersLoading}
							<p class="text-sm text-slate-400">Memuat...</p>
						{:else}
							<table class="w-full text-left text-sm border-collapse">
								<thead>
									<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
										<th class="py-3 px-4">Foto</th>
										<th class="py-3 px-4">NIP</th>
										<th class="py-3 px-4">Nama Lengkap</th>
										<th class="py-3 px-4">Email</th>
										<th class="py-3 px-4">Role</th>
										<th class="py-3 px-4">Status</th>
										<th class="py-3 px-4 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each teachers as g}
										<tr class="hover:bg-slate-50 {!g.is_active ? 'opacity-60' : ''}">
											<td class="py-3.5 px-4">
												<div class="w-9 h-9 rounded-full overflow-hidden bg-blue-100 text-blue-900 border border-slate-200 flex items-center justify-center text-xs font-black">
													{#if g.photo_url}
														<img src={g.photo_url} alt={g.name} class="w-full h-full object-cover" />
													{:else}
														{g.name ? g.name.charAt(0).toUpperCase() : '?'}
													{/if}
												</div>
											</td>
											<td class="py-3.5 px-4 font-mono text-slate-600 font-semibold">{g.nip}</td>
											<td class="py-3.5 px-4 font-bold text-slate-800">{g.name}</td>
											<td class="py-3.5 px-4 text-slate-600">{g.email ?? '-'}</td>
											<td class="py-3.5 px-4 text-slate-600">{roleLabel(g.role)}</td>
											<td class="py-3.5 px-4">
												{#if g.is_active}
													<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
														<span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Aktif
													</span>
												{:else}
													<span class="inline-flex items-center gap-1 bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full text-[11px] font-bold">
														<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
													</span>
												{/if}
											</td>
											<td class="py-3.5 px-4 text-right">
												<div class="flex justify-end gap-2">
													<button type="button" onclick={() => openEditGuru(g)}
														class="bg-slate-200 text-slate-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-slate-300 transition">
														✏️ Edit
													</button>
													{#if g.is_active}
														<button type="button" onclick={() => handleDeleteGuru(g)}
															class="bg-rose-100 text-rose-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-rose-200 transition">
															🚫 Nonaktifkan
														</button>
													{:else}
														<button type="button" onclick={() => handleActivateGuru(g)}
															class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-emerald-200 transition">
															✅ Aktifkan
														</button>
													{/if}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

			<!-- TAB: DATA RUANGAN & QR -->
			{:else if activeTab === 'ruangan' && currentUser.role === 'admin'}
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<div class="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
						<div>
							<h2 class="text-lg font-bold text-slate-800">Data Ruangan Kelas & QR Code</h2>
							<p class="text-xs text-slate-500">Kelola ruangan dan cetak stiker QR Code. QR tidak berubah sendiri — hanya berganti kalau Anda menekan "Refresh Sekarang".</p>
						</div>
						<button type="button" onclick={() => (showModalRuangan = true)}
							class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition flex items-center gap-1.5 shadow-sm">
							<span>+</span> Tambah Ruangan
						</button>
					</div>
					<div class="p-6">
						{#if roomsLoading}
							<p class="text-sm text-slate-400">Memuat...</p>
						{:else}
							<table class="w-full text-left text-sm border-collapse">
								<thead>
									<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
										<th class="py-3 px-4">
											Kode QR
											<span class="block text-[9px] font-normal normal-case text-slate-400">(tetap, sampai di-refresh manual)</span>
										</th>
										<th class="py-3 px-4">Nama Ruangan</th>
										<th class="py-3 px-4 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each rooms as r}
										<tr class="hover:bg-slate-50">
											<td class="py-3.5 px-4 font-mono font-bold text-blue-900">{r.qr_string}</td>
											<td class="py-3.5 px-4 font-semibold text-slate-800">{r.name}</td>
											<td class="py-3.5 px-4 text-right">
												<div class="flex justify-end gap-2">
													<button type="button" onclick={() => openQRModal(r)}
														class="bg-emerald-700 text-white px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer border-0 hover:bg-emerald-800 transition inline-flex items-center gap-1 shadow-sm">
														📱 Lihat / Print QR
													</button>
													<button type="button" onclick={() => openEditRuangan(r)}
														class="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border-0 hover:bg-slate-300 transition">
														✏️ Edit
													</button>
													<button type="button" onclick={() => handleDeleteRuangan(r)}
														class="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border-0 hover:bg-rose-200 transition">
														🗑️
													</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

			<!-- TAB: JADWAL MENGAJAR -->
			{:else if activeTab === 'jadwal' && currentUser.role === 'admin'}
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<div class="p-6 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
						<div>
							<h2 class="text-lg font-bold text-slate-800">Jadwal Mengajar Guru</h2>
							<p class="text-xs text-slate-500">Jadwal per guru, ruangan, hari, dan Jam Pelajaran (JP) target. Isi blok: Ruangan - Mapel - Guru.</p>
						</div>
						<div class="flex items-center gap-2 flex-wrap">
							<div class="relative">
								<button type="button" onclick={openMonthPicker}
									class="bg-emerald-700 text-white pl-3.5 pr-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-emerald-800 transition flex items-center gap-1.5">
									{monthName(scheduleMonth)} {scheduleYear}
									<span class="text-[10px]">▾</span>
								</button>

								{#if showMonthPicker}
									<!-- Backdrop transparan buat nutup popup kalau klik di luar -->
									<button type="button" aria-label="Tutup pemilih bulan" onclick={() => (showMonthPicker = false)}
										class="fixed inset-0 z-40 bg-transparent border-0 cursor-default p-0"></button>

									<div class="absolute left-0 top-full mt-2 z-50 w-64 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4">
										<div class="flex items-center justify-between mb-3">
											<p class="font-bold text-base">{pickerYear}</p>
											<div class="flex flex-col -my-1">
												<button type="button" onclick={() => (pickerYear += 1)}
													class="text-slate-300 hover:text-white bg-transparent border-0 cursor-pointer px-1 leading-none text-xs">▲</button>
												<button type="button" onclick={() => (pickerYear -= 1)}
													class="text-slate-300 hover:text-white bg-transparent border-0 cursor-pointer px-1 leading-none text-xs">▼</button>
											</div>
										</div>
										<div class="grid grid-cols-3 gap-2">
											{#each MONTH_ABBR as abbr, idx}
												{@const m = idx + 1}
												{@const isSelected = m === scheduleMonth && pickerYear === scheduleYear}
												{@const isCurrent = m === now.getMonth() + 1 && pickerYear === now.getFullYear()}
												<button
													type="button"
													onclick={() => selectPeriod(m, pickerYear)}
													class="relative rounded-full py-2 text-xs font-semibold border-0 cursor-pointer transition
														{isSelected ? 'bg-purple-500 text-white' : 'bg-transparent text-slate-200 hover:bg-slate-800'}
														{isCurrent && !isSelected ? 'ring-1 ring-slate-500' : ''}"
												>
													{abbr}
													{#if periodHasData(m, pickerYear)}
														<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full {isSelected ? 'bg-white' : 'bg-emerald-400'}"></span>
													{/if}
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</div>
							<div class="relative">
								<select bind:value={filterTeacherId}
									class="appearance-none bg-blue-900 text-white pl-3.5 pr-7 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition">
									<option value="">Guru ▾ (Semua)</option>
									{#each teachers.filter((t) => t.role === 'guru') as t}
										<option value={t.id}>{t.name}</option>
									{/each}
								</select>
								<span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white text-[10px]">▾</span>
							</div>
							<div class="relative">
								<select bind:value={filterRoomId}
									class="appearance-none bg-blue-900 text-white pl-3.5 pr-7 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition">
									<option value="">Room ▾ (Semua)</option>
									{#each rooms as r}
										<option value={r.id}>{r.name}</option>
									{/each}
								</select>
								<span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white text-[10px]">▾</span>
							</div>
							<button type="button" onclick={openAddJadwal}
								class="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-slate-900 transition flex items-center gap-1.5 shadow-sm">
								<span>+</span> Tambah Jadwal
							</button>
						</div>
					</div>
					<div class="px-6 pt-3 -mb-2">
						<p class="text-[11px] text-slate-400">
							📅 Menampilkan jadwal periode <b class="text-slate-500">{monthName(scheduleMonth)} {scheduleYear}</b>. Jadwal terikat per bulan — susunan bisa berbeda tiap bulan, riwayat bulan lalu tetap tersimpan & bisa dibuka lagi lewat filter ini.
						</p>
					</div>
					<div class="p-6">
						{#if schedulesLoading}
							<p class="text-sm text-slate-400">Memuat...</p>
						{:else if filteredSchedules.length === 0}
							<p class="text-sm text-slate-400">Tidak ada jadwal yang cocok dengan filter ini.</p>
						{:else}
							<div class="overflow-x-auto pb-2">
								<div
									class="grid text-xs border border-slate-200 rounded-lg overflow-hidden min-w-[760px]"
									style="grid-template-columns: 64px repeat(7, minmax(104px, 1fr)); grid-template-rows: 36px repeat({gridHourRange.length}, 52px);"
								>
									<!-- Header -->
									<div class="bg-slate-100 border-b border-r border-slate-200 flex items-center justify-center font-bold text-slate-500" style="grid-row:1; grid-column:1;">Jam</div>
									{#each DAY_NAMES.slice(1) as dayName, dayIdx}
										<div class="bg-slate-100 border-b border-r border-slate-200 last:border-r-0 flex items-center justify-center font-bold text-slate-600" style="grid-row:1; grid-column:{dayIdx + 2};">
											{dayName}
										</div>
									{/each}

									<!-- Sel kosong (garis grid per jam) -->
									{#each gridHourRange as hour, rowIdx}
										<div class="border-b border-r border-slate-200 flex items-start justify-center pt-1 font-bold text-slate-400 bg-slate-50/60" style="grid-row:{rowIdx + 2}; grid-column:1;">
											{hour}
										</div>
										{#each Array(7) as _, dayIdx}
											<div class="border-b border-r border-slate-100 last:border-r-0" style="grid-row:{rowIdx + 2}; grid-column:{dayIdx + 2};"></div>
										{/each}
									{/each}

									<!-- Blok jadwal -->
									{#each filteredSchedules as s (s.id)}
										{@const startH = Math.floor(timeToHourFloat(s.start_time))}
										{@const endH = Math.max(startH + 1, Math.ceil(timeToHourFloat(s.end_time)))}
										{@const rowIdx = gridHourRange.indexOf(startH)}
										{@const rowSpan = Math.min(endH, gridHourRange[gridHourRange.length - 1] + 1) - startH}
										{@const color = teacherColor(s.teacher_id)}
										{#if rowIdx >= 0}
											<button
												type="button"
												onclick={() => openEditJadwal(s)}
												title="{s.room_name} - {s.subject || '-'} - {s.teacher_name} ({s.start_time}-{s.end_time}, {s.target_jp} JP)"
												class="{color.bg} text-white rounded-md m-0.5 p-1.5 text-left text-[10px] leading-tight overflow-hidden cursor-pointer hover:opacity-90 transition border-0 flex flex-col"
												style="grid-row: {rowIdx + 2} / span {rowSpan}; grid-column: {s.day_of_week + 1};"
											>
												<span class="font-bold truncate">{s.room_name}</span>
												<span class="truncate opacity-90">{s.subject || '-'}</span>
												<span class="truncate opacity-90">{s.teacher_name}</span>
											</button>
										{/if}
									{/each}
								</div>
							</div>

							<!-- Legend: total JP mengajar per guru yang tampil di grid ini -->
							{#if teacherLegend.length > 0}
								<div class="flex flex-wrap gap-2 mt-5">
									{#each teacherLegend as t}
										<span class="{teacherColor(t.teacher_id).bg} text-white text-xs font-bold px-3 py-1.5 rounded-lg">
											{t.name} = {t.jp} JP
										</span>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				</div>

			<!-- TAB: MASTER DATA JENIS CUTI/IZIN -->
			{:else if activeTab === 'jenis-cuti' && currentUser.role === 'admin'}
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<div class="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
						<div>
							<h2 class="text-lg font-bold text-slate-800">Master Data Jenis Cuti/Izin</h2>
							<p class="text-xs text-slate-500">Kelola pilihan jenis cuti/izin yang muncul di form pengajuan guru — tidak lagi hardcode di aplikasi.</p>
						</div>
						<button type="button" onclick={() => (showModalLeaveType = true)}
							class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition flex items-center gap-1.5 shadow-sm">
							<span>+</span> Tambah Jenis Baru
						</button>
					</div>
					<div class="p-6">
						{#if leaveTypesAdminLoading}
							<p class="text-sm text-slate-400">Memuat...</p>
						{:else if leaveTypesAdmin.length === 0}
							<p class="text-sm text-slate-400">Belum ada jenis cuti/izin. Tambahkan minimal satu supaya guru bisa mengajukan cuti.</p>
						{:else}
							<table class="w-full text-left text-sm border-collapse">
								<thead>
									<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
										<th class="py-3 px-4">Kode</th>
										<th class="py-3 px-4">Nama Jenis</th>
										<th class="py-3 px-4 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each leaveTypesAdmin as lt}
										<tr class="hover:bg-slate-50">
											<td class="py-3.5 px-4 font-mono text-slate-500">{lt.code}</td>
											<td class="py-3.5 px-4 font-bold text-slate-800">{lt.label}</td>
											<td class="py-3.5 px-4 text-right">
												<div class="flex justify-end gap-2">
													<button type="button" onclick={() => openEditLeaveType(lt)}
														class="bg-slate-200 text-slate-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-slate-300 transition">
														✏️ Edit
													</button>
													<button type="button" onclick={() => handleDeleteLeaveType(lt)}
														class="bg-rose-100 text-rose-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-rose-200 transition">
														🗑️ Hapus
													</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

			<!-- TAB: CUTI (SUDAH DIPERBAIKI UNTUK GURU & ADMIN) -->
			{:else if activeTab === 'cuti'}
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<div class="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
						<div>
							<h2 class="text-lg font-bold text-slate-800">
								{currentUser.role === 'admin' ? 'Persetujuan Cuti & Izin Mengajar' : 'Daftar Pengajuan Cuti / Izin Anda'}
							</h2>
							<p class="text-xs text-slate-500">
								{currentUser.role === 'admin' ? 'Proses permohonan izin dari guru.' : 'Riwayat dan pengajuan izin tidak mengajar.'}
							</p>
						</div>

						{#if currentUser.role !== 'admin'}
							<button type="button" onclick={() => (showModalAjukanCuti = true)}
								class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition flex items-center gap-1.5 shadow-sm">
								<span>📝</span> + Ajukan Cuti / Izin Baru
							</button>
						{:else}
							<button type="button" onclick={openAjukanCutiAdmin}
								class="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-sm">
								<span>✅</span> + Bantu Ajukan Cuti Guru (Auto-Setuju)
							</button>
						{/if}
					</div>

					<div class="p-6">
						{#if leavesLoading}
							<p class="text-sm text-slate-400">Memuat data cuti...</p>
						{:else if !leaves || leaves.length === 0}
							<p class="text-sm text-slate-400">Belum ada pengajuan cuti.</p>
						{:else}
							<table class="w-full text-left text-sm border-collapse">
								<thead>
									<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
										{#if currentUser.role === 'admin'}
											<th class="py-3 px-4">Nama Guru</th>
										{/if}
										<th class="py-3 px-4">Tanggal</th>
										<th class="py-3 px-4">Jenis</th>
										<th class="py-3 px-4">Alasan</th>
										<th class="py-3 px-4 text-center">
											{currentUser.role === 'admin' ? 'Tindakan' : 'Status'}
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each leaves as c}
										<tr class="hover:bg-slate-50">
											{#if currentUser.role === 'admin'}
												<td class="py-3.5 px-4 font-bold text-slate-800">{c.teacher_name ?? '-'}</td>
											{/if}
											<td class="py-3.5 px-4 text-slate-600">{c.start_date} s/d {c.end_date}</td>
											<td class="py-3.5 px-4 text-slate-600">{leaveTypeLabel(c.leave_type)}</td>
											<td class="py-3.5 px-4 text-slate-600">{c.reason ?? '-'}</td>
											<td class="py-3.5 px-4 text-center">
												{#if currentUser.role === 'admin' && c.status === 'pending'}
													<div class="flex justify-center gap-2">
														<button type="button" onclick={() => handleApprove(c.id)}
															class="bg-emerald-700 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-emerald-800 shadow-sm transition">
															Setujui
														</button>
														<button type="button" onclick={() => openTolakCuti(c)}
															class="bg-rose-700 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-rose-800 shadow-sm transition">
															Tolak
														</button>
													</div>
												{:else if c.status === 'approved'}
													<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold inline-block">✅ Disetujui</span>
												{:else if c.status === 'rejected'}
													<span class="bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded-full text-xs font-bold inline-block">❌ Ditolak</span>
													{#if c.rejection_reason}
														<p class="text-[11px] text-rose-600 mt-1.5 max-w-[220px] mx-auto text-left leading-snug">
															<span class="font-bold">Alasan:</span> {c.rejection_reason}
														</p>
													{/if}
												{:else}
													<span class="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold inline-block">⏳ Menunggu</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

			<!-- TAB: LAPORAN REKAP -->
			{:else if activeTab === 'laporan' && currentUser.role === 'admin'}
				<div class="space-y-4">
					<!-- Sub-nav laporan -->
					<div class="flex flex-wrap gap-2">
						<button type="button" onclick={() => (reportSubTab = 'bulanan')}
							class="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-0 transition {reportSubTab === 'bulanan' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
							📊 Rekap Bulanan
						</button>
						<button type="button" onclick={() => { reportSubTab = 'harian'; if (!dailyReport) loadDailyReport(); }}
							class="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-0 transition {reportSubTab === 'harian' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
							📅 Absensi Harian
						</button>
						<button type="button" onclick={() => { reportSubTab = 'pengganti'; if (!subReport) loadSubstituteReport(); }}
							class="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-0 transition {reportSubTab === 'pengganti' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
							🔁 Rekap Guru Pengganti
						</button>
						<button type="button" onclick={() => (reportSubTab = 'tahunan')}
							class="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-0 transition {reportSubTab === 'tahunan' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
							📆 Tahunan / Individu
						</button>
					</div>

					<!-- ===== 6a. REKAP BULANAN ===== -->
					{#if reportSubTab === 'bulanan'}
						<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
							<div class="p-6 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
								<div>
									<h2 class="text-lg font-bold text-slate-800">Laporan Rekap Jam Mengajar</h2>
									<p class="text-xs text-slate-500">Perbandingan JP target vs aktual per guru, plus info sebagai/digantikan guru pengganti & jumlah cuti bulan ini.</p>
								</div>
								<div class="flex items-center gap-2 flex-wrap">
									<select bind:value={reportMonth} class="border border-slate-300 rounded-lg p-2 text-sm bg-white">
										{#each Array(12) as _, i}
											<option value={i + 1}>{new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}</option>
										{/each}
									</select>
									<input type="number" bind:value={reportYear} class="border border-slate-300 rounded-lg p-2 text-sm w-24" />
									<button type="button" onclick={loadMonthlyReport}
										class="bg-slate-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-slate-800 transition">
										Tampilkan
									</button>
									<button type="button" onclick={exportReportCSV} disabled={monthlyRecap.length === 0}
										class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 flex items-center gap-1.5 shadow-sm disabled:opacity-50">
										📥 Export CSV
									</button>
								</div>
							</div>
							<div class="p-6 overflow-x-auto">
								{#if reportLoading}
									<p class="text-sm text-slate-400">Memuat...</p>
								{:else if monthlyRecap.length === 0}
									<p class="text-sm text-slate-400">Tidak ada data untuk periode ini.</p>
								{:else}
									<table class="w-full text-left text-sm border-collapse">
										<thead>
											<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
												<th class="py-3 px-4">Nama Guru</th>
												<th class="py-3 px-4 text-center">Total Sesi</th>
												<th class="py-3 px-4 text-center">Tuntas</th>
												<th class="py-3 px-4 text-center">Tidak Tuntas</th>
												<th class="py-3 px-4 text-center">JP Aktual</th>
												<th class="py-3 px-4 text-center">JP Target</th>
												<th class="py-3 px-4 text-center">🔁 Sbg Pengganti</th>
												<th class="py-3 px-4 text-center">🔁 Digantikan</th>
												<th class="py-3 px-4 text-center">🗓️ Cuti</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each monthlyRecap as row}
												<tr class="hover:bg-slate-50">
													<td class="py-3.5 px-4 font-bold text-slate-800">
														{row.teacher_name}
														{#if row.teacher_role === 'guru_pengganti'}
															<span class="ml-1.5 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle">Guru Pengganti</span>
														{/if}
													</td>
													<td class="py-3.5 px-4 text-center text-slate-600">{row.total_sesi}</td>
													<td class="py-3.5 px-4 text-center text-emerald-700 font-semibold">{row.sesi_tuntas}</td>
													<td class="py-3.5 px-4 text-center text-rose-700 font-semibold">{row.sesi_tidak_tuntas}</td>
													<td class="py-3.5 px-4 text-center font-mono">{row.total_jp_aktual}</td>
													<td class="py-3.5 px-4 text-center font-mono">{row.total_jp_target}</td>
													<td class="py-3.5 px-4 text-center">
														{#if row.sesi_sebagai_pengganti > 0}
															<span class="text-purple-700 font-bold">{row.sesi_sebagai_pengganti}x</span>
															<span class="block text-[10px] text-slate-400 font-mono">{row.jp_sebagai_pengganti} JP</span>
														{:else}
															<span class="text-slate-300">-</span>
														{/if}
													</td>
													<td class="py-3.5 px-4 text-center">
														{#if row.sesi_digantikan > 0}
															<span class="text-amber-700 font-bold">{row.sesi_digantikan}x</span>
														{:else}
															<span class="text-slate-300">-</span>
														{/if}
													</td>
													<td class="py-3.5 px-4 text-center">
														{#if row.jumlah_cuti > 0}
															<span class="text-blue-700 font-bold">{row.jumlah_cuti}x</span>
														{:else}
															<span class="text-slate-300">-</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							</div>
						</div>

					<!-- ===== 6b. ABSENSI HARIAN ===== -->
					{:else if reportSubTab === 'harian'}
						<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
							<div class="p-6 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
								<div>
									<h2 class="text-lg font-bold text-slate-800">Laporan Absensi Harian</h2>
									<p class="text-xs text-slate-500">Rekap per tanggal, dari tanggal 1 s/d hari ini. Tanggal mulai bisa digeser, asal masih di bulan yang sama.</p>
								</div>
								<div class="flex items-center gap-2 flex-wrap">
									<select bind:value={dailyMonth} class="border border-slate-300 rounded-lg p-2 text-sm bg-white">
										{#each Array(12) as _, i}
											<option value={i + 1}>{new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}</option>
										{/each}
									</select>
									<input type="number" bind:value={dailyYear} class="border border-slate-300 rounded-lg p-2 text-sm w-24" />
									<div class="flex items-center gap-1">
										<span class="text-xs text-slate-500 font-semibold">Mulai tgl</span>
										<input type="number" min="1" max={daysInSelectedDailyMonth()} bind:value={dailyStartDay}
											class="border border-slate-300 rounded-lg p-2 text-sm w-16" />
									</div>
									<button type="button" onclick={loadDailyReport}
										class="bg-slate-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-slate-800 transition">
										Tampilkan
									</button>
									<button type="button" onclick={exportDailyReportCSV} disabled={!dailyReport || dailyReport.days.length === 0}
										class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 flex items-center gap-1.5 shadow-sm disabled:opacity-50">
										📥 Export CSV
									</button>
								</div>
							</div>
							<div class="p-6 overflow-x-auto">
								{#if dailyLoading}
									<p class="text-sm text-slate-400">Memuat...</p>
								{:else if dailyError}
									<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{dailyError}</div>
								{:else if !dailyReport || dailyReport.days.length === 0}
									<p class="text-sm text-slate-400">Tidak ada data untuk rentang ini.</p>
								{:else}
									<p class="text-xs text-slate-500 mb-3 font-semibold">
										Menampilkan {dailyReport.start_date} s/d {dailyReport.end_date}
									</p>
									<table class="w-full text-left text-sm border-collapse">
										<thead>
											<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
												<th class="py-3 px-4">Tanggal</th>
												<th class="py-3 px-4 text-center">Total Sesi</th>
												<th class="py-3 px-4 text-center">Tuntas</th>
												<th class="py-3 px-4 text-center">Tidak Tuntas</th>
												<th class="py-3 px-4 text-center">Berlangsung</th>
												<th class="py-3 px-4 text-center">Guru Hadir</th>
												<th class="py-3 px-4 text-center">Digantikan</th>
												<th class="py-3 px-4 text-center">JP Aktual</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each dailyReport.days as d}
												<tr class="hover:bg-slate-50 {d.total_sesi === 0 ? 'opacity-50' : ''}">
													<td class="py-3.5 px-4 font-bold text-slate-800">
														{new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
													</td>
													<td class="py-3.5 px-4 text-center text-slate-600">{d.total_sesi}</td>
													<td class="py-3.5 px-4 text-center text-emerald-700 font-semibold">{d.sesi_tuntas}</td>
													<td class="py-3.5 px-4 text-center text-rose-700 font-semibold">{d.sesi_tidak_tuntas}</td>
													<td class="py-3.5 px-4 text-center text-amber-700 font-semibold">{d.sesi_berlangsung}</td>
													<td class="py-3.5 px-4 text-center">{d.jumlah_guru_hadir}</td>
													<td class="py-3.5 px-4 text-center">{d.sesi_digantikan}</td>
													<td class="py-3.5 px-4 text-center font-mono">{d.total_jp_aktual}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							</div>
						</div>

					<!-- ===== 6c. REKAP GURU PENGGANTI ===== -->
					{:else if reportSubTab === 'pengganti'}
						<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
							<div class="p-6 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
								<div>
									<h2 class="text-lg font-bold text-slate-800">Rekap sebagai Guru Pengganti</h2>
									<p class="text-xs text-slate-500">Semua sesi inval (menggantikan guru lain). Tidak terikat target JP -- murni jumlah sesi & jam aktual mengajar.</p>
								</div>
								<div class="flex items-center gap-2 flex-wrap">
									<input type="date" bind:value={subStart} class="border border-slate-300 rounded-lg p-2 text-sm" />
									<span class="text-slate-400 text-xs">s/d</span>
									<input type="date" bind:value={subEnd} class="border border-slate-300 rounded-lg p-2 text-sm" />
									<select bind:value={subTeacherId} class="border border-slate-300 rounded-lg p-2 text-sm bg-white">
										<option value="">Semua Guru</option>
										{#each teachers as t}
											<option value={t.id}>{t.name}</option>
										{/each}
									</select>
									<button type="button" onclick={loadSubstituteReport}
										class="bg-slate-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-slate-800 transition">
										Tampilkan
									</button>
									<button type="button" onclick={exportSubstituteReportCSV} disabled={!subReport || subReport.sessions.length === 0}
										class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 flex items-center gap-1.5 shadow-sm disabled:opacity-50">
										📥 Export CSV
									</button>
								</div>
							</div>
							<div class="p-6 overflow-x-auto">
								{#if subLoading}
									<p class="text-sm text-slate-400">Memuat...</p>
								{:else if !subReport || subReport.sessions.length === 0}
									<p class="text-sm text-slate-400">Tidak ada sesi guru pengganti untuk rentang ini.</p>
								{:else}
									<div class="flex gap-4 mb-4">
										<div class="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
											<p class="text-[10px] uppercase font-bold text-purple-500">Total Sesi</p>
											<p class="text-lg font-black text-purple-800">{subReport.total_sesi}</p>
										</div>
										<div class="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
											<p class="text-[10px] uppercase font-bold text-purple-500">Total JP Aktual</p>
											<p class="text-lg font-black text-purple-800">{subReport.total_jp}</p>
										</div>
									</div>
									<table class="w-full text-left text-sm border-collapse">
										<thead>
											<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
												<th class="py-3 px-4">Tanggal</th>
												<th class="py-3 px-4">Guru Pengganti</th>
												<th class="py-3 px-4">Menggantikan</th>
												<th class="py-3 px-4">Ruangan</th>
												<th class="py-3 px-4 text-center">Jam Masuk</th>
												<th class="py-3 px-4 text-center">Jam Keluar</th>
												<th class="py-3 px-4 text-center">JP Aktual</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each subReport.sessions as s}
												<tr class="hover:bg-slate-50">
													<td class="py-3.5 px-4 text-slate-600">{s.date}</td>
													<td class="py-3.5 px-4 font-bold text-purple-800">{s.substitute_name}</td>
													<td class="py-3.5 px-4 text-slate-600">{s.original_teacher_name}</td>
													<td class="py-3.5 px-4 text-slate-600">{s.room_name ?? '-'}</td>
													<td class="py-3.5 px-4 text-center font-mono text-xs">{s.clock_in ? s.clock_in.slice(11, 16) : '-'}</td>
													<td class="py-3.5 px-4 text-center font-mono text-xs">{s.clock_out ? s.clock_out.slice(11, 16) : '-'}</td>
													<td class="py-3.5 px-4 text-center font-mono">{s.actual_jp}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							</div>
						</div>

					<!-- ===== 6d. TAHUNAN / INDIVIDU ===== -->
					{:else if reportSubTab === 'tahunan'}
						<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
							<div class="p-6 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
								<div>
									<h2 class="text-lg font-bold text-slate-800">Laporan Tahunan / Individu</h2>
									<p class="text-xs text-slate-500">Breakdown 12 bulan untuk 1 guru -- konsistensi kehadiran, jumlah cuti, dan aktivitas sebagai guru pengganti. Bisa diexport sebagai CSV individu.</p>
								</div>
								<div class="flex items-center gap-2 flex-wrap">
									<select bind:value={annualTeacherId} class="border border-slate-300 rounded-lg p-2 text-sm bg-white min-w-[160px]">
										<option value="">Pilih guru...</option>
										{#each teachers as t}
											<option value={t.id}>{t.name}</option>
										{/each}
									</select>
									<input type="number" bind:value={annualYear} class="border border-slate-300 rounded-lg p-2 text-sm w-24" />
									<button type="button" onclick={loadAnnualReport} disabled={!annualTeacherId}
										class="bg-slate-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-slate-800 transition disabled:opacity-50">
										Tampilkan
									</button>
									<button type="button" onclick={exportAnnualReportCSV} disabled={!annualReport}
										class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 flex items-center gap-1.5 shadow-sm disabled:opacity-50">
										📥 Export CSV Individu
									</button>
								</div>
							</div>
							<div class="p-6 overflow-x-auto">
								{#if annualLoading}
									<p class="text-sm text-slate-400">Memuat...</p>
								{:else if !annualTeacherId}
									<p class="text-sm text-slate-400">Pilih guru terlebih dahulu untuk melihat rekap tahunannya.</p>
								{:else if !annualReport}
									<p class="text-sm text-slate-400">Klik "Tampilkan" untuk memuat rekap.</p>
								{:else}
									<div class="flex flex-wrap items-center justify-between gap-3 mb-4">
										<div>
											<h3 class="font-bold text-slate-800">
												{annualReport.teacher_name}
												{#if annualReport.teacher_role === 'guru_pengganti'}
													<span class="ml-1.5 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle">Guru Pengganti</span>
												{/if}
											</h3>
											<p class="text-xs text-slate-500">Tahun {annualReport.year}</p>
										</div>
										{#if annualReport.konsisten_setahun}
											<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-full text-xs font-bold">✅ Konsisten selama setahun (tidak ada sesi tidak tuntas)</span>
										{:else}
											<span class="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-full text-xs font-bold">⚠️ Ada {annualReport.total_sesi_tidak_tuntas} sesi tidak tuntas sepanjang tahun</span>
										{/if}
									</div>

									<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
										<div class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
											<p class="text-[10px] uppercase font-bold text-slate-400">Total Sesi Jadwal Tetap</p>
											<p class="text-lg font-black text-slate-800">{annualReport.total_sesi}</p>
										</div>
										<div class="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
											<p class="text-[10px] uppercase font-bold text-purple-500">Sesi sbg Guru Pengganti</p>
											<p class="text-lg font-black text-purple-800">{annualReport.total_sesi_sebagai_pengganti}</p>
										</div>
										<div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
											<p class="text-[10px] uppercase font-bold text-blue-500">Jumlah Cuti Setahun</p>
											<p class="text-lg font-black text-blue-800">{annualReport.total_jumlah_cuti}x</p>
										</div>
										<div class="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
											<p class="text-[10px] uppercase font-bold text-emerald-600">Total JP Aktual</p>
											<p class="text-lg font-black text-emerald-800">{annualReport.total_jp_aktual + annualReport.total_jp_sebagai_pengganti}</p>
										</div>
									</div>

									<table class="w-full text-left text-sm border-collapse">
										<thead>
											<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
												<th class="py-3 px-4">Bulan</th>
												<th class="py-3 px-4 text-center">Sesi</th>
												<th class="py-3 px-4 text-center">Tuntas</th>
												<th class="py-3 px-4 text-center">Tdk Tuntas</th>
												<th class="py-3 px-4 text-center">JP Aktual</th>
												<th class="py-3 px-4 text-center">JP Target</th>
												<th class="py-3 px-4 text-center">Sbg Pengganti</th>
												<th class="py-3 px-4 text-center">Cuti</th>
												<th class="py-3 px-4 text-center">Konsisten</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each annualReport.months as m}
												<tr class="hover:bg-slate-50 {!m.has_data ? 'opacity-40' : ''}">
													<td class="py-3.5 px-4 font-bold text-slate-800">{m.month_name}</td>
													<td class="py-3.5 px-4 text-center text-slate-600">{m.total_sesi}</td>
													<td class="py-3.5 px-4 text-center text-emerald-700 font-semibold">{m.sesi_tuntas}</td>
													<td class="py-3.5 px-4 text-center text-rose-700 font-semibold">{m.sesi_tidak_tuntas}</td>
													<td class="py-3.5 px-4 text-center font-mono">{m.jp_aktual}</td>
													<td class="py-3.5 px-4 text-center font-mono">{m.jp_target}</td>
													<td class="py-3.5 px-4 text-center">
														{#if m.sesi_sebagai_pengganti > 0}
															<span class="text-purple-700 font-bold">{m.sesi_sebagai_pengganti}x</span>
														{:else}
															<span class="text-slate-300">-</span>
														{/if}
													</td>
													<td class="py-3.5 px-4 text-center">
														{#if m.jumlah_cuti > 0}
															<span class="text-blue-700 font-bold">{m.jumlah_cuti}x</span>
														{:else}
															<span class="text-slate-300">-</span>
														{/if}
													</td>
													<td class="py-3.5 px-4 text-center">
														{#if !m.has_data}
															<span class="text-slate-300">-</span>
														{:else if m.consistent}
															<span class="text-emerald-600">✅</span>
														{:else}
															<span class="text-rose-600">⚠️</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

		</main>
	</div>
</div>
{/if}

<!-- ================= MODAL CETAK QR CODE RUANGAN ================= -->
{#if showModalQR && selectedRoom}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 print:static print:bg-white print:p-0">
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 text-center print:shadow-none print:border-0 print:rounded-none print:max-w-full">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center print:hidden">
				<h3 class="font-bold text-base">Kartu QR Code Kelas</h3>
				<button type="button" onclick={closeQRModal} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<div class="p-6 space-y-4">
				<div id="qr-print-area" class="border-2 border-dashed border-slate-300 p-6 rounded-2xl bg-slate-50 space-y-3 print:border-0 print:bg-white">
					<p class="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
						{qrLoading && !qrCurrentString ? 'Memuat...' : qrCurrentString}
					</p>
					<h4 class="text-lg font-black text-blue-950">{selectedRoom.name}</h4>

					<div class="w-48 h-48 bg-white border-4 border-slate-900 rounded-2xl mx-auto p-2 flex items-center justify-center shadow-md relative print:shadow-none">
						{#if qrCurrentString}
							<img
								src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrCurrentString}`}
								alt="QR Code {selectedRoom.name}"
								class="w-full h-full object-contain rounded-lg transition-opacity {qrLoading ? 'opacity-60' : 'opacity-100'}" />
						{:else}
							<p class="text-xs text-slate-400">Memuat QR...</p>
						{/if}
					</div>

					{#if qrError}
						<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-lg text-xs font-semibold print:hidden">{qrError}</div>
					{/if}

					<p class="text-[11px] font-semibold text-slate-500">
						🕒 Terakhir di-refresh: {qrLastRotatedAt ? formatRotatedAt(qrLastRotatedAt) : '-'}
					</p>

					<p class="text-[10px] text-slate-500 font-medium print:hidden">
						QR ini tidak berubah sendiri — aman ditempel/dicetak di kelas. Kalau dicurigai tersebar, tekan "Refresh Sekarang" lalu cetak ulang stikernya.
					</p>
				</div>

				<div class="flex gap-2 print:hidden">
					<button type="button" onclick={closeQRModal} class="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border-0 cursor-pointer hover:bg-slate-300">
						Tutup
					</button>
					<button
						type="button"
						onclick={handlePrintQR}
						disabled={qrLoading || !qrCurrentString}
						class="flex-1 py-2.5 bg-blue-900 text-white rounded-xl text-xs font-bold border-0 cursor-pointer hover:bg-blue-950 shadow-md flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed">
						<span>🖨️</span> Print
					</button>
					<button
						type="button"
						onclick={handleRefreshQRNow}
						disabled={qrLoading}
						class="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold border-0 cursor-pointer hover:bg-emerald-800 shadow-md flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed">
						<span>🔄</span> Refresh Sekarang
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}


<!-- ================= MODAL PENGAJUAN CUTI GURU ================= -->
{#if showModalAjukanCuti}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Form Pengajuan Cuti / Izin Guru</h3>
				<button type="button" onclick={() => (showModalAjukanCuti = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleAjukanCuti} class="p-6 space-y-4">
				{#if cutiFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{cutiFormError}</div>
				{/if}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal Mulai</label>
						<input type="date" bind:value={newCuti.start_date} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
					</div>
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal Selesai</label>
						<input type="date" bind:value={newCuti.end_date} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
					</div>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Jenis</label>
					{#if leaveTypes.length === 0}
						<p class="text-xs text-rose-600 font-semibold">Belum ada jenis cuti/izin yang aktif. Hubungi admin untuk menambahkannya di Master Data Cuti/Izin.</p>
					{:else}
						<select bind:value={newCuti.leave_type} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none bg-white">
							{#each leaveTypes as lt}
								<option value={lt.code}>{lt.label}</option>
							{/each}
						</select>
					{/if}
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Alasan</label>
					<textarea bind:value={newCuti.reason} required rows="3" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none"></textarea>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalAjukanCuti = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Kirim Permohonan</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL BANTU AJUKAN CUTI GURU (ADMIN, AUTO-SETUJU) ================= -->
{#if showModalAjukanCutiAdmin}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-emerald-800 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Bantu Ajukan Cuti untuk Guru</h3>
				<button type="button" onclick={() => (showModalAjukanCutiAdmin = false)} class="text-emerald-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleAjukanCutiAdmin} class="p-6 space-y-4">
				<div class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-semibold">
					ℹ️ Cuti yang diajukan lewat form ini akan LANGSUNG berstatus <b>Disetujui</b> begitu disimpan -- tidak melalui alur persetujuan pending. Gunakan untuk kondisi darurat/mendadak yang sudah dikoordinasikan langsung dengan guru bersangkutan.
				</div>
				{#if cutiAdminFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{cutiAdminFormError}</div>
				{/if}

				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Guru</label>
					{#if teachers.length === 0}
						<p class="text-xs text-rose-600 font-semibold">Belum ada data guru. Tambahkan dulu di Data Master Guru.</p>
					{:else}
						<select bind:value={newCutiAdmin.teacher_id} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none bg-white">
							<option value="" disabled>Pilih guru...</option>
							{#each teachers as t}
								<option value={t.id}>{t.name}</option>
							{/each}
						</select>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal Mulai</label>
						<input type="date" bind:value={newCutiAdmin.start_date} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none" />
					</div>
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal Selesai</label>
						<input type="date" bind:value={newCutiAdmin.end_date} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none" />
					</div>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Jenis</label>
					{#if leaveTypesAdmin.length === 0 && leaveTypes.length === 0}
						<p class="text-xs text-rose-600 font-semibold">Belum ada jenis cuti/izin. Tambahkan dulu di Master Data Cuti/Izin.</p>
					{:else}
						<select bind:value={newCutiAdmin.leave_type} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none bg-white">
							{#each (leaveTypesAdmin.length > 0 ? leaveTypesAdmin : leaveTypes) as lt}
								<option value={lt.code}>{lt.label}</option>
							{/each}
						</select>
					{/if}
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Alasan</label>
					<textarea bind:value={newCutiAdmin.reason} required rows="3" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"></textarea>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalAjukanCutiAdmin = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-emerald-800 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-emerald-900">✅ Simpan & Setujui</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL UBAH FOTO PROFIL ================= -->
{#if showModalFoto}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Ubah Foto Profil</h3>
				<button type="button" onclick={() => (showModalFoto = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<div class="p-6 space-y-4">
				{#if fotoError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{fotoError}</div>
				{/if}

				<div class="flex justify-center">
					<div class="w-28 h-28 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-3xl font-black text-slate-400">
						{#if fotoPreview}
							<img src={fotoPreview} alt="Preview foto" class="w-full h-full object-cover" />
						{:else if currentUser?.photo_url}
							<img src={currentUser.photo_url} alt="Foto profil saat ini" class="w-full h-full object-cover" />
						{:else}
							{currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'G'}
						{/if}
					</div>
				</div>

				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Pilih Foto Baru</label>
					<input type="file" accept="image/png,image/jpeg,image/webp" onchange={handlePickFoto}
						class="w-full border border-slate-300 rounded-lg p-2 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-800 file:text-xs file:font-bold cursor-pointer" />
					<p class="text-[11px] text-slate-400 mt-1">JPEG, PNG, atau WEBP. Maksimal 2MB.</p>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalFoto = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="button" onclick={handleSaveFoto} disabled={fotoLoading || !fotoPreview}
						class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed">
						{fotoLoading ? 'Menyimpan...' : 'Simpan Foto'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ================= MODAL ALASAN PENOLAKAN CUTI (ADMIN) ================= -->
{#if showModalTolakCuti && tolakCutiTarget}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-rose-700 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Tolak Pengajuan Cuti / Izin</h3>
				<button type="button" onclick={() => (showModalTolakCuti = false)} class="text-rose-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleReject} class="p-6 space-y-4">
				{#if tolakCutiFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{tolakCutiFormError}</div>
				{/if}

				<div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
					<p><span class="font-bold text-slate-800">{tolakCutiTarget.teacher_name ?? 'Guru'}</span></p>
					<p>{tolakCutiTarget.start_date} s/d {tolakCutiTarget.end_date} &middot; <span>{leaveTypeLabel(tolakCutiTarget.leave_type)}</span></p>
				</div>

				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Alasan Penolakan</label>
					<textarea bind:value={tolakCutiReason} required rows="3" placeholder="Contoh: Jadwal mengajar pada tanggal tersebut belum ada guru pengganti"
						class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rose-700 focus:outline-none"></textarea>
					<p class="text-[11px] text-slate-400 mt-1">Alasan ini akan ditampilkan ke guru yang mengajukan.</p>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalTolakCuti = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" disabled={tolakCutiLoading}
						class="px-4 py-2 bg-rose-700 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-rose-800 disabled:opacity-60 disabled:cursor-not-allowed">
						{tolakCutiLoading ? 'Memproses...' : 'Tolak Pengajuan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL TAMBAH GURU ================= -->
{#if showModalGuru}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Form Isian Data Guru Baru</h3>
				<button type="button" onclick={() => (showModalGuru = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleAddGuru} class="p-6 space-y-4">
				{#if guruFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{guruFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">NIP</label>
					<input type="text" bind:value={newGuru.nip} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Lengkap</label>
					<input type="text" bind:value={newGuru.name} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Email</label>
					<input type="email" bind:value={newGuru.email} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Password Awal</label>
					<input type="text" bind:value={newGuru.password} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Role</label>
					<select bind:value={newGuru.role} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						<option value="guru">Guru</option>
						<option value="guru_pengganti">Guru Pengganti</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalGuru = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Data Guru</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL EDIT GURU ================= -->
{#if showModalEditGuru}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Edit Data Guru</h3>
				<button type="button" onclick={() => (showModalEditGuru = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleEditGuru} class="p-6 space-y-4">
				{#if editGuruFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{editGuruFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Lengkap</label>
					<input type="text" bind:value={editGuru.name} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Email</label>
					<input type="email" bind:value={editGuru.email} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Role</label>
					<select bind:value={editGuru.role} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						<option value="guru">Guru</option>
						<option value="guru_pengganti">Guru Pengganti</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalEditGuru = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Perubahan</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL TAMBAH RUANGAN ================= -->
{#if showModalRuangan}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Form Registrasi Ruangan</h3>
				<button type="button" onclick={() => (showModalRuangan = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleAddRuangan} class="p-6 space-y-4">
				{#if ruanganFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{ruanganFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Ruangan / Nama Kelas</label>
					<input type="text" bind:value={newRuanganName} placeholder="Contoh: Lab Komputer Jaringan" required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<p class="text-xs text-slate-400">Kode QR unik akan dibuat otomatis oleh server.</p>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalRuangan = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Ruangan</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL EDIT RUANGAN ================= -->
{#if showModalEditRuangan}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Edit Ruangan</h3>
				<button type="button" onclick={() => (showModalEditRuangan = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleEditRuangan} class="p-6 space-y-4">
				{#if editRuanganFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{editRuanganFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Ruangan / Nama Kelas</label>
					<input type="text" bind:value={editRuanganName} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<p class="text-xs text-slate-400">Kode QR tidak berubah saat nama ruangan diedit.</p>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalEditRuangan = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Perubahan</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL TAMBAH JENIS CUTI/IZIN ================= -->
{#if showModalLeaveType}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Tambah Jenis Cuti/Izin</h3>
				<button type="button" onclick={() => (showModalLeaveType = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleAddLeaveType} class="p-6 space-y-4">
				{#if leaveTypeFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{leaveTypeFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Jenis</label>
					<input type="text" bind:value={newLeaveType.label} placeholder="Contoh: Cuti Melahirkan" required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Kode (opsional)</label>
					<input type="text" bind:value={newLeaveType.code} placeholder="Kosongkan untuk dibuat otomatis dari nama" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
					<p class="text-[11px] text-slate-400 mt-1">Kode dipakai di sistem sebagai nilai unik, tidak ditampilkan ke guru. Hanya huruf kecil/angka/underscore.</p>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalLeaveType = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Jenis</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL EDIT JENIS CUTI/IZIN ================= -->
{#if showModalEditLeaveType}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Edit Jenis Cuti/Izin</h3>
				<button type="button" onclick={() => (showModalEditLeaveType = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleEditLeaveType} class="p-6 space-y-4">
				{#if editLeaveTypeFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{editLeaveTypeFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Jenis</label>
					<input type="text" bind:value={editLeaveType.label} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none" />
				</div>
				<p class="text-xs text-slate-400">Kode tidak bisa diubah supaya riwayat pengajuan cuti lama tetap konsisten.</p>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalEditLeaveType = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Perubahan</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL TAMBAH JADWAL ================= -->
{#if showModalJadwal}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Form Jadwal Mengajar Baru</h3>
				<button type="button" onclick={() => (showModalJadwal = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleAddJadwal} class="p-6 space-y-4">
				{#if jadwalFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{jadwalFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Guru</label>
					<select bind:value={newJadwal.teacher_id} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						<option value={0}>-- Pilih Guru --</option>
						{#each teachers.filter((t) => t.role === 'guru') as t}
							<option value={t.id}>{t.name} ({t.nip})</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Ruangan</label>
					<select bind:value={newJadwal.room_id} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						<option value={0}>-- Pilih Ruangan --</option>
						{#each rooms as r}
							<option value={r.id}>{r.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Hari</label>
					<select bind:value={newJadwal.day_of_week} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						{#each DAY_NAMES.slice(1) as name, idx}
							<option value={idx + 1}>{name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Bulan Berlaku</label>
						<select bind:value={newJadwal.period_month} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
							{#each Array(12) as _, i}
								<option value={i + 1}>{monthName(i + 1)}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tahun</label>
						<input type="number" bind:value={newJadwal.period_year} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Jam Mulai</label>
						<input type="time" bind:value={newJadwal.start_time} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
					</div>
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Jam Selesai</label>
						<input type="time" bind:value={newJadwal.end_time} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
					</div>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Target JP</label>
					<input type="number" min="1" bind:value={newJadwal.target_jp} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
					<input type="text" bind:value={newJadwal.subject} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalJadwal = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Jadwal</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ================= MODAL EDIT JADWAL ================= -->
{#if showModalEditJadwal}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Edit Jadwal Mengajar</h3>
				<button type="button" onclick={() => (showModalEditJadwal = false)} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<form onsubmit={handleEditJadwal} class="p-6 space-y-4">
				{#if editJadwalFormError}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-semibold">{editJadwalFormError}</div>
				{/if}
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Guru</label>
					<select bind:value={editJadwal.teacher_id} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						<option value={0}>-- Pilih Guru --</option>
						{#each teachers.filter((t) => t.role === 'guru') as t}
							<option value={t.id}>{t.name} ({t.nip})</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Ruangan</label>
					<select bind:value={editJadwal.room_id} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						<option value={0}>-- Pilih Ruangan --</option>
						{#each rooms as r}
							<option value={r.id}>{r.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Hari</label>
					<select bind:value={editJadwal.day_of_week} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
						{#each DAY_NAMES.slice(1) as name, idx}
							<option value={idx + 1}>{name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Bulan Berlaku</label>
						<select bind:value={editJadwal.period_month} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
							{#each Array(12) as _, i}
								<option value={i + 1}>{monthName(i + 1)}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tahun</label>
						<input type="number" bind:value={editJadwal.period_year} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Jam Mulai</label>
						<input type="time" bind:value={editJadwal.start_time} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
					</div>
					<div>
						<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Jam Selesai</label>
						<input type="time" bind:value={editJadwal.end_time} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
					</div>
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Target JP</label>
					<input type="number" min="1" bind:value={editJadwal.target_jp} required class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
				</div>
				<div>
					<label class="block text-xs font-bold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
					<input type="text" bind:value={editJadwal.subject} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
				</div>

				<!-- Duplikasi ke bulan lain: shortcut supaya tidak perlu input ulang tiap bulan baru -->
				<div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
					<p class="text-xs font-bold text-emerald-800">📋 Duplikasi jadwal ini ke bulan lain</p>
					<div class="flex gap-2 items-end">
						<div class="flex-1">
							<label class="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Bulan</label>
							<select bind:value={duplicateTargetMonth} class="w-full border border-emerald-300 rounded-lg p-2 text-xs bg-white">
								{#each Array(12) as _, i}
									<option value={i + 1}>{monthName(i + 1)}</option>
								{/each}
							</select>
						</div>
						<div class="w-20">
							<label class="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Tahun</label>
							<input type="number" bind:value={duplicateTargetYear} class="w-full border border-emerald-300 rounded-lg p-2 text-xs" />
						</div>
						<button type="button" onclick={handleDuplicateJadwal} disabled={duplicateLoading}
							class="bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold border-0 cursor-pointer hover:bg-emerald-800 disabled:opacity-60">
							{duplicateLoading ? '...' : 'Duplikasi'}
						</button>
					</div>
					{#if duplicateMessage}
						<p class="text-[11px] font-semibold text-emerald-700">{duplicateMessage}</p>
					{/if}
				</div>

				<div class="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => { showModalEditJadwal = false; if (editJadwalId !== null) { const s = schedules.find((sc) => sc.id === editJadwalId); if (s) handleDeleteJadwal(s); } }}
						class="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-rose-200">🗑️ Hapus</button>
					<div class="flex gap-2">
						<button type="button" onclick={() => (showModalEditJadwal = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
						<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Perubahan</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}