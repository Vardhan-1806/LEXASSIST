/**
 * LEXASSIST — Chatbot Controller (COMPLETE FINAL VERSION)
 * Hybrid RAG: TF-IDF + Cosine Similarity + Exact Match
 * Works WITHOUT OpenAI | Upgrades with OpenAI key
 */

const { ChatHistory } = require('../models/Extras');
const { v4: uuidv4  } = require('uuid');
const fs   = require('fs');
const path = require('path');
const { buildContext, buildSystemPrompt, getStats, hybridSearch } = require('../../Ai_Chatbot_Rag/utils/ragUtils');

// ── Detect IPC/CrPC section queries ──────────────────────────
const detectSection = (query) => {
  const match = query.match(/(?:section|sec|s\.?\s*)(\d+[a-zA-Z]?)\s*(?:ipc|crpc|of\s+ipc|of\s+crpc)?/i);
  const isIPC  = /\bipc\b|\bindian penal\b/i.test(query);
  const isCrPC = /\bcrpc\b|\bcriminal procedure\b/i.test(query);
  return { sectionNum: match?.[1], isIPC, isCrPC };
};

// ── Check if text is legal document ──────────────────────────
const LEGAL_KEYWORDS = [
  'court','judge','petition','affidavit','bail','fir','ipc','crpc','act','section',
  'plaintiff','defendant','petitioner','respondent','verdict','judgment','order',
  'decree','appeal','hearing','counsel','advocate','legal','justice','tribunal',
  'commission','arbitration','clause','agreement','contract','deed','notice',
  'complaint','application','writ','injunction','evidence','witness','magistrate',
  'sessions','article','constitution','amendment','statute','regulation','gazette',
  'cognizable','bailable','accused','prosecution','conviction','acquittal','bail'
];
const isLegalDoc = (text) => {
  const lower = text.toLowerCase();
  const found = LEGAL_KEYWORDS.filter(kw => lower.includes(kw));
  return { isLegal: found.length >= 3, score: found.length, keywords: found.slice(0,5) };
};

// ── Simplify legal jargon ─────────────────────────────────────
const simplify = (text) => {
  const replacements = [
    [/cognizable offence/gi,  'serious crime (police can arrest without warrant)'],
    [/non-cognizable/gi,      'minor crime (police need court permission to arrest)'],
    [/ex-parte/gi,            'decided without hearing the other side'],
    [/suo motu/gi,            'court acting on its own'],
    [/prima facie/gi,         'at first look'],
    [/inter alia/gi,          'among other things'],
    [/bona fide/gi,           'genuine / honest'],
    [/mens rea/gi,            'criminal intention'],
    [/actus reus/gi,          'the actual criminal act'],
    [/sub judice/gi,          'currently being decided by court'],
    [/locus standi/gi,        'right to file the case'],
    [/quash/gi,               'cancel or set aside'],
    [/promulgated/gi,         'officially announced'],
    [/contravention/gi,       'violation'],
    [/abetment/gi,            'helping or encouraging a crime'],
  ];
  let result = text;
  replacements.forEach(([from, to]) => { result = result.replace(from, `${to.split('(')[0].trim()} (${to.includes('(')?to.split('(')[1].replace(')',''):'see explanation'})`); });
  return result;
};

// ── Rich fallback responses ───────────────────────────────────
const RESPONSES = {
  bail: `**What is Bail? (Simple Explanation)**

Bail means the court allows you to stay **at home** (instead of jail) while your case is going on. You promise to come to court whenever called.

**Types of Bail:**
• 🟢 **Bailable offence bail** — Police MUST give you bail. It's your right. (Minor crimes like simple assault)
• 🔴 **Non-bailable offence bail** — Only the COURT can grant bail. Judge decides. (Serious crimes like murder, robbery)
• ⭐ **Anticipatory Bail** — Apply BEFORE arrest if you fear being arrested (Section 438 CrPC)

**How to get bail (steps):**
1. Your lawyer files a **bail application** in the Magistrate/Sessions court
2. You need a **surety** — a person who promises you'll appear in court
3. Judge considers: How serious is the crime? Will you run away? Risk of tampering evidence?
4. If bail is granted, pay bail bond amount

**What you need:**
ID proof, address proof, surety's details, copy of FIR

📞 **Free legal help for bail:** NALSA helpline **15100** (free)
📞 **If arrested:** You MUST be produced before Magistrate within **24 hours**`,

  fir: `**What is an FIR? (Simple Explanation)**

FIR stands for **First Information Report**. It is the FIRST written complaint you give to police when a crime happens.

**Step-by-step guide to file FIR:**
1. Go to the **nearest police station** (any station — this is called Zero FIR)
2. Meet the officer on duty or Station House Officer (SHO)
3. Tell them exactly what happened — when, where, who did it, how
4. Police will write it down and you should **read it carefully** before signing
5. Get a **FREE copy** of FIR — police CANNOT charge for this
6. Note the FIR number for future reference

**If police REFUSE to file FIR:**
• Send written complaint to **Superintendent of Police (SP)** by registered post
• Or approach the **Magistrate** under Section 156(3) CrPC
• Or call **100 or 112** (Police helpline)

**Zero FIR:** You can file at ANY police station in India regardless of where crime happened. Police must transfer it to correct station within 24 hours.

📞 Emergency: **112** | Women: **181** | Free Legal Aid: **15100**`,

  ipc420: `**Section 420 IPC — Cheating (Simple Explanation)**

Section 420 of the Indian Penal Code deals with **cheating and dishonestly inducing delivery of property**.

**What it means in simple words:**
Someone tricks/deceives you to take your money or property dishonestly.

**Common examples:**
• Someone sells you a **fake product** claiming it's original (fake gold, medicines)
• A person takes money **promising a job** but never delivers it
• **Online fraud** — someone takes money and disappears
• **Property fraud** — selling the same property to multiple buyers
• **Fake investment schemes** promising high returns

**Punishment:**
• Imprisonment up to **7 years**
• Fine — decided by court
• It is a **non-bailable, cognizable offence** (police can arrest without warrant)

**What you should do if cheated:**
1. **File an FIR** at nearest police station immediately
2. **Collect all evidence** — messages, receipts, emails, screenshots
3. Note accused person's name, address, phone number
4. Consult a **criminal lawyer** immediately
5. For online fraud — also report at **cybercrime.gov.in** or call **1930**

📞 Cyber Crime Helpline: **1930** | Police: **112** | Free Legal Aid: **15100**`,

  divorce: `**Divorce in India — Complete Guide**

**Type 1 — Mutual Consent Divorce (Both agree — Faster)**
• Both husband and wife agree to separate
• Must have lived separately for at least **1 year**
• File joint petition in **Family Court** of your city
• First motion hearing → **6 months cooling period** (court may waive it)
• Second motion → Divorce granted
• Total time: **6 months to 1.5 years**

**Type 2 — Contested Divorce (One doesn't agree — Slower)**
• Valid grounds: Cruelty, Desertion (2+ years), Adultery, Conversion, Mental illness
• File petition → notices sent → response → evidence → hearing → judgment
• Total time: **2 to 5 years**

**Different laws for different religions:**
• Hindu, Sikh, Buddhist, Jain → Hindu Marriage Act 1955
• Muslim → Muslim Personal Law (Shariat) / Muslim Women Protection Act
• Christian → Indian Divorce Act 1869
• Parsi → Parsi Marriage and Divorce Act
• Any religion → Special Marriage Act 1954

**Documents needed:**
Marriage certificate, ID proof, address proof, photos, separation proof, any evidence

Go to the **Family Court** in the city where you got married OR where you currently live.
📞 Free legal help: NALSA **15100**`,

  consumer: `**Consumer Complaint — Step by Step Guide**

**Where to file (based on money involved):**
• Claim up to **₹1 crore** → District Consumer Commission (your city)
• Claim **₹1–10 crore** → State Consumer Commission
• Claim **above ₹10 crore** → National Consumer Commission (NCDRC Delhi)

**How to file (steps):**
1. Send **legal notice** to company giving 15 days to respond
2. If no response, file complaint at Consumer Commission
3. Pay small filing fee (₹100–₹5,000 based on claim amount)
4. **File online FREE** at edaakhil.nic.in
5. Attach: bill/receipt, warranty card, defect photos, all messages with company
6. File within **2 years** of the problem

**What you can get:**
• Full refund of money paid
• Replacement of defective product
• Compensation for mental stress and time wasted
• Cost of filing complaint

**No lawyer needed** for simple consumer cases! You can represent yourself.
📞 Consumer Helpline: **1915** | Online filing: **edaakhil.nic.in**`,

  rights: `**Your Fundamental Rights as an Indian Citizen**

**Article 14 — Right to Equality**
Everyone is equal before the law. Government CANNOT discriminate based on religion, race, caste, sex, or place of birth.

**Article 19 — Right to Freedom**
You have the right to: speak freely, form associations, move anywhere in India, choose any profession, hold and sell property.

**Article 21 — Right to Life (MOST IMPORTANT!)**
No one can take away your life or freedom without following proper legal process. This also includes: right to privacy (Supreme Court 2017), right to education, right to health, right to live with dignity.

**Article 22 — Protection Against Arbitrary Arrest**
When arrested, police MUST:
✅ Tell you WHY you are being arrested
✅ Allow you to meet a lawyer of your choice IMMEDIATELY
✅ Produce you before a Magistrate within **24 hours**
✅ NOT keep you in custody beyond 24 hours without Magistrate's order
✅ Give you a medical examination

**If your rights are violated:**
• File complaint with **State Human Rights Commission (SHRC)**
• File a **Writ Petition** in High Court (Article 226) — FREE for PIL
• File in **Supreme Court** (Article 32) for fundamental rights violations
📞 NHRC Helpline: **14433** | NALSA: **15100**`,

  property: `**Property Disputes in India — What You Need to Know**

**Common types of property disputes:**
• Boundary dispute with neighbour
• Ownership or title dispute
• Inheritance / succession dispute
• Landlord-tenant dispute
• Encroachment (someone building on your land)
• Property fraud (fake sale)

**Important laws you should know:**
• **Registration Act 1908** — All property above ₹100 MUST be registered (if not, not valid in court)
• **Transfer of Property Act 1882** — Governs sale, mortgage, gift, lease
• **Limitation Act** — You have **12 years** to file case for property possession
• **Hindu Succession Act** — Daughters have EQUAL rights as sons in ancestral property (Supreme Court 2020)

**Key documents you need:**
Sale deed / Title deed, Mutation records (Khata/Patta), Survey report, Tax receipts, Previous court orders (if any)

**What to do:**
1. Get a lawyer to **verify your title documents** first
2. Try negotiation or **Lok Adalat** (free, fast)
3. If no resolution, file civil suit in **District Court**

📞 Free legal help: NALSA **15100**`,

  labour: `**Labour Rights in India — Know Your Rights**

**Key laws protecting workers:**
• **Minimum Wages Act 1948** — Every worker has right to minimum wage fixed by state govt
• **Payment of Wages Act 1936** — Wages must be paid by 7th or 10th of next month; no unauthorized deductions
• **Payment of Gratuity Act 1972** — After **5 years** continuous service: Gratuity = (Last salary × 15 × years of service) ÷ 26
• **EPF Act 1952** — Both employer AND employee contribute **12% each** of basic salary
• **ESIC** — Health insurance for employees earning below ₹21,000/month
• **Factories Act 1948** — Max **48 hours/week**; overtime at double rate
• **POSH Act 2013** — Protection from sexual harassment at workplace

**If wrongfully terminated:**
1. Send legal notice to employer
2. File complaint with **Labour Commissioner** of your district
3. Approach **Labour Court**
4. File online at **shramsuvidha.gov.in**

**If employer doesn't pay salary:**
File complaint at Labour Commissioner; employer can face **6 months jail + fine**

📞 Labour Helpline: **1800-11-4444** | Online: **shramsuvidha.gov.in**`,

  pocso: `**POCSO Act — Protection of Children from Sexual Offences**

POCSO Act 2012 protects children below **18 years** from sexual abuse.

**Punishments:**
• Penetrative sexual assault → Minimum **10 years**, can extend to life imprisonment
• Aggravated assault (by family member, teacher, etc.) → Minimum **20 years**
• Non-penetrative sexual assault → **3–5 years**
• Sexual harassment of child → Up to **3 years**
• Child pornography → Up to **5 years**

**Who can report:**
• Any person (not just the child or family) can report
• Mandatory reporting — if you know of abuse and don't report, you can be punished

**How to report:**
1. Call **CHILDLINE: 1098** (free, 24/7)
2. File FIR at nearest police station
3. Approach Special Juvenile Police Unit (SJPU)
4. Special courts handle POCSO cases — child's identity is protected

**Identity protection:** Name of child victim CANNOT be disclosed to public.`,

  default: `Hello! I'm **LEXI** 👋 — your AI legal assistant for LEXASSIST.

I'm trained on **12,000+ Indian court cases**, the complete **Indian Penal Code (IPC)**, **CrPC sections**, Supreme Court judgments, and comprehensive Indian legal FAQs.

**I can help you understand:**
⚖️ **Criminal law** — Bail (Sections 436-439 CrPC), FIR, IPC sections, arrest rights
🏠 **Property law** — Disputes, inheritance, registration, daughters' rights
👨‍👩‍👧 **Family law** — Divorce, custody, maintenance, POCSO, domestic violence
👷 **Labour law** — Salary, termination, gratuity, EPF, POSH Act
📜 **Constitutional rights** — Fundamental rights, PIL, writ petitions
🛒 **Consumer rights** — Complaints, refunds, defective products, RTI
🚗 **Motor vehicle law** — Accidents, compensation, traffic violations

**Just ask your question in simple words** — I'll explain in language anyone can understand!

📞 Free legal help anytime: **NALSA 15100**`
};

const getFallbackResponse = (query, context, sources, answers) => {
  const q   = query.toLowerCase();

  // ── Greeting detection ────────────────────────────────────
  const greetings = ['hi','hello','hey','namaste','good morning','good afternoon','good evening','hii','helo','howdy','greetings','what can you do','who are you','help me','i need help'];
  if (greetings.some(g => q.trim() === g || q.trim().startsWith(g+' ') || q.trim().startsWith(g+'!') || q.trim().startsWith(g+','))) {
    return { answer: `Hello! 👋 I'm **LEXI**, your AI legal assistant for LEXASSIST.

I'm here to help you understand Indian law in **simple, everyday language**.

**Here's what I can help you with:**

⚖️ **Criminal Law** — Bail, FIR filing, arrest rights, IPC sections (302, 376, 420...)
🏠 **Property Law** — Property disputes, registration, inheritance, daughters' rights
👨‍👩‍👧 **Family Law** — Divorce, child custody, maintenance, domestic violence
👷 **Labour Law** — Salary issues, wrongful termination, gratuity, EPF
📜 **Your Rights** — Fundamental rights, what to do if arrested, PIL
🛒 **Consumer Rights** — How to file complaints, refunds, RTI applications
🚗 **Motor Vehicle** — Accident claims, traffic violations, MACT compensation

**Just type your question below!** For example:
• "How do I file an FIR?"
• "What is Section 420 IPC?"
• "How to apply for bail?"
• "What are my rights if police arrest me?"

📞 For free legal help call **NALSA: 15100** anytime.`, sources: [] };
  }


  const sec = detectSection(query);

  // Exact IPC section responses
  if (sec.isIPC || /\bipc\b|\bindian penal\b/i.test(q)) {
    if (q.includes('420') || q.includes('cheating')) return { answer: RESPONSES.ipc420, sources: ['ipc complete'] };
    if (q.includes('302') || q.includes('murder'))   return { answer: `**Section 302 IPC — Punishment for Murder**\n\nSection 302 IPC provides that whoever commits murder shall be punished with **death** or **imprisonment for life**, and shall also be liable to **fine**.\n\n**What is murder?** (Section 300 IPC)\nCulpable homicide is called murder when done with intention to cause death, or to cause such bodily injury that is sufficient to cause death.\n\n**Defences that reduce murder to culpable homicide:**\n• Grave and sudden provocation\n• Private defence\n• Exercise of legal power\n• Act without premeditation in a sudden fight\n\nThis is one of the most serious offences — only a competent criminal lawyer should handle such cases.\n\n📞 Free legal aid: NALSA **15100**`, sources: ['ipc complete'] };
    if (q.includes('376') || q.includes('rape'))     return { answer: `**Section 376 IPC — Punishment for Rape**\n\nPunishment: Rigorous imprisonment for **minimum 7 years**, may extend to **imprisonment for life** + fine.\n\n**Aggravated rape** (by policeman, hospital staff, etc.): Minimum **10 years**.\n\n**Gang rape** (Section 376D): Each person punished with minimum **20 years**, may extend to life.\n\n**Rape of minor below 16:** Minimum **20 years**, may extend to death.\n\n**How to report:**\n1. File FIR at any police station — police MUST register it\n2. Free medical examination must be provided\n3. Statement recorded by woman police officer\n4. Identity of victim is PROTECTED — cannot be disclosed\n\n📞 Women Helpline: **181** | Police: **112** | NALSA: **15100**\n\n*Legal aid is provided FREE to rape victims.*`, sources: ['ipc complete'] };
    if (q.includes('498') || q.includes('cruelty') || q.includes('dowry')) return { answer: `**Section 498A IPC — Cruelty by Husband or Relatives**\n\nPunishment: Imprisonment up to **3 years** + fine.\n\n**What is cruelty?**\n• Wilful conduct likely to drive woman to commit suicide\n• Causing danger to life, limb or health (physical or mental)\n• Harassment to coerce her to meet unlawful demand for dowry or property\n\n**This is non-bailable and cognizable** — police can arrest without warrant.\n\n**How to file case:**\n1. File FIR at nearest police station\n2. Or approach Magistrate under Section 200 CrPC\n3. Medical evidence of injuries helps\n4. Text messages, witness statements are evidence\n\n**Also apply for:**\n• Protection order under Domestic Violence Act\n• Maintenance under Section 125 CrPC\n• Restraining order against abuser\n\n📞 Women Helpline: **181** | Emergency: **112** | NALSA: **15100**`, sources: ['ipc complete'] };
  }

  // Topic keywords
  const topics = [
    { keys: ['bail','bailable','anticipatory bail','surety','custody release'], resp: 'bail' },
    { keys: ['fir','first information','police complaint','file complaint police','zero fir'], resp: 'fir' },
    { keys: ['420','cheating','fraud','cheat','deceive'], resp: 'ipc420' },
    { keys: ['divorce','separation','matrimonial','marriage end','alimony'], resp: 'divorce' },
    { keys: ['consumer','defective','refund','product complaint','consumer forum','edaakhil'], resp: 'consumer' },
    { keys: ['fundamental rights','my rights','article 21','constitutional right','arrested rights'], resp: 'rights' },
    { keys: ['property','land dispute','boundary','title','sale deed','daughter property'], resp: 'property' },
    { keys: ['labour','employee rights','salary not paid','termination','gratuity','epf'], resp: 'labour' },
    { keys: ['pocso','child abuse','minor','sexual offence child'], resp: 'pocso' },
  ];

  for (const { keys, resp } of topics) {
    if (keys.some(k => q.includes(k))) {
      return { answer: RESPONSES[resp], sources };
    }
  }

  // Use retrieved answers from dataset
  if (answers.length > 0) {
    const best = answers[0];
    const simplified = simplify(best.answer);
    return {
      answer: `**Based on Indian court cases and legal records:**\n\n${simplified}\n\n*Source: ${sources.join(', ')}*\n\n---\n*For advice specific to your situation, please consult a lawyer or call NALSA free helpline: **15100***`,
      sources
    };
  }

  // Context extraction
  if (context && context.includes('A:')) {
    const match = context.match(/A:\s*([\s\S]+?)(?=\n---|\n\nQ:|$)/);
    if (match?.[1] && match[1].length > 30) {
      return {
        answer: `**Based on Indian legal records:**\n\n${simplify(match[1].trim().slice(0,600))}\n\n*For professional legal advice, consult a lawyer or call NALSA: **15100***`,
        sources
      };
    }
  }

  return { answer: RESPONSES.default, sources: [] };
};

// @route POST /api/chatbot/message
exports.sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Free tier: 3 AI queries per day for citizens (non-blocking — just warn)
    if (req.user.role === 'citizen') {
      const today = new Date(); today.setHours(0,0,0,0);
      const count = await ChatHistory.aggregate([
        { $match: { user: req.user._id, updatedAt: { $gte: today } } },
        { $project: { userMsgs: { $filter: { input:'$messages', cond:{ $eq:['$$this.role','user'] } } } } },
        { $group: { _id: null, total: { $sum: { $size: '$userMsgs' } } } }
      ]);
      const used = count[0]?.total || 0;
      if (used >= 3) {
        return res.json({ success:true, data:{
          sessionId: sessionId || 'limit',
          answer: 'Daily limit reached (3 AI queries/day on free plan). Contact admin to upgrade your plan.',
          sources: [], limitReached: true
        }});
      }
    }
    if (!message?.trim()) return res.status(400).json({ success:false, message:'Message required' });

    const session   = sessionId || uuidv4();
    const queryType = detectSection(message);

    // Hybrid RAG retrieval
    const { context, sources, answers } = buildContext(message, 5);

    let answer = '';
    let usedSources = sources;

    // Try OpenAI if configured
    if (process.env.OPENAI_API_KEY?.startsWith('sk-')) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const history = await ChatHistory.findOne({ user:req.user.id, session });
        const prev    = (history?.messages||[]).slice(-6).map(m=>({ role:m.role==='assistant'?'assistant':'user', content:m.content }));

        const completion = await openai.chat.completions.create({
          model:    'gpt-3.5-turbo',
          messages: [ { role:'system', content:buildSystemPrompt(context, queryType) }, ...prev, { role:'user', content:message } ],
          max_tokens: 700, temperature: 0.25,
        });
        answer = completion.choices[0].message.content;
      } catch(err) {
        console.error('OpenAI error:', err.message);
        ({ answer, sources: usedSources } = getFallbackResponse(message, context, sources, answers));
      }
    } else {
      ({ answer, sources: usedSources } = getFallbackResponse(message, context, sources, answers));
    }

    // Save to chat history
    await ChatHistory.findOneAndUpdate(
      { user:req.user.id, session },
      { $push: { messages: { $each: [
        { role:'user',      content:message,     timestamp:new Date() },
        { role:'assistant', content:answer, sources:usedSources, timestamp:new Date() }
      ]}}},
      { upsert:true, new:true }
    );

    res.json({ success:true, data:{ sessionId:session, answer, sources:usedSources } });
  } catch(err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ success:false, message:err.message });
  }
};

// @route POST /api/chatbot/analyze-doc
exports.analyzeDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded' });

    let text = '';
    if (req.file.mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const data     = await pdfParse(fs.readFileSync(req.file.path));
      text = data.text;
    } else {
      text = fs.readFileSync(req.file.path, 'utf-8');
    }
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    text = text.trim().slice(0, 4000);
    if (!text) return res.status(400).json({ success:false, message:'Could not extract text from document.' });

    const { isLegal, score, keywords } = isLegalDoc(text);

    if (!isLegal) {
      return res.json({
        success: true,
        isLegalDocument: false,
        data: {
          warning: true,
          answer: `⚠️ **This does not appear to be a legal document.**\n\nThe file "${req.file.originalname}" does not contain legal content. Legal keywords found: ${score} (minimum 3 required).\n\n**LEXI can analyze:**\n✅ Court orders and judgments\n✅ FIR copies\n✅ Legal notices\n✅ Bail applications\n✅ Sale deeds / property documents\n✅ Consumer complaints\n✅ Summons / warrants\n✅ Affidavits and contracts\n\n**Please upload a legal document** and I'll explain it in simple language! 💬`
        }
      });
    }

    // Analyze legal document
    let answer = '';
    const docContext = buildContext(text.slice(0,500), 3);

    if (process.env.OPENAI_API_KEY?.startsWith('sk-')) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const r = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role:'system', content:`You are LEXI. Explain this legal document to a common Indian citizen in very simple language. Structure your response as:\n1. **Document Type** — What type of document\n2. **What it says** — Key points in bullet form\n3. **Important dates/deadlines** — Any dates to note\n4. **What you must do** — Specific actions needed\n5. **Who to contact** — Lawyer or government office\n\nUse simple everyday language. Explain legal terms in brackets.` },
            { role:'user', content:`Explain this document:\n\n${text}` }
          ],
          max_tokens: 800, temperature: 0.2,
        });
        answer = r.choices[0].message.content;
      } catch(e) { answer = generateDocFallback(text, req.file.originalname); }
    } else {
      answer = generateDocFallback(text, req.file.originalname);
    }

    res.json({ success:true, isLegalDocument:true, data:{ answer, sources:['Document Analysis'] } });
  } catch(err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success:false, message:err.message });
  }
};

const generateDocFallback = (text, filename) => {
  const t = text.toLowerCase();
  let docType = 'Legal Document', actions = [];
  if (t.includes('bail'))              { docType='Bail Order/Application';   actions=['Contact your lawyer immediately','Arrange surety/guarantor','Appear in court on specified date']; }
  else if (t.includes('fir'))          { docType='FIR (First Information Report)'; actions=['Get certified copy of FIR','Note the FIR number','Show it to your lawyer immediately']; }
  else if (t.includes('summon'))       { docType='Court Summons';             actions=['DO NOT ignore — appear on the given date','Hire a lawyer immediately','Bring all related documents to court']; }
  else if (t.includes('notice'))       { docType='Legal Notice';              actions=['Respond within given time (15-30 days)','Consult lawyer before replying','Keep a copy of the notice']; }
  else if (t.includes('judgment') || t.includes('order')) { docType='Court Judgment/Order'; actions=['Read all conditions carefully','Note any appeal deadlines (usually 30-90 days)','Follow all court directions immediately']; }
  else if (t.includes('sale deed') || t.includes('property')) { docType='Property Document'; actions=['Get verified by a property lawyer','Register if not already registered','Keep original in safe place']; }
  return `**Document Type Detected:** ${docType}\n\n**What you need to do:**\n${actions.map((a,i)=>`${i+1}. ${a}`).join('\n')||'1. Read carefully\n2. Consult a lawyer\n3. Keep safe copy'}\n\n**General advice:**\n• Always keep original document safe — do not lose it\n• Take a photo backup immediately\n• Note any dates or deadlines mentioned\n• Show to a qualified lawyer for specific advice\n\n📞 Free legal help: **NALSA 15100** | 🌐 nalsa.gov.in`;
};

exports.getChatHistory = async (req, res) => {
  try {
    const h = await ChatHistory.find({ user:req.user.id }).sort('-updatedAt').limit(20).select('session messages updatedAt');
    res.json({ success:true, data:h });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.deleteSession = async (req, res) => {
  try {
    await ChatHistory.findOneAndDelete({ user:req.user.id, session:req.params.sessionId });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.searchKB = async (req, res) => {
  try {
    const q = req.query.q || '';
    const { context, sources, answers } = buildContext(q, 5);
    res.json({ success:true, data:{ context:context.slice(0,2000), sources, answersCount:answers.length } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.getKBStats = async (req, res) => {
  try {
    res.json({ success:true, data:getStats() });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};
// NOTE: This appends - actual fix is in getFallbackResponse greetings block above
