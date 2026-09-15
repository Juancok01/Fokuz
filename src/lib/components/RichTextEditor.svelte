<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import 'quill/dist/quill.snow.css';

	let { value = $bindable(), placeholder = 'Agrega una descripción más detallada...' } = $props();

	let editorContainer: HTMLElement;
	let quill: any;

	onMount(async () => {
		const { default: Quill } = await import('quill');
		quill = new Quill(editorContainer, {
			theme: 'snow',
			placeholder,
			modules: {
				toolbar: [
					['bold', 'italic', 'underline', 'strike'],
					[{ list: 'ordered' }, { list: 'bullet' }],
					['clean']
				]
			}
		});

		if (value) {
			quill.clipboard.dangerouslyPasteHTML(value);
		}

		quill.on('text-change', () => {
			value = quill.root.innerHTML;
		});
	});

	$effect(() => {
		if (quill && value !== undefined && value !== quill.root.innerHTML) {
			const cursor = quill.getSelection();
			quill.clipboard.dangerouslyPasteHTML(value);
			if (cursor) quill.setSelection(cursor);
		}
	});

	onDestroy(() => {
		if (quill) {
			quill.off('text-change');
		}
	});
</script>

<div class="rich-text-wrapper rounded-xl border border-brand-divider bg-[#0d1216] overflow-hidden focus-within:border-brand-accent transition-colors">
	<div bind:this={editorContainer} class="min-h-[120px] max-h-[300px] overflow-y-auto text-brand-text"></div>
</div>

<style>
	:global(.ql-toolbar.ql-snow) {
		border: none !important;
		border-bottom: 1px solid var(--color-brand-divider, #1a232b) !important;
		background: #070b0e !important;
		padding: 8px !important;
		border-top-left-radius: 0.75rem;
		border-top-right-radius: 0.75rem;
	}
	:global(.ql-container.ql-snow) {
		border: none !important;
		font-family: inherit !important;
		font-size: 0.875rem !important; /* text-sm */
	}
	:global(.ql-editor) {
		padding: 1.25rem !important; /* p-5 */
	}
	:global(.ql-snow .ql-stroke) {
		stroke: #94a3b8 !important;
	}
	:global(.ql-snow .ql-fill) {
		fill: #94a3b8 !important;
	}
	:global(.ql-snow .ql-picker) {
		color: #94a3b8 !important;
	}
	:global(.ql-snow.ql-toolbar button:hover .ql-stroke),
	:global(.ql-snow .ql-toolbar button:hover .ql-stroke) {
		stroke: var(--color-brand-accent, #00d282) !important;
	}
	:global(.ql-snow.ql-toolbar button.ql-active .ql-stroke),
	:global(.ql-snow .ql-toolbar button.ql-active .ql-stroke) {
		stroke: var(--color-brand-accent, #00d282) !important;
	}
	:global(.ql-snow.ql-toolbar button:hover .ql-fill),
	:global(.ql-snow .ql-toolbar button:hover .ql-fill) {
		fill: var(--color-brand-accent, #00d282) !important;
	}
	:global(.ql-snow.ql-toolbar button.ql-active .ql-fill),
	:global(.ql-snow .ql-toolbar button.ql-active .ql-fill) {
		fill: var(--color-brand-accent, #00d282) !important;
	}
	:global(.ql-editor.ql-blank::before) {
		color: #475569 !important; /* placeholder color */
		font-style: normal !important;
	}
	:global(.ql-editor ol),
	:global(.ql-editor ul) {
		padding-left: 1.5rem;
	}
</style>
