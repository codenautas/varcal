drop schema if exists test_varcal cascade;
create schema test_varcal;

set search_path = test_varcal;

create table datos(
    id integer primary key,
    dato integer
);

insert into datos (id, dato) values (1,42);