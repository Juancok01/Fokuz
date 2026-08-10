<script lang="ts">
	import { page } from '$app/state';
	import { Home, RefreshCw, ListChecks, User, Timer } from 'lucide-svelte';
	import { pomodoro } from '$lib/pomodoro.svelte';

	const tabs = [
		{ href: '/', label: 'Inicio', icon: Home, match: (path: string) => path === '/' },
		{
			href: '/habitos',
			label: 'Hábitos',
			icon: RefreshCw,
			match: (path: string) => path.startsWith('/habitos')
		},
		{
			href: '/tareas',
			label: 'Tareas',
			icon: ListChecks,
			match: (path: string) => path.startsWith('/tareas')
		},
		{
			href: '/pomodoro',
			label: 'Foco',
			icon: Timer,
			match: (path: string) => path.startsWith('/pomodoro'),
			live: () => pomodoro.running || pomodoro.awaitingAck
		},
		{ href: '/perfil', label: 'Perfil', icon: User, match: (path: string) => path.startsWith('/perfil') }
	];
</script>

<nav
	class="absolute bottom-0 left-0 right-0 z-20 border-t border-brand-divider bg-brand-bg pb-[env(safe-area-inset-bottom)]"
	aria-label="Navegación principal"
>
	<div class="grid grid-cols-5 h-16">
		{#each tabs as tab}
			{@const active = tab.match(page.url.pathname)}
			{@const Icon = tab.icon}
			{@const live = tab.live?.() ?? false}
			<a
				href={tab.href}
				class="relative flex flex-col items-center justify-center gap-1 transition-colors {active
					? 'text-brand-accent'
					: 'text-brand-text-muted hover:text-brand-text'}"
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
				<span class="text-[10px] font-medium">{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>
