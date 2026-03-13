-- Create table
create table GJJ_YWBLBZ_LOG
(
  pcid VARCHAR2(200) default ' ' not null,
  zxyj CLOB,
  cjsj TIMESTAMP(6) default SYSTIMESTAMP,
  yjlx VARCHAR2(10),
  zxjg VARCHAR2(200)
)
-- Add comments to the columns 
comment on column GJJ_YWBLBZ_LOG.pcid
  is '批次id';
comment on column GJJ_YWBLBZ_LOG.zxyj
  is '执行的sql语句';
comment on column GJJ_YWBLBZ_LOG.cjsj
  is '插入时间';
comment on column GJJ_YWBLBZ_LOG.yjlx
  is '日志类型，1--sql语句，2--标准结果';
comment on column GJJ_YWBLBZ_LOG.zxjg
  is '执行结果';
/
create table TMP_GJJ_YWBLSXZ
(
  pcid  VARCHAR2(200) default ' ' not null,
  key   VARCHAR2(200) default ' ' not null,
  value VARCHAR2(4000)
)
-- Add comments to the columns 
comment on column TMP_GJJ_YWBLSXZ.pcid
  is '批次id';
comment on column TMP_GJJ_YWBLSXZ.key
  is '属性key';
comment on column TMP_GJJ_YWBLSXZ.value
  is '属性值';
/

CREATE OR REPLACE FUNCTION f_gjj_get_mxywsfz_sxz(----获取模型业务算法值---页面属性值
v_pcid  varchar ,  --批次id
v_sxkey  varchar     --属性key
) return varchar
as
  v_result varchar2(2000);
begin
  select value into v_result from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_sxkey;
  return v_result;

end;
/
create or replace procedure p_gjj_get_mxywsfz(----获取模型业务算法值
v_ywsf  varchar ,  --业务算法，1-最大可提取额，2-最高可贷金额，3-最高可贷年限，4-借款人最大可对冲支取金额
v_ywnrfl  varchar,  --f_gjj_get_mxywsfz-业务内容分类，提取原因
v_jgbh varchar,     --机构编号
v_zjgbh varchar,    --子机构编号
v_pcid  varchar,     --批次id
v_result in out number
)
as
v_errorcode int;
v_errormsg varchar2(500);
  v_sql varchar2(3000);

  v_id number(20);
  v_ywblbzkid varchar2(2000);
  v_ywblbzz varchar2(2000);-----业务标准值
  v_ywblbzzbm varchar2(2000);------业务标准值编码
  v_bzfl  varchar2(2000);
  v_jcrzhye  decimal(18,2);--缴存人账户余额
  v_djje  decimal(18,2);--冻结金额
  v_zhblje  decimal(18,2);--账户保留金额
  v_sjzfgfk  decimal(18,2):=99999999999;--实际支付购房款
  v_ljtqje  decimal(18,2);--累计提取金额
  v_bljd  decimal(18,2):=1;--保留精度
  v_gdz  decimal(18,2);--过度值
  v_zttqje  decimal(18,2);--在途提取金额

  v_ywbzz  decimal(18,2);--业务标准值
  v_sxtjz  decimal(18,2);--通过属性判断得到的结果值
  v_sqlcx  varchar2(6000);
  v_sqltj  varchar2(6000);
  v_sqlsk  varchar2(6000);

  v_sqlsxz  varchar2(6000);
  v_gzmc  varchar2(2000);
  v_sxly  varchar2(6000);
  v_YWBLBZSX  varchar2(3000);
  v_ywblsql  varchar2(3000);
  v_sql_bz  varchar2(3000);
  v_ywbljgz  varchar2(3000);
  v_value  varchar2(300);
  v_sxh  varchar2(30);
  v_qycode  varchar2(30);
  v_cnt integer;
  v_cntsx  integer;
  v_jcrid number(20);
  v_sxzid  number(20);
  v_sfqjgz integer;
  v_zgkde  decimal(18,2);--过度值
  v_blfs  integer:=2;----1向上取整,    2向下取整,   3四舍五入）
  v_zgkdnx  number(20);-----最高可贷年限
  TYPE ref_cursor_type IS REF CURSOR;
  tmp_cur  ref_cursor_type;
  tmp_cur_sxz  ref_cursor_type;----业务办理标准属性组

begin
  ------测试能不能冲临时表取值
/*  select nvl(max(value),0) into v_result from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key like '%sjdxsl';
  return v_result;*/
  ----测试结束
  ------从临时表中，此临时表保存平台传入的所有属性的key和value，查询缴存人id,
  select nvl(max(value),0) into v_jcrid from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key<>'dx_03124_sjdxsl' and (key like '%sjdxsl' or key='dx_03124_id') ;
  v_sfqjgz:=0;

  if v_ywsf='1' THEN--最大可提取额
        -----查询模型业务算法配置
        ------GJJ_YWBZ   模型业务算法配置
        -----GJJ_YWBZSX    模型业务算法配置明细
        -------gjj_ywbzk    业务办理标准库
        --------gjj_ywbzksx     业务办理标准属性明细

        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and a.YWNRFL='''||v_ywnrfl||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
                 -----------由于“业务模型标准数值定义”中修改了标准值之后无法更新业务标准值，所以需要通过标准值编码实时查询标准值
                 if v_ywblbzzbm is not null then
                   ----------查询qycode
                   v_sql_bz:='select dx_01_zjbzxbm from pt_dxsl_'||v_jgbh||'_01 where dx_01_dxbh='''||v_zjgbh||'''';
                   execute immediate v_sql_bz into v_qycode;
                   v_qycode:=substr(v_qycode,2);
                   ----------根据qycode查询子机构是否配置了参数
                   v_sql_bz:='select count(pdgm.id) from pt_dx_ggcs_mx pdgm 
                   left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                   where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                   and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                   execute immediate v_sql_bz into v_cnt;
                   if v_cnt > 0 then-----按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   else----未按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh = '''||v_jgbh||''' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs = '''||v_ywblbzzbm||''' and pdgm.cs=''cs1''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   end if;
                   
                 else
                   v_ywblbzz:='';
                 end if;
                  --------查询有没有配置详细参数配置
                  select count(id) into v_cntsx from GJJ_YWBZSX a where ywid=v_id;
                  if v_cntsx = 0 then----没有配置详细参数配置
                    ----判断有没有业务标准库中有没有业务标准结果SQL
                    if trim(v_ywbljgz) is null THEN----没有配置sql，直接拿标准值作为结果
                      v_gdz:=v_ywblbzz;
                    ELSE-----配置了sql
                      ----判断sql中是否配置了v_mxywblbzb
                      if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----如果包含v_mxywblbzb，替换业务标准值，执行语句作为结果
                        if v_ywblbzz is null then-----业务标准值没有，则跳过此标准
                          continue;
                        end if;
                        v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                             if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                             ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                             end if;
                                         else---sql结果
                                            if trim(v_ywblsql) is null THEN
                                              continue;
                                            end if;
                                            v_ywblsql:=replace(v_ywblsql,'v_jgbh',v_jgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_zjgbh',v_zjgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_jcrid',v_jcrid);
                                            v_ywblsql:=replace(v_ywblsql,'v_pcid',''''||v_pcid||'''');
                                            
                                            execute immediate v_ywblsql  into v_value;
                                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywblsql,'1',v_value);
                                            if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                            ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                            end if;
                                         end if;

                                    end loop;

                                 close tmp_cur_sxz;
                       ------查询是否能匹配到明细
                       v_sqlcx:='select count(*) from GJJ_YWBZSX a where ywid= '||v_id;
                       
                       execute immediate v_sqlcx||v_sqltj  into v_cnt;
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sqlcx||v_sqltj,'1',v_cnt);
                       if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;
                          
                          execute immediate v_sql  into v_sxtjz;
                          insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sql,'1',v_sxtjz);
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                          ELSE-----如果有业务标准结果SQL
                            -----判断sql中是否配置了v_mxywblbzb
                            if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----替换业务标准值
                               if v_ywblbzz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                             end if;
                             -----判断sql中是否配置了v_result
                             if INSTR(v_ywbljgz, 'v_result') >0 then-----替换属性结果值
                               if v_sxtjz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_result',v_sxtjz);
                             end if;
                             v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                             v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                             
                             ------执行语句作为结果
                             execute immediate v_ywbljgz  into v_gdz;
                             insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                          end if;
                       end if;
                    end if;
              -------插入标准执行结果
              insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_gzmc,'2',v_gdz);
                  --------取值结束
              if v_bzfl='1' THEN-----缴存人账户余额----取最小值
                if v_jcrzhye is null then
                  v_jcrzhye:=v_gdz;
                ELSE
                  v_jcrzhye:=LEAST(v_jcrzhye,v_gdz);
                end if;
              elsif  v_bzfl='2' THEN----冻结金额---取最大值
                if v_djje is null then
                  v_djje:=v_gdz;
                ELSE
                  v_djje:=greatest(v_djje,v_gdz);
                end if;

              elsif  v_bzfl='3' THEN-----账户保留金额---取最大值
                if v_zhblje is null then
                  v_zhblje:=v_gdz;
                ELSE
                  v_zhblje:=greatest(v_zhblje,v_gdz);
                end if;
              elsif  v_bzfl='4' THEN-----实际支付购房款---取最小值
                if v_sjzfgfk is null then
                  v_sjzfgfk:=v_gdz;
                ELSE
                  v_sjzfgfk:=LEAST(v_sjzfgfk,v_gdz);
                end if;
              elsif  v_bzfl='5' THEN-----累计提取金额---取最大值
                if v_ljtqje is null then
                  v_ljtqje:=v_gdz;
                ELSE
                  v_ljtqje:=greatest(v_zhblje,v_gdz);
                end if;
              elsif  v_bzfl='6' THEN-----精度值
                if trim(v_gdz) is not null THEN
                  --v_gdz:=v_ywblbzz;
                  v_bljd:=v_gdz;
                end if;
              end if;

          end loop;

        close tmp_cur;
        if v_jcrzhye is null then
          v_jcrzhye:=0;
        end if;
        if v_djje is null then
          v_djje:=0;
        end if;
        if v_zhblje is null then
          v_zhblje:=0;
        end if;
        if v_sjzfgfk is null then
          v_sjzfgfk:=0;
        end if;
        if v_ljtqje is null then
          v_ljtqje:=0;
        end if;
      --fn=min(（缴存人账户余额-冻结金额-保留金额）,（材料提取限额-材料累计提取金额）)*计算精度
        if v_bljd=1 then
          v_result:=LEAST(v_jcrzhye-v_djje-v_zhblje,v_sjzfgfk-v_ljtqje);
        else
          v_result:=trunc(LEAST(v_jcrzhye-v_djje-v_zhblje,v_sjzfgfk-v_ljtqje)/v_bljd)*v_bljd;
        end if;
        if v_result<=0 then
          v_result:=0;
        end if;

  elsif v_ywsf='2' THEN--最高可贷金额
        -----查询模型业务算法配置
        ------GJJ_YWSFPZ   模型业务算法配置
        -----GJJ_YWSFPZ_MX    模型业务算法配置明细
        -------gjj_ywblbzk    业务办理标准库
        --------GJJ_YWBLBZK_SHUXING     业务办理标准属性明细

        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
                 -----------由于“业务模型标准数值定义”中修改了标准值之后无法更新业务标准值，所以需要通过标准值编码实时查询标准值
                 if v_ywblbzzbm is not null then
                   ----------查询qycode
                   v_sql_bz:='select dx_01_zjbzxbm from pt_dxsl_'||v_jgbh||'_01 where dx_01_dxbh='''||v_zjgbh||'''';
                   execute immediate v_sql_bz into v_qycode;
                   v_qycode:=substr(v_qycode,2);
                   ----------根据qycode查询子机构是否配置了参数
                   v_sql_bz:='select count(pdgm.id) from pt_dx_ggcs_mx pdgm 
                   left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                   where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                   and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                   execute immediate v_sql_bz into v_cnt;
                   if v_cnt > 0 then-----按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   else----未按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh = '''||v_jgbh||''' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs = '''||v_ywblbzzbm||''' and pdgm.cs=''cs1''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   end if;
                   
                 else
                   v_ywblbzz:='';
                 end if;
                  --------查询有没有配置详细参数配置
                  select count(id) into v_cntsx from GJJ_YWBZSX a where ywid=v_id;
                  if v_cntsx = 0 then----没有配置详细参数配置
                    ----判断有没有业务标准库中有没有业务标准结果SQL
                    if trim(v_ywbljgz) is null THEN----没有配置sql，直接拿标准值作为结果
                      v_gdz:=v_ywblbzz;
                    ELSE-----配置了sql
                      ----判断sql中是否配置了v_mxywblbzb
                      if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----如果包含v_mxywblbzb，替换业务标准值，执行语句作为结果
                        if v_ywblbzz is null then-----业务标准值没有，则跳过此标准
                          continue;
                        end if;
                        v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                             if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                             ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                             end if;
                                         else---sql结果
                                            if trim(v_ywblsql) is null THEN
                                              continue;
                                            end if;
                                            v_ywblsql:=replace(v_ywblsql,'v_jgbh',v_jgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_zjgbh',v_zjgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_jcrid',v_jcrid);
                                            v_ywblsql:=replace(v_ywblsql,'v_pcid',''''||v_pcid||'''');
                                            
                                            execute immediate v_ywblsql  into v_value;
                                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywblsql,'1',v_value);
                                            if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                            ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                            end if;
                                         end if;

                                    end loop;

                                 close tmp_cur_sxz;
                       ------查询是否能匹配到明细
                       v_sqlcx:='select count(*) from GJJ_YWBZSX a where ywid= '||v_id;
                       
                       execute immediate v_sqlcx||v_sqltj  into v_cnt;
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sqlcx||v_sqltj,'1',v_cnt);
                       if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;
                          
                          execute immediate v_sql  into v_sxtjz;
                          insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sql,'1',v_sxtjz);
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                          ELSE-----如果有业务标准结果SQL
                            -----判断sql中是否配置了v_mxywblbzb
                            if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----替换业务标准值
                               if v_ywblbzz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                             end if;
                             -----判断sql中是否配置了v_result
                             if INSTR(v_ywbljgz, 'v_result') >0 then-----替换属性结果值
                               if v_sxtjz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_result',v_sxtjz);
                             end if;
                             v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                             v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                             
                             ------执行语句作为结果
                             execute immediate v_ywbljgz  into v_gdz;
                             insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                          end if;
                       end if;
                    end if;
              -------插入标准执行结果
              insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_gzmc,'2',v_gdz);
                  --------取值结束
              if  v_bzfl='6' THEN-----精度值
                if trim(v_ywblbzz) is not null THEN
                  v_gdz:=v_ywblbzz;
                  v_bljd:=v_gdz;
                end if;
              elsif v_bzfl='7' THEN-----保留方式
                if trim(v_ywblbzz) is not null THEN
                  v_gdz:=v_ywblbzz;
                  v_blfs:=v_gdz;
                end if;
              else-------最高可贷额
                if v_zgkde is null then
                  v_zgkde:=v_gdz;
                ELSE
                  v_zgkde:=LEAST(v_zgkde,v_gdz);
                end if;
              end if;

          end loop;

        close tmp_cur;
        v_result:=trunc(v_zgkde/v_bljd)*v_bljd;
        if v_blfs=1 then-----向上取整
          v_result:=ceil(v_zgkde/v_bljd)*v_bljd;
        elsif v_blfs=3 then-------四舍五入
          v_result:=round(v_zgkde/v_bljd,0)*v_bljd;
        else------向下取整
          v_result:=floor(v_zgkde/v_bljd)*v_bljd;
        end if;

  elsif v_ywsf='3' THEN--最高可贷年
        -----查询模型业务算法配置
        ------GJJ_YWSFPZ   模型业务算法配置
        -----GJJ_YWSFPZ_MX    模型业务算法配置明细
        -------gjj_ywblbzk    业务办理标准库
        --------GJJ_YWBLBZK_SHUXING     业务办理标准属性明细

        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
                 -----------由于“业务模型标准数值定义”中修改了标准值之后无法更新业务标准值，所以需要通过标准值编码实时查询标准值
                 if v_ywblbzzbm is not null then
                   ----------查询qycode
                   v_sql_bz:='select dx_01_zjbzxbm from pt_dxsl_'||v_jgbh||'_01 where dx_01_dxbh='''||v_zjgbh||'''';
                   execute immediate v_sql_bz into v_qycode;
                   v_qycode:=substr(v_qycode,2);
                   ----------根据qycode查询子机构是否配置了参数
                   v_sql_bz:='select count(pdgm.id) from pt_dx_ggcs_mx pdgm 
                   left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                   where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                   and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                   execute immediate v_sql_bz into v_cnt;
                   if v_cnt > 0 then-----按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   else----未按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh = '''||v_jgbh||''' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs = '''||v_ywblbzzbm||''' and pdgm.cs=''cs1''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   end if;
                   
                 else
                   v_ywblbzz:='';
                 end if;
                  --------查询有没有配置详细参数配置
                  select count(id) into v_cntsx from GJJ_YWBZSX a where ywid=v_id;
                  if v_cntsx = 0 then----没有配置详细参数配置
                    ----判断有没有业务标准库中有没有业务标准结果SQL
                    if trim(v_ywbljgz) is null THEN----没有配置sql，直接拿标准值作为结果
                      v_gdz:=v_ywblbzz;
                    ELSE-----配置了sql
                      ----判断sql中是否配置了v_mxywblbzb
                      if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----如果包含v_mxywblbzb，替换业务标准值，执行语句作为结果
                        if v_ywblbzz is null then-----业务标准值没有，则跳过此标准
                          continue;
                        end if;
                        v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                             if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                             ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                             end if;
                                         else---sql结果
                                            if trim(v_ywblsql) is null THEN
                                              continue;
                                            end if;
                                            v_ywblsql:=replace(v_ywblsql,'v_jgbh',v_jgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_zjgbh',v_zjgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_jcrid',v_jcrid);
                                            v_ywblsql:=replace(v_ywblsql,'v_pcid',''''||v_pcid||'''');
                                            
                                            execute immediate v_ywblsql  into v_value;
                                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywblsql,'1',v_value);
                                            if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                            ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                            end if;
                                         end if;

                                    end loop;

                                 close tmp_cur_sxz;
                       ------查询是否能匹配到明细
                       v_sqlcx:='select count(*) from GJJ_YWBZSX a where ywid= '||v_id;
                       
                       execute immediate v_sqlcx||v_sqltj  into v_cnt;
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sqlcx||v_sqltj,'1',v_cnt);
                       if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;
                          
                          execute immediate v_sql  into v_sxtjz;
                          insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sql,'1',v_sxtjz);
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                          ELSE-----如果有业务标准结果SQL
                            -----判断sql中是否配置了v_mxywblbzb
                            if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----替换业务标准值
                               if v_ywblbzz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                             end if;
                             -----判断sql中是否配置了v_result
                             if INSTR(v_ywbljgz, 'v_result') >0 then-----替换属性结果值
                               if v_sxtjz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_result',v_sxtjz);
                             end if;
                             v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                             v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                             
                             ------执行语句作为结果
                             execute immediate v_ywbljgz  into v_gdz;
                             insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                          end if;
                       end if;
                    end if;
              -------插入标准执行结果
              insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_gzmc,'2',v_gdz);
                  --------取值结束
              -------最高可贷年限
              if v_zgkdnx is null then
                  v_zgkdnx:=v_gdz;
                ELSE
                  v_zgkdnx:=LEAST(v_zgkdnx,v_gdz);
                end if;

          end loop;

        close tmp_cur;
        v_result:=v_zgkdnx;
  ELSE--借款人最大可对冲支取金额
        -----查询模型业务算法配置
        ------GJJ_YWSFPZ   模型业务算法配置
        -----GJJ_YWSFPZ_MX    模型业务算法配置明细
        -------gjj_ywblbzk    业务办理标准库
        --------GJJ_YWBLBZK_SHUXING     业务办理标准属性明细

        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
                 -----------由于“业务模型标准数值定义”中修改了标准值之后无法更新业务标准值，所以需要通过标准值编码实时查询标准值
                 if v_ywblbzzbm is not null then
                   ----------查询qycode
                   v_sql_bz:='select dx_01_zjbzxbm from pt_dxsl_'||v_jgbh||'_01 where dx_01_dxbh='''||v_zjgbh||'''';
                   execute immediate v_sql_bz into v_qycode;
                   v_qycode:=substr(v_qycode,2);
                   ----------根据qycode查询子机构是否配置了参数
                   v_sql_bz:='select count(pdgm.id) from pt_dx_ggcs_mx pdgm 
                   left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                   where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                   and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                   execute immediate v_sql_bz into v_cnt;
                   if v_cnt > 0 then-----按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh like '''||v_jgbh||'%'' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs like '''||v_ywblbzzbm||'%'' and pdgm.cs=''cs1'' and pdgm.jgbs='''||v_qycode||'''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   else----未按照子机构配置
                     v_sql_bz:='select max(pdgm.csz) from pt_dx_ggcs_mx pdgm 
                     left join pt_dx_ggcs pdg on pdgm.ggcs_wybs=pdg.ggcs_wybs 
                     where pdgm.jgbh = '''||v_jgbh||''' and pdg.jgbh='''||v_jgbh||''' 
                     and pdgm.ggcs_wybs = '''||v_ywblbzzbm||''' and pdgm.cs=''cs1''';
                     execute immediate v_sql_bz into v_ywblbzz;
                   end if;
                   
                 else
                   v_ywblbzz:='';
                 end if;
                  --------查询有没有配置详细参数配置
                  select count(id) into v_cntsx from GJJ_YWBZSX a where ywid=v_id;
                  if v_cntsx = 0 then----没有配置详细参数配置
                    ----判断有没有业务标准库中有没有业务标准结果SQL
                    if trim(v_ywbljgz) is null THEN----没有配置sql，直接拿标准值作为结果
                      v_gdz:=v_ywblbzz;
                    ELSE-----配置了sql
                      ----判断sql中是否配置了v_mxywblbzb
                      if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----如果包含v_mxywblbzb，替换业务标准值，执行语句作为结果
                        if v_ywblbzz is null then-----业务标准值没有，则跳过此标准
                          continue;
                        end if;
                        v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                        
                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                             if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                             ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                             end if;
                                         else---sql结果
                                            if trim(v_ywblsql) is null THEN
                                              continue;
                                            end if;
                                            v_ywblsql:=replace(v_ywblsql,'v_jgbh',v_jgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_zjgbh',v_zjgbh);
                                            v_ywblsql:=replace(v_ywblsql,'v_jcrid',v_jcrid);
                                            v_ywblsql:=replace(v_ywblsql,'v_pcid',''''||v_pcid||'''');
                                            
                                            execute immediate v_ywblsql  into v_value;
                                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywblsql,'1',v_value);
                                            if instr(v_value,',') > 0 THEN------条件右边带,表示，入参多选，需要支持支持等号右边多选
                                             -----支持等号右边多选
                                             v_sqltj:=v_sqltj||' and v'||v_sxh||' in ('||v_value||')';
                                            ELSE---支持等号左边多选
                                             ---支持等号左边多选
                                             v_sqltj:=v_sqltj||' and '||v_value||' in (select arg_type from table(f_arg_list(a.v'||v_sxh||','''','','')))';
                                            end if;
                                         end if;

                                    end loop;

                                 close tmp_cur_sxz;
                       ------查询是否能匹配到明细
                       v_sqlcx:='select count(*) from GJJ_YWBZSX a where ywid= '||v_id;
                       
                       execute immediate v_sqlcx||v_sqltj  into v_cnt;
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sqlcx||v_sqltj,'1',v_cnt);
                       if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;
                          
                          execute immediate v_sql  into v_sxtjz;
                          insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sql,'1',v_sxtjz);
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                          ELSE-----如果有业务标准结果SQL
                            -----判断sql中是否配置了v_mxywblbzb
                            if INSTR(v_ywbljgz, 'v_mxywblbzb') >0 then-----替换业务标准值
                               if v_ywblbzz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_mxywblbzb',v_ywblbzz);
                             end if;
                             -----判断sql中是否配置了v_result
                             if INSTR(v_ywbljgz, 'v_result') >0 then-----替换属性结果值
                               if v_sxtjz is null then
                               continue;

                               end if;
                               v_ywbljgz:=replace(v_ywbljgz,'v_result',v_sxtjz);
                             end if;
                             v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                             v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                             v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');
                             
                             ------执行语句作为结果
                             execute immediate v_ywbljgz  into v_gdz;
                             insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_ywbljgz,'1',v_gdz);
                          end if;
                       end if;
                    end if;
              -------插入标准执行结果
              insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_gzmc,'2',v_gdz);
                  --------取值结束
              if v_bzfl='1' THEN-----缴存人账户余额----取最小值
                if v_jcrzhye is null then
                  v_jcrzhye:=v_gdz;
                ELSE
                  v_jcrzhye:=LEAST(v_jcrzhye,v_gdz);
                end if;
              elsif  v_bzfl='2' THEN----冻结金额---取最大值
                if v_djje is null then
                  v_djje:=v_gdz;
                ELSE
                  v_djje:=greatest(v_djje,v_gdz);
                end if;

              elsif  v_bzfl='3' THEN-----账户保留金额---取最大值
                if v_zhblje is null then
                  v_zhblje:=v_gdz;
                ELSE
                  v_zhblje:=greatest(v_zhblje,v_gdz);
                end if;
              elsif  v_bzfl='8' THEN-----在途提取金额---取最大值
                if v_zttqje is null then
                  v_zttqje:=v_gdz;
                ELSE
                  v_zttqje:=greatest(v_zttqje,v_gdz);
                end if;
              end if;

          end loop;

        close tmp_cur;
        if v_jcrzhye is null then
          v_jcrzhye:=0;
        end if;
        if v_djje is null then
          v_djje:=0;
        end if;
        if v_zhblje is null then
          v_zhblje:=0;
        end if;
        if v_zttqje is null then
          v_zttqje:=0;
        end if;

      --fn=最高可支取金额为缴存人个人账户余额-冻结金额-在途提取金额-账户保留金额
        v_result:=v_jcrzhye-v_djje-v_zttqje-v_zhblje;
  end if;
  -------日志表插入执行结果
  insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,'最终执行结果','2',v_result);
  commit;
exception
  when others then
    v_errorcode:= sqlcode;
      v_errormsg := sqlerrm;
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,'异常规则：'||v_gzmc||'，异常语句：'||v_ywbljgz,'1',0);
    insert into t_wa_sys_log_err(err_date,name_proc,err_code,err_msg)
                 values(sysdate,'p_gjj_get_mxywsfz',v_errorcode,v_ywbljgz||v_errormsg || dbms_utility.format_error_backtrace() || v_sql);
    commit;
v_result:=0;
end;
/
