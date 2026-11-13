/**
 * Notificación del sistema cuando termina una fase del Pomodoro.
 *
 * Solo se muestra si la pestaña de Fokuz no está a la vista (si está a la vista ya suena
 * la alarma de la app). Funciona en navegadores de escritorio; en celulares la API de
 * notificaciones exige un service worker, y ahí simplemente no se muestra nada.
 * Probado en pomodoroNotify.test.ts.
 */

type Phase = 'focus' | 'break';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Pide permiso una sola vez (solo si el usuario todavía no respondió). Llamar desde un clic. */
export function requestNotificationPermission(): void {
	if (!supported() || Notification.permission !== 'default') return;
	try {
		const p = Notification.requestPermission();
		if (p && typeof p.catch === 'function') p.catch(() => {});
	} catch {
		/* navegadores antiguos o contextos sin permiso */
	}
}

/** Texto de la notificación según la fase que acaba de terminar. */
export function phaseEndMessage(ended: Phase, nextMins: number): { title: string; body: string } {
	return ended === 'focus'
		? { title: '¡Enfoque terminado! 🎉', body: `Tómate un descanso de ${nextMins} min.` }
		: { title: 'Descanso terminado', body: `¿Listo para otro enfoque de ${nextMins} min?` };
}

/**
 * Muestra la notificación si hay permiso y la pestaña no está a la vista.
 * Al hacer clic, vuelve a la pestaña y ejecuta onClick (p. ej. abrir el panel del Pomodoro).
 * Devuelve true si se mostró.
 */
export function notifyPhaseEnd(ended: Phase, nextMins: number, onClick?: () => void): boolean {
	if (!supported() || Notification.permission !== 'granted') return false;
	if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;

	const { title, body } = phaseEndMessage(ended, nextMins);
	try {
		const n = new Notification(title, {
			body,
			icon: '/icon-192.png',
			tag: 'fokuz-pomodoro', // reemplaza a la anterior en vez de apilarlas
			requireInteraction: true // queda visible hasta que la atiendas
		});
		n.onclick = () => {
			window.focus();
			onClick?.();
			n.close();
		};
		return true;
	} catch {
		return false; // p. ej. Chrome en Android: exige service worker
	}
}
