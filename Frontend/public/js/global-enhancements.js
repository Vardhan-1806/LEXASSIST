/**
 * LEXASSIST — Global Enhancements
 * Profile badge, floating chatbot, guide mode, legal terms, auto-summary
 */

// ══════════════════════════════════════════════════════════════
// 1. NAVBAR PROFILE BADGE (replaces separate profile icon)
// ══════════════════════════════════════════════════════════════
const ProfileBadge = {
  init: () => {
    const user = Auth.user();
    if (!user?.name) return;

    const el = document.getElementById('profileBadgeWrap');
    if (!el) return;

    const initial  = (user.name||'U')[0].toUpperCase();
    const shortName= user.name.split(' ')[0];

    el.innerHTML = `
      <div class="profile-badge-btn" id="profileBadgeBtn" onclick="ProfileBadge.toggle()">
        <div class="profile-avatar-mini">${initial}</div>
        <span class="profile-badge-name">${shortName}</span>
        <span style="font-size:0.65rem;color:rgba(255,255,255,0.6);margin-left:2px">▾</span>
      </div>
      <div class="profile-dropdown" id="profileDropdown" style="display:none">
        <div class="profile-dropdown-header">
          <div class="profile-avatar-lg">${initial}</div>
          <div>
            <div style="font-weight:700;color:var(--navy);font-size:0.9rem">${user.name}</div>
            <div style="font-size:0.72rem;color:var(--muted);text-transform:capitalize">${user.role} · ${user.userId||''}</div>
          </div>
        </div>
        <div class="profile-dropdown-divider"></div>
        <a href="/profile"   class="profile-dropdown-item">👤 My Profile</a>
        <a href="/profile"   class="profile-dropdown-item">⚙️ Settings</a>
        <div class="profile-dropdown-divider"></div>
        <a href="/login" onclick="Auth.logout();return false;" class="profile-dropdown-item" style="color:var(--danger)">🚪 Logout</a>
      </div>`;

    // Close on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('#profileBadgeWrap')) {
        document.getElementById('profileDropdown')?.style && (document.getElementById('profileDropdown').style.display='none');
        ProfileBadge.open = false;
      }
    });
  },

  open: false,
  toggle: () => {
    ProfileBadge.open = !ProfileBadge.open;
    const dd = document.getElementById('profileDropdown');
    if (dd) dd.style.display = ProfileBadge.open ? 'block' : 'none';
  }
};

window.ProfileBadge = ProfileBadge;

// ══════════════════════════════════════════════════════════════
// 2. FLOATING CHATBOT BUTTON
// ══════════════════════════════════════════════════════════════
const FloatChat = {
  open: false,
  messages: [],
  sessionId: 'float-' + Date.now(),

  getGreeting: () => {
    const path = window.location.pathname;
    const name = Auth.user()?.name?.split(' ')[0] || 'there';
    if (path.includes('/lawyers'))      return `Tell me your case type and I'll help you find the right lawyer.`;
    if (path.includes('/cases'))        return `Ask me about your case or I can find similar judgments for you.`;
    if (path.includes('/documents'))    return `I can explain any legal document you've uploaded.`;
    if (path.includes('/appointments')) return `Questions about court preparation? I'm here to help.`;
    return `Hello ${name}! How can I help you with your legal matters today?`;
  },

  init: () => {
    // Don't add on auth pages
    if (['/login','/register','/','/admin/login'].includes(window.location.pathname)) return;

    const btn = document.createElement('div');
    btn.id = 'floatChatBtn';
    btn.innerHTML = '🤖';
    btn.title = 'Ask LEXI — AI Legal Assistant';
    btn.onclick = FloatChat.toggle;
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'floatChatPanel';
    panel.innerHTML = `
      <div class="fc-header" id="fcDragHandle" style="cursor:grab">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.1rem">🤖</div>
          <div><div style="font-weight:700;color:#fff;font-size:0.9rem">LEXI — Legal Assistant</div><div style="font-size:0.7rem;color:rgba(255,255,255,0.6)">AI-powered · Drag to move</div></div>
        </div>
        <button onclick="FloatChat.toggle()" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.2rem;cursor:pointer;padding:4px">✕</button>
      </div>
      <div class="fc-messages" id="fcMessages">
        <div class="fc-msg fc-ai">
          <div class="fc-msg-content">${FloatChat.getGreeting()}</div>
        </div>
      </div>
      <div class="fc-suggestions" id="fcSuggestions">
        <button onclick="FloatChat.send('What are my rights if arrested?')">Rights if arrested?</button>
        <button onclick="FloatChat.send('How to file an FIR?')">How to file FIR?</button>
        <button onclick="FloatChat.send('What is bail?')">What is bail?</button>
      </div>
      <div class="fc-input-row">
        <input type="file" id="fcFile" accept=".pdf,.txt,.doc" style="display:none" onchange="FloatChat.uploadFile(this)">
        <button onclick="document.getElementById('fcFile').click()" title="Upload document" style="background:none;border:none;cursor:pointer;font-size:1rem;padding:4px;color:var(--muted)">📎</button>
        <button id="fcVoiceBtn" onclick="FloatChat.toggleVoice()" title="Voice input" style="background:none;border:none;cursor:pointer;font-size:1rem;padding:4px;color:var(--muted)">🎤</button>
        <input type="text" id="fcInput" placeholder="Ask a legal question..." onkeydown="if(event.key==='Enter')FloatChat.send()" style="flex:1">
        <button onclick="FloatChat.send()" class="fc-send-btn">➤</button>
      </div>`;
    document.body.appendChild(panel);
    FloatChat.makeDraggable(panel);
  },

  toggle: () => {
    FloatChat.open = !FloatChat.open;
    const p = document.getElementById('floatChatPanel');
    const b = document.getElementById('floatChatBtn');
    if (p) p.classList.toggle('open', FloatChat.open);
    if (b) b.classList.toggle('active', FloatChat.open);
  },

  send: async (msg) => {
    const input = document.getElementById('fcInput');
    const message = msg || input?.value?.trim();
    if (!message) return;
    if (input) input.value = '';

    const msgs = document.getElementById('fcMessages');
    msgs.innerHTML += `<div class="fc-msg fc-user"><div class="fc-msg-content">${message}</div></div>`;
    msgs.innerHTML += `<div class="fc-msg fc-ai" id="fcTyping"><div class="fc-msg-content"><span class="loader dark" style="width:16px;height:16px"></span></div></div>`;
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const r = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${Auth.token()}` },
        body: JSON.stringify({ message, sessionId: FloatChat.sessionId })
      });
      const d = await r.json();
      const typing = document.getElementById('fcTyping');
      if (typing) typing.outerHTML = `<div class="fc-msg fc-ai"><div class="fc-msg-content">${(d.data?.answer||'Sorry, try again.').replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').slice(0,500)}${(d.data?.answer||'').length>500?'... <a href="/chatbot" style="color:var(--gold)">Read more →</a>':''}</div></div>`;
    } catch(e) {
      const typing = document.getElementById('fcTyping');
      if (typing) typing.outerHTML = `<div class="fc-msg fc-ai"><div class="fc-msg-content">Connection error. <a href="/chatbot" style="color:var(--gold)">Open full chatbot →</a></div></div>`;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
};
window.FloatChat = FloatChat;

// ══════════════════════════════════════════════════════════════
// 3. GUIDE MODE (jury demo feature)
// ══════════════════════════════════════════════════════════════
const GuideMode = {
  on: false,
  tips: {
    // CSS selector → tooltip text
    '.lawyer-card':          'Shows a verified lawyer\'s specialization, AI rating, and lets you book a court appointment.',
    '.stat-card':            'Key statistics about your legal activity on LEXASSIST.',
    '.badge-high, .badge-critical': 'Priority level of this case — based on hearing date, case type, and pending actions.',
    '#emergencyStrip, .emergency-strip': 'Tap for instant access to police (112), NALSA legal aid (15100), and women helpline (181).',
    '.chatbot-btn, #floatChatBtn': 'Ask LEXI, our AI legal assistant, any question in plain English — 24/7 free.',
    '.case-card, .case-row': 'Your legal case — track timeline, stages, and get updates from your lawyer.',
    '.verified-badge':       'This lawyer\'s credentials have been manually verified by LEXASSIST admin.',
    '.timeline':             'Step-by-step progress of your legal case from filing to judgment.',
    '.notif-bell':           'Notifications for case updates, hearing reminders, and lawyer responses.',
    '.btn[onclick*="Book"]': 'Book this lawyer for court argument or court preparation session.',
    '.calendar':             'Your personal calendar — red dates are court hearings, gold are appointments.',
    '.doc-card':             'Legal document you uploaded — share with your lawyer using a secure link.',
    '.priority-score':       'AI-calculated urgency score (0-100) based on hearing proximity and case risk.',
    '.otp-box, .otp-wrap':   'Enter the 4-digit code sent to your email to verify your account.',
  },

  init: () => {
    if (['/login','/register','/','/admin/login'].includes(window.location.pathname)) return;
    const btn = document.createElement('button');
    btn.id = 'guideModeBtn';
    btn.textContent = 'Guide Mode OFF';
    btn.onclick = GuideMode.toggle;
    document.body.appendChild(btn);

    const tooltip = document.createElement('div');
    tooltip.id = 'guideTooltip';
    document.body.appendChild(tooltip);
  },

  toggle: () => {
    GuideMode.on = !GuideMode.on;
    const btn = document.getElementById('guideModeBtn');
    if (btn) { btn.textContent = GuideMode.on ? 'Guide Mode ON' : 'Guide Mode OFF'; btn.classList.toggle('guide-active', GuideMode.on); }
    if (GuideMode.on) GuideMode.attachListeners();
    else GuideMode.removeTooltip();
  },

  attachListeners: () => {
    Object.entries(GuideMode.tips).forEach(([sel, tip]) => {
      document.querySelectorAll(sel).forEach(el => {
        el.addEventListener('mouseenter', GuideMode.showTip.bind(null, tip));
        el.addEventListener('mouseleave', GuideMode.removeTooltip);
      });
    });
  },

  showTip: (text, e) => {
    if (!GuideMode.on) return;
    const tt = document.getElementById('guideTooltip');
    if (!tt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    tt.textContent = text;
    tt.style.cssText = `display:block;top:${rect.bottom + window.scrollY + 8}px;left:${Math.min(rect.left, window.innerWidth - 280)}px`;
  },

  removeTooltip: () => {
    const tt = document.getElementById('guideTooltip');
    if (tt) tt.style.display = 'none';
  }
};
window.GuideMode = GuideMode;

// ══════════════════════════════════════════════════════════════
// 4. LEGAL TERM TOOLTIPS
// ══════════════════════════════════════════════════════════════
const LegalTerms = {
  dict: {
    'FIR':              'First Information Report — the first written complaint filed with police when a crime is reported.',
    'Bail':             'Temporary release from custody while court proceedings are ongoing. You promise to appear in court.',
    'Cognizable':       'A serious offence where police can arrest without a warrant (e.g. murder, rape, robbery).',
    'Non-cognizable':   'A minor offence where police need a court order to arrest (e.g. cheating below ₹500).',
    'Writ':             'A formal court order commanding someone to do or stop doing something.',
    'Habeas Corpus':    'A writ requiring a person under arrest to be brought before a judge — protects against unlawful detention.',
    'Suo Motu':         'When a court takes up a case on its own initiative without anyone filing a petition.',
    'Affidavit':        'A written statement confirmed by oath — used as evidence in court proceedings.',
    'Injunction':       'A court order preventing someone from doing a specific action.',
    'Plaintiff':        'The person who files a lawsuit in civil court — the one making the complaint.',
    'Defendant':        'The person or party being sued or accused in a court case.',
    'Acquittal':        'When a court finds the accused NOT guilty and sets them free.',
    'Remand':           'When a court sends an accused person back into custody (police or judicial) pending further proceedings.',
    'Chargesheet':      'A formal document filed by police listing the criminal charges against an accused person.',
    'Summons':          'An official notice ordering a person to appear before a court on a specific date.',
    'Warrant':          'A court order authorizing police to arrest someone or search a property.',
    'Appeal':           'Asking a higher court to review and reverse a lower court\'s decision.',
    'Tribunal':         'A special court set up to handle specific types of cases (e.g. consumer disputes, tax matters).',
    'Arbitration':      'Resolving disputes outside court using a neutral third party whose decision is binding.',
    'RTI':              'Right to Information — your right to request documents and information from any government body.',
    'PIL':              'Public Interest Litigation — a case filed for the benefit of the public, not just the individual.',
    'Contempt':         'Disobeying or disrespecting a court order — can result in fine or imprisonment.',
    'Adjournment':      'Postponing a court hearing to a later date.',
    'Decree':           'A final court order in a civil case stating the rights of the parties.',
    'Caveat':           'A notice filed with a court asking to be informed before any order is passed in a case.',
    'Anticipatory Bail':'Bail applied for BEFORE arrest — protects against future arrest in a case.',
    'IPC':              'Indian Penal Code — the main criminal law of India defining crimes and their punishments.',
    'CrPC':             'Code of Criminal Procedure — the law that governs how criminal cases are investigated and tried.',
    'POCSO':            'Protection of Children from Sexual Offences Act 2012 — protects children below 18 from sexual abuse.',
    'Maintenance':      'Money paid by one spouse to another (and/or children) after separation or divorce.',
    'Lok Adalat':       'People\'s Court — a free alternative dispute resolution forum where cases are settled amicably.',
    'NALSA':            'National Legal Services Authority — provides free legal aid to eligible citizens. Helpline: 15100.',
    'Consumer Forum':   'A special court for resolving disputes between consumers and sellers/service providers.',
    'RERA':             'Real Estate Regulatory Authority — protects homebuyers from builder delays and fraud.',
    'Quash':            'When a higher court cancels or sets aside a lower court\'s order or FIR.',
    'Interlocutory':    'A temporary court order passed during a case, before the final judgment.',
    'Mediation':        'A voluntary process where a neutral mediator helps parties reach a mutual settlement.',
    'Custody':          'Legal right to care for and make decisions about a child after divorce or separation.',
    'Alimony':          'Regular financial payments made to a spouse after divorce for their support.',
    'Probate':          'Legal process of proving a will is valid in court before distributing the deceased person\'s property.',
    'Mortgage':         'Using property as security for a loan — the lender can claim the property if you don\'t repay.',
    'Indemnity':        'A promise to compensate another person for loss or damage they suffer.',
    'NGT':              'National Green Tribunal — handles cases related to environmental protection and conservation.',
  },

  apply: () => {
    const terms = Object.keys(LegalTerms.dict);
    const regex  = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`, 'g');

    const walk = (node) => {
      if (node.nodeType === 3) { // Text node
        if (!regex.test(node.textContent)) return;
        regex.lastIndex = 0;
        const span = document.createElement('span');
        span.innerHTML = node.textContent.replace(regex, match =>
          `<span class="legal-term" data-term="${match}">${match}</span>`
        );
        node.parentNode.replaceChild(span, node);
      } else if (node.nodeType === 1 && !['script','style','input','textarea','a'].includes(node.tagName.toLowerCase())) {
        [...node.childNodes].forEach(walk);
      }
    };

    // Only apply to main content areas
    document.querySelectorAll('main, .main-content, .card, .lawyer-bio, .case-desc, p').forEach(el => {
      if (!el.dataset.termsDone) { el.dataset.termsDone='1'; walk(el); }
    });

    // Add tooltip
    let tt = document.getElementById('termTooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'termTooltip';
      document.body.appendChild(tt);
    }

    document.addEventListener('mouseover', e => {
      const el = e.target.closest('.legal-term');
      if (!el) { tt.style.display='none'; return; }
      const term = el.dataset.term;
      tt.textContent = `${term}: ${LegalTerms.dict[term] || ''}`;
      const rect = el.getBoundingClientRect();
      tt.style.cssText = `display:block;top:${rect.bottom + window.scrollY + 6}px;left:${Math.max(8,Math.min(rect.left, window.innerWidth-300))}px`;
    });
    document.addEventListener('mouseout', e => {
      if (!e.target.closest('.legal-term')) tt.style.display='none';
    });
  }
};
window.LegalTerms = LegalTerms;

// ══════════════════════════════════════════════════════════════
// 5. SMART LAWYER RECOMMENDATION after filing case
// ══════════════════════════════════════════════════════════════
const SmartRec = {
  show: async (caseType) => {
    const container = document.getElementById('lawyerRec');
    if (!container || !caseType) return;
    try {
      const d = await API.get(`/api/lawyers?specialization=${encodeURIComponent(caseType)}&limit=3`);
      if (!d.data?.length) { container.style.display='none'; return; }
      container.style.display = 'block';
      container.innerHTML = `
        <div style="font-size:0.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">
          ⭐ Recommended lawyers for ${caseType} cases
        </div>
        ${d.data.map(l=>`
          <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--ivory-dark)">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center;color:var(--gold);font-weight:700;flex-shrink:0">${(l.user?.name||'L')[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:0.85rem;color:var(--navy)">${l.user?.name||'Lawyer'}</div>
              <div style="font-size:0.74rem;color:var(--muted)">${l.experience||0} yrs · ${(l.aiRating||l.rating||0).toFixed(1)} ★</div>
            </div>
            <a href="/lawyers" class="btn btn-sm btn-outline" style="padding:5px 10px;font-size:0.75rem">Book →</a>
          </div>`).join('')}`;
    } catch(e) { container.style.display='none'; }
  }
};
window.SmartRec = SmartRec;

// ══════════════════════════════════════════════════════════════
// 6. AUTO CASE SUMMARY (collapses long descriptions)
// ══════════════════════════════════════════════════════════════
const AutoSummary = {
  apply: () => {
    document.querySelectorAll('.case-description, .case-desc').forEach(el => {
      const text = el.textContent.trim();
      if (text.split(/\s+/).length < 100) return;

      // Already processed
      if (el.dataset.summarized) return;
      el.dataset.summarized = '1';

      const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
      const summary   = sentences.slice(0, 3).map(s => `• ${s.trim()}`).join('\n');

      const chip = document.createElement('span');
      chip.className = 'summary-chip';
      chip.textContent = '📋 Summary';
      chip.title = 'Click to toggle summary view';

      let collapsed = false;
      const full = el.textContent;
      chip.onclick = () => {
        collapsed = !collapsed;
        el.textContent = collapsed ? summary : full;
        chip.textContent = collapsed ? '📄 Full text' : '📋 Summary';
      };

      el.parentNode.insertBefore(chip, el);
    });
  }
};
window.AutoSummary = AutoSummary;

// ══════════════════════════════════════════════════════════════
// 7. DOCUMENT CHECKLIST (per case type, localStorage)
// ══════════════════════════════════════════════════════════════
const DocChecklist = {
  data: {
    'Criminal':  ['FIR copy','ID proof (Aadhar/PAN)','Police complaint receipt','Witness statements','Medical reports (if any)','Lawyer engagement letter'],
    'Family':    ['Marriage certificate','ID proofs of both parties','Children\'s birth certificates (if custody)','Bank statements (3 months)','Property documents','Any prior court orders'],
    'Property':  ['Sale deed / Title deed','Encumbrance certificate','Survey sketch','Khata / Patta','Property tax receipts','Previous ownership documents'],
    'Consumer':  ['Bill / Invoice / Receipt','Warranty card','Photos of defective product','All correspondence with seller','Bank statement (payment proof)','Any repair reports'],
    'Labour':    ['Appointment letter','Salary slips (3-6 months)','Termination letter','Bank statements','Attendance records','Any written warnings received'],
    'Civil':     ['Contract/Agreement copy','Correspondence with other party','Evidence of breach','Bank statements','Witness information','Prior legal notices'],
    'Cyber':     ['Screenshots of fraud/offense','Bank transaction receipts','Chat transcripts','Email proofs','Cybercrime complaint receipt','Device details'],
  },

  show: (caseType, caseId) => {
    const container = document.getElementById('docChecklist');
    if (!container) return;
    const items = DocChecklist.data[caseType] || DocChecklist.data['Civil'];
    const key   = `lex_chk_${caseId||caseType}`;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');

    container.innerHTML = `
      <div style="font-size:0.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">
        📎 Documents Needed for ${caseType} Case
      </div>
      ${items.map((item, i) => `
        <label style="display:flex;align-items:center;gap:9px;padding:6px 0;cursor:pointer;font-size:0.84rem;color:${saved.includes(i)?'var(--success)':'var(--navy)'}">
          <input type="checkbox" ${saved.includes(i)?'checked':''} onchange="DocChecklist.toggle('${key}',${i},this)"
            style="width:15px;height:15px;accent-color:var(--success);flex-shrink:0">
          <span style="${saved.includes(i)?'text-decoration:line-through;color:var(--muted)':''}">${item}</span>
        </label>`).join('')}
      <div style="margin-top:8px;font-size:0.74rem;color:var(--muted)">${saved.length}/${items.length} documents ready</div>`;
  },

  toggle: (key, idx, cb) => {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const i = saved.indexOf(idx);
    if (i === -1) saved.push(idx); else saved.splice(i, 1);
    localStorage.setItem(key, JSON.stringify(saved));
    const label = cb.parentElement;
    label.style.color = cb.checked ? 'var(--success)' : 'var(--navy)';
    label.querySelector('span').style.cssText = cb.checked ? 'text-decoration:line-through;color:var(--muted)' : '';
  }
};
window.DocChecklist = DocChecklist;

// ══════════════════════════════════════════════════════════════
// AUTO-INIT on DOMContentLoaded
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  ProfileBadge.init();
  FloatChat.init();
  // GuideMode.init(); // Removed per requirements
  setTimeout(LegalTerms.apply, 1000); // After page renders
  setTimeout(AutoSummary.apply, 500);
});

// ══════════════════════════════════════════════════════════════
// FIRST-TIME USER TOUR (booking a lawyer flow)
// ══════════════════════════════════════════════════════════════
const Tour = {
  steps: [
    { title: 'Welcome to LEXASSIST! 👋', text: 'Let us show you how to find and book a lawyer in 3 simple steps.', target: null },
    { title: 'Step 1: Find a Lawyer ⚖️', text: 'Click "Find a Lawyer" to browse verified lawyers. You can filter by city and specialization.', target: '[href="/lawyers"]', highlight: true },
    { title: 'Step 2: Filter by Specialization 🔍', text: 'On the Find Lawyers page — select your city and the type of case (Criminal, Family, Property etc.) to narrow results.', target: null },
    { title: 'Step 3: Book for Court 📋', text: 'Click "Book for Court" on any lawyer card. Choose purpose (Court Argument or Court Preparation), select a date and time slot.', target: null },
    { title: 'You\'re all set! 🎉', text: 'After booking, you\'ll get a confirmation email. Your lawyer will see the appointment and contact you.', target: null },
  ],
  current: 0,

  shouldShow: () => {
    const user = Auth.user();
    if (!user?.name) return false;
    // Only show on citizen dashboard for first-timers
    if (!window.location.pathname.includes('/dashboard/citizen')) return false;
    const key = `lex_tour_done_${user.email || user._id}`;
    return !localStorage.getItem(key);
  },

  start: () => {
    if (!Tour.shouldShow()) return;
    Tour.current = 0;
    Tour.showStep();
  },

  showStep: () => {
    let overlay = document.getElementById('tourOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tourOverlay';
      document.body.appendChild(overlay);
    }

    const step = Tour.steps[Tour.current];
    const isLast = Tour.current === Tour.steps.length - 1;

    overlay.innerHTML = `
      <div id="tourCard">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.5)">${Tour.current + 1} of ${Tour.steps.length}</div>
          <button onclick="Tour.skip()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:0.8rem">Skip tour ✕</button>
        </div>
        <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:8px">${step.title}</div>
        <div style="font-size:0.875rem;color:rgba(255,255,255,0.8);line-height:1.6;margin-bottom:18px">${step.text}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${Tour.current > 0 ? `<button onclick="Tour.prev()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:7px 16px;border-radius:50px;cursor:pointer;font-family:inherit;font-size:0.8rem">← Back</button>` : ''}
          <button onclick="${isLast ? 'Tour.done()' : 'Tour.next()'}" style="background:#c9a84c;border:none;color:#0d1b35;padding:7px 18px;border-radius:50px;cursor:pointer;font-weight:700;font-family:inherit;font-size:0.85rem">${isLast ? 'Get Started! 🚀' : 'Next →'}</button>
        </div>
        <div style="display:flex;gap:5px;justify-content:center;margin-top:14px">
          ${Tour.steps.map((_,i) => `<div style="width:7px;height:7px;border-radius:50%;background:${i===Tour.current?'#c9a84c':'rgba(255,255,255,0.3)'}"></div>`).join('')}
        </div>
      </div>`;
    overlay.style.display = 'flex';
  },

  next: () => { Tour.current++; Tour.showStep(); },
  prev: () => { Tour.current--; Tour.showStep(); },
  skip: () => Tour.done(),

  done: () => {
    const user = Auth.user();
    const key  = `lex_tour_done_${user.email || user._id}`;
    localStorage.setItem(key, '1');
    const overlay = document.getElementById('tourOverlay');
    if (overlay) overlay.style.display = 'none';
  }
};
window.Tour = Tour;

// Add tour CSS + auto-start
document.addEventListener('DOMContentLoaded', () => {
  // Add tour styles
  const style = document.createElement('style');
  style.textContent = `
    #tourOverlay { position:fixed;inset:0;background:rgba(13,27,53,0.75);z-index:500;display:none;align-items:center;justify-content:center;padding:20px; }
    #tourCard { background:linear-gradient(135deg,#0d1b35,#1f3461);border-radius:18px;padding:24px;width:100%;max-width:380px;box-shadow:0 16px 60px rgba(0,0,0,0.5);border:1px solid rgba(201,168,76,0.3); }
  `;
  document.head.appendChild(style);

  // Start tour after short delay on citizen dashboard
  setTimeout(Tour.start, 1500);
});
