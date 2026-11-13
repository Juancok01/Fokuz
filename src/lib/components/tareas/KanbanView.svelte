<script lang="ts">
	import TaskCard from "$lib/components/tareas/TaskCard.svelte";
	import type { Contact } from "./types";
	import { AlertTriangle, Edit2, MoreVertical, Plus, Trash2 } from "@lucide/svelte";
	import { dndzone } from "svelte-dnd-action";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		addList,
		boardItems,
		boardLists,
		boardListsError,
		contacts,
		editListTitle = $bindable(),
		handleDndConsiderCards,
		handleDndConsiderColumns,
		handleDndFinalizeCards,
		handleDndFinalizeColumns,
		listToDelete = $bindable(),
		listToEdit = $bindable(),
		openListMenuId = $bindable(),
		openNewTask,
		openTaskUpdate,
		saveListEdit,
		toggleTask
	}: {
		addList: (...args: any[]) => any;
		boardItems: any;
		boardLists: any[];
		boardListsError: string;
		contacts: Contact[];
		editListTitle: string;
		handleDndConsiderCards: (...args: any[]) => any;
		handleDndConsiderColumns: (...args: any[]) => any;
		handleDndFinalizeCards: (...args: any[]) => any;
		handleDndFinalizeColumns: (...args: any[]) => any;
		listToDelete: number | null;
		listToEdit: number | null;
		openListMenuId: number | null;
		openNewTask: (...args: any[]) => any;
		openTaskUpdate: (...args: any[]) => any;
		saveListEdit: (...args: any[]) => any;
		toggleTask: (...args: any[]) => any;
	} = $props();
</script>

<!-- Kanban Board -->

<div
	class="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar p-2 md:p-6 bg-[#070b0e]"
>
	{#if boardListsError}
		<div
			class="p-8 text-center text-red-400 bg-red-400/10 rounded-xl mb-4 border border-red-400/20"
		>
			<AlertTriangle class="w-8 h-8 mx-auto mb-2" />
			<p class="font-bold">Error cargando listas:</p>
			<p>{boardListsError}</p>
		</div>
	{/if}
	{#if boardLists.length === 0 && !boardListsError}
		<div class="p-8 text-center text-brand-text-muted">
			<p>No hay listas configuradas en este tablero.</p>
			<button
				class="mt-4 px-4 py-2 bg-brand-accent text-brand-bg rounded-lg font-bold"
				onclick={addList}>Crear mi primera lista</button
			>
		</div>
	{/if}
	<div
		class="flex items-start gap-6 h-full min-w-max pb-4"
		use:dndzone={{
			items: boardLists,
			flipDurationMs: 200,
			type: "columns",
			dropTargetStyle: {},
		}}
		onconsider={handleDndConsiderColumns}
		onfinalize={handleDndFinalizeColumns}
	>
		{#each boardLists as col (col.id)}
			<div
				class="flex flex-col w-80 h-full max-h-full rounded-2xl bg-[#0d1216] border border-brand-divider overflow-hidden shadow-lg"
			>
				<!-- Column Header -->
				<div
					class="flex items-center justify-between p-4 border-b border-brand-divider/50 bg-[#0d1216] relative"
				>
					<div class="flex items-center gap-2 flex-1">
						<span
							class="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)] shrink-0"
						></span>
						{#if listToEdit === col.id}
							<input
								type="text"
								bind:value={editListTitle}
								class="flex-1 min-w-0 bg-brand-surface border border-brand-accent rounded px-2 py-0.5 text-sm font-bold text-brand-text outline-none shadow-[0_0_5px_var(--color-brand-accent-muted)]"
								onkeydown={(e) => {
									if (e.key === "Enter")
										saveListEdit();
									if (e.key === "Escape")
										listToEdit = null;
								}}
								onblur={saveListEdit}
							/>
						{:else}
							<h3
								class="text-sm font-bold text-brand-text truncate"
							>
								{col.name}
							</h3>
							<span
								class="text-[10px] font-bold text-brand-text-muted bg-brand-surface border border-brand-divider px-2 py-0.5 rounded-full shrink-0"
							>
								{boardItems[col.id]?.length || 0}
							</span>
						{/if}
					</div>
					<div class="relative shrink-0 ml-2">
						<button
							class="text-brand-text-muted hover:text-brand-text transition-colors p-1 rounded-md hover:bg-brand-surface-elevated {openListMenuId ===
							col.id
								? 'bg-brand-surface-elevated text-brand-text'
								: ''}"
							onclick={() =>
								(openListMenuId =
									openListMenuId === col.id
										? null
										: col.id)}
						>
							<MoreVertical class="w-4 h-4" />
						</button>
						{#if openListMenuId === col.id}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="fixed inset-0 z-40"
								onclick={() => (openListMenuId = null)}
							></div>
							<div
								class="absolute right-0 top-full mt-1 w-40 bg-brand-surface border border-brand-divider rounded-xl shadow-xl z-50 overflow-hidden py-1"
							>
								<button
									class="w-full text-left px-3 py-2 text-sm text-brand-text hover:bg-brand-surface-elevated transition-colors flex items-center gap-2"
									onclick={() => {
										listToEdit = col.id;
										editListTitle = col.name;
										openListMenuId = null;
									}}
								>
									<Edit2
										class="w-3.5 h-3.5 text-brand-text-muted"
									/> Editar
								</button>
								<button
									class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2"
									onclick={() => {
										listToDelete = col.id;
										openListMenuId = null;
									}}
								>
									<Trash2 class="w-3.5 h-3.5" /> Eliminar
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Column Body (Draggable Area) -->
				<div
					class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-brand-surface/30"
					use:dndzone={{
						items: boardItems[col.id] || [],
						flipDurationMs: 200,
						dropTargetStyle: {},
					}}
					onconsider={(e) =>
						handleDndConsiderCards(e, col.id)}
					onfinalize={(e) =>
						handleDndFinalizeCards(e, col.id)}
				>
					{#each boardItems[col.id] || [] as task (task.id)}
						<TaskCard {contacts} {openTaskUpdate} {task} {toggleTask} />
					{/each}

					<!-- Add Card Button inside column -->
					<button
						class="w-full py-3 mt-2 flex items-center justify-center gap-2 text-[11px] font-bold text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated border border-transparent hover:border-brand-divider rounded-xl transition-all"
						onclick={openNewTask}
					>
						<Plus class="w-4 h-4" /> Añadir tarjeta
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
