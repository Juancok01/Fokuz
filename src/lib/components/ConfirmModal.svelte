<script lang="ts">
	import { X } from 'lucide-svelte';

	let { 
		isOpen = false, 
		title = 'Confirmar', 
		message = '¿Estás seguro?',
		confirmText = 'Aceptar',
		cancelText = 'Cancelar',
		onConfirm,
		onCancel 
	} = $props<{
		isOpen: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}>();
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
		onclick={onCancel}
	>
		<div 
			class="bg-brand-surface border border-brand-divider rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
			onclick={(e) => e.stopPropagation()}
		>
			<button 
				type="button" 
				class="absolute top-4 right-4 p-1.5 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-bg transition-colors"
				onclick={onCancel}
				aria-label="Cerrar"
			>
				<X class="w-5 h-5" />
			</button>
			
			<h3 class="text-xl font-bold text-brand-text mb-3 pr-8">{title}</h3>
			<p class="text-brand-text-muted text-sm mb-8 leading-relaxed">
				{message}
			</p>
			
			<div class="flex items-center gap-3 w-full">
				<button 
					type="button"
					class="flex-1 py-3 px-4 rounded-xl font-bold text-brand-text bg-brand-bg hover:brightness-110 border border-brand-divider transition-all"
					onclick={onCancel}
				>
					{cancelText}
				</button>
				<button 
					type="button"
					class="flex-1 py-3 px-4 rounded-xl font-bold text-brand-bg bg-brand-accent hover:brightness-105 transition-all"
					onclick={onConfirm}
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
