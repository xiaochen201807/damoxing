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

CREATE OR REPLACE FUNCTION public.f_gjj_get_mxywsfz_sxz(
    v_pcid CHARACTER VARYING,
    v_sxkey CHARACTER VARYING
)
RETURNS CHARACTER VARYING
LANGUAGE plpgsql
AS $function$
DECLARE
    v_result VARCHAR(2000);
BEGIN
    SELECT value
      INTO v_result
      FROM tmp_gjj_ywblsxz
     WHERE pcid = v_pcid
       AND key = v_sxkey
     LIMIT 1;

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.f_gjj_get_standard_value(
    v_ywbzzbm CHARACTER VARYING,
    v_jgbh CHARACTER VARYING,
    v_zjgbh CHARACTER VARYING
)
RETURNS CHARACTER VARYING
LANGUAGE plpgsql
AS $function$
DECLARE
    v_result VARCHAR(2000) := NULLIF(BTRIM(COALESCE(v_ywbzzbm, '')), '');
    v_qycode VARCHAR(2000);
    v_cnt INTEGER := 0;
    v_table_name TEXT;
    v_sql TEXT;
BEGIN
    IF NULLIF(BTRIM(COALESCE(v_ywbzzbm, '')), '') IS NULL THEN
        RETURN COALESCE(v_ywbzzbm, '');
    END IF;

    v_table_name := 'pt_dxsl_' || regexp_replace(COALESCE(v_jgbh, ''), '[^0-9A-Za-z_]', '', 'g') || '_01';

    BEGIN
        v_sql := format('SELECT dx_01_zjbzxbm FROM %I WHERE dx_01_dxbh = $1 LIMIT 1', v_table_name);
        EXECUTE v_sql INTO v_qycode USING v_zjgbh;
    EXCEPTION
        WHEN undefined_table THEN
            v_qycode := NULL;
    END;

    IF NULLIF(BTRIM(COALESCE(v_qycode, '')), '') IS NOT NULL THEN
        v_qycode := SUBSTRING(v_qycode FROM 2);
    END IF;

    IF NULLIF(BTRIM(COALESCE(v_qycode, '')), '') IS NOT NULL THEN
        BEGIN
            SELECT COUNT(pdgm.id)
              INTO v_cnt
              FROM pt_dx_ggcs_mx pdgm
              LEFT JOIN pt_dx_ggcs pdg ON pdgm.ggcs_wybs = pdg.ggcs_wybs
             WHERE pdgm.jgbh LIKE COALESCE(v_jgbh, '') || '%'
               AND pdg.jgbh = v_jgbh
               AND pdgm.ggcs_wybs LIKE v_ywbzzbm || '%'
               AND pdgm.cs = 'cs1'
               AND pdgm.jgbs = v_qycode;
        EXCEPTION
            WHEN undefined_table THEN
                RETURN COALESCE(v_result, '');
        END;

        IF v_cnt > 0 THEN
            BEGIN
                SELECT MAX(pdgm.csz)
                  INTO v_result
                  FROM pt_dx_ggcs_mx pdgm
                  LEFT JOIN pt_dx_ggcs pdg ON pdgm.ggcs_wybs = pdg.ggcs_wybs
                 WHERE pdgm.jgbh LIKE COALESCE(v_jgbh, '') || '%'
                   AND pdg.jgbh = v_jgbh
                   AND pdgm.ggcs_wybs LIKE v_ywbzzbm || '%'
                   AND pdgm.cs = 'cs1'
                   AND pdgm.jgbs = v_qycode;
            EXCEPTION
                WHEN undefined_table THEN
                    RETURN COALESCE(NULLIF(BTRIM(COALESCE(v_result, '')), ''), COALESCE(v_ywbzzbm, ''));
            END;

            RETURN COALESCE(NULLIF(BTRIM(COALESCE(v_result, '')), ''), COALESCE(v_ywbzzbm, ''));
        END IF;
    END IF;

    BEGIN
        SELECT MAX(pdgm.csz)
          INTO v_result
          FROM pt_dx_ggcs_mx pdgm
          LEFT JOIN pt_dx_ggcs pdg ON pdgm.ggcs_wybs = pdg.ggcs_wybs
         WHERE pdgm.jgbh = v_jgbh
           AND pdg.jgbh = v_jgbh
           AND pdgm.ggcs_wybs = v_ywbzzbm
           AND pdgm.cs = 'cs1';
    EXCEPTION
        WHEN undefined_table THEN
            RETURN COALESCE(NULLIF(BTRIM(COALESCE(v_result, '')), ''), COALESCE(v_ywbzzbm, ''));
    END;

    RETURN COALESCE(NULLIF(BTRIM(COALESCE(v_result, '')), ''), COALESCE(v_ywbzzbm, ''));
END;
$function$;

CREATE OR REPLACE FUNCTION public.f_arg_list(
    p_args CHARACTER VARYING,
    p_delimiter CHARACTER VARYING DEFAULT ','::CHARACTER VARYING,
    p_prefix CHARACTER VARYING DEFAULT ''::CHARACTER VARYING,
    p_suffix CHARACTER VARYING DEFAULT ''::CHARACTER VARYING
)
RETURNS TABLE(arg_type CHARACTER VARYING)
LANGUAGE sql
AS $function$
    SELECT CONCAT(COALESCE(NULLIF(p_prefix, ''), ''), BTRIM(token), COALESCE(p_suffix, '')) AS arg_type
      FROM regexp_split_to_table(COALESCE(p_args, ''), COALESCE(NULLIF(p_delimiter, ''), ',')) AS token
     WHERE BTRIM(token) <> ''
$function$;

CREATE OR REPLACE FUNCTION public.f_gjj_prepare_exec_sql(
    v_sql_config TEXT,
    v_jgbh CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING,
    v_zjgbh CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING,
    v_jcrid CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING,
    v_pcid CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING,
    v_mxywblbzb CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING,
    v_result_value CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING,
    v_db_format CHARACTER VARYING DEFAULT NULL::CHARACTER VARYING
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_sql TEXT;
BEGIN
    v_sql := f_gjj_get_sql_by_dialect(v_sql_config, v_db_format);
    IF v_sql IS NULL OR BTRIM(v_sql) = '' THEN
        RETURN NULL;
    END IF;

    IF POSITION('v_mxywblbzb' IN v_sql) > 0 THEN
        v_sql := REPLACE(v_sql, 'v_mxywblbzb', COALESCE(v_mxywblbzb, 'null'));
    END IF;
    IF POSITION('v_result' IN v_sql) > 0 THEN
        v_sql := REPLACE(v_sql, 'v_result', COALESCE(v_result_value, 'null'));
    END IF;
    IF POSITION('v_jgbh' IN v_sql) > 0 THEN
        v_sql := REPLACE(v_sql, 'v_jgbh', COALESCE(v_jgbh, 'null'));
    END IF;
    IF POSITION('v_zjgbh' IN v_sql) > 0 THEN
        v_sql := REPLACE(v_sql, 'v_zjgbh', COALESCE(v_zjgbh, 'null'));
    END IF;
    IF POSITION('v_jcrid' IN v_sql) > 0 THEN
        v_sql := REPLACE(v_sql, 'v_jcrid', COALESCE(v_jcrid, 'null'));
    END IF;
    IF POSITION('v_pcid' IN v_sql) > 0 THEN
        v_sql := REPLACE(v_sql, 'v_pcid', COALESCE(quote_nullable(v_pcid), 'null'));
    END IF;

    RETURN v_sql;
END;
$function$;

CREATE OR REPLACE PROCEDURE public.p_gjj_get_mxywsfz(
    IN v_ywsf CHARACTER VARYING,
    IN v_ywnrfl CHARACTER VARYING,
    IN v_jgbh CHARACTER VARYING,
    IN v_zjgbh CHARACTER VARYING,
    IN v_pcid CHARACTER VARYING,
    INOUT v_result NUMERIC
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    attr_rec RECORD;
    v_errorcode NUMERIC := 0;
    v_errormsg TEXT;
    v_sql TEXT;
    v_sqlcx TEXT;
    v_sqltj TEXT;
    v_gzmc TEXT;
    v_bzfl TEXT;
    v_ywbljgz TEXT;
    v_ywblsql TEXT;
    v_ywblbzz TEXT;
    v_value TEXT;
    v_cnt INTEGER;
    v_cntsx INTEGER;
    v_jcrid TEXT;
    v_gdz NUMERIC;
    v_sxtjz NUMERIC;
    v_jcrzhye NUMERIC := 0;
    v_djje NUMERIC := 0;
    v_zhblje NUMERIC := 0;
    v_sjzfgfk NUMERIC := 99999999999;
    v_ljtqje NUMERIC := 0;
    v_bljd NUMERIC := 1;
    v_zttqje NUMERIC := 0;
    v_zgkde NUMERIC;
    v_blfs INTEGER := 2;
    v_zgkdnx NUMERIC;
    v_db_format VARCHAR(50) := f_gjj_get_db_format();
BEGIN
    v_result := 0;

    SELECT COALESCE(MAX(value), '0')
      INTO v_jcrid
      FROM tmp_gjj_ywblsxz
     WHERE pcid = v_pcid
       AND key <> 'dx_03124_sjdxsl'
       AND (key LIKE '%sjdxsl' OR key = 'dx_03124_id');

    FOR rec IN
        SELECT
            a.id,
            a.mbid,
            COALESCE(NULLIF(a.ywbzz, ''), NULLIF(b.ywbzz, ''), '') AS effective_ywbzz,
            b.bzfl,
            b.ywbzjg,
            a.gzmc
          FROM gjj_ywbz a
          LEFT JOIN gjj_ywbzk b ON a.mbid = b.id
         WHERE a.ywsf = v_ywsf
           AND COALESCE(a.zjgbh, '') = COALESCE(v_zjgbh, '')
           AND (v_ywsf <> '1' OR COALESCE(a.ywnrfl, '') = COALESCE(v_ywnrfl, ''))
         ORDER BY a.id
    LOOP
        v_gzmc := rec.gzmc;
        v_bzfl := rec.bzfl;
        v_ywblbzz := f_gjj_get_standard_value(rec.effective_ywbzz, v_jgbh, v_zjgbh);
        v_ywbljgz := rec.ywbzjg;
        v_gdz := NULL;
        v_sxtjz := NULL;

        SELECT COUNT(*)
          INTO v_cntsx
          FROM gjj_ywbzsx
         WHERE ywid = rec.id;

        IF v_cntsx = 0 THEN
            v_ywbljgz := f_gjj_prepare_exec_sql(
                rec.ywbzjg,
                v_jgbh,
                v_zjgbh,
                v_jcrid,
                v_pcid,
                v_ywblbzz,
                NULL,
                v_db_format
            );

            IF v_ywbljgz IS NULL OR BTRIM(v_ywbljgz) = '' THEN
                IF NULLIF(BTRIM(COALESCE(v_ywblbzz, '')), '') IS NULL THEN
                    CONTINUE;
                END IF;

                BEGIN
                    v_gdz := CAST(v_ywblbzz AS NUMERIC);
                EXCEPTION
                    WHEN OTHERS THEN
                        CONTINUE;
                END;
            ELSE
                EXECUTE v_ywbljgz INTO v_gdz;
                INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
                VALUES (v_pcid, v_ywbljgz, '1', COALESCE(v_gdz::TEXT, ''));
            END IF;
        ELSE
            v_sqltj := '';

            FOR attr_rec IN
                SELECT
                    id,
                    sxly,
                    ywblbzyg,
                    ROW_NUMBER() OVER (ORDER BY id) AS sxh,
                    ywblbzsx
                  FROM gjj_ywbzksx
                 WHERE mbid = rec.mbid
                 ORDER BY id
            LOOP
                IF attr_rec.sxly = 'page' THEN
                    SELECT MAX(value)
                      INTO v_value
                      FROM tmp_gjj_ywblsxz
                     WHERE pcid = v_pcid
                       AND key = attr_rec.ywblbzsx;
                ELSE
                    v_ywblsql := f_gjj_prepare_exec_sql(
                        attr_rec.ywblbzyg,
                        v_jgbh,
                        v_zjgbh,
                        v_jcrid,
                        v_pcid,
                        v_ywblbzz,
                        NULL,
                        v_db_format
                    );

                    IF v_ywblsql IS NULL OR BTRIM(v_ywblsql) = '' THEN
                        CONTINUE;
                    END IF;

                    EXECUTE v_ywblsql INTO v_value;
                    INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
                    VALUES (v_pcid, v_ywblsql, '1', COALESCE(v_value, ''));
                END IF;

                IF v_value IS NULL OR BTRIM(v_value) = '' THEN
                    CONTINUE;
                END IF;

                IF POSITION(',' IN v_value) > 0 THEN
                    v_sqltj := v_sqltj || ' AND v' || attr_rec.sxh::TEXT || ' IN (' || v_value || ')';
                ELSE
                    v_sqltj := v_sqltj || ' AND ' || v_value || ' IN (SELECT arg_type FROM f_arg_list(a.v' || attr_rec.sxh::TEXT || ', '','', '''', ''''))';
                END IF;
            END LOOP;

            v_sqlcx := 'SELECT COUNT(*) FROM gjj_ywbzsx a WHERE ywid=' || rec.id::TEXT || v_sqltj;
            EXECUTE v_sqlcx INTO v_cnt;
            INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
            VALUES (v_pcid, v_sqlcx, '1', COALESCE(v_cnt::TEXT, '0'));

            IF v_cnt = 0 THEN
                CONTINUE;
            END IF;

            v_sql := 'SELECT CAST(result AS NUMERIC) FROM gjj_ywbzsx a WHERE ywid=' || rec.id::TEXT || v_sqltj || ' ORDER BY id LIMIT 1';
            EXECUTE v_sql INTO v_sxtjz;
            INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
            VALUES (v_pcid, v_sql, '1', COALESCE(v_sxtjz::TEXT, ''));

            v_ywbljgz := f_gjj_prepare_exec_sql(
                rec.ywbzjg,
                v_jgbh,
                v_zjgbh,
                v_jcrid,
                v_pcid,
                v_ywblbzz,
                COALESCE(v_sxtjz::TEXT, NULL),
                v_db_format
            );

            IF v_ywbljgz IS NULL OR BTRIM(v_ywbljgz) = '' THEN
                v_gdz := v_sxtjz;
            ELSE
                EXECUTE v_ywbljgz INTO v_gdz;
                INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
                VALUES (v_pcid, v_ywbljgz, '1', COALESCE(v_gdz::TEXT, ''));
            END IF;
        END IF;

        INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
        VALUES (v_pcid, COALESCE(v_gzmc, ''), '2', COALESCE(v_gdz::TEXT, ''));

        IF v_ywsf = '1' THEN
            IF v_bzfl = '1' THEN
                IF v_jcrzhye IS NULL OR v_jcrzhye = 0 THEN
                    v_jcrzhye := COALESCE(v_gdz, 0);
                ELSE
                    v_jcrzhye := LEAST(v_jcrzhye, COALESCE(v_gdz, 0));
                END IF;
            ELSIF v_bzfl = '2' THEN
                v_djje := GREATEST(COALESCE(v_djje, 0), COALESCE(v_gdz, 0));
            ELSIF v_bzfl = '3' THEN
                v_zhblje := GREATEST(COALESCE(v_zhblje, 0), COALESCE(v_gdz, 0));
            ELSIF v_bzfl = '4' THEN
                v_sjzfgfk := LEAST(COALESCE(v_sjzfgfk, 99999999999), COALESCE(v_gdz, 0));
            ELSIF v_bzfl = '5' THEN
                v_ljtqje := GREATEST(COALESCE(v_zhblje, 0), COALESCE(v_gdz, 0));
            ELSIF v_bzfl = '6' THEN
                IF v_gdz IS NOT NULL THEN
                    v_bljd := v_gdz;
                END IF;
            END IF;
        ELSIF v_ywsf = '2' THEN
            IF v_bzfl = '6' THEN
                BEGIN
                    IF NULLIF(BTRIM(COALESCE(v_ywblbzz, '')), '') IS NOT NULL THEN
                        v_bljd := CAST(v_ywblbzz AS NUMERIC);
                    END IF;
                EXCEPTION
                    WHEN OTHERS THEN
                        NULL;
                END;
            ELSIF v_bzfl = '7' THEN
                BEGIN
                    IF NULLIF(BTRIM(COALESCE(v_ywblbzz, '')), '') IS NOT NULL THEN
                        v_blfs := CAST(v_ywblbzz AS INTEGER);
                    END IF;
                EXCEPTION
                    WHEN OTHERS THEN
                        NULL;
                END;
            ELSE
                IF v_zgkde IS NULL THEN
                    v_zgkde := COALESCE(v_gdz, 0);
                ELSE
                    v_zgkde := LEAST(v_zgkde, COALESCE(v_gdz, 0));
                END IF;
            END IF;
        ELSIF v_ywsf = '3' THEN
            IF v_zgkdnx IS NULL THEN
                v_zgkdnx := COALESCE(v_gdz, 0);
            ELSE
                v_zgkdnx := LEAST(v_zgkdnx, COALESCE(v_gdz, 0));
            END IF;
        ELSE
            IF v_bzfl = '1' THEN
                IF v_jcrzhye IS NULL OR v_jcrzhye = 0 THEN
                    v_jcrzhye := COALESCE(v_gdz, 0);
                ELSE
                    v_jcrzhye := LEAST(v_jcrzhye, COALESCE(v_gdz, 0));
                END IF;
            ELSIF v_bzfl = '2' THEN
                v_djje := GREATEST(COALESCE(v_djje, 0), COALESCE(v_gdz, 0));
            ELSIF v_bzfl = '3' THEN
                v_zhblje := GREATEST(COALESCE(v_zhblje, 0), COALESCE(v_gdz, 0));
            ELSIF v_bzfl = '8' THEN
                v_zttqje := GREATEST(COALESCE(v_zttqje, 0), COALESCE(v_gdz, 0));
            END IF;
        END IF;
    END LOOP;

    IF v_ywsf = '1' THEN
        IF COALESCE(v_bljd, 1) = 1 THEN
            v_result := LEAST(
                COALESCE(v_jcrzhye, 0) - COALESCE(v_djje, 0) - COALESCE(v_zhblje, 0),
                COALESCE(v_sjzfgfk, 0) - COALESCE(v_ljtqje, 0)
            );
        ELSE
            v_result := TRUNC(
                LEAST(
                    COALESCE(v_jcrzhye, 0) - COALESCE(v_djje, 0) - COALESCE(v_zhblje, 0),
                    COALESCE(v_sjzfgfk, 0) - COALESCE(v_ljtqje, 0)
                ) / v_bljd
            ) * v_bljd;
        END IF;

        IF v_result <= 0 THEN
            v_result := 0;
        END IF;
    ELSIF v_ywsf = '2' THEN
        IF v_zgkde IS NULL THEN
            v_result := 0;
        ELSIF COALESCE(v_bljd, 1) = 0 THEN
            v_result := v_zgkde;
        ELSIF v_blfs = 1 THEN
            v_result := CEIL(v_zgkde / v_bljd) * v_bljd;
        ELSIF v_blfs = 3 THEN
            v_result := ROUND(v_zgkde / v_bljd, 0) * v_bljd;
        ELSE
            v_result := FLOOR(v_zgkde / v_bljd) * v_bljd;
        END IF;
    ELSIF v_ywsf = '3' THEN
        v_result := COALESCE(v_zgkdnx, 0);
    ELSE
        v_result := COALESCE(v_jcrzhye, 0) - COALESCE(v_djje, 0) - COALESCE(v_zttqje, 0) - COALESCE(v_zhblje, 0);
    END IF;

    INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
    VALUES (v_pcid, '最终执行结果', '2', COALESCE(v_result::TEXT, '0'));
EXCEPTION
    WHEN OTHERS THEN
        v_errormsg := SQLERRM;
        INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, zxjg)
        VALUES (v_pcid, '异常规则：' || COALESCE(v_gzmc, '') || '，异常语句：' || COALESCE(v_ywbljgz, ''), '1', '0');
        INSERT INTO t_wa_sys_log_err (err_date, name_proc, err_code, err_msg)
        VALUES (CURRENT_TIMESTAMP, 'p_gjj_get_mxywsfz', v_errorcode, COALESCE(v_ywbljgz, '') || v_errormsg || COALESCE(v_sql, ''));
        v_result := 0;
END;
$procedure$;
