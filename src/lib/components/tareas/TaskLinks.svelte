<script lang="ts">
	import { Activity, Clock, StickyNote, X } from "@lucide/svelte";
	import { goto } from "$app/navigation";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		focusOnSelectedTask,
		openLinkNoteModal,
		selectedTaskLinkedNoteId,
		selectedTaskLinkedNoteTitle,
		unlinkNoteFromTask
	}: {
		focusOnSelectedTask: (...args: any[]) => any;
		openLinkNoteModal: (...args: any[]) => any;
		selectedTaskLinkedNoteId: string | null;
		selectedTaskLinkedNoteTitle: string | null;
		unlinkNoteFromTask: (...args: any[]) => any;
	} = $props();
</script>

<div
	class="rounded-xl border border-brand-divider bg-[#0d1216] p-5"
>
	<h4
		class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2 mb-4"
	>
		<Activity class="w-4 h-4 text-brand-accent" /> Vinculaciones
		Fokuz
	</h4>
	<button
		class="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-brand-accent/50 text-brand-accent hover:bg-brand-accent/10 transition-colors text-[11px] font-bold mb-3"
		onclick={focusOnSelectedTask}
	>
		<Clock class="w-3.5 h-3.5" /> Enfocar con Pomodoro
	</button>

	{#if selectedTaskLinkedNoteId}
		<div
			class="flex flex-col gap-2 p-3 rounded-lg border border-brand-divider bg-[#070b0e]"
		>
			<div
				class="flex items-center justify-between mb-1"
			>
				<span
					class="text-[10px] font-bold text-brand-text-muted uppercase"
					>Nota Vinculada</span
				>
				<button
					class="text-brand-text-muted hover:text-red-400 transition-colors"
					onclick={unlinkNoteFromTask}
					title="Desvincular"
					><X class="w-3.5 h-3.5" /></button
				>
			</div>
			<button
				class="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-brand-accent text-brand-bg hover:brightness-110 transition-all text-[11px] font-bold shadow-[0_0_10px_var(--color-brand-accent-muted)]"
				onclick={() =>
					goto(
						`/notas/${selectedTaskLinkedNoteId}`,
					)}
			>
				<StickyNote class="w-3.5 h-3.5" />
				{selectedTaskLinkedNoteTitle || "Ver Nota"}
			</button>
		</div>
	{:else}
		<button
			class="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-brand-divider text-brand-text-muted hover:text-brand-text hover:bg-brand-surface transition-colors text-[11px] font-bold"
			onclick={openLinkNoteModal}
		>
			<StickyNote class="w-3.5 h-3.5" /> Vincular a una
			Nota
		</button>
	{/if}
</div>
