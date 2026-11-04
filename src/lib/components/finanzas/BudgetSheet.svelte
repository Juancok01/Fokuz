<script lang="ts">
	import { X, ShieldCheck, PiggyBank } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import { digitsOnly, formatDigits } from '$lib/finance';

	let {
		open = false,
		board,
		onclose,
		onsaved
	}: {
		open: boolean;
		board: { id: number; monthly_budget: number; savings_goal_pct: number };
		onclose: () => void;
		onsaved: () => void;
	} = $props();

	let budgetDigits = $state('');
	let goal = $state(20);
	let saving = $state(false);
	let errorMsg = $state('');

	$effect(() => {
		if (!open) return;
		budgetDigits = Number(board.monthly_budget) > 0 ? String(Math.round(Number(board.monthly_budget))) : '';
		goal = Number(board.savings_goal_pct ?? 20);
		errorMsg = '';
		saving = false;
	});

	function onBudgetInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		budgetDigits = digitsOnly(el.value);
		el.value = budgetDigits ? formatDigits(budgetDigits) : '';
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!supabase || saving) return;
		saving = true;
		errorMsg = '';
		const { error } = await supabase
			.from('finance_boards')
			.update({
				monthly_budget: Number(budgetDigits || 0),
				savings_goal_pct: Math.min(100, Math.max(0, Number(goal) || 0))
			})
			.eq('id', board.id);
		saving = false;
		if (error) {
			errorMsg = /monthly_budget|savings_goal_pct/i.test(error.message)
				? 'Falta ejecutar la migración 026_finance_budget_savings.sql en Supabase.'
				: error.message;
			return;
		}
		onsaved();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onclick={onclose}>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			onsubmit={save}
			onclick={(e) => e.stopPropagation()}
			class="w-full max-w-md bg-brand-surface rounded-t-3xl sm:rounded-2xl p-6 pt-4 shadow-2xl border-t sm:border border-brand-divider pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
			<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-5 sm:hidden"></div>
			<div class="flex justify-between items-center mb-5">
				<h3 class="text-lg font-bold text-brand-text">Presupuesto y meta</h3>
				<button type="button" class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={onclose} aria-label="Cerrar">
					<X class="w-4 h-4" />
				</button>
			</div>

			<label for="bs-budget" class="flex items-center gap-2 text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
				<ShieldCheck class="w-3.5 h-3.5" /> Presupuesto mensual de gastos
			</label>
			<div class="flex items-center bg-brand-bg rounded-xl px-4 focus-within:ring-2 focus-within:ring-brand-accent/30">
				<span class="text-brand-text-muted mr-2">$</span>
				<input
					id="bs-budget"
					type="text"
					inputmode="numeric"
					value={budgetDigits ? formatDigits(budgetDigits) : ''}
					oninput={onBudgetInput}
					placeholder="Sin límite"
					class="flex-1 min-w-0 bg-transparent py-4 text-brand-text placeholder-brand-text-muted/60 focus:outline-none tabular-nums"
				/>
			</div>
			<p class="text-xs text-brand-text-muted mt-1.5 mb-5">Máximo que quieres gastar en el mes. Déjalo vacío para no tener límite.</p>

			<label for="bs-goal" class="flex items-center gap-2 text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
				<PiggyBank class="w-3.5 h-3.5" /> Meta mínima de ahorro
			</label>
			<div class="flex items-center bg-brand-bg rounded-xl px-4 focus-within:ring-2 focus-within:ring-brand-accent/30">
				<input
					id="bs-goal"
					type="number"
					inputmode="numeric"
					min="0"
					max="100"
					bind:value={goal}
					class="flex-1 min-w-0 bg-transparent py-4 text-brand-text focus:outline-none tabular-nums"
				/>
				<span class="text-brand-text-muted ml-2">%</span>
			</div>
			<p class="text-xs text-brand-text-muted mt-1.5 mb-6">Qué porcentaje de tus ingresos quieres que te quede cada mes.</p>

			<button type="submit" disabled={saving} class="w-full bg-brand-accent hover:brightness-105 disabled:opacity-60 text-brand-bg font-bold py-4 rounded-xl">
				{saving ? 'Guardando…' : 'Guardar'}
			</button>
			{#if errorMsg}<p class="text-sm text-red-400 mt-3">{errorMsg}</p>{/if}
		</form>
	</div>
{/if}
