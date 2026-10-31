begin;

select plan(4);

select is(
  current_database(),
  'postgres',
  'connected to the local Supabase database'
);

select ok(
  current_setting('server_version_num')::integer / 10000 >= 17,
  'PostgreSQL major version is 17 or newer'
);

select has_extension('pgtap', 'pgTAP is available for database tests');
select has_extension('pgcrypto', 'pgcrypto extension is available');

select * from finish();
rollback;
