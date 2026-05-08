-- portfolio_holdings RLS 패치
-- 2026-05-08 — 사용자 격리 진단 결과 RLS 미적용 상태 발견 → 패치 적용
-- 이전 상태: RLS 비활성. 테이블·user_id 컬럼은 존재했으나 다른 사용자가
-- holding.id를 알면 직접 API 호출로 update/delete 가능한 취약점 있었음.
-- 이 파일은 운영 환경에 이미 적용된 상태(Supabase SQL Editor 직접 실행)를
-- 재현성·감사 추적용으로 보존.

ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user own holdings select"
  ON portfolio_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user own holdings insert"
  ON portfolio_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user own holdings update"
  ON portfolio_holdings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user own holdings delete"
  ON portfolio_holdings FOR DELETE
  USING (auth.uid() = user_id);
