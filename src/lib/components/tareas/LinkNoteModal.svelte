<script lang="ts">
	import { StickyNote, X } from "@lucide/svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		linkModalSearchQuery = $bindable(),
		linkNoteToTask,
		linkNotesLoading,
		linkableFolders,
		linkableNotes,
		showLinkNoteModal = $bindable()
	}: {
		linkModalSearchQuery: string;
		linkNoteToTask: (...args: any[]) => any;
		linkNotesLoading: boolean;
		linkableFolders: any[];
		linkableNotes: any[];
		showLinkNoteModal: boolean;
	} = $props();
</script>

<div
	class="fixed inset-0 bg-[#070b0e]/90 flex items-center justify-center z-100 p-4 backdrop-blur-sm"
>
	<div
		class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
	>
		<div class="flex items-center justify-between mb-6">
			<h3
				class="text-lg font-black text-brand-text flex items-center gap-2"
			>
				<StickyNote class="w-5 h-5 text-brand-accent" /> Vincular Nota
			</h3>
			<button
				class="p-1 rounded-md text-brand-text-muted hover:bg-brand-surface hover:text-brand-text transition-colors"
				onclick={() => (showLinkNoteModal = false)}
			>
				<X class="w-5 h-5" />
			</button>
		</div>
		<div class="mb-4">
			<input
				type="text"
				bind:value={linkModalSearchQuery}
				placeholder="Buscar nota por título..."
				class="w-full bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 text-sm font-semibold text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
			/>
		</div>
		<div class="flex-1 overflow-y-auto custom-scrollbar space-y-4">
			{#if linkNotesLoading}
				<p class="text-xs text-brand-text-muted text-center py-4">
					Cargando notas...
				</p>
			{:else}
				{@const filteredLinkNotes = linkableNotes.filter((n) =>
					n.title
						.toLowerCase()
						.includes(linkModalSearchQuery.toLowerCase()),
				)}
				{#if filteredLinkNotes.length === 0}
					<p
						class="text-xs text-brand-text-muted text-center py-4"
					>
						No se encontraron notas.
					</p>
				{:else}
					{#each linkableFolders as folder}
						{@const folderNotes = filteredLinkNotes.filter(
							(n) => n.folder_id === folder.id,
						)}
						{#if folderNotes.length > 0}
							<div class="mb-4">
								<h4
									class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2 px-1"
								>
									{folder.name}
								</h4>
								<div class="space-y-1">
									{#each folderNotes as note}
										<button
											class="w-full text-left p-2 rounded-lg bg-[#070b0e] hover:bg-brand-surface border border-brand-divider hover:border-brand-accent/50 transition-colors"
											onclick={() =>
												linkNoteToTask(note)}
										>
											<span
												class="text-sm font-bold text-brand-text block truncate"
												>{note.title ||
													"Sin título"}</span
											>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
					{@const unassignedNotes = filteredLinkNotes.filter(
						(n) => !n.folder_id,
					)}
					{#if unassignedNotes.length > 0}
						<div class="mb-4">
							<h4
								class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2 px-1"
							>
								Sin Carpeta
							</h4>
							<div class="space-y-1">
								{#each unassignedNotes as note}
									<button
										class="w-full text-left p-2 rounded-lg bg-[#070b0e] hover:bg-brand-surface border border-brand-divider hover:border-brand-accent/50 transition-colors"
										onclick={() => linkNoteToTask(note)}
									>
										<span
											class="text-sm font-bold text-brand-text block truncate"
											>{note.title ||
												"Sin título"}</span
										>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
</div>
