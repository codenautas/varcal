CREATE OR REPLACE FUNCTION test_varcal.gen_fun() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
  UPDATE t1_calc
    SET doble_y_suma = dato1 * 2 + dato2
    FROM t1 inner join t0 using(pk0)
    WHERE t1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0;
  UPDATE t1_calc
    SET cal1 = doble_y_suma + dato1,
        cal2 = doble_y_suma + dato2
    FROM t1 inner join t0 using(pk0)
    WHERE t1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0;
  RETURN 'OK';
END;
$BODY$;