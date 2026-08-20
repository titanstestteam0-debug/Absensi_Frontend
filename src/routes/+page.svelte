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
		createSchedule,
		updateSchedule,
		deleteSchedule,
		listAllLeaves,
		listMyLeaves,
		createLeave,
		approveLeave,
		rejectLeave,
		getMonthlyReport,
		getHistoryLog,
		updateMyPhoto,
		type Teacher,
		type Room,
		type Schedule,
		type Leave,
		type MonthlyRecapRow,
		type HistoryRow
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

	// --- QR "live" (auto-refresh) di dalam modal, agar QR yang difoto/
	// discreenshot dari luar kelas cepat kedaluwarsa dan tidak bisa dipakai
	// untuk scan-in palsu dari rumah. ---
	let qrLoading = $state(false);
	let qrError = $state('');
	let qrCurrentString = $state('');
	let qrExpiresIn = $state(0); // detik tersisa sebelum QR berganti
	let qrRotationSecondsVal = $state(20);
	let qrPollTimer: ReturnType<typeof setInterval> | null = null;
	let qrCountdownTimer: ReturnType<typeof setInterval> | null = null;

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

	function stopQRTimers() {
		if (qrPollTimer) clearInterval(qrPollTimer);
		if (qrCountdownTimer) clearInterval(qrCountdownTimer);
		qrPollTimer = null;
		qrCountdownTimer = null;
	}

	async function loadLiveQR(roomId: number, opts: { silent?: boolean } = {}) {
		if (!opts.silent) qrLoading = true;
		try {
			const data = await getRoomQR(roomId);
			qrCurrentString = data.qr_string;
			qrExpiresIn = data.expires_in_seconds;
			qrRotationSecondsVal = data.rotation_seconds;
			qrError = '';
		} catch (err) {
			qrError = err instanceof Error ? err.message : 'Gagal memuat QR';
		} finally {
			qrLoading = false;
		}
	}

	async function handleRefreshQRNow() {
		if (!selectedRoom) return;
		qrLoading = true;
		try {
			const data = await refreshRoomQR(selectedRoom.id);
			qrCurrentString = data.qr_string;
			qrExpiresIn = data.expires_in_seconds;
			qrRotationSecondsVal = data.rotation_seconds;
			qrError = '';
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
		stopQRTimers();

		await loadLiveQR(room.id);

		// Poll ke server tiap 3 detik supaya QR selalu sinkron dengan yang
		// tervalidasi di backend (backend yang jadi sumber kebenaran waktu,
		// bukan jam device, supaya tidak bisa dicurangi).
		qrPollTimer = setInterval(() => loadLiveQR(room.id, { silent: true }), 3000);
		// Hitung mundur visual per detik, disinkronkan ulang tiap kali poll berhasil.
		qrCountdownTimer = setInterval(() => {
			qrExpiresIn = qrExpiresIn > 0 ? qrExpiresIn - 1 : 0;
		}, 1000);
	}

	function closeQRModal() {
		showModalQR = false;
		stopQRTimers();
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
	let showModalJadwal = $state(false);
	let newJadwal = $state({
		teacher_id: 0,
		room_id: 0,
		day_of_week: 1,
		start_time: '07:00',
		end_time: '08:00',
		target_jp: 1,
		subject: ''
	});
	let jadwalFormError = $state('');

	async function loadSchedules() {
		schedulesLoading = true;
		try {
			schedules = (await listSchedules()) || [];
		} catch (err) {
			globalError = err instanceof Error ? err.message : 'Gagal memuat jadwal';
		} finally {
			schedulesLoading = false;
		}
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
			newJadwal = {
				teacher_id: 0,
				room_id: 0,
				day_of_week: 1,
				start_time: '07:00',
				end_time: '08:00',
				target_jp: 1,
				subject: ''
			};
			showModalJadwal = false;
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
		start_time: '07:00',
		end_time: '08:00',
		target_jp: 1,
		subject: ''
	});
	let editJadwalFormError = $state('');

	function openEditJadwal(s: Schedule) {
		editJadwalId = s.id;
		editJadwal = {
			teacher_id: s.teacher_id,
			room_id: s.room_id,
			day_of_week: s.day_of_week,
			start_time: s.start_time ? s.start_time.slice(0, 5) : '07:00',
			end_time: s.end_time ? s.end_time.slice(0, 5) : '08:00',
			target_jp: s.target_jp,
			subject: s.subject ?? ''
		};
		editJadwalFormError = '';
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
			await loadSchedules();
		} catch (err) {
			editJadwalFormError = err instanceof Error ? err.message : 'Gagal memperbarui jadwal';
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

	// ------------------------------------------------------------------
	// 5. Cuti / Izin (GET/POST /api/leaves, /api/admin/leaves, approve/reject)
	// ------------------------------------------------------------------
	let leaves = $state<Leave[]>([]);
	let leavesLoading = $state(false);
	let showModalAjukanCuti = $state(false);
	let newCuti = $state({ start_date: '', end_date: '', leave_type: 'sakit', reason: '' });
	let cutiFormError = $state('');

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
		if (!newCuti.start_date || !newCuti.end_date || !newCuti.reason) {
			cutiFormError = 'Semua field wajib diisi';
			return;
		}
		try {
			await createLeave(newCuti);
			newCuti = { start_date: '', end_date: '', leave_type: 'sakit', reason: '' };
			showModalAjukanCuti = false;
			await loadLeaves();
		} catch (err) {
			cutiFormError = err instanceof Error ? err.message : 'Gagal mengajukan cuti';
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
	// 6. Laporan (GET /api/admin/reports/monthly & /history)
	// ------------------------------------------------------------------
	const now = new Date();
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

	function exportReportCSV() {
		const header = ['Nama Guru', 'Total Sesi', 'Tuntas', 'Tidak Tuntas', 'JP Aktual', 'JP Target'];
		const rows = monthlyRecap.map((r) => [
			r.teacher_name,
			r.total_sesi,
			r.sesi_tuntas,
			r.sesi_tidak_tuntas,
			r.total_jp_aktual,
			r.total_jp_target
		]);
		const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `rekap-${reportYear}-${String(reportMonth).padStart(2, '0')}.csv`;
		a.click();
		URL.revokeObjectURL(url);
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
			await Promise.all([loadTeachers(), loadRooms(), loadSchedules(), loadLeaves(), loadTodayHistory()]);
			await loadMonthlyReport();
		} else {
			await loadLeaves();
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
							<p class="text-xs text-slate-500">Kelola ruangan dan cetak stiker QR Code (dibuat otomatis oleh backend).</p>
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
											<span class="block text-[9px] font-normal normal-case text-slate-400">(berganti otomatis, lihat "QR Live")</span>
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
														📱 QR Live
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
					<div class="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
						<div>
							<h2 class="text-lg font-bold text-slate-800">Jadwal Mengajar Guru</h2>
							<p class="text-xs text-slate-500">Jadwal per guru, ruangan, hari, dan Jam Pelajaran (JP) target.</p>
						</div>
						<button type="button" onclick={() => (showModalJadwal = true)}
							class="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 hover:bg-blue-950 transition flex items-center gap-1.5 shadow-sm">
							<span>+</span> Tambah Jadwal
						</button>
					</div>
					<div class="p-6">
						{#if schedulesLoading}
							<p class="text-sm text-slate-400">Memuat...</p>
						{:else}
							<table class="w-full text-left text-sm border-collapse">
								<thead>
									<tr class="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold bg-slate-50/50">
										<th class="py-3 px-4">Hari</th>
										<th class="py-3 px-4">Guru</th>
										<th class="py-3 px-4">Ruangan</th>
										<th class="py-3 px-4">Jam</th>
										<th class="py-3 px-4">Target JP</th>
										<th class="py-3 px-4">Mapel</th>
										<th class="py-3 px-4 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each schedules as s}
										<tr class="hover:bg-slate-50">
											<td class="py-3.5 px-4 font-semibold text-slate-800">{DAY_NAMES[s.day_of_week]}</td>
											<td class="py-3.5 px-4 text-slate-700">{s.teacher_name}</td>
											<td class="py-3.5 px-4 text-slate-600">{s.room_name}</td>
											<td class="py-3.5 px-4 font-mono text-xs text-slate-600">{s.start_time} - {s.end_time}</td>
											<td class="py-3.5 px-4 text-slate-600">{s.target_jp} JP</td>
											<td class="py-3.5 px-4 text-slate-600">{s.subject ?? '-'}</td>
											<td class="py-3.5 px-4 text-right">
												<div class="flex justify-end gap-2">
													<button type="button" onclick={() => openEditJadwal(s)}
														class="bg-slate-200 text-slate-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-slate-300 transition">
														✏️ Edit
													</button>
													<button type="button" onclick={() => handleDeleteJadwal(s)}
														class="bg-rose-100 text-rose-700 px-3 py-1 rounded text-xs font-bold cursor-pointer border-0 hover:bg-rose-200 transition">
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
											<td class="py-3.5 px-4 text-slate-600 capitalize">{c.leave_type ?? 'sakit'}</td>
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
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<div class="p-6 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
						<div>
							<h2 class="text-lg font-bold text-slate-800">Laporan Rekap Jam Mengajar</h2>
							<p class="text-xs text-slate-500">Rekap perbandingan Jam Pelajaran (JP) target vs aktual per bulan.</p>
						</div>
						<div class="flex items-center gap-2">
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
					<div class="p-6">
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
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each monthlyRecap as row}
										<tr class="hover:bg-slate-50">
											<td class="py-3.5 px-4 font-bold text-slate-800">{row.teacher_name}</td>
											<td class="py-3.5 px-4 text-center text-slate-600">{row.total_sesi}</td>
											<td class="py-3.5 px-4 text-center text-emerald-700 font-semibold">{row.sesi_tuntas}</td>
											<td class="py-3.5 px-4 text-center text-rose-700 font-semibold">{row.sesi_tidak_tuntas}</td>
											<td class="py-3.5 px-4 text-center font-mono">{row.total_jp_aktual}</td>
											<td class="py-3.5 px-4 text-center font-mono">{row.total_jp_target}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>
			{/if}

		</main>
	</div>
</div>
{/if}

<!-- ================= MODAL CETAK QR CODE RUANGAN ================= -->
{#if showModalQR && selectedRoom}
	<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 text-center">
			<div class="bg-blue-900 px-6 py-4 text-white flex justify-between items-center">
				<h3 class="font-bold text-base">Kartu QR Code Kelas (Live)</h3>
				<button type="button" onclick={closeQRModal} class="text-blue-200 hover:text-white border-0 bg-transparent text-xl font-bold cursor-pointer">✕</button>
			</div>

			<div class="p-6 space-y-4">
				<div class="border-2 border-dashed border-slate-300 p-6 rounded-2xl bg-slate-50 space-y-3">
					<p class="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
						{qrLoading && !qrCurrentString ? 'Memuat...' : qrCurrentString}
					</p>
					<h4 class="text-lg font-black text-blue-950">{selectedRoom.name}</h4>

					<div class="w-48 h-48 bg-white border-4 border-slate-900 rounded-2xl mx-auto p-2 flex items-center justify-center shadow-md relative">
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
						<div class="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-lg text-xs font-semibold">{qrError}</div>
					{/if}

					<!-- Indikator hitung mundur: QR ini otomatis berganti tiap qrRotationSecondsVal detik -->
					<div class="space-y-1.5">
						<div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
							<div
								class="h-full bg-emerald-600 transition-all duration-1000 ease-linear"
								style="width: {qrRotationSecondsVal > 0 ? Math.min(100, (qrExpiresIn / qrRotationSecondsVal) * 100) : 0}%">
							</div>
						</div>
						<p class="text-[11px] font-bold text-emerald-700">
							🔄 QR berganti otomatis dalam {qrExpiresIn}s
						</p>
					</div>

					<p class="text-[10px] text-slate-500 font-medium">
						Tunjukkan layar ini langsung ke guru untuk discan — jangan dicetak/screenshot, karena kode akan kedaluwarsa dalam hitungan detik.
					</p>
				</div>

				<div class="flex gap-2">
					<button type="button" onclick={closeQRModal} class="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border-0 cursor-pointer hover:bg-slate-300">
						Tutup
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
					<select bind:value={newCuti.leave_type} class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none bg-white">
						<option value="sakit">Sakit</option>
						<option value="dinas_luar">Izin Dinas Luar</option>
						<option value="keperluan_keluarga">Keperluan Keluarga</option>
					</select>
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
					<p>{tolakCutiTarget.start_date} s/d {tolakCutiTarget.end_date} &middot; <span class="capitalize">{tolakCutiTarget.leave_type}</span></p>
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

				<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
					<button type="button" onclick={() => (showModalEditJadwal = false)} class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-slate-200">Batal</button>
					<button type="submit" class="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-blue-950">Simpan Perubahan</button>
				</div>
			</form>
		</div>
	</div>
{/if}