<script lang="ts">
	import { Calendar, GripVertical, CheckCircle2, Circle, Plus, X, Flag, Bell, AlertTriangle, Trash2 } from 'lucide-svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dndzone } from 'svelte-dnd-action';
	
	// Estado de la aplicación usando las Runes de Svelte 5
	let tasks = $state<any[]>([]);
	
	// Inicializar la fecha a las 00:00:00 sin mutaciones externas para evitar warnings en Svelte 5
	const initDate = new Date();
	initDate.setHours(0,0,0,0);
	let selectedDate = $state(initDate);

	let showNewTask = $state(false);
	let showTaskUpdate = $state(false);
	let showCalendar = $state(false);
	let activeTab = $state('Focus');
	let newTaskTitle = $state('');
	
	// Estado para editar la novedad
	let selectedTaskId = $state<number | null>(null);
	let editingNovedad = $state('');

	// Variables para el calendario custom
	let calMonth = $state(initDate.getMonth());
	let calYear = $state(initDate.getFullYear());

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

	// Sincronizar el calendario con la fecha seleccionada al abrir
	$effect(() => {
		if (showCalendar) {
			calMonth = selectedDate.getMonth();
			calYear = selectedDate.getFullYear();
		}
	});

	// Funciones auxiliares
	const formatDateString = (d: Date) => {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const fetchTasks = async () => {
		if (!supabase) {
			console.warn("Supabase no está configurado. Las tareas no se pueden cargar.");
			tasks = [];
			return;
		}

		const { data, error } = await supabase
			.from('tasks')
			.select('*')
			.eq('date', formatDateString(selectedDate))
			.order('order_index', { ascending: true });
			
		if (error) alert("Error al cargar: " + error.message);
		if (data) tasks = data;
	};

	// Efecto para recargar tareas cuando cambia la fecha
	$effect(() => {
		fetchTasks();
	});

	const toggleTask = async (id: number) => {
		const task = tasks.find(t => t.id === id);
		if (task) {
			task.is_completed = !task.is_completed;
			if (supabase) {
				const { error } = await supabase.from('tasks').update({ is_completed: task.is_completed }).eq('id', id);
				if (error) alert("Error al actualizar: " + error.message);
			}
		}
	};

	const addTask = async () => {
		if (!newTaskTitle.trim()) return;
		
		const newTask = {
			title: newTaskTitle,
			is_completed: false,
			date: formatDateString(selectedDate),
			order_index: tasks.length,
			novedad: ''
		};

		if (supabase) {
			const { data, error } = await supabase.from('tasks').insert([newTask]).select();
			if (error) {
				alert("Error al crear tarea: " + error.message);
				return;
			}
			if (data) {
				tasks = [...tasks, { ...data[0] }];
			}
		} else {
			tasks = [...tasks, { id: Date.now(), ...newTask }];
		}
		
		newTaskTitle = '';
		showNewTask = false;
	};

	const openTaskUpdate = (task: any) => {
		selectedTaskId = task.id;
		editingNovedad = task.novedad || '';
		showTaskUpdate = true;
	};

	const saveNovedad = async () => {
		if (selectedTaskId === null) return;
		
		const taskIndex = tasks.findIndex(t => t.id === selectedTaskId);
		if (taskIndex !== -1) {
			tasks[taskIndex].novedad = editingNovedad;
			if (supabase) {
				await supabase.from('tasks').update({ novedad: editingNovedad }).eq('id', selectedTaskId);
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
	};

	const setDate = (offset: number) => {
		const d = new Date();
		d.setDate(d.getDate() + offset);
		d.setHours(0,0,0,0);
		selectedDate = d;
	};

	const isToday = (d: Date) => {
		const today = new Date();
		return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
	};

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
				novedad: t.novedad
			}));
			await supabase.from('tasks').upsert(updates);
		}
	};

	// Cálculo de progreso
	let progress = $derived(tasks.length > 0 ? Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100) : 0);
</script>

<svelte:head>
	<title>Fokuz</title>
</svelte:head>

<!-- Header -->
<header class="flex items-center justify-between p-6 bg-white pb-4 rounded-b-3xl z-10 sticky top-0 shadow-sm">
	<div class="flex items-center gap-3">
		<Calendar class="w-6 h-6 text-brand-blue" />
		<h1 class="text-xl font-bold text-gray-900">Fokuz</h1>
	</div>
</header>

<!-- Contenido principal -->
<div class="flex-1 overflow-y-auto px-6 py-4 pb-24">
	
	<!-- Selector de fecha -->
	<div class="flex items-center justify-between bg-white rounded-2xl p-1 mb-8 shadow-sm">
		<div class="flex flex-1 justify-between items-center text-sm font-medium text-gray-500">
			<button class="px-4 py-2 hover:text-gray-900 transition-colors" onclick={() => setDate(-1)}>Yesterday</button>
			<button class="px-6 py-2 {isToday(selectedDate) ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-700'} rounded-xl shadow-sm transition-colors" onclick={() => setDate(0)}>Today</button>
			<button class="px-4 py-2 hover:text-gray-900 transition-colors" onclick={() => setDate(1)}>Tomorrow</button>
		</div>
		<div class="w-px h-6 bg-gray-200 mx-2"></div>
		
		<!-- Selector Custom (Botón para abrir modal) -->
		<button 
			class="relative w-9 h-9 flex items-center justify-center text-brand-blue hover:bg-brand-light-blue rounded-full transition-colors"
			onclick={() => showCalendar = true}
		>
			<Calendar class="w-5 h-5" />
		</button>
	</div>

	<!-- Lista de prioridades -->
	<div class="mb-2">
		<h2 class="text-xs font-bold text-gray-400 tracking-wider mb-4 uppercase">Current Focus</h2>
		
		<section 
			class="flex flex-col gap-3 min-h-[50px]" 
			use:dndzone={{items: tasks, flipDurationMs: 200, dropTargetStyle: {}}} 
			onconsider={handleDndConsider} 
			onfinalize={handleDndFinalize}
		>
			{#each tasks as task (task.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div 
					class="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-200 border-l-4 {selectedTaskId === task.id ? 'bg-white border-brand-blue shadow-md' : 'bg-white border-transparent hover:bg-gray-50 hover:shadow-sm'}"
					onclick={() => openTaskUpdate(task)}
				>
					<div class="flex items-center gap-4 flex-1">
						<!-- svelte-ignore a11y_consider_explicit_label -->
						<button 
							onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
							class="text-gray-400 hover:text-brand-blue transition-colors focus:outline-none"
						>
							{#if task.is_completed}
								<CheckCircle2 class="w-6 h-6 text-brand-blue fill-brand-light-blue" />
							{:else}
								<Circle class="w-6 h-6" />
							{/if}
						</button>
						<span class="text-[15px] font-medium {task.is_completed ? 'text-gray-400 line-through' : 'text-gray-800'}">
							{task.title}
						</span>
					</div>
					
					<div class="flex items-center gap-2">
						{#if task.novedad && task.novedad.trim() !== ''}
							<AlertTriangle class="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
						{/if}
						<div class="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1">
							<GripVertical class="w-5 h-5" />
						</div>
					</div>
				</div>
			{/each}
		</section>
		{#if tasks.length === 0}
			<div class="text-center py-8 text-gray-400 text-sm">
				No hay prioridades para este día.
			</div>
		{/if}
	</div>

	<!-- Barra de progreso -->
	<div class="mt-8 mb-6">
		<div class="flex justify-between items-center mb-2">
			<span class="text-xs font-bold text-gray-400 tracking-wider uppercase">Daily Progress</span>
			<span class="text-sm font-bold text-brand-blue">{progress}%</span>
		</div>
		<div class="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
			<div 
				class="h-full bg-brand-blue rounded-full transition-all duration-500 ease-out" 
				style="width: {progress}%"
			></div>
		</div>
	</div>
</div>

<!-- Floating Action Button -->
<button 
	class="fixed bottom-8 right-6 lg:absolute w-14 h-14 bg-brand-blue hover:bg-blue-800 text-white rounded-full shadow-lg shadow-blue-200 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-20"
	onclick={() => showNewTask = true}
>
	<Plus class="w-7 h-7" />
</button>

<!-- Modals (Bottom Sheets) -->

<!-- Overlay -->
{#if showNewTask || showTaskUpdate || showCalendar}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
		onclick={() => { showNewTask = false; showTaskUpdate = false; showCalendar = false; }}
	></div>
{/if}

<!-- Calendario Custom Bottom Sheet -->
{#if showCalendar}
	<div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<button class="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100" onclick={prevMonth}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
			</button>
			<h3 class="text-lg font-bold text-gray-900 capitalize">{monthNames[calMonth]} {calYear}</h3>
			<button class="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100" onclick={nextMonth}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
			</button>
		</div>
		
		<div class="grid grid-cols-7 gap-2 text-center mb-2">
			{#each ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as dayStr}
				<div class="text-xs font-bold text-gray-400">{dayStr}</div>
			{/each}
		</div>
		
		<div class="grid grid-cols-7 gap-2 text-center mb-6">
			{#each calendarDays as day}
				{#if day === null}
					<div></div>
				{:else}
					{@const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear}
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button 
						class="w-10 h-10 mx-auto flex items-center justify-center rounded-full text-sm transition-all {isSelected ? 'bg-brand-blue text-white font-bold shadow-md shadow-blue-200' : 'text-gray-700 hover:bg-brand-light-blue'}"
						onclick={() => selectCalendarDate(day)}
					>
						{day}
					</button>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<!-- New Task Bottom Sheet -->
{#if showNewTask}
	<div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-gray-900">Nueva Tarea</h3>
			<button class="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100" onclick={() => showNewTask = false}>
				<X class="w-4 h-4" />
			</button>
		</div>
		
		<input 
			type="text" 
			bind:value={newTaskTitle}
			placeholder="Escribe tu tarea..." 
			class="w-full bg-brand-bg rounded-xl p-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 mb-8"
		/>
		
		<button 
			class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
			onclick={addTask}
		>
			<Plus class="w-5 h-5" />
			Añadir Tarea
		</button>
	</div>
{/if}

<!-- Novedades de la Tarea Bottom Sheet -->
{#if showTaskUpdate}
	<div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-gray-900">Novedades de la Tarea</h3>
			<button class="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100" onclick={() => showTaskUpdate = false}>
				<X class="w-4 h-4" />
			</button>
		</div>
		
		<textarea 
			bind:value={editingNovedad}
			placeholder="Escribe aquí cualquier novedad o detalle..." 
			class="w-full h-32 bg-brand-bg rounded-xl p-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 mb-2 resize-none"
		></textarea>
		
		<div class="flex justify-end mb-4 h-6">
			{#if editingNovedad.trim()}
				<button 
					class="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
					onclick={() => { editingNovedad = ''; saveNovedad(); }}
				>
					Eliminar Novedad
				</button>
			{/if}
		</div>
		
		<div class="flex gap-3">
			<button 
				class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
				onclick={saveNovedad}
			>
				Guardar Novedad
			</button>
			<button 
				class="bg-red-50 hover:bg-red-100 text-red-500 font-bold px-5 rounded-xl flex items-center justify-center transition-colors shadow-sm"
				onclick={deleteTask}
				aria-label="Eliminar Tarea"
			>
				<Trash2 class="w-5 h-5" />
			</button>
		</div>
	</div>
{/if}
