<script lang="ts">
	import type { Contact } from "./types";
	import { ChevronDown, Users, X } from "@lucide/svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		contactLabel,
		contacts,
		shareBusyId,
		sharedWithIds,
		toggleShareWithContact
	}: {
		contactLabel: (...args: any[]) => any;
		contacts: Contact[];
		shareBusyId: string | null;
		sharedWithIds: Set<any>;
		toggleShareWithContact: (...args: any[]) => any;
	} = $props();
</script>

<div
	class="rounded-xl border border-brand-divider bg-[#0d1216] p-5"
>
	<div class="flex items-center justify-between mb-2">
		<h4
			class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2"
		>
			<Users class="w-4 h-4 text-brand-accent" /> Miembros
		</h4>
	</div>

	{#if contacts && contacts.length > 0}
		<!-- Mostrar miembros actuales asignados -->
		<div class="space-y-2 mb-3">
			{#each contacts.filter( (c) => sharedWithIds.has(c.id), ) as contact (contact.id)}
				<div
					class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-lg p-2 px-3"
				>
					<div class="flex items-center gap-2">
						<div
							class="w-6 h-6 rounded-full bg-brand-accent/20 text-brand-accent font-bold text-[10px] flex items-center justify-center uppercase"
						>
							{contact.nickname
								? contact.nickname.substring(
										0,
										2,
									)
								: contact.display_name.substring(
										0,
										2,
									)}
						</div>
						<span
							class="text-xs font-bold text-brand-text truncate"
							>{contactLabel(contact)}</span
						>
					</div>
					<button
						class="text-brand-text-muted hover:text-red-400 transition-colors"
						onclick={() =>
							toggleShareWithContact(
								contact.id,
							)}
						disabled={shareBusyId ===
							contact.id}
						><X class="w-4 h-4" /></button
					>
				</div>
			{/each}
			{#if Array.from(sharedWithIds).length === 0}
				<p
					class="text-[10px] text-brand-text-muted italic"
				>
					Sin miembros asignados
				</p>
			{/if}
		</div>

		<!-- Acordeón para añadir más -->
		<details class="group">
			<summary
				class="flex items-center justify-between cursor-pointer list-none text-[10px] font-bold text-brand-accent hover:underline outline-none"
			>
				<span>+ Añadir miembros</span>
				<ChevronDown
					class="w-3.5 h-3.5 group-open:rotate-180 transition-transform"
				/>
			</summary>
			<div
				class="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mt-3 border-t border-brand-divider pt-3"
			>
				{#each contacts.filter((c) => !sharedWithIds.has(c.id)) as contact (contact.id)}
					<button
						type="button"
						class="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors border-brand-divider bg-[#070b0e] hover:border-brand-accent/50"
						disabled={shareBusyId ===
							contact.id}
						onclick={() =>
							toggleShareWithContact(
								contact.id,
							)}
					>
						<div
							class="flex items-center gap-2 min-w-0"
						>
							<div
								class="w-6 h-6 rounded-full bg-brand-surface-elevated text-brand-text-muted font-bold text-[10px] flex items-center justify-center shrink-0 uppercase"
							>
								{contact.nickname
									? contact.nickname.substring(
											0,
											2,
										)
									: contact.display_name.substring(
											0,
											2,
										)}
							</div>
							<span
								class="text-xs font-bold text-brand-text truncate"
								>{contactLabel(
									contact,
								)}</span
							>
						</div>
						<span
							class="text-[9px] font-bold shrink-0 text-brand-text-muted hover:text-brand-accent"
						>
							{shareBusyId === contact.id
								? "..."
								: "+ Añadir"}
						</span>
					</button>
				{/each}
				{#if contacts.filter((c) => !sharedWithIds.has(c.id)).length === 0}
					<p
						class="text-[10px] text-brand-text-muted text-center py-2"
					>
						Todos tus contactos ya están
						añadidos.
					</p>
				{/if}
			</div>
		</details>
	{:else}
		<p
			class="text-[10px] text-brand-text-muted text-center py-2"
		>
			No tienes contactos disponibles.
		</p>
	{/if}
</div>
