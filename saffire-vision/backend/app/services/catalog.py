import json
from pathlib import Path
from typing import Any


_ROOT = Path(__file__).resolve().parents[3]
_CATALOG_PATH = _ROOT / "frontend" / "public" / "data" / "investigations.json"
_STOP = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
    "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
}
_catalog: dict[str, Any] | None = None


def _record(raw: dict[str, Any]) -> dict[str, Any]:
    project_type = raw.get("projectType") or ""
    return {
        "accession": raw["accession"],
        "acronym": raw.get("acronym") or None,
        "title": raw["title"],
        "sub_research_area": raw.get("subResearchArea") or None,
        "project_type": project_type or None,
        "hardware": raw.get("hardware") or None,
        "platform": raw.get("platform") or None,
        "source_url": f"https://psi.nasa.gov/physci/repo/data/investigations/{raw['accession']}",
        "objective": raw.get("objective") or None,
        "approach": raw.get("approach") or None,
        "hypothesis": raw.get("hypothesis") or None,
        "research_impacts": raw.get("impacts") or None,
        "conditions": raw.get("conditions") or [],
        "publications": raw.get("publications") or [],
        "data_origin": "ground" if "ground" in project_type.lower() else "flight",
    }


def get_catalog() -> dict[str, list[dict[str, Any]]]:
    global _catalog
    if _catalog is None:
        with _CATALOG_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        _catalog = {"records": [_record(item) for item in data["investigations"]]}
    return _catalog


def get_by_id(accession: str) -> dict[str, Any] | None:
    wanted = accession.upper()
    return next((r for r in get_catalog()["records"] if r["accession"].upper() == wanted), None)
