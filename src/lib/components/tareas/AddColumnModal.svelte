<script lang="ts">
	import { Plus, X } from "@lucide/svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		confirmAddList,
		newListName = $bindable(),
		showCrearListaModal = $bindable()
	}: {
		confirmAddList: (...args: any[]) => any;
		newListName: string;
		showCrearListaModal: boolean;
	} = $props();
</script>

<div
	class="fixed inset-0 bg-black/80 z-60 flex items-center justify-center backdrop-blur-sm p-4"
>
	<div
		class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col"
	>
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">
				Crear nueva lista
			</h3>
			<button
				class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted"
				onclick={() => {
					showCrearListaModal = false;
					newListName = "";
				}}><X class="w-5 h-5" /></button
			>
		</div>

		<div class="space-y-4 mb-6">
			<div>
				<span
					class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2"
					>Nombre de la lista</span
				>
				<input
					type="text"
					bind:value={newListName}
					placeholder="Ej. En Progreso, Revisión..."
					class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-text-muted focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
					onkeydown={(e) => e.key === "Enter" && confirmAddList()}
				/>
			</div>
		</div>

		<div class="flex justify-end gap-3">
			<button
				class="px-4 py-2 rounded-xl text-brand-text font-bold hover:bg-brand-surface-elevated transition-colors"
				onclick={() => {
					showCrearListaModal = false;
					newListName = "";
				}}>Cancelar</button
			>
			<button
				class="px-5 py-2 bg-brand-accent text-brand-bg font-bold rounded-xl hover:brightness-105 transition-colors flex items-center gap-2 shadow-[0_0_10px_var(--color-brand-accent-muted)]"
				onclick={confirmAddList}
			>
				<Plus class="w-4 h-4" /> Crear
			</button>
		</div>
	</div>
</div>
