<script lang="ts">
	import { Calendar, ListChecks } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import logo from '$lib/assets/favicon_logo.png';

	const COLOMBIA_TZ = 'America/Bogota';

	let userName = $state('tú');
	let pendingCount = $state(0);
	let completedCount = $state(0);
	let loading = $state(true);

	const todayLabel = $derived.by(() => {
		const weekday = new Intl.DateTimeFormat('es-CO', {
			timeZone: COLOMBIA_TZ,
			weekday: 'long'
		}).format(new Date());
		const day = new Intl.DateTimeFormat('es-CO', {
			timeZone: COLOMBIA_TZ,
			day: 'numeric'
		}).format(new Date());
		const month = new Intl.DateTimeFormat('es-CO', {
			timeZone: COLOMBIA_TZ,
			month: 'short'
		})
			.format(new Date())
			.replace('.', '');
		const weekdayLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);
		const monthLabel = month.charAt(0).toUpperCase() + month.slice(1);
		return `Hoy, ${weekdayLabel} ${day} ${monthLabel}`;
	});

	const greeting = $derived.by(() => {
		const hour = Number(
			new Intl.DateTimeFormat('en-GB', {
				timeZone: COLOMBIA_TZ,
				hour: '2-digit',
				hour12: false
			}).format(new Date())
		);

		if (hour < 12) return 'Buenos días';
		if (hour < 19) return 'Buenas tardes';
		return 'Buenas noches';
	});

	const totalCount = $derived(pendingCount + completedCount);
	const progress = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

	const statusMessage = $derived.by(() => {
		if (totalCount === 0) return 'No tienes tareas para hoy. ¡Buen momento para planear!';
		if (pendingCount === 0) return 'Completaste todas tus tareas de hoy. ¡Excelente!';
		if (pendingCount === 1) return 'Tienes 1 tarea pendiente para hoy. ¡Vamos por ella!';
		return `Tienes ${pendingCount} tareas pendientes para hoy. ¡Vamos por ellas!`;
	});

	const formatDateColombia = () =>
		new Intl.DateTimeFormat('en-CA', {
			timeZone: COLOMBIA_TZ,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(new Date());

	const resolveDisplayName = (meta: Record<string, unknown>, email?: string | null) => {
		const alias = typeof meta.alias === 'string' ? meta.alias.trim() : '';
		if (alias) return alias;

		const fullName = (meta.full_name || meta.name || email?.split('@')[0] || 'tú') as string;
		return String(fullName).split(' ')[0];
	};

	const loadTodaySummary = async () => {
		loading = true;

		try {
			if (!supabase) {
				pendingCount = 0;
				completedCount = 0;
				return;
			}

			// getSession es local y más estable que getUser (evita quedarse colgado)
			const {
				data: { session }
			} = await supabase.auth.getSession();

			userName = resolveDisplayName(session?.user?.user_metadata ?? {}, session?.user?.email);

			const { data, error } = await supabase
				.from('tasks')
				.select('id, is_completed')
				.eq('date', formatDateColombia());

			if (error) {
				console.warn('Error al cargar resumen:', error.message);
				pendingCount = 0;
				completedCount = 0;
			} else {
				const rows = data ?? [];
				pendingCount = rows.filter((t) => !t.is_completed).length;
				completedCount = rows.filter((t) => t.is_completed).length;
			}
		} catch (err) {
			console.warn('Error inesperado al cargar Inicio:', err);
			pendingCount = 0;
			completedCount = 0;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		loadTodaySummary();
	});

	afterNavigate(({ from }) => {
		// Recargar al volver desde otra pestaña (Perfil, Tareas, etc.)
		if (from) loadTodaySummary();
	});
</script>

<svelte:head>
	<title>Inicio · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-2 text-brand-accent">
		<Calendar class="w-5 h-5" />
		<span class="text-base font-bold">{todayLabel}</span>
	</div>
	<img src={logo} alt="Fokuz" class="w-9 h-9 rounded-full object-contain ring-2 ring-brand-accent/70" />
</header>

<div class="flex-1 overflow-y-auto px-6 py-6 pb-28">
	<div class="rounded-2xl border border-brand-accent/70 bg-brand-surface p-5">
		{#if loading}
			<div class="space-y-4">
				<div class="h-8 w-[75%] rounded-lg bg-brand-surface-elevated skeleton"></div>
				<div class="h-4 w-full rounded bg-brand-surface-elevated skeleton"></div>
				<div class="h-4 w-[66%] rounded bg-brand-surface-elevated skeleton"></div>
				<div class="h-2 w-full rounded-full bg-brand-surface-elevated skeleton mt-2"></div>
			</div>
		{:else}
			<h2 class="text-2xl font-bold text-brand-accent tracking-tight mb-2">
				{greeting}, {userName}
			</h2>
			<p class="text-brand-text-muted text-[15px] leading-relaxed mb-5">
				{statusMessage}
			</p>

			<div class="flex items-center gap-3 mb-4">
				<div class="flex items-center gap-2 text-brand-text text-sm">
					<ListChecks class="w-4 h-4 text-brand-accent" />
					<span>
						<span class="font-bold text-brand-accent">{pendingCount}</span>
						pendiente{pendingCount === 1 ? '' : 's'}
					</span>
				</div>
				<span class="text-brand-divider">·</span>
				<span class="text-sm text-brand-text-muted">
					{completedCount} completada{completedCount === 1 ? '' : 's'}
				</span>
			</div>

			<div class="flex items-center gap-3">
				<div class="h-2 flex-1 bg-brand-surface-elevated rounded-full overflow-hidden">
					<div
						class="h-full bg-brand-accent rounded-full transition-all duration-500 ease-out"
						style="width: {progress}%"
					></div>
				</div>
				<span class="text-sm font-bold text-brand-accent whitespace-nowrap">{progress}% Completado</span>
			</div>
		{/if}
	</div>

	<a
		href="/tareas"
		class="mt-6 w-full flex items-center justify-center gap-2 bg-brand-accent text-brand-bg font-bold py-4 rounded-xl hover:brightness-105 transition-colors"
	>
		Ver tareas de hoy
	</a>
</div>
