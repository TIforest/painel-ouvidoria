DELETE FROM denuncias;

ALTER TABLE denuncias DROP COLUMN data_envio;
ALTER TABLE denuncias DROP COLUMN tipo;
ALTER TABLE denuncias DROP COLUMN identificacao;
ALTER TABLE denuncias DROP COLUMN nome;
ALTER TABLE denuncias DROP COLUMN email;
ALTER TABLE denuncias DROP COLUMN setor;
ALTER TABLE denuncias DROP COLUMN mensagem;
ALTER TABLE denuncias DROP COLUMN evidencias;
ALTER TABLE denuncias DROP COLUMN contato_retorno;
ALTER TABLE denuncias DROP COLUMN id_navegador;
