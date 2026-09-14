<script lang="ts">
	import { 
		Plus, Folder, Star, Briefcase, Lightbulb, Tag, Archive, Trash2,
		Search, CalendarDays, Lock, LayoutGrid, List, ChevronRight, Clock,
		Timer, Share2, MoreHorizontal, Bold, Italic, Underline, CheckSquare,
		AlignLeft, Code, Target, Check
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';

	// Estado mockeado para la demo visual
	let activeFolder = $state('Apartamento & Finanzas');
	let activeNoteId = $state(1);

	const mockFolders = [
		{ id: 'all', name: 'Todas las Notas', icon: Folder, count: 18, active: false },
		{ id: 'favs', name: 'Favoritas & Ancladas', icon: Star, count: 2, active: false, color: 'text-amber-400' },
		{ id: 'apt', name: 'Apartamento & Finanzas', icon: Folder, count: 6, active: true, color: 'text-brand-accent' },
		{ id: 'work', name: 'Trabajo & Carrera', icon: Briefcase, count: 5, active: false },
		{ id: 'ideas', name: 'Ideas & Reflexión', icon: Lightbulb, count: 4, active: false }
	];

	const mockTags = [
		{ name: 'vivienda', count: 4 },
		{ name: 'gastos', count: 3 },
		{ name: 'seguridad', count: 1 },
		{ name: 'tech', count: 3 },
		{ name: 'dev', count: 2 }
	];

	const mockArchive = [
		{ name: 'Archivadas', icon: Archive, count: 12 },
		{ name: 'Papelera', icon: Trash2, count: 1 }
	];

	const mockNotes = [
		{
			id: 1,
			title: 'Faltantes apartamento',
			excerpt: 'Checklist de elementos esenciales para la mudanza: cortinas blackout, lámpara nórdica para escritorio,...',
			date: '13/9/2026',
			tag: '#vivienda',
			status: '3/5 listos',
			pinned: true
		},
		{
			id: 2,
			title: 'Compras Apartamento',
			excerpt: 'Presupuesto estimado total: $1,450 USD. Prioridad alta: Refrigerador eficiente, lavadora compacta y mesa...',
			date: '10/9/2026',
			tag: '#gastos',
			status: '',
			pinned: true
		},
		{
			id: 3,
			title: 'Pagos',
			excerpt: 'Internet de fibra óptica ($45), depósito de alquiler día 05, suscripción cloud AWS ($22).',
			date: '1/9/2026',
			tag: '#finanzas',
			status: 'Vence pronto',
			statusColor: 'text-red-400',
			pinned: false
		},
		{
			id: 4,
			title: 'Paswords',
			excerpt: '****************** Contenido protegido con FaceID...',
			date: '1/9/2026',
			tag: '#seguridad',
			status: 'Cifrada',
			statusColor: 'text-orange-400',
			isLocked: true,
			pinned: false
		},
		{
			id: 5,
			title: 'Analitics Engenier',
			excerpt: 'Módulos dbt Core, modelado dimensional Kimball, orquestación con Dagster y optimización de consultas...',
			date: '31/8/2026',
			tag: '#dev',
			status: 'Estudio',
			statusColor: 'text-blue-400',
			pinned: false
		}
	];
</script>

<svelte:head>
	<title>Notas · Fokuz</title>
</svelte:head>

<div class="flex-1 flex h-full overflow-hidden bg-[#070b0e] text-brand-text">
	
	<!-- Left Sidebar (Navegación) -->
	<aside class="w-64 shrink-0 bg-[#070b0e] border-r border-brand-divider flex flex-col h-full overflow-y-auto custom-scrollbar relative z-10 hidden md:flex">
		<div class="p-6 pb-2">
			<h2 class="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-4">Carpetas</h2>
			<button class="absolute top-5 right-4 p-1 rounded-md text-brand-text-muted hover:text-brand-text transition-colors">
				<Plus class="w-4 h-4" />
			</button>
			<ul class="space-y-1">
				{#each mockFolders as folder}
					<li>
						<button 
							class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-colors {folder.active ? 'bg-brand-surface-elevated text-brand-text border border-brand-divider' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface'}"
							onclick={() => activeFolder = folder.name}
						>
							<div class="flex items-center gap-3">
								<folder.icon class="w-4 h-4 {folder.active ? (folder.color || 'text-brand-accent') : (folder.color || 'text-brand-text-muted')}" />
								<span class="truncate">{folder.name}</span>
							</div>
							<span class="text-[10px] font-bold {folder.active ? 'text-brand-accent' : 'text-brand-text-muted/60'}">{folder.count}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<div class="p-6 py-4">
			<h2 class="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-4">Etiquetas</h2>
			<div class="flex flex-wrap gap-2">
				{#each mockTags as tag}
					<button class="px-2.5 py-1 rounded-lg bg-brand-surface border border-brand-divider text-[10px] font-bold text-brand-accent hover:bg-brand-surface-elevated transition-colors shadow-sm flex items-center gap-1.5">
						{tag.name} <span class="opacity-50">{tag.count}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="p-6 py-2 flex-1">
			<h2 class="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-4">Archivo</h2>
			<ul class="space-y-1">
				{#each mockArchive as item}
					<li>
						<button class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold text-brand-text-muted hover:text-brand-text hover:bg-brand-surface transition-colors">
							<div class="flex items-center gap-3">
								<item.icon class="w-4 h-4" />
								<span>{item.name}</span>
							</div>
							<span class="text-[10px] font-bold opacity-60">{item.count}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<div class="p-6 border-t border-brand-divider bg-[#070b0e] sticky bottom-0">
			<button class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-divider border-dashed text-brand-text-muted hover:text-brand-text hover:border-brand-accent transition-colors text-xs font-bold shadow-inner bg-brand-surface/30">
				<Plus class="w-4 h-4" /> Nueva Carpeta
			</button>
		</div>
	</aside>

	<!-- Middle Column (Lista de Notas) -->
	<section class="w-full md:w-[380px] shrink-0 bg-[#0d1216] border-r border-brand-divider flex flex-col h-full relative z-20 shadow-xl hidden md:flex">
		<!-- Header -->
		<div class="p-6 pb-4 shrink-0 bg-[#0d1216] z-10 sticky top-0">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-xl font-bold text-brand-text flex items-center gap-2 truncate">
					{activeFolder}
					<span class="text-[10px] bg-brand-surface border border-brand-divider px-2 py-0.5 rounded-full text-brand-text-muted shrink-0">6</span>
				</h2>
				<div class="flex items-center gap-1 bg-[#070b0e] p-1 rounded-lg border border-brand-divider shrink-0">
					<button class="p-1 rounded-md text-brand-text-muted hover:text-brand-text"><List class="w-4 h-4" /></button>
					<button class="p-1 rounded-md bg-brand-surface-elevated text-brand-accent border border-brand-divider shadow-sm"><LayoutGrid class="w-4 h-4" /></button>
				</div>
			</div>
			
			<div class="relative flex gap-2">
				<div class="relative flex-1">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Search class="w-4 h-4 text-brand-text-muted" />
					</div>
					<input 
						type="text" 
						placeholder="Filtrar notas de esta lista..." 
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner"
					/>
				</div>
				<button class="px-3 py-2.5 rounded-xl border border-brand-divider bg-[#070b0e] text-brand-text-muted hover:text-brand-accent transition-colors flex items-center gap-2 text-xs font-bold shadow-inner">
					<Tag class="w-4 h-4" /> Fecha
				</button>
			</div>
		</div>

		<!-- Lista de Notas -->
		<div class="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6">
			<!-- Pinned Section -->
			<h3 class="flex items-center gap-2 text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-3 px-2">
				<Star class="w-3 h-3 text-amber-400" fill="currentColor" /> ANCLADAS
			</h3>
			<div class="space-y-3 mb-8">
				{#each mockNotes.filter(n => n.pinned) as note}
					<button 
						class="w-full text-left bg-[#070b0e] rounded-2xl p-4 border transition-colors group {note.id === activeNoteId ? 'border-brand-accent shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'border-brand-divider hover:border-brand-accent/50'}"
						onclick={() => activeNoteId = note.id}
					>
						<div class="flex items-start justify-between mb-2">
							<h4 class="text-sm font-bold truncate pr-4 {note.id === activeNoteId ? 'text-brand-text' : 'text-brand-text group-hover:text-brand-accent'}">
								{note.isLocked ? '🔒 ' : ''}{note.title}
							</h4>
							<Star class="w-3.5 h-3.5 {note.pinned ? 'text-amber-400' : 'text-brand-text-muted opacity-0 group-hover:opacity-100'}" fill={note.pinned ? 'currentColor' : 'none'} />
						</div>
						<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-2 mb-3">
							{note.excerpt}
						</p>
						<div class="flex items-center justify-between text-[10px] font-bold">
							<div class="flex items-center gap-3">
								<span class="text-brand-accent">{note.date}</span>
								{#if note.status}
									<span class="{note.statusColor || 'text-brand-text'}">{note.status}</span>
								{/if}
							</div>
							<span class="text-brand-accent">{note.tag}</span>
						</div>
					</button>
				{/each}
			</div>

			<!-- Normal Section -->
			<h3 class="flex items-center gap-2 text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-3 px-2">
				SEPTIEMBRE & AGOSTO 2026
			</h3>
			<div class="space-y-3">
				{#each mockNotes.filter(n => !n.pinned) as note}
					<button 
						class="w-full text-left bg-[#070b0e] rounded-2xl p-4 border transition-colors group {note.id === activeNoteId ? 'border-brand-accent shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'border-brand-divider hover:border-brand-accent/50 shadow-sm'}"
						onclick={() => activeNoteId = note.id}
					>
						<div class="flex items-start justify-between mb-2">
							<h4 class="text-sm font-bold truncate pr-4 {note.id === activeNoteId ? 'text-brand-text' : 'text-brand-text group-hover:text-brand-accent'}">
								{#if note.isLocked}<Lock class="w-3 h-3 inline-block mr-1 text-orange-400" />{/if}{note.title}
							</h4>
							{#if note.status}
								<span class="text-[9px] font-bold px-1.5 py-0.5 rounded border {note.statusColor ? `${note.statusColor.replace('text-', 'bg-')}/10 border-${note.statusColor.replace('text-', '')}/20 ${note.statusColor}` : 'bg-brand-surface border-brand-divider text-brand-text'}">{note.status}</span>
							{/if}
						</div>
						<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-2 mb-3">
							{note.excerpt}
						</p>
						<div class="flex items-center justify-between text-[10px] font-bold">
							<span class="text-brand-text-muted">{note.date}</span>
							<span class="text-brand-accent">{note.tag}</span>
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Footer Info -->
		<div class="p-3 bg-[#0d1216] border-t border-brand-divider text-[10px] font-medium text-brand-text-muted flex items-center justify-between z-10 sticky bottom-0">
			<span>Mostrando 5 de 18 notas</span>
			<span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Sincronizado 12:42</span>
		</div>
	</section>

	<!-- Right Column (Editor / Visor) -->
	<main class="flex-1 flex flex-col bg-[#070b0e] h-full relative z-0">
		
		<!-- Editor Topbar -->
		<header class="shrink-0 h-16 border-b border-brand-divider px-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface border border-brand-divider transition-colors xl:hidden"><List class="w-4 h-4" /></button>
				
				<div class="hidden sm:flex items-center gap-2 text-xs font-bold text-brand-accent bg-brand-accent/5 px-3 py-1.5 rounded-lg border border-brand-accent/20">
					<Folder class="w-4 h-4" /> {activeFolder}
				</div>
				
				<div class="h-4 w-px bg-brand-divider mx-2 hidden sm:block"></div>
				<span class="flex items-center gap-1.5 text-[10px] font-semibold text-brand-text-muted">
					<span class="w-1.5 h-1.5 rounded-full bg-brand-text-muted/50"></span> Editada hace 14 minutos
				</span>
			</div>

			<div class="flex items-center gap-3">
				<button class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-divider bg-[#0d1216] text-[11px] font-bold text-brand-text hover:border-brand-accent transition-colors shadow-inner">
					<Timer class="w-3.5 h-3.5 text-brand-accent" /> Foco Pomodoro
				</button>
				<button class="p-2 rounded-lg text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20 transition-colors shadow-sm"><Star class="w-4 h-4" fill="currentColor" /></button>
				<button class="p-2 rounded-lg text-brand-text-muted bg-[#0d1216] border border-brand-divider hover:text-brand-text transition-colors shadow-sm"><Share2 class="w-4 h-4" /></button>
				<button class="p-2 rounded-lg text-brand-text-muted bg-[#0d1216] border border-brand-divider hover:text-brand-text transition-colors shadow-sm"><MoreHorizontal class="w-4 h-4" /></button>
			</div>
		</header>

		<!-- Editor Canvas -->
		<div class="flex-1 overflow-y-auto custom-scrollbar">
			<div class="max-w-3xl mx-auto px-8 py-12 pb-32">
				
				<!-- Titulo -->
				<h1 class="text-4xl font-black text-brand-text tracking-tight mb-4 outline-none" contenteditable="true" spellcheck="false">Faltantes apartamento</h1>
				
				<!-- Metadatos de la nota -->
				<div class="flex flex-wrap items-center gap-3 mb-8 text-[11px] font-bold">
					<div class="flex items-center gap-2 text-brand-accent">
						<CalendarDays class="w-4 h-4" /> 13 de Septiembre, 2026
					</div>
					<span class="text-brand-text-muted/30">•</span>
					<span class="px-2 py-0.5 rounded-md bg-brand-accent/10 border border-brand-accent/30 text-brand-accent">#vivienda</span>
					<span class="px-2 py-0.5 rounded-md bg-brand-accent/10 border border-brand-accent/30 text-brand-accent">#mudanza</span>
					<button class="text-brand-text-muted hover:text-brand-text transition-colors">+ Tag</button>
				</div>

				<!-- Toolbar Enriquecida -->
				<div class="flex flex-wrap items-center gap-1 p-1 bg-[#0d1216] border border-brand-divider rounded-xl mb-8 w-fit shadow-lg sticky top-0 z-10 backdrop-blur-md">
					<div class="flex items-center gap-1 pr-2 border-r border-brand-divider">
						<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors" title="Negrita"><Bold class="w-4 h-4" /></button>
						<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors" title="Cursiva"><Italic class="w-4 h-4" /></button>
						<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors" title="Subrayado"><Underline class="w-4 h-4" /></button>
					</div>
					<div class="flex items-center gap-1 pl-2 pr-2 border-r border-brand-divider">
						<button class="px-3 py-1.5 flex items-center gap-2 rounded-lg bg-brand-surface-elevated text-brand-accent text-xs font-bold shadow-sm border border-brand-divider" title="Lista de tareas"><CheckSquare class="w-4 h-4" /> Checklist</button>
						<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors" title="Alineación"><AlignLeft class="w-4 h-4" /></button>
						<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors" title="Código"><Code class="w-4 h-4" /></button>
					</div>
					<div class="flex items-center gap-1 pl-2">
						<button class="px-3 py-1.5 flex items-center gap-2 rounded-lg text-amber-400 hover:bg-amber-400/10 text-xs font-bold transition-colors" title="Destacado"><Target class="w-4 h-4" /> Idea clave</button>
					</div>
				</div>

				<!-- Contenido Enriquecido (Mock) -->
				<div class="space-y-6 outline-none text-[15px] leading-relaxed text-brand-text" contenteditable="true" spellcheck="false">
					
					<!-- Bloque Destacado -->
					<div class="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-5 flex gap-4 shadow-sm relative overflow-hidden" contenteditable="false">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent"></div>
						<div class="w-6 h-6 rounded-full bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center shrink-0 mt-0.5 text-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]">
							<Target class="w-3.5 h-3.5" />
						</div>
						<div>
							<h4 class="text-xs font-bold text-brand-text tracking-widest uppercase mb-1">Meta de mudanza — Septiembre 2026</h4>
							<p class="text-brand-text font-medium text-sm">Completar todas las compras de primera necesidad antes del día 20 para instalar la oficina remota sin interrupciones de concentración.</p>
						</div>
					</div>

					<!-- Header H2 -->
					<h2 class="text-lg font-bold text-brand-text pt-4">Artículos Pendientes para Habitación & Sala</h2>
					
					<!-- Checklist funcional simulado -->
					<div class="space-y-2 mt-4" contenteditable="false">
						<!-- Item 1 (Done) -->
						<div class="flex items-start gap-3 group">
							<div class="mt-1">
								<div class="w-5 h-5 rounded-[6px] bg-brand-accent border border-brand-accent flex items-center justify-center text-brand-bg shadow-[0_0_8px_var(--color-brand-accent-muted)]"><Check class="w-3.5 h-3.5" strokeWidth={3} /></div>
							</div>
							<div class="flex-1 flex justify-between items-center border-b border-brand-divider/50 pb-2">
								<span class="line-through text-brand-text-muted font-medium">Cortinas térmicas blackout para sala principal</span>
								<span class="text-[9px] font-bold text-brand-text-muted bg-[#0d1216] px-2 py-0.5 rounded border border-brand-divider">Comprado en IKEA</span>
							</div>
						</div>
						<!-- Item 2 (Done) -->
						<div class="flex items-start gap-3 group">
							<div class="mt-1">
								<div class="w-5 h-5 rounded-[6px] bg-brand-accent border border-brand-accent flex items-center justify-center text-brand-bg shadow-[0_0_8px_var(--color-brand-accent-muted)]"><Check class="w-3.5 h-3.5" strokeWidth={3} /></div>
							</div>
							<div class="flex-1 flex justify-between items-center border-b border-brand-divider/50 pb-2">
								<span class="line-through text-brand-text-muted font-medium">Juego de sábanas algodón egipcio (Cama Queen)</span>
								<span class="text-[9px] font-bold text-brand-text-muted bg-[#0d1216] px-2 py-0.5 rounded border border-brand-divider">$75 USD</span>
							</div>
						</div>
						<!-- Item 3 (Pending) -->
						<div class="flex items-start gap-3 group">
							<div class="mt-1">
								<div class="w-5 h-5 rounded-[6px] bg-brand-surface border border-brand-divider group-hover:border-brand-accent transition-colors"></div>
							</div>
							<div class="flex-1 flex justify-between items-center border-b border-brand-divider/50 pb-2">
								<span class="font-bold text-brand-text">Lámpara de escritorio LED con ajuste de temperatura de color</span>
								<span class="text-[9px] font-bold text-brand-accent bg-brand-accent/10 border border-brand-accent/20 px-2 py-0.5 rounded shadow-sm">Prioridad Alta</span>
							</div>
						</div>
						<!-- Item 4 (Pending) -->
						<div class="flex items-start gap-3 group">
							<div class="mt-1">
								<div class="w-5 h-5 rounded-[6px] bg-brand-surface border border-brand-divider group-hover:border-brand-accent transition-colors"></div>
							</div>
							<div class="flex-1 flex justify-between items-center border-b border-brand-divider/50 pb-2">
								<span class="font-semibold text-brand-text">Espejo con marco de madera para el recibidor (60x120cm)</span>
								<span class="text-[9px] font-bold text-brand-text-muted">Presupuesto: $60</span>
							</div>
						</div>
						<!-- Item 5 (Pending) -->
						<div class="flex items-start gap-3 group">
							<div class="mt-1">
								<div class="w-5 h-5 rounded-[6px] bg-brand-surface border border-brand-divider group-hover:border-brand-accent transition-colors"></div>
							</div>
							<div class="flex-1 flex justify-between items-center border-b border-brand-divider/50 pb-2">
								<span class="font-semibold text-brand-text">Mesa auxiliar para estación de café Fokuz</span>
								<span class="text-[9px] font-bold text-brand-text-muted">Pendiente medir</span>
							</div>
						</div>
					</div>
					
					<div class="pt-2" contenteditable="false">
						<button class="flex items-center gap-2 text-xs font-bold text-brand-accent hover:bg-brand-accent/10 px-3 py-1.5 rounded-lg transition-colors"><Plus class="w-4 h-4" /> Añadir elemento al checklist</button>
					</div>

					<!-- Normal Text -->
					<h3 class="text-[11px] font-bold text-brand-accent tracking-widest uppercase mt-10 mb-2">Notas & Dimensiones de Espacio</h3>
					<ul class="list-disc pl-5 space-y-2 text-brand-text-muted font-medium marker:text-brand-accent">
						<li>Espacio para el escritorio de trabajo: 145 cm de ancho máximo.</li>
						<li>Distancia a la toma de corriente: 2 metros (requiere extensor con supresor de picos).</li>
						<li>Tiendas recomendadas por revisar fin de semana: Muji, Zara Home & MercadoLibre.</li>
					</ul>
					
				</div>
			</div>
		</div>

		<!-- Floating Add Button -->
		<button class="absolute bottom-10 right-10 w-14 h-14 bg-brand-accent hover:brightness-110 text-brand-bg font-bold rounded-full flex items-center justify-center shadow-[0_0_20px_var(--color-brand-accent-muted)] hover:scale-105 transition-all z-20">
			<Plus class="w-6 h-6" />
		</button>
	</main>
</div>
