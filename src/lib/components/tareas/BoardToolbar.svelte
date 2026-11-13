<script lang="ts">
	import { ArrowLeft, Calendar, ChevronDown, Kanban, LayoutList, List, Plus, Tag } from "@lucide/svelte";
	import { goto } from "$app/navigation";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		addList,
		allBoards,
		boardId,
		currentBoard,
		showBoardDropdown = $bindable(),
		showTags = $bindable(),
		viewMode = $bindable()
	}: {
		addList: (...args: any[]) => any;
		allBoards: any[];
		boardId: any;
		currentBoard: any;
		showBoardDropdown: boolean;
		showTags: boolean;
		viewMode: any;
	} = $props();
</script>

<header
	class="shrink-0 border-b border-brand-divider bg-brand-surface px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4"
>
	<div class="flex flex-wrap items-center gap-3">
		<button
			onclick={() => goto("/tareas")}
			title="Volver a mis tableros"
			class="flex items-center justify-center p-2 text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated rounded-lg transition-colors border border-brand-divider shadow-sm bg-[#0d1216]"
		>
			<ArrowLeft class="w-4 h-4" />
		</button>
		<div class="relative">
			<button
				onclick={() => (showBoardDropdown = !showBoardDropdown)}
				class="flex items-center gap-2 text-brand-text hover:text-brand-accent transition-colors font-bold text-sm bg-[#0d1216] border border-brand-divider px-3 py-1.5 rounded-lg"
			>
				<span
					class="w-2 h-2 rounded-full"
					style={currentBoard
						? `background-color: ${currentBoard.color}`
						: "background-color: var(--color-brand-accent)"}
				></span>
				{currentBoard ? currentBoard.title : "Cargando..."}
				<ChevronDown
					class="w-4 h-4 text-brand-text-muted transition-transform {showBoardDropdown
						? 'rotate-180'
						: ''}"
				/>
			</button>

			{#if showBoardDropdown}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="fixed inset-0 z-40"
					onclick={() => (showBoardDropdown = false)}
				></div>
				<div
					class="absolute top-full left-0 mt-2 w-64 bg-brand-surface border border-brand-divider rounded-xl shadow-xl z-50 py-2"
				>
					<div
						class="px-3 pb-2 mb-2 border-b border-brand-divider"
					>
						<span
							class="text-xs font-semibold text-brand-text-muted uppercase tracking-wider"
							>Tus Tableros</span
						>
					</div>
					{#each allBoards as board}
						<button
							class="w-full text-left px-4 py-2 hover:bg-brand-surface-elevated transition-colors flex items-center gap-3 {board.id ==
							boardId
								? 'bg-brand-surface-elevated'
								: ''}"
							onclick={() => {
								showBoardDropdown = false;
								goto("/tareas/" + board.id);
							}}
						>
							<span
								class="w-2.5 h-2.5 rounded-full"
								style="background-color: {board.color}"
							></span>
							<span
								class="text-sm font-medium {board.id ==
								boardId
									? 'text-brand-accent'
									: 'text-brand-text'}"
								>{board.title}</span
							>
						</button>
					{/each}
					<div
						class="mt-2 pt-2 border-t border-brand-divider px-2"
					>
						<button
							onclick={() => {
								showBoardDropdown = false;
								goto("/tareas");
							}}
							class="w-full text-left px-2 py-1.5 hover:bg-brand-surface-elevated transition-colors rounded-lg flex items-center gap-2 text-sm font-semibold text-brand-text-muted"
						>
							<List class="w-4 h-4" /> Ver todos los tableros
						</button>
					</div>
				</div>
			{/if}
		</div>

		<div
			class="flex items-center gap-1 border border-brand-divider bg-[#0d1216] p-1 rounded-lg"
		>
			<button
				onclick={() => (viewMode = "kanban")}
				class="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors {viewMode ===
				'kanban'
					? 'bg-brand-surface-elevated border border-brand-divider text-brand-accent shadow-sm'
					: 'text-brand-text-muted hover:text-brand-text border border-transparent'}"
			>
				<Kanban class="w-3.5 h-3.5" /> Kanban
			</button>
			<button
				onclick={() => (viewMode = "lista")}
				class="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors {viewMode ===
				'lista'
					? 'bg-brand-surface-elevated border border-brand-divider text-brand-accent shadow-sm'
					: 'text-brand-text-muted hover:text-brand-text border border-transparent'}"
			>
				<LayoutList class="w-3.5 h-3.5" /> Lista
			</button>
			<button
				onclick={() => (viewMode = "calendario")}
				class="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors {viewMode ===
				'calendario'
					? 'bg-brand-surface-elevated border border-brand-divider text-brand-accent shadow-sm'
					: 'text-brand-text-muted hover:text-brand-text border border-transparent'}"
			>
				<Calendar class="w-3.5 h-3.5" /> Calendario
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 md:gap-3">
		<button
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text border border-transparent hover:border-brand-divider text-xs font-semibold transition-colors"
			onclick={() => (showTags = true)}
		>
			<Tag class="w-3.5 h-3.5" /> Etiquetas
		</button>

		<button
			class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-brand-bg bg-brand-accent hover:brightness-105 shadow-[0_0_10px_var(--color-brand-accent-muted)] text-xs font-bold transition-all w-full sm:w-auto justify-center"
			onclick={addList}
		>
			<Plus class="w-4 h-4" /> Añadir Lista
		</button>
	</div>
</header>
