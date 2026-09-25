<script lang="ts">
	import { ArrowLeft, Clock, CheckCircle2, Circle, ListChecks, Calendar, Kanban } from '@lucide/svelte';
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
	let loading = $state(true);

	const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

	let todayTasks = $derived.by(() => {
		const filtered = tasks.filter(t => {
			const targetDate = t.end_date ? t.end_date : t.date;
			if (!targetDate) return false;
			return targetDate.startsWith(todayStr);
		});
		
		return filtered.sort((a, b) => {
			const dateA = a.end_date || a.date || '';
			const dateB = b.end_date || b.date || '';
			return dateA.localeCompare(dateB);
		});
	});

	async function loadAllTasks() {
		if (!supabase) return;
		loading = true;
		const { data, error } = await supabase
			.from('tasks')
			.select('*, boards(title, color)');
		if (!error && data) {
			tasks = data;
		}
		loading = false;
	}

	async function toggleTask(task: Task) {
		if (!supabase) return;
		const previous = task.is_completed;
		
		tasks = tasks.map(t => t.id === task.id ? { ...t, is_completed: !t.is_completed } : t);

		const { error } = await supabase
			.from('tasks')
			.update({ is_completed: !previous })
			.eq('id', task.id);
		
		if (error) {
			tasks = tasks.map(t => t.id === task.id ? { ...t, is_completed: previous } : t);
			alert('Error al actualizar: ' + error.message);
		}
	}

	$effect(() => {
		loadAllTasks();
	});
</script>

<svelte:head>
	<title>Hoy · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden p-4 md:p-6">
	<header class="flex items-start sm:items-center gap-4 mb-6 md:mb-8 shrink-0">
		<button
			onclick={() => goto('/tareas')}
			class="p-2 bg-brand-surface border border-brand-divider rounded-xl hover:bg-brand-surface-elevated text-brand-text-muted hover:text-brand-text transition-colors"
			aria-label="Volver a Tableros"
		>
			<ArrowLeft class="w-5 h-5" />
		</button>
		<div>
			<h1 class="text-2xl font-bold text-brand-text">Tareas para Hoy</h1>
			<p class="text-sm text-brand-text-muted mt-1">Todas tus tareas de todos los tableros que vencen el día de hoy</p>
		</div>
	</header>

	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
		</div>
	{:else if todayTasks.length === 0}
		<div class="flex-1 flex flex-col items-center justify-center text-brand-text-muted">
			<CheckCircle2 class="w-16 h-16 mb-4 text-brand-accent opacity-50" />
			<h2 class="text-xl font-semibold mb-2 text-brand-text">Todo al día</h2>
			<p class="mb-6 max-w-md text-center">No tienes tareas pendientes que venzan hoy. ¡Disfruta tu día!</p>
			<button 
				onclick={() => goto('/tareas')}
				class="flex items-center gap-2 px-6 py-3 rounded-lg text-brand-bg bg-brand-accent font-bold transition-all"
			>
				Volver a mis tableros
			</button>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto custom-scrollbar pb-12">
			<div class="max-w-4xl mx-auto space-y-3">
				{#each todayTasks as task}
					<div class="bg-brand-surface border border-brand-divider rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-accent/50 transition-colors group">
						<div class="flex items-start sm:items-center gap-4">
							<button class="shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors" onclick={() => toggleTask(task)}>
								{#if task.is_completed}
									<CheckCircle2 class="w-6 h-6 text-brand-accent" />
								{:else}
									<Circle class="w-6 h-6" />
								{/if}
							</button>
							<div class="flex flex-col">
								<h3 class="text-base font-bold text-brand-text transition-colors {task.is_completed ? 'line-through opacity-50 text-brand-text-muted' : ''}">
									{task.title}
								</h3>
								{#if task.boards || task.end_date}
									<div class="flex items-center gap-2 mt-1">
										{#if task.boards}
											<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background-color: {task.boards.color}15; color: {task.boards.color}; border: 1px solid {task.boards.color}30">
												{task.boards.title}
											</span>
										{/if}
										{#if task.end_date && task.end_date.includes('T')}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
												<Clock class="w-3 h-3" />
												{new Date(task.end_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
						
						<div class="flex items-center sm:justify-end gap-4 w-full sm:w-auto">
							<button 
								class="px-4 py-2 bg-[#0d1216] border border-brand-divider rounded-lg text-xs font-bold text-brand-text hover:bg-brand-surface-elevated transition-colors flex items-center justify-center w-full sm:w-auto gap-2"
								onclick={() => goto(`/tareas/${task.board_id}`)}
							>
								<Kanban class="w-4 h-4" /> Ir al tablero
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
