-- Preserva as aprovações e justificativas registradas anteriormente.
ALTER TABLE public.cot_minimum_order_exceptions
  DROP CONSTRAINT cot_minimum_order_exceptions_reason_check,
  ADD CONSTRAINT cot_minimum_order_exceptions_reason_check CHECK (reason ~ '[^[:space:]]');

-- Altera somente a validação da justificativa na função de aprovação existente.
DO $migration$
DECLARE
  definition text := pg_get_functiondef(
    'public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean,jsonb)'::regprocedure
  );
  old_validation constant text := $old$OR char_length(btrim(coalesce(v_exception->>'reason',''))) < 10
          OR char_length(btrim(coalesce(v_exception->>'reason',''))) > 500$old$;
BEGIN
  IF strpos(definition, old_validation) = 0 THEN
    RAISE EXCEPTION 'A validação anterior da justificativa não foi encontrada';
  END IF;
  EXECUTE replace(
    replace(definition, old_validation, $new$OR coalesce(v_exception->>'reason','') !~ '[^[:space:]]'$new$),
    'informe justificativa de 10 a 500 caracteres.',
    'informe uma justificativa.'
  );
END
$migration$;
