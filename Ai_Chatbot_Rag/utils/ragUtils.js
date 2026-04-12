/**
 * LEXASSIST — Hybrid RAG Engine
 * Combines: Exact match + Keyword TF-IDF + Semantic cosine similarity
 * Works 100% without any paid API or external service
 */

const fs   = require('fs');
const path = require('path');

const KB_PATH   = path.join(__dirname, '../knowledge_base');
let   KB_CACHE  = null;
let   TF_CACHE  = null;
let   LOAD_TIME = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Stopwords (ignore in scoring) ────────────────────────────
const STOPWORDS = new Set(['the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may','might',
  'shall','can','need','dare','ought','used','to','of','in','on','at','by','for',
  'with','about','against','between','into','through','during','before','after',
  'above','below','from','up','down','out','off','over','under','again','then',
  'once','that','this','these','those','i','you','he','she','it','we','they',
  'what','which','who','whom','when','where','why','how','all','both','each',
  'few','more','most','other','some','such','no','nor','not','only','own','same',
  'so','than','too','very','just','but','if','or','and','as']);

// ── Load and chunk knowledge base ─────────────────────────────
const loadKB = () => {
  const now = Date.now();
  if (KB_CACHE && LOAD_TIME && (now - LOAD_TIME) < CACHE_TTL) return KB_CACHE;

  const docs = [];
  if (!fs.existsSync(KB_PATH)) { console.warn('❌ KB not found:', KB_PATH); return docs; }

  const files = fs.readdirSync(KB_PATH)
    .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
    .sort();

  let totalChunks = 0;
  files.forEach(file => {
    const content = fs.readFileSync(path.join(KB_PATH, file), 'utf-8');
    const chunks  = content.split('---').map(c => c.trim()).filter(c => c.length > 30);
    chunks.forEach(chunk => {
      docs.push({
        id:      `${file}:${totalChunks}`,
        source:  file,
        content: chunk,
        words:   tokenize(chunk),
      });
      totalChunks++;
    });
  });

  KB_CACHE  = docs;
  TF_CACHE  = null; // Reset TF-IDF cache when KB reloads
  LOAD_TIME = now;

  const totalMB = files.reduce((s,f) => s + fs.statSync(path.join(KB_PATH,f)).size, 0) / 1024 / 1024;
  console.log(`✅ RAG KB: ${docs.length.toLocaleString()} chunks | ${files.length} files | ${totalMB.toFixed(1)}MB`);
  return docs;
};

// ── Tokenize text ─────────────────────────────────────────────
const tokenize = (text) =>
  text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));

// ── Build TF-IDF index ────────────────────────────────────────
const buildTFIDF = (docs) => {
  if (TF_CACHE) return TF_CACHE;

  const N      = docs.length;
  const idf    = {};
  const docFreq= {};

  // Count document frequency for each term
  docs.forEach(doc => {
    const uniqueWords = new Set(doc.words);
    uniqueWords.forEach(w => { docFreq[w] = (docFreq[w] || 0) + 1; });
  });

  // Compute IDF = log(N / df)
  Object.keys(docFreq).forEach(w => {
    idf[w] = Math.log((N + 1) / (docFreq[w] + 1)) + 1; // Smoothed IDF
  });

  // Compute TF-IDF vectors for each doc
  const vectors = docs.map(doc => {
    const tf  = {};
    const len = doc.words.length || 1;
    doc.words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
    const vec = {};
    Object.keys(tf).forEach(w => {
      vec[w] = (tf[w] / len) * (idf[w] || 1);
    });
    return vec;
  });

  TF_CACHE = { idf, vectors };
  return TF_CACHE;
};

// ── Cosine similarity between two TF-IDF vectors ──────────────
const cosineSim = (vecA, vecB) => {
  let dot = 0, normA = 0, normB = 0;
  Object.keys(vecA).forEach(w => {
    dot   += (vecA[w] || 0) * (vecB[w] || 0);
    normA += vecA[w] ** 2;
  });
  Object.keys(vecB).forEach(w => { normB += vecB[w] ** 2; });
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
};

// ── Legal synonym dictionary ──────────────────────────────────
const SYNONYMS = {
  arrest:       ['custody','detain','police','bail'],
  bail:         ['release','surety','bailable','custody','anticipatory'],
  fir:          ['complaint','cognizable','report','police','first information'],
  divorce:      ['matrimonial','separation','alimony','maintenance','marriage'],
  property:     ['land','title','deed','ownership','boundary','registration','immovable'],
  consumer:     ['defective','refund','product','complaint','forum','ncdrc'],
  labour:       ['employee','employer','salary','termination','gratuity','worker','workman'],
  rights:       ['fundamental','constitution','article','liberty','equality'],
  murder:       ['homicide','ipc 302','death','culpable','killed'],
  rape:         ['sexual assault','ipc 376','victim','molestation'],
  cheating:     ['fraud','ipc 420','deceit','scam','cheat'],
  contract:     ['agreement','breach','damages','consideration','offer'],
  appeal:       ['revision','petition','challenge','high court','supreme court'],
  punishment:   ['sentence','penalty','imprisonment','conviction','fine'],
  court:        ['tribunal','magistrate','judge','hearing','bench','sessions'],
  tax:          ['income tax','gst','assessment','deduction','tds','it act'],
  company:      ['corporation','director','shareholder','sebi','nclt','incorporation'],
  dowry:        ['498a','cruelty','husband','wife','matrimonial'],
  stalking:     ['354d','follow','harass','monitor','contact'],
  harassment:   ['354a','sexual','workplace','posh','unwelcome'],
  domestic:     ['violence','498a','dowry','wife','husband','dvact','family'],
  accident:     ['motor','vehicle','mva','mact','compensation','hit','run'],
  theft:        ['ipc 378','ipc 379','stolen','robbery','dacoity'],
};

// ── Detect query type for domain-specific boosting ────────────
const detectQueryType = (query) => {
  const q = query.toLowerCase();
  return {
    isIPC:     /\bipc\b|\bindian penal\b/.test(q),
    isCrPC:    /\bcrpc\b|\bcriminal procedure\b/.test(q),
    isTax:     /\btax\b|\bgst\b|\bit act\b/.test(q),
    isCriminal:/\bmurder|rape|theft|robbery|bail|fir|arrest|accused\b/.test(q),
    isCivil:   /\bconsumer|contract|damages|civil suit\b/.test(q),
    isFamily:  /\bdivorce|custody|maintenance|alimony|marriage\b/.test(q),
    isLabour:  /\blabour|employee|salary|termination|gratuity\b/.test(q),
    isProperty:/\bproperty|land|sale deed|ownership|registration\b/.test(q),
    sectionNum:query.match(/(?:section|sec|s\.?\s*)(\d+[a-zA-Z]?)/i)?.[1],
  };
};

// ── MAIN HYBRID SEARCH ────────────────────────────────────────
const hybridSearch = (query, topK = 5) => {
  const docs  = loadKB();
  if (!docs.length) return [];

  const queryType  = detectQueryType(query);
  const queryWords = tokenize(query);

  // Synonym expansion
  const expanded = [...queryWords];
  queryWords.forEach(w => { if (SYNONYMS[w]) expanded.push(...tokenize(SYNONYMS[w].join(' '))); });
  const expandedSet = [...new Set(expanded)];

  // Build TF-IDF
  const { idf, vectors } = buildTFIDF(docs);

  // Build query vector
  const qVec = {};
  expandedSet.forEach(w => {
    qVec[w] = (qVec[w] || 0) + (idf[w] || 0.5);
  });

  const scored = docs.map((doc, idx) => {
    // ── 1. TF-IDF cosine similarity ───────────────────────────
    const tfidfScore = cosineSim(qVec, vectors[idx]) * 100;

    // ── 2. Exact keyword frequency ────────────────────────────
    const text  = doc.content.toLowerCase();
    let kwScore = 0;
    expandedSet.forEach(w => {
      const count = (text.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length;
      kwScore += count * 2;
    });

    // ── 3. Question line boost (Q: line match) ────────────────
    let qBoost = 0;
    if (text.includes('q: ')) {
      const qLine = text.split('q: ')[1]?.split('\n')[0] || '';
      expandedSet.forEach(w => { if (qLine.includes(w)) qBoost += 10; });
    }

    // ── 4. Exact IPC section match ────────────────────────────
    let sectionBoost = 0;
    if (queryType.sectionNum) {
      const sectionRx = new RegExp(`section\\s*${queryType.sectionNum}\\b`, 'i');
      if (sectionRx.test(doc.content)) sectionBoost += 50;
      // Also match "ipc X" or "crpc X"
      const codeRx = new RegExp(`\\b(ipc|crpc)\\s*${queryType.sectionNum}\\b`, 'i');
      if (codeRx.test(doc.content)) sectionBoost += 30;
    }

    // ── 5. Domain-specific boosting ───────────────────────────
    let domainBoost = 0;
    if (queryType.isIPC    && doc.source.includes('ipc'))           domainBoost += 20;
    if (queryType.isCrPC   && doc.source.includes('crpc'))          domainBoost += 20;
    if (queryType.isCriminal && (doc.source.includes('criminal') || doc.source.includes('bail') || doc.source.includes('arrest'))) domainBoost += 15;
    if (queryType.isFamily  && doc.source.includes('family'))       domainBoost += 15;
    if (queryType.isLabour  && doc.source.includes('labour'))       domainBoost += 15;
    if (queryType.isProperty&& doc.source.includes('property'))     domainBoost += 15;
    if (queryType.isCivil   && doc.source.includes('civil'))        domainBoost += 15;

    // ── 6. Penalize wrong domain ───────────────────────────────
    let penalty = 0;
    if (queryType.isIPC && !queryType.isTax && doc.source.includes('tax')) penalty = 100;
    if (queryType.isCriminal && doc.source.includes('corporate'))           penalty = 30;

    const finalScore = tfidfScore + kwScore + qBoost + sectionBoost + domainBoost - penalty;

    return { ...doc, score: finalScore, tfidfScore, kwScore, qBoost, sectionBoost, domainBoost };
  });

  return scored
    .filter(d => d.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

// ── Build context from search results ────────────────────────
const buildContext = (query, topK = 5) => {
  const results = hybridSearch(query, topK);
  if (!results.length) return { context: '', sources: [], answers: [] };

  const context = results
    .map((d, i) => `[Result ${i+1} | Source: ${d.source} | Score: ${d.score.toFixed(1)}]\n${d.content.slice(0, 600)}`)
    .join('\n\n---\n\n');

  const sources = [...new Set(results.map(d =>
    d.source.replace('.txt','')
      .replace(/^ipc_|^crpc_|^qa_|^vakil_|^legal_/, '')
      .replace(/_/g,' ')
  ))];

  // Extract direct answers from Q&A chunks
  const answers = results.map(d => {
    const aMatch = d.content.match(/A:\s*([\s\S]+?)(?=\n[A-Z]|\n---|\n\nQ:|$)/);
    const qMatch = d.content.match(/Q:\s*(.+?)(?=\n)/);
    if (!aMatch?.length) return null;
    return {
      question: qMatch?.[1]?.trim() || '',
      answer:   aMatch[1]?.trim()?.slice(0, 600) || '',
      source:   d.source,
      score:    d.score,
    };
  }).filter(a => a && a.answer && a.answer.length > 15);

  return { context, sources, answers };
};

// ── System prompt for LLM ─────────────────────────────────────
const buildSystemPrompt = (context, queryType) => `You are LEXI — the AI legal assistant for LEXASSIST, India's legal help platform.

You are trained on ${queryType?.isIPC ? 'the complete Indian Penal Code, ' : ''}${queryType?.isCrPC ? 'the Code of Criminal Procedure, ' : ''}thousands of Indian court cases, and Supreme Court judgments.

CRITICAL RULES:
1. Use SIMPLE everyday language — explain as if talking to someone who never studied law
2. If you MUST use a legal term, IMMEDIATELY explain it in simple words in brackets
3. Use bullet points (•) for steps and lists — never write dense paragraphs
4. ALWAYS end with: what the person should DO NEXT
5. Include free help resources (NALSA: 15100) when the person seems stressed
6. Be warm, empathetic — people come to you when scared and confused
7. If you are unsure, say so honestly — never make up legal information

RELEVANT INFORMATION FROM INDIAN LEGAL DATABASE:
${context || 'No specific matching cases found. Answering from general Indian law knowledge.'}

Remember: Your mission is to make justice accessible to EVERY Indian citizen.`;

// ── Get KB statistics ─────────────────────────────────────────
const getStats = () => {
  if (!fs.existsSync(KB_PATH)) return { files:0, chunks:0, sizeMB:'0' };
  const files = fs.readdirSync(KB_PATH).filter(f => f.endsWith('.txt'));
  const totalSize = files.reduce((s,f) => s + fs.statSync(path.join(KB_PATH,f)).size, 0);
  const docs  = loadKB();
  return {
    files:   files.length,
    chunks:  docs.length,
    sizeMB:  (totalSize/1024/1024).toFixed(1),
    topics:  files.map(f => f.replace('.txt','').replace(/^ipc_|^crpc_|^qa_|^vakil_|^legal_/,'').replace(/_/g,' ')),
    lastLoad: LOAD_TIME ? new Date(LOAD_TIME).toLocaleString('en-IN') : 'Not loaded yet',
  };
};

module.exports = { loadKB, hybridSearch, buildContext, buildSystemPrompt, getStats, tokenize };
