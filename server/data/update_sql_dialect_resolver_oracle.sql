CREATE OR REPLACE FUNCTION f_gjj_get_sql_by_dialect(
    v_sql_config CLOB,
    v_db_type VARCHAR
) RETURN VARCHAR
AS
    v_preview VARCHAR2(32767);
    v_target VARCHAR2(200);
    v_sql_clob CLOB;
BEGIN
    IF v_sql_config IS NULL THEN
        RETURN NULL;
    END IF;

    v_preview := LTRIM(DBMS_LOB.SUBSTR(v_sql_config, 32767, 1));
    IF v_preview IS NULL THEN
        RETURN NULL;
    END IF;

    IF SUBSTR(v_preview, 1, 1) <> '[' THEN
        RETURN v_preview;
    END IF;

    v_target := LOWER(TRIM(v_db_type));

    BEGIN
        SELECT picked.sql_text
          INTO v_sql_clob
          FROM (
                SELECT jt.sql_text,
                       CASE
                           WHEN v_target IS NOT NULL AND LOWER(TRIM(jt.dialect)) = v_target THEN 1
                           WHEN LOWER(TRIM(jt.dialect)) = 'default' THEN 2
                           ELSE 9
                       END AS priority
                  FROM JSON_TABLE(
                           v_sql_config,
                           '$[*]'
                           COLUMNS (
                               dialect VARCHAR2(100 CHAR) PATH '$.dialect',
                               sql_text CLOB PATH '$.sql'
                           )
                       ) jt
                 WHERE (
                           v_target IS NOT NULL
                           AND LOWER(TRIM(jt.dialect)) = v_target
                       )
                    OR LOWER(TRIM(jt.dialect)) = 'default'
                 ORDER BY priority
               ) picked
         WHERE ROWNUM = 1;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN NULL;
    END;

    IF v_sql_clob IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN DBMS_LOB.SUBSTR(v_sql_clob, 32767, 1);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
/
