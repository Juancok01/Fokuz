<script lang="ts">
	import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, X } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import {
		WEEKDAY_LABELS,
		WEEKDAY_NAMES,
		daysInMonth,
		formatDateInTz,
		formatDayKey,
		habitIsScheduledOn,
		normalizeWeekdays,
		weekdayForMonthDay,
		type Habit
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

	const today = new Date();
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	let habits = $state<Habit[]>([]);
	/** Claves `${habitId}:${YYYY-MM-DD}` */
	let doneKeys = $state(new Set<string>());
	let loading = $state(true);
	let refreshing = $state(false);
	let fetchId = 0;
	let loadedMonthKey = $state<string | null>(null);

	let showCreate = $state(false);
	let newName = $state('');
	let newWeekdays = $state<number[]>([1, 2, 3, 4, 5]);
	let createError = $state('');
	let createBusy = $state(false);
	let toggleBusyKey = $state<string | null>(null);

	const monthKey = $derived(`${viewYear}-${viewMonth}`);
	const dayCount = $derived(daysInMonth(viewYear, viewMonth));
	const todayKey = $derived(formatDateInTz());
	const dayNumbers = $derived(Array.from({ length: dayCount }, (_, i) => i + 1));

	const logKey = (habitId: number, dateStr: string) => `${habitId}:${dateStr}`;

	const loadMonth = async () => {
		const requestId = ++fetchId;
		const key = `${viewYear}-${viewMonth}`;
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

			const start = formatDayKey(viewYear, viewMonth, 1);
			const end = formatDayKey(viewYear, viewMonth, dayCount);

			const [habitsResult, logsResult] = await Promise.all([
				supabase.from('habits').select('id, name, weekdays').order('created_at', { ascending: true }),
				supabase
					.from('habit_logs')
					.select('habit_id, date')
					.gte('date', start)
					.lte('date', end)
			]);

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
				weekdays: normalizeWeekdays(h.weekdays)
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

	// Solo reaccionar al mes; untrack evita bucle con habits/loading
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

	const openCreate = () => {
		newName = '';
		newWeekdays = [1, 2, 3, 4, 5];
		createError = '';
		showCreate = true;
	};

	const toggleWeekday = (day: number) => {
		if (newWeekdays.includes(day)) {
			if (newWeekdays.length === 1) return;
			newWeekdays = newWeekdays.filter((d) => d !== day);
		} else {
			newWeekdays = [...newWeekdays, day].sort((a, b) => a - b);
		}
	};

	const createHabit = async () => {
		const name = newName.trim();
		if (!name) {
			createError = 'Escribe un nombre para el hábito.';
			return;
		}
		if (newWeekdays.length === 0) {
			createError = 'Elige al menos un día de la semana.';
			return;
		}

		createBusy = true;
		createError = '';

		const tempId = -Date.now();
		const optimistic: Habit = { id: tempId, name, weekdays: [...newWeekdays] };
		habits = [...habits, optimistic];
		showCreate = false;

		try {
			if (!supabase) return;

			const { data, error } = await supabase
				.from('habits')
				.insert([{ name, weekdays: newWeekdays }])
				.select('id, name, weekdays')
				.single();

			if (error) {
				habits = habits.filter((h) => h.id !== tempId);
				createError = error.message;
				showCreate = true;
				return;
			}

			habits = habits.map((h) =>
				h.id === tempId
					? { id: data.id, name: data.name, weekdays: normalizeWeekdays(data.weekdays) }
					: h
			);
		} finally {
			createBusy = false;
		}
	};

	const deleteHabit = async (habit: Habit) => {
		if (!confirm(`¿Eliminar el hábito “${habit.name}”?`)) return;

		const previous = habits;
		const previousDone = doneKeys;
		habits = habits.filter((h) => h.id !== habit.id);
		doneKeys = new Set([...doneKeys].filter((k) => !k.startsWith(`${habit.id}:`)));

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

	const monthProgress = $derived.by(() => {
		let total = 0;
		let done = 0;
		for (const habit of habits) {
			for (let day = 1; day <= dayCount; day++) {
				const weekday = weekdayForMonthDay(viewYear, viewMonth, day);
				if (!habitIsScheduledOn(habit, weekday)) continue;
				total += 1;
				if (doneKeys.has(logKey(habit.id, formatDayKey(viewYear, viewMonth, day)))) done += 1;
			}
		}
		return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
	});
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
	<!-- Mes -->
	<div class="flex items-center justify-between gap-2 mb-4 px-2">
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
			<p class="text-[11px] text-brand-text-muted">
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
		<!-- Matriz: filas = hábitos, columnas = días -->
		<div class="overflow-x-auto -mx-1 px-1 pb-2">
			<table class="border-separate border-spacing-y-2 border-spacing-x-1 min-w-max">
				<thead>
					<tr>
						<th class="sticky left-0 z-10 bg-brand-bg pr-2 text-left">
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
						<tr>
							<th
								class="sticky left-0 z-10 bg-brand-bg pr-2 text-left align-middle max-w-[7.5rem]"
							>
								<div class="flex items-center gap-1 group">
									<span class="text-xs font-medium text-brand-text truncate" title={habit.name}>
										{habit.name}
									</span>
									<button
										type="button"
										class="p-1 text-brand-text-muted/40 hover:text-red-400 transition-colors shrink-0"
										onclick={() => deleteHabit(habit)}
										aria-label="Eliminar {habit.name}"
									>
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								</div>
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
												: 'bg-brand-surface border-brand-divider text-transparent hover:border-brand-accent/60'}"
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
										<div
											class="w-8 h-8 rounded-md bg-brand-bg/40"
											aria-hidden="true"
											title="No programado"
										></div>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-[11px] text-brand-text-muted px-2 mt-2">
			Toca una celda para marcar o desmarcar. Las celdas vacías no aplican ese día.
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

{#if showCreate}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute inset-0 bg-black/50 z-30 transition-opacity"
		onclick={() => {
			if (!createBusy) showCreate = false;
		}}
	></div>
	<div
		class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 shadow-2xl border-t border-brand-divider max-h-[85%] overflow-y-auto"
	>
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Crear hábito</h3>
			<button
				type="button"
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text transition-colors"
				onclick={() => (showCreate = false)}
				aria-label="Cerrar"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<label class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2" for="habit-name">
			Nombre
		</label>
		<input
			id="habit-name"
			type="text"
			bind:value={newName}
			placeholder="Ej. Meditar, Leer, Ejercicio…"
			class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-5"
		/>

		<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Frecuencia</p>
		<div class="grid grid-cols-7 gap-2 mb-2">
			{#each WEEKDAY_LABELS as label, day (day)}
				<button
					type="button"
					class="aspect-square rounded-xl text-sm font-bold transition-colors {newWeekdays.includes(day)
						? 'bg-brand-accent text-brand-bg'
						: 'bg-brand-bg text-brand-text-muted'}"
					title={WEEKDAY_NAMES[day]}
					aria-pressed={newWeekdays.includes(day)}
					onclick={() => toggleWeekday(day)}
				>
					{label}
				</button>
			{/each}
		</div>
		<p class="text-[11px] text-brand-text-muted mb-5">
			Selecciona los días en que debes cumplir este hábito.
		</p>

		{#if createError}
			<p class="text-sm text-red-400 mb-3">{createError}</p>
		{/if}

		<button
			type="button"
			class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
			onclick={createHabit}
			disabled={createBusy}
		>
			<Plus class="w-5 h-5" />
			Crear hábito
		</button>
	</div>
{/if}
