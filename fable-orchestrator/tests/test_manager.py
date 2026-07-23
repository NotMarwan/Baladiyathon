import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import manager


def test_model_for_routes_scout_to_haiku():
    assert manager.model_for("scout") == "claude-haiku-4-5"


def test_model_for_routes_worker_and_unknown_to_sonnet():
    assert manager.model_for("worker") == "claude-sonnet-5"
    assert manager.model_for("anything-else") == "claude-sonnet-5"


def test_plan_parses_tiered_json(monkeypatch):
    canned = json.dumps([
        {"tier": "scout", "task": "ابحث عن مصادر"},
        {"tier": "worker", "task": "ابنِ الصفحة"},
    ])
    monkeypatch.setattr(manager, "call", lambda *a, **k: canned)
    result = manager.plan("مهمة كبيرة")
    assert result == [
        {"tier": "scout", "task": "ابحث عن مصادر"},
        {"tier": "worker", "task": "ابنِ الصفحة"},
    ]


def test_plan_coerces_plain_strings_and_bad_tiers_to_worker(monkeypatch):
    canned = json.dumps(["مهمة نصية", {"tier": "boss", "task": "بلا تصنيف صحيح"}])
    monkeypatch.setattr(manager, "call", lambda *a, **k: canned)
    result = manager.plan("مهمة")
    assert result == [
        {"tier": "worker", "task": "مهمة نصية"},
        {"tier": "worker", "task": "بلا تصنيف صحيح"},
    ]


def test_plan_falls_back_to_single_worker_on_garbage(monkeypatch):
    monkeypatch.setattr(manager, "call", lambda *a, **k: "لا يوجد JSON هنا")
    assert manager.plan("مهمة") == [{"tier": "worker", "task": "مهمة"}]


class FakeUsage:
    input_tokens = 100
    output_tokens = 50


class FakeBlock:
    type = "text"
    text = "نتيجة"


class FakeResp:
    def __init__(self, model, stop_reason="end_turn"):
        self.model = model
        self.stop_reason = stop_reason
        self.stop_details = {"type": "refusal"} if stop_reason == "refusal" else None
        self.usage = FakeUsage()
        self.content = [FakeBlock()]


class FakeMessages:
    def __init__(self, log):
        self.log = log

    def create(self, **kwargs):
        self.log.append(kwargs)
        return FakeResp(kwargs["model"])


class FakeClient:
    def __init__(self):
        self.calls = []
        self.beta_calls = []
        self.messages = FakeMessages(self.calls)
        self.beta = type("B", (), {})()
        self.beta.messages = FakeMessages(self.beta_calls)


def test_call_scout_sends_no_thinking_and_no_output_config(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(manager, "client", fake)
    manager.call(manager.SCOUT, "sys", "user")
    kwargs = fake.calls[0]
    assert "thinking" not in kwargs
    assert "output_config" not in kwargs


def test_call_worker_sends_adaptive_thinking_and_effort(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(manager, "client", fake)
    manager.call(manager.WORKER, "sys", "user", effort="low")
    kwargs = fake.calls[0]
    assert kwargs["thinking"] == {"type": "adaptive"}
    assert kwargs["output_config"] == {"effort": "low"}


def test_call_raises_refusal_error(monkeypatch):
    fake = FakeClient()

    def refuse(**kwargs):
        return FakeResp(kwargs["model"], stop_reason="refusal")

    fake.messages.create = refuse
    monkeypatch.setattr(manager, "client", fake)
    with pytest.raises(manager.RefusalError):
        manager.call(manager.WORKER, "sys", "user")


def test_execute_retries_on_opus_after_refusal(monkeypatch):
    attempts = []

    def fake_call(model, system, user, **kwargs):
        attempts.append(model)
        if model == manager.WORKER:
            raise manager.RefusalError("مرفوض")
        return "نجحت على أوبس"

    monkeypatch.setattr(manager, "call", fake_call)
    result = manager.execute("مهمة فرعية", "الهدف")
    assert result == "نجحت على أوبس"
    assert attempts == [manager.WORKER, manager.FALLBACK_WORKER]


def test_run_continues_when_one_subtask_fails(monkeypatch):
    monkeypatch.setattr(manager, "SUPERVISE", False)
    monkeypatch.setattr(
        manager, "plan",
        lambda task: [
            {"tier": "worker", "task": "تفشل"},
            {"tier": "worker", "task": "تنجح"},
        ],
    )

    def fake_execute(subtask, task, tier="worker", correction=None):
        if subtask == "تفشل":
            raise manager.RefusalError("مرفوضة نهائياً")
        return "تمّت"

    monkeypatch.setattr(manager, "execute", fake_execute)
    captured = {}

    def fake_synthesize(task, results):
        captured["results"] = results
        return "النهائي"

    monkeypatch.setattr(manager, "synthesize", fake_synthesize)
    assert manager.run("مهمة") == "النهائي"
    assert len(captured["results"]) == 2
    assert "فشلت" in captured["results"][0][1]
    assert captured["results"][1][1] == "تمّت"


def test_review_accepts_ok_with_trailing_period(monkeypatch):
    monkeypatch.setattr(manager, "call", lambda *a, **k: "OK.")
    assert manager.review("مهمة", "نتيجة") == "OK"


def test_prices_filled_for_all_four_models():
    for model in ("claude-fable-5", "claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5"):
        prices = manager.PRICES[model]
        assert isinstance(prices, tuple) and len(prices) == 2
        assert prices[0] > 0 and prices[1] > 0


def test_report_totals_cost(monkeypatch, capsys):
    monkeypatch.setattr(manager, "_usage", {
        "claude-haiku-4-5": {"in": 1_000_000, "out": 1_000_000, "calls": 2},
    })
    manager.report()
    out = capsys.readouterr().out
    assert "$6.0000" in out  # 1M×$1 دخل + 1M×$5 خرج


def test_save_log_writes_utf8_markdown(tmp_path, monkeypatch):
    monkeypatch.setattr(manager, "LOGS_DIR", str(tmp_path))
    path = manager.save_log("مهمة تجريبية", "نتيجة نهائية")
    text = Path(path).read_text(encoding="utf-8")
    assert "مهمة تجريبية" in text and "نتيجة نهائية" in text


def test_call_manager_routes_through_beta_with_fallbacks(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(manager, "client", fake)
    manager.call(manager.MANAGER, "sys", "user", effort="low")
    assert fake.calls == []
    kwargs = fake.beta_calls[0]
    assert kwargs["betas"] == ["server-side-fallback-2026-06-01"]
    assert kwargs["fallbacks"] == [{"model": manager.FALLBACK_WORKER}]
    assert "thinking" not in kwargs
    assert kwargs["output_config"] == {"effort": "low"}


def test_plan_falls_back_when_manager_refuses(monkeypatch):
    def refuse(*a, **k):
        raise manager.RefusalError("مرفوض")
    monkeypatch.setattr(manager, "call", refuse)
    assert manager.plan("مهمة") == [{"tier": "worker", "task": "مهمة"}]


def test_plan_ignores_trailing_text_after_json(monkeypatch):
    canned = '[{"tier": "worker", "task": "افعل س"}]\nملاحظة: انظر [هنا] أيضاً.'
    monkeypatch.setattr(manager, "call", lambda *a, **k: canned)
    assert manager.plan("مهمة") == [{"tier": "worker", "task": "افعل س"}]


def test_synthesize_returns_joined_results_when_manager_refuses(monkeypatch):
    def refuse(*a, **k):
        raise manager.RefusalError("مرفوض")
    monkeypatch.setattr(manager, "call", refuse)
    out = manager.synthesize("مهمة", [("أ", "نتيجة أ"), ("ب", "نتيجة ب")])
    assert "نتيجة أ" in out and "نتيجة ب" in out


def test_track_normalizes_dated_model_ids(monkeypatch):
    monkeypatch.setattr(manager, "_usage", {})
    class U:
        input_tokens = 10
        output_tokens = 5
    manager._track("claude-haiku-4-5-20251001", U())
    assert "claude-haiku-4-5" in manager._usage
