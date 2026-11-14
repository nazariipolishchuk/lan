from lan.config import load_env


def test_load_env_reads_pairs_without_overwriting(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("# comment\nA_KEY=one\nB_KEY='two'\n", encoding="utf-8")
    monkeypatch.setenv("A_KEY", "kept")
    monkeypatch.delenv("B_KEY", raising=False)
    load_env(env)
    import os

    assert os.environ["A_KEY"] == "kept"
    assert os.environ["B_KEY"] == "two"
