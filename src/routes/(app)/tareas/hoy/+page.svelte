<script lang="ts">
	import { ArrowLeft, CheckCircle2, Circle, Kanban, Plus, X, Clock, AlertTriangle } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import {
		taskTimeLabel,
		taskDayValue,
		taskEndTime,
		taskDurationLabel,
		addMinutesToTime,
		timeToMinutes,
		findOverlappingTasks,
		overlapMessage,
		nextFreeSlot,
		durationLabel,
		START_TIME_SQL_HINT,
		DEFAULT_DURATION_MIN
	} from '$lib/taskTime';

	type Task = {
		id: number;
		title: string;
		is_completed: boolean;
		date?: string;
		end_date?: string;
		start_time?: string | null;
		end_time?: string | null;
		board_id?: number;
		boards?: {
			title: string;
			color: string;
		};
	};

	type Board = {
		id: number;
		title: string;
		color: string;
	};

	let tasks = $state<Task[]>([]);
	let boards = $state<Board[]>([]);
	let loading = $state(true);

	let showNewTask = $state(false);
	let creating = $state(false);
	let createError = $state('');
	let newTitle = $state('');
	let newBoardId = $state<number | ''>('');
	let newTime = $state('09:00');
	let newEndTime = $state('10:00');
	let slotErrorId = $state<number | null>(null);
	let slotErrorMsg = $state('');
	let editingSlotId = $state<number | null>(null);
	let editStart = $state('09:00');
	let editEnd = $state('10:00');

	const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
		.toISOString()
		.split('T')[0];

	const selectedDateStr = $derived.by(() => {
		const raw = page.url.searchParams.get('fecha');
		if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
		return todayStr;
	});
	const isToday = $derived(selectedDateStr === todayStr);
	const fromCalendar = $derived(Boolean(page.url.searchParams.get('fecha')));
	const selectedDate = $derived.by(() => {
		const [y, m, d] = selectedDateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	});
	const dayTitle = $derived(
		isToday
			? 'Tareas para Hoy'
			: `Tareas del ${selectedDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`
	);
	const daySubtitle = $derived(
		isToday
			? 'Todas tus tareas de todos los tableros que vencen el día de hoy'
			: selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
	);

	let dayTasks = $derived.by(() => {
		const filtered = tasks.filter((t) => {
			const targetDate = taskDayValue(t);
			if (!targetDate) return false;
			return targetDate === selectedDateStr;
		});

		return filtered.sort((a, b) => {
			const timeA = taskTimeLabel(a) || '99:99';
			const timeB = taskTimeLabel(b) || '99:99';
			return timeA.localeCompare(timeB);
		});
	});

	const createConflicts = $derived(
		findOverlappingTasks(dayTasks, selectedDateStr, newTime, newEndTime)
	);
	const overlapWarning = $derived(overlapMessage(createConflicts));
	const invalidRange = $derived(
		(timeToMinutes(newEndTime) ?? 0) <= (timeToMinutes(newTime) ?? 0)
	);
	const createDuration = $derived(durationLabel(newTime, newEndTime));
	const canCreate = $derived(
		newTitle.trim().length > 0 &&
			newBoardId !== '' &&
			Boolean(newTime) &&
			Boolean(newEndTime) &&
			!invalidRange &&
			createConflicts.length === 0 &&
			!creating
	);

	function defaultTimeFor() {
		if (!isToday) return '09:00';
		const now = new Date();
		if (now.getMinutes() < 30) {
			return `${String(now.getHours()).padStart(2, '0')}:30`;
		}
		return `${String((now.getHours() + 1) % 24).padStart(2, '0')}:00`;
	}

	function goBack() {
		goto(fromCalendar ? '/tareas/calendario' : '/tareas');
	}

	function openNewTask() {
		newTitle = '';
		newBoardId = boards[0]?.id ?? '';
		const slot = nextFreeSlot(dayTasks, selectedDateStr, defaultTimeFor());
		newTime = slot.start;
		newEndTime = slot.end;
		createError = '';
		showNewTask = true;
	}

	function closeNewTask() {
		showNewTask = false;
		creating = false;
		createError = '';
	}

	function onStartInput() {
		const startMinutes = timeToMinutes(newTime) ?? 0;
		const endMinutes = timeToMinutes(newEndTime) ?? 0;
		if (endMinutes <= startMinutes) {
			newEndTime = addMinutesToTime(newTime, DEFAULT_DURATION_MIN);
		}
	}

	async function createTask() {
		if (!canCreate || !supabase) {
			if (!newBoardId) createError = 'Elige un tablero para asociar la tarea.';
			else if (invalidRange) createError = 'La hora de fin debe ser posterior al inicio.';
			else if (createConflicts.length) createError = overlapWarning;
			return;
		}

		creating = true;
		createError = '';

		const { data: lists, error: listError } = await supabase
			.from('board_lists')
			.select('id')
			.eq('board_id', newBoardId)
			.order('order_index', { ascending: true })
			.limit(1);

		if (listError) {
			creating = false;
			createError = listError.message;
			return;
		}

		const payload = {
			title: newTitle.trim(),
			is_completed: false,
			board_id: Number(newBoardId),
			list_id: lists?.[0]?.id ?? null,
			status: 'backlog',
			date: selectedDateStr,
			start_time: newTime,
			end_time: newEndTime,
			novedad: ''
		};

		const { data, error } = await supabase
			.from('tasks')
			.insert([payload])
			.select('*, boards(title, color)')
			.single();

		creating = false;
		if (error) {
			createError = /start_time|end_time/i.test(error.message) ? START_TIME_SQL_HINT : error.message;
			return;
		}

		if (data) tasks = [data, ...tasks];
		closeNewTask();
	}

	async function loadAllTasks() {
		if (!supabase) return;
		loading = true;
		const [{ data: taskData }, { data: boardData }] = await Promise.all([
			supabase.from('tasks').select('*, boards(title, color)'),
			supabase.from('boards').select('id, title, color').order('title', { ascending: true })
		]);
		if (taskData) tasks = taskData;
		if (boardData) boards = boardData;
		loading = false;
	}

	async function updateTaskSlot(task: Task, start: string, end: string) {
		if (!supabase || !start || !end) return false;
		if ((timeToMinutes(end) ?? 0) <= (timeToMinutes(start) ?? 0)) {
			slotErrorId = task.id;
			slotErrorMsg = 'La hora de fin debe ser posterior al inicio.';
			return false;
		}

		const conflicts = findOverlappingTasks(dayTasks, selectedDateStr, start, end, task.id);
		if (conflicts.length) {
			slotErrorId = task.id;
			slotErrorMsg = overlapMessage(conflicts);
			return false;
		}

		const previousStart = task.start_time ?? null;
		const previousEnd = task.end_time ?? null;
		slotErrorId = null;
		slotErrorMsg = '';
		tasks = tasks.map((t) =>
			t.id === task.id ? { ...t, start_time: start, end_time: end } : t
		);

		const { error } = await supabase
			.from('tasks')
			.update({ start_time: start, end_time: end })
			.eq('id', task.id);
		if (error) {
			tasks = tasks.map((t) =>
				t.id === task.id ? { ...t, start_time: previousStart, end_time: previousEnd } : t
			);
			slotErrorId = task.id;
			slotErrorMsg = /start_time|end_time/i.test(error.message) ? START_TIME_SQL_HINT : error.message;
			return false;
		}
		return true;
	}

	function openSlotEditor(task: Task) {
		editingSlotId = task.id;
		editStart = taskTimeLabel(task) || defaultTimeFor();
		editEnd = taskEndTime(task) || addMinutesToTime(editStart, DEFAULT_DURATION_MIN);
		slotErrorId = null;
		slotErrorMsg = '';
	}

	function closeSlotEditor() {
		editingSlotId = null;
		slotErrorId = null;
		slotErrorMsg = '';
	}

	async function saveSlotEditor(task: Task) {
		const ok = await updateTaskSlot(task, editStart, editEnd);
		if (ok) editingSlotId = null;
	}

	function onEditStartInput() {
		const startMinutes = timeToMinutes(editStart) ?? 0;
		const endMinutes = timeToMinutes(editEnd) ?? 0;
		if (endMinutes <= startMinutes) {
			editEnd = addMinutesToTime(editStart, DEFAULT_DURATION_MIN);
		}
	}

	async function toggleTask(task: Task) {
		if (!supabase) return;
		const previous = task.is_completed;

		tasks = tasks.map((t) => (t.id === task.id ? { ...t, is_completed: !t.is_completed } : t));

		const { error } = await supabase
			.from('tasks')
			.update({ is_completed: !previous })
			.eq('id', task.id);

		if (error) {
			tasks = tasks.map((t) => (t.id === task.id ? { ...t, is_completed: previous } : t));
			alert('Error al actualizar: ' + error.message);
		}
	}

	$effect(() => {
		loadAllTasks();
	});
</script>

<svelte:head>
	<title>{dayTitle} · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden p-4 md:p-6">
	<header class="flex items-start sm:items-center justify-between gap-4 mb-6 md:mb-8 shrink-0">
		<div class="flex items-start sm:items-center gap-4 min-w-0">
			<button
				onclick={goBack}
				class="p-2 bg-brand-surface border border-brand-divider rounded-xl hover:bg-brand-surface-elevated text-brand-text-muted hover:text-brand-text transition-colors shrink-0"
				aria-label="Volver"
			>
				<ArrowLeft class="w-5 h-5" />
			</button>
			<div class="min-w-0">
				<h1 class="text-2xl font-bold text-brand-text truncate">{dayTitle}</h1>
				<p class="text-sm text-brand-text-muted mt-1 capitalize">{daySubtitle}</p>
			</div>
		</div>
		<button
			type="button"
			onclick={openNewTask}
			class="shrink-0 w-11 h-11 rounded-xl bg-brand-accent text-brand-bg flex items-center justify-center shadow-[0_0_12px_var(--color-brand-accent-muted)] hover:brightness-110"
			aria-label="Nueva tarea"
		>
			<Plus class="w-6 h-6" />
		</button>
	</header>

	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
		</div>
	{:else if dayTasks.length === 0}
		<div class="flex-1 flex flex-col items-center justify-center text-brand-text-muted">
			<CheckCircle2 class="w-16 h-16 mb-4 text-brand-accent opacity-50" />
			<h2 class="text-xl font-semibold mb-2 text-brand-text">{isToday ? 'Todo al día' : 'Sin tareas este día'}</h2>
			<p class="mb-6 max-w-md text-center">
				{isToday
					? 'No tienes tareas pendientes que venzan hoy. Usa el + para agregar una.'
					: 'No hay tareas para esta fecha. Usa el + para crear una.'}
			</p>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto custom-scrollbar pb-12">
			<div class="max-w-4xl mx-auto space-y-3">
				{#each dayTasks as task}
					{@const start = taskTimeLabel(task)}
					{@const end = taskEndTime(task)}
					{@const duration = taskDurationLabel(task)}
					<div class="relative overflow-hidden bg-brand-surface border rounded-2xl transition-colors {slotErrorId === task.id || editingSlotId === task.id ? 'border-brand-accent/50' : 'border-brand-divider hover:border-brand-accent/40'}">
						<div class="absolute left-0 top-0 bottom-0 w-1 {task.is_completed ? 'bg-brand-divider' : 'bg-brand-accent'}"></div>
						<div class="pl-4 pr-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div class="flex items-center gap-3 min-w-0">
								<button class="shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors" onclick={() => toggleTask(task)}>
									{#if task.is_completed}
										<CheckCircle2 class="w-5 h-5 text-brand-accent" />
									{:else}
										<Circle class="w-5 h-5" />
									{/if}
								</button>
								<button
									type="button"
									onclick={() => (editingSlotId === task.id ? closeSlotEditor() : openSlotEditor(task))}
									class="shrink-0 w-[4.25rem] rounded-xl px-1 py-1 text-left hover:bg-[#0d1216] transition-colors"
									aria-label="Editar horario"
								>
									<p class="text-sm font-black tabular-nums leading-none {start ? 'text-brand-accent' : 'text-brand-text-muted'}">
										{start || '—'}
									</p>
									<div class="my-1 ml-2 h-3 w-px bg-brand-accent/35"></div>
									<p class="text-xs font-bold tabular-nums leading-none text-brand-text-muted">
										{end || '—'}
									</p>
								</button>
								<div class="flex flex-col min-w-0">
									<h3 class="text-base font-bold text-brand-text truncate {task.is_completed ? 'line-through opacity-50 text-brand-text-muted' : ''}">
										{task.title}
									</h3>
									<div class="flex items-center gap-2 mt-1 flex-wrap">
										{#if duration}
											<span class="text-[10px] font-bold text-brand-text-muted tabular-nums">{duration}</span>
										{/if}
										{#if duration && task.boards}
											<span class="text-brand-divider">·</span>
										{/if}
										{#if task.boards}
											<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background-color: {task.boards.color}15; color: {task.boards.color}; border: 1px solid {task.boards.color}30">
												{task.boards.title}
											</span>
										{/if}
									</div>
								</div>
							</div>

							<button
								class="px-4 py-2 bg-[#0d1216] border border-brand-divider rounded-lg text-xs font-bold text-brand-text hover:bg-brand-surface-elevated transition-colors flex items-center justify-center w-full sm:w-auto gap-2"
								onclick={() => goto(`/tareas/${task.board_id}`)}
							>
								<Kanban class="w-4 h-4" /> Ir al tablero
							</button>
						</div>

						{#if editingSlotId === task.id}
							<div class="mx-4 mb-4 rounded-xl border border-brand-divider bg-[#0d1216] p-3">
								<div class="flex items-center gap-2 mb-3">
									<Clock class="w-3.5 h-3.5 text-brand-accent" />
									<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Horario</p>
									{#if durationLabel(editStart, editEnd)}
										<span class="ml-auto text-[10px] font-bold text-brand-accent">{durationLabel(editStart, editEnd)}</span>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									<label class="flex-1">
										<span class="block text-[9px] font-bold uppercase tracking-wider text-brand-text-muted mb-1">Inicia</span>
										<input
											type="time"
											lang="en-GB"
											bind:value={editStart}
											onchange={onEditStartInput}
											class="time-input w-full bg-brand-surface border border-brand-divider rounded-lg px-3 py-2 text-sm font-black tabular-nums text-brand-accent outline-none focus:border-brand-accent"
										/>
									</label>
									<span class="text-brand-text-muted font-bold mt-4">–</span>
									<label class="flex-1">
										<span class="block text-[9px] font-bold uppercase tracking-wider text-brand-text-muted mb-1">Termina</span>
										<input
											type="time"
											lang="en-GB"
											bind:value={editEnd}
											class="time-input w-full bg-brand-surface border border-brand-divider rounded-lg px-3 py-2 text-sm font-black tabular-nums text-brand-text outline-none focus:border-brand-accent"
										/>
									</label>
								</div>
								{#if slotErrorId === task.id && slotErrorMsg}
									<p class="text-[11px] font-bold text-amber-400 mt-2">{slotErrorMsg}</p>
								{/if}
								<div class="flex justify-end gap-2 mt-3">
									<button type="button" class="px-3 py-1.5 rounded-lg text-xs font-bold text-brand-text-muted hover:bg-brand-surface" onclick={closeSlotEditor}>
										Cancelar
									</button>
									<button type="button" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-accent text-brand-bg" onclick={() => saveSlotEditor(task)}>
										Guardar
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

{#if showNewTask}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4" onclick={closeNewTask}>
		<div class="w-full max-w-md bg-brand-surface border border-brand-divider rounded-2xl p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start justify-between gap-3 mb-5">
				<div>
					<p class="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Nueva tarea</p>
					<h3 class="text-lg font-black text-brand-text capitalize">{daySubtitle}</h3>
				</div>
				<button type="button" class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated" onclick={closeNewTask} aria-label="Cerrar">
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<span class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Título</span>
					<input
						type="text"
						bind:value={newTitle}
						placeholder="¿Qué vas a hacer?"
						class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text placeholder-brand-text-muted focus:border-brand-accent outline-none"
						onkeydown={(e) => e.key === 'Enter' && createTask()}
					/>
				</div>

				<div class="rounded-xl border border-brand-divider bg-[#0d1216] p-3">
					<div class="flex items-center gap-2 mb-3">
						<Clock class="w-3.5 h-3.5 text-brand-accent" />
						<span class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Horario</span>
						{#if createDuration && !invalidRange}
							<span class="ml-auto text-[10px] font-bold text-brand-accent">{createDuration}</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<label class="flex-1">
							<span class="block text-[9px] font-bold uppercase tracking-wider text-brand-text-muted mb-1">Inicia</span>
							<input
								type="time"
								lang="en-GB"
								bind:value={newTime}
								onchange={onStartInput}
								required
								class="time-input w-full bg-brand-surface border border-brand-divider rounded-lg px-3 py-2.5 text-sm font-black tabular-nums text-brand-accent outline-none focus:border-brand-accent"
							/>
						</label>
						<span class="text-brand-text-muted font-bold mt-4">–</span>
						<label class="flex-1">
							<span class="block text-[9px] font-bold uppercase tracking-wider text-brand-text-muted mb-1">Termina</span>
							<input
								type="time"
								lang="en-GB"
								bind:value={newEndTime}
								required
								class="time-input w-full bg-brand-surface border rounded-lg px-3 py-2.5 text-sm font-black tabular-nums text-brand-text outline-none focus:border-brand-accent {invalidRange ? 'border-amber-500/70' : 'border-brand-divider'}"
							/>
						</label>
					</div>
				</div>

				{#if invalidRange}
					<div class="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
						<AlertTriangle class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
						<p class="text-xs font-bold text-amber-300">La hora de fin debe ser posterior al inicio.</p>
					</div>
				{:else if overlapWarning}
					<div class="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
						<AlertTriangle class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
						<div>
							<p class="text-xs font-bold text-amber-300">{overlapWarning}</p>
							<p class="text-[11px] text-amber-200/80 mt-1">Elige otro rango para poder crearla.</p>
						</div>
					</div>
				{/if}

				<div>
					<span class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Tablero</span>
					{#if boards.length === 0}
						<p class="text-xs text-brand-text-muted bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3">
							No tienes tableros. <a href="/tareas" class="text-brand-accent font-bold">Crea uno</a> antes de añadir la tarea.
						</p>
					{:else}
						<div class="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto">
							{#each boards as board}
								<button
									type="button"
									onclick={() => (newBoardId = board.id)}
									class="flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition-colors {newBoardId === board.id
										? 'border-brand-accent bg-brand-accent/10'
										: 'border-brand-divider bg-[#0d1216] hover:border-brand-accent/40'}"
								>
									<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {board.color}"></span>
									<span class="text-sm font-bold {newBoardId === board.id ? 'text-brand-text' : 'text-brand-text-muted'}">{board.title}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if createError}
					<p class="text-xs font-bold text-red-400">{createError}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-2 mt-6">
				<button type="button" class="px-4 py-2 rounded-xl text-sm font-bold text-brand-text-muted hover:bg-[#0d1216]" onclick={closeNewTask}>
					Cancelar
				</button>
				<button
					type="button"
					onclick={createTask}
					disabled={!canCreate || boards.length === 0}
					class="px-5 py-2 rounded-xl text-sm font-bold bg-brand-accent text-brand-bg disabled:opacity-40 flex items-center gap-2"
				>
					<Plus class="w-4 h-4" />
					{creating ? 'Creando...' : 'Crear tarea'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.time-input {
		color-scheme: dark;
	}
	.time-input::-webkit-calendar-picker-indicator {
		display: none;
		-webkit-appearance: none;
	}
	.time-input::-webkit-datetime-edit-ampm-field {
		display: none;
	}
</style>
