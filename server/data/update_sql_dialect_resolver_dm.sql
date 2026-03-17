CREATE OR REPLACE FUNCTION f_gjj_get_sql_by_dialect(
    v_sql_config CLOB,
    v_db_type VARCHAR
) RETURN VARCHAR
AS
    v_preview VARCHAR2(32767);
    v_target VARCHAR2(200);
    v_search_pos INTEGER := 1;
    v_key_pos INTEGER;
    v_colon_pos INTEGER;
    v_quote_pos INTEGER;
    v_char VARCHAR2(1);
    v_next_char VARCHAR2(1);
    v_current_dialect VARCHAR2(400);
    v_result VARCHAR2(32767);
    v_default_result VARCHAR2(32767);
    v_index INTEGER;
    v_length INTEGER;
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
    v_length := LENGTH(v_preview);

    WHILE v_search_pos <= v_length LOOP
        v_key_pos := INSTR(LOWER(v_preview), '"dialect"', v_search_pos);
        EXIT WHEN v_key_pos = 0;

        v_colon_pos := INSTR(v_preview, ':', v_key_pos + 9);
        EXIT WHEN v_colon_pos = 0;

        v_quote_pos := INSTR(v_preview, '"', v_colon_pos + 1);
        EXIT WHEN v_quote_pos = 0;

        v_current_dialect := '';
        v_index := v_quote_pos + 1;
        WHILE v_index <= v_length LOOP
            v_char := SUBSTR(v_preview, v_index, 1);
            IF v_char = '\' THEN
                v_index := v_index + 1;
                EXIT WHEN v_index > v_length;
                v_current_dialect := v_current_dialect || SUBSTR(v_preview, v_index, 1);
            ELSIF v_char = '"' THEN
                EXIT;
            ELSE
                v_current_dialect := v_current_dialect || v_char;
            END IF;
            v_index := v_index + 1;
        END LOOP;

        IF (v_target IS NOT NULL AND LOWER(TRIM(v_current_dialect)) = v_target)
           OR LOWER(TRIM(v_current_dialect)) = 'default' THEN
            v_key_pos := INSTR(LOWER(v_preview), '"sql"', v_index);
            EXIT WHEN v_key_pos = 0;

            v_colon_pos := INSTR(v_preview, ':', v_key_pos + 5);
            EXIT WHEN v_colon_pos = 0;

            v_quote_pos := INSTR(v_preview, '"', v_colon_pos + 1);
            EXIT WHEN v_quote_pos = 0;

            v_result := '';
            v_index := v_quote_pos + 1;
            WHILE v_index <= v_length LOOP
                v_char := SUBSTR(v_preview, v_index, 1);
                IF v_char = '\' THEN
                    v_index := v_index + 1;
                    EXIT WHEN v_index > v_length;
                    v_next_char := SUBSTR(v_preview, v_index, 1);

                    IF v_next_char = 'n' THEN
                        v_result := v_result || CHR(10);
                    ELSIF v_next_char = 'r' THEN
                        v_result := v_result || CHR(13);
                    ELSIF v_next_char = 't' THEN
                        v_result := v_result || CHR(9);
                    ELSE
                        v_result := v_result || v_next_char;
                    END IF;
                ELSIF v_char = '"' THEN
                    EXIT;
                ELSE
                    v_result := v_result || v_char;
                END IF;
                v_index := v_index + 1;
            END LOOP;

            IF v_result IS NOT NULL AND TRIM(v_result) IS NOT NULL THEN
                IF v_target IS NOT NULL AND LOWER(TRIM(v_current_dialect)) = v_target THEN
                    RETURN v_result;
                END IF;

                IF LOWER(TRIM(v_current_dialect)) = 'default' AND v_default_result IS NULL THEN
                    v_default_result := v_result;
                END IF;
            END IF;
        END IF;

        v_search_pos := v_index + 1;
    END LOOP;

    RETURN v_default_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
/
