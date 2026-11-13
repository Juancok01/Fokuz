<script lang="ts">
	import { CheckCircle2, MoreVertical, Plus, Trash2 } from "@lucide/svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		boardItems,
		boardLists,
		openNewTask,
		openTaskUpdate
	}: {
		boardItems: any;
		boardLists: any[];
		openNewTask: (...args: any[]) => any;
		openTaskUpdate: (...args: any[]) => any;
	} = $props();
</script>

<!-- List View -->
<div
	class="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-6 bg-[#070b0e]"
>
	<div class="max-w-5xl mx-auto space-y-6">
		{#each boardLists as col (col.id)}
			<div
				class="bg-[#0d1216] rounded-2xl border border-brand-divider overflow-hidden shadow-lg"
			>
				<div
					class="bg-brand-surface border-b border-brand-divider px-6 py-4 flex items-center justify-between"
				>
					<div class="flex items-center gap-3">
						<span
							class="w-2.5 h-2.5 rounded-full {col.id ===
							'completed'
								? 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]'
								: col.id === 'progress'
									? 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]'
									: col.id === 'review'
										? 'bg-amber-400 shadow-[0_0_8px_var(--color-amber-400)]'
										: 'bg-brand-text-muted'}"
						></span>
						<h3 class="text-base font-bold text-brand-text">
							{col.name}
						</h3>
						<span
							class="text-xs font-bold text-brand-text-muted bg-[#0d1216] border border-brand-divider px-2.5 py-0.5 rounded-full"
						>
							{boardItems[col.id]?.length || 0}
						</span>
					</div>
				</div>
				<div class="divide-y divide-brand-divider/50">
					{#each boardItems[col.id] || [] as task (task.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="px-6 py-4 hover:bg-brand-surface-elevated transition-colors flex items-center justify-between group cursor-pointer"
							onclick={() => openTaskUpdate(task)}
						>
							<div class="flex items-center gap-4">
								<button
									class="w-5 h-5 rounded-md border-2 {task.is_completed
										? 'border-brand-accent bg-brand-accent text-brand-bg'
										: 'border-brand-text-muted group-hover:border-brand-accent'} flex items-center justify-center transition-colors"
								>
									{#if task.is_completed}<CheckCircle2
											class="w-3.5 h-3.5"
										/>{/if}
								</button>
								<span
									class="text-sm font-semibold {task.is_completed
										? 'text-brand-text-muted line-through'
										: 'text-brand-text'}"
									>{task.title}</span
								>
							</div>
							<div
								class="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<!-- Botones de acciones, por ahora solo iconos -->
								<button
									class="text-brand-text-muted hover:text-red-400"
									><Trash2 class="w-4 h-4" /></button
								>
								<button
									class="text-brand-text-muted hover:text-brand-accent"
									><MoreVertical
										class="w-4 h-4"
									/></button
								>
							</div>
						</div>
					{/each}
					{#if !boardItems[col.id]?.length}
						<div
							class="px-6 py-8 text-center text-sm font-medium text-brand-text-muted"
						>
							No hay tareas en esta sección
						</div>
					{/if}
				</div>
				<div
					class="px-6 py-3 bg-brand-surface/30 border-t border-brand-divider"
				>
					<button
						class="flex items-center gap-2 text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors"
						onclick={openNewTask}
					>
						<Plus class="w-4 h-4" /> Añadir tarjeta
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
