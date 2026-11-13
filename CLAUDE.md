# CLAUDE.md: Fokuz

Contexto para cualquier sesión de trabajo en este repositorio. **Léelo antes de cambiar algo.**

Fokuz tiene dos objetivos:

1. Una **app de productividad** personal (hábitos, tareas, notas, Pomodoro, finanzas) que se usa a diario.
2. La **fuente de datos** del proyecto de ingeniería de datos de nivel medio del portafolio (sección [Proyecto de datos](#proyecto-de-datos)).

El dueño del proyecto no es desarrollador: construyó la app con asistencia de IA y su enfoque profesional es la **ingeniería de datos** (perfil junior). Explica en español sencillo y sin dar por sentado conocimiento de programación.

---

## La app

| | |
| --- | --- |
| Stack | SvelteKit 2 + Svelte 5 (runes), TypeScript estricto, Tailwind CSS 4 |
| Backend | Supabase: Postgres, autenticación con Google, RLS en todas las tablas |
| Producción | https://fokuz-iota.vercel.app (Vercel despliega cada push a `main`) |
| Repo | `Juancok01/Fokuz`: público y pensado para el portafolio. No es un fork. |

### Reglas de trabajo

- **Push a `main` = producción.** No crear ramas extra: cada rama dispara un despliegue de preview en Vercel.
- **Las migraciones no se aplican solas.** Cada archivo nuevo de `supabase/migrations/` lo ejecuta el dueño a mano en Supabase → SQL Editor. Antes de pedírselo, pruébalo en un Postgres local desechable con un stub de `auth` (`auth.users`, `auth.uid()` leyendo `request.jwt.claim.sub`, roles `authenticated`/`anon`). Después, verifica en producción.
- **Las migraciones deben ser idempotentes** (`if not exists`, `drop policy if exists`…).
- **Seguridad:** toda tabla nueva lleva RLS. Un usuario solo ve lo suyo o lo que le compartieron.
- **Datos personales:** el repo es público. Nunca subas datos reales, exportaciones (`.xlsx`, `.csv`) ni claves. `.env.example` solo tiene valores de ejemplo.
- **No hay `.env` local:** las pruebas manuales se hacen en producción con datos con prefijo `[QA]`, que se borran al terminar.
- **Lógica pura en `src/lib/*.ts`, con su prueba al lado (`*.test.ts`).** Ahí viven las rachas, las fechas, las finanzas, la cola de notas, el Pomodoro y el registro de sesiones.
- Interfaz, comentarios y mensajes de commit en **español**.

### Verificación antes de subir

```sh
npm run check -- --fail-on-warnings   # tipos y accesibilidad: 0 errores y 0 advertencias
npm test                              # Vitest
npm run build
```

GitHub Actions corre lo mismo en cada push (`.github/workflows/tests.yml`).

---

## Proyecto de datos

> Estado (noviembre 2026): **planeado**. La fuente ya está preparada (migración 033). El pipeline vivirá en un repositorio aparte.

### Objetivo

Construir un pipeline analítico de punta a punta sobre los datos reales de Fokuz y responder [preguntas concretas](#preguntas-de-negocio) con un modelo dimensional (Kimball) y un dashboard.

### Arquitectura

```
Supabase (Postgres)                       ← fuente transaccional (OLTP)
   │ 1. Extracción diaria: Python, orquestado con Airflow
   ▼
S3 · raw/     (bronze)  copia tal cual, en Parquet, particionada por fecha de extracción
   │ 2. Limpieza: PySpark / Glue
   ▼
S3 · clean/   (silver)  tipos correctos, sin duplicados, fechas en America/Bogota
   │ 3. Modelado: PySpark o dbt
   ▼
S3 · gold/    (gold)    modelo estrella (hechos + dimensiones)
   │ 4. Glue Data Catalog + Athena (SQL sobre S3)
   ▼
Dashboard: Power BI (principal); QuickSight como alternativa nativa de AWS
```

### Decisiones tomadas

| Decisión | Por qué |
| --- | --- |
| **Extracción "pull":** Airflow se conecta a Supabase. Supabase no envía nada. | Es el patrón estándar de extracción batch. |
| **Snapshot completo diario**, no carga incremental | Casi ninguna tabla tiene `updated_at`, así que no se puede saber qué cambió. Con el volumen de una persona, copiar todo cada día es barato. Además, comparar snapshots permite detectar borrados y construir historia (SCD tipo 2). |
| **Arquitectura medallón** (raw → clean → gold) | Separa los datos crudos (reprocesables) de los limpios y de los modelados. |
| **Parquet en S3 + Athena**, no Redshift al inicio | Es más barato (se paga por consulta) y alcanza para este volumen. Redshift queda para el mes 5 de la ruta. |
| **Power BI** como dashboard principal | Power BI Desktop es gratis y es lo más pedido en el mercado. QuickSight cobra por usuario. |
| **Credenciales** en conexiones de Airflow o AWS Secrets Manager | Nunca en el repo. |
| **Datos publicados sintéticos o anonimizados** | Las finanzas son personales. Los datos reales quedan solo en la cuenta privada. |

### Modelo dimensional (borrador)

**Tablas de hechos**

| Tabla | Tipo (Kimball) | Grano: una fila por… | Fuente | Medidas principales |
| --- | --- | --- | --- | --- |
| `fact_transacciones` | Transaccional | movimiento financiero | `finance_transactions` | `monto` (con signo), `tipo` |
| `fact_presupuesto_mes` | Snapshot periódico | subcategoría × mes | `finance_subcategories.monthly_budget` + transacciones | `presupuesto`, `gastado`, `diferencia` |
| `fact_habitos_dia` | Transaccional "densa" | hábito × día programado | `habits` (`weekdays`, `created_at`) × calendario, cruzado con `habit_logs` | `cumplido` (0/1) |
| `fact_tareas` | Snapshot acumulativo | tarea | `tasks` | `dias_hasta_completar`, `vencida` (0/1) |
| `fact_sesiones_foco` | Transaccional | fase de Pomodoro | `focus_sessions` | `segundos_reales`, `segundos_planeados`, `completada` (0/1) |

**Dimensiones**

| Tabla | Contenido |
| --- | --- |
| `dim_fecha` | **Conformada:** la comparten todos los hechos. Contiene día, semana ISO, mes, día de la semana y si es fin de semana o festivo en Colombia. |
| `dim_hora` | Hora del día y franja (madrugada, mañana, tarde, noche). |
| `dim_habito` | Nombre, ícono, días programados. |
| `dim_categoria` | Jerarquía categoría → subcategoría, y si es ingreso o gasto. |
| `dim_tablero_finanzas` | Tablero financiero, meta de ahorro (`savings_goal_pct`) y presupuesto mensual. |
| `dim_tablero_tareas` | Tablero y columna (lista) de tareas. |

### Preguntas de negocio

| # | Pregunta | Hechos y dimensiones | Métrica |
| --- | --- | --- | --- |
| 1 | ¿Qué días de la semana cumplo más mis hábitos y cuáles abandono? | `fact_habitos_dia` × `dim_fecha`, `dim_habito` | % de cumplimiento = días cumplidos ÷ días programados |
| 2 | ¿Cuánto tardo en completar una tarea y qué porcentaje termino después de la fecha límite? | `fact_tareas` × `dim_fecha`, `dim_tablero_tareas` | Mediana de `completed_at − created_at`; % con `completed_at > end_date` |
| 3 | ¿Cuántas horas de enfoque real hago por semana y cuántas sesiones interrumpo? | `fact_sesiones_foco` × `dim_fecha` | Σ `actual_seconds` (fase focus) ÷ 3600; % de sesiones con `completed = false` |
| 4 | ¿En qué franja del día me enfoco mejor? | `fact_sesiones_foco` × `dim_hora` | % de sesiones completadas por franja |
| 5 | ¿En qué categorías gasto más y en cuáles me paso del presupuesto? | `fact_transacciones`, `fact_presupuesto_mes` × `dim_categoria`, `dim_fecha` | Gasto por categoría y mes; subcategorías con `gastado > presupuesto` |
| 6 | ¿Estoy cumpliendo mi meta de ahorro mes a mes? | `fact_transacciones` × `dim_tablero_finanzas`, `dim_fecha` | Tasa de ahorro = (ingresos − gastos) ÷ ingresos, comparada con `savings_goal_pct` |
| 7 | ¿Las tareas en las que uso Pomodoro se terminan más rápido? | `fact_sesiones_foco.task_id` → `fact_tareas` | Días hasta completar: tareas con sesiones vs. sin sesiones |
| 8 | ¿Los días que cumplo mis hábitos también me enfoco más y gasto menos? | Cruce de `fact_habitos_dia`, `fact_sesiones_foco` y `fact_transacciones` por `dim_fecha` (*drill-across*) | Correlación diaria: % de hábitos vs. minutos de foco vs. gasto |

La pregunta 8 solo es posible porque `dim_fecha` es una **dimensión conformada**, compartida por todos los hechos. Es un buen ejemplo para explicar Kimball en una entrevista.

### Calidad de datos: limitaciones conocidas de la fuente

| Limitación | Cómo tratarla |
| --- | --- |
| Las tareas anteriores al **13-nov-2026** tienen `created_at` y `completed_at` en `NULL` (fecha desconocida). | Filtrar `created_at IS NOT NULL` para medir duraciones. No inventar fechas. |
| `focus_sessions` existe desde el **13-nov-2026**. Las interrupciones de menos de 1 minuto no se guardan. | Documentarlo en el dashboard. |
| `habit_logs` solo guarda los días **cumplidos**. | Los días no cumplidos se derivan: días programados (`habits.weekdays`) desde `habits.created_at` menos los días con log. |
| Las **categorías de hábitos** solo existen en el navegador (localStorage), no en la base. | Por ahora no se puede agrupar hábitos por categoría. Pendiente en la app. |
| Los **presupuestos** solo guardan el valor actual, sin historia. | Los snapshots diarios permiten construir la historia (SCD tipo 2) desde que empiece la extracción. |
| Los borrados son definitivos (no hay borrado lógico). | Detectarlos comparando snapshots consecutivos. |
| Las fechas se guardan en UTC y el usuario está en Colombia. | Convertir a `America/Bogota` en la capa clean, antes de derivar el día. |
| En producción, `tasks.date` es obligatorio aunque `000_base_tasks.sql` lo declare opcional. | Tenerlo en cuenta al generar datos sintéticos. |

### Pruebas de calidad planeadas (dbt / PySpark)

- Llaves únicas y no nulas en cada tabla de hechos y dimensiones.
- Valores aceptados: `phase ∈ {focus, break}`, `type ∈ {income, expense}`.
- Reglas: `amount > 0`, `ended_at >= started_at`, `actual_seconds <= planned_seconds`.
- Integridad referencial: cada hecho apunta a una fila existente de `dim_fecha` y de su dimensión.
- **Frescura:** la extracción de hoy existe.
- **Volumen:** el número de filas no cae más de un X % entre snapshots, para detectar borrados masivos.

### Encaje con la ruta de aprendizaje

| Paso del proyecto | Ruta |
| --- | --- |
| Diseñar el modelo estrella | Mes 1: Docker, Git, Kimball |
| Extracción y transformación; orquestación | Meses 2–3: PySpark, Airflow |
| S3, Glue, Athena (y Lambda si aplica) | Mes 4: AWS y certificación AWS Data Engineer |
| Versión en Redshift o Databricks (opcional) | Mes 5 |
| Modelado y pruebas con dbt | Mes 6 |
| Dashboard | Opcional: Power BI |

El pipeline se construye **a medida que avanza la ruta**, no al final. El dueño lo escribe con la IA como tutora, porque es lo que se evalúa en las entrevistas.

### Pendientes

**En la app (fuente de datos)**
- [x] `tasks.created_at`, `tasks.completed_at` y la tabla `focus_sessions` (migración 033, 13-nov-2026).
- [ ] Guardar las categorías de hábitos en la base (hoy solo están en el navegador).
- [ ] Evaluar `updated_at` en las tablas principales (habilitaría la carga incremental).

**Proyecto de datos**
- [ ] Crear el repositorio del pipeline.
- [ ] Generador de datos sintéticos con la misma forma que la fuente, para la versión pública.
- [ ] DAG de extracción diaria → S3 raw.
- [ ] Capa clean → modelo estrella en gold.
- [ ] Pruebas de calidad.
- [ ] Dashboard en Power BI que responda las 8 preguntas.
