CREATE TABLE gjj_cxgzkz (
    id BIGINT AUTO_INCREMENT NOT NULL,
    jgbh VARCHAR2(50 CHAR),
    zjgbh VARCHAR2(50 CHAR),
    sxbh VARCHAR2(100 CHAR) NOT NULL,
    gzmc VARCHAR2(255 CHAR) NOT NULL,
    gztsy CLOB,
    sfqy VARCHAR2(10 CHAR) DEFAULT 'y',
    sfyxtqy VARCHAR2(10 CHAR) DEFAULT 'y',
    sfyxtztsy VARCHAR2(10 CHAR) DEFAULT 'n',
    role VARCHAR2(50 CHAR),
    CONSTRAINT pk_gjj_cxgzkz PRIMARY KEY (id)
);

CREATE INDEX idx_cxgzkz_jg ON gjj_cxgzkz (jgbh, zjgbh);
CREATE INDEX idx_cxgzkz_sxbh ON gjj_cxgzkz (sxbh);
