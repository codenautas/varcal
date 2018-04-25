CREATE OR REPLACE FUNCTION test_varcal.gen_fun() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
  UPDATE t1_cal
    SET doble_y_suma = dato1 * 2 + dato2
    FROM t1 inner join t0 using(pk0)
    WHERE t1_cal.t1 = datos.t1 and t1_cal.pk0=t0.pk0;
  UPDATE t2_cal
    SET cal1 = doble_y_suma + dato1,
        cal2 = doble_y_suma + dato2
    FROM t2 inner join t0 using(pk0) join t1_cal using(pk0)
    WHERE t2_cal.t2 = datos2.t2 and t2_cal.pk0=t0.pk0 and t2_cal.pk0=t1_cal.pk0;
  RETURN 'OK';
END;
$BODY$;