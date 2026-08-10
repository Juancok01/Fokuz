<script lang="ts">
	import {
		BookOpen,
		Brain,
		Coffee,
		Dumbbell,
		Droplets,
		Footprints,
		Heart,
		Leaf,
		Moon,
		Music,
		PenLine,
		Smartphone,
		Sparkles,
		Sun,
		Utensils
	} from 'lucide-svelte';
	import type { HabitIconId } from '$lib/habits';

	let {
		icon,
		class: className = 'w-4 h-4',
		strokeWidth = 2
	}: {
		icon: HabitIconId;
		class?: string;
		strokeWidth?: number;
	} = $props();

	const icons = {
		sparkles: Sparkles,
		droplets: Droplets,
		book: BookOpen,
		dumbbell: Dumbbell,
		brain: Brain,
		moon: Moon,
		sun: Sun,
		heart: Heart,
		leaf: Leaf,
		music: Music,
		coffee: Coffee,
		footprints: Footprints,
		pen: PenLine,
		smartphone: Smartphone,
		utensils: Utensils
	} as const;

	const Icon = $derived(icons[icon] ?? Sparkles);
</script>

<Icon class={className} {strokeWidth} />
