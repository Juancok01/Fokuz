// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyPhaseEnd, phaseEndMessage, requestNotificationPermission } from './pomodoroNotify';

/** Notification falso: registra lo que se muestra. */
class FakeNotification {
	static permission: NotificationPermission = 'granted';
	static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
	static shown: FakeNotification[] = [];
	onclick: (() => void) | null = null;
	close = vi.fn();
	constructor(
		public title: string,
		public options: NotificationOptions
	) {
		FakeNotification.shown.push(this);
	}
}

const setVisibility = (state: DocumentVisibilityState) =>
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });

describe('Notificación al terminar el Pomodoro', () => {
	beforeEach(() => {
		FakeNotification.permission = 'granted';
		FakeNotification.shown = [];
		FakeNotification.requestPermission.mockClear();
		vi.stubGlobal('Notification', FakeNotification);
		setVisibility('hidden');
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		setVisibility('visible');
	});

	it('textos según la fase que terminó', () => {
		expect(phaseEndMessage('focus', 5)).toEqual({ title: '¡Enfoque terminado! 🎉', body: 'Tómate un descanso de 5 min.' });
		expect(phaseEndMessage('break', 25).body).toBe('¿Listo para otro enfoque de 25 min?');
	});

	it('con la pestaña oculta y permiso, muestra el aviso', () => {
		expect(notifyPhaseEnd('focus', 5)).toBe(true);
		expect(FakeNotification.shown).toHaveLength(1);
		expect(FakeNotification.shown[0].options.tag).toBe('fokuz-pomodoro');
	});

	it('con la pestaña a la vista no muestra nada (ya suena la alarma)', () => {
		setVisibility('visible');
		expect(notifyPhaseEnd('focus', 5)).toBe(false);
		expect(FakeNotification.shown).toHaveLength(0);
	});

	it('sin permiso no muestra nada', () => {
		FakeNotification.permission = 'denied';
		expect(notifyPhaseEnd('focus', 5)).toBe(false);
	});

	it('al hacer clic vuelve a la app, ejecuta la acción y cierra el aviso', () => {
		const onClick = vi.fn();
		const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
		notifyPhaseEnd('break', 25, onClick);
		const n = FakeNotification.shown[0];
		n.onclick?.();
		expect(focus).toHaveBeenCalled();
		expect(onClick).toHaveBeenCalled();
		expect(n.close).toHaveBeenCalled();
	});

	it('si el navegador no deja crear avisos (celular), no rompe nada', () => {
		vi.stubGlobal(
			'Notification',
			class {
				static permission = 'granted';
				constructor() {
					throw new TypeError('Illegal constructor');
				}
			}
		);
		expect(notifyPhaseEnd('focus', 5)).toBe(false);
	});

	it('solo pide permiso si el usuario todavía no respondió', () => {
		FakeNotification.permission = 'default';
		requestNotificationPermission();
		expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);

		FakeNotification.permission = 'denied';
		requestNotificationPermission();
		expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
	});
});
