<script lang="ts">
	import { Check, ChevronRight, ListChecks, Plus } from "@lucide/svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		addSubtask,
		openTaskUpdate,
		subtaskTitle = $bindable(),
		subtasks
	}: {
		addSubtask: (...args: any[]) => any;
		openTaskUpdate: (...args: any[]) => any;
		subtaskTitle: string;
		subtasks: any;
	} = $props();
</script>

<div class="mt-8">
	<div class="flex items-center justify-between mb-4">
		<h4
			class="text-base font-bold text-brand-text flex items-center gap-2"
		>
			<ListChecks class="w-5 h-5 text-brand-accent" />
			Subtareas
		</h4>
		<span
			class="text-[10px] font-bold text-brand-text-muted bg-brand-surface-elevated px-2 py-0.5 rounded-full"
		>
			{subtasks.length}
		</span>
	</div>

	{#if subtasks.length > 0}
		<div class="space-y-2 mb-4">
			{#each subtasks as subtask}
				<div
					role="button"
					tabindex="0"
					class="group flex items-center gap-3 bg-[#0d1216] border border-brand-divider p-3 rounded-lg hover:border-brand-accent/50 transition-colors cursor-pointer text-left"
					onclick={() => openTaskUpdate(subtask)}
					onkeydown={(e) =>
						e.key === "Enter" &&
						openTaskUpdate(subtask)}
				>
					<div
						class="w-4 h-4 rounded-full border {subtask.is_completed
							? 'bg-brand-accent border-brand-accent'
							: 'border-brand-text-muted'} flex items-center justify-center shrink-0 transition-colors"
					>
						{#if subtask.is_completed}
							<Check
								class="w-3 h-3 text-brand-bg"
							/>
						{/if}
					</div>
					<span
						class="text-sm {subtask.is_completed
							? 'line-through text-brand-text-muted'
							: 'text-brand-text'} truncate flex-1"
						>{subtask.title}</span
					>
					<ChevronRight
						class="w-4 h-4 text-brand-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
					/>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<input
			type="text"
			bind:value={subtaskTitle}
			placeholder="Añadir nueva subtarea..."
			class="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-text-muted focus:outline-none border-b border-brand-divider focus:border-brand-accent py-2 transition-colors"
			onkeydown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					addSubtask();
				}
			}}
		/>
		<button
			type="button"
			onclick={addSubtask}
			disabled={!subtaskTitle.trim()}
			class="shrink-0 w-8 h-8 rounded-lg bg-brand-surface-elevated flex items-center justify-center text-brand-accent disabled:opacity-50 transition-colors border border-brand-divider cursor-pointer hover:border-brand-accent"
		>
			<Plus class="w-4 h-4" />
		</button>
	</div>
</div>
