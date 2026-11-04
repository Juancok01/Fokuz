-- Migration 027: presupuesto mensual opcional por subcategoría
-- Ejecuta en Supabase → SQL Editor → Run

alter table public.finance_subcategories
  add column if not exists monthly_budget numeric(15, 2);
