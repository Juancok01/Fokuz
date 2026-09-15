<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import flatpickr from 'flatpickr';
	import 'flatpickr/dist/themes/dark.css';

	let { value = $bindable(), placeholder = 'Seleccionar fecha...' } = $props();

	let inputElement: HTMLInputElement;
	let fpInstance: any;

	onMount(() => {
		fpInstance = flatpickr(inputElement, {
			enableTime: true,
			dateFormat: 'Y-m-d\\TH:i',
			altInput: true,
			altFormat: 'Y-m-d H:i',
			defaultDate: value || null,
			disableMobile: true,
			onChange: (selectedDates, dateStr) => {
				value = dateStr;
			}
		});
	});

	$effect(() => {
		if (fpInstance && value) {
			if (fpInstance.input.value !== value) {
				fpInstance.setDate(value, false);
			}
		}
	});

	onDestroy(() => {
		if (fpInstance) fpInstance.destroy();
	});
</script>

<input
	bind:this={inputElement}
	type="text"
	{placeholder}
	class="bg-transparent text-xs font-bold text-brand-text w-full outline-none"
/>

<style>
	/* Redefinimos los estilos oscuros de flatpickr para igualar a Fokuz */
	:global(.flatpickr-calendar) {
		background: #0d1216 !important;
		border: 1px solid #1a232b !important;
		box-shadow: 0 10px 25px rgba(0,0,0,0.8) !important;
	}
	:global(.flatpickr-day.selected),
	:global(.flatpickr-day.startRange),
	:global(.flatpickr-day.endRange),
	:global(.flatpickr-day.selected.inRange),
	:global(.flatpickr-day.startRange.inRange),
	:global(.flatpickr-day.endRange.inRange),
	:global(.flatpickr-day.selected:focus),
	:global(.flatpickr-day.startRange:focus),
	:global(.flatpickr-day.endRange:focus),
	:global(.flatpickr-day.selected:hover),
	:global(.flatpickr-day.startRange:hover),
	:global(.flatpickr-day.endRange:hover),
	:global(.flatpickr-day.selected.prevMonthDay),
	:global(.flatpickr-day.startRange.prevMonthDay),
	:global(.flatpickr-day.endRange.prevMonthDay),
	:global(.flatpickr-day.selected.nextMonthDay),
	:global(.flatpickr-day.startRange.nextMonthDay),
	:global(.flatpickr-day.endRange.nextMonthDay) {
		background: var(--color-brand-accent, #00d282) !important;
		border-color: var(--color-brand-accent, #00d282) !important;
		color: #070b0e !important;
		font-weight: bold !important;
	}
	:global(.flatpickr-months .flatpickr-month) {
		background: #070b0e !important;
		color: #e2e8f0 !important;
		fill: #e2e8f0 !important;
	}
	:global(.flatpickr-current-month .flatpickr-monthDropdown-months) {
		background: #070b0e !important;
	}
	:global(.flatpickr-weekdays) {
		background: #070b0e !important;
	}
	:global(span.flatpickr-weekday) {
		background: #070b0e !important;
		color: #94a3b8 !important;
	}
	:global(.flatpickr-time) {
		border-top: 1px solid #1a232b !important;
	}
	:global(.flatpickr-time input),
	:global(.flatpickr-time .flatpickr-time-separator),
	:global(.flatpickr-time .flatpickr-am-pm) {
		color: #e2e8f0 !important;
	}
	:global(.flatpickr-time input:hover),
	:global(.flatpickr-time .flatpickr-am-pm:hover) {
		background: #1a232b !important;
	}
</style>
