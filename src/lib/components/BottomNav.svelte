<script lang="ts">
	import { page } from '$app/state';
	import { Home, RefreshCw, ListChecks, User } from 'lucide-svelte';

	const tabs = [
		{ href: '/', label: 'Inicio', icon: Home, match: (path: string) => path === '/' },
		{ href: '/habitos', label: 'Hábitos', icon: RefreshCw, match: (path: string) => path.startsWith('/habitos') },
		{ href: '/tareas', label: 'Tareas', icon: ListChecks, match: (path: string) => path.startsWith('/tareas') },
		{ href: '/perfil', label: 'Perfil', icon: User, match: (path: string) => path.startsWith('/perfil') }
	];
</script>

<nav
	class="absolute bottom-0 left-0 right-0 z-20 border-t border-brand-divider bg-brand-bg pb-[env(safe-area-inset-bottom)]"
	aria-label="Navegación principal"
>
	<div class="grid grid-cols-4 h-16">
		{#each tabs as tab}
			{@const active = tab.match(page.url.pathname)}
			{@const Icon = tab.icon}
			<a
				href={tab.href}
				class="flex flex-col items-center justify-center gap-1 transition-colors {active
					? 'text-brand-accent'
					: 'text-brand-text-muted hover:text-brand-text'}"
				aria-current={active ? 'page' : undefined}
			>
				<Icon class="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
				<span class="text-[11px] font-medium">{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>
