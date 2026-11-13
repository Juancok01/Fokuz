<script lang="ts">
	import { AlertCircle, Calendar } from "@lucide/svelte";
	import DateTimePicker from "$lib/components/DateTimePicker.svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		editingDate = $bindable(),
		editingEndDate = $bindable()
	}: {
		editingDate: string;
		editingEndDate: string;
	} = $props();
</script>

<div
	class="rounded-xl border border-brand-divider bg-[#0d1216] p-5"
>
	<h4
		class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2 mb-4"
	>
		<Calendar class="w-4 h-4 text-brand-accent" /> Fechas
		& Horario
	</h4>
	<div class="space-y-3">
		<div>
			<span
				class="block text-[10px] font-semibold text-brand-text-muted mb-1.5"
				>Fecha de Inicio</span
			>
			<div
				class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 cursor-pointer"
			>
				<DateTimePicker
					bind:value={editingDate}
					placeholder="Seleccionar inicio..."
				/>
				<Calendar
					class="w-3.5 h-3.5 text-brand-text-muted shrink-0 ml-2"
				/>
			</div>
		</div>
		<div>
			<span
				class="block text-[10px] font-semibold text-brand-text-muted mb-1.5 justify-between"
				>Fecha de Vencimiento</span
			>
			<div
				class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 cursor-pointer"
			>
				<DateTimePicker
					bind:value={editingEndDate}
					placeholder="Seleccionar fin..."
				/>
				<Calendar
					class="w-3.5 h-3.5 text-brand-text-muted shrink-0 ml-2"
				/>
			</div>
		</div>
		<button
			class="flex items-center gap-2 text-[10px] font-bold text-brand-accent hover:underline mt-2"
		>
			<AlertCircle class="w-3.5 h-3.5" /> Recordatorio:
			15 min antes
		</button>
	</div>
</div>
