CREATE TABLE denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo TEXT NOT NULL UNIQUE,
  data_envio TEXT NOT NULL,
  tipo TEXT NOT NULL,
  identificacao TEXT NOT NULL,
  nome TEXT,
  email TEXT,
  setor TEXT,
  mensagem TEXT NOT NULL,
  evidencias TEXT,
  contato_retorno TEXT,
  id_navegador TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  prioridade TEXT,
  notas_juridico TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_denuncias_status ON denuncias(status);
CREATE INDEX idx_denuncias_created_at ON denuncias(created_at);
