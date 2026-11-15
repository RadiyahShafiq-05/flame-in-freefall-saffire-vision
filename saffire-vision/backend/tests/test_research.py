"""Tests for the research assistant: retrieval, citations, the no-model fallback, and the checks on model output.
No real language model is called; the model is replaced by a fake."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import assistant as A
from app.services import catalog as C
from app.services import knowledge as K

client = TestClient(app)
KEY = "sk-test-not-a-real-key"


@pytest.fixture(autouse=True)
def no_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ASSISTANT_MODEL", raising=False)


def ask(q, **kw):
    r = client.post("/api/research/ask", json={"question": q, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def ids(out):
    return [e["id"] for e in out["evidence"]]


def with_model(monkeypatch, reply):
    monkeypatch.setenv("GEMINI_API_KEY", KEY)
    seen = {}

    def fake(system, user, key, model):
        seen.update(system=system, user=user, key=key, model=model)
        if isinstance(reply, Exception):
            raise reply
        return reply(user) if callable(reply) else reply
    monkeypatch.setattr(A, "llm_call", fake)
    return seen


# ---- knowledge files ------------------------------------------------------------------------------

def test_knowledge_files_are_consistent():
    for name in ("guide_findings.json", "challenge_background.json"):
        data = json.loads((K.KNOWLEDGE_DIR / name).read_text(encoding="utf-8"))
        es = data["entries"]
        assert len({e["id"] for e in es}) == len(es) and all(e["text"].strip() for e in es)
        assert all(e["type"] in ("finding", "plan", "background") for e in es)
        assert all(C.get_by_id(a) for e in es for a in e["accessions"])  # every investigation named exists in the catalogue
    guide = json.loads((K.KNOWLEDGE_DIR / "guide_findings.json").read_text(encoding="utf-8"))["entries"]
    assert all(e["page"] for e in guide)  # every guide entry carries a page reference
    assert all(e["type"] == "plan" for e in guide if e["id"] in ("g-acme", "g-bre", "g-efield", "g-flame-design", "g-cld", "g-sflame"))


def test_stemming_and_investigation_detection():
    assert K.stem("detection") == K.stem("detectors") == K.stem("detect") or K.stem("detection") == K.stem("detect")
    assert K.stem("flammability") == K.stem("flammable")
    assert K.detect_investigations("What did SAME measure?") == ["PSI-101", "PSI-102"] or set(K.detect_investigations("What did SAME measure?")) == {"PSI-101", "PSI-102"}
    assert K.detect_investigations("tell me about the same results") == []  # lowercase 'same' is the English word
    assert set(K.detect_investigations("What is SAFFIRE?")) == {"PSI-98", "PSI-99", "PSI-100"}
    assert K.detect_investigations("BASS-II") == ["PSI-25"]
    assert set(K.detect_investigations("BASS")) == {"PSI-25", "PSI-26"}
    assert K.detect_investigations("what is psi-142") == ["PSI-142"]


# ---- retrieval on the questions from the project brief ----------------------------------------------

@pytest.mark.parametrize("question,expected", [
    ("Why does fire behave differently in microgravity?", {"c-buoyancy", "g-buoyancy"}),
    ("Which experiments investigated smoke detection?", {"g-detection", "c-detection-suppression"}),
    ("What research gaps exist for future Mars missions?", {"c-partial-gravity", "g-gap-solids"}),
    ("What do NASA experiments reveal about fire suppression?", {"g-flex-limit", "g-bass"}),
    ("Which investigations are relevant to lunar habitats?", {"c-atmosphere"}),
])
def test_retrieval_finds_the_right_sources(question, expected):
    assert expected & set(ids(ask(question))), ids(ask(question))


def test_difference_between_two_investigations_retrieves_both():
    rel = {r["accession"] for r in ask("What is the difference between SAFFIRE and BASS?")["related_investigations"]}
    assert "PSI-98" in rel and ("PSI-26" in rel or "PSI-25" in rel)


def test_unrelated_question_is_not_answered():
    out = ask("who won the world cup")
    assert out["answered"] is False and out["mode"] == "none" and out["evidence"] == [] and "won't guess" in out["answer"]
    assert ask("best pizza recipe")["answered"] is False


# ---- no model configured ---------------------------------------------------------------------------

def test_without_a_model_the_answer_is_passages_and_says_so():
    out = ask("What did FLEX find about the flammability limit?")
    assert out["mode"] == "extractive" and out["model"] is None and out["documented"] is None and out["interpretation"] is None
    assert "Nothing below was written by a model" in out["answer"]
    assert any("GEMINI_API_KEY" in u for u in out["uncertainty"])
    assert [e["n"] for e in out["evidence"]] == list(range(1, len(out["evidence"]) + 1))
    assert all(e["source_label"] and e["excerpt"] and e["evidence_type"] for e in out["evidence"])
    flex = next(e for e in out["evidence"] if e["id"] == "g-flex-limit")
    assert flex["page"] == "12" and "reported result" in flex["evidence_type"] and flex["source_url"].startswith("https://www.nasa.gov")


def test_planned_work_is_labelled_as_planned_not_as_a_result():
    out = ask("What is the Burning Rate Emulator?")
    bre = next(e for e in out["evidence"] if e["id"] == "g-bre")
    assert "planned work" in bre["evidence_type"] and any("planned" in u for u in out["uncertainty"])


def test_record_text_is_not_presented_as_results():
    out = ask("What did SAFFIRE-I measure?")
    assert any("PSI-98" in e["accessions"] for e in out["evidence"])
    assert any("None of the retrieved passages reports an experimental result" in u for u in out["uncertainty"])
    assert any("2015 guide does not cover PSI-98" in u for u in out["uncertainty"])


def test_partial_gravity_warning_and_ranking_pointer():
    unc = " ".join(ask("Is there data for fires on the Moon?")["uncertainty"])
    assert "no partial-gravity combustion data" in unc and "/api/ranking/run" in unc


def test_use_llm_false_skips_the_model_even_when_configured(monkeypatch):
    seen = with_model(monkeypatch, "{}")
    out = ask("What is FLEX?", use_llm=False)
    assert out["mode"] == "extractive" and not seen and "was not used" in out["answer"]


# ---- model path and its checks -----------------------------------------------------------------------

def test_model_answer_is_returned_with_separate_interpretation(monkeypatch):
    seen = with_model(monkeypatch, json.dumps({"documented": "The first passage addresses the question [1].",
                                               "interpretation": "This suggests suppressant choice matters for fire safety.",
                                               "uncertainty": ["Only microgravity results are covered."]}))
    out = ask("What is FLEX?")
    assert out["mode"] == "llm" and out["model"] == "gemini-2.5-flash" and seen["model"] == "gemini-2.5-flash"
    assert out["documented"].endswith("[1].") and out["interpretation"].startswith("This suggests")
    assert "Interpretation (model reading, not a NASA finding)" in out["answer"]
    assert "Only microgravity results are covered." in out["uncertainty"]
    assert "ONLY the numbered excerpts" in seen["system"] and "[1]" in seen["user"]


def test_model_name_comes_from_the_environment(monkeypatch):
    seen = with_model(monkeypatch, json.dumps({"documented": "Relevant [1]."}))
    monkeypatch.setenv("ASSISTANT_MODEL", "some-other-model")
    assert ask("What is FLEX?")["model"] == "some-other-model" and seen["model"] == "some-other-model"


def test_sentences_with_invented_numbers_or_missing_citations_are_removed(monkeypatch):
    with_model(monkeypatch, json.dumps({"documented": "It reached 7777 percent oxygen [1]. The first passage is relevant [1]. This has no citation. This cites nothing real [99]."}))
    out = ask("What is FLEX?")
    assert out["mode"] == "llm" and out["documented"] == "The first passage is relevant [1]."
    assert "7777" not in json.dumps(out) and any("removed" in u for u in out["uncertainty"])


def test_failed_checks_fall_back_to_passages(monkeypatch):
    with_model(monkeypatch, json.dumps({"documented": "Made up claim with no citation."}))
    out = ask("What is FLEX?")
    assert out["mode"] == "extractive" and "failed the source checks" in out["llm_error"] and out["documented"] is None


@pytest.mark.parametrize("reply,msg", [("this is not json", "not valid JSON"), (RuntimeError("boom"), "RuntimeError")])
def test_model_problems_fall_back_without_leaking_the_key(monkeypatch, reply, msg):
    with_model(monkeypatch, reply)
    out = ask("What is FLEX?")
    assert out["mode"] == "extractive" and msg in out["llm_error"] and out["evidence"]
    assert KEY not in json.dumps(out)


def test_json_inside_code_fences_is_accepted(monkeypatch):
    with_model(monkeypatch, "```json\n" + json.dumps({"documented": "Relevant [1]."}) + "\n```")
    assert ask("What is FLEX?")["mode"] == "llm"


# ---- documents and summaries --------------------------------------------------------------------------

def test_documents_lists_sources_and_what_is_missing():
    d = client.get("/api/research/documents").json()
    assert d["llm_configured"] is False and d["model"] is None and d["investigations_indexed"] == len(C.get_catalog()["records"])
    kinds = {s["kind"]: s["passages"] for s in d["sources"]}
    assert set(kinds) == {"psi_record", "publication_titles", "nasa_guide", "challenge_background"} and sum(kinds.values()) == d["passages"]
    assert any("publications" in x for x in d["not_indexed"])


def test_documents_reports_a_configured_model(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", KEY)
    d = client.get("/api/research/documents").json()
    assert d["llm_configured"] is True and d["model"] == "gemini-2.5-flash" and KEY not in json.dumps(d)


def test_summary_uses_only_record_fields():
    s = client.post("/api/research/summarize", json={"accession": "psi-98"}).json()
    by = {x["title"]: x for x in s["sections"]}
    assert by["What it studied"]["available"] and by["Tested conditions"]["text"].startswith("oxygen: 21.5 to 21.7 %")
    assert s["guide_entries"] == [] and any("no entry for this investigation" in n for n in s["notes"])
    assert "No language model" in s["method"]


def test_summary_attaches_guide_entries_and_flags_ground_studies():
    flex = client.post("/api/research/summarize", json={"accession": "PSI-69"}).json()
    assert "g-flex-limit" in [e["id"] for e in flex["guide_entries"]]
    ground = client.post("/api/research/summarize", json={"accession": "PSI-117"}).json()
    assert "Tested conditions" in ground["not_available"] and any("Ground investigation" in n for n in ground["notes"])


def test_validation():
    assert client.post("/api/research/ask", json={"question": "hi"}).status_code == 422
    assert client.post("/api/research/ask", json={"question": "x" * 501}).status_code == 422
    assert client.post("/api/research/ask", json={"question": "What is FLEX?", "top_k": 99}).status_code == 422
    assert client.post("/api/research/summarize", json={"accession": "PSI-99999"}).status_code == 404
