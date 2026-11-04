<script lang="ts">
	import { X, Check, Users } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import { BOARD_COLORS, DEFAULT_CATEGORIES, formatDigits } from '$lib/finance';

	type EditableBoard = {
		id: number;
		title: string;
		description: string | null;
		color: string;
		initial_balance: number;
	};

	type Contact = { id: string; email: string; label: string };

	let {
		open = false,
		board = null,
		onclose,
		onsaved
	}: {
		open: boolean;
		board?: EditableBoard | null;
		onclose: () => void;
		onsaved: (boardId: number) => void;
	} = $props();

	let title = $state('');
	let description = $state('');
	let color = $state(BOARD_COLORS[0]);
	let initialDigits = $state('');
	let contacts = $state<Contact[]>([]);
	let sharedWith = $state<string[]>([]);
	let originalShared = $state<string[]>([]);
	let saving = $state(false);
	let errorMsg = $state('');

	const isEdit = $derived(!!board);

	$effect(() => {
		if (!open) return;
		title = board?.title ?? '';
		description = board?.description ?? '';
		color = board?.color ?? BOARD_COLORS[0];
		initialDigits = board ? String(Math.max(0, Math.round(Number(board.initial_balance) || 0))) : '';
		errorMsg = '';
		sharedWith = [];
		originalShared = [];
		loadContactsAndShares(board?.id ?? null);
	});

	async function loadContactsAndShares(boardId: number | null) {
		if (!supabase) return;
		const { data: rows } = await supabase.from('contacts').select('id, nickname, contact_user_id');
		const ids = (rows ?? []).map((r) => r.contact_user_id);
		let profiles: { id: string; email: string; display_name: string | null }[] = [];
		if (ids.length) {
			const { data } = await supabase.from('profiles').select('id, email, display_name').in('id', ids);
			profiles = data ?? [];
		}
		const map = new Map(profiles.map((p) => [p.id, p]));
		contacts = (rows ?? []).map((r: any) => {
			const p = map.get(r.contact_user_id);
			const email = p?.email ?? '';
			return {
				id: r.contact_user_id,
				email,
				label: (r.nickname || '').trim() || (p?.display_name || '').trim() || email.split('@')[0] || 'Contacto'
			};
		});

		if (boardId) {
			const { data: shares } = await supabase
				.from('finance_board_shares')
				.select('shared_with')
				.eq('board_id', boardId);
			originalShared = (shares ?? []).map((s) => s.shared_with);
			sharedWith = [...originalShared];
		}
	}

	function toggleContact(id: string) {
		sharedWith = sharedWith.includes(id) ? sharedWith.filter((c) => c !== id) : [...sharedWith, id];
	}

	function digitsFrom(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
		el.value = d ? formatDigits(d) : '';
		return d;
	}

	const onInitialInput = (e: Event) => (initialDigits = digitsFrom(e));


	async function save() {
		if (!supabase) return;
		const name = title.trim();
		if (!name) {
			errorMsg = 'Ponle un nombre al tablero.';
			return;
		}
		saving = true;
		errorMsg = '';

		const base = {
			title: name,
			description: description.trim() || null,
			color,
			initial_balance: Number(initialDigits || 0)
		};
		let boardId = board?.id ?? null;

		if (boardId) {
			const { error } = await supabase.from('finance_boards').update(base).eq('id', boardId);
			if (error) return fail(error.message);
		} else {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			const userId = session?.user?.id;
			if (!userId) return fail('Debes iniciar sesión.');

			const { data, error } = await supabase
				.from('finance_boards')
				.insert({ ...base, user_id: userId })
				.select('id')
				.single();
			if (error || !data) return fail(error?.message ?? 'No se pudo crear el tablero.');
			boardId = data.id as number;

			const { error: catError } = await supabase.from('finance_categories').insert(
				DEFAULT_CATEGORIES.map((c, i) => ({ board_id: boardId, name: c.name, type: c.type, icon: c.icon, sort_order: i }))
			);
			if (catError) console.warn('No se crearon categorías por defecto:', catError.message);
		}

		const toAdd = sharedWith.filter((id) => !originalShared.includes(id));
		const toRemove = originalShared.filter((id) => !sharedWith.includes(id));
		if (toAdd.length) {
			const { error } = await supabase
				.from('finance_board_shares')
				.insert(toAdd.map((id) => ({ board_id: boardId, shared_with: id })));
			if (error) return fail('Tablero guardado, pero no se pudo compartir: ' + error.message);
		}
		if (toRemove.length) {
			const { error } = await supabase
				.from('finance_board_shares')
				.delete()
				.eq('board_id', boardId)
				.in('shared_with', toRemove);
			if (error) return fail('Tablero guardado, pero no se pudo dejar de compartir: ' + error.message);
		}

		saving = false;
		onsaved(boardId!);
	}

	function fail(message: string) {
		saving = false;
		errorMsg = message;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
		onclick={onclose}
	>
		<div
			class="w-full max-w-md bg-brand-surface rounded-t-3xl sm:rounded-2xl p-6 pt-4 shadow-2xl border-t sm:border border-brand-divider max-h-[92vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-5 sm:hidden"></div>

			<div class="flex justify-between items-center mb-5">
				<h3 class="text-lg font-bold text-brand-text">{isEdit ? 'Editar y compartir' : 'Nuevo tablero'}</h3>
				<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={onclose} aria-label="Cerrar">
					<X class="w-4 h-4" />
				</button>
			</div>

			<label for="fb-title" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Nombre</label>
			<input
				id="fb-title"
				type="text"
				bind:value={title}
				maxlength={40}
				placeholder="Ej. Personal, Hogar, Viaje…"
				class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-4"
			/>

			<label for="fb-initial" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Saldo inicial</label>
			<div class="flex items-center bg-brand-bg rounded-xl px-4 mb-4 focus-within:ring-2 focus-within:ring-brand-accent/30">
				<span class="text-brand-text-muted mr-2">$</span>
				<input
					id="fb-initial"
					type="text"
					inputmode="numeric"
					value={initialDigits ? formatDigits(initialDigits) : ''}
					oninput={onInitialInput}
					placeholder="0"
					class="flex-1 bg-transparent py-4 text-brand-text placeholder-brand-text-muted/60 focus:outline-none tabular-nums"
				/>
			</div>

			<p class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Color</p>
			<div class="flex gap-3 mb-5">
				{#each BOARD_COLORS as c}
					<button
						type="button"
						onclick={() => (color = c)}
						class="w-9 h-9 rounded-full flex items-center justify-center transition-transform {color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-brand-surface ring-white/70' : ''}"
						style="background-color: {c}"
						aria-label="Color {c}"
					>
						{#if color === c}<Check class="w-4 h-4 text-black/70" />{/if}
					</button>
				{/each}
			</div>

			<p class="flex items-center gap-2 text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
				<Users class="w-3.5 h-3.5" /> Compartir con
			</p>
			{#if contacts.length === 0}
				<p class="text-sm text-brand-text-muted bg-brand-bg rounded-xl p-3 mb-5">
					Aún no tienes contactos. Agrégalos desde Perfil para compartir tableros.
				</p>
			{:else}
				<div class="flex flex-wrap gap-2 mb-5">
					{#each contacts as contact (contact.id)}
						{@const on = sharedWith.includes(contact.id)}
						<button
							type="button"
							onclick={() => toggleContact(contact.id)}
							class="px-3 py-2 rounded-full text-sm font-medium border transition-colors {on
								? 'bg-brand-accent text-brand-bg border-brand-accent'
								: 'bg-brand-bg text-brand-text border-brand-divider'}"
						>
							{on ? '✓ ' : ''}{contact.label}
						</button>
					{/each}
				</div>
			{/if}

			<button
				onclick={save}
				disabled={saving}
				class="w-full bg-brand-accent hover:brightness-105 disabled:opacity-60 text-brand-bg font-bold py-4 rounded-xl transition-colors"
			>
				{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear tablero'}
			</button>

			{#if errorMsg}
				<p class="text-sm text-red-400 mt-3">{errorMsg}</p>
			{/if}
		</div>
	</div>
{/if}
