<script lang="ts">
	import { LayoutGrid, Wallet, PiggyBank, CreditCard } from '@lucide/svelte';
	import { financeUI } from '$lib/finanzas.svelte';
	import type { FinanceTab } from '$lib/finanzas';

	const tabs: { id: FinanceTab; label: string; icon: typeof LayoutDashboard }[] = [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
		{ id: 'pockets', label: 'Bolsillos', icon: Wallet },
		{ id: 'savings', label: 'Ahorros', icon: PiggyBank },
		{ id: 'loans', label: 'Préstamos', icon: CreditCard }
	];
</script>

<nav
	class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#070b0e]/95 backdrop-blur-md border-t border-brand-divider"
	aria-label="Secciones de finanzas"
>
	<div class="grid grid-cols-4 h-16">
		{#each tabs as tab}
			{@const Icon = tab.icon}
			{@const active = financeUI.tab === tab.id}
			<button
				type="button"
				onclick={() => (financeUI.tab = tab.id)}
				class="flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors {active
					? 'text-brand-accent'
					: 'text-brand-text-muted'}"
			>
				<Icon class="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
				{tab.label}
			</button>
		{/each}
	</div>
</nav>
