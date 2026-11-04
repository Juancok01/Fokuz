-- Migration 025: corrige "new row violates row-level security policy for table finance_boards"
-- Al crear un tablero con .insert().select(), Postgres valida la política SELECT sobre la fila nueva.
-- finance_can_access_board() es STABLE y no ve la fila insertada en la misma sentencia,
-- así que se comprueba primero la columna user_id directamente.
-- Ejecuta en Supabase → SQL Editor → Run

drop policy if exists "finance_boards_select" on public.finance_boards;
create policy "finance_boards_select" on public.finance_boards for select
  using (auth.uid() = user_id or public.finance_can_access_board(id));
