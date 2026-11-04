-- Migration 026: Presupuesto mensual, meta de ahorro y movimientos de tipo "saving" (ahorro)
-- Ejecuta en Supabase → SQL Editor → Run

alter table public.finance_boards
  add column if not exists monthly_budget numeric(15, 2) not null default 0,
  add column if not exists savings_goal_pct numeric(5, 2) not null default 20;

-- El saldo descuenta también lo que se aparta como ahorro
create or replace function public.finance_boards_overview(p_month_start date default date_trunc('month', current_date)::date)
returns table (
  id bigint,
  title text,
  description text,
  color text,
  initial_balance numeric,
  user_id uuid,
  is_owner boolean,
  created_at timestamptz,
  balance numeric,
  month_income numeric,
  month_expense numeric,
  tx_count bigint,
  shared_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    b.id,
    b.title,
    b.description,
    b.color,
    b.initial_balance,
    b.user_id,
    b.user_id = auth.uid() as is_owner,
    b.created_at,
    b.initial_balance
      + coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0)
      - coalesce(sum(case when t.type in ('expense', 'saving') then t.amount else 0 end), 0) as balance,
    coalesce(sum(case when t.type = 'income' and t.date >= p_month_start
      and t.date < (p_month_start + interval '1 month') then t.amount else 0 end), 0) as month_income,
    coalesce(sum(case when t.type = 'expense' and t.date >= p_month_start
      and t.date < (p_month_start + interval '1 month') then t.amount else 0 end), 0) as month_expense,
    count(t.id) as tx_count,
    (select count(*) from public.finance_board_shares s where s.board_id = b.id) as shared_count
  from public.finance_boards b
  left join public.finance_transactions t on t.board_id = b.id
  group by b.id
  order by b.created_at asc;
$$;
