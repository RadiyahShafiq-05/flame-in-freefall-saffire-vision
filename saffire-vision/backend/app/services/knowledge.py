"""Passage index for the research assistant: PSI record text, publication titles, and two small sourced files
(the 2015 Researcher's Guide findings and the challenge background). Retrieval is BM25 over stemmed tokens; there is
no external service and no GPU."""
import json
import logging
import math
import re
from collections import Counter
from typing import Optional

from . import catalog as C
from . import psi_ingest as ingest

log = logging.getLogger("knowledge")
KNOWLEDGE_DIR = ingest.PSI_DIR / "knowledge"
_cache: Optional[dict] = None

QUESTION_WORDS = {"why", "does", "did", "what", "which", "how", "can", "could", "would", "should", "between", "difference", "differences",
                  "explain", "tell", "give", "show", "me", "us", "any", "there", "their", "they", "have", "has", "had", "been", "being",
                  "study", "studied", "studies", "investigate", "investigated", "investigation", "investigations", "experiment",
                  "experiments", "reveal", "revealed", "discover", "discovered", "find", "found", "nasa", "research", "relevant", "exist"}
STOP = C._STOP | QUESTION_WORDS
_SUFFIXES = ("ability", "ations", "ation", "ments", "ment", "ities", "ings", "ing", "ions", "ion", "ants", "ant", "ors", "or", "ers", "er",
             "able", "ity", "ies", "ed", "es", "s")
FIELD_LABELS = {"objective": "Objective", "approach": "Approach", "hypothesis": "Hypothesis", "research_impacts": "Research impacts", "overview": "Overview"}
EVIDENCE_TYPES = {
    ("psi_record", "objective"): "Investigation record: objective (what the team set out to do)",
    ("psi_record", "approach"): "Investigation record: method",
    ("psi_record", "hypothesis"): "Investigation record: hypothesis (an expectation, not a result)",
    ("psi_record", "research_impacts"): "Investigation record: expected benefits",
    ("psi_record", "overview"): "Investigation record: overview",
    ("publication_titles", None): "Publication titles only (not findings)",
}
GUIDE_TYPES = {"finding": "NASA guide (2015): reported result", "plan": "NASA guide (2015): planned work, not a result", "background": "NASA guide (2015): background"}


def stem(tok: str) -> str:
    if len(tok) > 5:
        for suf in _SUFFIXES:
            if tok.endswith(suf) and len(tok) - len(suf) >= 4:
                return tok[: -len(suf)]
    return tok


def tokens(text: str, drop_question_words: bool = False) -> list[str]:
    stop = STOP if drop_question_words else C._STOP
    return [stem(t) for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in stop]


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(\[\"'])", (text or "").strip()) if s.strip()]


def split_windows(text: str, max_words: int = 140) -> list[str]:
    out, cur, n = [], [], 0
    for s in sentences(text) or [text]:
        w = len(s.split())
        if cur and n + w > max_words:
            out.append(" ".join(cur))
            cur, n = [], 0
        cur.append(s)
        n += w
    if cur:
        out.append(" ".join(cur))
    return out


def _load_json(name: str) -> dict:
    try:
        return json.loads((KNOWLEDGE_DIR / name).read_text(encoding="utf-8"))
    except FileNotFoundError:
        log.warning("knowledge file %s not found", name)
        return {"source": {"label": name, "url": None}, "entries": []}
    except Exception:
        log.exception("could not read %s", name)
        return {"source": {"label": name, "url": None}, "entries": []}


def _build_chunks() -> list[dict]:
    chunks = []
    for r in C.get_catalog()["records"]:
        name = r.get("acronym") or r["accession"]
        base = {"kind": "psi_record", "accession": r["accession"], "accessions": [r["accession"]], "page": None,
                "source_label": "NASA PSI investigation record", "source_url": r["source_url"], "extra": ""}
        overview = "; ".join(x for x in [r["title"], f"Acronym: {r['acronym']}" if r.get("acronym") else None,
                                         f"Hardware: {r['hardware']}" if r.get("hardware") else None,
                                         f"Platform: {r['platform']}" if r.get("platform") else None,
                                         f"Sub-area: {r['sub_research_area']}" if r.get("sub_research_area") else None,
                                         f"Project type: {r['project_type']}" if r.get("project_type") else None,
                                         f"Keywords: {', '.join(r['keywords'])}" if r.get("keywords") else None] if x)
        chunks.append({**base, "id": f"{r['accession']}:overview:0", "field": "overview", "label": f"{name} ({r['accession']}) overview", "text": overview})
        for field in ("objective", "approach", "hypothesis", "research_impacts"):
            if r.get(field):
                for i, part in enumerate(split_windows(r[field])):
                    chunks.append({**base, "id": f"{r['accession']}:{field}:{i}", "field": field,
                                   "label": f"{name} ({r['accession']}) {FIELD_LABELS[field].lower()}", "text": part})
        titles = [p["title"] for p in r["publications"] if p.get("title")]
        for i in range(0, len(titles), 8):
            chunks.append({**base, "kind": "publication_titles", "id": f"{r['accession']}:publications:{i // 8}", "field": "publications",
                           "label": f"{name} ({r['accession']}) listed publications", "text": "Publications listed on the PSI record: " + "; ".join(titles[i:i + 8])})
    for fname, kind in (("guide_findings.json", "nasa_guide"), ("challenge_background.json", "challenge_background")):
        data = _load_json(fname)
        src = data["source"]
        for e in data["entries"]:
            chunks.append({"kind": kind, "id": e["id"], "field": e["type"], "accession": None, "accessions": e.get("accessions", []), "page": e.get("page"),
                           "source_label": src["label"], "source_url": src.get("url"), "label": "NASA Researcher's Guide to Combustion Science (2015)" if kind == "nasa_guide" else "NASA Space Apps Challenge description",
                           "text": e["text"], "extra": " ".join(e.get("topics", [])), "entry_type": e["type"]})
    for c in chunks:
        # name the investigations an entry covers, so a question using the full name (not only the acronym) finds it
        c["names"] = " ".join(f"{r.get('acronym') or ''} {r['title']}" for a in c["accessions"] if c["kind"] in ("nasa_guide", "challenge_background") and (r := C.get_by_id(a)))
        if c["kind"] == "psi_record":
            c["evidence_type"] = EVIDENCE_TYPES[("psi_record", c["field"])]
        elif c["kind"] == "publication_titles":
            c["evidence_type"] = EVIDENCE_TYPES[("publication_titles", None)]
        elif c["kind"] == "nasa_guide":
            c["evidence_type"] = GUIDE_TYPES[c["entry_type"]]
        else:
            c["evidence_type"] = "Challenge description: background"
    return chunks


ALIAS_BLACKLIST = {"flame", "flames", "design"}


def _aliases() -> tuple[dict, dict]:
    """alias -> accessions. Names with a hyphen (SAFFIRE-I, FLEX-2) match exactly. A bare name (SAFFIRE, BASS) also
    matches its whole family (SAFFIRE-I, -II, -III; BASS and BASS-II)."""
    exact, family = {}, {}
    for r in C.get_catalog()["records"]:
        acr = r.get("acronym")
        if not acr:
            continue
        for part in re.split(r"\s*/\s*|\s+", acr.strip()):
            key = part.lower()
            if not key or key in ALIAS_BLACKLIST:
                continue
            exact.setdefault(key, set()).add(r["accession"])
            if "-" in key:
                family.setdefault(key.split("-")[0], set()).add(r["accession"])
            else:
                family.setdefault(key, set()).add(r["accession"])
    return exact, family


AMBIGUOUS_UPPERCASE_ONLY = {"same", "flex", "slice", "spice"}
MIN_SCORE = 5.0


def detect_investigations(question: str) -> list[str]:
    cat = get_index()
    found: list[str] = []
    for m in re.finditer(r"\bPSI-\d+\b", question, re.I):
        acc = m.group(0).upper()
        if C.get_by_id(acc) and acc not in found:
            found.append(acc)
    for m in re.finditer(r"[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*", question):
        tok, low = m.group(0), m.group(0).lower()
        if low in AMBIGUOUS_UPPERCASE_ONLY and tok != tok.upper():
            continue
        accs = cat["alias_exact"].get(low, set()) if "-" in low else (cat["alias_exact"].get(low, set()) | cat["alias_family"].get(low, set()))
        for a in sorted(accs):
            if a not in found:
                found.append(a)
    return found


def get_index() -> dict:
    global _cache
    if _cache is None:
        chunks = _build_chunks()
        docs, df = [], Counter()
        for c in chunks:
            toks = tokens(c["label"] + " " + c["text"] + " " + c.get("extra", "") + " " + c.get("names", ""))
            docs.append(Counter(toks))
            df.update(set(toks))
        exact, family = _aliases()
        for c in chunks:
            c["_topic_stems"] = set(tokens(c.get("extra", "")))
        _cache = {"chunks": chunks, "docs": docs, "df": df, "lens": [sum(d.values()) for d in docs],
                  "avg": (sum(sum(d.values()) for d in docs) / max(1, len(docs))), "alias_exact": exact, "alias_family": family}
        log.info("knowledge index built: %d passages", len(chunks))
    return _cache


def reload_index() -> dict:
    global _cache
    _cache = None
    return get_index()


def retrieve(question: str, top_k: int = 6, per_record_limit: int = 3) -> tuple[list[tuple[float, dict]], list[str]]:
    idx = get_index()
    q = list(dict.fromkeys(tokens(question, drop_question_words=True)))
    detected = detect_investigations(question)
    if not q and not detected:
        return [], detected
    n, k1, b = len(idx["chunks"]), 1.5, 0.75
    wants_results = bool(re.search(r"\b(discover|reveal|find|found|finding|result|learn|conclu|show)\w*", question, re.I))
    scored = []
    for c, tf, ln in zip(idx["chunks"], idx["docs"], idx["lens"]):
        s = 0.0
        for t in q:
            f = tf.get(t, 0)
            if f:
                df = idx["df"][t]
                s += math.log(1 + (n - df + 0.5) / (df + 0.5)) * f * (k1 + 1) / (f + k1 * (1 - b + b * ln / idx["avg"]))
        if detected and set(c["accessions"]) & set(detected):
            s = s * 1.4 + (1.0 if s > 0 else 0.0)
        if s > 0 and c.get("extra"):
            s += 1.2 * min(3, len(set(q) & c["_topic_stems"]))  # curated topic tags on the guide and challenge entries
        if wants_results and c.get("entry_type") == "finding":
            s *= 1.35
        if s > 0:
            c["_matched"] = sum(1 for t in q if tf.get(t, 0))
            scored.append((s, c))
    scored.sort(key=lambda x: -x[0])
    # relevance gate: an unrelated question must not be answered from a stray word match
    need = 2 if len(q) >= 3 else 1
    if not detected and (not scored or scored[0][0] < MIN_SCORE or max(c["_matched"] for _, c in scored[:5]) < need):
        return [], detected
    picked, per = [], Counter()
    for s, c in scored:
        key = c["accession"] or c["id"]
        if per[key] >= per_record_limit:
            continue
        picked.append((s, c))
        per[key] += 1
        if len(picked) >= top_k:
            break
    # make sure every investigation named in the question is represented
    for acc in detected:
        if not any(acc in c["accessions"] for _, c in picked):
            best = next(((s, c) for s, c in scored if acc in c["accessions"] and c["kind"] == "psi_record"), None)
            if best:
                picked = picked[:-1] + [best] if len(picked) >= top_k else picked + [best]
    picked.sort(key=lambda x: -x[0])
    return picked, detected


def best_sentences(text: str, question: str, max_chars: int = 460, max_sentences: int = 2) -> str:
    q = set(tokens(question, drop_question_words=True))
    ss = sentences(text)
    if not ss:
        return text[:max_chars]
    ranked = sorted(range(len(ss)), key=lambda i: (-len(q & set(tokens(ss[i]))), i))[:max_sentences]
    out = " ".join(ss[i] for i in sorted(ranked))
    return out if len(out) <= max_chars else out[: max_chars].rsplit(" ", 1)[0] + "..."


def sources_summary() -> list[dict]:
    idx = get_index()
    cnt = Counter(c["kind"] for c in idx["chunks"])
    guide, chal = _load_json("guide_findings.json"), _load_json("challenge_background.json")
    return [
        {"kind": "psi_record", "label": "NASA PSI investigation records (objective, approach, hypothesis, research impacts, overview)", "url": "https://psi.nasa.gov/physci/repo/", "passages": cnt["psi_record"],
         "note": "Records describe aims and methods; they do not list results."},
        {"kind": "publication_titles", "label": "Publication titles listed on PSI records", "url": None, "passages": cnt["publication_titles"],
         "note": "Titles only. Abstracts and full papers are not indexed."},
        {"kind": "nasa_guide", "label": guide["source"]["label"], "url": guide["source"].get("url"), "passages": cnt["nasa_guide"], "note": guide["source"].get("note")},
        {"kind": "challenge_background", "label": chal["source"]["label"], "url": chal["source"].get("url"), "passages": cnt["challenge_background"], "note": chal["source"].get("note")},
    ]
