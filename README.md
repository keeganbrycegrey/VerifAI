# VerifAI

**A multi-modal AI-powered fact-checking and transparency system for the Filipino information landscape.**

> *Huwag basta maniwala. Mag-verifAI muna.*

Submitted to the **InterCICSkwela Hackathon Challenge -- Batang Techno 2026**
Challenge #2: Digital Literacy & Combating Disinformation
SDG 4: Quality Education | SDG 16: Peace, Justice & Strong Institutions

**By:** Keegan Bryce Abeja, Dwane Daniel Jamero, Jhames Rianne Razo, Dion Candido Castro, Ahjel Milan Bristol

---

## The Problem

Disinformation spreads rapidly through images and messages on the web. Existing fact-checking tools are primarily English-first, require users to seek them out proactively, and usually return a verdict without any explanation of how it was reached. The result is a trust gap: users either ignore the verdict because they don't understand it, or accept it blindly-neither of which builds the media literacy this country urgently needs.

VerifAI addresses this at the source. It meets users on the platforms they already use, processes the formats of information they actually encounter, operates in both English and Filipino, and shows exactly how every verdict was reached. Not just what the system decided, but how and why.

---

## What VerifAI Does

VerifAI is a unified fact-checking pipeline accessible across three surfaces simultaneously, each built around the same problem: Filipinos encounter disinformation in different contexts, and no single surface reaches all of them.

**The Chrome Extension** activates on any webpage. A user who reads a suspicious claim in an article can highlight the text, or right-click any image or screenshot, and receive a verified result without leaving the tab. The verdict is accompanied by a live reasoning trace, a step-by-step breakdown of what was found, which sources were consulted, and how the conclusion was reached.

**The Messenger Chatbot** accepts forwarded messages and screenshots directly in conversation, the format in which much disinformation travels. The system extracts text from images using a vision-language model, processes it through the same pipeline, and returns a bilingual verdict in Filipino and English.

**The Web Dashboard** visualizes all processed claims in real time: recent verdicts, trending misinformation, coverage patterns across news outlets, and a bias registry rating 14 news organizations in the Philippines by credibility and political leaning.

All three surfaces share one backend. A claim verified through the extension is cached and instantly available if the same claim arrives through Messenger five minutes later. This ensures zero redundancy in infrastructure and zero inconsistency in outputs.

---

## The Pipeline

Every submission passes through a sequential, optimized pipeline regardless of which surface it enters from.

**Preprocessing** normalizes all input types to plain text. Images are processed through Llama 4 Scout (a vision-language model served via Groq), which extracts all visible text from screenshots, memes, and forwarded images. URLs are fetched and stripped of navigation boilerplate, isolating the article body. Filipino language detection runs on the normalized text using a heuristic model calibrated against localized specific function words.

**Claim Extraction** uses Llama 3.3 70B to isolate a single verifiable factual assertion from the input. The model is instructed to discard opinions, rhetorical questions, and non-falsifiable statements. Named entities, people, organizations, places, and dates are extracted simultaneously and used to broaden the subsequent fact-check search if initial results are sparse.

**Cache Lookup** queries Supabase before any external API call is made. If a prior verdict exists for the same claim, it is returned immediately with the full reasoning trace intact. This is a deliberate efficiency decision: the same false claim often circulates in waves in the Philippine context, and there is no value in re-running the full pipeline on a claim the system has already evaluated.

**Fact-Check Lookup** submits the claim to the Google Fact Check Tools API, which aggregates results from IFCN-certified Philippine fact-checkers (Vera Files, TSEK.PH, and AFP Fact Check). If a high-confidence match exists (a definitive verdict from a certified source), the system short-circuits: coverage analysis is skipped, and the pipeline proceeds directly to verdict generation. This reduces latency and API consumption for cases where an authoritative answer already exists.

**Coverage Analysis** is run only when no high-confidence fact-check is found, and queries three sources concurrently: the GDELT Document API (filtered to Philippine-domain and Tagalog-language sources), NewsAPI (restricted to seven major Philippine outlet domains), and a custom RSS fetcher pulling from seven active Philippine feeds. Each article is matched against the bias registry by domain or outlet name, producing a report of covering outlets, not-covering outlets, bias spread by political leaning, and total article count.

**Verdict Generation** synthesizes all evidence through Llama 3.3 70B. The model receives fact-check results, coverage spread, and bias distribution and returns a structured bilingual verdict with a confidence score (0.0–1.0), citations, a one-sentence reasoning summary, and a trace summary. IFCN-certified fact-checks are weighted heavily; single-perspective coverage is flagged. Invalid ratings are normalized to `unverified`. Confidence values are clamped to the valid range.

**Reasoning Trace** is constructed from the actual pipeline data and not from the language model, as a three-step chain: what the fact-check lookup found and its weight on the verdict, what the coverage analysis revealed and how broad the spread was, and how the AI synthesized both into its conclusion. This trace is a first-class output, displayed to the user alongside the verdict.

**Source Credibility** pulls a rating for each covering outlet from the bias registry: a 0–1 score, a classification (Highly Reliable, Generally Reliable, Needs Context, State Media), and a plain-language explanation. Users see not just who covered the story, but how much epistemic weight to assign each source.

---

## Technical Architecture

```
Input (text / image_base64 / url)
    |
    v
FastAPI Backend (Railway)
    │
    |--- Supabase cache lookup -> cache hit: return immediately
    │
    |--- Preprocessor
    │       |--- Text: normalize and clean
    │       |--- Image: Llama 4 Scout OCR via Groq
    │       L--- URL: httpx fetch + BeautifulSoup4 extraction
    │
    |--- Claim Extractor - Llama 3.3 70B via Groq
    │
    |--- Google Fact Check Tools API
    │       L--- high_confidence=True ──> skip to verdict generation
    │
    |--- Coverage Analyzer (asyncio.gather - concurrent)
    │       |--- GDELT Document API v2 (domain:.ph filter)
    │       |--- NewsAPI (7 PH outlet domains)
    │       └── RSS Fetcher × 7 feeds + bias registry matching
    │
    |--- Verdict Generator - Llama 3.3 70B via Groq
    │       |--- Bilingual verdict (EN + TL)
    │       |--- VerdictTrace - 3-step reasoning chain
    │       L--- SourceCredibility - per covering outlet
    │
    L--- Supabase - persist verdict + trace + credibility
                │
                v
   Chrome Extension / Messenger Bot / Web Dashboard
```

---

## Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| FastAPI | 0.115.0 | API framework |
| Uvicorn | 0.30.6 | ASGI server |
| Pydantic | 2.7.4 | Data validation and serialization |
| pydantic-settings | 2.3.4 | Environment variable management |
| groq | 0.11.0 | Llama 3.3 70B + Llama 4 Scout inference |
| httpx | 0.27.0 | Async HTTP client |
| beautifulsoup4 | 4.12.3 | HTML parsing for URL input |
| lxml | 5.2.2 | XML/HTML parser backend |
| feedparser | 6.0.11 | RSS feed parsing |
| supabase | 2.5.0 | Database client |
| python-dotenv | 1.0.1 | Environment configuration |

### Dashboard
| Package | Version | Purpose |
|---|---|---|
| React | 18.2.0 | UI framework |
| React Router DOM | 6.22.0 | Client-side routing |
| TailwindCSS | 3.4.1 | Styling |
| Vite | 5.1.0 | Build tooling |

### AI Models
| Model | Provider | Role |
|---|---|---|
| Llama 3.3 70B Versatile | Meta / Groq | Claim extraction and verdict generation |
| Llama 4 Scout 17B | Meta / Groq | Image OCR for screenshots and forwarded images |
| jcblaise/roberta-tagalog-base | Jan Christian Blaise Cruz / HuggingFace | Filipino language processing |

### Infrastructure
| Service | Purpose | Cost |
|---|---|---|
| Railway | Backend hosting, no sleep on inactivity | Free tier |
| Vercel | Dashboard hosting | Free tier |
| Supabase | PostgreSQL database, caching, RLS | Free tier |
| Groq API | Llama 3.3 70B + Llama 4 Scout inference | Free tier |
| Google Fact Check API | IFCN fact-checker aggregation | Free (Public Data) |
| GDELT API | Philippine news coverage | Public, no key |

The entire system runs on free-tier infrastructure.

---

## Philippine Media Coverage

VerifAI monitors seven active RSS feeds spanning the Philippine media:

| Outlet | Bias | Credibility Score | Classification |
|---|---|---|---|
| Rappler | Left | 0.85 | Highly Reliable (IFCN-certified) |
| GMA News | Center | 0.78 | Generally Reliable |
| Inquirer | Center | 0.76 | Generally Reliable |
| Business Mirror | Center | 0.70 | Generally Reliable |
| Google News PH | Aggregator | 0.72 | Generally Reliable |
| Eagle News | Right | 0.45 | Needs Context |
| Philippine News Agency | State | 0.40 | State Media |

An additional seven outlets are represented in the bias registry for display and reference: ABS-CBN News, PhilStar, Manila Bulletin, Manila Standard, One News PH, CNN Philippines, and VERA Files.

Bias classifications are grounded in assessments by the **Center for Media Freedom & Responsibility (CMFR)**. Credibility scores are based on documented editorial patterns, IFCN certification status, and press freedom assessments.

---

## Fact-Checking Sources

All fact-check data is sourced from **IFCN-certified organizations** through the Google Fact Check Tools API:

- **Vera Files** - Philippine political and health disinformation. IFCN signatory since 2018.
- **TSEK.PH** - Philippine manual citizen journalism fact-checking service.
- **AFP Fact Check** - Southeast Asia regional disinformation prevention. IFCN signatory.

---

## SDG Alignment

**SDG 4 - Quality Education:** VerifAI builds media literacy by making the reasoning behind every verdict visible. Users are not asked to trust a label; they are shown the evidence and the logic that produced it. Repeated exposure to this transparency is the mechanism by which the tool contributes to education, not just information retrieval.

**SDG 16 - Peace, Justice & Strong Institutions:** By surfacing disinformation at the point of consumption, ie, in Messenger, on websites, and in the public record via the dashboard, and by attributing credibility to institutional fact-checking sources, VerifAI supports the conditions for informed public discourse and institutional trust.

---

## Team

| Name | Contribution |
|---|---|
| Keegan Bryce Abeja | Team Leader, Backend Engineer |
| Daniel Jamero | Backend Engineer |
| Jhamez Razo | Frontend Developer |
| Dion Candido Castro | Frontend Developer |
| Ahjel Milan Bristol | Frontend Developer |

---

## Documentation, References & Citations

### AI Models & Inference

**Meta Llama 3.3 70B**
Meta AI. (2024). Llama 3 Model Card. https://github.com/meta-llama/llama3/blob/main/MODEL_CARD.md

**Meta Llama 4 Scout 17B**
Meta AI. (2025). Llama 4 Model Card. https://github.com/meta-llama/llama-models/blob/main/models/llama4/MODEL_CARD.md

**Groq API**
Groq, Inc. (2024). GroqCloud Documentation. https://console.groq.com/docs/

**jcblaise/roberta-tagalog-base**
Cruz, J. C. B., & Cheng, C. (2021). Establishing Baselines for Text Classification in Low-Resource Languages. *arXiv preprint arXiv:2005.02068*. https://arxiv.org/abs/2005.02068

**HuggingFace Transformers**
Wolf, T., et al. (2020). Transformers: State-of-the-Art Natural Language Processing. *Proceedings of EMNLP 2020*. https://arxiv.org/abs/1910.03771

### Backend Libraries

**FastAPI** - Ramírez, S. (2019). FastAPI - Modern, Fast Web Framework for Python. https://fastapi.tiangolo.com/

**Pydantic v2** - Colvin, S. (2023). Pydantic Documentation v2. https://docs.pydantic.dev/

**Uvicorn** - Encode. (2024). Uvicorn ASGI Server. https://www.uvicorn.org/

**httpx** - Encode. (2024). HTTPX - A next-generation HTTP client for Python. https://www.python-httpx.org/

**BeautifulSoup4** - Richardson, L. (2024). Beautiful Soup Documentation. https://www.crummy.com/software/BeautifulSoup/bs4/doc/

**feedparser** - Pilgrim, M., & Willison, S. (2024). feedparser Documentation. https://feedparser.readthedocs.io/

**Supabase Python Client** - Supabase, Inc. (2024). Supabase Documentation. https://supabase.com/docs

### Data & Fact-Checking APIs

**Google Fact Check Tools API**
Google Developers. (2024). Fact Check Tools API Reference. https://developers.google.com/fact-check/tools/api/reference/rest

**GDELT Project - Document API v2**
Leetaru, K., & Schrodt, P. A. (2013). GDELT: Global Data on Events, Location and Tone. *ISA Annual Convention 2013*. https://api.gdeltproject.org/api/v2/doc/doc

**NewsAPI**
NewsAPI.org. (2024). NewsAPI Documentation. https://newsapi.org/docs

**Supabase**
Supabase, Inc. (2024). Supabase - The Open Source Firebase Alternative. https://supabase.com/docs

### Philippine Fact-Checking Organizations

**Vera Files**
Vera Files. (2024). About Vera Files. https://verafiles.org/about-vera-files
IFCN Verified Signatory. Philippine political and health disinformation.

**TSEK.PH**
TSEK.PH. (2024). About TSEK.PH. https://tsek.ph/about/
Philippine election and COVID-19 fact-checking initiative.

**AFP Fact Check Philippines**
Agence France-Presse. (2024). AFP Fact Check. https://factcheck.afp.com/
IFCN Verified Signatory. Southeast Asia regional disinformation.

**International Fact-Checking Network - Code of Principles**
IFCN / Poynter Institute. (2024). IFCN Code of Principles. https://ifcncodeofprinciples.poynter.org/

### Philippine Media & Journalism

**Center for Media Freedom & Responsibility (CMFR)**
CMFR. (2024). Philippine Press Freedom Report. https://cmfr-phil.org/
Primary basis for outlet bias classifications in the VerifAI bias registry.

**Reuters Institute Digital News Report - Philippines**
Newman, N., et al. (2023). Reuters Institute Digital News Report 2023. *Reuters Institute for the Study of Journalism, University of Oxford*. https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2023

**Disinformation in the Philippine Context**
Ramos, C. (2020). How the Philippines' Election Became a Battleground for Fake News. *Reuters Institute*. https://reutersinstitute.politics.ox.ac.uk/

### Messaging Platform

**Meta Messenger Platform - Graph API v21.0**
Meta for Developers. (2024). Messenger Platform Documentation. https://developers.facebook.com/docs/messenger-platform/

**Messenger Webhooks**
Meta for Developers. (2024). Setting Up Your Webhook. https://developers.facebook.com/docs/messenger-platform/webhook/

### Frontend & Dashboard

**React 18** - Meta Open Source. (2024). React Documentation. https://react.dev/

**React Router v6** - Remix Software. (2024). React Router Documentation. https://reactrouter.com/

**TailwindCSS v3** - Tailwind Labs. (2024). Tailwind CSS Documentation. https://tailwindcss.com/docs/

**Vite** - Evan You & contributors. (2024). Vite Documentation. https://vitejs.dev/

### Deployment Infrastructure

**Railway** - Railway Corp. (2024). Railway Documentation. https://docs.railway.app/

**Vercel** - Vercel, Inc. (2024). Vercel Documentation. https://vercel.com/docs

### Chrome Extension

**Chrome Extensions - Manifest V3**
Google Chrome Developers. (2024). Chrome Extensions Manifest V3 Overview. https://developer.chrome.com/docs/extensions/migrating/

**Shadow DOM - Web Components**
MDN Web Docs. (2024). Using Shadow DOM. https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM

### Research Context

**Multilingual NLP for Filipino**
Cruz, J. C. B., & Cheng, C. (2020). Benchmarking a Transformer-Based NLP Model for Filipino. *CLARIN Annual Conference 2020*. https://arxiv.org/abs/2005.02068

**IFCN Principles for Fact-Checking**
Stencel, M., & Luther, J. (2020). Who fact-checks the fact-checkers? *Poynter Institute*. https://www.poynter.org/fact-checking/2020/

---

## AI Disclosure

| Tool | Role in VerifAI |
|---|---|
| Llama 3.3 70B Versatile (Groq) | Claim extraction and bilingual verdict generation |
| Llama 4 Scout 17B (Groq) | Image OCR for screenshots and forwarded images |
| Google Fact Check Tools API | Aggregation of IFCN-certified fact-checker results |
| HuggingFace / roberta-tagalog-base | Filipino language processing |

---

## License

This project is submitted for the **InterCICSkwela Hackathon - Batang Techno 2026** and is intended for educational and non-commercial use. Free to adapt with attribution. Not for commercial deployment without permission from the authors.