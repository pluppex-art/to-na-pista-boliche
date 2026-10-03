-- Sincronização ao vivo com o Spy: fidelidade (loyalty_transactions) e itens da loja (itens_loja).
-- Mesmo padrão de notify_spy_finance_entry: o banco chama a edge function sync-to-spy via pg_net,
-- que centraliza o mapeamento. Já aplicado no projeto rmirkhebjgvsqqenszts.

create or replace function public.notify_spy_loyalty_transaction()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform net.http_post(
    url := 'https://rmirkhebjgvsqqenszts.supabase.co/functions/v1/sync-to-spy',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_h9bKTMYVO5RvO5eBQZTsNQ_zyZBQCc3'),
    body := jsonb_build_object('loyaltyTransactionId', NEW.id)
  );
  return NEW;
end;
$$;

create or replace function public.notify_spy_store_item()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform net.http_post(
    url := 'https://rmirkhebjgvsqqenszts.supabase.co/functions/v1/sync-to-spy',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_h9bKTMYVO5RvO5eBQZTsNQ_zyZBQCc3'),
    body := jsonb_build_object('storeItemId', NEW.id)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_spy_loyalty_transaction on public.loyalty_transactions;
create trigger trg_notify_spy_loyalty_transaction after insert on public.loyalty_transactions
  for each row execute function public.notify_spy_loyalty_transaction();

drop trigger if exists trg_notify_spy_store_item on public.itens_loja;
create trigger trg_notify_spy_store_item after insert or update on public.itens_loja
  for each row execute function public.notify_spy_store_item();
