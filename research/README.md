# Research Paper Collection

## Overview

- **Total papers**: 28
- **Seed papers**: 3
- **Citations of seed papers**: 15
- **Related papers (MAFA/MAFB family)**: 10
- **Full text available**: 20/28 (8 abstract-only)

## Data Format

All papers are stored as JATS XML in `fulltext/` directory. JATS XML is the standard format
used by PubMed Central and contains structured sections, figures, tables, and references.
This format is ideal for NLP/GraphRAG extraction pipelines.

## Seed Papers

Starting papers from Dr. Cha's lab

| PMID | Title | Journal | Year | Full Text |
|------|-------|---------|------|----------|
| 34644565 | Sex-biased islet β cell dysfunction is caused by the MODY MAFA S64F variant by i... | Cell Rep | 2021 | Yes |
| 37662349 | Defining unique structural features in the MAFA and MAFB transcription factors t... | bioRxiv | 2024 | Abstract only |
| 40475642 | Genetic background influences the phenotypic penetrance by MAFA (S64F) MODY in m... | bioRxiv | 2025 | Abstract only |

## Citations (papers citing seed papers)

Papers that cite PMID 34644565

| PMID | Title | Journal | Year | Full Text |
|------|-------|---------|------|----------|
| 41292712 | Developmental control of DNA damage responses in α- and β-cells shapes the selec... | bioRxiv | 2025 | Yes |
| 41031371 | Nucleolar stress facilitates islet β cell senescence via hijacking the DNA damag... | iScience | 2025 | Yes |
| 40768044 | The role of the beta cell in type 2 diabetes: new findings from the last 5 years... | Diabetologia | 2025 | Yes |
| 39821711 | Neuroendocrine Tumors: Germline Genetics and Hereditary Syndromes. | Curr Treat Options Oncol | 2025 | Abstract only |
| 39567827 | Sex-specific regulatory architecture of pancreatic islets from subjects with and... | EMBO J | 2024 | Yes |
| 39433757 | Calorie restriction increases insulin sensitivity to promote beta cell homeostas... | Nat Commun | 2024 | Yes |
| 39364746 | Safeguarding genomic integrity in beta-cells: implications for beta-cell differe... | Biochem Soc Trans | 2024 | Yes |
| 39239092 | Exploring senescence as a modifier of β cell extracellular vesicles in type 1 di... | Front Endocrinol (Lausanne) | 2024 | Yes |
| 39011095 | Single cell regulatory architecture of human pancreatic islets suggests sex diff... | Res Sq | 2024 | Yes |
| 38831121 | SenNet recommendations for detecting senescent cells in different tissues. | Nat Rev Mol Cell Biol | 2024 | Yes |
| 38645001 | Single cell regulatory architecture of human pancreatic islets suggests sex diff... | bioRxiv | 2024 | Yes |
| 37949065 | Stress-induced β cell early senescence confers protection against type 1 diabete... | Cell Metab | 2023 | Yes |
| 37895232 | Exploring Large MAF Transcription Factors: Functions, Pathology, and Mouse Model... | Genes (Basel) | 2023 | Yes |
| 37720527 | Pancreatic β-cell senescence in diabetes: mechanisms, markers and therapies. | Front Endocrinol (Lausanne) | 2023 | Yes |
| 37606041 | Species-specific roles for the MAFA and MAFB transcription factors in regulating... | JCI Insight | 2023 | Yes |

## Related Papers (MAFA/MAFB literature)

Core literature on MAF transcription factors

| PMID | Title | Journal | Year | Full Text |
|------|-------|---------|------|----------|
| 39476962 | Defining unique structural features in the MAFA and MAFB transcription factors t... | J Biol Chem | 2024 | Yes |
| 18515495 | MafA is a dedicated activator of the insulin gene in vivo. | J Endocrinol | 2008 | Abstract only |
| 12917329 | Members of the large Maf transcription family regulate insulin gene transcriptio... | Mol Cell Biol | 2003 | Abstract only |
| 20627934 | MafA and MafB regulate genes critical to beta-cells in a unique temporal manner. | Diabetes | 2010 | Yes |
| 16580660 | A switch from MafB to MafA expression accompanies differentiation to pancreatic ... | Dev Biol | 2006 | Abstract only |
| 24520122 | The MafA transcription factor becomes essential to islet β-cells soon after birt... | Diabetes | 2014 | Yes |
| 30425060 | Examining How the MAFB Transcription Factor Affects Islet β-Cell Function Postna... | Diabetes | 2019 | Yes |
| 26554594 | The MAFB transcription factor impacts islet α-cell function in rodents and repre... | Am J Physiol Endocrinol Metab | 2016 | Yes |
| 31208980 | MafB Is Important for Pancreatic β-Cell Maintenance under a MafA-Deficient Condi... | Mol Cell Biol | 2019 | Yes |
| 29339498 | MAFA missense mutation causes familial insulinomatosis and diabetes mellitus. | Proc Natl Acad Sci U S A | 2018 | Yes |

## Papers Without PMC Access

| PMID | Title | Journal | DOI |
|------|-------|---------|-----|
| 39821711 | Neuroendocrine Tumors: Germline Genetics and Hereditary Syndromes. | Curr Treat Options Oncol | 10.1007/s11864-024-01288-z |

## GraphRAG Pipeline Notes

### Recommended extraction targets:
- **Genes/Proteins**: MAFA, MAFB, insulin, PDX1, NEUROD1, NKX6.1
- **Mutations**: MAFA S64F, MAFB S70A
- **Cell types**: beta cells, alpha cells, islets of Langerhans
- **Processes**: cellular senescence, DNA damage, calcium signaling, circadian regulation
- **Diseases**: MODY (maturity-onset diabetes of the young), T2D, insulinomatosis
- **Model organisms**: mouse (C57BL/6J, C57/SJL), human islets
- **Relationships**: regulates, causes, associated_with, expressed_in, mutant_of

## Existing Diabetes Knowledge Graphs

Evaluate these as foundational graphs or supplementary data for the demo:

### Highest Relevance (directly applicable)

| Resource | Format | Coverage | URL |
|----------|--------|----------|-----|
| **T2D-Net** (Indiana University) | GraphML, Neo4j CQL | 16 drugs, 2228 protein targets, 289 compounds, GO/KEGG/OMIM | github.com/IUIDSL/t2d-net |
| **Diabetes KG** (Translational Biology Lab) | Neo4j + React + FastAPI | Integrates NCBI, UniProt, AlphaFold, OMIM, DisGeNET, KEGG, GO, PubMed, TTD, CTD for T2D | github.com/SanyamGarg12/Diabetes-Knowledge-Graph---The-Translational-Biology-Lab |
| **DisGeNET** | TSV, SQLite, RDF/SPARQL | Gene-disease associations; has MAFA, MAFB, PDX1 entries | disgenet.com (academic registration required) |
| **Open Targets** | JSON, Parquet, GraphQL | Target-disease evidence scores, genetics, expression, drugs | platform.opentargets.org/downloads |
| **KEGG Pathways** | KGML (XML) | hsa04930 (T2D), hsa04940 (T1D), hsa04950 (MODY) -- molecular pathway maps | kegg.jp |

### Moderate Relevance (useful supplementary layers)

| Resource | Format | Coverage | URL |
|----------|--------|----------|-----|
| **Monarch Initiative KG** | KGX (TSV/JSON), Neo4j | Gene-disease-phenotype with MONDO ontology (detailed MODY subtypes) | data.monarchinitiative.org/monarch-kg/ |
| **Hetionet** | JSON, Neo4j, TSV | 47K nodes, 2.25M edges; genes, diseases, compounds, pathways | github.com/hetio/hetionet |
| **STRING** | TSV, API | Protein-protein interactions; MAFA/MAFB/PDX1 network queryable | string-db.org |
| **Human Protein Atlas** | TSV | Protein expression in pancreas/islets for all TFs of interest | proteinatlas.org |
| **Gene Ontology** | OWL, OBO, GAF | Functional annotations; "cellular senescence" (GO:0090398), "insulin secretion" | geneontology.org |

### For Senescence Layer (no dedicated diabetes-senescence KG exists)

Build from:
- GO annotations for "cellular senescence" (GO:0090398)
- SenMayo gene set (published senescence marker panel)
- CellAge database: genomics.senescence.info/cells/ (curated senescence genes)
- Literature extracted from papers in this collection (PMIDs 41031371, 37949065, 37720527, 39239092)

### GraphRAG Implementations on Diabetes

| Resource | Notes | URL |
|----------|-------|-----|
| **DiabetesGraphRAG** | Neo4j + LangChain notebook; Wikipedia source only (shallow) | github.com/MayssenBHA/DiabetesGraphRAG |
| **T2D Digital Twins** (IlyaLab) | KG analysis + computational modeling | github.com/IlyaLab/t2d-dt-modeling |

### Recommendation

For a demo-quality foundational graph, **T2D-Net** is the fastest to get running (already has Neo4j CQL scripts).
For richer coverage, **Diabetes KG (Translational Biology Lab)** integrates more sources but requires building from scratch.
Your literature-based GraphRAG extraction will add the senescence/MAFA-specific layer that none of these existing graphs cover.
