<script lang="ts">
	import {
		Check,
		ChevronLeft,
		ChevronRight,
		Pencil,
		Plus,
		RefreshCw,
		Trash2,
		X,
		Flame,
		Zap,
		TrendingUp,
		Info
	} from '@lucide/svelte';
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
				return 'text-brand-accent text-shadow-sm';
			case 'yellow':
				return 'text-amber-400';
			case 'red':
				return 'text-red-400';
			default:
				return 'text-brand-text-muted';
		}
	};

	const healthDotClass = (health: HabitHealth) => {
		switch (health) {
			case 'green':
				return 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]';
			case 'yellow':
				return 'bg-amber-400 shadow-[0_0_8px_var(--color-amber-400)]';
			case 'red':
				return 'bg-red-400 shadow-[0_0_8px_var(--color-red-400)]';
			default:
				return 'bg-brand-divider';
		}
	};

	const today = new Date();
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	type HabitWithMockData = Habit & { streak: number };
	let habits = $state<HabitWithMockData[]>([]);
	let customCategories = $state<string[]>([]);
	let currentFilter = $state('Todos');
	const availableCategories = $derived([...new Set(['General', ...customCategories, ...habits.map((h) => h.tag || 'General')])]);
	const filters = $derived(['Todos', ...availableCategories]);
	const filteredHabits = $derived(
		currentFilter === 'Todos' ? habits : habits.filter((h) => (h.tag || 'General') === currentFilter)
	);

	/** Claves `${habitId}:${YYYY-MM-DD}` */
	let doneKeys = $state(new Set<string>());
	let loading = $state(true);
	let refreshing = $state(false);
	let fetchId = 0;
	let loadedMonthKey: string | null = null;

	let sheetMode = $state<'closed' | 'create' | 'detail' | 'edit' | 'delete-confirm' | 'manage-categories'>('closed');
	let selectedHabit = $state<HabitWithMockData | null>(null);
	let formName = $state('');
	let formTag = $state('General');
	let formNewCategory = $state('');
	let categoryError = $state('');
	let editingCategory = $state<{ old: string; new: string } | null>(null);
	let formIcon = $state<HabitIconId>('sparkles');
	let formWeekdays = $state<number[]>([1, 2, 3, 4, 5]);
	let formError = $state('');
	let formBusy = $state(false);
	let toggleBusyKey = $state<string | null>(null);
	/** false si falta la columna icon o tag en Supabase (SQL 010, 011) */
	let iconsPersist = $state(true);

	const ICON_SQL_HINT =
		'No se pudo guardar. En Supabase → SQL Editor, asegúrate de tener las columnas "icon" y "tag" en la tabla habits y vuelve a intentar.';

	const dayCount = $derived(daysInMonth(viewYear, viewMonth));
	const todayKey = $derived(formatDateInTz());
	const dayNumbers = $derived(Array.from({ length: dayCount }, (_, i) => i + 1));

	const logKey = (habitId: number, dateStr: string) => `${habitId}:${dateStr}`;

	const habitStats = $derived.by(() => {
		const map = new Map<number, { total: number; done: number; pct: number; health: HabitHealth; streak: number }>();
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

			// Calculate max streak in the month
			let maxStreak = 0;
			let currentStreak = 0;
			const isCurrentMonth = (viewYear === today.getFullYear() && viewMonth === today.getMonth());
			const endDay = isCurrentMonth ? today.getDate() : dayCount;

			for (let d = 1; d <= endDay; d++) {
				const w = weekdayForMonthDay(viewYear, viewMonth, d);
				if (habitIsScheduledOn(habit, w)) {
					if (doneKeys.has(logKey(habit.id, formatDayKey(viewYear, viewMonth, d)))) {
						currentStreak++;
						if (currentStreak > maxStreak) {
							maxStreak = currentStreak;
						}
					} else {
						currentStreak = 0;
					}
				}
			}
			const streak = maxStreak;

			map.set(habit.id, { total, done, pct, health: habitHealthFromPct(pct, total), streak });
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

	const perfectDays = $derived.by(() => {
		if (habits.length === 0) return 0;
		let count = 0;
		for (let day = 1; day <= dayCount; day++) {
			const weekday = weekdayForMonthDay(viewYear, viewMonth, day);
			let scheduled = 0;
			let done = 0;
			for (const h of habits) {
				if (habitIsScheduledOn(h, weekday)) {
					scheduled++;
					if (doneKeys.has(logKey(h.id, formatDayKey(viewYear, viewMonth, day)))) {
						done++;
					}
				}
			}
			if (scheduled > 0 && done === scheduled) {
				count++;
			}
		}
		return count;
	});

	const strongestHabit = $derived.by(() => {
		if (habits.length === 0) return null;
		let best = null;
		
		for (const habit of habits) {
			const stats = habitStats.get(habit.id);
			if (!stats) continue;
			
			if (!best) {
				best = { habit, stats };
				continue;
			}
			
			if (stats.pct > best.stats.pct) {
				best = { habit, stats };
			} else if (stats.pct === best.stats.pct) {
				if (stats.streak > best.stats.streak) {
					best = { habit, stats };
				}
			}
		}
		return best;
	});

	const disciplinePeak = $derived.by(() => {
		if (habits.length === 0) return null;
		
		// Map from weekday (0-6) to { total, done }
		const dayStats = new Map<number, { total: number, done: number }>();
		for (let i = 0; i <= 6; i++) {
			dayStats.set(i, { total: 0, done: 0 });
		}

		for (let day = 1; day <= dayCount; day++) {
			const weekday = weekdayForMonthDay(viewYear, viewMonth, day);
			for (const h of habits) {
				if (habitIsScheduledOn(h, weekday)) {
					const stats = dayStats.get(weekday)!;
					stats.total++;
					if (doneKeys.has(logKey(h.id, formatDayKey(viewYear, viewMonth, day)))) {
						stats.done++;
					}
				}
			}
		}

		let bestDays: number[] = [];
		let bestPct = -1;

		for (const [day, stats] of dayStats.entries()) {
			if (stats.total > 0) {
				const pct = Math.round((stats.done / stats.total) * 100);
				if (pct > bestPct) {
					bestPct = pct;
					bestDays = [day];
				} else if (pct === bestPct && pct > 0) {
					bestDays.push(day);
				}
			}
		}

		if (bestDays.length === 0 || bestPct === 0) return null;

		const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
		const daysStr = bestDays.length > 2 
			? `${bestDays.length} días empatados`
			: bestDays.map(d => capitalize(WEEKDAY_NAMES[d])).join(' & ');

		return {
			days: daysStr,
			pct: bestPct
		};
	});

	const weakestHabits = $derived.by(() => {
		if (habits.length === 0) return [];
		let worstScore = Infinity;
		let worstList: typeof habits = [];
		
		for (const habit of habits) {
			const stats = habitStats.get(habit.id);
			if (!stats) continue;
			
			const score = stats.pct * 1000 + stats.streak;
			
			if (score < worstScore) {
				worstScore = score;
				worstList = [habit];
			} else if (score === worstScore) {
				worstList.push(habit);
			}
		}
		return worstList;
	});

	const FOKUZ_QUOTES = [
		"La consistencia vence a la intensidad. Pequeñas victorias diarias forjan un carácter inquebrantable.",
		"No te elevas al nivel de tus metas, caes al nivel de tus sistemas.",
		"El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
		"La motivación te hace empezar, el hábito te mantiene en marcha.",
		"Céntrate en el progreso, no en la perfección.",
		"Un viaje de mil millas comienza con un solo paso.",
		"Tus hábitos de hoy determinan tu futuro de mañana."
	];
	const dailyQuote = $derived(FOKUZ_QUOTES[today.getDate() % FOKUZ_QUOTES.length]);

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
					.select('id, name, weekdays, icon, tag')
					.order('created_at', { ascending: true }),
				supabase.from('habit_logs').select('habit_id, date').gte('date', start).lte('date', end)
			]);

			if (habitsResult.error && /icon|tag|schema cache/i.test(habitsResult.error.message)) {
				iconsPersist = false;
				habitsResult = await supabase
					.from('habits')
					.select('id, name, weekdays')
					.order('created_at', { ascending: true }) as any;
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

			doneKeys = new Set(
				(logsResult.data ?? []).map((row) => logKey(row.habit_id, row.date as string))
			);

			habits = (habitsResult.data ?? []).map((h) => {
				const tag = (h as any).tag || 'General';
				
				// Calculate streak back from today/end of month
				let streak = 0;
				const isCurrentMonth = (viewYear === today.getFullYear() && viewMonth === today.getMonth());
				const endDay = isCurrentMonth ? today.getDate() : days;
				
				for (let d = endDay; d >= 1; d--) {
					const w = weekdayForMonthDay(viewYear, viewMonth, d);
					if (habitIsScheduledOn({ weekdays: h.weekdays } as Habit, w)) {
						if (doneKeys.has(logKey(h.id, formatDayKey(viewYear, viewMonth, d)))) {
							streak++;
						} else {
							// Missed a scheduled day, break streak
							// Unless it's today and not done yet (just ignore today in that case)
							if (isCurrentMonth && d === endDay) {
								continue; 
							} else {
								break;
							}
						}
					}
				}

				return {
					id: h.id,
					name: h.name,
					weekdays: normalizeWeekdays(h.weekdays),
					icon: normalizeHabitIcon((h as { icon?: string | null }).icon),
					streak,
					tag
				};
			});
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

	$effect(() => {
		const stored = localStorage.getItem('fokuz-categories');
		if (stored) {
			try {
				customCategories = JSON.parse(stored);
			} catch {}
		}
	});

	$effect(() => {
		if (customCategories.length > 0) {
			localStorage.setItem('fokuz-categories', JSON.stringify(customCategories));
		}
	});

	const addCategory = () => {
		const cat = formNewCategory.trim();
		if (cat && !customCategories.includes(cat)) {
			customCategories = [...customCategories, cat];
		}
		formNewCategory = '';
		categoryError = '';
	};

	const removeCategory = (cat: string) => {
		const inUse = habits.some((h) => (h.tag || 'General') === cat);
		if (inUse) {
			categoryError = `No puedes eliminar "${cat}" porque está asignada a uno o más hábitos activos.`;
			return;
		}
		customCategories = customCategories.filter((c) => c !== cat);
		categoryError = '';
	};

	const startEditCategory = (cat: string) => {
		editingCategory = { old: cat, new: cat };
		categoryError = '';
	};

	const saveEditCategory = async () => {
		if (!editingCategory) return;
		const oldCat = editingCategory.old;
		const newCat = editingCategory.new.trim();
		
		if (!newCat || newCat === oldCat) {
			editingCategory = null;
			return;
		}

		// Update custom categories
		if (customCategories.includes(oldCat)) {
			customCategories = customCategories.map((c) => (c === oldCat ? newCat : c));
		} else if (!customCategories.includes(newCat)) {
			customCategories = [...customCategories, newCat];
		}

		// Update local habits
		const hasHabits = habits.some(h => (h.tag || 'General') === oldCat);
		if (hasHabits) {
			habits = habits.map((h) => ((h.tag || 'General') === oldCat ? { ...h, tag: newCat } : h));
			
			// Update in Supabase
			if (supabase) {
				const { error } = await supabase.from('habits').update({ tag: newCat }).eq('tag', oldCat);
				if (error) {
					categoryError = 'Error al renombrar en la base de datos: ' + error.message;
				}
			}
		}

		editingCategory = null;
	};

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
		formTag = 'General';
		formIcon = 'sparkles';
		formWeekdays = [1, 2, 3, 4, 5];
		formError = '';
		sheetMode = 'create';
	};

	const openDetail = (habit: HabitWithMockData) => {
		selectedHabit = habit;
		formError = '';
		sheetMode = 'detail';
	};

	const openEdit = () => {
		if (!selectedHabit) return;
		formName = selectedHabit.name;
		formTag = selectedHabit.tag || 'General';
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
					{ id: tempId, name, weekdays: [...formWeekdays], icon: formIcon, streak: 0, tag: formTag.trim() || 'General' }
				];
				sheetMode = 'closed';
				return;
			}

			const { data, error } = await supabase
				.from('habits')
				.insert([{ name, weekdays: formWeekdays, icon: formIcon, tag: formTag.trim() || 'General' }])
				.select('id, name, weekdays, icon, tag')
				.single();

			if (error) {
				if (/icon|tag|schema cache/i.test(error.message)) {
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
					icon: normalizeHabitIcon(data.icon),
					streak: 0,
					tag: data.tag || formTag.trim() || 'General'
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
				const next = {
					id: habitId,
					name,
					weekdays: [...formWeekdays],
					icon: formIcon,
					streak: selectedHabit.streak,
					tag: formTag.trim() || 'General'
				};
				habits = habits.map((h) => (h.id === habitId ? next : h));
				selectedHabit = next;
				sheetMode = 'detail';
				return;
			}

			const { data, error } = await supabase
				.from('habits')
				.update({ name, weekdays: formWeekdays, icon: formIcon, tag: formTag.trim() || 'General' })
				.eq('id', habitId)
				.select('id, name, weekdays, icon, tag')
				.single();

			if (error) {
				if (/icon|tag|schema cache/i.test(error.message)) {
					iconsPersist = false;
					formError = ICON_SQL_HINT;
				} else {
					formError = error.message;
				}
				sheetMode = 'edit';
				return;
			}

			iconsPersist = true;
			const saved = {
				id: data.id,
				name: data.name,
				weekdays: normalizeWeekdays(data.weekdays),
				icon: normalizeHabitIcon(data.icon),
				streak: selectedHabit.streak,
				tag: data.tag || formTag.trim() || 'General'
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

<div class="flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-32 w-full max-w-7xl mx-auto">
	<!-- Top Section -->
	<header class="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
		<div>
			<div class="flex flex-col md:flex-row md:items-center gap-3">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-brand-surface border border-brand-divider rounded-xl flex items-center justify-center shadow-sm">
						<RefreshCw class="w-5 h-5 text-brand-accent" />
					</div>
					<h1 class="text-2xl font-bold text-brand-text tracking-tight">Hábitos</h1>
				</div>
				<span class="text-[10px] font-bold px-3 py-1 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 rounded-full shrink-0 w-fit md:ml-2">
					{MONTH_NAMES[viewMonth]} {viewYear}
				</span>
			</div>
			<p class="text-[13px] text-brand-text-muted mt-3 xl:max-w-xl leading-relaxed">
				Monitorea el progreso sostenido de cada hábito a lo largo del mes. Toca cualquier casilla para alternar estado.
			</p>
		</div>

		<div class="flex flex-col md:flex-row gap-4">
			<div class="flex items-center justify-between bg-[#0d1216] border border-brand-divider rounded-2xl p-1 shadow-inner h-fit w-full md:w-auto">
				<button type="button" class="p-2 hover:bg-brand-surface-elevated rounded-xl transition-colors" onclick={prevMonth} aria-label="Mes anterior">
					<ChevronLeft class="w-4 h-4 text-brand-text-muted" />
				</button>
				<div class="px-4 text-center min-w-35 flex-1">
					<p class="text-sm font-bold text-brand-text">
						<span class="md:hidden">{MONTH_NAMES[viewMonth].substring(0, 3)} {viewYear}</span>
						<span class="hidden md:inline">{MONTH_NAMES[viewMonth]} {viewYear}</span>
					</p>
					<p class="text-[10px] text-brand-text-muted font-semibold mt-0.5">{dayCount} Días</p>
				</div>
				<button type="button" class="p-2 hover:bg-brand-surface-elevated rounded-xl transition-colors" onclick={nextMonth} aria-label="Mes siguiente">
					<ChevronRight class="w-4 h-4 text-brand-text-muted" />
				</button>
			</div>

			<div class="flex flex-row flex-nowrap gap-3 shrink-0 overflow-x-auto custom-scrollbar w-full md:w-auto pb-2 md:pb-0">
				<div class="bg-[#0d1216] border border-brand-divider rounded-2xl px-4 py-2 flex items-center gap-3 shadow-inner h-fit shrink-0 flex-1 md:flex-none">
					<div class="text-brand-bg font-bold bg-brand-accent rounded-md px-2 py-1 text-xs">
						{monthProgress.pct}%
					</div>
					<div>
						<p class="text-[9px] text-brand-text-muted uppercase tracking-wider font-semibold">Cumplimiento</p>
						<p class="text-xs font-bold text-brand-text">{monthProgress.done}/{monthProgress.total}</p>
					</div>
				</div>
				<div class="bg-[#0d1216] border border-brand-divider rounded-2xl px-4 py-2 flex items-center gap-3 shadow-inner h-fit shrink-0 flex-1 md:flex-none">
					<div class="text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded-md p-1.5">
						<Flame class="w-4 h-4" />
					</div>
					<div>
						<p class="text-[9px] text-brand-text-muted uppercase tracking-wider font-semibold">Perfectos</p>
						<p class="text-xs font-bold text-brand-text">{perfectDays} días {perfectDays === 1 ? 'logrado' : 'logrados'}</p>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Filters & Legend -->
	<div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 mt-8 px-1">
		<div class="flex flex-wrap items-center gap-2">
			{#each filters as filter}
				<button 
					type="button"
					class="px-4 py-1.5 rounded-full text-xs font-bold transition-all border {currentFilter === filter ? 'bg-brand-accent text-brand-bg border-brand-accent shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'bg-[#0d1216] text-brand-text-muted border-brand-divider hover:bg-brand-surface-elevated hover:text-brand-text'}"
					onclick={() => currentFilter = filter}
				>
					{filter} {filter === 'Todos' ? `(${habits.length})` : ''}
				</button>
			{/each}
			<button 
				type="button"
				class="px-3 py-1.5 rounded-full text-xs font-bold transition-all border bg-[#0d1216] text-brand-text-muted border-brand-divider hover:bg-brand-surface-elevated hover:text-brand-accent hover:border-brand-accent flex items-center gap-1 shadow-inner"
				onclick={() => { formNewCategory = ''; categoryError = ''; sheetMode = 'manage-categories'; }}
				title="Gestionar categorías"
			>
				<Plus class="w-3.5 h-3.5" />
			</button>
		</div>

		<div class="flex flex-wrap items-center gap-4 text-[11px] font-semibold bg-brand-surface-elevated px-4 py-2 rounded-full border border-brand-divider w-fit">
			<span class="text-brand-text-muted hidden sm:inline">Rendimiento:</span>
			<span class="flex items-center gap-1.5 text-brand-text"><span class="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]"></span> ≥70% Óptimo</span>
			<span class="flex items-center gap-1.5 text-brand-text"><span class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_var(--color-amber-400)]"></span> 30–69% En progreso</span>
			<span class="flex items-center gap-1.5 text-brand-text"><span class="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_var(--color-red-400)]"></span> &lt;30% Incompleto</span>
		</div>
	</div>

	<!-- Matrix Table Container -->
	{#if loading && habits.length === 0}
		<div class="space-y-4 mt-4">
			{#each [1, 2, 3, 4] as _}
				<div class="h-20 rounded-2xl bg-brand-surface skeleton border border-brand-divider"></div>
			{/each}
		</div>
	{:else if habits.length === 0}
		<div class="flex flex-col items-center justify-center text-center px-6 py-20 bg-brand-surface border border-brand-divider rounded-3xl mt-4 shadow-sm">
			<div class="w-16 h-16 rounded-3xl bg-brand-bg border border-brand-divider flex items-center justify-center mb-6 shadow-inner">
				<RefreshCw class="w-8 h-8 text-brand-accent" />
			</div>
			<h2 class="text-xl font-bold text-brand-text mb-2">No hay hábitos configurados</h2>
			<p class="text-brand-text-muted text-sm max-w-sm mb-8 leading-relaxed">
				Empieza a construir una vida con propósito creando tu primer hábito y marcando cada día en la matriz del mes.
			</p>
			<button type="button" class="bg-brand-accent text-brand-bg font-bold px-6 py-3.5 rounded-xl transition-all hover:brightness-105 hover:scale-105 shadow-lg shadow-brand-accent/20 flex items-center gap-2" onclick={openCreate}>
				<Plus class="w-5 h-5" /> Añadir mi primer hábito
			</button>
		</div>
	{:else}
		<div class="rounded-3xl border border-brand-divider bg-[#0d1216] overflow-hidden shadow-2xl relative mt-4">
			<!-- Header Info Row -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-brand-divider bg-brand-surface gap-2">
				<div class="flex items-center gap-2 text-brand-text-muted">
					<Info class="w-4 h-4 shrink-0" />
					<span class="text-[11px] font-medium leading-tight">Toca el icono para ver opciones del hábito o pulsa directamente cualquier día para registrarlo.</span>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<span class="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]"></span>
					<span class="text-[11px] font-bold text-brand-accent">Día actual: {new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' }).format(today)}</span>
				</div>
			</div>

			<div class="overflow-x-auto custom-scrollbar">
				<table class="w-full border-collapse min-w-max">
					<thead>
						<tr>
							<th class="sticky left-0 z-20 bg-brand-surface border-b border-r border-brand-divider text-left py-4 px-3 md:px-6 w-45 md:w-80 font-bold text-[10px] text-brand-text-muted tracking-widest uppercase">
								Hábito & Categoría
							</th>
							{#each dayNumbers as day (day)}
								{@const dateStr = formatDayKey(viewYear, viewMonth, day)}
								{@const weekday = weekdayForMonthDay(viewYear, viewMonth, day)}
								{@const isToday = dateStr === todayKey}
								<th class="py-3 px-1 border-b border-brand-divider text-center min-w-9 {isToday ? 'bg-brand-accent border-b-brand-accent' : 'bg-transparent'} transition-colors">
									<div class="flex flex-col items-center justify-center gap-0.5">
										<span class="text-[9px] font-bold uppercase {isToday ? 'text-brand-bg/80' : 'text-brand-text-muted/60'}">{WEEKDAY_LABELS[weekday]}</span>
										<span class="text-sm font-black {isToday ? 'text-brand-bg' : 'text-brand-text'}">{day}</span>
									</div>
								</th>
							{/each}
							<th class="border-b border-brand-divider w-4"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-brand-divider/50">
						{#each filteredHabits as habit (habit.id)}
							{@const stats = habitStats.get(habit.id)}
							{@const health = stats?.health ?? 'neutral'}
							<tr class="group transition-colors hover:bg-brand-surface/30">
								<th class="sticky left-0 z-10 bg-[#0d1216] border-r border-brand-divider p-0 align-middle w-45 md:w-80 group-hover:bg-[#12181d] transition-colors">
									<div class="flex items-center gap-2 md:gap-4 py-3 px-3 md:px-6">
										<!-- Left Icon -->
										<button
											type="button"
											class="relative w-12 h-12 shrink-0 rounded-xl border bg-brand-surface flex items-center justify-center transition-all hover:scale-105 shadow-inner {habitHealthLabel(health) === 'En buen camino' ? 'border-brand-accent/30 text-brand-accent shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'border-brand-divider text-brand-text-muted'}"
											onclick={() => openDetail(habit)}
											title={habit.name}
										>
											<HabitIcon icon={habit.icon} class="w-5 h-5 {healthTextClass(health)}" />
											<!-- Health indicator dot -->
											<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#0d1216] {healthDotClass(health)}"></span>
										</button>
										
										<!-- Habit Info -->
										<div class="flex-1 min-w-0 flex flex-col items-start gap-1">
											<span class="text-sm font-bold text-brand-text truncate w-full text-left leading-tight">
												{habit.name}
											</span>
											<div class="flex items-center gap-2">
												<span class="px-2 py-0.5 rounded-md bg-[#1a2228] border border-brand-divider text-[9px] font-bold text-brand-accent">
													{habit.tag}
												</span>
												<span class="flex items-center gap-1 text-[10px] font-bold text-orange-500">
													<Flame class="w-3 h-3" /> {stats?.streak ?? 0} d
												</span>
											</div>
										</div>
									</div>
								</th>

								{#each dayNumbers as day (day)}
									{@const weekday = weekdayForMonthDay(viewYear, viewMonth, day)}
									{@const scheduled = habitIsScheduledOn(habit, weekday)}
									{@const dateStr = formatDayKey(viewYear, viewMonth, day)}
									{@const key = logKey(habit.id, dateStr)}
									{@const done = doneKeys.has(key)}
									{@const isToday = dateStr === todayKey}
									{@const isPast = dateStr < todayKey}
									
									<td class="p-1 align-middle text-center {isToday ? 'bg-brand-surface/80' : ''}">
										{#if scheduled}
											<button
												type="button"
												class="w-7 h-7 mx-auto rounded-lg flex items-center justify-center border transition-all active:scale-90 relative overflow-hidden
												{done 
													? 'bg-brand-accent border-brand-accent text-brand-bg shadow-[0_0_10px_var(--color-brand-accent-muted)]' 
													: (isPast 
														? 'bg-red-950/20 border-red-500/20 text-red-500 hover:border-red-500/50 hover:bg-red-900/30' 
														: 'bg-brand-bg border-brand-divider/80 hover:border-brand-accent/50 hover:bg-brand-surface')}
												"
												aria-label="{habit.name}, día {day}: {done ? 'cumplido' : 'pendiente'}"
												aria-pressed={done}
												onclick={() => toggleCell(habit, day)}
											>
												{#if done}
													<Check class="w-4.5 h-4.5" strokeWidth={3.5} />
												{:else if isPast}
													<X class="w-3.5 h-3.5" strokeWidth={3} />
												{:else}
													<span class="w-1 h-1 rounded-full bg-brand-text-muted/20"></span>
												{/if}
											</button>
										{:else}
											<div class="w-7 h-7 mx-auto flex items-center justify-center" aria-hidden="true">
												<!-- Unscheduled day (empty dark block) -->
												<div class="w-full h-full rounded-lg bg-brand-surface/20 border border-brand-divider/20"></div>
											</div>
										{/if}
									</td>
								{/each}
								<td class="w-4"></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			
			<!-- Table Footer Add Button -->
			<div class="p-4 bg-brand-surface border-t border-brand-divider">
				<button type="button" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-divider border-dashed bg-[#0d1216] text-brand-text-muted hover:text-brand-text hover:border-brand-accent hover:bg-brand-accent/5 transition-all font-semibold text-sm shadow-inner" onclick={openCreate}>
					<Plus class="w-4 h-4" /> Añadir un nuevo hábito a la matriz
				</button>
			</div>
		</div>
	{/if}

	<!-- Bottom Stats Widgets -->
	{#if habits.length > 0}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
			<!-- Widget 1: Hábito Más Fuerte -->
			<div class="bg-brand-surface border border-brand-divider rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-lg h-48">
				<div class="absolute -right-10 -top-10 w-40 h-40 bg-brand-accent/10 rounded-full blur-3xl"></div>
				<div>
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase">Hábito más fuerte</h3>
						<div class="w-8 h-8 rounded-lg bg-brand-bg border border-brand-divider flex items-center justify-center shadow-inner">
							<TrendingUp class="w-4 h-4 text-brand-accent" />
						</div>
					</div>
					<h4 class="text-xl font-bold text-brand-text leading-tight truncate">
						{strongestHabit ? strongestHabit.habit.name : '—'}
					</h4>
				</div>
				<div class="mt-4 flex items-end justify-between relative z-10">
					<div>
						<p class="text-4xl font-black text-brand-text tracking-tighter drop-shadow-sm">
							{strongestHabit ? strongestHabit.stats.pct : 0}%
						</p>
						<p class="text-[10px] text-brand-text-muted mt-1 font-medium">Consistencia del mes</p>
					</div>
					<div class="text-right">
						<p class="text-sm font-bold text-orange-400 flex items-center justify-end gap-1">
							<Flame class="w-4 h-4" /> {strongestHabit ? strongestHabit.stats.streak : 0} días
						</p>
						<p class="text-[10px] font-semibold text-brand-accent mt-0.5">Racha ininterrumpida</p>
					</div>
				</div>
			</div>

			<!-- Widget 2: Pico de Disciplina -->
			<div class="bg-brand-surface border border-brand-divider rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-lg h-48">
				<div>
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase">Pico de disciplina</h3>
						<div class="w-8 h-8 rounded-lg bg-brand-bg border border-brand-divider flex items-center justify-center shadow-inner">
							<TrendingUp class="w-4 h-4 text-[#3b82f6]" />
						</div>
					</div>
					<h4 class="text-xl font-bold text-brand-text leading-tight truncate">
						{disciplinePeak ? disciplinePeak.days : '—'}
					</h4>
				</div>
				<div class="mt-4 flex items-end justify-between">
					<div>
						<p class="text-4xl font-black text-brand-text tracking-tighter drop-shadow-sm">
							{disciplinePeak ? disciplinePeak.pct : 0}%
						</p>
						<p class="text-[10px] text-brand-text-muted mt-1 font-medium">Tasa de éxito por día</p>
					</div>
					<div class="text-right">
						<span class="inline-block px-3 py-1 bg-brand-surface-elevated border border-brand-divider rounded-md text-[10px] font-bold text-brand-accent">
							{disciplinePeak ? 'Mejor rendimiento' : 'Sin datos'}
						</span>
					</div>
				</div>
			</div>

			<!-- Widget 3: Principio Fokuz -->
			<div class="bg-brand-surface border border-brand-divider rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-lg h-48">
				<div>
					<div class="flex items-center gap-2 mb-4">
						<span class="w-2.5 h-2.5 rounded-full bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]"></span>
						<h3 class="text-[10px] font-bold text-brand-accent tracking-widest uppercase">Principio Fokuz</h3>
					</div>
					<p class="text-sm font-bold text-brand-text italic leading-relaxed">
						"{dailyQuote}"
					</p>
				</div>
				<div class="mt-4 pt-4 border-t border-brand-divider flex items-start justify-between gap-3">
					<span class="text-[10px] text-brand-text-muted font-medium shrink-0 pt-0.5">Hábito(s) a cuidar:</span>
					<span class="text-[11px] font-bold text-orange-400 text-right leading-tight line-clamp-2" title={weakestHabits.map(h => h.name).join(', ')}>
						{weakestHabits.length > 0 ? weakestHabits.map(h => h.name).join(' & ') : '—'}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal Bottom Sheet for Edit/Create -->
{#if sheetMode !== 'closed'}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" onclick={closeSheet}></div>
	<div
		class="fixed bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-brand-surface rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-50 p-6 pt-4 shadow-2xl border border-brand-divider max-h-[90vh] overflow-y-auto"
	>
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6 md:hidden"></div>

		{#if sheetMode === 'detail' && selectedHabit}
			<div class="flex justify-between items-start gap-3 mb-4">
				<div class="flex items-start gap-4 min-w-0">
					<span class="w-12 h-12 rounded-xl border border-brand-divider bg-[#0d1216] flex items-center justify-center shrink-0 shadow-inner">
						<HabitIcon icon={selectedHabit.icon} class="w-5 h-5 text-brand-accent" />
					</span>
					<div class="min-w-0">
						<p class="text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-1">Hábito</p>
						<h3 class="text-xl font-bold text-brand-text overflow-wrap-break-word leading-tight">{selectedHabit.name}</h3>
					</div>
				</div>
				<button type="button" class="p-2 bg-[#0d1216] rounded-xl text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors shrink-0" onclick={closeSheet}>
					<X class="w-5 h-5" />
				</button>
			</div>

			<p class="text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Frecuencia Planificada</p>
			<div class="flex flex-wrap gap-2 mb-8">
				{#each WEEKDAY_LABELS as label, day (day)}
					<span
						class="w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-colors {selectedHabit.weekdays.includes(day) ? 'bg-brand-accent text-brand-bg shadow-[0_0_10px_var(--color-brand-accent-muted)]' : 'bg-[#0d1216] text-brand-text-muted border border-brand-divider'}"
						title={WEEKDAY_NAMES[day]}
					>
						{label}
					</span>
				{/each}
			</div>

			<div class="grid grid-cols-2 gap-3">
				<button type="button" class="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#0d1216] border border-brand-divider text-brand-text font-bold hover:border-brand-accent hover:text-brand-accent transition-colors" onclick={openEdit}>
					<Pencil class="w-4 h-4" /> Editar
				</button>
				<button type="button" class="flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-500/20 bg-red-900/10 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-colors" onclick={() => (sheetMode = 'delete-confirm')}>
					<Trash2 class="w-4 h-4" /> Eliminar
				</button>
			</div>
		{:else if sheetMode === 'delete-confirm' && selectedHabit}
			<div class="flex flex-col items-center justify-center text-center p-4 py-8">
				<div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
					<Trash2 class="w-8 h-8 text-red-500" />
				</div>
				<h3 class="text-xl font-bold text-brand-text mb-2">¿Eliminar este hábito?</h3>
				<p class="text-sm text-brand-text-muted mb-8 max-w-sm">
					Estás a punto de eliminar <strong>"{selectedHabit.name}"</strong>. Esta acción borrará todo el historial de este hábito y no se puede deshacer.
				</p>
				<div class="flex flex-col sm:flex-row gap-3 w-full">
					<button type="button" class="flex-1 bg-[#0d1216] text-brand-text border border-brand-divider font-bold py-3.5 rounded-xl hover:bg-brand-surface-elevated transition-colors" onclick={() => (sheetMode = 'detail')}>
						Cancelar
					</button>
					<button type="button" class="flex-1 bg-red-500 text-white font-bold py-3.5 rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20" onclick={deleteHabit}>
						Sí, eliminar
					</button>
				</div>
			</div>
		{:else if sheetMode === 'manage-categories'}
			<div class="flex justify-between items-center mb-6">
				<h3 class="text-xl font-bold text-brand-text">Gestionar Categorías</h3>
				<button type="button" class="p-2 bg-[#0d1216] rounded-xl text-brand-text-muted hover:text-brand-text transition-colors" onclick={closeSheet}>
					<X class="w-5 h-5" />
				</button>
			</div>
			
			<p class="text-[13px] text-brand-text-muted mb-6 leading-relaxed">
				Tus categorías personalizadas. Si editas una categoría que está en uso, se actualizará en todos los hábitos correspondientes.
			</p>

			{#if categoryError}
				<div class="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-4">
					<p class="text-xs text-red-400 font-medium">{categoryError}</p>
				</div>
			{/if}

			{@const catsToShow = availableCategories.filter(c => c !== 'General')}
			{#if catsToShow.length > 0}
				<div class="flex flex-col gap-2 mb-6 max-h-48 overflow-y-auto custom-scrollbar pr-2">
					{#each catsToShow as cat (cat)}
						{#if editingCategory?.old === cat}
							<div class="flex items-center gap-2 bg-[#12181d] border border-brand-accent/50 rounded-xl p-2 shadow-inner">
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									bind:value={editingCategory.new}
									class="flex-1 bg-transparent text-brand-text text-sm font-bold focus:outline-none px-2"
									onkeydown={(e) => { if (e.key === 'Enter') saveEditCategory(); else if (e.key === 'Escape') editingCategory = null; }}
									autofocus
								/>
								<button type="button" class="p-2 rounded-lg bg-brand-accent text-brand-bg font-bold hover:brightness-110 transition-colors" onclick={saveEditCategory}>
									<Check class="w-4 h-4" />
								</button>
								<button type="button" class="p-2 rounded-lg bg-[#0d1216] border border-brand-divider text-brand-text-muted hover:text-brand-text transition-colors" onclick={() => (editingCategory = null)}>
									<X class="w-4 h-4" />
								</button>
							</div>
						{:else}
							<div class="flex items-center justify-between bg-[#0d1216] border border-brand-divider rounded-xl pl-4 pr-2 py-2 shadow-inner group">
								<span class="text-sm font-bold text-brand-text">{cat}</span>
								<div class="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
									<button type="button" class="p-2 rounded-lg text-brand-text-muted hover:bg-brand-surface-elevated hover:text-brand-accent transition-colors" onclick={() => startEditCategory(cat)} aria-label="Editar categoría">
										<Pencil class="w-3.5 h-3.5" />
									</button>
									<button type="button" class="p-2 rounded-lg text-brand-text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors" onclick={() => removeCategory(cat)} aria-label="Eliminar categoría">
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="text-xs text-brand-text-muted italic text-center mb-6 py-4 bg-[#0d1216] border border-brand-divider border-dashed rounded-xl">No hay categorías personalizadas aún.</p>
			{/if}

			<label class="block text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-2" for="cat-name">Nueva categoría</label>
			<div class="flex gap-2 mb-2">
				<input
					id="cat-name" type="text" bind:value={formNewCategory} placeholder="Ej. Bienestar…"
					class="flex-1 bg-[#0d1216] border border-brand-divider rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
					onkeydown={(e) => { if (e.key === 'Enter') addCategory(); }}
				/>
				<button
					type="button"
					class="bg-brand-accent hover:brightness-105 text-brand-bg font-bold px-6 rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_var(--color-brand-accent-muted)] shrink-0"
					onclick={addCategory}
				>
					<Plus class="w-5 h-5" />
				</button>
			</div>
		{:else}
			<div class="flex justify-between items-center mb-8">
				<h3 class="text-xl font-bold text-brand-text">
					{sheetMode === 'edit' ? 'Editar hábito' : 'Crear nuevo hábito'}
				</h3>
				<button type="button" class="p-2 bg-[#0d1216] rounded-xl text-brand-text-muted hover:text-brand-text transition-colors" onclick={() => { if (sheetMode === 'edit' && selectedHabit) sheetMode = 'detail'; else closeSheet(); }}>
					<X class="w-5 h-5" />
				</button>
			</div>

			<label class="block text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-2" for="habit-name">Nombre del hábito</label>
			<input
				id="habit-name" type="text" bind:value={formName} placeholder="Ej. Meditar, Leer, Ejercicio…"
				class="w-full bg-[#0d1216] border border-brand-divider rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent mb-4 transition-all"
			/>

			<label class="block text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-2" for="habit-tag">Categoría (Etiqueta)</label>
			<div class="relative mb-6">
				<select
					id="habit-tag" bind:value={formTag}
					class="w-full bg-[#0d1216] border border-brand-divider rounded-xl p-4 text-brand-text focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all appearance-none cursor-pointer"
				>
					{#each availableCategories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
				<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
				</div>
			</div>

			<p class="text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Icono</p>
			<div class="grid grid-cols-5 gap-3 mb-6">
				{#each HABIT_ICON_OPTIONS as opt (opt.id)}
					<button
						type="button"
						class="aspect-square rounded-xl flex items-center justify-center border transition-colors {formIcon === opt.id ? 'border-brand-accent bg-brand-accent/10 text-brand-accent shadow-[0_0_10px_var(--color-brand-accent-muted)]' : 'border-brand-divider bg-[#0d1216] text-brand-text-muted hover:bg-brand-surface-elevated'}"
						title={opt.label} aria-label={opt.label} aria-pressed={formIcon === opt.id} onclick={() => (formIcon = opt.id)}
					>
						<HabitIcon icon={opt.id} class="w-6 h-6" />
					</button>
				{/each}
			</div>

			<p class="text-[10px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Frecuencia Semanal</p>
			<div class="grid grid-cols-7 gap-2 mb-2">
				{#each WEEKDAY_LABELS as label, day (day)}
					<button
						type="button"
						class="aspect-square rounded-xl text-sm font-bold transition-all border {formWeekdays.includes(day) ? 'bg-brand-accent text-brand-bg border-brand-accent shadow-[0_0_10px_var(--color-brand-accent-muted)]' : 'bg-[#0d1216] text-brand-text-muted border-brand-divider hover:bg-brand-surface-elevated'}"
						title={WEEKDAY_NAMES[day]} aria-pressed={formWeekdays.includes(day)} onclick={() => toggleWeekday(day)}
					>
						{label}
					</button>
				{/each}
			</div>
			<p class="text-[10px] text-brand-text-muted mb-6">Selecciona los días en que debes cumplir este hábito.</p>

			{#if formError}
				<div class="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-6">
					<p class="text-xs text-red-400 font-medium">{formError}</p>
				</div>
			{/if}

			<button
				type="button"
				class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:hover:scale-100 shadow-[0_0_15px_var(--color-brand-accent-muted)]"
				onclick={() => (sheetMode === 'edit' ? saveEdit() : createHabit())} disabled={formBusy}
			>
				{#if sheetMode === 'edit'}
					<Pencil class="w-5 h-5" /> Guardar cambios
				{:else}
					<Plus class="w-5 h-5" /> Crear hábito
				{/if}
			</button>
		{/if}
	</div>
{/if}
