-- ============================================================
-- AEP – Avaliação Ergonômica Preliminar
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela principal de avaliações
CREATE TABLE avaliacoes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  empresa       TEXT,
  cnpj          TEXT,
  responsavel   TEXT,
  tecnico_reg   TEXT,
  data_inspecao DATE,
  dados         JSONB NOT NULL  -- todos os dados do formulário (ident + ghes)
);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER avaliacoes_updated_at
  BEFORE UPDATE ON avaliacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security — acesso público (sem login)
ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_publico" ON avaliacoes
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para busca rápida
CREATE INDEX idx_avaliacoes_empresa ON avaliacoes(empresa);
CREATE INDEX idx_avaliacoes_data    ON avaliacoes(created_at DESC);
