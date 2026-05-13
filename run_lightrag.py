"""
LightRAG knowledge graph extraction pipeline for Dr. Cha's lab demo.
Processes JATS XML papers from research/fulltext/ using AWS Bedrock (nasc_lma profile).
"""

import asyncio
import os
import re
import sys
import logging
from pathlib import Path
from lxml import etree

# LightRAG imports
from lightrag import LightRAG, QueryParam
from lightrag.llm.bedrock import bedrock_complete, bedrock_embed
from lightrag.utils import EmbeddingFunc
from lightrag.prompt import PROMPTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("aiobotocore").setLevel(logging.WARNING)
logging.getLogger("botocore").setLevel(logging.WARNING)

WORKING_DIR = "./lightrag_workdir"
RESEARCH_DIR = "./research/fulltext"
AWS_REGION = "us-east-1"
AWS_PROFILE = "nasc_lma"
LLM_MODEL = "us.anthropic.claude-sonnet-4-6"
EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"

# Domain-specific entity types for diabetes/beta-cell research
ENTITY_TYPES = [
    "Gene",
    "Protein",
    "Mutation",
    "CellType",
    "Disease",
    "Pathway",
    "BiologicalProcess",
    "Organism",
    "Tissue",
    "Method",
    "Drug",
    "Molecule",
    "Phenotype",
]

# Override the extraction system prompt to enforce UPPERCASE for gene/protein names
PROMPTS["entity_extraction_system_prompt"] = """---Role---
You are a Biomedical Knowledge Graph Specialist extracting entities and relationships from scientific papers about diabetes, pancreatic beta cells, and transcription factors.

---Instructions---
1.  **Entity Extraction & Output:**
    *   **Identification:** Identify clearly defined and meaningful entities in the input text.
    *   **Entity Details:** For each identified entity, extract:
        *   `entity_name`: The canonical name of the entity. CRITICAL NAMING RULES:
            - Gene/protein names MUST be UPPERCASE (e.g., MAFA, MAFB, PDX1, NEUROD1, INS, SLC30A8, NKX6-1, RBP4)
            - Mutations use format: GENE_MUTATION (e.g., MAFA_S64F, MAFB_S70A)
            - Cell types use consistent form (e.g., "beta cell", "alpha cell", "islet")
            - Diseases use standard names (e.g., "type 2 diabetes", "MODY", "insulinomatosis")
            - Mouse strains use standard form (e.g., "C57BL/6J", "C57BL/6J-SJL")
            - Do NOT use italics, special formatting, or variant capitalizations like MafA, Mafa, mafA -- always MAFA
        *   `entity_type`: One of: `{entity_types}`. Use `BiologicalProcess` for cellular processes (senescence, apoptosis, differentiation).
        *   `entity_description`: Concise description based solely on the input text.
    *   **Output Format - Entities:** 4 fields delimited by `{tuple_delimiter}`:
        *   Format: `entity{tuple_delimiter}entity_name{tuple_delimiter}entity_type{tuple_delimiter}entity_description`

2.  **Relationship Extraction & Output:**
    *   **Identification:** Identify direct, clearly stated relationships between extracted entities.
    *   **N-ary Decomposition:** Break multi-entity relationships into binary pairs.
    *   **Relationship Details:**
        *   `source_entity`: Name matching an extracted entity (UPPERCASE for genes/proteins).
        *   `target_entity`: Name matching an extracted entity (UPPERCASE for genes/proteins).
        *   `relationship_keywords`: High-level keywords (e.g., regulates, expressed_in, causes, associated_with, inhibits, activates, mutant_of, interacts_with). Separate multiple keywords with comma.
        *   `relationship_description`: Concise explanation of the relationship.
    *   **Output Format - Relationships:** 5 fields delimited by `{tuple_delimiter}`:
        *   Format: `relation{tuple_delimiter}source_entity{tuple_delimiter}target_entity{tuple_delimiter}relationship_keywords{tuple_delimiter}relationship_description`

3.  **Delimiter Usage:** `{tuple_delimiter}` is an atomic field separator only.

4.  **Relationship Direction:** Treat as undirected unless explicitly directional. No duplicates.

5.  **Output Order:** All entities first, then relationships (most significant first).

6.  **Context:** Use third person. Name subjects explicitly, no pronouns.

7.  **Language:** Output in `{language}`. Keep proper nouns in original language.

8.  **Completion:** Output `{completion_delimiter}` after all extractions.

---Examples---
{examples}
"""


def extract_text_from_jats(xml_path: str) -> str:
    """Extract readable text from a JATS XML file."""
    try:
        tree = etree.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        logging.warning(f"Failed to parse {xml_path}: {e}")
        return ""

    texts = []

    for title in root.iter("{http://www.ncbi.nlm.nih.gov/JATS1}article-title"):
        if title.text:
            texts.append(f"Title: {title.text.strip()}")
    for title in root.iter("article-title"):
        if title.text:
            texts.append(f"Title: {title.text.strip()}")

    for abstract in root.iter("abstract"):
        abstract_text = etree.tostring(abstract, method="text", encoding="unicode")
        if abstract_text.strip():
            texts.append(f"Abstract: {abstract_text.strip()}")

    for body in root.iter("body"):
        body_text = etree.tostring(body, method="text", encoding="unicode")
        if body_text.strip():
            texts.append(body_text.strip())

    if len(texts) <= 2:
        full_text = etree.tostring(root, method="text", encoding="unicode")
        if full_text.strip():
            texts.append(full_text.strip())

    combined = "\n\n".join(texts)
    combined = re.sub(r"\n{3,}", "\n\n", combined)
    combined = re.sub(r" {2,}", " ", combined)
    return combined


def load_corpus() -> list[tuple[str, str, str]]:
    """Load all papers from research/fulltext/ and return (filename, text, title) tuples."""
    import json

    # Load paper metadata for titles
    titles_map = {}
    index_path = Path("./research/papers_index.json")
    if index_path.exists():
        with open(index_path) as f:
            for p in json.load(f):
                titles_map[p["pmid"]] = p["title"]

    documents = []
    research_path = Path(RESEARCH_DIR)

    for f in sorted(research_path.iterdir()):
        if f.suffix == ".xml":
            text = extract_text_from_jats(str(f))
            if len(text) > 200:
                # Extract PMID from filename (PMID_12345678_PMCxxxxxx.xml)
                pmid = f.name.split("_")[1] if "_" in f.name else ""
                title = titles_map.get(pmid, f.name)
                documents.append((f.name, text, title))
                logging.info(f"Loaded {f.name} ({len(text):,} chars)")
            else:
                logging.warning(f"Skipped {f.name} (too short: {len(text)} chars)")
        elif f.suffix == ".txt":
            text = f.read_text()
            if len(text) > 100:
                pmid = f.name.split("_")[1] if "_" in f.name else ""
                title = titles_map.get(pmid, f.name)
                documents.append((f.name, text, title))
                logging.info(f"Loaded {f.name} ({len(text):,} chars)")

    return documents


def deduplicate_graph(working_dir: str):
    """
    Post-extraction deduplication: merge nodes that differ only by case.
    For gene/protein entities, normalize to UPPERCASE and merge edges/descriptions.
    """
    import networkx as nx
    import json

    graph_path = os.path.join(working_dir, "graph_chunk_entity_relation.graphml")
    if not os.path.exists(graph_path):
        logging.warning("No graph file found for deduplication.")
        return

    G = nx.read_graphml(graph_path)
    original_nodes = G.number_of_nodes()
    original_edges = G.number_of_edges()

    # Known gene/protein names that should always be UPPERCASE
    known_genes = {
        "mafa", "mafb", "mafc", "pdx1", "neurod1", "nkx6-1", "nkx6.1",
        "ins", "ins1", "ins2", "slc30a8", "rbp4", "glut2", "slc2a2",
        "hnf1a", "hnf4a", "hnf1b", "gck", "pax6", "pax4", "arx",
        "foxo1", "isl1", "nkx2-2", "mnx1", "rfx6", "ucn3", "sst",
        "gcg", "ppy", "ghrl", "sox9", "ngn3", "ptf1a", "cdkn1a",
        "cdkn2a", "tp53", "p53", "p21", "p16", "rb1",
    }

    # Build case-insensitive mapping: lowercase -> list of actual node names
    name_groups: dict[str, list[str]] = {}
    for node in G.nodes():
        key = node.lower().strip()
        if key not in name_groups:
            name_groups[key] = []
        name_groups[key].append(node)

    # Find groups with multiple variants (case duplicates)
    merge_count = 0
    for key, variants in name_groups.items():
        if len(variants) <= 1:
            continue

        # Choose canonical name: UPPERCASE if it's a gene, otherwise longest variant
        if key in known_genes or key.replace("-", "").replace("_", "").isalpha() and len(key) <= 10:
            canonical = key.upper()
        else:
            canonical = max(variants, key=len)

        # If canonical isn't already a node, pick the variant with most edges
        if canonical not in variants:
            canonical = max(variants, key=lambda v: G.degree(v))

        # Merge all other variants into canonical
        for variant in variants:
            if variant == canonical:
                continue

            # Merge node attributes (concatenate descriptions)
            canonical_data = G.nodes[canonical]
            variant_data = G.nodes[variant]

            if "description" in variant_data and variant_data["description"]:
                existing = canonical_data.get("description", "")
                sep = "<SEP>" if existing else ""
                G.nodes[canonical]["description"] = existing + sep + variant_data["description"]

            if "source_id" in variant_data and variant_data["source_id"]:
                existing = canonical_data.get("source_id", "")
                sep = "<SEP>" if existing else ""
                G.nodes[canonical]["source_id"] = existing + sep + variant_data["source_id"]

            # Move all edges from variant to canonical
            for neighbor in list(G.neighbors(variant)):
                if neighbor == canonical:
                    continue
                edge_data = G.edges[variant, neighbor]
                if G.has_edge(canonical, neighbor):
                    # Merge edge attributes
                    existing_edge = G.edges[canonical, neighbor]
                    for attr in ["description", "source_id", "keywords"]:
                        if attr in edge_data and edge_data[attr]:
                            old = existing_edge.get(attr, "")
                            sep = "<SEP>" if old else ""
                            G.edges[canonical, neighbor][attr] = old + sep + edge_data[attr]
                else:
                    G.add_edge(canonical, neighbor, **edge_data)

            G.remove_node(variant)
            merge_count += 1

    # Also normalize: uppercase any node that looks like a gene symbol (all-alpha, <= 10 chars)
    nodes_to_rename = {}
    for node in list(G.nodes()):
        node_lower = node.lower().strip()
        if node_lower in known_genes and node != node.upper():
            nodes_to_rename[node] = node.upper()

    for old_name, new_name in nodes_to_rename.items():
        if new_name in G.nodes() and old_name != new_name:
            # Merge into existing uppercase node
            for neighbor in list(G.neighbors(old_name)):
                if neighbor == new_name:
                    continue
                edge_data = G.edges[old_name, neighbor]
                if not G.has_edge(new_name, neighbor):
                    G.add_edge(new_name, neighbor, **edge_data)
            G.remove_node(old_name)
            merge_count += 1
        elif old_name in G.nodes():
            nx.relabel_nodes(G, {old_name: new_name}, copy=False)

    # Second pass: merge known synonyms for this domain
    synonym_groups = {
        "MAFA_S64F": [
            "MafAS64F", "MAFA S64F Mutation", "MAFA S64F Variant",
            "MODY MAFA S64F Variant", "p.Ser64Phe MAFA Mutation",
            "MAFA p.Ser64Phe", "p.Ser64Phe MAFA", "MAFA Ser64Phe",
            "S64F MAFA Variant", "S64F MafA Mouse Model",
            "MafAS64F/+", "MafAS64F/S64F Mice",
        ],
        "MAFB_S70A": [
            "MAFB Ser70Ala", "MafB S70A",
        ],
        "beta cell": [
            "β-Cell", "β Cell", "Beta Cell", "beta-cell",
            "Islet β-Cell", "Islet Beta Cell", "pancreatic beta cell",
        ],
        "alpha cell": [
            "α-Cell", "α Cell", "Alpha Cell", "alpha-cell",
        ],
        "type 2 diabetes": [
            "Type 2 Diabetes Mellitus", "T2D", "T2DM",
        ],
        "type 1 diabetes": [
            "Type 1 Diabetes Mellitus", "T1D", "T1DM",
        ],
        "cellular senescence": [
            "Cellular Senescence", "Cell Senescence", "Senescence",
            "Beta Cell Senescence", "β-Cell Senescence",
        ],
    }

    for canonical, synonyms in synonym_groups.items():
        matching_nodes = [n for n in G.nodes() if n in synonyms]
        if not matching_nodes:
            continue

        # Ensure canonical exists
        if canonical not in G.nodes():
            # Use the highest-degree synonym as the base
            if matching_nodes:
                base = max(matching_nodes, key=lambda n: G.degree(n))
                nx.relabel_nodes(G, {base: canonical}, copy=False)
                matching_nodes.remove(base)
                merge_count += 1

        # Merge remaining synonyms into canonical
        for syn in matching_nodes:
            if syn not in G.nodes() or syn == canonical:
                continue
            # Transfer edges
            for neighbor in list(G.neighbors(syn)):
                if neighbor == canonical:
                    continue
                edge_data = G.edges[syn, neighbor]
                if G.has_edge(canonical, neighbor):
                    existing_edge = G.edges[canonical, neighbor]
                    for attr in ["description", "source_id", "keywords"]:
                        if attr in edge_data and edge_data[attr]:
                            old = existing_edge.get(attr, "")
                            sep = "<SEP>" if old else ""
                            G.edges[canonical, neighbor][attr] = old + sep + edge_data[attr]
                else:
                    G.add_edge(canonical, neighbor, **edge_data)
            # Merge descriptions
            syn_data = G.nodes[syn]
            if "description" in syn_data and syn_data["description"]:
                existing = G.nodes.get(canonical, {}).get("description", "")
                sep = "<SEP>" if existing else ""
                if canonical in G.nodes():
                    G.nodes[canonical]["description"] = existing + sep + syn_data["description"]
            G.remove_node(syn)
            merge_count += 1

    nx.write_graphml(G, graph_path)

    logging.info(
        f"Deduplication complete: {original_nodes} -> {G.number_of_nodes()} nodes "
        f"({merge_count} merged), {original_edges} -> {G.number_of_edges()} edges"
    )


async def run_pipeline():
    """Run the LightRAG extraction pipeline."""
    import boto3

    # Resolve credentials from AWS profile
    session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
    creds = session.get_credentials().get_frozen_credentials()
    os.environ["AWS_ACCESS_KEY_ID"] = creds.access_key
    os.environ["AWS_SECRET_ACCESS_KEY"] = creds.secret_key
    if creds.token:
        os.environ["AWS_SESSION_TOKEN"] = creds.token
    os.environ["AWS_REGION"] = AWS_REGION
    os.environ["AWS_DEFAULT_REGION"] = AWS_REGION

    os.makedirs(WORKING_DIR, exist_ok=True)

    logging.info("Loading corpus...")
    documents = load_corpus()
    logging.info(f"Loaded {len(documents)} documents")

    if not documents:
        logging.error("No documents found. Check research/fulltext/ directory.")
        sys.exit(1)

    logging.info(f"Initializing LightRAG with Bedrock model: {LLM_MODEL}")
    rag = LightRAG(
        working_dir=WORKING_DIR,
        llm_model_func=bedrock_complete,
        llm_model_name=LLM_MODEL,
        llm_model_max_async=3,
        embedding_func=EmbeddingFunc(
            embedding_dim=1024,
            max_token_size=8192,
            func=bedrock_embed,
        ),
        chunk_token_size=1200,
        chunk_overlap_token_size=100,
        addon_params={"entity_types": ENTITY_TYPES},
        default_llm_timeout=600,
    )

    await rag.initialize_storages()

    def refresh_creds():
        """Refresh AWS credentials from profile before they expire."""
        s = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        c = s.get_credentials().get_frozen_credentials()
        os.environ["AWS_ACCESS_KEY_ID"] = c.access_key
        os.environ["AWS_SECRET_ACCESS_KEY"] = c.secret_key
        if c.token:
            os.environ["AWS_SESSION_TOKEN"] = c.token

    logging.info("Starting document insertion (entity/relation extraction)...")
    total = len(documents)
    for i, (filename, text, title) in enumerate(documents, 1):
        refresh_creds()
        logging.info(f"[{i}/{total}] Processing: {filename}")
        try:
            await rag.ainsert(text, ids=[filename], file_paths=[title])
            logging.info(f"[{i}/{total}] Done: {filename}")
        except Exception as e:
            logging.error(f"Failed to process {filename}: {e}")
            continue

    await rag.finalize_storages()
    logging.info("Extraction complete.")

    # Post-extraction deduplication
    logging.info("Running post-extraction deduplication...")
    deduplicate_graph(WORKING_DIR)

    # Test queries
    logging.info("Running test queries...")
    rag2 = LightRAG(
        working_dir=WORKING_DIR,
        llm_model_func=bedrock_complete,
        llm_model_name=LLM_MODEL,
        llm_model_max_async=3,
        embedding_func=EmbeddingFunc(
            embedding_dim=1024,
            max_token_size=8192,
            func=bedrock_embed,
        ),
    )
    await rag2.initialize_storages()

    test_queries = [
        "What is the role of MAFA S64F mutation in diabetes?",
        "How does cellular senescence affect beta cells?",
        "What are the sex-specific differences in MODY?",
    ]

    for query in test_queries:
        logging.info(f"\nQuery: {query}")
        try:
            refresh_creds()
            result = await rag2.aquery(query, param=QueryParam(mode="hybrid"))
            logging.info(f"Answer: {result[:500]}...")
        except Exception as e:
            logging.error(f"Query failed: {e}")

    await rag2.finalize_storages()
    logging.info(f"Done. Knowledge graph stored in: {WORKING_DIR}/")


if __name__ == "__main__":
    asyncio.run(run_pipeline())
