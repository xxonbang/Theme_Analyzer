-- portfolio_transactions: 매수 이력 audit log
-- 2026-05-07 — 물타기 결과 포트폴리오 반영 기능 도입
-- holding 삭제 시 cascade. UPDATE 정책 없음(이력 불변).

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  holding_id  uuid NOT NULL REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  price       integer NOT NULL CHECK (price > 0),
  quantity    integer NOT NULL CHECK (quantity > 0),
  executed_at timestamptz NOT NULL DEFAULT now(),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_holding
  ON portfolio_transactions(holding_id, executed_at DESC);

ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user own transactions select"
  ON portfolio_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user own transactions insert"
  ON portfolio_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user own transactions delete"
  ON portfolio_transactions FOR DELETE
  USING (auth.uid() = user_id);
