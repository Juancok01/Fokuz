<script lang="ts">
	import type { TaskTag } from "./types";
	import { Edit2, Plus, Trash2, X } from "@lucide/svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		TAG_COLORS,
		addTag,
		editTagColor = $bindable(),
		editTagName = $bindable(),
		newTagColor = $bindable(),
		newTagName = $bindable(),
		saveTagEdit,
		showTags = $bindable(),
		tagToDelete = $bindable(),
		tagToEdit = $bindable(),
		tags
	}: {
		TAG_COLORS: any[];
		addTag: (...args: any[]) => any;
		editTagColor: string;
		editTagName: string;
		newTagColor: any;
		newTagName: string;
		saveTagEdit: (...args: any[]) => any;
		showTags: boolean;
		tagToDelete: number | null;
		tagToEdit: number | null;
		tags: TaskTag[];
	} = $props();
</script>

<div
	class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4"
>
	<div
		class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]"
	>
		<div class="flex justify-between items-center mb-6 shrink-0">
			<h3 class="text-lg font-bold text-brand-text">
				Gestionar Etiquetas
			</h3>
			<button
				class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted"
				onclick={() => (showTags = false)}
				><X class="w-5 h-5" /></button
			>
		</div>

		<div
			class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 mb-6"
		>
			{#each tags as tag (tag.id)}
				{#if tagToEdit === tag.id}
					<div
						class="flex flex-col gap-3 p-3 rounded-xl bg-[#0d1216] border border-brand-accent shadow-[0_0_10px_var(--color-brand-accent-muted)]"
					>
						<input
							type="text"
							bind:value={editTagName}
							placeholder="Nombre..."
							class="w-full bg-brand-surface border border-brand-divider rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
							onkeydown={(e) =>
								e.key === "Enter" && saveTagEdit()}
						/>
						<div
							class="flex flex-wrap items-center justify-between gap-2"
						>
							<div
								class="flex gap-1.5 items-center bg-brand-surface border border-brand-divider rounded-lg px-2 py-1.5"
							>
								{#each TAG_COLORS as color}
									<button
										aria-label="Color"
										class="w-4 h-4 rounded-full transition-transform {editTagColor ===
										color
											? 'scale-125 ring-2 ring-brand-text ring-offset-1 ring-offset-brand-surface'
											: 'hover:scale-110'}"
										style="background-color: {color}"
										onclick={() =>
											(editTagColor = color)}
									></button>
								{/each}
							</div>
							<div class="flex gap-2">
								<button
									class="px-3 py-1.5 bg-brand-surface text-brand-text-muted hover:text-brand-text font-bold rounded-lg text-xs border border-brand-divider transition-colors"
									onclick={() => (tagToEdit = null)}
									>Cancelar</button
								>
								<button
									class="px-3 py-1.5 bg-brand-accent text-brand-bg font-bold rounded-lg text-xs hover:brightness-105 transition-colors"
									onclick={saveTagEdit}>Guardar</button
								>
							</div>
						</div>
					</div>
				{:else}
					<div
						class="flex items-center justify-between p-3 rounded-xl bg-[#0d1216] border border-brand-divider group"
					>
						<div class="flex items-center gap-3">
							<span
								class="w-3 h-3 rounded-full"
								style="background-color: {tag.color}"
							></span>
							<span
								class="text-sm font-semibold text-brand-text"
								>{tag.name}</span
							>
						</div>
						<div
							class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<button
								class="text-brand-text-muted hover:text-brand-text p-1.5 rounded-md hover:bg-brand-surface-elevated"
								onclick={() => {
									tagToEdit = tag.id;
									editTagName = tag.name;
									editTagColor = tag.color;
								}}
							>
								<Edit2 class="w-4 h-4" />
							</button>
							<button
								class="text-brand-text-muted hover:text-red-400 p-1.5 rounded-md hover:bg-brand-surface-elevated"
								onclick={() => (tagToDelete = tag.id)}
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					</div>
				{/if}
			{:else}
				<div class="text-center py-6 text-brand-text-muted text-sm">
					No hay etiquetas creadas.
				</div>
			{/each}
		</div>

		<div class="shrink-0 pt-4 border-t border-brand-divider">
			<h4
				class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-3"
			>
				Crear nueva etiqueta
			</h4>
			<div class="flex flex-col gap-3">
				<input
					type="text"
					bind:value={newTagName}
					placeholder="Nombre..."
					class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
					onkeydown={(e) => e.key === "Enter" && addTag()}
				/>
				<div
					class="flex flex-wrap items-center justify-between gap-2"
				>
					<div
						class="flex gap-1.5 items-center bg-[#0d1216] border border-brand-divider rounded-xl px-2 py-1.5"
					>
						{#each TAG_COLORS as color}
							<button
								aria-label="Color"
								class="w-4 h-4 rounded-full transition-transform {newTagColor ===
								color
									? 'scale-125 ring-2 ring-brand-text ring-offset-1 ring-offset-[#0d1216]'
									: 'hover:scale-110'}"
								style="background-color: {color}"
								onclick={() => (newTagColor = color)}
							></button>
						{/each}
					</div>
					<button
						class="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-brand-accent text-brand-bg hover:brightness-105 font-bold rounded-xl transition-colors"
						onclick={addTag}
					>
						<Plus class="w-4 h-4" /> Crear
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
