
create or replace function generate_generics(p_tipo text, p_neutro text) returns text
  language plpgsql
as
$body$
  declare
    fun_null2zero text := $ESTA$
  drop function if exists null2zero(p_parametro decimal);
  create or replace function null2zero(p_parametro decimal) returns decimal
    language sql immutable
  as  
  $sql$
    select coalesce(p_parametro, /*neutro:*/ 0)
  $sql$;
  $ESTA$;
  begin
    execute replace(replace(fun_null2zero, 'decimal', p_tipo), '/*neutro:*/ 0',p_neutro);
    return 'generado '||p_tipo;
  end;
$body$;

select generate_generics('decimal', '0')
union select generate_generics('integer', '0')
union select generate_generics('double precision', '0')
union select generate_generics('float', '0')
union select generate_generics('bigint', '0')
union select generate_generics('text', $$''$$)
union select generate_generics('date', 'null');

drop function if exists div0err(p_numerador decimal, p_denominador decimal, variadic pk text[]);
create or replace function div0err(p_numerador decimal, p_denominador decimal, variadic pk text[]) returns decimal
  language plpgsql immutable
as  
$sql$
begin
  if p_denominador=0 then
    raise 'ERROR DIVISION POR CERO EN %', pk;
  end if;
  return 1.0*p_numerador/p_denominador;
end;
$sql$;

drop function if exists lanzar_error(variadic pk text[]);
create or replace function lanzar_error(variadic pk text[]) returns decimal
  language plpgsql immutable
as  
$sql$
begin
  raise 'ERROR %', pk;
end;
$sql$;

drop function if exists incomplete_else_error(variadic pk text[]);
create or replace function incomplete_else_error(variadic pk text[]) returns decimal
  language plpgsql immutable
as  
$sql$
begin
  raise 'ERROR: para alguna variable calculada de opciones, falta definir el campo expresion (valor por defecto), ya que la siguiente encuesta no cumple con ninguna opción definida %', pk;
end;
$sql$;

-- select null2zero(2), null2zero(3::bigint), null2zero(null), null2zero(4.0);
-- select 3/2, div0err(3,2,'aca');
-- select div0err(3,0,'aca','hay','un','error');
-- select lanzar_error('sin else','no hay paraiso');
