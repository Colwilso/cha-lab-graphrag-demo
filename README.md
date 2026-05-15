# Cha Lab Knowledge Graph Demo

A GraphRAG-powered knowledge graph built from Dr. Jeeyeon Cha's diabetes and beta-cell research publications. Extracts entities, relationships, and community structure from 28 scientific papers to create an interactive, queryable knowledge base.

---

## Quick Start

### Prerequisites

| Requirement | Mac | Windows |
|-------------|-----|---------|
| Python | `brew install python@3.11` | [python.org installer](https://www.python.org/downloads/) (check "Add to PATH") |
| Git | `brew install git` | [git-scm.com](https://git-scm.com/download/win) |
| bun | `brew install oven-sh/bun/bun` | `powershell -c "irm bun.sh/install.ps1 \| iex"` |

### Clone and Run

**Mac / Linux:**
```bash
git clone https://github.com/Colwilso/cha-lab-graphrag-demo.git
cd cha-lab-graphrag-demo

# Create virtual environment and install
python3 -m venv .venv
source .venv/bin/activate
pip install -e ./LightRAG
pip install "lightrag-hku[api]" aioboto3 boto3 lxml

# Start the server
cd LightRAG
lightrag-server

# Open http://localhost:9621 in your browser
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/Colwilso/cha-lab-graphrag-demo.git
cd cha-lab-graphrag-demo

# Create virtual environment and install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ./LightRAG
pip install "lightrag-hku[api]" aioboto3 boto3 lxml

# Start the server
cd LightRAG
lightrag-server

# Open http://localhost:9621 in your browser
```

### What Works Without AWS Credentials

The **Knowledge Graph viewer** works fully without any cloud credentials:
- Browse all 4,608 entities and 7,354 relationships
- Filter by entity type using the legend
- Click nodes to see descriptions, source papers, and neighbors
- Double-click to navigate into a node's neighborhood

### What Requires AWS Credentials (WIP for external users)

These features call Claude Sonnet and Titan Embed via AWS Bedrock and require a configured AWS profile with Bedrock access:

| Feature | Requires | Status |
|---------|----------|--------|
| **Retrieval Chat** (ask questions about the papers) | Claude Sonnet + Titan Embed | Requires AWS `default` profile |
| **Relationship Analysis** (shift+click 2+ nodes, click Analyze) | Claude Sonnet | Requires AWS `default` profile |
| **Re-running the extraction pipeline** (`run_lightrag.py`) | Claude Sonnet + Titan Embed | Requires AWS `default` profile |
| **Document ingestion** (uploading new papers) | Claude Sonnet + Titan Embed | Requires AWS `default` profile |

To use these features with your own AWS account, edit `LightRAG/.env`:
```bash
AWS_PROFILE=your-profile-name   # Must have bedrock:InvokeModel permission
AWS_REGION=us-east-1
LLM_MODEL=us.anthropic.claude-sonnet-4-6
EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
```

Alternatively, switch to a local model (no AWS needed):
```bash
LLM_BINDING=ollama
LLM_MODEL=mistral-nemo:latest
EMBEDDING_BINDING=ollama
EMBEDDING_MODEL=nomic-embed-text
```
This requires [Ollama](https://ollama.com) running locally with those models pulled.

---

## Overview

This project demonstrates how retrieval-augmented generation (RAG) combined with knowledge graph extraction can turn a corpus of scientific literature into a navigable, structured knowledge base. The graph captures genes, proteins, mutations, diseases, biological processes, and their relationships as described across the research papers.

**Graph statistics:**
- 4,608 entities (nodes)
- 7,354 relationships (edges)
- 686 communities detected (Louvain)
- 28 source papers from PubMed Central

## Source Papers

Three seed papers from the Cha/Stein lab, plus their citations and related MAFA/MAFB literature:

### Seed Papers

| PMID | Title | Journal | Year |
|------|-------|---------|------|
| [34644565](https://pubmed.ncbi.nlm.nih.gov/34644565/) | Sex-biased islet beta cell dysfunction is caused by the MODY MAFA S64F variant by inducing premature aging and senescence in males | Cell Reports | 2021 |
| [37662349](https://pubmed.ncbi.nlm.nih.gov/37662349/) | Defining unique structural features in the MAFA and MAFB transcription factors that control Insulin gene activity | bioRxiv / J Biol Chem | 2023 |
| [40475642](https://pubmed.ncbi.nlm.nih.gov/40475642/) | Genetic background influences the phenotypic penetrance by MAFA S64F MODY in male mice | bioRxiv | 2025 |

### Citation and Related Paper Network

15 papers citing the primary seed paper (PMID 34644565) covering beta-cell senescence, sex-specific islet regulation, DNA damage, caloric restriction, and type 2 diabetes. 10 related papers on MAFA/MAFB transcription factor biology spanning 2003-2024.

Full paper list with links available in `research/README.md`.

## Using the WebUI

- **Left dropdown**: Select an entity name to load its neighborhood subgraph
- **Single-click** a node: View its properties, description, source papers, and ranked neighbors in the right sidebar
- **Shift+click** additional nodes: Multi-select for relationship analysis
- **Double-click** a node: Navigate into that node (re-centers the graph on it)
- **Legend** (bottom-right): Click types to filter, "All"/"None" to toggle all
- **Relationship Analysis**: Shift+click 2+ nodes, click "Analyze Relationship" in sidebar. Uses Steiner tree + link prediction to map connections.
- **Retrieval Chat**: Ask natural language questions, get answers with PubMed-linked citations
- **Sliders** (bottom-left): Adjust force layout parameters
- **Settings gear** (bottom-left): Adjust max nodes, depth, layout iterations

## Methodology

### 1. Paper Collection

Papers collected via NCBI E-utilities API:
- `elink.fcgi` for citation and related paper discovery
- `efetch.fcgi` for full-text JATS XML download from PMC

### 2. Text Extraction

JATS XML parsed with lxml to extract article title, abstract, and body text. Average document: ~40K characters.

### 3. Entity/Relationship Extraction

LightRAG's chunking (1200 tokens, 100 overlap) feeds each chunk to Claude Sonnet via AWS Bedrock Converse API. A custom biomedical extraction prompt enforces:
- Uppercase gene/protein names (MAFA, MAFB, PDX1)
- Domain-specific entity types (Gene, Protein, Mutation, CellType, Disease, Pathway, BiologicalProcess, Organism, Tissue, Method, Drug, Molecule, Phenotype)
- Standardized mutation naming (MAFA_S64F)

### 4. Graph Construction

LightRAG merges entities across documents via LLM-powered map-reduce description summarization. Same-name entities from different papers get their descriptions consolidated.

### 5. Post-Processing

- Louvain community detection (686 communities with descriptive names)
- Case-insensitive deduplication (73 merged nodes)
- Synonym merging (MAFA_S64F variants consolidated)
- Entity type normalization (17 clean categories from 25+ raw types)
- Paper title citation patching (PubMed URLs linked to source attributions)

### 6. Embedding and Retrieval

Amazon Titan Embed Text v2 (1024 dimensions) for entity/relationship/chunk embeddings. Supports hybrid retrieval combining graph traversal with vector similarity.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| LLM (extraction) | Claude Sonnet via AWS Bedrock |
| Embeddings | Amazon Titan Embed Text v2 |
| Graph framework | LightRAG (HKUDS) |
| Graph storage | NetworkX + GraphML |
| Vector storage | nano-vectordb |
| Community detection | python-louvain |
| Frontend | React 19 + TypeScript + Sigma.js + Tailwind |
| Build tool | bun |
| Server | FastAPI + uvicorn |

## Project Structure

```
cha-lab-demo/
├── research/              # Source papers and metadata
│   ├── fulltext/          # 28 JATS XML files from PMC
│   ├── papers_index.json  # Paper metadata (PMID, title, DOI, etc.)
│   └── README.md          # Full paper inventory
├── lightrag_workdir/      # LightRAG output
│   ├── graph_chunk_entity_relation.graphml  # The knowledge graph
│   ├── vdb_*.json         # Vector databases
│   └── kv_store_*.json    # Key-value stores
├── LightRAG/              # Modified LightRAG (cloned + customized)
│   ├── .env               # Server configuration
│   └── lightrag_webui/    # React frontend (customized)
├── run_lightrag.py        # Extraction pipeline script
└── DEVELOPMENT.md         # How this was built (AI collaboration log)
```

## License

LightRAG is MIT licensed. Research papers are sourced from PubMed Central Open Access subset.
