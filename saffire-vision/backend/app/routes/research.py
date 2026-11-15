from fastapi import APIRouter, HTTPException

from ..schemas.research import AskRequest, AskResponse, DocumentsResponse, SummarizeRequest, SummaryResponse
from ..services import assistant as A

router = APIRouter(prefix="/api/research", tags=["research"])


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    """Answer a question from the indexed NASA sources, with numbered citations. With no language model configured the
    response is the matching passages and says so."""
    return A.ask(req.question, req.top_k, req.use_llm)


@router.get("/documents", response_model=DocumentsResponse)
def documents():
    """What the assistant can search, what it cannot, and whether a language model is configured."""
    return A.documents()


@router.post("/summarize", response_model=SummaryResponse)
def summarize(req: SummarizeRequest):
    """Rule-based summary of one investigation from its PSI fields, with the 2015 guide entries that mention it."""
    out = A.summarize(req.accession)
    if out is None:
        raise HTTPException(404, f"Unknown investigation '{req.accession}'")
    return out
