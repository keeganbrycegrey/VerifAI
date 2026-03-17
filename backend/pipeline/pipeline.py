# calls pipeline modules in sequence
# only file that imports from all modules

from models import CheckRequest, Verdict, PreprocessedInput, ExtractedClaim, FactCheckResults, CoverageReport
from pipeline.preprocessor import preprocess
from pipeline.claim_extractor import extract_claim
from pipeline.verdict_generator import generate_verdict
from sources.factcheck_lookup import lookup
from sources.coverage_analyzer import analyze_coverage
from db.supabase_client import save_verdict


async def run_pipeline(request: CheckRequest) -> Verdict:
    # normalize input
    preprocessed: PreprocessedInput = await preprocess(
        input_type=request.input_type,
        content=request.content,
    )

    # isolate core claim
    claim: ExtractedClaim = await extract_claim(preprocessed)

    # query fact-checkers
    fact_checks: FactCheckResults = await lookup(claim)

    # analyze outlet coverage
    coverage: CoverageReport = await analyze_coverage(claim)

    # generate bilingual verdict
    verdict: Verdict = await generate_verdict(
        claim=claim,
        fact_checks=fact_checks,
        coverage=coverage,
        input_type=request.input_type,
        source_surface=request.source_surface,
    )

    # persist to db (non-fatal if it fails)
    await save_verdict(verdict)

    return verdict