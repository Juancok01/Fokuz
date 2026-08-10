<script lang="ts">
	import { Calendar, Check, Circle, ListChecks, RefreshCw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import logo from '$lib/assets/favicon_logo.png';
	import HabitIcon from '$lib/components/HabitIcon.svelte';
	import {
		formatDateInTz,
		getWeekdayInTz,
		habitIsScheduledOn,
		normalizeHabitIcon,
		normalizeWeekdays,
		type Habit
	} from '$lib/habits';

	type TodayHabit = Habit & { done: boolean };

	let userName = $state('tú');
	let pendingCount = $state(0);
	let completedCount = $state(0);
	let todayHabits = $state<TodayHabit[]>([]);
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
		if (totalCount === 0) return 'No tienes tareas para hoy. ¡Buen momento para planear!';
		if (pendingCount === 0) return 'Completaste todas tus tareas de hoy. ¡Excelente!';
		if (pendingCount === 1) return 'Tienes 1 tarea pendiente para hoy. ¡Vamos por ella!';
		return `Tienes ${pendingCount} tareas pendientes para hoy. ¡Vamos por ellas!`;
	});

	const resolveDisplayName = (meta: Record<string, unknown>, email?: string | null) => {
		const displayName = typeof meta.display_name === 'string' ? meta.display_name.trim() : '';
		if (displayName) return displayName;

		const alias = typeof meta.alias === 'string' ? meta.alias.trim() : '';
		if (alias) return alias;

		return email?.split('@')[0] || 'tú';
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

			// getSession es local; tareas + hábitos en paralelo
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

			let habitsResult = habitsWithIcon;
			if (habitsResult.error && /icon/i.test(habitsResult.error.message)) {
				habitsResult = await supabase
					.from('habits')
					.select('id, name, weekdays')
					.order('created_at', { ascending: true });
			}

			if (habitsResult.error) {
				// Tabla aún no creada u otro error: no romper Inicio
				if (!/habit/i.test(habitsResult.error.message)) {
					console.warn('Error al cargar hábitos:', habitsResult.error.message);
				}
				todayHabits = [];
			} else {
				const doneIds = new Set((logsResult.data ?? []).map((row) => row.habit_id));
				todayHabits = (habitsResult.data ?? [])
					.map((h) => ({
						id: h.id,
						name: h.name,
						weekdays: normalizeWeekdays(h.weekdays),
						icon: normalizeHabitIcon((h as { icon?: string }).icon),
						done: doneIds.has(h.id)
					}))
					.filter((h) => habitIsScheduledOn(h, weekday));
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
	});

	afterNavigate(({ from }) => {
		// Refresco en segundo plano al volver (sin skeleton)
		if (from) loadTodaySummary({ silent: true });
	});
</script>

<svelte:head>
	<title>Inicio · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-2 text-brand-accent">
		<Calendar class="w-5 h-5" />
		<span class="text-base font-bold">{todayLabel}</span>
	</div>
	<img src={logo} alt="Fokuz" class="w-9 h-9 rounded-full object-contain ring-2 ring-brand-accent/70" />
</header>

<div class="flex-1 overflow-y-auto px-6 py-6 pb-28">
	<div class="rounded-2xl border border-brand-accent/70 bg-brand-surface p-5">
		{#if loading}
			<div class="space-y-4">
				<div class="h-8 w-[75%] rounded-lg bg-brand-surface-elevated skeleton"></div>
				<div class="h-4 w-full rounded bg-brand-surface-elevated skeleton"></div>
				<div class="h-4 w-[66%] rounded bg-brand-surface-elevated skeleton"></div>
				<div class="h-2 w-full rounded-full bg-brand-surface-elevated skeleton mt-2"></div>
			</div>
		{:else}
			<h2 class="text-2xl font-bold text-brand-accent tracking-tight mb-2">
				{greeting}, {userName}
			</h2>
			<p class="text-brand-text-muted text-[15px] leading-relaxed mb-5">
				{statusMessage}
			</p>

			<div class="flex items-center gap-3 mb-4">
				<div class="flex items-center gap-2 text-brand-text text-sm">
					<ListChecks class="w-4 h-4 text-brand-accent" />
					<span>
						<span class="font-bold text-brand-accent">{pendingCount}</span>
						pendiente{pendingCount === 1 ? '' : 's'}
					</span>
				</div>
				<span class="text-brand-divider">·</span>
				<span class="text-sm text-brand-text-muted">
					{completedCount} completada{completedCount === 1 ? '' : 's'}
				</span>
			</div>

			<div class="flex items-center gap-3">
				<div class="h-2 flex-1 bg-brand-surface-elevated rounded-full overflow-hidden">
					<div
						class="h-full bg-brand-accent rounded-full transition-[width] duration-500 ease-out"
						style="width: {progress}%"
					></div>
				</div>
				<span class="text-sm font-bold text-brand-accent whitespace-nowrap">{progress}% Completado</span>
			</div>
		{/if}
	</div>

	<a
		href="/tareas"
		class="mt-6 w-full flex items-center justify-center gap-2 bg-brand-accent text-brand-bg font-bold py-4 rounded-xl hover:brightness-105 transition-colors"
	>
		Ver tareas de hoy
	</a>

	<!-- F-IN-03: hábitos de hoy -->
	<section class="mt-8">
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2">
				<RefreshCw class="w-4 h-4 text-brand-accent" />
				<h3 class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Hábitos de hoy</h3>
			</div>
			{#if !loading && todayHabits.length > 0}
				<span class="text-[11px] text-brand-text-muted">{habitsDone}/{todayHabits.length}</span>
			{/if}
		</div>

		{#if loading}
			<div class="space-y-2">
				{#each [1, 2] as _}
					<div class="h-12 rounded-xl bg-brand-surface skeleton"></div>
				{/each}
			</div>
		{:else if todayHabits.length === 0}
			<div class="rounded-xl border border-brand-divider bg-brand-surface px-4 py-4">
				<p class="text-sm text-brand-text-muted mb-3">No tienes hábitos programados para hoy.</p>
				<a href="/habitos" class="text-sm font-semibold text-brand-accent hover:underline">Ir a Hábitos</a>
			</div>
		{:else}
			<ul class="space-y-2">
				{#each todayHabits as habit (habit.id)}
					<li>
						<button
							type="button"
							class="w-full flex items-center gap-3 rounded-xl border border-brand-divider bg-brand-surface px-4 py-3 text-left transition-colors hover:bg-brand-surface-elevated"
							onclick={() => toggleTodayHabit(habit)}
						>
							{#if habit.done}
								<Check class="w-5 h-5 text-brand-accent shrink-0" />
							{:else}
								<Circle class="w-5 h-5 text-brand-text-muted shrink-0" />
							{/if}
							<span class="text-brand-accent shrink-0">
								<HabitIcon icon={habit.icon} class="w-4 h-4" />
							</span>
							<span
								class="text-sm font-medium truncate {habit.done
									? 'text-brand-text-muted line-through'
									: 'text-brand-text'}"
							>
								{habit.name}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if habitsPending > 0}
				<p class="mt-2 text-[11px] text-brand-text-muted">
					{habitsPending} por marcar · toca para completar
				</p>
			{/if}
		{/if}
	</section>
</div>
