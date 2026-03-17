CREATE OR REPLACE FUNCTION public.f_gjj_get_sql_by_dialect(
    v_sql_config TEXT,
    v_db_format CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_input TEXT := v_sql_config;
    v_trimmed TEXT;
    v_target TEXT := LOWER(COALESCE(NULLIF(BTRIM(v_db_format), ''), f_gjj_get_db_format()));
    v_result TEXT;
BEGIN
    IF v_input IS NULL THEN
        RETURN NULL;
    END IF;

    v_trimmed := BTRIM(v_input);
    IF v_trimmed = '' THEN
        RETURN NULL;
    END IF;

    IF LEFT(v_trimmed, 1) <> '[' THEN
        RETURN v_input;
    END IF;

    SELECT item ->> 'sql'
      INTO v_result
      FROM jsonb_array_elements(v_trimmed::jsonb) AS item
     WHERE COALESCE(item ->> 'sql', '') <> ''
       AND (
               (v_target IS NOT NULL AND LOWER(COALESCE(item ->> 'dialect', '')) = v_target)
            OR LOWER(COALESCE(item ->> 'dialect', '')) = 'default'
       )
     ORDER BY CASE
                  WHEN v_target IS NOT NULL AND LOWER(COALESCE(item ->> 'dialect', '')) = v_target THEN 1
                  WHEN LOWER(COALESCE(item ->> 'dialect', '')) = 'default' THEN 2
                  ELSE 9
              END
     LIMIT 1;

    RETURN NULLIF(v_result, '');
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$function$;
