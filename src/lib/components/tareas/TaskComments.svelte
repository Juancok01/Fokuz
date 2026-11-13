<script lang="ts">
	import type { Contact } from "./types";
	import { AtSign, MessageSquare, Paperclip } from "@lucide/svelte";
	import { supabase } from "$lib/supabaseClient";

	// Comentarios de una tarea: los carga al abrirla y publica los nuevos.
	let {
		taskId,
		contacts
	}: {
		taskId: number | null | undefined;
		contacts: Contact[];
	} = $props();

	let taskComments = $state<any[]>([]);
	let newCommentText = $state("");

	$effect(() => {
		const id = taskId;
		newCommentText = "";
		if (id) loadTaskComments(id);
		else taskComments = [];
	});

	const loadTaskComments = async (taskId: number) => {
		taskComments = [];
		if (!supabase) return;

		const { data, error } = await supabase
			.from("task_comments")
			.select("*")
			.eq("task_id", taskId)
			.order("created_at", { ascending: true });

		if (error) {
			console.warn("Error al cargar comentarios:", error.message);
		} else {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const me = session?.user;

			taskComments = (data ?? []).map((comment) => {
				let userData = {
					email: "Usuario",
					raw_user_meta_data: { name: "Usuario" },
				};
				if (me && me.id === comment.user_id) {
					userData = {
						email: me.email || "Usuario",
						raw_user_meta_data: {
							name: (me.user_metadata as any)?.name || "Usuario",
						},
					};
				} else {
					const contact = contacts.find(
						(c) => c.id === comment.user_id,
					);
					if (contact) {
						userData = {
							email: contact.email,
							raw_user_meta_data: {
								name: contact.display_name || contact.nickname,
							},
						};
					}
				}
				return { ...comment, user: userData };
			});
		}
	};

	const addTaskComment = async () => {
		if (!newCommentText.trim() || !taskId || !supabase) return;
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		const { data, error } = await supabase
			.from("task_comments")
			.insert({
				task_id: taskId,
				user_id: session.user.id,
				content: newCommentText.trim(),
			})
			.select("*")
			.single();

		if (data) {
			const newComment = {
				...data,
				user: {
					email: session.user.email,
					raw_user_meta_data: session.user.user_metadata,
				},
			};
			taskComments = [...taskComments, newComment];
			newCommentText = "";
		} else if (error) {
			console.error("Error al añadir comentario:", error.message);
			alert("Error al añadir comentario: " + error.message);
		}
	};
</script>

<div class="mt-8 pt-6 border-t border-brand-divider">
	<div class="flex items-center justify-between mb-4">
		<h3
			class="text-sm font-bold text-brand-text flex items-center gap-2"
		>
			<MessageSquare
				class="w-4 h-4 text-brand-accent"
			/> Actividad & Comentarios
		</h3>
		<span class="text-xs text-brand-text-muted"
			>{taskComments.length}
			{taskComments.length === 1 ? "comentario" : "comentarios"}</span
		>
	</div>

	<div class="flex gap-3 mb-6">
		<div
			class="w-8 h-8 rounded-full bg-brand-accent/20 border border-brand-accent/30 text-brand-accent flex items-center justify-center font-bold text-xs shrink-0"
		>
			TÚ
		</div>
		<div
			class="flex-1 bg-[#0d1216] border border-brand-divider rounded-xl overflow-hidden focus-within:border-brand-accent transition-colors relative"
		>
			<textarea
				bind:value={newCommentText}
				placeholder="Escribe un comentario..."
				class="w-full bg-transparent text-sm text-brand-text placeholder-brand-text-muted focus:outline-none p-3 min-h-20 resize-none"
			></textarea>
			<div
				class="flex items-center justify-between px-3 pb-3"
			>
				<div class="flex gap-2">
					<button
						class="text-brand-text-muted hover:text-brand-text transition-colors"
						><AtSign class="w-4 h-4" /></button
					>
					<button
						class="text-brand-text-muted hover:text-brand-text transition-colors"
						><Paperclip
							class="w-4 h-4"
						/></button
					>
				</div>
				<button
					onclick={addTaskComment}
					disabled={!newCommentText.trim()}
					class="px-4 py-1.5 bg-brand-accent hover:bg-brand-accent/90 text-[#0d1216] text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
				>
					Comentar
				</button>
			</div>
		</div>
	</div>

	<div class="space-y-4">
		{#each taskComments as comment}
			<div class="flex gap-3">
				<div
					class="w-8 h-8 rounded-full bg-brand-surface-elevated border border-brand-divider text-brand-text-muted flex items-center justify-center font-bold text-xs shrink-0 uppercase"
				>
					{comment.user?.raw_user_meta_data?.name?.slice(
						0,
						2,
					) ||
						comment.user?.email?.slice(0, 2) ||
						"??"}
				</div>
				<div
					class="flex-1 bg-[#0d1216] border border-brand-divider rounded-xl p-3"
				>
					<div
						class="flex items-center justify-between mb-2"
					>
						<div
							class="flex items-center gap-2 text-xs"
						>
							<span
								class="font-bold text-brand-text"
								>{comment.user
									?.raw_user_meta_data
									?.name ||
									comment.user?.email ||
									"Usuario"}</span
							>
							<span
								class="text-brand-text-muted"
								>• {new Date(
									comment.created_at,
								).toLocaleDateString()}
								{new Date(
									comment.created_at,
								).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}</span
							>
						</div>
					</div>
					<p class="text-sm text-brand-text">
						{comment.content}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
