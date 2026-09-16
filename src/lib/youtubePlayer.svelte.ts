import { browser } from '$app/environment';

export type PlaylistItem = {
	id: string; // YouTube video ID
	title: string;
};

export type Playlist = {
	id: string;
	name: string;
	tracks: PlaylistItem[];
};

// Global types for YT API
declare global {
	interface Window {
		onYouTubeIframeAPIReady: () => void;
		YT: any;
	}
}

class YouTubePlayer {
	playlists = $state<Playlist[]>([]);
	currentPlaylistId = $state<string | null>(null);
	currentTrackIndex = $state<number>(0);
	isPlaying = $state<boolean>(false);
	volume = $state<number>(50);
	isReady = $state<boolean>(false);
	
	private player: any = null;
	private containerId: string = 'youtube-player-container';

	constructor() {
		if (browser) {
			this.loadPlaylists();
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
		const activePlaylist = this.getActivePlaylist();
		const videoId = activePlaylist && activePlaylist.tracks.length > 0 ? activePlaylist.tracks[this.currentTrackIndex].id : '';
		
		this.player = new window.YT.Player(this.containerId, {
			height: '0',
			width: '0',
			videoId: videoId,
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

	// === PLAYLIST MANAGEMENT ===

	createPlaylist(name: string) {
		const newPlaylist: Playlist = {
			id: crypto.randomUUID(),
			name,
			tracks: []
		};
		this.playlists.push(newPlaylist);
		this.savePlaylists();
		return newPlaylist.id;
	}

	updatePlaylistName(id: string, name: string) {
		const p = this.playlists.find(p => p.id === id);
		if (p) {
			p.name = name;
			this.savePlaylists();
		}
	}

	deletePlaylist(id: string) {
		this.playlists = this.playlists.filter(p => p.id !== id);
		if (this.currentPlaylistId === id) {
			this.currentPlaylistId = null;
			this.currentTrackIndex = 0;
			if (this.isReady && this.player) {
				this.player.stopVideo();
				this.isPlaying = false;
			}
		}
		this.savePlaylists();
	}

	getPlaylist(id: string | null): Playlist | undefined {
		if (!id) return undefined;
		return this.playlists.find(p => p.id === id);
	}

	getActivePlaylist(): Playlist | undefined {
		return this.getPlaylist(this.currentPlaylistId);
	}

	// === TRACK MANAGEMENT ===

	async addTrack(playlistId: string, url: string) {
		const playlist = this.getPlaylist(playlistId);
		if (!playlist) return false;

		const id = this.extractVideoId(url);
		if (!id) return false;
		
		let title = `Canción ${playlist.tracks.length + 1}`;
		try {
			const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
			if (res.ok) {
				const data = await res.json();
				if (data.title) title = data.title;
			}
		} catch (e) {
			// fallback
		}

		playlist.tracks.push({ id, title });
		this.savePlaylists();
		
		// If it's the active playlist and it was empty, cue it
		if (this.currentPlaylistId === playlistId && playlist.tracks.length === 1 && this.isReady && this.player) {
			this.player.cueVideoById(id);
		}
		return true;
	}
	
	updateTrackTitle(playlistId: string, index: number, newTitle: string) {
		const playlist = this.getPlaylist(playlistId);
		if (playlist && index >= 0 && index < playlist.tracks.length) {
			playlist.tracks[index].title = newTitle;
			this.savePlaylists();
		}
	}

	removeTrack(playlistId: string, index: number) {
		const playlist = this.getPlaylist(playlistId);
		if (!playlist) return;

		playlist.tracks.splice(index, 1);
		
		if (this.currentPlaylistId === playlistId) {
			if (this.currentTrackIndex >= playlist.tracks.length) {
				this.currentTrackIndex = Math.max(0, playlist.tracks.length - 1);
			}
			
			if (playlist.tracks.length === 0 && this.isReady && this.player) {
				this.player.stopVideo();
				this.isPlaying = false;
			} else if (this.isReady && this.player) {
				this.player.cueVideoById(playlist.tracks[this.currentTrackIndex].id);
				this.isPlaying = false;
			}
		}
		this.savePlaylists();
	}

	// === PLAYBACK CONTROLS ===

	play() {
		if (this.isReady && this.player && this.currentPlaylistId) {
			const p = this.getActivePlaylist();
			if (p && p.tracks.length > 0) {
				this.player.playVideo();
			}
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
		const p = this.getActivePlaylist();
		if (!p || p.tracks.length === 0) return;
		this.currentTrackIndex = (this.currentTrackIndex + 1) % p.tracks.length;
		this.playTrack(this.currentPlaylistId!, this.currentTrackIndex);
	}

	playTrack(playlistId: string, index: number) {
		const playlist = this.getPlaylist(playlistId);
		if (!playlist || index < 0 || index >= playlist.tracks.length) return;
		
		this.currentPlaylistId = playlistId;
		this.currentTrackIndex = index;
		
		if (this.isReady && this.player) {
			this.player.loadVideoById(playlist.tracks[this.currentTrackIndex].id);
		}
	}

	setVolume(vol: number) {
		this.volume = vol;
		if (this.isReady && this.player) {
			this.player.setVolume(vol);
		}
	}

	// === UTILS ===

	private extractVideoId(url: string): string | null {
		const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
		const match = url.match(regExp);
		return (match && match[2].length === 11) ? match[2] : null;
	}

	private savePlaylists() {
		if (browser) {
			localStorage.setItem('fokuz_youtube_playlists_v2', JSON.stringify(this.playlists));
		}
	}

	private loadPlaylists() {
		const v2 = localStorage.getItem('fokuz_youtube_playlists_v2');
		if (v2) {
			try {
				this.playlists = JSON.parse(v2);
				return;
			} catch {
				this.playlists = [];
			}
		}
		
		// Migration from v1
		const v1 = localStorage.getItem('fokuz_youtube_playlist');
		if (v1) {
			try {
				const oldPlaylist = JSON.parse(v1);
				if (Array.isArray(oldPlaylist) && oldPlaylist.length > 0) {
					this.playlists = [{
						id: crypto.randomUUID(),
						name: 'Mi Primera Playlist',
						tracks: oldPlaylist
					}];
					this.savePlaylists();
					return;
				}
			} catch {}
		}
		
		this.playlists = [];
	}
}

export const ytPlayer = new YouTubePlayer();
