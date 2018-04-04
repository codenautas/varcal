drop schema if exists test_varcal cascade;
set role test_user;

create schema test_varcal;

set search_path = test_varcal;

create table datos(
    id integer primary key,
    dato1 integer,
    dato2 integer,
    doble_y_suma integer
);

insert into datos (id, dato1, dato2) values
  (1,42,1),
  (2,43,3);

