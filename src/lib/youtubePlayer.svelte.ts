import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';

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

	async createPlaylist(name: string) {
		const newPlaylist: Playlist = {
			id: crypto.randomUUID(),
			name,
			tracks: []
		};
		this.playlists.push(newPlaylist);
		
		if (supabase) {
			const { data: { session } } = await supabase.auth.getSession();
			if (session) {
				await supabase.from('youtube_playlists').insert({
					id: newPlaylist.id,
					user_id: session.user.id,
					name: newPlaylist.name,
					tracks: []
				});
			}
		}
		return newPlaylist.id;
	}

	async updatePlaylistName(id: string, name: string) {
		const p = this.playlists.find(p => p.id === id);
		if (p) {
			p.name = name;
			if (supabase) {
				await supabase.from('youtube_playlists').update({ name }).eq('id', id);
			}
		}
	}

	async deletePlaylist(id: string) {
		this.playlists = this.playlists.filter(p => p.id !== id);
		if (this.currentPlaylistId === id) {
			this.currentPlaylistId = null;
			this.currentTrackIndex = 0;
			if (this.isReady && this.player) {
				this.player.stopVideo();
				this.isPlaying = false;
			}
		}
		if (supabase) {
			await supabase.from('youtube_playlists').delete().eq('id', id);
		}
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
		this.savePlaylistTracks(playlistId);
		
		// If it's the active playlist and it was empty, cue it
		if (this.currentPlaylistId === playlistId && playlist.tracks.length === 1 && this.isReady && this.player) {
			this.player.cueVideoById(id);
		}
		return true;
	}
	
	async updateTrackTitle(playlistId: string, index: number, newTitle: string) {
		const playlist = this.getPlaylist(playlistId);
		if (playlist && index >= 0 && index < playlist.tracks.length) {
			playlist.tracks[index].title = newTitle;
			this.savePlaylistTracks(playlistId);
		}
	}

	async removeTrack(playlistId: string, index: number) {
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
		this.savePlaylistTracks(playlistId);
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

	private async savePlaylistTracks(playlistId: string) {
		if (!supabase) return;
		const p = this.getPlaylist(playlistId);
		if (p) {
			await supabase.from('youtube_playlists').update({ tracks: p.tracks }).eq('id', playlistId);
		}
	}

	private async loadPlaylists() {
		if (!browser || !supabase) return;
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) return;
		
		const { data, error } = await supabase
			.from('youtube_playlists')
			.select('id, name, tracks')
			.order('created_at', { ascending: true });
			
		if (!error && data) {
			this.playlists = data;
		}
	}
}

export const ytPlayer = new YouTubePlayer();
