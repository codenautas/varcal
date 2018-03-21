create or replace function test_varcal.gen_fun() returns text
  language plpgsql
as
$BODY$
begin
  update datos set doble_y_suma = dato1 * 2 + dato2;
  RETURN 'OK';
end;
$BODY$;