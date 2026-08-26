-- Nuevos estados de negociacion pedidos por el usuario:
-- Ofrecido - Pausado - En negociacion - Avanzado - Cerrado (Exito) - Cerrado (Caido)
-- Reemplaza: contactado/reunion/oferta_enviada/en_espera/cerrado_exitoso/cerrado_rechazado

alter table market_negotiations drop constraint market_negotiations_status_check;

update market_negotiations set status = 'ofrecido' where status = 'contactado';
update market_negotiations set status = 'pausado' where status = 'reunion';
update market_negotiations set status = 'en_negociacion' where status = 'oferta_enviada';
update market_negotiations set status = 'avanzado' where status = 'en_espera';
update market_negotiations set status = 'cerrado_exito' where status = 'cerrado_exitoso';
update market_negotiations set status = 'cerrado_caido' where status = 'cerrado_rechazado';

alter table market_negotiations alter column status set default 'ofrecido';
alter table market_negotiations add constraint market_negotiations_status_check
  check (status = any (array['ofrecido', 'pausado', 'en_negociacion', 'avanzado', 'cerrado_exito', 'cerrado_caido']));
