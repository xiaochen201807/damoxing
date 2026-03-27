CREATE TABLE IF NOT EXISTS public.gjj_cxgzkz (
    id BIGSERIAL PRIMARY KEY,
    jgbh CHARACTER VARYING(50),
    zjgbh CHARACTER VARYING(50),
    sxbh CHARACTER VARYING(100) NOT NULL,
    gzmc CHARACTER VARYING(255) NOT NULL,
    gztsy TEXT,
    sfqy CHARACTER VARYING(10) DEFAULT 'y',
    sfyxtqy CHARACTER VARYING(10) DEFAULT 'y',
    sfyxtztsy CHARACTER VARYING(10) DEFAULT 'n',
    role CHARACTER VARYING(50)
);

CREATE INDEX IF NOT EXISTS idx_cxgzkz_jg ON public.gjj_cxgzkz (jgbh, zjgbh);
CREATE INDEX IF NOT EXISTS idx_cxgzkz_sxbh ON public.gjj_cxgzkz (sxbh);

COMMENT ON TABLE public.gjj_cxgzkz IS '程序规则控制管理表';
COMMENT ON COLUMN public.gjj_cxgzkz.id IS '主键ID';
COMMENT ON COLUMN public.gjj_cxgzkz.jgbh IS '机构编号';
COMMENT ON COLUMN public.gjj_cxgzkz.zjgbh IS '子机构编号';
COMMENT ON COLUMN public.gjj_cxgzkz.sxbh IS '事项编号';
COMMENT ON COLUMN public.gjj_cxgzkz.gzmc IS '程序控制规则名称';
COMMENT ON COLUMN public.gjj_cxgzkz.gztsy IS '程序控制规则提示语';
COMMENT ON COLUMN public.gjj_cxgzkz.sfqy IS '是否启用';
COMMENT ON COLUMN public.gjj_cxgzkz.sfyxtqy IS '是否允许停启用';
COMMENT ON COLUMN public.gjj_cxgzkz.sfyxtztsy IS '是否允许调整提示语';
COMMENT ON COLUMN public.gjj_cxgzkz.role IS '角色';
