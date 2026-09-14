<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		Timer, Play, Pause, RotateCcw, Coffee, Target, X, ListChecks, Check, Music, Plus, 
		Trash2, PlayCircle, PauseCircle, SkipForward, Volume2, CloudRain, Wind, Flame,
		Activity, Zap, LayoutDashboard, Settings2, Minimize2, Maximize2, Sparkles
	} from 'lucide-svelte';
	import {
		BREAK_MS, FOCUS_MS, acknowledgePomodoro, clearPomodoroTask, formatPomodoroTime,
		pausePomodoro, pomodoro, resetPomodoro, setPomodoroPhase, startPomodoro
	} from '$lib/pomodoro.svelte';
	import { ytPlayer } from '$lib/youtubePlayer.svelte';

	// Constants for UI
	const progress = $derived.by(() => {
		const total = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
		if (total <= 0) return 0;
		if (pomodoro.awaitingAck) return 100;
		return Math.min(100, Math.max(0, ((total - pomodoro.remainingMs) / total) * 100));
	});

	const phaseLabel = $derived(pomodoro.phase === 'focus' ? 'Enfoque' : 'Descanso');
	
	let focusMins = $state(25);
	let breakMins = $state(5);
	
	let noiseRain = $state(false);
	let noiseBrown = $state(false);
	let noiseFire = $state(false);
	let volRain = $state(50);
	let volBrown = $state(50);
	let volFire = $state(50);

	onMount(() => {
		ytPlayer.init('youtube-player-container');
		const taskIdRaw = page.url.searchParams.get('task');
		const title = page.url.searchParams.get('title');
		if (taskIdRaw && title) {
			const id = Number(taskIdRaw);
			if (!Number.isNaN(id)) {
				pomodoro.linkedTaskId = id;
				pomodoro.linkedTaskTitle = title;
			}
		}
	});
</script>

<svelte:head>
	<title>Pomodoro · Fokuz</title>
</svelte:head>

<div class="flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-32 w-full max-w-7xl mx-auto bg-[#070b0e]">
	
	<!-- Top App Header -->
	<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
		<div class="flex items-center gap-4">
			<div class="w-12 h-12 bg-brand-accent/10 border border-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent">
				<Timer class="w-6 h-6" />
			</div>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-xl font-bold text-brand-text">Temporizador Pomodoro & Enfoque</h1>
					<span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/30">Sesión activa</span>
				</div>
				<p class="text-xs text-brand-text-muted mt-1 font-medium">Sesiones guiadas de alto rendimiento con música ambiental, temporizadores adaptativos y control de tareas.</p>
			</div>
		</div>
		
		<div class="flex items-center gap-4 bg-[#070b0e] border border-brand-divider rounded-xl p-2">
			<div class="text-right px-2">
				<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">Ciclo Actual</p>
				<p class="text-sm font-bold text-brand-text">2 de 4 <span class="text-brand-text-muted font-normal">· Enfoque</span></p>
			</div>
			<button class="w-8 h-8 rounded-lg bg-brand-surface border border-brand-divider flex items-center justify-center hover:bg-brand-surface-elevated transition-colors text-brand-accent">
				<RotateCcw class="w-4 h-4" />
			</button>
			<div class="h-6 w-px bg-brand-divider mx-1"></div>
			<button class="px-4 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-bold text-brand-text hover:text-brand-accent transition-colors">
				<Settings2 class="w-4 h-4" /> Personalizar Tiempos
			</button>
		</div>
	</div>

	<!-- Main 2-Column Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Left Column: Timer & Controls -->
		<div class="lg:col-span-8 flex flex-col gap-6">
			
			<!-- Phase Tabs -->
			<div class="grid grid-cols-3 gap-2 bg-[#0d1216] border border-brand-divider rounded-2xl p-1.5">
				<button 
					type="button" 
					class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all {pomodoro.phase === 'focus' ? 'bg-brand-accent text-brand-bg shadow-[0_0_10px_var(--color-brand-accent-muted)]' : 'text-brand-text-muted hover:text-brand-text'}" 
					onclick={() => setPomodoroPhase('focus')}
				>
					<Target class="w-4 h-4" /> Enfoque · 25 min
				</button>
				<button 
					type="button" 
					class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all {pomodoro.phase === 'break' && focusMins === 25 ? 'bg-brand-surface-elevated text-brand-text shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}" 
					onclick={() => setPomodoroPhase('break')}
				>
					<Coffee class="w-4 h-4" /> Descanso Corto · 5 min
				</button>
				<button 
					type="button" 
					class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all text-brand-text-muted hover:text-brand-text"
				>
					<Coffee class="w-4 h-4" /> Descanso Largo · 15 min
				</button>
			</div>

			<!-- Quick Config -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5">
				<div class="flex items-center justify-between mb-4">
					<h3 class="flex items-center gap-2 text-xs font-bold text-brand-text tracking-wide"><Settings2 class="w-4 h-4 text-brand-accent" /> CONFIGURACIÓN RÁPIDA DE SESIÓN</h3>
					<span class="text-[10px] text-brand-text-muted font-medium">Los cambios se aplican al próximo inicio</span>
				</div>
				<div class="grid grid-cols-2 gap-6">
					<!-- Focus Time -->
					<div>
						<div class="flex items-center justify-between mb-2">
							<span class="text-[11px] font-bold text-brand-text">Tiempo de Concentración</span>
							<span class="text-[11px] font-bold text-brand-accent">{focusMins} min</span>
						</div>
						<div class="flex items-center gap-1 bg-[#070b0e] border border-brand-divider p-1 rounded-xl">
							<button class="w-8 h-7 rounded-lg bg-[#0d1216] flex items-center justify-center text-brand-accent hover:bg-brand-surface transition-colors" onclick={() => focusMins=Math.max(5, focusMins-5)}>-</button>
							<div class="flex-1 flex gap-1 px-1">
								{#each [25, 45, 60, 90] as m}
									<button class="flex-1 py-1 rounded text-[10px] font-bold {focusMins === m ? 'bg-brand-surface-elevated text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}" onclick={() => focusMins=m}>{m}m</button>
								{/each}
							</div>
							<button class="w-8 h-7 rounded-lg bg-[#0d1216] flex items-center justify-center text-brand-accent hover:bg-brand-surface transition-colors" onclick={() => focusMins+=5}>+</button>
						</div>
					</div>
					<!-- Break Time -->
					<div>
						<div class="flex items-center justify-between mb-2">
							<span class="text-[11px] font-bold text-brand-text">Tiempo de Descanso</span>
							<span class="text-[11px] font-bold text-brand-accent">{breakMins} min</span>
						</div>
						<div class="flex items-center gap-1 bg-[#070b0e] border border-brand-divider p-1 rounded-xl">
							<button class="w-8 h-7 rounded-lg bg-[#0d1216] flex items-center justify-center text-brand-accent hover:bg-brand-surface transition-colors" onclick={() => breakMins=Math.max(1, breakMins-1)}>-</button>
							<div class="flex-1 flex gap-1 px-1">
								{#each [5, 10, 15, 20] as m}
									<button class="flex-1 py-1 rounded text-[10px] font-bold {breakMins === m ? 'bg-brand-surface-elevated text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}" onclick={() => breakMins=m}>{m}m</button>
								{/each}
							</div>
							<button class="w-8 h-7 rounded-lg bg-[#0d1216] flex items-center justify-center text-brand-accent hover:bg-brand-surface transition-colors" onclick={() => breakMins+=1}>+</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Giant Timer -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-[2rem] p-8 flex flex-col items-center relative overflow-hidden shadow-2xl h-[420px]">
				<!-- Background glow -->
				<div class="absolute inset-0 bg-brand-accent/5 radial-gradient-fade z-0"></div>
				
				<h2 class="text-[11px] font-black text-brand-accent tracking-[0.2em] uppercase z-10 mb-8">
					Modo {pomodoro.phase === 'focus' ? 'Enfoque Profundo' : 'Descanso'}
				</h2>

				<!-- SVG Timer -->
				<div class="relative w-64 h-64 z-10">
					<svg class="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
						<circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="4" class="text-[#1a2228]" />
						<circle 
							cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" 
							class="text-brand-accent transition-[stroke-dashoffset] duration-1000 shadow-[0_0_15px_var(--color-brand-accent)]" 
							style="filter: drop-shadow(0px 0px 8px var(--color-brand-accent-muted));"
							stroke-dasharray={2 * Math.PI * 54} 
							stroke-dashoffset={2 * Math.PI * 54 * (1 - progress / 100)} 
						/>
					</svg>
					<div class="absolute inset-0 flex flex-col items-center justify-center">
						<span class="text-6xl font-black tabular-nums text-brand-text tracking-tighter drop-shadow-lg">
							{formatPomodoroTime(pomodoro.remainingMs)}
						</span>
						<span class="text-[10px] font-bold uppercase tracking-widest mt-2 {pomodoro.awaitingAck ? 'text-brand-accent' : 'text-brand-text-muted'}">
							{pomodoro.awaitingAck ? 'Finalizado' : (pomodoro.running ? 'En Curso' : 'Listo para iniciar')}
						</span>
						<span class="text-[9px] text-brand-text-muted mt-1 font-semibold">Sesión 1 de 4</span>
					</div>
				</div>

				<!-- Linked Task inner card -->
				<div class="mt-auto z-10 w-full max-w-sm">
					{#if pomodoro.linkedTaskTitle}
						<div class="w-full flex items-center justify-between bg-[#070b0e]/80 backdrop-blur-md border border-brand-divider rounded-2xl p-3 shadow-inner">
							<div class="flex items-center gap-3 min-w-0">
								<span class="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent)] shrink-0"></span>
								<div class="min-w-0">
									<p class="text-[8px] font-bold text-brand-text-muted tracking-wider uppercase mb-0.5">Tarea en curso vinculada</p>
									<p class="text-xs font-bold text-brand-text truncate">{pomodoro.linkedTaskTitle}</p>
								</div>
							</div>
							<button class="px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-divider text-[10px] font-bold text-brand-accent hover:bg-brand-surface-elevated transition-colors" onclick={clearPomodoroTask}>
								Cambiar
							</button>
						</div>
					{:else}
						<p class="text-[10px] text-brand-text-muted text-center font-medium">Abre una tarea de tu lista y pulsa "Vincular" para registrar estadísticas exactas.</p>
					{/if}
				</div>

				<!-- Floating Play Controls -->
				<div class="absolute bottom-8 z-20 flex items-center justify-center gap-6">
					<button class="p-3 rounded-full text-brand-text-muted hover:text-brand-text bg-[#070b0e] border border-brand-divider hover:border-brand-accent transition-all" onclick={resetPomodoro} disabled={pomodoro.awaitingAck}>
						<RotateCcw class="w-4 h-4" />
					</button>
					
					{#if pomodoro.awaitingAck}
						<button class="w-16 h-16 rounded-full bg-brand-accent text-brand-bg flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_20px_var(--color-brand-accent-muted)]" onclick={acknowledgePomodoro}>
							<Check class="w-8 h-8" strokeWidth={3} />
						</button>
					{:else if pomodoro.running}
						<button class="w-16 h-16 rounded-full bg-brand-accent text-brand-bg flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_20px_var(--color-brand-accent-muted)]" onclick={pausePomodoro}>
							<Pause class="w-8 h-8" fill="currentColor" />
						</button>
					{:else}
						<button class="w-16 h-16 rounded-full bg-brand-accent text-brand-bg flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_20px_var(--color-brand-accent-muted)]" onclick={startPomodoro}>
							<Play class="w-8 h-8 ml-1" fill="currentColor" />
						</button>
					{/if}

					<button class="p-3 rounded-full text-brand-text-muted hover:text-brand-text bg-[#070b0e] border border-brand-divider hover:border-brand-accent transition-all">
						<SkipForward class="w-4 h-4" />
					</button>
					
					<div class="absolute -right-24">
						<button class="p-2 rounded-lg text-brand-text-muted hover:text-brand-text bg-[#070b0e] border border-brand-divider transition-all">
							<Maximize2 class="w-4 h-4" />
						</button>
					</div>
				</div>
			</div>

			<!-- Playlist Section -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6">
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-xl bg-brand-surface border border-brand-divider flex items-center justify-center text-brand-accent shadow-inner">
							<Music class="w-5 h-5" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-brand-text">Playlist & Música de Concentración</h3>
							<p class="text-[10px] font-medium text-brand-text-muted">Sonido continuo sincronizado con tu sesión Pomodoro</p>
						</div>
					</div>
					<div class="flex gap-1 text-[10px] font-bold p-1 bg-[#070b0e] border border-brand-divider rounded-lg">
						<button class="px-3 py-1.5 rounded-md bg-brand-surface border border-brand-divider text-brand-accent shadow-sm">YouTube</button>
						<button class="px-3 py-1.5 rounded-md text-brand-text-muted hover:text-brand-text">Spotify</button>
						<button class="px-3 py-1.5 rounded-md text-brand-text-muted hover:text-brand-text">Lofi Fokuz</button>
						<button class="px-3 py-1.5 rounded-md text-brand-text-muted hover:text-brand-text">Ruido Blanco</button>
					</div>
				</div>

				<form class="flex gap-3 mb-6" onsubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const url = fd.get('url'); if (url) { ytPlayer.addTrack(url.toString()); e.currentTarget.reset(); } }}>
					<div class="relative flex-1">
						<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<Music class="w-4 h-4 text-brand-text-muted" />
						</div>
						<input type="url" name="url" placeholder="Pega un enlace de YouTube, Spotify o lista temática..." class="w-full bg-[#070b0e] border border-brand-divider rounded-xl pl-9 pr-4 py-3 text-xs font-medium text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner" required />
					</div>
					<button type="submit" class="px-4 py-3 bg-brand-surface border border-brand-divider rounded-xl text-[11px] font-bold text-brand-accent hover:bg-brand-surface-elevated transition-colors flex items-center gap-2">
						<Plus class="w-4 h-4" /> Añadir Pista
					</button>
					<button type="button" class="px-4 py-3 bg-brand-accent/10 border border-brand-accent/30 rounded-xl text-[11px] font-bold text-brand-accent hover:bg-brand-accent/20 transition-colors flex items-center gap-2">
						<Sparkles class="w-4 h-4" /> Generar con IA
					</button>
				</form>

				<div class="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
					{#if ytPlayer.playlist.length > 0}
						{#each ytPlayer.playlist as track, i}
							<div class="flex items-center justify-between bg-[#070b0e] border {i === ytPlayer.currentTrackIndex ? 'border-brand-accent bg-brand-accent/5 shadow-inner' : 'border-brand-divider hover:border-brand-accent/50'} rounded-xl p-3 transition-colors group">
								<div class="flex items-center gap-4 min-w-0">
									<div class="w-10 h-10 rounded-lg {i === ytPlayer.currentTrackIndex ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-surface text-brand-text-muted'} flex items-center justify-center shrink-0 border border-brand-divider">
										<Music class="w-4 h-4" />
									</div>
									<div class="min-w-0">
										<div class="flex items-center gap-2 mb-0.5">
											<h4 class="text-xs font-bold text-brand-text truncate">{track.title}</h4>
											{#if i === ytPlayer.currentTrackIndex && ytPlayer.isPlaying}
												<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-accent text-brand-bg uppercase">En vivo</span>
											{/if}
										</div>
										<p class="text-[10px] text-brand-text-muted truncate">Lofi Girl · Concentración Profunda</p>
									</div>
								</div>
								
								<div class="flex items-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
									{#if i === ytPlayer.currentTrackIndex}
										<!-- Active track visualizer -->
										<div class="flex gap-0.5 items-end h-4 mx-2">
											<div class="w-1 bg-brand-accent h-full animate-bounce [animation-delay:-0.3s]"></div>
											<div class="w-1 bg-brand-accent h-2/3 animate-bounce [animation-delay:-0.15s]"></div>
											<div class="w-1 bg-brand-accent h-1/2 animate-bounce"></div>
											<div class="w-1 bg-brand-accent h-4/5 animate-bounce [animation-delay:-0.2s]"></div>
										</div>
										
										<!-- Controls for active -->
										<button class="p-1.5 rounded-lg text-brand-text hover:text-brand-accent bg-brand-surface border border-brand-divider" onclick={() => ytPlayer.playTrack(i===0?ytPlayer.playlist.length-1:i-1)}><SkipForward class="w-3.5 h-3.5 rotate-180" /></button>
										<button class="p-1.5 rounded-lg text-brand-bg bg-brand-accent" onclick={() => ytPlayer.togglePlay()}>
											{#if ytPlayer.isPlaying}<Pause class="w-4 h-4" fill="currentColor" />{:else}<Play class="w-4 h-4" fill="currentColor" />{/if}
										</button>
										<button class="p-1.5 rounded-lg text-brand-text hover:text-brand-accent bg-brand-surface border border-brand-divider" onclick={() => ytPlayer.next()}><SkipForward class="w-3.5 h-3.5" /></button>
										
										<div class="flex items-center gap-1.5 ml-2">
											<Volume2 class="w-3.5 h-3.5 text-brand-text-muted" />
											<input type="range" min="0" max="100" value={ytPlayer.volume} oninput={(e) => ytPlayer.setVolume(Number(e.currentTarget.value))} class="w-16 accent-brand-accent h-1 bg-brand-divider rounded-lg appearance-none" />
										</div>
									{:else}
										<button class="p-2 rounded-lg text-brand-text bg-brand-surface border border-brand-divider hover:text-brand-accent transition-colors" onclick={() => ytPlayer.playTrack(i)}>
											<Play class="w-4 h-4" fill="currentColor" />
										</button>
										<button class="p-2 rounded-lg text-brand-text-muted hover:text-red-400 transition-colors" onclick={() => ytPlayer.removeTrack(i)}>
											<Trash2 class="w-4 h-4" />
										</button>
									{/if}
								</div>
							</div>
						{/each}
					{:else}
						<!-- Mock items to match design -->
						<div class="flex items-center justify-between bg-[#070b0e] border border-brand-accent/50 bg-brand-accent/5 shadow-inner rounded-xl p-3">
							<div class="flex items-center gap-4 min-w-0">
								<div class="w-10 h-10 rounded-lg bg-brand-accent/20 text-brand-accent flex items-center justify-center shrink-0 border border-brand-accent/30">
									<Music class="w-4 h-4" />
								</div>
								<div class="min-w-0">
									<div class="flex items-center gap-2 mb-0.5">
										<h4 class="text-xs font-bold text-brand-text truncate">Synthwave Chill Focus Beats</h4>
										<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-accent text-brand-bg uppercase">En vivo</span>
									</div>
									<p class="text-[10px] text-brand-text-muted truncate">Lofi Girl · Concentración Profunda para Programación</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<div class="flex gap-0.5 items-end h-4 mx-2">
									<div class="w-1 bg-brand-accent h-full"></div>
									<div class="w-1 bg-brand-accent h-2/3"></div>
									<div class="w-1 bg-brand-accent h-1/2"></div>
									<div class="w-1 bg-brand-accent h-4/5"></div>
								</div>
								<button class="p-1.5 rounded-lg text-brand-text hover:text-brand-accent bg-brand-surface border border-brand-divider"><SkipForward class="w-3.5 h-3.5 rotate-180" /></button>
								<button class="p-1.5 rounded-lg text-brand-bg bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent)]"><Play class="w-4 h-4" fill="currentColor" /></button>
								<button class="p-1.5 rounded-lg text-brand-text hover:text-brand-accent bg-brand-surface border border-brand-divider"><SkipForward class="w-3.5 h-3.5" /></button>
								<div class="flex items-center gap-1.5 ml-2">
									<Volume2 class="w-3.5 h-3.5 text-brand-text-muted" />
									<input type="range" class="w-16 accent-brand-accent h-1 bg-brand-divider rounded-lg appearance-none" />
								</div>
							</div>
						</div>
						
						<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-xl p-3">
							<div class="flex items-center gap-4 min-w-0">
								<div class="w-10 h-10 rounded-lg bg-brand-surface text-brand-text-muted flex items-center justify-center shrink-0 border border-brand-divider">
									<Activity class="w-4 h-4" />
								</div>
								<div class="min-w-0">
									<h4 class="text-xs font-bold text-brand-text truncate mb-0.5">Alpha Waves 432Hz</h4>
									<p class="text-[10px] text-brand-text-muted truncate">Neurociencia · Foco Puro</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
			
			<div id="youtube-player-container" class="hidden"></div>
		</div>

		<!-- Right Column: Metrics & Environment -->
		<div class="lg:col-span-4 flex flex-col gap-6">
			
			<!-- Métricas de Hoy -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="flex items-center gap-2 text-xs font-bold text-brand-text tracking-wide"><Activity class="w-4 h-4 text-brand-accent" /> MÉTRICAS DE HOY</h3>
					<span class="text-[9px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-md border border-brand-accent/20">Semana 37</span>
				</div>
				
				<div class="grid grid-cols-2 gap-3 mb-6">
					<div class="bg-[#070b0e] border border-brand-divider rounded-xl p-3 flex flex-col justify-center items-center text-center shadow-inner">
						<Flame class="w-4 h-4 text-orange-500 mb-1" />
						<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider mb-0.5">Racha Activa</p>
						<p class="text-lg font-black text-brand-text">6 días</p>
					</div>
					<div class="bg-[#070b0e] border border-brand-divider rounded-xl p-3 flex flex-col justify-center items-center text-center shadow-inner">
						<Zap class="w-4 h-4 text-brand-accent mb-1" />
						<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider mb-0.5">Rendimiento</p>
						<p class="text-lg font-black text-brand-accent">Óptimo</p>
					</div>
				</div>

				<div class="mb-6">
					<div class="flex items-center justify-between text-[10px] font-bold mb-2">
						<span class="text-brand-text">Progreso: 4 de 6 sesiones</span>
						<span class="text-brand-accent">66%</span>
					</div>
					<div class="h-2 bg-[#070b0e] border border-brand-divider rounded-full overflow-hidden mb-2">
						<div class="h-full bg-brand-accent w-[66%] shadow-[0_0_5px_var(--color-brand-accent)] rounded-full"></div>
					</div>
					<div class="flex items-center justify-between text-[9px] font-medium text-brand-text-muted">
						<span>1h 40m foco acumulado</span>
						<span>Meta: 2h 30m</span>
					</div>
				</div>

				<div>
					<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider mb-3">Sesiones Recientes</p>
					<div class="space-y-2">
						<div class="flex items-center justify-between text-[11px] bg-[#070b0e] px-3 py-2 rounded-lg border border-brand-divider">
							<div class="flex items-center gap-2">
								<span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>
								<span class="font-semibold text-brand-text truncate">Revisión de métricas Sprint 37</span>
							</div>
							<span class="text-brand-text-muted font-bold">25m</span>
						</div>
						<div class="flex items-center justify-between text-[11px] bg-[#070b0e] px-3 py-2 rounded-lg border border-brand-divider">
							<div class="flex items-center gap-2">
								<span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>
								<span class="font-semibold text-brand-text truncate">Estructura Base de Datos Fokuz</span>
							</div>
							<span class="text-brand-text-muted font-bold">45m</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Capas de Ruido Ambiental -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="flex items-center gap-2 text-xs font-bold text-brand-text tracking-wide"><Wind class="w-4 h-4 text-brand-accent" /> CAPAS DE RUIDO AMBIENTAL</h3>
					<span class="text-[9px] text-brand-text-muted font-medium">Mezclar con música</span>
				</div>
				
				<div class="space-y-4">
					<!-- Lluvia -->
					<div class="flex flex-col gap-2">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg bg-[#070b0e] border border-brand-divider flex items-center justify-center text-blue-400"><CloudRain class="w-4 h-4" /></div>
								<div>
									<p class="text-xs font-bold text-brand-text">Lluvia Suave</p>
									<p class="text-[9px] text-brand-text-muted">Calma y reducción de ecos</p>
								</div>
							</div>
							<button class="w-6 h-6 rounded-md flex items-center justify-center border transition-colors {noiseRain ? 'bg-brand-accent border-brand-accent text-brand-bg shadow-[0_0_5px_var(--color-brand-accent-muted)]' : 'bg-brand-surface border-brand-divider text-brand-text-muted'}" onclick={() => noiseRain=!noiseRain}>
								{#if noiseRain}<Check class="w-3.5 h-3.5" strokeWidth={3} />{/if}
							</button>
						</div>
						{#if noiseRain}
							<input type="range" min="0" max="100" bind:value={volRain} class="w-full accent-brand-accent h-1 bg-[#070b0e] border border-brand-divider rounded-lg appearance-none" />
						{/if}
					</div>
					
					<!-- Ruido Marrón -->
					<div class="flex flex-col gap-2 pt-2 border-t border-brand-divider/50">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg bg-[#070b0e] border border-brand-divider flex items-center justify-center text-amber-600"><Wind class="w-4 h-4" /></div>
								<div>
									<p class="text-xs font-bold text-brand-text">Ruido Marrón Profundo</p>
									<p class="text-[9px] text-brand-text-muted">Aislamiento acústico total</p>
								</div>
							</div>
							<button class="w-6 h-6 rounded-md flex items-center justify-center border transition-colors {noiseBrown ? 'bg-brand-accent border-brand-accent text-brand-bg shadow-[0_0_5px_var(--color-brand-accent-muted)]' : 'bg-brand-surface border-brand-divider text-brand-text-muted'}" onclick={() => noiseBrown=!noiseBrown}>
								{#if noiseBrown}<Check class="w-3.5 h-3.5" strokeWidth={3} />{/if}
							</button>
						</div>
						{#if noiseBrown}
							<input type="range" min="0" max="100" bind:value={volBrown} class="w-full accent-brand-accent h-1 bg-[#070b0e] border border-brand-divider rounded-lg appearance-none" />
						{/if}
					</div>

					<!-- Hoguera -->
					<div class="flex flex-col gap-2 pt-2 border-t border-brand-divider/50">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg bg-[#070b0e] border border-brand-divider flex items-center justify-center text-orange-500"><Flame class="w-4 h-4" /></div>
								<div>
									<p class="text-xs font-bold text-brand-text opacity-70">Hoguera Nocturna</p>
									<p class="text-[9px] text-brand-text-muted opacity-70">Calidez reconfortante</p>
								</div>
							</div>
							<button class="w-6 h-6 rounded-md flex items-center justify-center border bg-[#070b0e] border-brand-divider text-brand-text-muted opacity-50 cursor-not-allowed">
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Inspiración -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 relative overflow-hidden">
				<div class="absolute top-0 right-0 p-4 opacity-5">
					<Target class="w-24 h-24 text-brand-accent" />
				</div>
				<div class="flex items-center justify-between mb-4 relative z-10">
					<h3 class="flex items-center gap-2 text-[11px] font-bold text-brand-accent tracking-widest uppercase"><Target class="w-3.5 h-3.5" /> INSPIRACIÓN PARA EL ENFOQUE</h3>
					<span class="text-[9px] font-bold text-brand-text-muted bg-[#070b0e] border border-brand-divider px-1.5 py-0.5 rounded">NVI</span>
				</div>
				<blockquote class="text-sm font-medium text-brand-text italic leading-relaxed relative z-10">
					"Todo lo que hagan, háganlo de buena gana, como si estuvieran trabajando para el Señor y no para los hombres."
				</blockquote>
				<p class="text-right text-[10px] font-bold text-brand-accent mt-3 relative z-10">Colosenses 3:23</p>
			</div>
			
		</div>
	</div>
</div>

<style>
	/* Custom styling for the giant glowing timer ring */
	.radial-gradient-fade {
		background: radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0) 70%);
	}
	
	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		background: var(--color-brand-accent);
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 0 8px var(--color-brand-accent-muted);
	}
</style>
