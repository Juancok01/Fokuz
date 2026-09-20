<script lang="ts">
	import {
		BookOpen,
		Calendar,
		Check,
		Circle,
		ListChecks,
		RefreshCw,
		Flame,
		Zap,
		Target,
		Share2,
		Bookmark,
		Play
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { pomodoroUI } from '$lib/pomodoro.svelte';
	import logo from '$lib/assets/Logo_Fokuz.png';
	import HabitIcon from '$lib/components/HabitIcon.svelte';
	import {
		getLocalDailyVerse,
		readCachedDailyVerse,
		writeCachedDailyVerse,
		type DailyVerse
	} from '$lib/dailyVerse';
	import {
		formatDateInTz,
		getWeekdayInTz,
		habitIsScheduledOn,
		normalizeHabitIcon,
		normalizeWeekdays,
		type Habit
	} from '$lib/habits';

	type TodayHabit = Habit & { done: boolean; streak: number; tag: string };

	let userName = $state('tú');
	let pendingCount = $state(0);
	let completedCount = $state(0);
	let todayHabits = $state<TodayHabit[]>([]);
	let dailyVerse = $state<DailyVerse | null>(null);
	let verseLoading = $state(true);
	let verseSaved = $state(false);
	let loading = $state(true);
	let hasLoaded = $state(false);
	let habitToggleBusy = $state<number | null>(null);

	const todayLabel = $derived.by(() => {
		const weekday = new Intl.DateTimeFormat('es-CO', {
			timeZone: 'America/Bogota',
			weekday: 'long'
		}).format(new Date());
		const day = new Intl.DateTimeFormat('es-CO', {
			timeZone: 'America/Bogota',
			day: 'numeric'
		}).format(new Date());
		const month = new Intl.DateTimeFormat('es-CO', {
			timeZone: 'America/Bogota',
			month: 'short'
		})
			.format(new Date())
			.replace('.', '');
		const weekdayLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);
		const monthLabel = month.charAt(0).toUpperCase() + month.slice(1);
		return `Hoy, ${weekdayLabel} ${day} ${monthLabel}`;
	});

	const weekDays = $derived.by(() => {
		const days = [];
		const now = new Date();
		for (let i = -2; i <= 2; i++) {
			const d = new Date(now);
			d.setDate(d.getDate() + i);
			
			const weekdayStr = new Intl.DateTimeFormat('es-CO', {
				timeZone: 'America/Bogota',
				weekday: 'short'
			}).format(d);
			const dayNum = new Intl.DateTimeFormat('es-CO', {
				timeZone: 'America/Bogota',
				day: 'numeric'
			}).format(d);

			const cleanWeekday = weekdayStr.replace(/\./g, '');
			days.push({
				label: `${cleanWeekday.charAt(0).toUpperCase() + cleanWeekday.slice(1)} ${dayNum}`,
				isActive: i === 0
			});
		}
		return days;
	});

	const greeting = $derived.by(() => {
		const hour = Number(
			new Intl.DateTimeFormat('en-GB', {
				timeZone: 'America/Bogota',
				hour: '2-digit',
				hour12: false
			}).format(new Date())
		);

		if (hour < 12) return 'Buenos días';
		if (hour < 19) return 'Buenas tardes';
		return 'Buenas noches';
	});

	const totalCount = $derived(pendingCount + completedCount);
	const progress = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

	const habitsPending = $derived(todayHabits.filter((h) => !h.done).length);
	const habitsDone = $derived(todayHabits.filter((h) => h.done).length);

	const statusMessage = $derived.by(() => {
		if (totalCount === 0) return 'No tienes tareas pendientes para hoy. ¡Es un excelente momento para planificar tu día de mañana!';
		if (pendingCount === 0) return 'Completaste todas tus tareas de hoy. ¡Es un excelente momento para descansar o planificar tu día de mañana!';
		if (pendingCount === 1) return 'Tienes 1 tarea pendiente para hoy. ¡Vamos por ella!';
		return `Tienes ${pendingCount} tareas pendientes para hoy. ¡Aún estás a tiempo!`;
	});

	const resolveDisplayName = (meta: Record<string, unknown>, email?: string | null) => {
		const displayName = typeof meta.display_name === 'string' ? meta.display_name.trim() : '';
		if (displayName) return displayName;

		const alias = typeof meta.alias === 'string' ? meta.alias.trim() : '';
		if (alias) return alias;

		return email?.split('@')[0] || 'tú';
	};

	const loadDailyVerse = async (opts?: { silent?: boolean }) => {
		const today = formatDateInTz();
		const cached = readCachedDailyVerse(today);
		if (cached) {
			dailyVerse = cached;
			verseLoading = false;
			if (opts?.silent) return;
		} else if (!opts?.silent) {
			dailyVerse = getLocalDailyVerse(today);
			verseLoading = true;
		}

		try {
			const res = await fetch('/api/verse-of-day');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as DailyVerse;
			if (data?.text && data?.reference) {
				dailyVerse = data;
				writeCachedDailyVerse(data, today);
			}
		} catch (err) {
			console.warn('No se pudo cargar versículo desde API:', err);
			if (!dailyVerse) dailyVerse = getLocalDailyVerse(today);
		} finally {
			if (supabase && dailyVerse && dailyVerse.reference) {
				const { data } = await supabase
					.from('saved_verses')
					.select('id')
					.eq('reference', dailyVerse.reference)
					.maybeSingle();
				verseSaved = !!data;
			}
			verseLoading = false;
		}
	};

	const toggleSaveVerse = async () => {
		if (!supabase || !dailyVerse) return;
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) return;

		const currentSavedState = verseSaved;
		verseSaved = !verseSaved; // Optimistic update

		if (currentSavedState) {
			// Unsave
			const { error } = await supabase
				.from('saved_verses')
				.delete()
				.eq('reference', dailyVerse.reference)
				.eq('user_id', session.user.id);
			if (error) {
				console.error('Error quitando guardado del versículo:', error);
				verseSaved = currentSavedState; // Revert
			}
		} else {
			// Save
			const { error } = await supabase
				.from('saved_verses')
				.insert({
					user_id: session.user.id,
					text: dailyVerse.text,
					reference: dailyVerse.reference,
					translation: dailyVerse.translation
				});
			if (error) {
				console.error('Error guardando versículo:', error);
				verseSaved = currentSavedState; // Revert
			}
		}
	};

	const loadTodaySummary = async (opts?: { silent?: boolean }) => {
		const silent = Boolean(opts?.silent && hasLoaded);
		if (!silent) loading = true;

		try {
			if (!supabase) {
				pendingCount = 0;
				completedCount = 0;
				todayHabits = [];
				return;
			}

			const today = formatDateInTz();
			const weekday = getWeekdayInTz();

			const [
				{
					data: { session }
				},
				tasksResult,
				habitsWithIcon,
				logsResult
			] = await Promise.all([
				supabase.auth.getSession(),
				supabase.from('tasks').select('id, is_completed').eq('date', today),
				supabase
					.from('habits')
					.select('id, name, weekdays, icon')
					.order('created_at', { ascending: true }),
				supabase.from('habit_logs').select('habit_id').eq('date', today)
			]);

			userName = resolveDisplayName(session?.user?.user_metadata ?? {}, session?.user?.email);

			if (tasksResult.error) {
				console.warn('Error al cargar resumen:', tasksResult.error.message);
				pendingCount = 0;
				completedCount = 0;
			} else {
				const rows = tasksResult.data ?? [];
				pendingCount = rows.filter((t) => !t.is_completed).length;
				completedCount = rows.filter((t) => t.is_completed).length;
			}

			let habitsResult: any = habitsWithIcon;
			if (habitsResult.error && /icon/i.test(habitsResult.error.message)) {
				habitsResult = await supabase
					.from('habits')
					.select('id, name, weekdays')
					.order('created_at', { ascending: true });
			}

			if (habitsResult.error) {
				if (!/habit/i.test(habitsResult.error.message)) {
					console.warn('Error al cargar hábitos:', habitsResult.error.message);
				}
				todayHabits = [];
			} else {
				const doneIds = new Set((logsResult.data ?? []).map((row) => row.habit_id));
				todayHabits = (habitsResult.data ?? [])
					.map((h: any, i: number) => {
						const mockTags = ['Vitalidad', 'Espiritual', 'Planificación', 'Desarrollo'];
						const tag = mockTags[i % mockTags.length];
						const streak = Math.floor(Math.random() * 30) + 1;
						return {
							id: h.id,
							name: h.name,
							weekdays: normalizeWeekdays(h.weekdays),
							icon: normalizeHabitIcon((h as { icon?: string }).icon),
							done: doneIds.has(h.id),
							streak,
							tag
						};
					})
					.filter((h: any) => habitIsScheduledOn(h, weekday));
			}
		} catch (err) {
			console.warn('Error inesperado al cargar Inicio:', err);
			pendingCount = 0;
			completedCount = 0;
			todayHabits = [];
		} finally {
			loading = false;
			hasLoaded = true;
		}
	};

	const toggleTodayHabit = async (habit: TodayHabit) => {
		if (!supabase || habitToggleBusy === habit.id) return;

		const previous = habit.done;
		habit.done = !habit.done;
		todayHabits = [...todayHabits];
		habitToggleBusy = habit.id;

		const today = formatDateInTz();

		try {
			if (previous) {
				const { error } = await supabase
					.from('habit_logs')
					.delete()
					.eq('habit_id', habit.id)
					.eq('date', today);
				if (error) {
					habit.done = previous;
					todayHabits = [...todayHabits];
				}
			} else {
				const { error } = await supabase.from('habit_logs').insert({
					habit_id: habit.id,
					date: today
				});
				if (error) {
					habit.done = previous;
					todayHabits = [...todayHabits];
				}
			}
		} finally {
			if (habitToggleBusy === habit.id) habitToggleBusy = null;
		}
	};

	onMount(() => {
		loadTodaySummary();
		loadDailyVerse();
	});

	afterNavigate(({ from }) => {
		if (from) {
			loadTodaySummary({ silent: true });
			loadDailyVerse({ silent: true });
		}
	});
</script>

<svelte:head>
	<title>Inicio · Fokuz</title>
</svelte:head>

<div class="flex-1 overflow-y-auto px-6 py-6 pb-28 md:px-10 lg:px-12 xl:px-16 w-full max-w-7xl mx-auto">
	<!-- Top Header (Date, Week) -->
	<header class="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-brand-divider gap-4">
		<div class="flex items-center gap-4">
			<div class="bg-brand-surface border border-brand-divider p-2.5 rounded-xl">
				<Calendar class="w-6 h-6 text-brand-accent" />
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h2 class="text-xl font-bold text-brand-text">{todayLabel}</h2>
					<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-surface-elevated text-brand-accent">Semana 37</span>
				</div>
				<p class="text-xs text-brand-text-muted mt-1">Objetivos diarios sincronizados</p>
			</div>
		</div>
		<!-- Dynamic Week Selector -->
		<div class="hidden lg:flex items-center gap-1 text-xs font-medium bg-brand-surface rounded-full p-1 border border-brand-divider">
			{#each weekDays as wd}
				<span class="px-4 py-2 rounded-full cursor-pointer transition-colors {wd.isActive ? 'bg-brand-accent text-brand-bg font-bold' : 'text-brand-text-muted hover:text-brand-text'}">
					{wd.label}
				</span>
			{/each}
		</div>
	</header>

	<!-- Main Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] gap-8">
		
		<!-- Left Column -->
		<div class="flex flex-col gap-6">
			
			<!-- Greeting Card -->
			<div class="relative rounded-2xl border border-brand-divider bg-brand-surface p-6 overflow-hidden shadow-lg">
				<!-- Glow effects -->
				<div class="absolute -top-24 -left-24 w-64 h-64 bg-brand-accent/15 rounded-full blur-3xl pointer-events-none"></div>
				
				<div class="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-4">
							<div class="w-2 h-2 rounded-full bg-brand-accent logo-pulse"></div>
							<span class="text-[11px] text-brand-text-muted uppercase tracking-wider font-semibold">Modo enfoque nocturno</span>
						</div>
						<h2 class="text-4xl font-bold tracking-tight text-brand-text mb-2">
							{greeting}, <span class="text-brand-accent">{userName}</span>
						</h2>
						<p class="text-brand-text-muted text-[15px] leading-relaxed max-w-md mb-8">
							{statusMessage}
						</p>

						<div class="flex items-center gap-4 text-xs font-medium mb-3">
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-brand-accent"></span>
								<span class="text-brand-text"><span class="font-bold">{pendingCount}</span> pendientes</span>
							</div>
							<span class="text-brand-divider">·</span>
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-brand-accent opacity-50"></span>
								<span class="text-brand-text"><span class="font-bold">{completedCount}</span> completadas</span>
							</div>
							<span class="text-brand-divider">·</span>
							<span class="text-brand-text-muted">Total {totalCount} tareas para hoy</span>
						</div>
						
						<div class="flex items-center gap-3">
							<div class="h-1.5 flex-1 bg-brand-bg rounded-full overflow-hidden">
								<div class="h-full bg-brand-accent rounded-full transition-[width] duration-500 ease-out shadow-[0_0_10px_var(--color-brand-accent)]" style="width: {progress}%"></div>
							</div>
							<span class="text-xs font-bold text-brand-accent whitespace-nowrap">{progress}% Completado</span>
						</div>
					</div>
				</div>

				<div class="mt-8 flex flex-col sm:flex-row gap-3 relative z-10">
					<a href="/tareas" class="flex-1 flex items-center justify-center gap-2 bg-brand-accent text-brand-bg font-bold py-3.5 rounded-xl hover:brightness-105 transition-colors shadow-[0_0_20px_var(--color-brand-accent-muted)]">
						<ListChecks class="w-5 h-5" />
						Ver tareas de hoy
					</a>
					<button class="flex-[0.5] flex items-center justify-center gap-2 bg-[#0d1216] border border-brand-divider text-brand-text font-bold py-3.5 rounded-xl hover:bg-brand-bg transition-colors">
						<span class="text-brand-text-muted">+</span> Planificar día siguiente
					</button>
				</div>
			</div>

			<!-- Hábitos Section -->
			<section>
				<div class="flex items-center justify-between mb-4 mt-2">
					<div class="flex items-center gap-2">
						<RefreshCw class="w-4 h-4 text-brand-accent" />
						<h3 class="text-sm font-bold text-brand-text uppercase tracking-wider">Hábitos de hoy</h3>
					</div>
					<div class="flex items-center gap-3">
						{#if !loading && todayHabits.length > 0}
							<span class="text-xs font-medium text-brand-text"><span class="font-bold text-brand-text">{habitsDone}</span> de {todayHabits.length} listos</span>
						{/if}
						<a href="/habitos" class="text-xs font-bold text-brand-accent hover:underline">Gestionar</a>
					</div>
				</div>

				{#if loading}
					<div class="space-y-3">
						{#each [1, 2, 3] as _}
							<div class="h-20 rounded-xl bg-brand-surface skeleton"></div>
						{/each}
					</div>
				{:else if todayHabits.length === 0}
					<div class="rounded-xl border border-brand-divider bg-brand-surface px-6 py-8 text-center">
						<p class="text-brand-text-muted mb-4">No tienes hábitos programados para hoy.</p>
						<a href="/habitos" class="text-sm font-bold text-brand-bg bg-brand-accent px-4 py-2 rounded-lg hover:brightness-105 transition-colors">Añadir Hábitos</a>
					</div>
				{:else}
					<ul class="space-y-3">
						{#each todayHabits as habit (habit.id)}
							<li>
								<button
									type="button"
									class="w-full group flex items-center gap-4 rounded-2xl border border-brand-divider bg-brand-surface px-5 py-4 text-left transition-all hover:border-brand-accent/50 hover:bg-brand-surface-elevated"
									onclick={() => toggleTodayHabit(habit)}
								>
									<div class="relative shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 {habit.done ? 'border-brand-accent bg-brand-accent' : 'border-brand-divider group-hover:border-brand-text-muted'} transition-colors">
										{#if habit.done}
											<Check class="w-3.5 h-3.5 text-brand-bg absolute" strokeWidth={3} />
										{/if}
									</div>

									<div class="shrink-0 w-10 h-10 rounded-xl bg-brand-bg border border-brand-divider flex items-center justify-center text-brand-accent shadow-inner">
										<HabitIcon icon={habit.icon} class="w-5 h-5" />
									</div>
									
									<div class="flex-1 min-w-0">
										<span class="block text-[15px] font-bold truncate {habit.done ? 'text-brand-text-muted line-through' : 'text-brand-text'}">
											{habit.name}
										</span>
										<div class="flex items-center gap-2 mt-0.5 text-[11px] font-medium text-brand-text-muted">
											<span>Cualquier momento</span>
											<span class="text-brand-divider">·</span>
											<span class="flex items-center gap-1 text-orange-400">
												<Flame class="w-3 h-3" /> Racha: {habit.streak} días
											</span>
										</div>
									</div>

									<div class="shrink-0 hidden sm:block">
										<span class="px-3 py-1.5 rounded-lg bg-brand-bg border border-brand-divider text-[10px] font-bold text-brand-text-muted">
											{habit.tag}
										</span>
									</div>
								</button>
							</li>
						{/each}
					</ul>
					{#if habitsPending > 0}
						<p class="mt-4 text-[11px] text-brand-text-muted flex items-center gap-1.5">
							<span class="text-brand-accent text-sm">💡</span> Consejo: {habitsPending} por marcar · Toca cada círculo para completar y mantener viva tu racha.
						</p>
					{/if}
				{/if}
			</section>


		</div>

		<!-- Right Column -->
		<div class="flex flex-col gap-6">
			<!-- Versículo del día -->
			<section class="rounded-2xl border border-[#0B624C] bg-brand-surface overflow-hidden relative shadow-lg">
				<div class="absolute inset-0 bg-brand-accent/5 pointer-events-none"></div>
				<div class="p-6 relative z-10">
					<div class="flex items-center justify-between mb-6">
						<div class="flex items-center gap-2">
							<BookOpen class="w-4 h-4 text-brand-accent" />
							<h3 class="text-xs font-bold text-brand-text tracking-wider uppercase">Versículo del día</h3>
						</div>
						<div class="flex items-center gap-3 text-brand-text-muted">
							<button 
								class="transition-colors {verseSaved ? 'text-brand-accent' : 'hover:text-brand-text'}" 
								onclick={toggleSaveVerse}
								title={verseSaved ? "Quitar de guardados" : "Guardar versículo"}
							>
								<Bookmark class="w-4 h-4 {verseSaved ? 'fill-brand-accent' : ''}" />
							</button>
						</div>
					</div>

					{#if verseLoading && !dailyVerse}
						<div class="space-y-3">
							<div class="h-4 w-full rounded bg-brand-bg skeleton"></div>
							<div class="h-4 w-[85%] rounded bg-brand-bg skeleton"></div>
							<div class="h-3 w-28 rounded bg-brand-bg skeleton"></div>
						</div>
					{:else if dailyVerse}
						<blockquote class="space-y-5">
							<p class="text-[17px] leading-relaxed text-brand-text italic font-serif">
								<span class="text-brand-accent font-serif text-2xl mr-1 leading-none">“</span>{dailyVerse.text}<span class="text-brand-accent font-serif text-2xl ml-1 leading-none">”</span>
							</p>
							<footer class="flex items-center justify-between gap-2 pt-2">
								<cite class="not-italic text-sm font-bold text-brand-accent">
									{dailyVerse.reference}
								</cite>
								<span class="text-[9px] font-bold px-2 py-1 bg-brand-bg/50 border border-brand-divider rounded-md text-brand-accent shrink-0 uppercase tracking-widest">
									{dailyVerse.translation}
								</span>
							</footer>
						</blockquote>
					{/if}
				</div>
			</section>

			<!-- Foco & Reflexión (Pomodoro) -->
			<section class="rounded-2xl border border-brand-divider bg-brand-surface p-6 text-center flex flex-col items-center justify-center relative shadow-lg">
				<div class="absolute inset-0 bg-gradient-to-b from-transparent to-brand-bg/20 rounded-2xl pointer-events-none"></div>
				<div class="w-full flex items-center justify-between mb-8 relative z-10">
					<div class="flex items-center gap-2">
						<img src={logo} alt="" class="w-5 h-5 rounded-md object-contain" />
						<h3 class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Foco & Reflexión</h3>
					</div>
					<span class="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded-md">Pomodoro</span>
				</div>
				
				<h4 class="text-5xl font-black text-brand-text mb-2 tabular-nums tracking-tighter drop-shadow-md relative z-10">25:00</h4>
				<p class="text-[11px] text-brand-text-muted mb-8 relative z-10">Tiempo de lectura o introspección</p>
				
				<div class="w-full flex gap-3 relative z-10">
					<button onclick={() => pomodoroUI.isMaximized = true} class="flex-[1.5] flex items-center justify-center gap-2 bg-[#0d1216] border border-brand-divider text-brand-text font-bold py-3 rounded-xl hover:bg-brand-surface-elevated transition-colors">
						<Play class="w-4 h-4 fill-brand-text" /> Iniciar
					</button>
					<button onclick={() => pomodoroUI.isMaximized = true} class="flex-1 flex items-center justify-center gap-2 bg-transparent border border-brand-divider text-brand-text-muted font-bold py-3 rounded-xl hover:text-brand-text hover:bg-brand-surface-elevated transition-colors">
						Ajustar
					</button>
				</div>
			</section>
		</div>
	</div>
</div>
