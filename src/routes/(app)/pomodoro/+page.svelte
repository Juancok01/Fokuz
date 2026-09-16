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
		pausePomodoro, pomodoro, resetPomodoro, setPomodoroPhase, startPomodoro, setPomodoroTimes
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
	
	$effect(() => {
		setPomodoroTimes(focusMins, breakMins);
	});
	
	let noiseRain = $state(false);
	let noiseBrown = $state(false);
	let noiseFire = $state(false);
	let volRain = $state(50);
	let volBrown = $state(50);
	let volFire = $state(50);

	let audioMode = $state<'music' | 'ambient'>('music');
	let editTrackIndex = $state<number | null>(null);
	let editTrackTitle = $state('');
	let viewingPlaylistId = $state<string | null>(null);
	let newPlaylistName = $state('');
	let editPlaylistId = $state<string | null>(null);
	let editPlaylistName = $state('');

	let audioRain: HTMLAudioElement;
	let audioBrown: HTMLAudioElement;
	let audioFire: HTMLAudioElement;

	$effect(() => {
		if (audioRain) {
			audioRain.volume = volRain / 100;
			if (noiseRain && audioRain.paused) { const p = audioRain.play(); if (p) p.catch(() => {}); }
			else if (!noiseRain && !audioRain.paused) audioRain.pause();
		}
		if (audioBrown) {
			audioBrown.volume = volBrown / 100;
			if (noiseBrown && audioBrown.paused) { const p = audioBrown.play(); if (p) p.catch(() => {}); }
			else if (!noiseBrown && !audioBrown.paused) audioBrown.pause();
		}
		if (audioFire) {
			audioFire.volume = volFire / 100;
			if (noiseFire && audioFire.paused) { const p = audioFire.play(); if (p) p.catch(() => {}); }
			else if (!noiseFire && !audioFire.paused) audioFire.pause();
		}
	});

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
				</div>
				<p class="text-xs text-brand-text-muted mt-1 font-medium">Sesiones guiadas de alto rendimiento con música ambiental, temporizadores adaptativos y control de tareas.</p>
			</div>
		</div>
		

	</div>

	<!-- Main 2-Column Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Left Column: Timer & Controls -->
		<div class="lg:col-span-8 flex flex-col gap-6">
			
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

			<!-- Phase Tabs -->
			<div class="grid grid-cols-2 gap-2 bg-[#0d1216] border border-brand-divider rounded-2xl p-1.5">
				<button 
					type="button" 
					class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all {pomodoro.phase === 'focus' ? 'bg-brand-accent text-brand-bg shadow-[0_0_10px_var(--color-brand-accent-muted)]' : 'text-brand-text-muted hover:text-brand-text'}" 
					onclick={() => setPomodoroPhase('focus')}
				>
					<Target class="w-4 h-4" /> Enfoque · {focusMins} min
				</button>
				<button 
					type="button" 
					class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all {pomodoro.phase === 'break' ? 'bg-brand-surface-elevated text-brand-text shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}" 
					onclick={() => setPomodoroPhase('break')}
				>
					<Coffee class="w-4 h-4" /> Descanso Corto · {breakMins} min
				</button>
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
						<!-- Texto eliminado a petición del usuario -->
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
						<button class="px-3 py-1.5 rounded-md {audioMode === 'music' ? 'bg-brand-surface border border-brand-divider text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}" onclick={() => { audioMode = 'music'; }}>Música con Ambiente</button>
						<button class="px-3 py-1.5 rounded-md {audioMode === 'ambient' ? 'bg-brand-surface border border-brand-divider text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}" onclick={() => { audioMode = 'ambient'; ytPlayer.pause(); }}>Solo Ambiente</button>
					</div>
				</div>

				{#if audioMode === 'music'}
					{#if viewingPlaylistId === null}
						<!-- Vista de Playlists -->
						<form class="flex gap-3 mb-6" onsubmit={(e) => { e.preventDefault(); if (newPlaylistName.trim()) { ytPlayer.createPlaylist(newPlaylistName.trim()); newPlaylistName = ''; } }}>
							<div class="relative flex-1">
								<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<ListChecks class="w-4 h-4 text-brand-text-muted" />
								</div>
								<input type="text" bind:value={newPlaylistName} placeholder="Nombre de la nueva playlist..." class="w-full bg-[#070b0e] border border-brand-divider rounded-xl pl-9 pr-4 py-3 text-xs font-medium text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner" required />
							</div>
							<button type="submit" class="px-4 py-3 bg-brand-surface border border-brand-divider rounded-xl text-[11px] font-bold text-brand-accent hover:bg-brand-surface-elevated transition-colors flex items-center gap-2">
								<Plus class="w-4 h-4" /> Crear Playlist
							</button>
						</form>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
							{#each ytPlayer.playlists as playlist}
								<div class="flex flex-col justify-between bg-[#070b0e] border {ytPlayer.currentPlaylistId === playlist.id ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-divider hover:border-brand-accent/50'} rounded-xl p-3 transition-colors cursor-pointer group" onclick={() => viewingPlaylistId = playlist.id}>
									<div class="flex items-center justify-between mb-2">
										<div class="flex items-center gap-2 min-w-0 flex-1">
											<div class="w-8 h-8 rounded-lg {ytPlayer.currentPlaylistId === playlist.id ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-surface text-brand-text-muted'} flex items-center justify-center shrink-0 border border-brand-divider">
												<Music class="w-3.5 h-3.5" />
											</div>
											<div class="min-w-0 flex-1" onclick={(e) => e.stopPropagation()}>
												{#if editPlaylistId === playlist.id}
													<div class="flex items-center gap-1">
														<input type="text" bind:value={editPlaylistName} class="bg-[#0d1216] border border-brand-divider rounded px-1.5 py-0.5 text-xs text-brand-text focus:outline-none focus:border-brand-accent w-full" onkeydown={(e) => { if (e.key === 'Enter') { ytPlayer.updatePlaylistName(playlist.id, editPlaylistName); editPlaylistId = null; } else if (e.key === 'Escape') editPlaylistId = null; }} autofocus />
														<button class="text-brand-accent" onclick={() => { ytPlayer.updatePlaylistName(playlist.id, editPlaylistName); editPlaylistId = null; }}><Check class="w-3 h-3" /></button>
														<button class="text-red-400" onclick={() => editPlaylistId = null}><X class="w-3 h-3" /></button>
													</div>
												{:else}
													<h4 class="text-xs font-bold text-brand-text truncate">{playlist.name}</h4>
												{/if}
											</div>
										</div>
										<div class="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onclick={(e) => e.stopPropagation()}>
											<button class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-accent transition-colors" onclick={() => { editPlaylistId = playlist.id; editPlaylistName = playlist.name; }}>
												<Settings2 class="w-3.5 h-3.5" />
											</button>
											<button class="p-1.5 rounded-lg text-brand-text-muted hover:text-red-400 transition-colors" onclick={() => ytPlayer.deletePlaylist(playlist.id)}>
												<Trash2 class="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
									<p class="text-[10px] text-brand-text-muted flex items-center gap-1">
										<ListChecks class="w-3 h-3" /> {playlist.tracks.length} pista(s)
										{#if ytPlayer.currentPlaylistId === playlist.id && ytPlayer.isPlaying}
											<span class="ml-auto flex gap-0.5 items-end h-2">
												<div class="w-0.5 bg-brand-accent h-full animate-bounce [animation-delay:-0.3s]"></div>
												<div class="w-0.5 bg-brand-accent h-2/3 animate-bounce [animation-delay:-0.15s]"></div>
												<div class="w-0.5 bg-brand-accent h-1/2 animate-bounce"></div>
											</span>
										{/if}
									</p>
								</div>
							{/each}
							{#if ytPlayer.playlists.length === 0}
								<div class="col-span-1 md:col-span-2 text-xs text-brand-text-muted italic bg-[#070b0e] px-3 py-4 text-center rounded-lg border border-brand-divider">
									No tienes ninguna playlist. Crea una arriba para empezar.
								</div>
							{/if}
						</div>
					{:else}
						<!-- Vista de Pistas -->
						{#if ytPlayer.getPlaylist(viewingPlaylistId)}
							{@const currentViewedPlaylist = ytPlayer.getPlaylist(viewingPlaylistId)!}
							<div class="flex items-center gap-3 mb-4">
								<button class="text-brand-text-muted hover:text-brand-accent flex items-center gap-1 text-[10px] font-bold" onclick={() => viewingPlaylistId = null}>
									&larr; Volver a Playlists
								</button>
								<h4 class="text-xs font-bold text-brand-text truncate flex-1">{currentViewedPlaylist.name}</h4>
							</div>

							<form class="flex gap-3 mb-6" onsubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const url = fd.get('url'); if (url && viewingPlaylistId) { ytPlayer.addTrack(viewingPlaylistId, url.toString()); e.currentTarget.reset(); } }}>
								<div class="relative flex-1">
									<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
										<Music class="w-4 h-4 text-brand-text-muted" />
									</div>
									<input type="url" name="url" placeholder="Pega un enlace de YouTube..." class="w-full bg-[#070b0e] border border-brand-divider rounded-xl pl-9 pr-4 py-3 text-xs font-medium text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner" required />
								</div>
								<button type="submit" class="px-4 py-3 bg-brand-surface border border-brand-divider rounded-xl text-[11px] font-bold text-brand-accent hover:bg-brand-surface-elevated transition-colors flex items-center gap-2">
									<Plus class="w-4 h-4" /> Añadir Pista
								</button>
							</form>

							<div class="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
								{#if currentViewedPlaylist.tracks.length > 0}
									{#each currentViewedPlaylist.tracks as track, i}
										<div class="flex items-center justify-between bg-[#070b0e] border {viewingPlaylistId === ytPlayer.currentPlaylistId && i === ytPlayer.currentTrackIndex ? 'border-brand-accent bg-brand-accent/5 shadow-inner' : 'border-brand-divider hover:border-brand-accent/50'} rounded-xl p-3 transition-colors group">
											<div class="flex items-center gap-4 min-w-0 flex-1">
												<div class="w-10 h-10 rounded-lg {viewingPlaylistId === ytPlayer.currentPlaylistId && i === ytPlayer.currentTrackIndex ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-surface text-brand-text-muted'} flex items-center justify-center shrink-0 border border-brand-divider">
													<Music class="w-4 h-4" />
												</div>
												<div class="min-w-0 flex-1">
													{#if editTrackIndex === i}
														<div class="flex items-center gap-2">
															<input type="text" bind:value={editTrackTitle} class="bg-[#070b0e] border border-brand-divider rounded px-2 py-1 text-xs text-brand-text focus:outline-none focus:border-brand-accent w-full" onkeydown={(e) => { if (e.key === 'Enter') { ytPlayer.updateTrackTitle(viewingPlaylistId!, i, editTrackTitle); editTrackIndex = null; } else if (e.key === 'Escape') editTrackIndex = null; }} autofocus />
															<button class="text-brand-accent hover:text-brand-accent/80" onclick={() => { ytPlayer.updateTrackTitle(viewingPlaylistId!, i, editTrackTitle); editTrackIndex = null; }}><Check class="w-3.5 h-3.5" /></button>
															<button class="text-red-400 hover:text-red-500" onclick={() => editTrackIndex = null}><X class="w-3.5 h-3.5" /></button>
														</div>
													{:else}
														<div class="flex items-center gap-2 mb-0.5">
															<h4 class="text-xs font-bold text-brand-text truncate">{track.title}</h4>
															{#if viewingPlaylistId === ytPlayer.currentPlaylistId && i === ytPlayer.currentTrackIndex && ytPlayer.isPlaying}
																<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-accent text-brand-bg uppercase">En vivo</span>
															{/if}
														</div>
														<p class="text-[10px] text-brand-text-muted truncate">Pista de YouTube</p>
													{/if}
												</div>
											</div>
											
											<div class="flex items-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
												{#if viewingPlaylistId === ytPlayer.currentPlaylistId && i === ytPlayer.currentTrackIndex}
													<!-- Active track visualizer -->
													<div class="flex gap-0.5 items-end h-4 mx-2">
														<div class="w-1 bg-brand-accent h-full animate-bounce [animation-delay:-0.3s]"></div>
														<div class="w-1 bg-brand-accent h-2/3 animate-bounce [animation-delay:-0.15s]"></div>
														<div class="w-1 bg-brand-accent h-1/2 animate-bounce"></div>
														<div class="w-1 bg-brand-accent h-4/5 animate-bounce [animation-delay:-0.2s]"></div>
													</div>
													
													<!-- Controls for active -->
													<button class="p-1.5 rounded-lg text-brand-text hover:text-brand-accent bg-brand-surface border border-brand-divider" onclick={() => ytPlayer.playTrack(viewingPlaylistId!, i===0?currentViewedPlaylist.tracks.length-1:i-1)}><SkipForward class="w-3.5 h-3.5 rotate-180" /></button>
													<button class="p-1.5 rounded-lg text-brand-bg bg-brand-accent" onclick={() => ytPlayer.togglePlay()}>
														{#if ytPlayer.isPlaying}<Pause class="w-4 h-4" fill="currentColor" />{:else}<Play class="w-4 h-4" fill="currentColor" />{/if}
													</button>
													<button class="p-1.5 rounded-lg text-brand-text hover:text-brand-accent bg-brand-surface border border-brand-divider" onclick={() => ytPlayer.next()}><SkipForward class="w-3.5 h-3.5" /></button>
													
													<div class="flex items-center gap-1.5 ml-2">
														<Volume2 class="w-3.5 h-3.5 text-brand-text-muted" />
														<input type="range" min="0" max="100" value={ytPlayer.volume} oninput={(e) => ytPlayer.setVolume(Number(e.currentTarget.value))} class="w-16 accent-brand-accent h-1 bg-brand-divider rounded-lg appearance-none" />
													</div>
												{:else}
													<button class="p-2 rounded-lg text-brand-text bg-brand-surface border border-brand-divider hover:text-brand-accent transition-colors" onclick={() => ytPlayer.playTrack(viewingPlaylistId!, i)}>
														<Play class="w-4 h-4" fill="currentColor" />
													</button>
													<button class="p-2 rounded-lg text-brand-text-muted hover:text-brand-accent transition-colors" onclick={() => { editTrackIndex = i; editTrackTitle = track.title; }}>
														<Settings2 class="w-4 h-4" />
													</button>
													<button class="p-2 rounded-lg text-brand-text-muted hover:text-red-400 transition-colors" onclick={() => ytPlayer.removeTrack(viewingPlaylistId!, i)}>
														<Trash2 class="w-4 h-4" />
													</button>
												{/if}
											</div>
										</div>
									{/each}
								{:else}
									<div class="text-xs text-brand-text-muted italic bg-[#070b0e] px-3 py-4 text-center rounded-lg border border-brand-divider">
										Agrega un enlace de YouTube para empezar tu lista de reproducción.
									</div>
								{/if}
							</div>
						{/if}
					{/if}
				{/if}
			</div>
			
			<div id="youtube-player-container" class="hidden"></div>
			
			<audio bind:this={audioRain} loop src="https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg" crossorigin="anonymous"></audio>
			<audio bind:this={audioBrown} loop src="https://upload.wikimedia.org/wikipedia/commons/4/47/Wind_in_forest_%28Gravity_Sound%29.wav" crossorigin="anonymous"></audio>
			<audio bind:this={audioFire} loop src="https://actions.google.com/sounds/v1/ambiences/fire.ogg" crossorigin="anonymous"></audio>
		</div>

		<!-- Right Column: Metrics & Environment -->
		<div class="lg:col-span-4 flex flex-col gap-6">
			
			<!-- Métricas de Hoy -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="flex items-center gap-2 text-xs font-bold text-brand-text tracking-wide"><Activity class="w-4 h-4 text-brand-accent" /> MÉTRICAS DE HOY</h3>
					<span class="text-[9px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-md border border-brand-accent/20">Semana 37</span>
				</div>
				
				<div class="bg-[#070b0e] border border-brand-divider rounded-xl p-4 flex flex-col justify-center items-center text-center shadow-inner mb-6">
					<Target class="w-5 h-5 text-brand-accent mb-2" />
					<p class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1">Sesiones Completadas Hoy</p>
					<p class="text-3xl font-black text-brand-text">{pomodoro.sessions}</p>
				</div>

				<div>
					<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider mb-3">Tareas con Foco</p>
					{#if pomodoro.completedTasks.length > 0}
						<div class="space-y-2">
							{#each pomodoro.completedTasks as ct}
								<div class="flex items-center justify-between text-[11px] bg-[#070b0e] px-3 py-2 rounded-lg border border-brand-divider">
									<div class="flex items-center gap-2">
										<span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>
										<span class="font-semibold text-brand-text truncate">{ct.title}</span>
									</div>
									<span class="text-brand-text-muted font-bold">{ct.duration}m</span>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-xs text-brand-text-muted italic bg-[#070b0e] px-3 py-4 text-center rounded-lg border border-brand-divider">
							No has anclado ninguna tarea a tus sesiones aún.
						</div>
					{/if}
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
					
					<!-- Bosque -->
					<div class="flex flex-col gap-2 pt-2 border-t border-brand-divider/50">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg bg-[#070b0e] border border-brand-divider flex items-center justify-center text-green-500"><Wind class="w-4 h-4" /></div>
								<div>
									<p class="text-xs font-bold text-brand-text">Bosque Matutino</p>
									<p class="text-[9px] text-brand-text-muted">Pájaros y naturaleza</p>
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
									<p class="text-xs font-bold text-brand-text">Hoguera Nocturna</p>
									<p class="text-[9px] text-brand-text-muted">Calidez reconfortante</p>
								</div>
							</div>
							<button class="w-6 h-6 rounded-md flex items-center justify-center border transition-colors {noiseFire ? 'bg-brand-accent border-brand-accent text-brand-bg shadow-[0_0_5px_var(--color-brand-accent-muted)]' : 'bg-brand-surface border-brand-divider text-brand-text-muted'}" onclick={() => noiseFire=!noiseFire}>
								{#if noiseFire}<Check class="w-3.5 h-3.5" strokeWidth={3} />{/if}
							</button>
						</div>
						{#if noiseFire}
							<input type="range" min="0" max="100" bind:value={volFire} class="w-full accent-brand-accent h-1 bg-[#070b0e] border border-brand-divider rounded-lg appearance-none" />
						{/if}
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
