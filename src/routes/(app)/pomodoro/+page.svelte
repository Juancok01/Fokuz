<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		Timer,
		Play,
		Pause,
		RotateCcw,
		Coffee,
		Target,
		X,
		ListChecks,
		Check
	} from 'lucide-svelte';
	import {
		BREAK_MS,
		FOCUS_MS,
		acknowledgePomodoro,
		clearPomodoroTask,
		formatPomodoroTime,
		pausePomodoro,
		pomodoro,
		resetPomodoro,
		setPomodoroPhase,
		startPomodoro
	} from '$lib/pomodoro.svelte';

	const progress = $derived.by(() => {
		const total = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
		if (total <= 0) return 0;
		if (pomodoro.awaitingAck) return 100;
		return Math.min(100, Math.max(0, ((total - pomodoro.remainingMs) / total) * 100));
	});

	const phaseLabel = $derived(pomodoro.phase === 'focus' ? 'Enfoque' : 'Descanso');

	const statusLabel = $derived.by(() => {
		if (pomodoro.awaitingAck) {
			return pomodoro.phase === 'focus' ? 'Enfoque terminado' : 'Descanso terminado';
		}
		if (pomodoro.running) return 'En curso';
		return 'Listo';
	});

	onMount(() => {
		const taskIdRaw = page.url.searchParams.get('task');
		const title = page.url.searchParams.get('title');
		if (taskIdRaw && title) {
			const id = Number(taskIdRaw);
			if (!Number.isNaN(id)) {
				pomodoro.linkedTaskId = id;
				pomodoro.linkedTaskTitle = title;
			}
		}
	});
</script>

<svelte:head>
	<title>Pomodoro · Fokuz</title>
</svelte:head>

<header
	class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider"
>
	<div class="flex items-center gap-3">
		<Timer class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Pomodoro</h1>
	</div>
	{#if pomodoro.sessions > 0}
		<span class="text-xs font-semibold text-brand-accent bg-brand-accent-muted px-2.5 py-1 rounded-lg">
			{pomodoro.sessions} foco{pomodoro.sessions === 1 ? '' : 's'}
		</span>
	{/if}
</header>

<div class="flex-1 overflow-y-auto px-6 py-6 pb-28 flex flex-col">
	<div class="grid grid-cols-2 gap-2 mb-8">
		<button
			type="button"
			class="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-colors {pomodoro.phase === 'focus'
				? 'border-brand-accent bg-brand-accent text-brand-bg'
				: 'border-brand-divider bg-brand-surface text-brand-text-muted'} disabled:opacity-50"
			onclick={() => setPomodoroPhase('focus')}
			disabled={pomodoro.running || pomodoro.awaitingAck}
		>
			<Target class="w-4 h-4" />
			Enfoque · 25
		</button>
		<button
			type="button"
			class="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-colors {pomodoro.phase === 'break'
				? 'border-brand-accent bg-brand-accent text-brand-bg'
				: 'border-brand-divider bg-brand-surface text-brand-text-muted'} disabled:opacity-50"
			onclick={() => setPomodoroPhase('break')}
			disabled={pomodoro.running || pomodoro.awaitingAck}
		>
			<Coffee class="w-4 h-4" />
			Descanso · 5
		</button>
	</div>

	<div class="flex-1 flex flex-col items-center justify-center min-h-[280px]">
		<p
			class="text-xs font-bold tracking-wider uppercase mb-4 {pomodoro.awaitingAck
				? 'text-brand-accent'
				: 'text-brand-text-muted'}"
		>
			{phaseLabel}
		</p>

		<div class="relative w-56 h-56 mb-6">
			<svg class="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
				<circle
					cx="60"
					cy="60"
					r="54"
					fill="none"
					stroke="currentColor"
					stroke-width="6"
					class="text-brand-surface-elevated"
				/>
				<circle
					cx="60"
					cy="60"
					r="54"
					fill="none"
					stroke="currentColor"
					stroke-width="6"
					stroke-linecap="round"
					class="text-brand-accent transition-[stroke-dashoffset] duration-200"
					stroke-dasharray={2 * Math.PI * 54}
					stroke-dashoffset={2 * Math.PI * 54 * (1 - progress / 100)}
				/>
			</svg>
			<div class="absolute inset-0 flex flex-col items-center justify-center">
				<span class="text-5xl font-bold tabular-nums text-brand-text tracking-tight">
					{formatPomodoroTime(pomodoro.remainingMs)}
				</span>
				<span
					class="text-xs mt-1 {pomodoro.awaitingAck
						? 'text-brand-accent font-semibold'
						: 'text-brand-text-muted'}"
				>
					{statusLabel}
				</span>
			</div>
		</div>

		{#if pomodoro.awaitingAck}
			<p class="text-sm text-brand-accent text-center mb-6 max-w-xs font-medium">
				El pito seguirá hasta que pulses OK.
			</p>
		{:else if pomodoro.linkedTaskTitle}
			<div
				class="w-full max-w-sm flex items-center gap-3 rounded-xl border border-brand-accent/50 bg-brand-surface px-4 py-3 mb-6"
			>
				<ListChecks class="w-4 h-4 text-brand-accent shrink-0" />
				<div class="min-w-0 flex-1">
					<p class="text-[11px] text-brand-text-muted uppercase tracking-wider font-semibold">Enfocando</p>
					<p class="text-sm font-medium text-brand-text truncate">{pomodoro.linkedTaskTitle}</p>
				</div>
				<button
					type="button"
					class="p-1.5 rounded-full text-brand-text-muted hover:text-brand-text transition-colors"
					onclick={clearPomodoroTask}
					aria-label="Quitar tarea vinculada"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		{:else}
			<p class="text-sm text-brand-text-muted text-center mb-6 max-w-xs">
				Abre una tarea y toca <span class="text-brand-accent font-semibold">Enfocar</span> para vincularla.
			</p>
		{/if}

		<div class="flex items-center gap-3">
			<button
				type="button"
				class="w-14 h-14 rounded-full border border-brand-divider bg-brand-surface text-brand-text-muted hover:text-brand-text transition-colors flex items-center justify-center disabled:opacity-40"
				onclick={resetPomodoro}
				aria-label="Reiniciar"
				disabled={pomodoro.awaitingAck}
			>
				<RotateCcw class="w-5 h-5" />
			</button>

			{#if pomodoro.awaitingAck}
				<button
					type="button"
					class="w-20 h-20 rounded-full bg-brand-accent text-brand-bg font-bold flex flex-col items-center justify-center hover:brightness-105 transition-colors shadow-lg shadow-black/20"
					onclick={acknowledgePomodoro}
					aria-label="OK, continuar"
				>
					<Check class="w-7 h-7" strokeWidth={3} />
					<span class="text-xs font-bold mt-0.5">OK</span>
				</button>
			{:else if pomodoro.running}
				<button
					type="button"
					class="w-20 h-20 rounded-full bg-brand-accent text-brand-bg font-bold flex items-center justify-center hover:brightness-105 transition-colors shadow-lg shadow-black/20"
					onclick={pausePomodoro}
					aria-label="Pausar"
				>
					<Pause class="w-8 h-8" fill="currentColor" />
				</button>
			{:else}
				<button
					type="button"
					class="w-20 h-20 rounded-full bg-brand-accent text-brand-bg font-bold flex items-center justify-center hover:brightness-105 transition-colors shadow-lg shadow-black/20"
					onclick={startPomodoro}
					aria-label="Iniciar"
				>
					<Play class="w-8 h-8 ml-1" fill="currentColor" />
				</button>
			{/if}

			<a
				href="/tareas"
				class="w-14 h-14 rounded-full border border-brand-divider bg-brand-surface text-brand-text-muted hover:text-brand-accent transition-colors flex items-center justify-center"
				aria-label="Ir a tareas"
			>
				<ListChecks class="w-5 h-5" />
			</a>
		</div>
	</div>

	<p class="text-[11px] text-brand-text-muted text-center mt-8">
		Al terminar suena hasta pulsar OK. Luego queda listo el siguiente ciclo (descanso o enfoque).
	</p>
</div>
