export const PAPER_URLS: Record<string, string> = {
  "Sex-biased islet β cell dysfunction is caused by the MODY MAFA S64F variant by inducing premature aging and senescence in males.": "https://pubmed.ncbi.nlm.nih.gov/34644565/",
  "Defining unique structural features in the MAFA and MAFB transcription factors that control Insulin gene activity.": "https://pubmed.ncbi.nlm.nih.gov/39476962/",
  "Genetic background influences the phenotypic penetrance by MAFA (S64F) MODY in male mice.": "https://pubmed.ncbi.nlm.nih.gov/40475642/",
  "Developmental control of DNA damage responses in α- and β-cells shapes the selective beta-cell susceptibility in diabetes.": "https://pubmed.ncbi.nlm.nih.gov/41292712/",
  "Nucleolar stress facilitates islet β cell senescence via hijacking the DNA damage response pathways.": "https://pubmed.ncbi.nlm.nih.gov/41031371/",
  "The role of the beta cell in type 2 diabetes: new findings from the last 5 years.": "https://pubmed.ncbi.nlm.nih.gov/40768044/",
  "Sex-specific regulatory architecture of pancreatic islets from subjects with and without type 2 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/39567827/",
  "Calorie restriction increases insulin sensitivity to promote beta cell homeostasis and longevity in mice.": "https://pubmed.ncbi.nlm.nih.gov/39433757/",
  "Safeguarding genomic integrity in beta-cells: implications for beta-cell differentiation, growth, and dysfunction.": "https://pubmed.ncbi.nlm.nih.gov/39364746/",
  "Exploring senescence as a modifier of β cell extracellular vesicles in type 1 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/39239092/",
  "Single cell regulatory architecture of human pancreatic islets suggests sex differences in β cell function and the pathogenesis of type 2 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/39011095/",
  "SenNet recommendations for detecting senescent cells in different tissues.": "https://pubmed.ncbi.nlm.nih.gov/38831121/",
  "Stress-induced β cell early senescence confers protection against type 1 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/37949065/",
  "Exploring Large MAF Transcription Factors: Functions, Pathology, and Mouse Models with Point Mutations.": "https://pubmed.ncbi.nlm.nih.gov/37895232/",
  "Pancreatic β-cell senescence in diabetes: mechanisms, markers and therapies.": "https://pubmed.ncbi.nlm.nih.gov/37720527/",
  "Species-specific roles for the MAFA and MAFB transcription factors in regulating islet β cell identity.": "https://pubmed.ncbi.nlm.nih.gov/37606041/",
  "MafA is a dedicated activator of the insulin gene in vivo.": "https://pubmed.ncbi.nlm.nih.gov/18515495/",
  "Members of the large Maf transcription family regulate insulin gene transcription in islet beta cells.": "https://pubmed.ncbi.nlm.nih.gov/12917329/",
  "MafA and MafB regulate genes critical to beta-cells in a unique temporal manner.": "https://pubmed.ncbi.nlm.nih.gov/20627934/",
  "A switch from MafB to MafA expression accompanies differentiation to pancreatic beta-cells.": "https://pubmed.ncbi.nlm.nih.gov/16580660/",
  "The MafA transcription factor becomes essential to islet β-cells soon after birth.": "https://pubmed.ncbi.nlm.nih.gov/24520122/",
  "Examining How the MAFB Transcription Factor Affects Islet β-Cell Function Postnatally.": "https://pubmed.ncbi.nlm.nih.gov/30425060/",
  "The MAFB transcription factor impacts islet α-cell function in rodents and represents a unique signature of primate islet β-cells.": "https://pubmed.ncbi.nlm.nih.gov/26554594/",
  "MafB Is Important for Pancreatic β-Cell Maintenance under a MafA-Deficient Condition.": "https://pubmed.ncbi.nlm.nih.gov/31208980/",
  "MAFA missense mutation causes familial insulinomatosis and diabetes mellitus.": "https://pubmed.ncbi.nlm.nih.gov/29339498/",
}

export function findPaperUrl(title: string): string | null {
  if (PAPER_URLS[title]) return PAPER_URLS[title]
  const lower = title.toLowerCase()
  for (const [key, url] of Object.entries(PAPER_URLS)) {
    if (key.toLowerCase().startsWith(lower.substring(0, 40))) return url
  }
  return null
}
