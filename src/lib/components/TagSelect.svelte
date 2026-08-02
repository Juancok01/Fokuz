<script lang="ts">
	type TaskTag = { id: number; name: string; color: string };

	let {
		tags,
		value = $bindable<number | null>(null),
		id = 'tag-select'
	}: {
		tags: TaskTag[];
		value?: number | null;
		id?: string;
	} = $props();

	let open = $state(false);

	const selected = $derived(tags.find((t) => t.id === value) ?? null);

	const selectTag = (tagId: number | null) => {
		value = tagId;
		open = false;
	};
</script>

<div class="relative">
	<button
		type="button"
		{id}
		class="w-full flex items-center gap-2 bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
		onclick={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		{#if selected}
			<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {selected.color}"></span>
			<span class="flex-1 text-brand-text truncate">{selected.name}</span>
		{:else}
			<span class="w-2.5 h-2.5 rounded-full shrink-0 bg-brand-text-muted/40"></span>
			<span class="flex-1 text-brand-text-muted">Ninguna</span>
		{/if}
		<span class="text-brand-text-muted text-xs shrink-0">{open ? '▴' : '▾'}</span>
	</button>

	{#if open}
		<ul
			class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-brand-divider bg-brand-surface shadow-lg"
			role="listbox"
		>
			<li>
				<button
					type="button"
					class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-brand-surface-elevated {value === null
						? 'bg-brand-accent-muted'
						: ''}"
					onclick={() => selectTag(null)}
					role="option"
					aria-selected={value === null}
				>
					<span class="w-2.5 h-2.5 rounded-full bg-brand-text-muted/40 shrink-0"></span>
					<span class="text-brand-text-muted">Ninguna</span>
				</button>
			</li>
			{#each tags as tag (tag.id)}
				<li>
					<button
						type="button"
						class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-brand-surface-elevated {value === tag.id
							? 'bg-brand-accent-muted'
							: ''}"
						onclick={() => selectTag(tag.id)}
						role="option"
						aria-selected={value === tag.id}
					>
						<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {tag.color}"></span>
						<span class="text-brand-text truncate">{tag.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
