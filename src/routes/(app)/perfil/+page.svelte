<script lang="ts">
	import { User, LogOut, Check, Pencil, X, UserPlus, Trash2, MoreVertical } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	type Contact = {
		id: string;
		email: string;
		display_name: string;
		nickname: string;
		contact_row_id?: number;
	};

	let displayName = $state('');
	let editName = $state('');
	let email = $state('');
	let userId = $state<string | null>(null);
	let showEditProfile = $state(false);
	let showConnectContact = $state(false);
	let showEditContact = $state(false);
	let selectedContact = $state<Contact | null>(null);
	let contactNickname = $state('');
	let contactEmail = $state('');
	let contacts = $state<Contact[]>([]);
	let saving = $state(false);
	let savingContact = $state(false);
	let connecting = $state(false);
	let saved = $state(false);
	let contactSaved = $state(false);
	let loading = $state(true);
	let errorMsg = $state('');
	let contactError = $state('');
	let contactSuccess = $state('');
	let editContactError = $state('');
	let contactsLoadError = $state('');

	const contactLabel = (contact: Contact) =>
		(contact.nickname || '').trim() || contact.display_name;

	const emailDefaultName = $derived(email ? email.split('@')[0] : '');
	const shownName = $derived(displayName || emailDefaultName || 'tú');

	const contactErrorMessage = (code: string) => {
		switch (code) {
			case 'not_found':
				return 'Ese correo no está registrado en Fokuz.';
			case 'self':
				return 'No puedes agregarte a ti mismo.';
			case 'invalid_email':
				return 'Ingresa un correo válido.';
			case 'not_authenticated':
				return 'Debes iniciar sesión.';
			default:
				return 'No se pudo agregar el contacto.';
		}
	};

	const parseRpcPayload = (data: unknown) => {
		if (typeof data === 'string') {
			try {
				return JSON.parse(data);
			} catch {
				return null;
			}
		}
		return data as Record<string, any> | null;
	};

	const loadContacts = async () => {
		if (!supabase) {
			contacts = [];
			return;
		}

		contactsLoadError = '';

		// Carga en 2 pasos (más estable que el join embebido)
		let rowsResult = await supabase
			.from('contacts')
			.select('id, nickname, contact_user_id')
			.order('created_at', { ascending: false });

		// Si aún no existe la columna nickname, reintentar sin ella
		if (rowsResult.error && /nickname/i.test(rowsResult.error.message)) {
			rowsResult = await supabase
				.from('contacts')
				.select('id, contact_user_id')
				.order('created_at', { ascending: false });
		}

		if (rowsResult.error) {
			console.warn('Error al cargar contactos:', rowsResult.error.message);
			contactsLoadError = rowsResult.error.message;
			contacts = [];
			return;
		}

		const rows = rowsResult.data ?? [];
		if (rows.length === 0) {
			contacts = [];
			return;
		}

		const ids = rows.map((row) => row.contact_user_id);
		const { data: profiles, error: profilesError } = await supabase
			.from('profiles')
			.select('id, email, display_name')
			.in('id', ids);

		if (profilesError) {
			console.warn('Error al cargar perfiles de contactos:', profilesError.message);
			contactsLoadError = profilesError.message;
		}

		const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

		contacts = rows.map((row) => {
			const profile = profileMap.get(row.contact_user_id);
			const fallbackEmail = 'Contacto';
			const emailValue = profile?.email ?? fallbackEmail;
			return {
				contact_row_id: row.id,
				id: row.contact_user_id,
				email: emailValue,
				nickname: ((row as any).nickname || '').trim(),
				display_name:
					(profile?.display_name || '').trim() ||
					(profile?.email ? profile.email.split('@')[0] : 'Contacto')
			} as Contact;
		});
	};

	const ensureProfile = async () => {
		if (!supabase) return;
		const { error } = await supabase.rpc('ensure_my_profile');
		if (error) console.warn('No se pudo sincronizar perfil:', error.message);
	};

	const loadProfile = async () => {
		loading = true;
		errorMsg = '';

		if (!supabase) {
			loading = false;
			return;
		}

		const {
			data: { session }
		} = await supabase.auth.getSession();

		const meta = session?.user?.user_metadata ?? {};
		const savedName =
			(typeof meta.display_name === 'string' && meta.display_name.trim()) ||
			(typeof meta.alias === 'string' && meta.alias.trim()) ||
			'';

		displayName = savedName;
		email = session?.user?.email ?? '';
		userId = session?.user?.id ?? null;

		await ensureProfile();
		await loadContacts();
		loading = false;
	};

	const openEditProfile = () => {
		editName = displayName || emailDefaultName;
		saved = false;
		errorMsg = '';
		showEditProfile = true;
	};

	const closeEditProfile = () => {
		showEditProfile = false;
		errorMsg = '';
		saved = false;
	};

	const openConnectContact = () => {
		contactEmail = '';
		contactError = '';
		contactSuccess = '';
		showConnectContact = true;
	};

	const closeConnectContact = () => {
		showConnectContact = false;
		contactError = '';
		contactSuccess = '';
	};

	const saveProfile = async () => {
		if (!supabase || !userId) return;

		const value = editName.trim();
		saving = true;
		saved = false;
		errorMsg = '';

		const { error } = await supabase.auth.updateUser({
			data: {
				display_name: value,
				alias: value
			}
		});

		if (error) {
			saving = false;
			errorMsg = error.message;
			return;
		}

		const { error: profileError } = await supabase.from('profiles').upsert({
			id: userId,
			email,
			display_name: value || emailDefaultName,
			updated_at: new Date().toISOString()
		});

		saving = false;

		if (profileError) {
			errorMsg = profileError.message;
			return;
		}

		displayName = value;
		saved = true;
		setTimeout(() => {
			closeEditProfile();
		}, 800);
	};

	const connectContact = async () => {
		if (!supabase) return;

		const emailValue = contactEmail.trim();
		if (!emailValue) {
			contactError = 'Ingresa un correo.';
			return;
		}

		connecting = true;
		contactError = '';
		contactSuccess = '';

		try {
			const { data, error } = await supabase.rpc('add_contact_by_email', {
				contact_email: emailValue
			});

			if (error) {
				contactError = error.message;
				return;
			}

			const payload = parseRpcPayload(data);
			if (!payload) {
				contactError = 'Respuesta inválida del servidor.';
				return;
			}

			if (!payload.ok) {
				contactError = contactErrorMessage(payload.error ?? 'unknown');
				return;
			}

			const name =
				payload.contact?.display_name ||
				payload.contact?.email?.split?.('@')?.[0] ||
				'Contacto';

			contactSuccess = `${name} fue agregado a tus contactos.`;
			contactEmail = '';
			await loadContacts();
			setTimeout(() => {
				closeConnectContact();
			}, 1200);
		} catch (err) {
			contactError = err instanceof Error ? err.message : 'Error inesperado al conectar.';
		} finally {
			connecting = false;
		}
	};

	const openEditContact = (contact: Contact) => {
		selectedContact = contact;
		contactNickname = contact.nickname || contact.display_name;
		contactSaved = false;
		editContactError = '';
		showEditContact = true;
	};

	const closeEditContact = () => {
		showEditContact = false;
		selectedContact = null;
		contactNickname = '';
		contactSaved = false;
		editContactError = '';
	};

	const saveContactNickname = async () => {
		if (!supabase || !selectedContact?.contact_row_id) return;

		const value = contactNickname.trim();
		savingContact = true;
		contactSaved = false;
		editContactError = '';

		const { error } = await supabase
			.from('contacts')
			.update({ nickname: value || null })
			.eq('id', selectedContact.contact_row_id);

		savingContact = false;

		if (error) {
			editContactError = /nickname/i.test(error.message)
				? 'Falta crear la columna nickname en Supabase. Ejecuta el SQL de contactos y vuelve a intentar.'
				: error.message;
			return;
		}

		contacts = contacts.map((c) =>
			c.id === selectedContact?.id ? { ...c, nickname: value } : c
		);
		contactSaved = true;
		setTimeout(() => {
			closeEditContact();
		}, 800);
	};

	const removeContact = async (contact: Contact) => {
		if (!supabase || !contact.contact_row_id) return;
		if (!confirm(`¿Eliminar a ${contactLabel(contact)} de tus contactos?`)) return;

		const { error } = await supabase.from('contacts').delete().eq('id', contact.contact_row_id);
		if (error) {
			alert('Error al eliminar contacto: ' + error.message);
			return;
		}

		contacts = contacts.filter((c) => c.id !== contact.id);
		if (selectedContact?.id === contact.id) closeEditContact();
	};

	onMount(() => {
		loadProfile();
	});
</script>

<svelte:head>
	<title>Perfil · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<User class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Perfil</h1>
	</div>
</header>

<div class="flex-1 px-6 py-8 space-y-6 pb-28 overflow-y-auto">
	{#if loading}
		<div class="bg-brand-surface border border-brand-divider rounded-2xl p-5 space-y-4">
			<div class="h-4 w-28 rounded bg-brand-surface-elevated skeleton"></div>
			<div class="h-12 w-full rounded-xl bg-brand-surface-elevated skeleton"></div>
		</div>
	{:else}
		<div class="bg-brand-surface border border-brand-divider rounded-2xl p-5">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 rounded-full bg-brand-accent/20 flex items-center justify-center shrink-0">
					<User class="w-6 h-6 text-brand-accent" />
				</div>
				<div class="min-w-0">
					<p class="font-semibold text-brand-text truncate">{shownName}</p>
					<p class="text-sm text-brand-text-muted truncate">{email || 'Tu cuenta en Fokuz'}</p>
				</div>
			</div>
		</div>

		<button
			onclick={openEditProfile}
			class="w-full flex items-center justify-center gap-2 bg-brand-accent text-brand-bg px-6 py-4 rounded-xl font-bold hover:brightness-105 transition-colors"
		>
			<Pencil class="w-5 h-5" />
			Editar perfil
		</button>

		<button
			onclick={openConnectContact}
			class="w-full flex items-center justify-center gap-2 bg-brand-surface border border-brand-divider text-brand-text px-6 py-4 rounded-xl font-medium hover:bg-brand-surface-elevated transition-colors"
		>
			<UserPlus class="w-5 h-5 text-brand-accent" />
			Conectar con contactos
		</button>

		<div class="space-y-3">
			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">
				Mis contactos
			</p>
			{#if contactsLoadError}
				<p class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
					No se pudieron cargar los contactos: {contactsLoadError}
				</p>
			{:else if contacts.length === 0}
				<p class="text-sm text-brand-text-muted bg-brand-surface border border-brand-divider rounded-2xl p-4">
					Aún no tienes contactos. Agrégalos con su correo de Fokuz para luego compartir tareas.
				</p>
			{:else}
				{#each contacts as contact (contact.id)}
					<div class="flex items-center justify-between gap-3 bg-brand-surface border border-brand-divider rounded-2xl px-4 py-3">
						<div class="min-w-0">
							<p class="font-medium text-brand-text truncate">{contactLabel(contact)}</p>
							<p class="text-sm text-brand-text-muted truncate">{contact.email}</p>
						</div>
						<button
							class="p-2 text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated rounded-lg transition-colors shrink-0"
							onclick={() => openEditContact(contact)}
							aria-label="Opciones de {contactLabel(contact)}"
						>
							<MoreVertical class="w-5 h-5" />
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<button
		onclick={() => supabase?.auth.signOut()}
		class="w-full flex items-center justify-center gap-2 bg-brand-surface border border-brand-divider text-brand-text px-6 py-4 rounded-xl font-medium hover:bg-brand-surface-elevated transition-colors"
	>
		<LogOut class="w-5 h-5 text-red-400" />
		Cerrar sesión
	</button>
</div>

{#if showEditProfile}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
		onclick={closeEditProfile}
	></div>

	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 shadow-2xl border-t border-brand-divider">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Editar perfil</h3>
			<button
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
				onclick={closeEditProfile}
				aria-label="Cerrar"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<label for="display-name" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Nombre
		</label>
		<p class="text-sm text-brand-text-muted mb-3">
			¿Cómo te gustaría que te llamáramos?
		</p>
		<input
			id="display-name"
			type="text"
			bind:value={editName}
			placeholder={emailDefaultName || 'Tu nombre'}
			maxlength={24}
			class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-6"
		/>

		<button
			onclick={saveProfile}
			disabled={saving}
			class="w-full bg-brand-accent hover:brightness-105 disabled:opacity-60 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
		>
			{#if saved}
				<Check class="w-5 h-5" />
				Guardado
			{:else}
				{saving ? 'Guardando...' : 'Guardar nombre'}
			{/if}
		</button>

		{#if errorMsg}
			<p class="text-sm text-red-400 mt-3">{errorMsg}</p>
		{/if}
	</div>
{/if}

{#if showConnectContact}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
		onclick={closeConnectContact}
	></div>

	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 shadow-2xl border-t border-brand-divider">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Conectar con contactos</h3>
			<button
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
				onclick={closeConnectContact}
				aria-label="Cerrar"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<label for="contact-email" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Correo del contacto
		</label>
		<p class="text-sm text-brand-text-muted mb-3">
			Debe ser un correo ya registrado en Fokuz.
		</p>
		<input
			id="contact-email"
			type="email"
			bind:value={contactEmail}
			placeholder="ana@correo.com"
			class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-6"
		/>

		<button
			onclick={connectContact}
			disabled={connecting || !contactEmail.trim()}
			class="w-full bg-brand-accent hover:brightness-105 disabled:opacity-60 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
		>
			<UserPlus class="w-5 h-5" />
			{connecting ? 'Conectando...' : 'Agregar contacto'}
		</button>

		{#if contactError}
			<p class="text-sm text-red-400 mt-3">{contactError}</p>
		{/if}
		{#if contactSuccess}
			<p class="text-sm text-brand-accent mt-3">{contactSuccess}</p>
		{/if}
	</div>
{/if}

{#if showEditContact && selectedContact}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
		onclick={closeEditContact}
	></div>

	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 shadow-2xl border-t border-brand-divider">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Editar contacto</h3>
			<button
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
				onclick={closeEditContact}
				aria-label="Cerrar"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<p class="text-sm text-brand-text-muted mb-4 truncate">{selectedContact.email}</p>

		<label for="contact-nickname" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Nombre
		</label>
		<p class="text-sm text-brand-text-muted mb-3">
			Así verás a este contacto en Fokuz.
		</p>
		<input
			id="contact-nickname"
			type="text"
			bind:value={contactNickname}
			placeholder={selectedContact.display_name}
			maxlength={24}
			class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-6"
		/>

		<button
			onclick={saveContactNickname}
			disabled={savingContact}
			class="w-full bg-brand-accent hover:brightness-105 disabled:opacity-60 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors mb-4"
		>
			{#if contactSaved}
				<Check class="w-5 h-5" />
				Guardado
			{:else}
				{savingContact ? 'Guardando...' : 'Guardar nombre'}
			{/if}
		</button>

		<button
			onclick={() => selectedContact && removeContact(selectedContact)}
			class="w-full py-3.5 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25 transition-colors"
		>
			<Trash2 class="w-4 h-4" />
			Eliminar contacto
		</button>

		{#if editContactError}
			<p class="text-sm text-red-400 mt-3">{editContactError}</p>
		{/if}
	</div>
{/if}
