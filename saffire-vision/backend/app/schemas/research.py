from typing import Optional
from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    top_k: int = Field(6, ge=2, le=10, description="How many passages to retrieve")
    use_llm: bool = Field(True, description="Use the language model if one is configured. If none is configured the answer is a list of matching passages.")


class EvidenceItem(BaseModel):
    n: int = Field(..., description="Citation number used in the answer, e.g. [2]")
    id: str
    label: str
    kind: str = Field(..., description="psi_record, publication_titles, nasa_guide or challenge_background")
    evidence_type: str = Field(..., description="What kind of statement this is: reported result, planned work, objective, method, background, titles only")
    accessions: list[str] = []
    page: Optional[str] = None
    source_label: str
    source_url: Optional[str] = None
    excerpt: str
    score: float


class RelatedInvestigation(BaseModel):
    accession: str
    acronym: Optional[str] = None
    title: str


class AskResponse(BaseModel):
    question: str
    answered: bool
    mode: str = Field(..., description="'llm' (written by a language model from the passages), 'extractive' (passages only, nothing written) or 'none' (nothing relevant found)")
    model: Optional[str] = None
    answer: Optional[str] = Field(None, description="Text to show the user. In extractive mode this says plainly that it is a list of passages.")
    documented: Optional[str] = Field(None, description="LLM mode: what the sources state, with [n] citations")
    interpretation: Optional[str] = Field(None, description="LLM mode: the model's own reading. This is not a NASA finding.")
    uncertainty: list[str] = []
    evidence: list[EvidenceItem] = []
    related_investigations: list[RelatedInvestigation] = []
    llm_error: Optional[str] = None
    disclaimers: list[str] = []


class SourceInfo(BaseModel):
    kind: str
    label: str
    url: Optional[str] = None
    passages: int
    note: Optional[str] = None


class DocumentsResponse(BaseModel):
    llm_configured: bool
    model: Optional[str] = None
    investigations_indexed: int
    passages: int
    sources: list[SourceInfo]
    not_indexed: list[str]


class SummarizeRequest(BaseModel):
    accession: str


class SummarySection(BaseModel):
    title: str
    text: Optional[str] = None
    source_field: str
    available: bool


class SummaryResponse(BaseModel):
    accession: str
    acronym: Optional[str] = None
    title: str
    sections: list[SummarySection]
    guide_entries: list[EvidenceItem]
    not_available: list[str]
    notes: list[str]
    source_url: str
    method: str
