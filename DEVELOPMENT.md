# Development Log: Building a GraphRAG Knowledge Base in One Day

This document describes how this project was built collaboratively between a human researcher (Colin Wilson) and Claude Code (Claude Opus) in a single working session on May 11-12, 2026. It serves as a case study for AI-assisted research tool development.

## Timeline

**Total elapsed time:** ~8 hours (including LLM extraction runtime)
**Active development time:** ~4 hours of human-AI interaction
**LLM extraction pipeline runtime:** ~2 hours (running in background)

## Phase 1: Paper Collection (30 minutes)

**Goal:** Download Dr. Cha's research papers and their citation network.

**Process:**
1. Human provided 3 PubMed URLs as seed papers
2. Claude fetched paper metadata via WebFetch, then used NCBI E-utilities API (`elink.fcgi`) to discover 15 citing papers and 10 related papers
3. Full-text JATS XML downloaded from PMC via `efetch.fcgi` for all 28 papers
4. Claude built a structured index (`papers_index.json`) with titles, authors, DOIs, PMCIDs

**AI contribution:** Wrote all API interaction code, handled XML parsing, built the research index. Human provided the seed URLs and the research direction.

**Decisions made:**
- JATS XML chosen over PDF (structured, parseable, no OCR needed)
- Accepted abstract-only for 8 papers where PMC didn't have full text
- Included the peer-reviewed version (PMID 39476962) alongside the preprint (37662349)

## Phase 2: Existing KG Research (15 minutes)

**Goal:** Identify existing diabetes knowledge graphs that could serve as a foundation.

**Process:**
- Claude spawned a research agent to search GitHub, academic databases, and KG repositories
- Identified 16 relevant resources (T2D-Net, DisGeNET, Open Targets, Monarch, KEGG, etc.)
- Assessed that none covered the senescence/MAFA-specific angle

**Outcome:** Decided to build from scratch using the literature, with the option to later integrate with DisGeNET or Open Targets for broader context.

## Phase 3: LightRAG Setup and Configuration (45 minutes)

**Goal:** Set up the GraphRAG extraction pipeline.

**Process:**
1. Cloned LightRAG from GitHub
2. Created Python venv with all dependencies
3. Configured for AWS Bedrock (Claude Sonnet for extraction, Titan Embed v2 for embeddings)
4. Wrote `run_lightrag.py` with JATS XML text extraction

**Challenges encountered:**
- `aioboto3` doesn't use `AWS_PROFILE` env var -- solved by resolving credentials via `boto3.Session` and exporting as env vars
- Initial test showed the pipeline hanging -- traced to missing credential resolution

**AI contribution:** Full pipeline script, AWS integration, text extraction from JATS XML.

## Phase 4: Extraction Pipeline (2 hours runtime, 30 minutes debugging)

**Goal:** Extract entities and relationships from all 28 papers.

**Process:**
- Pipeline ran in background via `nohup`
- Processed papers sequentially (rate-limited to 3 concurrent LLM calls)
- Each paper chunked into ~1200 token segments, each sent to Claude Sonnet for entity/relationship extraction

**Failures and fixes:**
1. **Bedrock HTTP read timeout (60s default):** Large biomedical chunks took >60s for Claude to process. Fixed by patching `lightrag/llm/bedrock.py` to use 600s read timeout via `botocore.Config`.
2. **Process dying mid-extraction:** Initially thought to be credential expiry, actually the timeout. Added per-document credential refresh anyway as defensive measure.
3. **Duplicate document detection:** LightRAG correctly skipped already-processed papers on restart, allowing the pipeline to resume after crashes.

**Results:** 4,608 entities and 7,354 relationships extracted from 28 papers in ~2 hours of background processing.

## Phase 5: Post-Processing (30 minutes)

**Goal:** Clean up the raw extracted graph.

**Steps performed:**
1. **Case-insensitive deduplication:** Merged "MafA", "MAFA", "Mafa" into single nodes (73 merged)
2. **Synonym merging:** Consolidated variants like "MAFA S64F Mutation", "p.Ser64Phe MAFA", "MafAS64F" into "MAFA_S64F"
3. **Entity type normalization:** Mapped 25+ raw types (concept, creature, artifact, naturalobject, etc.) to 17 clean domain-specific categories (Gene, Protein, Cell Type, Biological Process, etc.)
4. **Community detection:** Ran Louvain algorithm, identified 686 communities with descriptive names derived from top-3 nodes by degree
5. **Citation patching:** Updated all node/edge `file_path` attributes from "unknown_source" to actual paper titles with PubMed URLs

**AI contribution:** Wrote all post-processing scripts. Human directed which merges to make and reviewed the entity type mapping.

## Phase 6: WebUI Customization (2 hours)

**Goal:** Make the LightRAG WebUI suitable for a research demo.

**Modifications made to the React frontend:**

1. **Interactive legend with filtering:**
   - Click a type to hide all nodes of that type
   - Shift+click to solo (show only that type)
   - Deduplicated display names (no more "Creature" alongside "Organism")
   - "Show all" reset button

2. **Force layout parameter sliders:**
   - ForceAtlas2: Scaling Ratio, Gravity, Slow Down
   - Force Directed: Repulsion, Attraction, Gravity
   - Real-time re-layout on slider change

3. **Property sidebar (right panel):**
   - Fixed 420px sidebar instead of floating popup
   - Full description text with word wrap (no truncation)
   - Neighbors ranked by degree with type labels
   - Sources section with hyperlinked paper titles pointing to PubMed

4. **Navigation improvements:**
   - Default max nodes: 30 (manageable initial view)
   - Default layout: ForceAtlas2 with tuned parameters
   - Double-click node to navigate into its neighborhood
   - Single-click to inspect without changing context

5. **Backend adjustments:**
   - MAX_GRAPH_NODES raised to 5000
   - Entity type normalization in operate.py (title case instead of lowercase)
   - Bedrock read timeout patch

**Testing:** Used Playwright for automated UAT -- navigating to the graph, opening the legend, clicking to filter, verifying shift+click solo, checking slider visibility, and confirming community data in the API response.

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Claude Sonnet (not Haiku) for extraction | Biomedical text needs strong reasoning for entity disambiguation |
| 1200 token chunks | Balances context for entity extraction without exceeding output limits |
| Uppercase gene names in prompt | Prevents case-variant duplicates (MafA vs MAFA) at extraction time |
| NetworkX (not Neo4j) for storage | Simpler deployment for a demo; single GraphML file |
| Louvain (not Leiden) for communities | Available in pure Python; sufficient for 4600 nodes |
| 30-node default view | Readable starting point; double-click to explore deeper |

## What Worked Well

- **Iterative debugging:** Claude could inspect errors, trace through code, and propose fixes without human needing to read stack traces
- **Background processing:** Running the extraction pipeline via `nohup` while continuing to work on the WebUI
- **Playwright testing:** Automated verification of UI changes before presenting to the user
- **Post-hoc patching:** Retroactively fixing entity types and adding citations without re-running extraction

## What Could Be Improved

- **Entity deduplication at extraction time:** The custom prompt helps but doesn't fully prevent variants like "beta cell" vs "Pancreatic beta Cell"
- **Community labels:** Currently just top-3 nodes by degree; could use LLM summarization for proper community descriptions
- **Node sizing:** Currently degree-based; PageRank would better reflect structural importance
- **Edge semantics:** Many edges have generic "associated_with" keywords; could benefit from ontology-guided relationship typing

## Tools Used

- **Claude Code (Claude Opus):** Primary development partner -- wrote all code, debugged issues, ran tests
- **AWS Bedrock (Claude Sonnet):** Entity/relationship extraction from paper text
- **AWS Bedrock (Titan Embed v2):** Embedding generation for vector retrieval
- **LightRAG:** Open-source GraphRAG framework (modified for this project)
- **Playwright:** Automated browser testing for UI verification
- **NCBI E-utilities:** Paper discovery and full-text download
