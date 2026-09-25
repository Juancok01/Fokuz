<script lang="ts">
	import { ChevronLeft, ChevronRight, ArrowLeft } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';

	type Task = {
		id: number;
		title: string;
		is_completed: boolean;
		date?: string;
		end_date?: string;
		board_id?: number;
		boards?: {
			title: string;
			color: string;
		};
	};

	let tasks = $state<Task[]>([]);
	let calendarCurrentMonth = $state(new Date());

	let boardCalendarDays = $derived.by(() => {
		const year = calendarCurrentMonth.getFullYear();
		const month = calendarCurrentMonth.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		
		let days = [];
		const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lunes como inicio
		for (let i = 0; i < startPadding; i++) {
			const d = new Date(year, month, -startPadding + i + 1);
			days.push({ date: d, currentMonth: false });
		}
		
		for (let i = 1; i <= lastDay.getDate(); i++) {
			const d = new Date(year, month, i);
			days.push({ date: d, currentMonth: true, isToday: new Date().toDateString() === d.toDateString() });
		}
		
		const endPadding = 42 - days.length;
		for (let i = 1; i <= endPadding; i++) {
			const d = new Date(year, month + 1, i);
			days.push({ date: d, currentMonth: false });
		}
		return days;
	});

	function getTasksForCalendarDate(d: Date) {
		const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
		return tasks.filter(t => {
			const targetDate = t.end_date ? t.end_date : t.date;
			return targetDate === dateStr;
		});
	}

	function nextCalMonth() { calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() + 1, 1); }
	function prevCalMonth() { calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() - 1, 1); }

	async function loadAllTasks() {
		if (!supabase) return;
		const { data, error } = await supabase
			.from('tasks')
			.select('*, boards(title, color)');
		if (!error && data) {
			tasks = data;
		}
	}

	$effect(() => {
		loadAllTasks();
	});
</script>

<svelte:head>
	<title>Calendario Global · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden p-4 md:p-6">
	<header class="flex items-start md:items-center gap-4 mb-6 md:mb-8 shrink-0">
		<button
			onclick={() => goto('/tareas')}
			class="p-2 bg-brand-surface border border-brand-divider rounded-xl hover:bg-brand-surface-elevated text-brand-text-muted hover:text-brand-text transition-colors"
			aria-label="Volver a Tableros"
		>
			<ArrowLeft class="w-5 h-5" />
		</button>
		<div>
			<h1 class="text-2xl font-bold text-brand-text">Calendario Global</h1>
			<p class="text-sm text-brand-text-muted mt-1">Vista de todas las tareas en todos tus tableros</p>
		</div>
	</header>

	<div class="flex-1 overflow-y-auto custom-scrollbar pb-12">
		<div class="max-w-6xl mx-auto h-full flex flex-col min-h-[600px]">
			<!-- Cabecera Mes -->
			<div class="flex items-center justify-between mb-4 bg-[#0d1216] border border-brand-divider p-3 rounded-2xl shadow-sm shrink-0">
				<h2 class="text-lg font-bold text-brand-text px-3 capitalize">
					{calendarCurrentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
				</h2>
				<div class="flex items-center gap-2">
					<button class="p-2 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted transition-colors" onclick={prevCalMonth}>
						<ChevronLeft class="w-5 h-5"/>
					</button>
					<button class="px-4 py-1.5 bg-brand-surface-elevated text-xs font-bold text-brand-accent rounded-lg border border-brand-divider" onclick={() => calendarCurrentMonth = new Date()}>
						Hoy
					</button>
					<button class="p-2 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted transition-colors" onclick={nextCalMonth}>
						<ChevronRight class="w-5 h-5"/>
					</button>
				</div>
			</div>

			<!-- Grid Calendario -->
			<div class="flex-1 bg-[#0d1216] border border-brand-divider rounded-2xl overflow-hidden flex flex-col shadow-lg">
				<!-- Cabecera Días -->
				<div class="grid grid-cols-7 border-b border-brand-divider bg-brand-surface">
					{#each ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as day}
						<div class="py-3 text-center text-xs font-bold text-brand-text-muted uppercase tracking-wider">{day}</div>
					{/each}
				</div>
				
				<!-- Celdas -->
				<div class="grid grid-cols-7 flex-1 auto-rows-[minmax(120px,1fr)]">
					{#each boardCalendarDays as day, i}
						<div class="p-2 border-r border-b border-brand-divider/50 {i % 7 === 6 ? 'border-r-0' : ''} {i >= 35 ? 'border-b-0' : ''} {!day.currentMonth ? 'bg-[#070b0e] opacity-50' : 'bg-[#0d1216]' } relative group transition-colors hover:bg-brand-surface-elevated/30">
							<div class="flex justify-between items-start mb-2">
								<span class="w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold {day.isToday ? 'bg-brand-accent text-brand-bg shadow-[0_0_8px_var(--color-brand-accent-muted)]' : 'text-brand-text'}">
									{day.date.getDate()}
								</span>
							</div>
							
							<!-- Tareas del día -->
							<div class="space-y-1.5 h-[80px] overflow-y-auto custom-scrollbar pr-1">
								{#each getTasksForCalendarDate(day.date) as task}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div class="px-2 py-1.5 rounded-md text-[10px] font-semibold flex flex-col gap-1 border cursor-pointer hover:brightness-110 transition-all {task.is_completed ? 'bg-brand-surface/50 border-brand-divider text-brand-text-muted line-through' : 'bg-brand-surface-elevated border-brand-accent/30 text-brand-text shadow-sm'}" title={task.title} onclick={() => goto(`/tareas/${task.board_id}`)}>
										<span class="truncate">{task.title}</span>
										{#if task.boards}
											<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold w-fit truncate max-w-full" style="background-color: {task.boards.color}15; color: {task.boards.color}; border: 1px solid {task.boards.color}30">
												{task.boards.title}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
