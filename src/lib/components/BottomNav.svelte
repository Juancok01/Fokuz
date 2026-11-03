<script lang="ts">
	import { page } from '$app/state';
	import { Home, RefreshCw, ListChecks, User, Timer, StickyNote, X, LineChart } from '@lucide/svelte';
	import { pomodoro, pomodoroUI } from '$lib/pomodoro.svelte';
	import logo from '$lib/assets/Logo_Fokuz.png';
	import { sectionPrefs, type SectionId } from '$lib/sectionPrefs.svelte';

	let { isOpen = false, closeMenu } = $props<{ isOpen: boolean, closeMenu: () => void }>();

	type Tab = {
		id?: string;
		section?: SectionId;
		href: string;
		label: string;
		icon: typeof Home;
		match: (path: string) => boolean;
		live?: () => boolean;
	};

	const allTabs: Tab[] = [
		{ href: '/', label: 'Inicio', icon: Home, match: (path: string) => path === '/' },
		{
			section: 'habitos',
			href: '/habitos',
			label: 'Hábitos',
			icon: RefreshCw,
			match: (path: string) => path.startsWith('/habitos')
		},
		{
			section: 'tareas',
			href: '/tareas',
			label: 'Tareas',
			icon: ListChecks,
			match: (path: string) => path.startsWith('/tareas')
		},
		{
			id: 'pomodoro',
			section: 'pomodoro',
			href: '#',
			label: 'Foco',
			icon: Timer,
			match: (path: string) => pomodoroUI.isMaximized,
			live: () => pomodoro.running || pomodoro.awaitingAck
		},
		{
			section: 'notas',
			href: '/notas',
			label: 'Notas',
			icon: StickyNote,
			match: (path: string) => path.startsWith('/notas')
		},
		{
			section: 'finanzas',
			href: '/finanzas',
			label: 'Finanzas',
			icon: LineChart,
			match: (path: string) => path.startsWith('/finanzas')
		},
		{ href: '/perfil', label: 'Perfil', icon: User, match: (path: string) => path.startsWith('/perfil') }
	];

	// Oculta las secciones que el usuario desactivó en Perfil → Personalizar secciones
	const tabs = $derived(
		allTabs.filter((tab) => !tab.section || sectionPrefs.isVisible(tab.section))
	);
</script>

<nav
	class="fixed top-0 left-0 h-full w-64 bg-brand-surface z-50 transform transition-transform duration-300 ease-in-out border-r border-brand-divider flex flex-col {isOpen ? 'translate-x-0' : '-translate-x-full'}"
	aria-label="Navegación principal"
>
	<div class="h-14 flex items-center justify-between px-4 border-b border-brand-divider shrink-0">
		<div class="flex items-center gap-2 ml-2">
			<img src={logo} alt="Fokuz Logo" class="w-6 h-6 rounded-md object-contain" />
			<span class="font-semibold text-brand-text text-lg">Fokuz</span>
		</div>
		<button onclick={closeMenu} class="p-2 hover:bg-brand-surface-elevated rounded-lg transition-colors text-brand-text-muted hover:text-brand-text" aria-label="Cerrar menú">
			<X class="w-5 h-5" />
		</button>
	</div>

	<div class="flex flex-col flex-1 p-4 gap-2 overflow-y-auto">
		{#each tabs as tab}
			{@const active = tab.id === 'pomodoro' ? pomodoroUI.isMaximized : (!pomodoroUI.isMaximized && tab.match(page.url.pathname))}
			{@const Icon = tab.icon}
			{@const live = tab.live?.() ?? false}
			
			{#if tab.id === 'pomodoro'}
				<button
					onclick={() => { pomodoroUI.isMaximized = true; closeMenu(); }}
					class="w-full relative flex flex-row items-center justify-start gap-3 transition-colors px-4 py-3 rounded-xl {active
						? 'text-brand-accent bg-brand-surface-elevated'
						: 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated'}"
					aria-current={active ? 'page' : undefined}
				>
					<span class="relative">
						<Icon class="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
						{#if live}
							<span
								class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-accent"
								aria-hidden="true"
							></span>
						{/if}
					</span>
					<span class="text-sm font-medium">{tab.label}</span>
				</button>
			{:else}
				<a
					href={tab.href}
					onclick={() => { pomodoroUI.isMaximized = false; closeMenu(); }}
					class="relative flex flex-row items-center justify-start gap-3 transition-colors px-4 py-3 rounded-xl {active
						? 'text-brand-accent bg-brand-surface-elevated'
						: 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated'}"
					aria-current={active ? 'page' : undefined}
				>
					<span class="relative">
						<Icon class="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
						{#if live}
							<span
								class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-accent"
								aria-hidden="true"
							></span>
						{/if}
					</span>
					<span class="text-sm font-medium">{tab.label}</span>
				</a>
			{/if}
		{/each}
	</div>
</nav>
