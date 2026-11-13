# Fokuz

**App de productividad personal que reúne hábitos, tareas, notas, enfoque y finanzas en un solo lugar.**

[![Pruebas](https://github.com/Juancok01/Fokuz/actions/workflows/tests.yml/badge.svg)](https://github.com/Juancok01/Fokuz/actions/workflows/tests.yml)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

🔗 **Demo:** [fokuz-iota.vercel.app](https://fokuz-iota.vercel.app) (inicio de sesión con Google)

---

## Sobre este proyecto

Fokuz es una app que uso a diario y, a la vez, la **fuente de datos de mi proyecto de ingeniería de datos**. Cada hábito marcado, tarea, sesión de enfoque y movimiento financiero queda registrado en Postgres, y esos datos reales alimentarán un pipeline analítico. Más abajo explico cómo: [Siguiente fase](#siguiente-fase-proyecto-de-ingeniería-de-datos).

### Cómo se construyó

La app fue desarrollada **con asistencia de IA** ([Claude Code](https://claude.com/claude-code)). Mi rol fue:

- **Producto:** definir qué debía hacer cada módulo y cómo debía comportarse.
- **QA:** probar módulo por módulo, encontrar errores y decidir qué corregir y en qué orden.
- **Seguridad y datos:** revisar quién puede ver qué en la base de datos (RLS) y mantener el esquema sincronizado con producción.
- **Validación:** confirmar cada cambio en la app en vivo antes de darlo por terminado.

Mi enfoque profesional es la **ingeniería de datos**: la app es el medio y los datos son el objetivo.

---

## Módulos

| Módulo | Qué hace |
| --- | --- |
| 🏠 **Inicio** | Resumen del día: tareas de hoy, hábitos pendientes, racha actual y acceso rápido al Pomodoro. |
| ✅ **Hábitos** | Seguimiento diario por categorías, con rachas que solo cuentan los días desde que creaste el hábito. |
| 📋 **Tareas** | Tableros Kanban con arrastrar y soltar, vista de lista y de calendario, vista "Hoy", subtareas, checklists, comentarios, etiquetas, fechas límite con colores y tableros compartidos. |
| 📝 **Notas** | Editor de texto enriquecido con carpetas, notas ancladas y favoritas, guardado automático y notas compartidas. |
| ⏱️ **Foco** | Pomodoro que sigue corriendo mientras navegas por la app, con tiempos configurables, tarea asociada y sonido ambiente. |
| 💰 **Finanzas** | Tableros de ingresos y gastos con categorías, presupuestos por subcategoría, ahorros, comparación entre meses, proyección de cierre y exportación a Excel. |
| 👤 **Perfil** | Contactos para compartir tableros y notas, y versículos guardados. |

## Stack

- **Frontend:** [SvelteKit 2](https://svelte.dev/docs/kit) con **Svelte 5** (runes: `$state`, `$derived`, `$effect`), TypeScript y Tailwind CSS 4.
- **Backend:** [Supabase](https://supabase.com): Postgres, autenticación con Google y **Row Level Security** en todas las tablas.
- **Librerías:** Quill (editor de notas), svelte-dnd-action (Kanban), flatpickr (fechas), Lucide (íconos).
- **Calidad:** Vitest + jsdom, svelte-check y GitHub Actions.
- **Despliegue:** Vercel, con despliegue automático desde `main`.

## Decisiones técnicas destacadas

- **Seguridad en la base de datos.** Cada tabla tiene políticas RLS. Un usuario solo ve lo suyo y lo que otro usuario le compartió explícitamente (tableros, tareas, comentarios, checklists y notas). Las migraciones de seguridad están en [`supabase/migrations/`](supabase/migrations).
- **HTML de notas saneado.** Las notas compartidas se limpian en un documento inerte antes de mostrarse, quitando etiquetas peligrosas y atributos `on*` para evitar XSS ([`quill-note-html.ts`](src/lib/quill-note-html.ts)).
- **Guardado de notas sin pérdidas.** Una cola de guardado por nota agrupa los cambios y los envía al cambiar de nota, al ocultar la pestaña o al cerrarla ([`noteSaveQueue.ts`](src/lib/noteSaveQueue.ts)).
- **Lógica pura y probada.** Rachas, fechas, choques de horario, saldos y el temporizador viven en módulos de `src/lib` sin dependencias de la interfaz, con sus pruebas al lado.
- **Componentes pequeños.** El tablero de tareas está dividido en componentes (`KanbanView`, `TaskCard`, `TaskDetailModal`, `CalendarView`…) en [`src/lib/components/tareas/`](src/lib/components/tareas).
- **Pomodoro persistente.** El estado del temporizador se guarda en `localStorage`, así que sobrevive a recargas y cambios de página ([`pomodoro.svelte.ts`](src/lib/pomodoro.svelte.ts)).

## Calidad

Cada push a `main` pasa por [GitHub Actions](.github/workflows/tests.yml):

1. **svelte-check:** tipos y accesibilidad, con 0 errores y 0 advertencias permitidas.
2. **Vitest:** más de 100 pruebas de rachas, fechas, saldos, guardado de notas, saneamiento de HTML y Pomodoro.
3. **Build** de producción.

```sh
npm run check   # tipos y accesibilidad
npm test        # pruebas
```

## Correr el proyecto localmente

**Requisitos:** Node.js 24 y un proyecto de Supabase.

1. Clona el repositorio e instala las dependencias:

   ```sh
   git clone https://github.com/Juancok01/Fokuz.git
   cd Fokuz
   npm install
   ```

2. Crea la base de datos: en Supabase → **SQL Editor**, ejecuta en orden los archivos de [`supabase/migrations/`](supabase/migrations), de `000` a `032`.

3. Activa el inicio de sesión con Google en Supabase → **Authentication → Providers**.

4. Copia `.env.example` a `.env` y completa la URL y la clave pública (anon) de tu proyecto:

   ```sh
   cp .env.example .env
   ```

5. Inicia el servidor de desarrollo:

   ```sh
   npm run dev
   ```

## Estructura

```
src/
├── lib/
│   ├── components/      # Componentes por módulo (tareas, finanzas, …)
│   ├── *.ts             # Lógica pura: hábitos, fechas, finanzas, notas, Pomodoro
│   └── *.test.ts        # Pruebas de esa lógica
└── routes/
    ├── (app)/           # Páginas: inicio, hábitos, tareas, notas, finanzas, perfil
    └── api/             # Endpoints del servidor
supabase/migrations/     # Esquema y políticas de seguridad (RLS)
```

## Siguiente fase: proyecto de ingeniería de datos

> 🚧 **En construcción.** Este es el plan; el pipeline vivirá en un repositorio aparte.

La base de datos de Fokuz (Postgres en Supabase) es el **sistema transaccional** de origen. El objetivo es construir sobre ella un pipeline analítico de punta a punta:

```
Supabase (Postgres) ──► Extracción diaria ──► S3 (raw) ──► Transformación ──► Modelo estrella ──► Consultas y dashboards
                        Python · Airflow                   PySpark · dbt      (Kimball)          Athena · Power BI
```

**Modelo dimensional (Kimball), primer borrador:**

| Tabla de hechos | Tipo | Grano: una fila por… |
| --- | --- | --- |
| `fact_transacciones` | Transaccional | movimiento financiero |
| `fact_presupuesto_mes` | Snapshot periódico | subcategoría × mes |
| `fact_habitos_dia` | Transaccional densa | hábito × día programado (cumplido o no) |
| `fact_tareas` | Snapshot acumulativo | tarea (creada → fecha límite → completada) |
| `fact_sesiones_foco` | Transaccional | fase de Pomodoro |

Dimensiones: `dim_fecha` (conformada, la comparten todos los hechos), `dim_hora`, `dim_habito`, `dim_categoria`, `dim_tablero_finanzas` y `dim_tablero_tareas`.

**Preguntas que el proyecto va a responder:**

1. ¿Qué días de la semana cumplo más mis hábitos y cuáles abandono?
2. ¿Cuánto tardo en completar una tarea y qué porcentaje termino después de la fecha límite?
3. ¿Cuántas horas de enfoque real hago por semana y cuántas sesiones interrumpo?
4. ¿En qué franja del día me enfoco mejor?
5. ¿En qué categorías gasto más y en cuáles me paso del presupuesto?
6. ¿Estoy cumpliendo mi meta de ahorro mes a mes?
7. ¿Las tareas en las que uso Pomodoro se terminan más rápido?
8. ¿Los días que cumplo mis hábitos también me enfoco más y gasto menos? (cruce de hechos por la dimensión de fecha conformada)

El detalle del diseño (decisiones, métricas de cada pregunta, limitaciones de la fuente y pruebas de calidad) está en [`CLAUDE.md`](CLAUDE.md#proyecto-de-datos).

**Preparación de la fuente (noviembre 2026):** la migración [`033`](supabase/migrations/033_task_timestamps_focus_sessions.sql) agrega `created_at` y `completed_at` a las tareas (un trigger mantiene `completed_at` venga de donde venga el cambio) y la tabla `focus_sessions`, con una fila por fase de Pomodoro, completa o interrumpida. Las tareas anteriores quedan con fecha `NULL` (desconocida) en lugar de fechas inventadas. Si no hay conexión, las sesiones se guardan en una cola local y se envían después, sin duplicados ([`focusSessions.ts`](src/lib/focusSessions.ts)).

**Privacidad:** los datos financieros son personales. Lo que se publique del proyecto de datos usará datos sintéticos o anonimizados.

## Autor

Hecho por **Juan Cruz**: [github.com/Juancok01](https://github.com/Juancok01)
