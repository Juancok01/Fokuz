<script lang="ts">
	import { X } from '@lucide/svelte';
	import {
		addTransaction,
		financeData,
		financeUI
	} from '$lib/finanzas.svelte';
	import { formatCOPPlain, type Classification, type PaymentMethod, type Source } from '$lib/finanzas';

	let step = $state(1);
	let digits = $state('');
	let pocketId = $state(financeData.pockets[0]?.id ?? '');
	let goalId = $state('');
	let method = $state<PaymentMethod>('Digital');
	let classification = $state<Classification>('Need');
	let source = $state<Source>('Joint');
	let note = $state('');

	const amount = $derived(Number(digits || '0'));
	const isExpense = $derived(financeUI.modalKind === 'expense');
	const goals = $derived(
		financeData.goals.filter((goal) =>
			financeUI.modalKind === 'loan' ? goal.type === 'loan' : goal.type === 'saving'
		)
	);
	const title = $derived(
		financeUI.modalKind === 'saving'
			? 'Aporte a ahorro'
			: financeUI.modalKind === 'loan'
				? 'Registrar préstamo'
				: 'Nuevo gasto'
	);

	let wasOpen = $state(false);
	$effect(() => {
		const open = financeUI.modalOpen;
		if (open && !wasOpen) {
			step = 1;
			digits = '';
			note = '';
			pocketId = financeData.pockets[0]?.id ?? '';
			goalId = financeData.goals.find((goal) =>
				financeUI.modalKind === 'loan' ? goal.type === 'loan' : goal.type === 'saving'
			)?.id ?? '';
			method = 'Digital';
			classification = financeUI.modalKind === 'expense' ? 'Need' : 'None';
			source = 'Joint';
		}
		wasOpen = open;
	});

	function press(key: string) {
		if (key === 'del') {
			digits = digits.slice(0, -1);
			return;
		}
		if (key === '000') {
			if (!digits) return;
			digits = `${digits}000`.slice(0, 10);
			return;
		}
		if (digits.length >= 10) return;
		digits = `${digits}${key}`.replace(/^0+(?=\d)/, '');
	}

	function close() {
		financeUI.modalOpen = false;
	}

	function next() {
		if (step === 1 && amount <= 0) return;
		if (step < 3) {
			step += 1;
			return;
		}
		addTransaction({
			amount,
			type: isExpense ? 'expense' : 'transfer',
			pocket_id: isExpense ? pocketId : undefined,
			goal_id: isExpense ? undefined : goalId,
			source,
			classification: isExpense ? classification : 'None',
			method,
			note:
				note.trim() ||
				(isExpense
					? financeData.pockets.find((p) => p.id === pocketId)?.name || 'Gasto'
					: goals.find((g) => g.id === goalId)?.name || 'Movimiento')
		});
		close();
	}
</script>

{#if financeUI.modalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end lg:items-center justify-center" onclick={close}>
		<div
			class="w-full max-w-md bg-[#0d1216] border border-brand-divider rounded-t-3xl lg:rounded-3xl p-5 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center justify-between mb-4">
				<div>
					<p class="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Paso {step} de 3</p>
					<h2 class="text-lg font-black text-brand-text">{title}</h2>
				</div>
				<button type="button" onclick={close} class="p-2 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-surface" aria-label="Cerrar">
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="flex gap-1.5 mb-5">
				{#each [1, 2, 3] as n}
					<div class="h-1 flex-1 rounded-full {step >= n ? 'bg-brand-accent' : 'bg-white/10'}"></div>
				{/each}
			</div>

			{#if step === 1}
				<p class="text-center text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-2">Monto</p>
				<p class="text-center text-4xl font-black text-brand-text tabular-nums mb-6">
					$ {formatCOPPlain(amount)}
				</p>
				<div class="grid grid-cols-3 gap-2">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as key}
						<button
							type="button"
							onclick={() => press(key)}
							class="h-14 rounded-2xl bg-[#070b0e] border border-brand-divider text-lg font-bold text-brand-text hover:border-brand-accent/50 transition-colors flex items-center justify-center"
						>
							{#if key === 'del'}
								<span class="text-base">⌫</span>
							{:else}
								{key}
							{/if}
						</button>
					{/each}
				</div>
			{:else if step === 2}
				<p class="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-3">
					{isExpense ? 'Bolsillo' : financeUI.modalKind === 'loan' ? 'Préstamo' : 'Meta de ahorro'}
				</p>
				<div class="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto">
					{#if isExpense}
						{#each financeData.pockets as pocket}
							<button
								type="button"
								onclick={() => (pocketId = pocket.id)}
								class="text-left px-4 py-3 rounded-2xl border transition-colors {pocketId === pocket.id
									? 'border-brand-accent bg-brand-accent/10 text-brand-text'
									: 'border-brand-divider bg-[#070b0e] text-brand-text-muted'}"
							>
								<span class="text-sm font-bold">{pocket.name}</span>
							</button>
						{/each}
					{:else}
						{#each goals as goal}
							<button
								type="button"
								onclick={() => (goalId = goal.id)}
								class="text-left px-4 py-3 rounded-2xl border transition-colors {goalId === goal.id
									? 'border-brand-accent bg-brand-accent/10 text-brand-text'
									: 'border-brand-divider bg-[#070b0e] text-brand-text-muted'}"
							>
								<span class="text-sm font-bold">{goal.name}</span>
							</button>
						{/each}
					{/if}
				</div>
			{:else}
				<div class="space-y-4">
					<div>
						<p class="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-2">Quién</p>
						<div class="grid grid-cols-3 gap-2">
							{#each (['Juan', 'Pao', 'Joint'] as Source[]) as option}
								<button
									type="button"
									onclick={() => (source = option)}
									class="py-2.5 rounded-xl text-xs font-bold border {source === option
										? 'border-brand-accent bg-brand-accent/10 text-brand-text'
										: 'border-brand-divider text-brand-text-muted'}"
								>
									{option === 'Joint' ? 'Conjunto' : option}
								</button>
							{/each}
						</div>
					</div>
					<div>
						<p class="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-2">Método</p>
						<div class="grid grid-cols-2 gap-2">
							{#each (['Digital', 'Efectivo'] as PaymentMethod[]) as option}
								<button
									type="button"
									onclick={() => (method = option)}
									class="py-2.5 rounded-xl text-xs font-bold border {method === option
										? 'border-brand-accent bg-brand-accent/10 text-brand-text'
										: 'border-brand-divider text-brand-text-muted'}"
								>
									{option}
								</button>
							{/each}
						</div>
					</div>
					{#if isExpense}
						<div>
							<p class="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-2">Clasificación</p>
							<div class="grid grid-cols-2 gap-2">
								{#each (['Need', 'Want'] as Classification[]) as option}
									<button
										type="button"
										onclick={() => (classification = option)}
										class="py-2.5 rounded-xl text-xs font-bold border {classification === option
											? 'border-brand-accent bg-brand-accent/10 text-brand-text'
											: 'border-brand-divider text-brand-text-muted'}"
									>
										{option === 'Need' ? 'Necesidad' : 'Deseo'}
									</button>
								{/each}
							</div>
						</div>
					{/if}
					<input
						type="text"
						bind:value={note}
						placeholder="Nota (opcional)"
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent"
					/>
				</div>
			{/if}

			<div class="flex gap-2 mt-5">
				{#if step > 1}
					<button type="button" onclick={() => (step -= 1)} class="flex-1 py-3 rounded-xl text-sm font-bold text-brand-text-muted bg-[#070b0e] border border-brand-divider">
						Atrás
					</button>
				{/if}
				<button
					type="button"
					onclick={next}
					disabled={step === 1 && amount <= 0}
					class="flex-1 py-3 rounded-xl text-sm font-bold bg-brand-accent text-brand-bg disabled:opacity-40"
				>
					{step === 3 ? 'Guardar' : 'Continuar'}
				</button>
			</div>
		</div>
	</div>
{/if}
