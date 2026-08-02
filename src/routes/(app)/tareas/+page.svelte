<script lang="ts">
	import { Calendar, GripVertical, CheckCircle2, Circle, Plus, X, AlertTriangle, Trash2, Tag } from 'lucide-svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dndzone } from 'svelte-dnd-action';
	import logo from '$lib/assets/favicon_logo.png';

	type TaskTag = { id: number; name: string; color: string };
	
	// Estado de la aplicación usando las Runes de Svelte 5
	let tasks = $state<any[]>([]);
	let tags = $state<TaskTag[]>([]);
	
	// Inicializar la fecha a las 00:00:00 sin mutaciones externas para evitar warnings en Svelte 5
	const initDate = new Date();
	initDate.setHours(0,0,0,0);
	let selectedDate = $state(initDate);

	let showNewTask = $state(false);
	let showTaskUpdate = $state(false);
	let showCalendar = $state(false);
	let showTags = $state(false);
	let newTaskTitle = $state('');
	let selectedTagId = $state<number | null>(null);
	let newTagName = $state('');
	let newTagColor = $state('#feef4c');

	const TAG_COLORS = ['#feef4c', '#7dd3fc', '#f9a8d4', '#86efac', '#fdba74', '#c4b5fd'];
	
	// Estado para editar la novedad
	let selectedTaskId = $state<number | null>(null);
	let editingNovedad = $state('');
	let editingTagId = $state<number | null>(null);

	// Variables para el calendario custom
	let calMonth = $state(initDate.getMonth());
	let calYear = $state(initDate.getFullYear());
	let daysWithActiveTasks = $state(new Set<string>());

	const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

	let calendarDays = $derived.by(() => {
		let days = [];
		const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
		const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday
		for (let i = 0; i < firstDay; i++) days.push(null);
		for (let i = 1; i <= totalDays; i++) days.push(i);
		return days;
	});

	const prevMonth = () => {
		if (calMonth === 0) { calMonth = 11; calYear--; }
		else calMonth--;
	};

	const nextMonth = () => {
		if (calMonth === 11) { calMonth = 0; calYear++; }
		else calMonth++;
	};

	const selectCalendarDate = (day: number) => {
		const d = new Date(calYear, calMonth, day);
		d.setHours(0,0,0,0);
		selectedDate = d;
		showCalendar = false;
	};

	const formatDayKey = (year: number, month: number, day: number) => {
		const m = String(month + 1).padStart(2, '0');
		const d = String(day).padStart(2, '0');
		return `${year}-${m}-${d}`;
	};

	const fetchActiveTaskDays = async () => {
		if (!supabase) {
			daysWithActiveTasks = new Set();
			return;
		}

		const start = formatDayKey(calYear, calMonth, 1);
		const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
		const end = formatDayKey(calYear, calMonth, lastDay);

		const { data, error } = await supabase
			.from('tasks')
			.select('date')
			.eq('is_completed', false)
			.gte('date', start)
			.lte('date', end);

		if (error) {
			console.warn('Error al cargar días con tareas activas:', error.message);
			return;
		}

		daysWithActiveTasks = new Set((data ?? []).map((t) => t.date));
	};

	// Sincronizar el calendario con la fecha seleccionada al abrir
	$effect(() => {
		if (showCalendar) {
			calMonth = selectedDate.getMonth();
			calYear = selectedDate.getFullYear();
		}
	});

	// Marcar días del mes visible que tienen tareas sin completar
	$effect(() => {
		if (!showCalendar) return;
		void calMonth;
		void calYear;
		fetchActiveTaskDays();
	});

	// Funciones auxiliares
	const formatDateString = (d: Date) => {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const fetchTags = async () => {
		if (!supabase) {
			tags = [];
			return;
		}

		const { data, error } = await supabase
			.from('tags')
			.select('id, name, color')
			.order('name', { ascending: true });

		if (error) {
			console.warn('Error al cargar etiquetas:', error.message);
			return;
		}
		if (data) tags = data;
	};

	const fetchTasks = async () => {
		if (!supabase) {
			console.warn("Supabase no está configurado. Las tareas no se pueden cargar.");
			tasks = [];
			return;
		}

		const { data, error } = await supabase
			.from('tasks')
			.select('*, tags(id, name, color)')
			.eq('date', formatDateString(selectedDate))
			.order('order_index', { ascending: true });
			
		if (error) alert("Error al cargar: " + error.message);
		if (data) tasks = data;
	};

	const getTaskTag = (task: any): TaskTag | null => {
		if (task?.tags && !Array.isArray(task.tags)) return task.tags;
		if (task?.tag_id) return tags.find((t) => t.id === task.tag_id) ?? null;
		return null;
	};

	const addTag = async () => {
		const name = newTagName.trim();
		if (!name) return;

		if (!supabase) {
			alert('Supabase no está configurado.');
			return;
		}

		const { data, error } = await supabase
			.from('tags')
			.insert([{ name, color: newTagColor }])
			.select('id, name, color')
			.single();

		if (error) {
			alert('Error al crear etiqueta: ' + error.message);
			return;
		}

		if (data) tags = [...tags, data].sort((a, b) => a.name.localeCompare(b.name));
		newTagName = '';
		newTagColor = '#feef4c';
	};

	const deleteTag = async (tagId: number) => {
		if (!confirm('¿Eliminar esta etiqueta? Las tareas quedarán sin etiqueta.')) return;

		if (supabase) {
			const { error } = await supabase.from('tags').delete().eq('id', tagId);
			if (error) {
				alert('Error al eliminar etiqueta: ' + error.message);
				return;
			}
		}

		tags = tags.filter((t) => t.id !== tagId);
		if (selectedTagId === tagId) selectedTagId = null;
		if (editingTagId === tagId) editingTagId = null;
		await fetchTasks();
	};

	// Efecto para recargar tareas cuando cambia la fecha
	$effect(() => {
		fetchTasks();
	});

	$effect(() => {
		fetchTags();
	});

	const toggleTask = async (id: number) => {
		const task = tasks.find(t => t.id === id);
		if (task) {
			task.is_completed = !task.is_completed;
			if (supabase) {
				const { error } = await supabase.from('tasks').update({ is_completed: task.is_completed }).eq('id', id);
				if (error) alert("Error al actualizar: " + error.message);
			}
			await fetchActiveTaskDays();
		}
	};

	const openNewTask = () => {
		newTaskTitle = '';
		selectedTagId = null;
		showNewTask = true;
	};

	const addTask = async () => {
		if (!newTaskTitle.trim()) return;
		
		const newTask = {
			title: newTaskTitle,
			is_completed: false,
			date: formatDateString(selectedDate),
			order_index: tasks.length,
			novedad: '',
			tag_id: selectedTagId
		};

		if (supabase) {
			const { data, error } = await supabase
				.from('tasks')
				.insert([newTask])
				.select('*, tags(id, name, color)');
			if (error) {
				alert("Error al crear tarea: " + error.message);
				return;
			}
			if (data) {
				tasks = [...tasks, { ...data[0] }];
			}
		} else {
			const tag = tags.find((t) => t.id === selectedTagId) ?? null;
			tasks = [...tasks, { id: Date.now(), ...newTask, tags: tag }];
		}
		
		newTaskTitle = '';
		selectedTagId = null;
		showNewTask = false;
		await fetchActiveTaskDays();
	};

	const openTaskUpdate = (task: any) => {
		selectedTaskId = task.id;
		editingNovedad = task.novedad || '';
		editingTagId = task.tag_id ?? getTaskTag(task)?.id ?? null;
		showTaskUpdate = true;
	};

	const saveNovedad = async () => {
		if (selectedTaskId === null) return;
		
		const taskIndex = tasks.findIndex(t => t.id === selectedTaskId);
		if (taskIndex !== -1) {
			tasks[taskIndex].novedad = editingNovedad;
			tasks[taskIndex].tag_id = editingTagId;
			tasks[taskIndex].tags = tags.find((t) => t.id === editingTagId) ?? null;
			if (supabase) {
				await supabase
					.from('tasks')
					.update({ novedad: editingNovedad, tag_id: editingTagId })
					.eq('id', selectedTaskId);
			}
		}
		showTaskUpdate = false;
	};

	const deleteTask = async () => {
		if (selectedTaskId === null) return;
		
		// Confirmación simple
		if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;

		if (supabase) {
			const { error } = await supabase.from('tasks').delete().eq('id', selectedTaskId);
			if (error) {
				alert("Error al eliminar la tarea: " + error.message);
				return; // Si hay error, no la borramos localmente
			}
		}
		
		tasks = tasks.filter(t => t.id !== selectedTaskId);
		showTaskUpdate = false;
		await fetchActiveTaskDays();
	};

	const setDate = (offset: number) => {
		const d = new Date();
		d.setDate(d.getDate() + offset);
		d.setHours(0,0,0,0);
		selectedDate = d;
	};

	const isSameDay = (a: Date, b: Date) =>
		a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

	const isToday = (d: Date) => isSameDay(d, new Date());

	const isOffsetDay = (d: Date, offset: number) => {
		const target = new Date();
		target.setDate(target.getDate() + offset);
		target.setHours(0, 0, 0, 0);
		return isSameDay(d, target);
	};

	const dayTabClass = (active: boolean) =>
		`flex-1 py-2.5 rounded-xl text-center transition-colors ${
			active
				? 'bg-brand-accent text-brand-bg font-semibold'
				: 'text-brand-text-muted hover:text-brand-text'
		}`;

	// Handlers para el drag and drop
	const handleDndConsider = (e: any) => {
		tasks = e.detail.items;
	};

	const handleDndFinalize = async (e: any) => {
		tasks = e.detail.items;
		if (supabase) {
			// Update order_index for all items locally
			const updates = tasks.map((t, index) => ({
				id: t.id,
				title: t.title,
				is_completed: t.is_completed,
				date: t.date,
				order_index: index,
				novedad: t.novedad,
				tag_id: t.tag_id ?? null
			}));
			await supabase.from('tasks').upsert(updates);
		}
	};

	// Cálculo de progreso
	let progress = $derived(tasks.length > 0 ? Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100) : 0);
</script>

<svelte:head>
	<title>Tareas · Fokuz</title>
</svelte:head>

<!-- Header -->
<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<img src={logo} alt="Fokuz" class="w-8 h-8 rounded-lg object-contain" />
		<h1 class="text-xl font-bold text-brand-text">Tareas</h1>
	</div>
	<button
		onclick={() => showTags = true}
		class="p-2 rounded-xl text-brand-accent hover:bg-brand-accent-muted transition-colors"
		title="Etiquetas"
		aria-label="Gestionar etiquetas"
	>
		<Tag class="w-5 h-5" />
	</button>
</header>

<!-- Contenido principal -->
<div class="flex-1 overflow-y-auto px-6 py-4 pb-28">
	
	<!-- Selector de fecha -->
	<div class="flex items-center gap-1 bg-brand-surface rounded-2xl p-1 mb-8 border border-brand-divider">
		<div class="flex flex-1 items-center gap-1 text-sm font-medium min-w-0">
			<button class={dayTabClass(isOffsetDay(selectedDate, -1))} onclick={() => setDate(-1)}>Ayer</button>
			<button class={dayTabClass(isToday(selectedDate))} onclick={() => setDate(0)}>Hoy</button>
			<button class={dayTabClass(isOffsetDay(selectedDate, 1))} onclick={() => setDate(1)}>Mañana</button>
		</div>
		<div class="w-px h-6 bg-brand-divider shrink-0"></div>
		
		<!-- Selector Custom (Botón para abrir modal) -->
		<button 
			class="relative w-9 h-9 flex items-center justify-center text-brand-accent hover:bg-brand-accent-muted rounded-full transition-colors"
			onclick={() => showCalendar = true}
		>
			<Calendar class="w-5 h-5" />
		</button>
	</div>

	<!-- Lista de prioridades -->
	<div class="mb-2">
		<h2 class="text-xs font-bold text-brand-text-muted tracking-wider mb-4 uppercase">Enfoque actual</h2>
		
		<section 
			class="flex flex-col gap-3 min-h-[50px]" 
			use:dndzone={{items: tasks, flipDurationMs: 200, dropTargetStyle: {}}} 
			onconsider={handleDndConsider} 
			onfinalize={handleDndFinalize}
		>
			{#each tasks as task (task.id)}
				{@const taskTag = getTaskTag(task)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div 
					class="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-200 border-l-4 {selectedTaskId === task.id ? 'bg-brand-surface-elevated border-brand-accent shadow-md' : 'bg-brand-surface border-transparent hover:bg-brand-surface-elevated'}"
					onclick={() => openTaskUpdate(task)}
				>
					<div class="flex items-center gap-4 flex-1 min-w-0">
						<!-- svelte-ignore a11y_consider_explicit_label -->
						<button 
							onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
							class="text-brand-text-muted hover:text-brand-accent transition-colors focus:outline-none shrink-0"
						>
							{#if task.is_completed}
								<CheckCircle2 class="w-6 h-6 text-brand-accent fill-brand-accent-muted" />
							{:else}
								<Circle class="w-6 h-6" />
							{/if}
						</button>
						<div class="min-w-0">
							<span class="block text-[15px] font-medium truncate {task.is_completed ? 'text-brand-text-muted line-through' : 'text-brand-text'}">
								{task.title}
							</span>
							{#if taskTag}
								<span
									class="inline-flex mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-brand-bg"
									style="background-color: {taskTag.color}"
								>
									{taskTag.name}
								</span>
							{/if}
						</div>
					</div>
					
					<div class="flex items-center gap-2 shrink-0">
						{#if task.novedad && task.novedad.trim() !== ''}
							<AlertTriangle class="w-5 h-5 text-brand-accent fill-brand-accent-muted" />
						{/if}
						<div class="text-brand-text-muted/50 hover:text-brand-text-muted cursor-grab active:cursor-grabbing p-1">
							<GripVertical class="w-5 h-5" />
						</div>
					</div>
				</div>
			{/each}
		</section>
		{#if tasks.length === 0}
			<div class="text-center py-8 text-brand-text-muted text-sm">
				No hay prioridades para este día.
			</div>
		{/if}
	</div>

	<!-- Barra de progreso -->
	<div class="mt-8 mb-6">
		<div class="flex justify-between items-center mb-2">
			<span class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Progreso diario</span>
			<span class="text-sm font-bold text-brand-accent">{progress}%</span>
		</div>
		<div class="h-2 w-full bg-brand-surface-elevated rounded-full overflow-hidden">
			<div 
				class="h-full bg-brand-accent rounded-full transition-all duration-500 ease-out" 
				style="width: {progress}%"
			></div>
		</div>
	</div>
</div>

<!-- Floating Action Button -->
<button 
	class="absolute bottom-24 right-6 w-14 h-14 bg-brand-accent hover:brightness-105 text-brand-bg rounded-full shadow-lg shadow-black/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-20"
	onclick={openNewTask}
>
	<Plus class="w-7 h-7" />
</button>

<!-- Modals (Bottom Sheets) -->

<!-- Overlay -->
{#if showNewTask || showTaskUpdate || showCalendar || showTags}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
		onclick={() => { showNewTask = false; showTaskUpdate = false; showCalendar = false; showTags = false; }}
	></div>
{/if}

<!-- Calendario Custom Bottom Sheet -->
{#if showCalendar}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={prevMonth}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
			</button>
			<h3 class="text-lg font-bold text-brand-text capitalize">{monthNames[calMonth]} {calYear}</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={nextMonth}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
			</button>
		</div>
		
		<div class="grid grid-cols-7 gap-2 text-center mb-2">
			{#each ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as dayStr}
				<div class="text-xs font-bold text-brand-text-muted">{dayStr}</div>
			{/each}
		</div>
		
		<div class="grid grid-cols-7 gap-2 text-center mb-6">
			{#each calendarDays as day}
				{#if day === null}
					<div></div>
				{:else}
					{@const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear}
					{@const hasActiveTasks = daysWithActiveTasks.has(formatDayKey(calYear, calMonth, day))}
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button 
						class="w-10 h-10 mx-auto flex items-center justify-center rounded-full text-sm transition-all {isSelected
							? 'bg-brand-accent text-brand-bg font-bold shadow-md'
							: hasActiveTasks
								? 'text-brand-text ring-2 ring-brand-accent'
								: 'text-brand-text hover:bg-brand-accent-muted'}"
						onclick={() => selectCalendarDate(day)}
					>
						{day}
					</button>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<!-- Tags Bottom Sheet -->
{#if showTags}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300 max-h-[85%] overflow-y-auto">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Etiquetas</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={() => showTags = false}>
				<X class="w-4 h-4" />
			</button>
		</div>

		<div class="space-y-3 mb-6">
			{#if tags.length === 0}
				<p class="text-sm text-brand-text-muted text-center py-4">Aún no tienes etiquetas. Crea una como “Hogar” o “Trabajo”.</p>
			{:else}
				{#each tags as tag (tag.id)}
					<div class="flex items-center justify-between gap-3 bg-brand-bg rounded-xl px-4 py-3">
						<div class="flex items-center gap-3 min-w-0">
							<span class="w-3 h-3 rounded-full shrink-0" style="background-color: {tag.color}"></span>
							<span class="text-brand-text font-medium truncate">{tag.name}</span>
						</div>
						<button
							class="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
							onclick={() => deleteTag(tag.id)}
							aria-label="Eliminar etiqueta {tag.name}"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				{/each}
			{/if}
		</div>

		<div class="border-t border-brand-divider pt-5 space-y-4">
			<input
				type="text"
				bind:value={newTagName}
				placeholder="Nombre de la etiqueta..."
				class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
			/>
			<div class="flex items-center gap-2">
				{#each TAG_COLORS as color}
					<button
						type="button"
						class="w-8 h-8 rounded-full transition-transform {newTagColor === color ? 'ring-2 ring-white scale-110' : ''}"
						style="background-color: {color}"
						onclick={() => newTagColor = color}
						aria-label="Color {color}"
					></button>
				{/each}
			</div>
			<button
				class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
				onclick={addTag}
			>
				<Plus class="w-5 h-5" />
				Crear etiqueta
			</button>
		</div>
	</div>
{/if}

<!-- New Task Bottom Sheet -->
{#if showNewTask}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Nueva Tarea</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={() => showNewTask = false}>
				<X class="w-4 h-4" />
			</button>
		</div>
		
		<input 
			type="text" 
			bind:value={newTaskTitle}
			placeholder="Escribe tu tarea..." 
			class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-5"
		/>

		<div class="mb-8">
			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-3">Etiqueta</p>
			{#if tags.length === 0}
				<button
					type="button"
					class="w-full py-3.5 rounded-xl border border-brand-accent/50 bg-brand-accent-muted text-brand-accent font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-accent/20 transition-colors"
					onclick={() => { showNewTask = false; showTags = true; }}
				>
					<Tag class="w-4 h-4" />
					Crear tu primera etiqueta
				</button>
			{:else}
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors {selectedTagId === null
							? 'bg-brand-accent text-brand-bg border-brand-accent'
							: 'border-brand-divider text-brand-text-muted'}"
						onclick={() => selectedTagId = null}
					>
						Ninguna
					</button>
					{#each tags as tag (tag.id)}
						<button
							type="button"
							class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all {selectedTagId === tag.id
								? 'ring-2 ring-white scale-[1.02]'
								: 'opacity-80'}"
							style="background-color: {tag.color}; color: #2a323f"
							onclick={() => selectedTagId = tag.id}
						>
							{tag.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		
		<button 
			class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
			onclick={addTask}
		>
			<Plus class="w-5 h-5" />
			Añadir Tarea
		</button>
	</div>
{/if}

<!-- Novedades de la Tarea Bottom Sheet -->
{#if showTaskUpdate}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Novedades de la Tarea</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={() => showTaskUpdate = false}>
				<X class="w-4 h-4" />
			</button>
		</div>
		
		<textarea 
			bind:value={editingNovedad}
			placeholder="Escribe aquí cualquier novedad o detalle..." 
			class="w-full h-32 bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-5 resize-none"
		></textarea>

		{#if tags.length > 0}
			<div class="mb-6">
				<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-3">Etiqueta</p>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors {editingTagId === null
							? 'bg-brand-accent text-brand-bg border-brand-accent'
							: 'border-brand-divider text-brand-text-muted'}"
						onclick={() => editingTagId = null}
					>
						Ninguna
					</button>
					{#each tags as tag (tag.id)}
						<button
							type="button"
							class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all {editingTagId === tag.id
								? 'ring-2 ring-white scale-[1.02]'
								: 'opacity-80'}"
							style="background-color: {tag.color}; color: #2a323f"
							onclick={() => editingTagId = tag.id}
						>
							{tag.name}
						</button>
					{/each}
				</div>
			</div>
		{/if}
		
		<button 
			class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors mb-5"
			onclick={saveNovedad}
		>
			Guardar
		</button>

		<div class="border-t border-brand-divider pt-5 space-y-3">
			{#if editingNovedad.trim()}
				<button 
					class="w-full py-3.5 rounded-xl border border-red-400/40 text-red-400 font-semibold text-sm hover:bg-red-500/10 transition-colors"
					onclick={() => { editingNovedad = ''; saveNovedad(); }}
				>
					Eliminar novedad
				</button>
			{/if}
			<button 
				class="w-full py-3.5 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25 transition-colors"
				onclick={deleteTask}
			>
				<Trash2 class="w-4 h-4" />
				Eliminar tarea
			</button>
		</div>
	</div>
{/if}
