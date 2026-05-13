# Cha Lab Knowledge Graph Demo

A GraphRAG-powered knowledge graph built from Dr. Jeeyeon Cha's diabetes and beta-cell research publications. Extracts entities, relationships, and community structure from 28 scientific papers to create an interactive, queryable knowledge base.

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

## How to Use

### Prerequisites

- Python 3.10+
- AWS credentials with Bedrock access (profile: `nasc_lma` or equivalent with Claude Sonnet and Titan Embed access)
- bun (for WebUI builds)

### Quick Start (View Existing Graph)

```bash
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

### Re-run Extraction Pipeline

```bash
source .venv/bin/activate
export AWS_PROFILE=nasc_lma

# Run the full extraction (takes ~1 hour)
python run_lightrag.py
```

### Using the WebUI

- **Left dropdown**: Select an entity name to load its neighborhood subgraph
- **Single-click** a node: View its properties, description, source papers, and ranked neighbors in the right sidebar
- **Double-click** a node: Navigate into that node (re-centers the graph on it)
- **Legend** (book icon, bottom-left): Click types to filter, Shift+click to solo
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
