"""modules/data_exporter.py 유닛 테스트"""
import json
import pytest
from pathlib import Path
from datetime import datetime, timedelta

from modules.utils import KST
from modules.data_exporter import cleanup_old_history


class TestCleanupOldHistory:
    def test_deletes_old_files(self, tmp_path):
        """보관 기간 이상된 파일이 삭제되는지 확인"""
        # 10일 전 파일 생성
        old_date = (datetime.now(KST) - timedelta(days=10)).strftime("%Y-%m-%d")
        old_file = tmp_path / f"{old_date}_0900.json"
        old_file.write_text("{}")

        # 오늘 파일 생성
        today = datetime.now(KST).strftime("%Y-%m-%d")
        new_file = tmp_path / f"{today}_0900.json"
        new_file.write_text("{}")

        deleted = cleanup_old_history(tmp_path, days=5)

        assert deleted == 1
        assert not old_file.exists()
        assert new_file.exists()

    def test_keeps_recent_files(self, tmp_path):
        """보관 기간 내 파일은 유지되는지 확인"""
        today = datetime.now(KST).strftime("%Y-%m-%d")
        f = tmp_path / f"{today}_0900.json"
        f.write_text("{}")

        deleted = cleanup_old_history(tmp_path, days=5)

        assert deleted == 0
        assert f.exists()

    def test_nonexistent_dir(self, tmp_path):
        """존재하지 않는 디렉토리에서 0 반환"""
        deleted = cleanup_old_history(tmp_path / "nonexistent")
        assert deleted == 0

    def test_ignores_bad_filename(self, tmp_path):
        """파일명 형식이 맞지 않는 파일은 무시"""
        bad_file = tmp_path / "readme.json"
        bad_file.write_text("{}")

        deleted = cleanup_old_history(tmp_path, days=0)
        assert deleted == 0
        assert bad_file.exists()
