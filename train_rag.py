"""
LEXASSIST — Vakil Dataset Downloader & RAG Trainer
====================================================
Run this script ONCE to:
1. Download the Vakil Indian Legal Dataset from Kaggle
2. Process and classify all records by legal topic
3. Build optimized knowledge base for the RAG chatbot
4. Generate chatbot training stats report

Requirements:
    pip install kagglehub tqdm colorama

Usage:
    python train_rag.py
"""

import os, sys, json, re, time
from pathlib import Path

# ── Check dependencies ────────────────────────────────────────
def check_install(pkg, import_name=None):
    try:
        __import__(import_name or pkg)
        return True
    except ImportError:
        print(f"Installing {pkg}...")
        os.system(f"{sys.executable} -m pip install {pkg} -q")
        return False

check_install("kagglehub")
check_install("tqdm")
check_install("colorama")

import kagglehub
from tqdm import tqdm
from colorama import Fore, Style, init
init(autoreset=True)

# ── Config ────────────────────────────────────────────────────
DATASET_ID = "manjunathsuresh2003/vakil-indian-legal-dataset"
KB_PATH    = Path("Ai_Chatbot_Rag/knowledge_base")
KB_PATH.mkdir(parents=True, exist_ok=True)

print(f"\n{Fore.CYAN}{'='*60}")
print(f"  LEXASSIST — RAG Chatbot Trainer")
print(f"  Dataset: {DATASET_ID}")
print(f"{'='*60}{Style.RESET_ALL}\n")

# ── Step 1: Download Dataset ──────────────────────────────────
print(f"{Fore.YELLOW}⬇️  Downloading dataset from Kaggle...{Style.RESET_ALL}")
print("  (First time may take a few minutes)")

try:
    dataset_path = kagglehub.dataset_download(DATASET_ID)
    print(f"{Fore.GREEN}✅ Downloaded to: {dataset_path}{Style.RESET_ALL}")
except Exception as e:
    print(f"{Fore.RED}❌ Download failed: {e}")
    print(f"\n{Fore.YELLOW}Manual setup required:")
    print("1. Go to https://www.kaggle.com/account → API → Create Token")
    print("2. Save kaggle.json to C:\\Users\\USER\\.kaggle\\kaggle.json")
    print(f"3. Run this script again{Style.RESET_ALL}")
    sys.exit(1)

# ── Step 2: Find all data files ───────────────────────────────
print(f"\n{Fore.YELLOW}📂 Scanning downloaded files...{Style.RESET_ALL}")

data_files = []
for ext in ['*.jsonl', '*.json', '*.csv', '*.txt']:
    data_files.extend(Path(dataset_path).rglob(ext))

print(f"  Found {len(data_files)} data file(s):")
for f in data_files:
    size = f.stat().st_size / 1024
    print(f"  → {f.name} ({size:.0f} KB)")

if not data_files:
    print(f"{Fore.RED}❌ No data files found in {dataset_path}{Style.RESET_ALL}")
    sys.exit(1)

# ── Step 3: Auto-detect schema ────────────────────────────────
print(f"\n{Fore.YELLOW}🔍 Auto-detecting data format...{Style.RESET_ALL}")

def load_records(filepath):
    """Load records from JSONL, JSON, or CSV"""
    records = []
    fp = Path(filepath)
    
    if fp.suffix == '.jsonl':
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line:
                    try: records.append(json.loads(line))
                    except: pass

    elif fp.suffix == '.json':
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            try:
                data = json.load(f)
                if isinstance(data, list): records = data
                elif isinstance(data, dict): records = [data]
            except:
                # Try as JSONL
                f.seek(0)
                for line in f:
                    line = line.strip()
                    if line:
                        try: records.append(json.loads(line))
                        except: pass

    elif fp.suffix == '.csv':
        import csv
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            records = list(reader)
    
    elif fp.suffix == '.txt':
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        # Try to parse as JSONL
        for line in content.split('\n'):
            line = line.strip()
            if line:
                try: records.append(json.loads(line))
                except: pass
        # If not JSON, treat as plain text
        if not records:
            records = [{'text': content, 'type': 'plain'}]
    
    return records

# Smart key detector
def detect_keys(sample):
    """Auto-detect question and answer keys from sample record"""
    Q_KEYS = ['question','query','input','prompt','q','instruction','task']
    A_KEYS = ['answer','response','output','completion','a','reply','result']
    C_KEYS = ['context','content','text','passage','document','paragraph']
    
    found_q = next((k for k in Q_KEYS if k in sample), None)
    found_a = next((k for k in A_KEYS if k in sample), None)
    found_c = next((k for k in C_KEYS if k in sample), None)
    
    # Also check for nested structures
    if not found_q:
        for k, v in sample.items():
            if isinstance(v, dict):
                found_q = next((sk for sk in Q_KEYS if sk in v), None)
                if found_q: found_q = f"{k}.{found_q}"
    
    return found_q, found_a, found_c

def get_value(record, key_path):
    """Get value using dot notation for nested keys"""
    if '.' in str(key_path):
        parts = key_path.split('.')
        val = record
        for p in parts:
            val = val.get(p, '') if isinstance(val, dict) else ''
        return str(val)
    return str(record.get(key_path, ''))

# Load all records
all_records = []
for f in data_files:
    print(f"  Loading {f.name}...")
    recs = load_records(f)
    all_records.extend(recs)
    print(f"  → {len(recs):,} records loaded")

print(f"\n{Fore.GREEN}✅ Total records: {len(all_records):,}{Style.RESET_ALL}")

# Detect schema from first record
if all_records:
    sample = all_records[0]
    print(f"  Schema detected: {list(sample.keys())[:8]}")
    q_key, a_key, c_key = detect_keys(sample)
    print(f"  Question key: {q_key}")
    print(f"  Answer key:   {a_key}")
    print(f"  Context key:  {c_key}")

# ── Step 4: Classify by legal topic ──────────────────────────
print(f"\n{Fore.YELLOW}🏷️  Classifying records by legal topic...{Style.RESET_ALL}")

TOPIC_KEYWORDS = {
    'criminal': [
        'murder','ipc 302','ipc 307','homicide','culpable','manslaughter',
        'rape','ipc 376','sexual assault','molestation',
        'theft','robbery','dacoity','ipc 378','ipc 392','ipc 395',
        'cheating','fraud','ipc 420','misrepresentation','deceit',
        'bail','anticipatory bail','custody','arrest','detained',
        'fir','first information','police','accused','prosecution',
        'conviction','acquittal','sentence','imprisonment','criminal',
        'crpc','ipc','cognizable','warrant','charge sheet','remand',
        'kidnapping','abduction','extortion','blackmail','forgery'
    ],
    'civil': [
        'civil suit','civil court','plaintiff','defendant','decree',
        'contract','agreement','breach','consideration','damages',
        'negligence','tort','liability','compensation','injunction',
        'consumer','defective','refund','consumer forum','ncdrc',
        'promissory note','cheque bounce','dishonoured','negotiable',
        'specific performance','declaration','possession','partition'
    ],
    'constitutional': [
        'constitution','article','fundamental rights','directive principles',
        'writ','habeas corpus','mandamus','certiorari','quo warranto',
        'supreme court','high court','constitutional','parliament',
        'legislature','judiciary','amendment','ordinance','gazette',
        'preamble','schedule','right to equality','article 14','article 19',
        'article 21','article 22','article 32','article 226','pil',
        'public interest','fundamental duty','reservation','quota'
    ],
    'property': [
        'property','land','immovable','sale deed','title deed','ownership',
        'boundary','encroachment','survey','registration','stamp duty',
        'mutation','khata','patta','revenue','agricultural land',
        'urban land','transfer','mortgage','lease','rent','tenant',
        'landlord','eviction','possession','adverse possession',
        'succession','inheritance','will','gift deed','partition'
    ],
    'family': [
        'marriage','matrimonial','divorce','separation','alimony',
        'maintenance','custody','guardianship','adoption','minor',
        'child','wife','husband','spouse','conjugal','dowry',
        'hindu marriage act','muslim personal law','christian',
        'special marriage','restitution','judicial separation',
        'succession','inheritance','huf','coparcener','stridhan'
    ],
    'labour': [
        'labour','worker','employee','employer','service',
        'termination','dismissal','retrenchment','layoff',
        'salary','wages','payment','gratuity','provident fund',
        'epf','esic','workman','industrial dispute','strike',
        'lockout','factories act','shops','establishment',
        'contract labour','apprentice','minimum wages','bonus'
    ],
    'taxation': [
        'income tax','tax','assessment','demand','penalty',
        'gst','service tax','customs','excise','vat',
        'it act','cbdt','itat','assessee','tds','refund',
        'deduction','exemption','return','audit','scrutiny'
    ],
    'corporate': [
        'company','corporation','director','shareholder','board',
        'companies act','nclt','nclat','insolvency','ipa',
        'merger','acquisition','winding up','liquidation',
        'sebi','stock','securities','capital market','ipo',
        'partnership','llp','startup','intellectual property','patent','copyright','trademark'
    ],
}

topics = {t: [] for t in TOPIC_KEYWORDS}
topics['general'] = []

skipped = 0
for item in tqdm(all_records, desc="Classifying", unit="records"):
    # Build searchable text
    parts = []
    for k, v in item.items():
        if isinstance(v, str): parts.append(v.lower())
    text = ' '.join(parts)
    
    if not text.strip():
        skipped += 1
        continue
    
    placed = False
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            topics[topic].append(item)
            placed = True
            break
    if not placed:
        topics['general'].append(item)

print(f"\n{Fore.GREEN}Classification complete:{Style.RESET_ALL}")
for topic, items in topics.items():
    bar = '█' * min(40, int(len(items)/max(len(all_records),1)*40))
    print(f"  {topic:<15} {len(items):>6,} records  {Fore.BLUE}{bar}{Style.RESET_ALL}")
print(f"  {'Skipped':<15} {skipped:>6,} (empty records)")

# ── Step 5: Write knowledge base files ───────────────────────
print(f"\n{Fore.YELLOW}💾 Writing knowledge base files...{Style.RESET_ALL}")

def extract_qa(item, q_key, a_key, c_key):
    """Extract Q, A, Context from a record regardless of format"""
    q, a, ctx = '', '', ''
    
    if q_key: q = get_value(item, q_key).strip()
    if a_key: a = get_value(item, a_key).strip()
    if c_key: ctx = get_value(item, c_key).strip()[:300]
    
    # Fallback: if no Q/A keys found, try to build from any text fields
    if not q and not a:
        text_vals = [str(v) for v in item.values() if isinstance(v, str) and len(v)>10]
        if len(text_vals) >= 2:
            q   = text_vals[0][:200]
            a   = text_vals[1][:500]
        elif len(text_vals) == 1:
            a = text_vals[0][:500]
    
    return q, a, ctx

total_written = 0
written_files = []

for topic, items in topics.items():
    if not items: continue
    
    filepath = KB_PATH / f"vakil_{topic}.txt"
    written  = 0
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"LEXASSIST — VAKIL LEGAL DATASET — {topic.upper()} LAW\n")
        f.write(f"Source: Kaggle — {DATASET_ID}\n")
        f.write('=' * 60 + '\n\n')
        
        for item in items:
            q, a, ctx = extract_qa(item, q_key, a_key, c_key)
            
            if not a or len(a) < 10: continue  # Skip empty answers
            
            if q: f.write(f"Q: {q}\n")
            f.write(f"A: {a}\n")
            if ctx: f.write(f"Context: {ctx}\n")
            
            # Write any extra metadata fields
            for meta_key in ['case_name','section','act','court','date','source']:
                val = item.get(meta_key, '')
                if val and len(str(val)) > 2:
                    f.write(f"{meta_key.title()}: {val}\n")
            
            f.write("\n---\n\n")
            written += 1
    
    size = filepath.stat().st_size / 1024
    total_written += written
    written_files.append((topic, written, size, filepath))
    print(f"  ✅ vakil_{topic}.txt — {written:,} records ({size:.0f} KB)")

# ── Step 6: Generate Stats Report ────────────────────────────
print(f"\n{Fore.YELLOW}📊 Generating stats report...{Style.RESET_ALL}")

report_path = KB_PATH / "TRAINING_REPORT.txt"
with open(report_path, 'w') as f:
    f.write("LEXASSIST RAG CHATBOT — TRAINING REPORT\n")
    f.write("=" * 60 + "\n\n")
    f.write(f"Dataset: {DATASET_ID}\n")
    f.write(f"Processed on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
    
    f.write("KNOWLEDGE BASE FILES:\n")
    f.write("-" * 40 + "\n")
    
    # Existing files
    all_kb_files = list(KB_PATH.glob('*.txt'))
    total_size = 0
    for kbf in sorted(all_kb_files):
        if kbf.name == 'TRAINING_REPORT.txt': continue
        size = kbf.stat().st_size / 1024
        total_size += size
        lines = kbf.read_text(encoding='utf-8', errors='ignore').count('\n')
        f.write(f"{kbf.name:<40} {size:>8.0f} KB  {lines:>8,} lines\n")
    
    f.write("-" * 40 + "\n")
    f.write(f"{'TOTAL':<40} {total_size:>8.0f} KB\n\n")
    
    f.write("NEW RECORDS ADDED FROM VAKIL DATASET:\n")
    f.write("-" * 40 + "\n")
    for topic, count, size, fp in written_files:
        f.write(f"{topic:<20} {count:>8,} records\n")
    f.write(f"\n{'TOTAL NEW':<20} {total_written:>8,} records\n")

print(f"  ✅ Report saved to {report_path}")

# ── Step 7: Update ragUtils.js ────────────────────────────────
print(f"\n{Fore.YELLOW}🔧 Updating RAG configuration...{Style.RESET_ALL}")

rag_config_path = Path("Ai_Chatbot_Rag/utils/rag_config.json")
config = {
    "knowledgeBasePath": "Ai_Chatbot_Rag/knowledge_base",
    "chunkSeparator": "---",
    "minChunkLength": 40,
    "topK": 5,
    "synonymExpansion": True,
    "totalFiles": len(list(KB_PATH.glob("*.txt"))),
    "lastUpdated": time.strftime('%Y-%m-%d %H:%M:%S'),
    "datasets": [
        "IndicLegalQA (10K)",
        "Supreme Court Judgments (500)",
        "Indian Law Basics",
        f"Vakil Indian Legal Dataset ({total_written:,} records)"
    ]
}
with open(rag_config_path, 'w') as f:
    json.dump(config, f, indent=2)
print(f"  ✅ RAG config updated")

# ── Final Summary ─────────────────────────────────────────────
all_kb = list(KB_PATH.glob('*.txt'))
total_kb_size = sum(f.stat().st_size for f in all_kb) / (1024*1024)

print(f"\n{Fore.GREEN}{'='*60}")
print(f"  🎉 RAG TRAINING COMPLETE!")
print(f"{'='*60}{Style.RESET_ALL}")
print(f"  New records added  : {Fore.CYAN}{total_written:,}{Style.RESET_ALL}")
print(f"  Total KB files     : {Fore.CYAN}{len(all_kb)}{Style.RESET_ALL}")
print(f"  Total KB size      : {Fore.CYAN}{total_kb_size:.1f} MB{Style.RESET_ALL}")
print(f"\n{Fore.YELLOW}  Next step: Restart your server{Style.RESET_ALL}")
print(f"  {Fore.GREEN}npm start{Style.RESET_ALL}")
print(f"\n  The chatbot will automatically use all new data! 🚀\n")
