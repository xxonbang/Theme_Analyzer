"""modules/utils.py 유닛 테스트"""
import pytest
from modules.utils import safe_int, safe_float, safe_int_or_none, safe_float_or_none


class TestSafeInt:
    def test_normal_int(self):
        assert safe_int(42) == 42

    def test_string_int(self):
        assert safe_int("123") == 123

    def test_none_returns_default(self):
        assert safe_int(None) == 0

    def test_empty_string_returns_default(self):
        assert safe_int("") == 0

    def test_invalid_string_returns_default(self):
        assert safe_int("abc") == 0

    def test_custom_default(self):
        assert safe_int(None, default=-1) == -1

    def test_float_string(self):
        assert safe_int("3.14") == 0  # int("3.14") raises ValueError


class TestSafeFloat:
    def test_normal_float(self):
        assert safe_float(3.14) == 3.14

    def test_string_float(self):
        assert safe_float("1.5") == 1.5

    def test_none_returns_default(self):
        assert safe_float(None) == 0.0

    def test_empty_string_returns_default(self):
        assert safe_float("") == 0.0

    def test_invalid_string_returns_default(self):
        assert safe_float("xyz") == 0.0

    def test_int_input(self):
        assert safe_float(10) == 10.0

    def test_custom_default(self):
        assert safe_float(None, default=-1.0) == -1.0


class TestSafeIntOrNone:
    def test_normal(self):
        assert safe_int_or_none(42) == 42

    def test_none(self):
        assert safe_int_or_none(None) is None

    def test_empty(self):
        assert safe_int_or_none("") is None

    def test_invalid(self):
        assert safe_int_or_none("abc") is None


class TestSafeFloatOrNone:
    def test_normal(self):
        assert safe_float_or_none(3.14) == 3.14

    def test_none(self):
        assert safe_float_or_none(None) is None

    def test_zero_returns_none(self):
        assert safe_float_or_none(0) is None

    def test_zero_string_returns_none(self):
        assert safe_float_or_none("0") is None
