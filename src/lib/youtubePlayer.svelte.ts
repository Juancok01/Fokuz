import { browser } from '$app/environment';

export type PlaylistItem = {
	id: string; // YouTube video ID
	title: string;
};

// Global types for YT API
declare global {
	interface Window {
		onYouTubeIframeAPIReady: () => void;
		YT: any;
	}
}

class YouTubePlayer {
	playlist = $state<PlaylistItem[]>([]);
	currentTrackIndex = $state<number>(0);
	isPlaying = $state<boolean>(false);
	volume = $state<number>(50);
	isReady = $state<boolean>(false);
	
	private player: any = null;
	private containerId: string = 'youtube-player-container';

	constructor() {
		if (browser) {
			this.loadPlaylist();
		}
	}

	init(containerId: string) {
		if (!browser) return;
		this.containerId = containerId;
		
		if (window.YT && window.YT.Player) {
			this.createPlayer();
		} else {
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			const firstScriptTag = document.getElementsByTagName('script')[0];
			if (firstScriptTag && firstScriptTag.parentNode) {
				firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
			} else {
				document.head.appendChild(tag);
			}

			window.onYouTubeIframeAPIReady = () => {
				this.createPlayer();
			};
		}
	}

	private createPlayer() {
		this.player = new window.YT.Player(this.containerId, {
			height: '0',
			width: '0',
			videoId: this.playlist.length > 0 ? this.playlist[this.currentTrackIndex].id : '',
			playerVars: {
				autoplay: 0,
				controls: 0,
				disablekb: 1,
				fs: 0,
				modestbranding: 1,
				rel: 0,
				playsinline: 1
			},
			events: {
				onReady: (event: any) => {
					this.isReady = true;
					this.player.setVolume(this.volume);
				},
				onStateChange: (event: any) => {
					// YT.PlayerState.PLAYING === 1
					// YT.PlayerState.PAUSED === 2
					// YT.PlayerState.ENDED === 0
					if (event.data === 1) this.isPlaying = true;
					if (event.data === 2) this.isPlaying = false;
					if (event.data === 0) this.next(); // Auto-play next song
				}
			}
		});
	}

	play() {
		if (this.isReady && this.player && this.playlist.length > 0) {
			this.player.playVideo();
		}
	}

	pause() {
		if (this.isReady && this.player) {
			this.player.pauseVideo();
		}
	}

	togglePlay() {
		if (this.isPlaying) this.pause();
		else this.play();
	}

	next() {
		if (this.playlist.length === 0) return;
		this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
		this.playTrack(this.currentTrackIndex);
	}

	playTrack(index: number) {
		if (index < 0 || index >= this.playlist.length) return;
		this.currentTrackIndex = index;
		if (this.isReady && this.player) {
			this.player.loadVideoById(this.playlist[this.currentTrackIndex].id);
		}
	}

	setVolume(vol: number) {
		this.volume = vol;
		if (this.isReady && this.player) {
			this.player.setVolume(vol);
		}
	}

	async addTrack(url: string) {
		const id = this.extractVideoId(url);
		if (!id) return false;
		
		let title = `Canción ${this.playlist.length + 1}`;
		try {
			// Utilizamos un servicio sin CORS para intentar obtener el título del video
			const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
			if (res.ok) {
				const data = await res.json();
				if (data.title) title = data.title;
			}
		} catch (e) {
			// Falla silenciosa, usamos el título genérico
		}

		this.playlist.push({ id, title });
		this.savePlaylist();
		
		if (this.playlist.length === 1 && this.isReady && this.player) {
			// Si es la primera canción, la cargamos pero no la reproducimos
			this.player.cueVideoById(id);
		}
		return true;
	}
	
	removeTrack(index: number) {
		this.playlist.splice(index, 1);
		if (this.currentTrackIndex >= this.playlist.length) {
			this.currentTrackIndex = Math.max(0, this.playlist.length - 1);
		}
		this.savePlaylist();
		if (this.playlist.length === 0 && this.isReady && this.player) {
			this.player.stopVideo();
			this.isPlaying = false;
		} else if (this.isReady && this.player) {
			// Cargar la pista actual por si borramos la que estaba sonando
			this.player.cueVideoById(this.playlist[this.currentTrackIndex].id);
			this.isPlaying = false;
		}
	}

	private extractVideoId(url: string): string | null {
		const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
		const match = url.match(regExp);
		return (match && match[2].length === 11) ? match[2] : null;
	}

	private savePlaylist() {
		if (browser) {
			localStorage.setItem('fokuz_youtube_playlist', JSON.stringify(this.playlist));
		}
	}

	private loadPlaylist() {
		const stored = localStorage.getItem('fokuz_youtube_playlist');
		if (stored) {
			try {
				this.playlist = JSON.parse(stored);
			} catch {
				this.playlist = [];
			}
		}
	}
}

export const ytPlayer = new YouTubePlayer();
