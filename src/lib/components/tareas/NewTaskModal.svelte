<script lang="ts">
	import type { Contact, TaskTag } from "./types";
	import { Calendar, Plus, X } from "@lucide/svelte";
	import DateTimePicker from "$lib/components/DateTimePicker.svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		addTask,
		contacts,
		newTaskEndDate = $bindable(),
		newTaskSharedWith = $bindable(),
		newTaskStartDate = $bindable(),
		newTaskTitle = $bindable(),
		selectedTagId = $bindable(),
		showNewTask = $bindable(),
		tags
	}: {
		addTask: (...args: any[]) => any;
		contacts: Contact[];
		newTaskEndDate: string;
		newTaskSharedWith: string[];
		newTaskStartDate: any;
		newTaskTitle: string;
		selectedTagId: number | null;
		showNewTask: boolean;
		tags: TaskTag[];
	} = $props();
</script>

<div
	class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4"
>
	<div
		class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-lg p-6 shadow-2xl"
	>
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Nueva Tarjeta</h3>
			<button
				class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted"
				onclick={() => (showNewTask = false)}
				><X class="w-5 h-5" /></button
			>
		</div>

		<div class="space-y-4 mb-6">
			<div>
				<span
					class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2"
					>Título</span
				>
				<input
					type="text"
					bind:value={newTaskTitle}
					placeholder="¿Qué necesitas hacer?"
					class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text placeholder-brand-text-muted focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
					onkeydown={(e) => e.key === "Enter" && addTask()}
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<span
						class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2"
						>Fecha de Inicio</span
					>
					<div
						class="flex items-center justify-between bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 cursor-pointer focus-within:border-brand-accent focus-within:ring-1 focus-within:ring-brand-accent transition-all"
					>
						<DateTimePicker
							bind:value={newTaskStartDate}
							placeholder="dd/mm/aaaa"
						/>
						<Calendar
							class="w-4 h-4 text-brand-text-muted shrink-0 ml-2"
						/>
					</div>
				</div>
				<div>
					<span
						class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2"
						>Fecha de Fin (Opcional)</span
					>
					<div
						class="flex items-center justify-between bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 cursor-pointer focus-within:border-brand-accent focus-within:ring-1 focus-within:ring-brand-accent transition-all"
					>
						<DateTimePicker
							bind:value={newTaskEndDate}
							placeholder="dd/mm/aaaa"
						/>
						<Calendar
							class="w-4 h-4 text-brand-text-muted shrink-0 ml-2"
						/>
					</div>
				</div>
			</div>

			{#if contacts && contacts.length > 0}
				<div>
					<span
						class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2"
						>Compartir con Miembros</span
					>
					<div class="flex flex-wrap gap-2">
						{#each contacts as contact}
							<button
								class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 {newTaskSharedWith.includes(
									contact.id,
								)
									? 'bg-brand-accent/10 border-brand-accent text-brand-accent'
									: 'bg-[#0d1216] border-brand-divider text-brand-text-muted hover:bg-brand-surface-elevated'}"
								onclick={() => {
									if (
										newTaskSharedWith.includes(
											contact.id,
										)
									)
										newTaskSharedWith =
											newTaskSharedWith.filter(
												(id) => id !== contact.id,
											);
									else
										newTaskSharedWith = [
											...newTaskSharedWith,
											contact.id,
										];
								}}
							>
								<div
									class="w-4 h-4 rounded-full bg-brand-surface-elevated flex items-center justify-center text-[8px] uppercase font-black text-brand-text"
								>
									{contact.nickname
										? contact.nickname.substring(0, 2)
										: contact.display_name.substring(
												0,
												2,
											)}
								</div>
								{contact.nickname || contact.display_name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if tags.length > 0}
				<div>
					<span
						class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2"
						>Etiqueta</span
					>
					<div class="flex flex-wrap gap-2">
						{#each tags as tag}
							<button
								class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors {selectedTagId ===
								tag.id
									? 'bg-brand-surface-elevated'
									: 'bg-[#0d1216] border-brand-divider text-brand-text-muted hover:bg-brand-surface-elevated'}"
								style={selectedTagId === tag.id
									? `border-color: ${tag.color}; color: ${tag.color};`
									: ""}
								onclick={() => (selectedTagId = tag.id)}
							>
								{tag.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div
			class="flex flex-col sm:flex-row justify-end gap-3 w-full sm:w-auto"
		>
			<button
				class="w-full sm:w-auto flex justify-center items-center px-4 py-2 rounded-xl text-brand-text font-bold hover:bg-brand-surface-elevated transition-colors"
				onclick={() => (showNewTask = false)}>Cancelar</button
			>
			<button
				class="w-full sm:w-auto flex justify-center items-center px-5 py-2 bg-brand-accent text-brand-bg font-bold rounded-xl hover:brightness-105 transition-colors gap-2 shadow-[0_0_10px_var(--color-brand-accent-muted)]"
				onclick={addTask}
			>
				<Plus class="w-4 h-4" /> Crear
			</button>
		</div>
	</div>
</div>
