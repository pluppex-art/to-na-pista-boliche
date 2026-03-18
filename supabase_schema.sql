-- Schema SQL para referência do Banco de Dados Supabase
-- Este arquivo é apenas informativo e não afeta o build do frontend.

/* 
Tabelas principais:
- usuarios: Staff e Admin
- clientes: Leads e Clientes (CRM)
- reservas: Agendamentos de pistas
- configuracoes: Dados da unidade
- avaliacoes: Feedbacks dos clientes
*/

-- Função Inteligente de Sincronização do Funil (SQL para rodar no Editor SQL do Supabase)
/*
CREATE OR REPLACE FUNCTION sync_all_funnel_stages()
RETURNS void AS $$
DECLARE
    client_record RECORD;
    last_res_record RECORD;
    last_interaction_record RECORD;
    diff_days INTEGER;
    contact_diff_days INTEGER;
    qualified_stage TEXT;
    new_stage TEXT;
    milestone_at_contact INTEGER;
    next_milestone INTEGER;
BEGIN
    FOR client_record IN SELECT * FROM clientes LOOP
        -- 1. Encontrar última reserva válida
        SELECT * INTO last_res_record 
        FROM reservas 
        WHERE (client_id = client_record.client_id OR (guests @> jsonb_build_array(jsonb_build_object('phone', client_record.phone))))
          AND status != 'Cancelada'
        ORDER BY date DESC, time DESC
        LIMIT 1;

        IF last_res_record.id IS NULL THEN
            CONTINUE;
        END IF;

        diff_days := DATE_PART('day', NOW() - last_res_record.date::timestamp);
        
        -- Determinar estágio qualificado por tempo
        qualified_stage := CASE 
            WHEN diff_days >= 30 THEN '30 dias depois'
            WHEN diff_days >= 15 THEN '15 dias depois'
            WHEN diff_days >= 7 THEN '7 dias depois'
            WHEN diff_days >= 1 THEN 'Pós Venda'
            ELSE client_record.funnel_stage
        END;

        new_stage := client_record.funnel_stage;

        -- 2. Lógica de Standby
        IF client_record.funnel_stage = 'Standby' THEN
            -- Encontrar última interação de contato
            SELECT * INTO last_interaction_record
            FROM interacoes
            WHERE client_id = client_record.client_id 
              AND type IN ('CALL', 'WHATSAPP', 'EMAIL')
            ORDER BY created_at DESC
            LIMIT 1;

            IF last_interaction_record.id IS NOT NULL THEN
                contact_diff_days := DATE_PART('day', last_interaction_record.created_at - last_res_record.date::timestamp);
                
                -- Milestone no momento do contato
                milestone_at_contact := CASE 
                    WHEN contact_diff_days >= 30 THEN 30
                    WHEN contact_diff_days >= 15 THEN 15
                    WHEN contact_diff_days >= 7 THEN 7
                    WHEN contact_diff_days >= 1 THEN 1
                    ELSE 0
                END;

                -- Próximo milestone
                SELECT m INTO next_milestone 
                FROM unnest(ARRAY[1, 7, 15, 30]) m 
                WHERE m > milestone_at_contact 
                ORDER BY m ASC 
                LIMIT 1;

                IF next_milestone IS NOT NULL AND diff_days >= next_milestone THEN
                    new_stage := CASE 
                        WHEN next_milestone = 1 THEN 'Pós Venda'
                        WHEN next_milestone = 7 THEN '7 dias depois'
                        WHEN next_milestone = 15 THEN '15 dias depois'
                        WHEN next_milestone = 30 THEN '30 dias depois'
                    END;
                ELSE
                    new_stage := 'Standby';
                END IF;
            ELSE
                -- Sem interações, segue fluxo normal
                new_stage := qualified_stage;
            END IF;
        ELSIF client_record.funnel_stage IN ('Novo', 'Pós Venda', '7 dias depois', '15 dias depois', '30 dias depois') OR client_record.funnel_stage IS NULL THEN
            new_stage := qualified_stage;
        END IF;

        -- 3. Atualizar se mudou
        IF new_stage != client_record.funnel_stage THEN
            UPDATE clientes SET funnel_stage = new_stage WHERE client_id = client_record.client_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
*/
