CREATE OR REPLACE FUNCTION test_varcal.gen_fun() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
  UPDATE datos
    SET doble_y_suma = dato1 * 2 + dato2;
  UPDATE datos
    SET cal1 = doble_y_suma + dato1,
        cal2 = doble_y_suma + dato2;
  RETURN 'OK';
END;
$BODY$;