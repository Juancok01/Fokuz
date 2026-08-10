<script lang="ts">
	import {
		Check,
		ChevronLeft,
		ChevronRight,
		Pencil,
		Plus,
		RefreshCw,
		Trash2,
		X
	} from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import HabitIcon from '$lib/components/HabitIcon.svelte';
	import {
		HABIT_ICON_OPTIONS,
		WEEKDAY_LABELS,
		WEEKDAY_NAMES,
		daysInMonth,
		formatDateInTz,
		formatDayKey,
		habitHealthFromPct,
		habitHealthLabel,
		habitIsScheduledOn,
		normalizeHabitIcon,
		normalizeWeekdays,
		weekdayForMonthDay,
		type Habit,
		type HabitHealth,
		type HabitIconId
	} from '$lib/habits';

	const MONTH_NAMES = [
		'Enero',
		'Febrero',
		'Marzo',
		'Abril',
		'Mayo',
		'Junio',
		'Julio',
		'Agosto',
		'Septiembre',
		'Octubre',
		'Noviembre',
		'Diciembre'
	];

	const healthTextClass = (health: HabitHealth) => {
		switch (health) {
			case 'green':
				return 'text-emerald-400';
			case 'yellow':
				return 'text-amber-300';
			case 'red':
				return 'text-red-400';
			default:
				return 'text-brand-text-muted';
		}
	};

	const healthDotClass = (health: HabitHealth) => {
		switch (health) {
			case 'green':
				return 'bg-emerald-400';
			case 'yellow':
				return 'bg-amber-300';
			case 'red':
				return 'bg-red-400';
			default:
				return 'bg-brand-divider';
		}
	};

	const today = new Date();
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	let habits = $state<Habit[]>([]);
	/** Claves `${habitId}:${YYYY-MM-DD}` */
	let doneKeys = $state(new Set<string>());
	let loading = $state(true);
	let refreshing = $state(false);
	let fetchId = 0;
	let loadedMonthKey: string | null = null;

	let sheetMode = $state<'closed' | 'create' | 'detail' | 'edit'>('closed');
	let selectedHabit = $state<Habit | null>(null);
	let formName = $state('');
	let formIcon = $state<HabitIconId>('sparkles');
	let formWeekdays = $state<number[]>([1, 2, 3, 4, 5]);
	let formError = $state('');
	let formBusy = $state(false);
	let toggleBusyKey = $state<string | null>(null);
	/** false si falta la columna icon en Supabase (SQL 010) */
	let iconsPersist = $state(true);

	const ICON_SQL_HINT =
		'No se pudo guardar el icono. En Supabase → SQL Editor ejecuta el archivo 010_habit_icon.sql y vuelve a intentar.';

	const dayCount = $derived(daysInMonth(viewYear, viewMonth));
	const todayKey = $derived(formatDateInTz());
	const dayNumbers = $derived(Array.from({ length: dayCount }, (_, i) => i + 1));

	const logKey = (habitId: number, dateStr: string) => `${habitId}:${dateStr}`;

	const habitStats = $derived.by(() => {
		const map = new Map<number, { total: number; done: number; pct: number; health: HabitHealth }>();
		for (const habit of habits) {
			let total = 0;
			let done = 0;
			for (let day = 1; day <= dayCount; day++) {
				const weekday = weekdayForMonthDay(viewYear, viewMonth, day);
				if (!habitIsScheduledOn(habit, weekday)) continue;
				total += 1;
				if (doneKeys.has(logKey(habit.id, formatDayKey(viewYear, viewMonth, day)))) done += 1;
			}
			const pct = total > 0 ? Math.round((done / total) * 100) : 0;
			map.set(habit.id, { total, done, pct, health: habitHealthFromPct(pct, total) });
		}
		return map;
	});

	const monthProgress = $derived.by(() => {
		let total = 0;
		let done = 0;
		for (const stats of habitStats.values()) {
			total += stats.total;
			done += stats.done;
		}
		const pct = total > 0 ? Math.round((done / total) * 100) : 0;
		return { total, done, pct, health: habitHealthFromPct(pct, total) };
	});

	const selectedStats = $derived(
		selectedHabit ? (habitStats.get(selectedHabit.id) ?? null) : null
	);

	const loadMonth = async () => {
		const requestId = ++fetchId;
		const year = viewYear;
		const month = viewMonth;
		const key = `${year}-${month}`;
		const days = daysInMonth(year, month);
		const keepStale = loadedMonthKey === key && habits.length > 0;

		if (keepStale) refreshing = true;
		else {
			loading = true;
			if (loadedMonthKey !== key) {
				habits = [];
				doneKeys = new Set();
			}
		}

		try {
			if (!supabase) {
				if (requestId === fetchId) {
					habits = [];
					doneKeys = new Set();
					loadedMonthKey = key;
				}
				return;
			}

			const start = formatDayKey(year, month, 1);
			const end = formatDayKey(year, month, days);

			let [habitsResult, logsResult] = await Promise.all([
				supabase
					.from('habits')
					.select('id, name, weekdays, icon')
					.order('created_at', { ascending: true }),
				supabase.from('habit_logs').select('habit_id, date').gte('date', start).lte('date', end)
			]);

			// Compat: si aún no corrieron 010_habit_icon.sql
			if (habitsResult.error && /icon|schema cache/i.test(habitsResult.error.message)) {
				iconsPersist = false;
				habitsResult = await supabase
					.from('habits')
					.select('id, name, weekdays')
					.order('created_at', { ascending: true });
			} else if (!habitsResult.error) {
				iconsPersist = true;
			}

			if (requestId !== fetchId) return;

			if (habitsResult.error) {
				console.warn('Error al cargar hábitos:', habitsResult.error.message);
			}
			if (logsResult.error) {
				console.warn('Error al cargar logs de hábitos:', logsResult.error.message);
			}

			habits = (habitsResult.data ?? []).map((h) => ({
				id: h.id,
				name: h.name,
				weekdays: normalizeWeekdays(h.weekdays),
				icon: normalizeHabitIcon((h as { icon?: string | null }).icon)
			}));

			doneKeys = new Set(
				(logsResult.data ?? []).map((row) => logKey(row.habit_id, row.date as string))
			);
			loadedMonthKey = key;
		} finally {
			if (requestId === fetchId) {
				loading = false;
				refreshing = false;
			}
		}
	};

	$effect(() => {
		void viewYear;
		void viewMonth;
		untrack(() => {
			loadMonth();
		});
	});

	const prevMonth = () => {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else viewMonth -= 1;
	};

	const nextMonth = () => {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else viewMonth += 1;
	};

	const closeSheet = () => {
		if (formBusy) return;
		sheetMode = 'closed';
		selectedHabit = null;
		formError = '';
	};

	const openCreate = () => {
		selectedHabit = null;
		formName = '';
		formIcon = 'sparkles';
		formWeekdays = [1, 2, 3, 4, 5];
		formError = '';
		sheetMode = 'create';
	};

	const openDetail = (habit: Habit) => {
		selectedHabit = habit;
		formError = '';
		sheetMode = 'detail';
	};

	const openEdit = () => {
		if (!selectedHabit) return;
		formName = selectedHabit.name;
		formIcon = selectedHabit.icon;
		formWeekdays = [...selectedHabit.weekdays];
		formError = '';
		sheetMode = 'edit';
	};

	const toggleWeekday = (day: number) => {
		if (formWeekdays.includes(day)) {
			if (formWeekdays.length === 1) return;
			formWeekdays = formWeekdays.filter((d) => d !== day);
		} else {
			formWeekdays = [...formWeekdays, day].sort((a, b) => a - b);
		}
	};

	const createHabit = async () => {
		const name = formName.trim();
		if (!name) {
			formError = 'Escribe un nombre para el hábito.';
			return;
		}
		if (formWeekdays.length === 0) {
			formError = 'Elige al menos un día de la semana.';
			return;
		}

		formBusy = true;
		formError = '';

		try {
			if (!supabase) {
				const tempId = -Date.now();
				habits = [
					...habits,
					{ id: tempId, name, weekdays: [...formWeekdays], icon: formIcon }
				];
				sheetMode = 'closed';
				return;
			}

			const { data, error } = await supabase
				.from('habits')
				.insert([{ name, weekdays: formWeekdays, icon: formIcon }])
				.select('id, name, weekdays, icon')
				.single();

			if (error) {
				if (/icon|schema cache/i.test(error.message)) {
					iconsPersist = false;
					formError = ICON_SQL_HINT;
				} else {
					formError = error.message;
				}
				return;
			}

			iconsPersist = true;
			habits = [
				...habits,
				{
					id: data.id,
					name: data.name,
					weekdays: normalizeWeekdays(data.weekdays),
					icon: normalizeHabitIcon(data.icon)
				}
			];
			sheetMode = 'closed';
		} finally {
			formBusy = false;
		}
	};

	const saveEdit = async () => {
		if (!selectedHabit) return;
		const name = formName.trim();
		if (!name) {
			formError = 'Escribe un nombre para el hábito.';
			return;
		}
		if (formWeekdays.length === 0) {
			formError = 'Elige al menos un día de la semana.';
			return;
		}

		const habitId = selectedHabit.id;
		const previous = selectedHabit;
		formBusy = true;
		formError = '';

		try {
			if (!supabase || habitId < 0) {
				const next: Habit = {
					id: habitId,
					name,
					weekdays: [...formWeekdays],
					icon: formIcon
				};
				habits = habits.map((h) => (h.id === habitId ? next : h));
				selectedHabit = next;
				sheetMode = 'detail';
				return;
			}

			const { data, error } = await supabase
				.from('habits')
				.update({ name, weekdays: formWeekdays, icon: formIcon })
				.eq('id', habitId)
				.select('id, name, weekdays, icon')
				.single();

			if (error) {
				if (/icon|schema cache/i.test(error.message)) {
					iconsPersist = false;
					formError = ICON_SQL_HINT;
				} else {
					formError = error.message;
				}
				sheetMode = 'edit';
				return;
			}

			iconsPersist = true;
			const saved: Habit = {
				id: data.id,
				name: data.name,
				weekdays: normalizeWeekdays(data.weekdays),
				icon: normalizeHabitIcon(data.icon)
			};
			habits = habits.map((h) => (h.id === habitId ? saved : h));
			selectedHabit = saved;
			sheetMode = 'detail';
		} catch {
			habits = habits.map((h) => (h.id === habitId ? previous : h));
			selectedHabit = previous;
			formError = 'No se pudo guardar el hábito.';
			sheetMode = 'edit';
		} finally {
			formBusy = false;
		}
	};

	const deleteHabit = async () => {
		if (!selectedHabit) return;
		if (!confirm(`¿Eliminar el hábito “${selectedHabit.name}”?`)) return;

		const habit = selectedHabit;
		const previous = habits;
		const previousDone = doneKeys;

		habits = habits.filter((h) => h.id !== habit.id);
		doneKeys = new Set([...doneKeys].filter((k) => !k.startsWith(`${habit.id}:`)));
		sheetMode = 'closed';
		selectedHabit = null;

		if (!supabase || habit.id < 0) return;

		const { error } = await supabase.from('habits').delete().eq('id', habit.id);
		if (error) {
			habits = previous;
			doneKeys = previousDone;
			alert('Error al eliminar: ' + error.message);
		}
	};

	const toggleCell = async (habit: Habit, day: number) => {
		const weekday = weekdayForMonthDay(viewYear, viewMonth, day);
		if (!habitIsScheduledOn(habit, weekday)) return;
		if (habit.id < 0) return;

		const dateStr = formatDayKey(viewYear, viewMonth, day);
		const key = logKey(habit.id, dateStr);
		if (toggleBusyKey === key) return;

		const wasDone = doneKeys.has(key);
		const next = new Set(doneKeys);
		if (wasDone) next.delete(key);
		else next.add(key);
		doneKeys = next;
		toggleBusyKey = key;

		try {
			if (!supabase) return;

			if (wasDone) {
				const { error } = await supabase
					.from('habit_logs')
					.delete()
					.eq('habit_id', habit.id)
					.eq('date', dateStr);
				if (error) {
					doneKeys = new Set([...doneKeys, key]);
					console.warn('Error al desmarcar hábito:', error.message);
				}
			} else {
				const { error } = await supabase.from('habit_logs').insert({
					habit_id: habit.id,
					date: dateStr
				});
				if (error) {
					const rollback = new Set(doneKeys);
					rollback.delete(key);
					doneKeys = rollback;
					console.warn('Error al marcar hábito:', error.message);
				}
			}
		} finally {
			if (toggleBusyKey === key) toggleBusyKey = null;
		}
	};
</script>

<svelte:head>
	<title>Hábitos · Fokuz</title>
</svelte:head>

<header
	class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider"
>
	<div class="flex items-center gap-3">
		<RefreshCw class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Hábitos</h1>
	</div>
	{#if refreshing}
		<span class="text-[11px] text-brand-text-muted">Actualizando…</span>
	{/if}
</header>

<div class="flex-1 overflow-y-auto px-4 py-4 pb-28">
	<div class="flex items-center justify-between gap-2 mb-3 px-2">
		<button
			type="button"
			class="p-2 rounded-full bg-brand-surface text-brand-text-muted hover:text-brand-text transition-colors"
			onclick={prevMonth}
			aria-label="Mes anterior"
		>
			<ChevronLeft class="w-5 h-5" />
		</button>
		<div class="text-center">
			<p class="text-base font-bold text-brand-text">{MONTH_NAMES[viewMonth]} {viewYear}</p>
			<p class="text-[11px] font-semibold {healthTextClass(monthProgress.health)}">
				{monthProgress.done}/{monthProgress.total} · {monthProgress.pct}%
			</p>
		</div>
		<button
			type="button"
			class="p-2 rounded-full bg-brand-surface text-brand-text-muted hover:text-brand-text transition-colors"
			onclick={nextMonth}
			aria-label="Mes siguiente"
		>
			<ChevronRight class="w-5 h-5" />
		</button>
	</div>

	{#if !iconsPersist}
		<div
			class="mx-2 mb-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200"
		>
			Los iconos no se están guardando. Ejecuta en Supabase el SQL
			<span class="font-semibold">010_habit_icon.sql</span> y recarga.
		</div>
	{/if}

	{#if habits.length > 0}
		<div class="flex flex-wrap items-center justify-center gap-3 px-2 mb-4 text-[10px] text-brand-text-muted">
			<span class="inline-flex items-center gap-1">
				<span class="w-2 h-2 rounded-full bg-emerald-400"></span> ≥70%
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="w-2 h-2 rounded-full bg-amber-300"></span> 30–69%
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="w-2 h-2 rounded-full bg-red-400"></span> &lt;30%
			</span>
		</div>
	{/if}

	{#if loading && habits.length === 0}
		<div class="space-y-3 px-2">
			{#each [1, 2, 3] as _}
				<div class="h-12 rounded-xl bg-brand-surface skeleton"></div>
			{/each}
		</div>
	{:else if habits.length === 0}
		<div class="flex flex-col items-center justify-center text-center px-6 py-16">
			<div
				class="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-divider flex items-center justify-center mb-4"
			>
				<RefreshCw class="w-7 h-7 text-brand-accent" />
			</div>
			<h2 class="text-lg font-semibold text-brand-text mb-2">Sin hábitos aún</h2>
			<p class="text-brand-text-muted text-sm max-w-xs mb-6">
				Crea tu primer hábito y marca cada día en la matriz del mes.
			</p>
			<button
				type="button"
				class="bg-brand-accent text-brand-bg font-bold px-5 py-3 rounded-xl transition-colors hover:brightness-105"
				onclick={openCreate}
			>
				Crear hábito
			</button>
		</div>
	{:else}
		<div class="overflow-x-auto -mx-1 px-1 pb-2">
			<table class="border-separate border-spacing-y-2 border-spacing-x-1 min-w-max">
				<thead>
					<tr>
						<th class="sticky left-0 z-10 bg-brand-bg pr-1.5 text-left w-11">
							<span class="sr-only">Hábito</span>
						</th>
						{#each dayNumbers as day (day)}
							{@const dateStr = formatDayKey(viewYear, viewMonth, day)}
							<th
								class="w-8 p-0 text-center text-[10px] font-semibold {dateStr === todayKey
									? 'text-brand-accent'
									: 'text-brand-text-muted'}"
							>
								{day}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each habits as habit (habit.id)}
						{@const stats = habitStats.get(habit.id)}
						{@const health = stats?.health ?? 'neutral'}
						<tr>
							<th class="sticky left-0 z-10 bg-brand-bg pr-1.5 text-left align-middle w-11">
								<button
									type="button"
									class="relative w-9 h-9 rounded-xl border border-brand-divider bg-brand-surface flex items-center justify-center transition-colors hover:border-brand-accent/50 {healthTextClass(
										health
									)}"
									onclick={() => openDetail(habit)}
									title={habit.name}
									aria-label={habit.name}
								>
									<HabitIcon icon={habit.icon} class="w-4 h-4" />
									<span
										class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-brand-bg {healthDotClass(
											health
										)}"
									></span>
								</button>
							</th>
							{#each dayNumbers as day (day)}
								{@const weekday = weekdayForMonthDay(viewYear, viewMonth, day)}
								{@const scheduled = habitIsScheduledOn(habit, weekday)}
								{@const dateStr = formatDayKey(viewYear, viewMonth, day)}
								{@const key = logKey(habit.id, dateStr)}
								{@const done = doneKeys.has(key)}
								<td class="p-0 align-middle">
									{#if scheduled}
										<button
											type="button"
											class="w-8 h-8 rounded-md flex items-center justify-center border transition-colors {done
												? 'bg-brand-accent border-brand-accent text-brand-bg'
												: 'bg-brand-surface border-brand-divider hover:border-brand-accent/60'}"
											aria-label="{habit.name}, día {day}: {done ? 'cumplido' : 'pendiente'}"
											aria-pressed={done}
											onclick={() => toggleCell(habit, day)}
										>
											{#if done}
												<Check class="w-3.5 h-3.5" strokeWidth={3} />
											{:else}
												<span class="w-1.5 h-1.5 rounded-full bg-brand-divider"></span>
											{/if}
										</button>
									{:else}
										<div class="w-8 h-8 rounded-md bg-brand-bg/40" aria-hidden="true"></div>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-[11px] text-brand-text-muted px-2 mt-2">
			Toca el icono para ver el nombre, editar o borrar. Toca una celda para marcar el día.
		</p>
	{/if}
</div>

{#if habits.length > 0}
	<button
		type="button"
		class="absolute bottom-24 right-6 w-14 h-14 bg-brand-accent hover:brightness-105 text-brand-bg rounded-full shadow-lg shadow-black/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-20"
		onclick={openCreate}
		aria-label="Crear hábito"
	>
		<Plus class="w-7 h-7" />
	</button>
{/if}

{#if sheetMode !== 'closed'}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="absolute inset-0 bg-black/50 z-30" onclick={closeSheet}></div>
	<div
		class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 shadow-2xl border-t border-brand-divider max-h-[85%] overflow-y-auto"
	>
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		{#if sheetMode === 'detail' && selectedHabit}
			<div class="flex justify-between items-start gap-3 mb-4">
				<div class="flex items-start gap-3 min-w-0">
					<span
						class="w-11 h-11 rounded-xl border border-brand-divider bg-brand-bg flex items-center justify-center shrink-0 {healthTextClass(
							selectedStats?.health ?? 'neutral'
						)}"
					>
						<HabitIcon icon={selectedHabit.icon} class="w-5 h-5" />
					</span>
					<div class="min-w-0">
						<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-1">Hábito</p>
						<h3 class="text-lg font-bold text-brand-text break-words">{selectedHabit.name}</h3>
					</div>
				</div>
				<button
					type="button"
					class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text transition-colors shrink-0"
					onclick={closeSheet}
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			{#if selectedStats}
				<div class="rounded-xl border border-brand-divider bg-brand-bg px-4 py-3 mb-5">
					<div class="flex items-center justify-between gap-2 mb-1">
						<span class="text-sm font-semibold {healthTextClass(selectedStats.health)}">
							{habitHealthLabel(selectedStats.health)}
						</span>
						<span class="text-sm font-bold {healthTextClass(selectedStats.health)}">
							{selectedStats.pct}%
						</span>
					</div>
					<p class="text-[11px] text-brand-text-muted">
						{selectedStats.done} de {selectedStats.total} días programados en {MONTH_NAMES[viewMonth]}
					</p>
					<p class="text-[11px] text-brand-text-muted mt-1">
						≥70% verde · 30–69% amarillo · &lt;30% rojo
					</p>
				</div>
			{/if}

			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Frecuencia</p>
			<div class="flex flex-wrap gap-1.5 mb-6">
				{#each WEEKDAY_LABELS as label, day (day)}
					<span
						class="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center {selectedHabit.weekdays.includes(
							day
						)
							? 'bg-brand-accent text-brand-bg'
							: 'bg-brand-bg text-brand-text-muted'}"
						title={WEEKDAY_NAMES[day]}
					>
						{label}
					</span>
				{/each}
			</div>

			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="flex items-center justify-center gap-2 py-3.5 rounded-xl border border-brand-divider text-brand-text font-semibold hover:border-brand-accent hover:text-brand-accent transition-colors"
					onclick={openEdit}
				>
					<Pencil class="w-4 h-4" />
					Editar
				</button>
				<button
					type="button"
					class="flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-400/40 text-red-400 font-semibold hover:bg-red-500/10 transition-colors"
					onclick={deleteHabit}
				>
					<Trash2 class="w-4 h-4" />
					Eliminar
				</button>
			</div>
		{:else}
			<div class="flex justify-between items-center mb-6">
				<h3 class="text-lg font-bold text-brand-text">
					{sheetMode === 'edit' ? 'Editar hábito' : 'Crear hábito'}
				</h3>
				<button
					type="button"
					class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text transition-colors"
					onclick={() => {
						if (sheetMode === 'edit' && selectedHabit) sheetMode = 'detail';
						else closeSheet();
					}}
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<label
				class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2"
				for="habit-name"
			>
				Nombre
			</label>
			<input
				id="habit-name"
				type="text"
				bind:value={formName}
				placeholder="Ej. Meditar, Leer, Ejercicio…"
				class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-5"
			/>

			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Icono</p>
			<div class="grid grid-cols-5 gap-2 mb-5">
				{#each HABIT_ICON_OPTIONS as opt (opt.id)}
					<button
						type="button"
						class="aspect-square rounded-xl flex items-center justify-center border transition-colors {formIcon ===
						opt.id
							? 'border-brand-accent bg-brand-accent text-brand-bg'
							: 'border-brand-divider bg-brand-bg text-brand-text-muted'}"
						title={opt.label}
						aria-label={opt.label}
						aria-pressed={formIcon === opt.id}
						onclick={() => (formIcon = opt.id)}
					>
						<HabitIcon icon={opt.id} class="w-5 h-5" />
					</button>
				{/each}
			</div>

			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Frecuencia</p>
			<div class="grid grid-cols-7 gap-2 mb-2">
				{#each WEEKDAY_LABELS as label, day (day)}
					<button
						type="button"
						class="aspect-square rounded-xl text-sm font-bold transition-colors {formWeekdays.includes(day)
							? 'bg-brand-accent text-brand-bg'
							: 'bg-brand-bg text-brand-text-muted'}"
						title={WEEKDAY_NAMES[day]}
						aria-pressed={formWeekdays.includes(day)}
						onclick={() => toggleWeekday(day)}
					>
						{label}
					</button>
				{/each}
			</div>
			<p class="text-[11px] text-brand-text-muted mb-5">
				Selecciona los días en que debes cumplir este hábito.
			</p>

			{#if formError}
				<p class="text-sm text-red-400 mb-3">{formError}</p>
			{/if}

			<button
				type="button"
				class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
				onclick={() => (sheetMode === 'edit' ? saveEdit() : createHabit())}
				disabled={formBusy}
			>
				{#if sheetMode === 'edit'}
					<Pencil class="w-5 h-5" />
					Guardar cambios
				{:else}
					<Plus class="w-5 h-5" />
					Crear hábito
				{/if}
			</button>
		{/if}
	</div>
{/if}
