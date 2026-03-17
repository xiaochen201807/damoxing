CREATE OR REPLACE FUNCTION public.f_gjj_get_db_format()
RETURNS CHARACTER VARYING
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN 'pg';
END;
$function$;
