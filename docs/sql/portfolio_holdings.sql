-- portfolio_holdings: 사용자 포트폴리오 보유 종목
-- 2026-05-08 — 코드 기반 추정으로 재구성한 DDL (재현성·감사 추적용)
-- 운영 환경에는 이미 적용된 상태. 본 파일은 다른 환경 재현용.
-- RLS 정책은 portfolio_holdings_rls.sql 참조.

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  avg_price   integer NOT NULL CHECK (avg_price > 0),
  quantity    integer NOT NULL CHECK (quantity > 0),
  added_at    timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user_id
  ON portfolio_holdings(user_id);
