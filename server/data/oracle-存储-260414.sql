create or replace procedure p_gjj_get_mxywsfz_1(----最大可提取额
v_ywsf  varchar ,  --业务算法 
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
  v_sxbm  varchar2(200);
  v_sxnr  varchar2(200);
  v_tsysxmc  varchar2(200);
  v_tsysxdw  varchar2(200);
  v_sx_xzfw varchar2(2000):='';
  v_sfxs varchar2(2); 
  TYPE ref_cursor_type IS REF CURSOR;
  tmp_cur  ref_cursor_type;
  tmp_cur_sxz  ref_cursor_type;----业务办理标准属性组


begin
       select nvl(max(value),0) into v_jcrid from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key<>'dx_03124_sjdxsl' and (key like '%sjdxsl' or key='dx_03124_id') ;
        v_sfqjgz:=0;
        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc,b.tsysxmc,b.tsysxdw from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and a.YWNRFL='''||v_ywnrfl||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc,v_tsysxmc,v_tsysxdw;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
            --判断是否配置提示语 和提示语单位 1 是 0否
            if trim(v_tsysxmc) is not null and  trim(v_tsysxdw) is not null then 
              v_sfxs:='1'; --是
            else
              v_sfxs:='0';--否
            end if;  
            
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
                      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);

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
                     
                       	 insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                   
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');

                        execute immediate v_ywbljgz  into v_gdz;                       
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,sxbm,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_sxbm,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;
                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                             --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                                                                     
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
                                         
                                           --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                         
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
                    --   insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sqlcx||v_sqltj,'1',v_cnt);
                       if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;

                          execute immediate v_sql  into v_sxtjz;
                          --insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr) values(v_pcid,v_sql,'1',v_sxtjz,,v_tsysxmc||v_gdz||v_tsysxmc);
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_sql,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                          end if;
                       end if;
                    end if;
          
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
        
          -------日志表插入执行结果
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,'最终执行结果','3',v_result,v_result,'1');
      commit;
  
exception
  when others then
    v_errorcode:= sqlcode;
      v_errormsg := sqlerrm;
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,'异常规则：'||v_gzmc||'，异常语句：'||v_ywbljgz,'1',0);
    insert into t_wa_sys_log_err(err_date,name_proc,err_code,err_msg)
                 values(sysdate,'p_gjj_get_mxywsfz_1',v_errorcode,v_ywbljgz||v_errormsg || dbms_utility.format_error_backtrace() || v_sql);
    commit;
v_result:=0;
end;

/
create or replace procedure p_gjj_get_mxywsfz_2(----最高可贷金额
v_ywsf  varchar ,  --业务算法
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
  v_sxbm  varchar2(200);
  v_sxnr  varchar2(200);
  v_tsysxmc  varchar2(200);
  v_tsysxdw  varchar2(200);
  v_sx_xzfw varchar2(2000):='';
  v_sfxs varchar2(2); 
  
  TYPE ref_cursor_type IS REF CURSOR;
  tmp_cur  ref_cursor_type;
  tmp_cur_sxz  ref_cursor_type;----业务办理标准属性组


begin
        ------从临时表中，此临时表保存平台传入的所有属性的key和value，查询缴存人id,
        select nvl(max(value),0) into v_jcrid from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key<>'dx_03124_sjdxsl' and (key like '%sjdxsl' or key='dx_03124_id') ;
        v_sfqjgz:=0;
        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc,b.tsysxmc,b.tsysxdw  from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc,v_tsysxmc,v_tsysxdw;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
              --判断是否配置提示语 和提示语单位 1 是 0否
            if trim(v_tsysxmc) is not null and  trim(v_tsysxdw) is not null then 
              v_sfxs:='1'; --是
            else
              v_sfxs:='0';--否
            end if;
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
                      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);  
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');

                        execute immediate v_ywbljgz  into v_gdz;
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,sxbm,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_sxbm,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                              --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                              
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
                                             --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                              
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
--                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,v_sqlcx||v_sqltj,'1',v_cnt);
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
                           insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_sql,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
                             insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                          end if;
                       end if;
                    end if;
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
     -------日志表插入执行结果
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,'最终执行结果','3',v_result,v_result,'1');
      commit;
exception
  when others then
    v_errorcode:= sqlcode;
      v_errormsg := sqlerrm;
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,'异常规则：'||v_gzmc||'，异常语句：'||v_ywbljgz,'1',0);
    insert into t_wa_sys_log_err(err_date,name_proc,err_code,err_msg)
                 values(sysdate,'p_gjj_get_mxywsfz_2',v_errorcode,v_ywbljgz||v_errormsg || dbms_utility.format_error_backtrace() || v_sql);
    commit;
v_result:=0;
end;

/
create or replace procedure p_gjj_get_mxywsfz_3(----最高可贷年
v_ywsf  varchar ,  --业务算法
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
  v_sxbm  varchar2(200);
  v_sxnr  varchar2(200);
  v_tsysxmc  varchar2(200);
  v_tsysxdw  varchar2(200);
  v_sx_xzfw varchar2(2000):='';
  v_sfxs varchar2(2); 
  v_zgkdnx  number(20);-----最高可贷年限
  TYPE ref_cursor_type IS REF CURSOR;
  tmp_cur  ref_cursor_type;
  tmp_cur_sxz  ref_cursor_type;----业务办理标准属性组


begin
       select nvl(max(value),0) into v_jcrid from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key<>'dx_03124_sjdxsl' and (key like '%sjdxsl' or key='dx_03124_id') ;
        v_sfqjgz:=0;
        v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc,b.tsysxmc,b.tsysxdw from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc,v_tsysxmc,v_tsysxdw;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
                --判断是否配置提示语 和提示语单位 1 是 0否
            if trim(v_tsysxmc) is not null and  trim(v_tsysxdw) is not null then 
              v_sfxs:='1'; --是
            else
              v_sfxs:='0';--否
            end if;  
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
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
                       	 insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');

                        execute immediate v_ywbljgz  into v_gdz;
                       	 insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,sxbm,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_sxbm,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                             
                                               --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                              
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
                                              --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                              
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
                       if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;

                          execute immediate v_sql  into v_sxtjz;
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_sql,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);

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
                             insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                          end if;
                       end if;
                    end if;
             
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
                 -------日志表插入执行结果
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,'最终执行结果','3',v_result,v_result,'1');
      commit;
exception
  when others then
    v_errorcode:= sqlcode;
      v_errormsg := sqlerrm;
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,'异常规则：'||v_gzmc||'，异常语句：'||v_ywbljgz,'1',0);
    insert into t_wa_sys_log_err(err_date,name_proc,err_code,err_msg)
                 values(sysdate,'p_gjj_get_mxywsfz_3',v_errorcode,v_ywbljgz||v_errormsg || dbms_utility.format_error_backtrace() || v_sql);
    commit;
v_result:=0;
end;

/
create or replace procedure p_gjj_get_mxywsfz_4(--借款人最大可对冲支取金额
v_ywsf  varchar ,  --业务算法
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
  v_sxbm  varchar2(200);
  v_sxnr  varchar2(200);
  v_tsysxmc  varchar2(200);
  v_tsysxdw  varchar2(200);
  v_sx_xzfw varchar2(2000):='';
  v_sfxs varchar2(2); 
  TYPE ref_cursor_type IS REF CURSOR;
  tmp_cur  ref_cursor_type;
  tmp_cur_sxz  ref_cursor_type;----业务办理标准属性组


begin
    select nvl(max(value),0) into v_jcrid from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key<>'dx_03124_sjdxsl' and (key like '%sjdxsl' or key='dx_03124_id') ;
        v_sfqjgz:=0;
         v_sqlsk:='select a.id,a.mbid,b.ywbzz,b.BZFL,b.YWBZJG,a.gzmc,b.tsysxmc,b.tsysxdw  from GJJ_YWBZ a left join gjj_ywbzk b on a.mbid=b.id
        where a.YWSF='''||v_ywsf||''' and zjgbh='''||v_zjgbh||''' order by a.id';
        open tmp_cur for v_sqlsk ;
          loop
            fetch tmp_cur into v_id,v_ywblbzkid,v_ywblbzzbm,v_bzfl,v_ywbljgz,v_gzmc,v_tsysxmc,v_tsysxdw;----循环模型业务算法配置
            exit when tmp_cur%notfound;
            --------取值开始
              --判断是否配置提示语 和提示语单位 1 是 0否
            if trim(v_tsysxmc) is not null and  trim(v_tsysxdw) is not null then 
              v_sfxs:='1'; --是
            else
              v_sfxs:='0';--否
            end if;  
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
                       insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                      ELSE-----不包含v_mxywblbzb，执行语句作为结果
                        v_ywbljgz:=replace(v_ywbljgz,'v_jgbh',v_jgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_zjgbh',v_zjgbh);
                        v_ywbljgz:=replace(v_ywbljgz,'v_jcrid',v_jcrid);
                        v_ywbljgz:=replace(v_ywbljgz,'v_pcid',''''||v_pcid||'''');

                        execute immediate v_ywbljgz  into v_gdz;
                        insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
                      end if;
                    end if;
                   ELSE-------配置了详细参数配置
                        ----循环属性，拼接sql语句，匹配结果
                        v_sqlsxz:= 'select id,SXLY,YWBLBZYG,rownum,sxbm,ywblbzsx from gjj_ywbzksx a where mbid='''||v_ywblbzkid||''' order by id';
                        v_sqltj:='';
                        open tmp_cur_sxz for v_sqlsxz ;
                             loop
                                    fetch tmp_cur_sxz into v_sxzid,v_sxly,v_ywblsql,v_sxh,v_sxbm,v_YWBLBZSX;----循环模型业务算法配置。组装查询条件
                                    exit when tmp_cur_sxz%notfound;

                                         if v_sxly='page' then---页面值
                                             select max(value) into v_value from TMP_GJJ_YWBLSXZ where pcid=v_pcid and key=v_YWBLBZSX;
                                         
                                           --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;   
                                         
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
                                            
                                              --xzfw 属性取值
                                             select count(*) into v_cnt from   pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                             if v_cnt<>0 then
                                              select    listagg(v_sxbm||'为'||mc, ',') WITHIN GROUP (ORDER BY bm) into v_sxnr from  
                                              pt_dx_shuxing_xzfw where jgbh=v_jgbh and zdbs=v_YWBLBZSX and bm in(v_value);
                                                v_sx_xzfw:=v_sx_xzfw||v_sxnr||',';
                                              else
                                                v_sx_xzfw:=v_sx_xzfw||v_value||',';
                                              end if;
                                            
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
                        if v_cnt=0 THEN--如果没有匹配到明细，直接跳过此标准
                          CONTINUE;

                       ELSE-------匹配到明细，拿明细的结果值
                          ----查询明细结果
                          v_sql:='select TO_NUMBER(result) from GJJ_YWBZSX a where ywid= '||v_id||v_sqltj;

                          execute immediate v_sql  into v_sxtjz;
                          -----如果没有业务标准结果SQL，直接拿明细的结果值
                          if trim(v_ywbljgz) is null THEN
                            v_gdz:=v_sxtjz;
                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_sql,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
                            insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,v_ywbljgz,'1',v_gdz,v_sx_xzfw||v_tsysxmc||'为'||v_gdz||v_tsysxdw,v_sfxs);
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
        
                  -------日志表插入执行结果
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG,sxjgnr,sfxs) values(v_pcid,'最终执行结果','3',v_result,v_result,'1');
      commit;
exception
  when others then
    v_errorcode:= sqlcode;
      v_errormsg := sqlerrm;
      insert into gjj_ywblbz_log (pcid,zxyj,yjlx,ZXJG) values(v_pcid,'异常规则：'||v_gzmc||'，异常语句：'||v_ywbljgz,'1',0);
    insert into t_wa_sys_log_err(err_date,name_proc,err_code,err_msg)
                 values(sysdate,'p_gjj_get_mxywsfz_4',v_errorcode,v_ywbljgz||v_errormsg || dbms_utility.format_error_backtrace() || v_sql);
    commit;
v_result:=0;
end;

/
CREATE OR REPLACE PROCEDURE p_gjj_get_bhscsf(
    v_ywsf VARCHAR, -- 业务算法，5编号生成算法
    v_ywnrfl VARCHAR, -- f_gjj_get_mxywsfz-业务内容分类，案件编号、审计编号、工单编号
    v_jgbh VARCHAR, -- 机构编号
    v_zjgbh VARCHAR, -- 子机构编号
    v_pcid VARCHAR, -- 批次id
    v_result IN OUT VARCHAR
)
AS
    v_errorcode INT;
    v_errormsg VARCHAR2(500);
    v_sql VARCHAR2(3000);
    v_zdybm VARCHAR2(2000);
    v_gzmc VARCHAR2(2000);
    v_ywbljgz VARCHAR2(3000);
    v_id VARCHAR2(100);
BEGIN
    IF v_ywnrfl = '1' THEN -- 案件编号
        SELECT a.id, b.zdybm, a.gzmc
        INTO v_id, v_zdybm, v_gzmc
        FROM GJJ_YWBZ a
        LEFT JOIN gjj_ywbzk b ON a.mbid = b.id
        WHERE a.YWSF = '5'
          AND a.YWNRFL = '1'
          AND a.zjgbh = v_zjgbh
        ORDER BY a.id
        FETCH FIRST 1 ROWS ONLY;
        
        p_gjj_get_bhscsf_ajbh(v_jgbh, v_zjgbh, v_zdybm,v_pcid, v_result);
        
    ELSIF v_ywnrfl = '2' THEN -- 审计编号
        SELECT a.id, b.zdybm, a.gzmc
        INTO v_id, v_zdybm, v_gzmc
        FROM GJJ_YWBZ a
        LEFT JOIN gjj_ywbzk b ON a.mbid = b.id
        WHERE a.YWSF = '5'
          AND a.YWNRFL = '2'
          AND a.zjgbh = v_zjgbh
        ORDER BY a.id
        FETCH FIRST 1 ROWS ONLY;
        
        p_gjj_get_bhscsf_sjbh(v_jgbh, v_zjgbh, v_zdybm,v_pcid, v_result);
        
    ELSIF v_ywnrfl = '3' THEN -- 工单编号
        SELECT a.id, b.zdybm, a.gzmc
        INTO v_id, v_zdybm, v_gzmc
        FROM GJJ_YWBZ a
        LEFT JOIN gjj_ywbzk b ON a.mbid = b.id
        WHERE a.YWSF = '5'
          AND a.YWNRFL = '3'  -- 修正：原代码中为'2'，应为'3'
          AND a.zjgbh = v_zjgbh
        ORDER BY a.id
        FETCH FIRST 1 ROWS ONLY;
        
        p_gjj_get_bhscsf_gdbh(v_jgbh, v_zjgbh,v_zdybm,v_pcid, v_result);
    ELSIF v_ywnrfl = '4' THEN -- 单位账号
        p_gjj_get_bhscsf_dwzh(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result);    
    ELSIF v_ywnrfl = '6' THEN -- 借款合同编号
        p_gjj_get_bhscsf_jkhtbh(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result);    
    ELSE
        v_result := '0'; -- 无效的业务内容分类
    END IF;
    
    -- 日志表插入执行结果
/*    INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, ZXJG)
    VALUES (v_pcid, '最终执行结果', '2', v_result);
    COMMIT;*/
    
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, ZXJG)
        VALUES (v_pcid, '未找到对应的业务规则配置', '1', 0);
        v_result := '0';
        COMMIT;
    WHEN OTHERS THEN
        v_errorcode := SQLCODE;
        v_errormsg := SQLERRM;
        INSERT INTO gjj_ywblbz_log (pcid, zxyj, yjlx, ZXJG)
        VALUES (v_pcid, '异常规则：' || v_gzmc || '，异常语句：' || v_ywbljgz, '1', 0);
        
        INSERT INTO t_wa_sys_log_err(err_date, name_proc, err_code, err_msg)
        VALUES (SYSDATE, 'p_gjj_get_bhscsf', v_errorcode,
                v_ywbljgz || v_errormsg || DBMS_UTILITY.FORMAT_ERROR_BACKTRACE() || v_sql);
        COMMIT;
        v_result := '0';
END;

/
create or replace procedure p_gjj_get_mxywsfz(----获取模型业务算法值
v_ywsf  varchar ,  --业务算法，1-最大可提取额，2-最高可贷金额，3-最高可贷年限，4-借款人最大可对冲支取金额
v_ywnrfl  varchar,  --f_gjj_get_mxywsfz-业务内容分类，提取原因
v_jgbh varchar,     --机构编号
v_zjgbh varchar,    --子机构编号
v_pcid  varchar,     --批次id
v_result in out varchar
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
  v_result_n  number(20);
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

        p_gjj_get_mxywsfz_1(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result_n);
        v_result:=to_char(v_result_n);
        
  elsif v_ywsf='2' THEN--最高可贷金额
        -----查询模型业务算法配置
        ------GJJ_YWSFPZ   模型业务算法配置
        -----GJJ_YWSFPZ_MX    模型业务算法配置明细
        -------gjj_ywblbzk    业务办理标准库
        --------GJJ_YWBLBZK_SHUXING     业务办理标准属性明细
         p_gjj_get_mxywsfz_2(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result_n);
         v_result:=to_char(v_result_n);
  elsif v_ywsf='3' THEN--最高可贷年
        -----查询模型业务算法配置
        ------GJJ_YWSFPZ   模型业务算法配置
        -----GJJ_YWSFPZ_MX    模型业务算法配置明细
        -------gjj_ywblbzk    业务办理标准库
        --------GJJ_YWBLBZK_SHUXING     业务办理标准属性明细
        p_gjj_get_mxywsfz_3(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result_n);
        v_result:=to_char(v_result_n);
  elsif v_ywsf='4' THEN--借款人最大可对冲支取金额
        -----查询模型业务算法配置
        ------GJJ_YWSFPZ   模型业务算法配置
        -----GJJ_YWSFPZ_MX    模型业务算法配置明细
        -------gjj_ywblbzk    业务办理标准库
        --------GJJ_YWBLBZK_SHUXING     业务办理标准属性明细
        p_gjj_get_mxywsfz_4(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result_n);
        v_result:=to_char(v_result_n);
  elsif v_ywsf='5' THEN--编号生成算法
     p_gjj_get_bhscsf(v_ywsf,v_ywnrfl,v_jgbh,v_zjgbh,v_pcid,v_result);
  end if;

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