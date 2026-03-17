import React, { useEffect, useState, useRef } from 'react'

const API = (import.meta?.env?.VITE_TOKEN_SERVER) || 'http://localhost:8080'

// ─── Model / Avatar config ────────────────────────────────────────────────────
const MODEL_COLORS = {
  'gpt-4o-realtime-mini':  { primary: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)'  },
  'gpt-4o-realtime':       { primary: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  'gemini-2.0-flash-live': { primary: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  'ultravox':              { primary: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.25)'  },
  'xai-grok':              { primary: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)'   },
  'phonic':                { primary: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)'  },
}
const MODEL_LABELS = {
  'gpt-4o-realtime-mini':  'GPT-4o Mini',
  'gpt-4o-realtime':       'GPT-4o Full',
  'gemini-2.0-flash-live': 'Gemini 2.0 Live',
  'ultravox':              'Ultravox 70B',
  'xai-grok':              'Grok Voice',
  'phonic':                'Phonic S2S',
}
const MODEL_PRICING = {
  'gpt-4o-realtime-mini':  '$10/M audio',
  'gpt-4o-realtime':       '$40/M audio',
  'gemini-2.0-flash-live': '$0.70/M audio',
  'ultravox':              '$0.05/min',
  'xai-grok':              '$0.05/min',
  'phonic':                '$0.05/min',
}
const MODEL_PROVIDERS = {
  'gpt-4o-realtime-mini':  'OpenAI',
  'gpt-4o-realtime':       'OpenAI',
  'gemini-2.0-flash-live': 'Google',
  'ultravox':              'Fixie AI',
  'xai-grok':              'xAI',
  'phonic':                'Phonic',
}
const ALL_MODELS = ['gpt-4o-realtime-mini','gpt-4o-realtime','gemini-2.0-flash-live','ultravox','xai-grok','phonic']

const AVATAR_COLORS = {
  'simli':    { primary: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
  'tavus':    { primary: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  'keyframe': { primary: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
}
const AVATAR_LABELS = { 'simli': 'Simli', 'tavus': 'Tavus', 'keyframe': 'Keyframe AI' }
const ALL_AVATARS = ['simli', 'tavus', 'keyframe']

// ─── Official pricing reference data ──────────────────────────────────────────
// All prices verified March 2026 from official docs
const OFFICIAL_MODEL_PRICING = {
  'gpt-4o-realtime-mini': {
    provider: 'OpenAI',
    audioInPerM: 10.00,   // $10/M audio input tokens
    audioOutPerM: 20.00,  // $20/M audio output tokens
    textInPerM: 0.60,
    textOutPerM: 2.40,
    // ~1667 tokens/min audio → per-minute rates
    officialPerMinIn: 0.06,   // ~$0.06/min audio input (OpenAI stated)
    officialPerMinOut: 0.12,  // ~$0.12/min audio output
    officialPerMinBlended: 0.10, // typical blended ~$0.10/min
    concurrent: 100,          // OpenAI Tier 1 default
    concurrentNote: 'Up to 100 (Tier 1). Enterprise: 1000+',
    billingUnit: 'tokens',
    pricingUrl: 'https://openai.com/api/pricing/',
  },
  'gpt-4o-realtime': {
    provider: 'OpenAI',
    audioInPerM: 40.00,
    audioOutPerM: 80.00,
    textInPerM: 5.00,
    textOutPerM: 20.00,
    officialPerMinIn: 0.24,
    officialPerMinOut: 0.48,
    officialPerMinBlended: 0.30,
    concurrent: 100,
    concurrentNote: 'Up to 100 (Tier 1). Enterprise: 1000+',
    billingUnit: 'tokens',
    pricingUrl: 'https://openai.com/api/pricing/',
  },
  'gemini-2.0-flash-live': {
    provider: 'Google',
    audioInPerM: 0.70,   // $0.70/M audio input tokens (25 tokens/sec)
    audioOutPerM: 0.40,  // same as text output
    textInPerM: 0.10,
    textOutPerM: 0.40,
    officialPerMinIn: 0.0105,  // 25 tok/s × 60s = 1500 tok/min × $0.70/M
    officialPerMinOut: 0.006,
    officialPerMinBlended: 0.016,
    concurrent: 50,
    concurrentNote: 'Free tier: 3 concurrent. Paid: 50 default, request more',
    billingUnit: 'tokens (25/sec audio)',
    pricingUrl: 'https://ai.google.dev/pricing',
  },
  'ultravox': {
    provider: 'Fixie AI',
    audioInPerM: null,
    audioOutPerM: null,
    textInPerM: null,
    textOutPerM: null,
    officialPerMinIn: null,
    officialPerMinOut: null,
    officialPerMinBlended: 0.05,
    concurrent: null,   // "no hard caps" on paid plan
    concurrentNote: 'Free: limited. Paid plans: no hard concurrency cap',
    billingUnit: 'per minute flat',
    pricingUrl: 'https://ultravox.ai/pricing',
  },
  'xai-grok': {
    provider: 'xAI',
    audioInPerM: null,
    audioOutPerM: null,
    textInPerM: null,
    textOutPerM: null,
    officialPerMinIn: null,
    officialPerMinOut: null,
    officialPerMinBlended: 0.05,
    concurrent: null,
    concurrentNote: 'No published hard cap. Contact xAI for enterprise limits',
    billingUnit: 'per minute flat',
    pricingUrl: 'https://x.ai/news/grok-voice-agent-api',
  },
  'phonic': {
    provider: 'Phonic',
    audioInPerM: null,
    audioOutPerM: null,
    textInPerM: null,
    textOutPerM: null,
    officialPerMinIn: null,
    officialPerMinOut: null,
    officialPerMinBlended: 0.05,
    concurrent: null,
    concurrentNote: 'Contact Phonic for concurrency limits',
    billingUnit: 'per minute flat',
    pricingUrl: 'https://phonic.ai',
  },
}

const OFFICIAL_AVATAR_PRICING = {
  'simli': {
    provider: 'Simli',
    officialPerMin: 0.05,
    officialPerMinNote: 'Pay-as-you-go. $10 free credit on signup.',
    concurrent: null,
    concurrentNote: 'No published hard cap. GPU-backed, scales on demand.',
    billingUnit: 'per minute',
    freeCredits: '$10 on signup + 50 min/month free tier',
    pricingUrl: 'https://simli.com',
  },
  'tavus': {
    provider: 'Tavus',
    officialPerMin: 0.59,  // ~$59/mo ÷ 100 min on Starter
    officialPerMinNote: 'Starter $59/mo ≈ 100 min (~$0.59/min). Growth $299/mo ≈ 500 min.',
    concurrent: 3,
    concurrentNote: 'Starter: 3 concurrent streams. Growth/Enterprise: higher, custom.',
    billingUnit: 'minutes per plan',
    freeCredits: '25 free live minutes on free tier',
    pricingUrl: 'https://tavus.io/pricing',
  },
  'keyframe': {
    provider: 'Keyframe AI',
    officialPerMin: null,
    officialPerMinNote: 'Custom / enterprise pricing. Contact for quote.',
    concurrent: null,
    concurrentNote: 'Enterprise-grade. Custom concurrency agreements.',
    billingUnit: 'custom',
    freeCredits: 'Demo available on request',
    pricingUrl: 'https://keyframe.ai',
  },
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null)
  const [tab, setTab]           = useState('overview')

  useEffect(() => {
    fetch(`${API}/sessions`)
      .then(r => r.json())
      .then(d => { setSessions(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.model_key === filter)

  const byModel = {}
  ALL_MODELS.forEach(key => {
    byModel[key] = { sessions: [], g2g: [], cost: [], tokens: [], durations: [], costPerMin: [] }
  })
  sessions.forEach(s => {
    const m = byModel[s.model_key]
    if (!m) return
    m.sessions.push(s)
    if (s.glass_to_glass_avg_ms) m.g2g.push(s.glass_to_glass_avg_ms)
    if (s.total_cost_usd)        m.cost.push(s.total_cost_usd)
    if (s.total_tokens)          m.tokens.push(s.total_tokens)
    if (s.session_duration_seconds) m.durations.push(s.session_duration_seconds)
    // Compute real cost-per-minute from session data
    if (s.total_cost_usd && s.session_duration_seconds && s.session_duration_seconds > 0) {
      m.costPerMin.push(s.total_cost_usd / (s.session_duration_seconds / 60))
    }
  })

  const AVATAR_RATE = { 'simli': 0.05, 'tavus': 0.59, 'keyframe': null }
  const byAvatar = {}
  ALL_AVATARS.forEach(key => { byAvatar[key] = { sessions: [], g2g: [], cost: [], durations: [] } })
  sessions.forEach(s => {
    const avatarKey = s.avatar || s.avatar_key
    const a = byAvatar[avatarKey]
    if (!a) return
    a.sessions.push(s)
    if (s.glass_to_glass_avg_ms)    a.g2g.push(s.glass_to_glass_avg_ms)
    if (s.session_duration_seconds) a.durations.push(s.session_duration_seconds)
    const rate = AVATAR_RATE[avatarKey]
    const mins = (s.session_duration_seconds || 0) / 60
    if (rate != null && mins > 0) a.cost.push(rate * mins)
  })

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#060a14',flexDirection:'column',gap:12}}>
      <div style={{width:32,height:32,border:'2px solid #1e2535',borderTop:'2px solid #6366f1',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{fontSize:13,color:'#4a5568'}}>Loading dashboard...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#060a14',color:'#e2e8f0',fontFamily:'system-ui',overflowY:'auto'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        * { box-sizing: border-box; } html,body { overflow-y: auto !important; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #1e2535; border-radius: 3px; }
        .diff-positive { color: #f87171; }
        .diff-negative { color: #10b981; }
        .diff-neutral  { color: #94a3b8; }
      `}</style>

      {/* ── Header ── */}
      <div style={{padding:'16px 28px',borderBottom:'1px solid #0f1624',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'rgba(6,10,20,0.95)',zIndex:50,backdropFilter:'blur(12px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:'#fff'}}>K</div>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:'#f1f5f9'}}>Kassel Academy — Benchmark Dashboard</div>
            <div style={{fontSize:11,color:'#4a5568'}}>{sessions.length} sessions · IELTS S2S Model Comparison</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{display:'flex',background:'#0d1117',borderRadius:8,padding:3,border:'1px solid #1e2535'}}>
            {['overview','comparison','sessions','pricing'].map(t => (
              <button key={t} onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:6,border:'none',fontSize:12,fontWeight:500,cursor:'pointer',background:tab===t?'#1e2535':'transparent',color:tab===t?'#f1f5f9':'#4a5568',textTransform:'capitalize'}}>
                {t}
              </button>
            ))}
          </div>
          <a href="/" style={{fontSize:12,color:'#6366f1',textDecoration:'none',padding:'7px 14px',border:'1px solid rgba(99,102,241,0.3)',borderRadius:8,background:'rgba(99,102,241,0.06)'}}>+ New Session</a>
          <button onClick={()=>exportCSV(sessions)} style={{fontSize:12,color:'#94a3b8',padding:'7px 14px',border:'1px solid #1e2535',borderRadius:8,background:'#0d1117',cursor:'pointer'}}>Export CSV</button>
        </div>
      </div>

      <div style={{padding:'24px 28px'}}>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
              {[
                ['Total Sessions', sessions.length, null],
                ['Best G2G', fmtMs(Math.min(...sessions.filter(s=>s.glass_to_glass_avg_ms).map(s=>s.glass_to_glass_avg_ms))), '#10b981'],
                ['Total Cost', fmt$(sessions.reduce((a,s)=>a+(s.total_cost_usd||0),0)), null],
                ['Avg Duration', `${Math.round(avg(sessions.map(s=>s.session_duration_seconds).filter(Boolean)))}s`, null],
              ].map(([label,val,color])=>(
                <div key={label} style={{background:'#0d1117',border:'1px solid #1e2535',borderRadius:12,padding:'16px 18px'}}>
                  <div style={{fontSize:11,color:'#4a5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>{label}</div>
                  <div style={{fontSize:26,fontWeight:600,color:color||'#f1f5f9'}}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{fontSize:11,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Model performance</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:28}}>
              {ALL_MODELS.map(key => {
                const m = byModel[key]
                const c = MODEL_COLORS[key]
                const hasData = m && m.sessions.length > 0
                return (
                  <div key={key} style={{background:'#0d1117',border:`1px solid ${hasData && c ? c.border : '#1e2535'}`,borderRadius:14,padding:'18px 20px',opacity:hasData?1:0.5}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'#f1f5f9'}}>{MODEL_LABELS[key] || key}</div>
                        <div style={{fontSize:11,color:'#4a5568',marginTop:2}}>{hasData ? `${m.sessions.length} sessions` : 'No sessions'}</div>
                      </div>
                      {c && (
                        <div style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:c.bg,color:c.primary,border:`1px solid ${c.border}`}}>
                          {hasData && m.g2g.length ? `avg ${avg(m.g2g).toFixed(0)}ms` : 'No data'}
                        </div>
                      )}
                    </div>
                    {hasData && (
                      <>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                          {[['G2G avg',fmtMs(avg(m.g2g))],['Avg cost',fmt$(avg(m.cost))],['Sessions',m.sessions.length]].map(([l,v])=>(
                            <div key={l} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'8px 10px'}}>
                              <div style={{fontSize:10,color:'#4a5568',marginBottom:3}}>{l}</div>
                              <div style={{fontSize:15,fontWeight:500,color:'#f1f5f9'}}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <LatencyBar values={m.g2g} color={c?.primary || '#6366f1'} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{fontSize:11,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Avatar comparison</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
              {ALL_AVATARS.map(key => {
                const m = byAvatar[key]
                const c = AVATAR_COLORS[key] || AVATAR_COLORS['simli']
                const hasData = m && m.sessions.length > 0
                return (
                  <div key={key} style={{background:'#0d1117',border:`1px solid ${hasData?c.border:'#1e2535'}`,borderRadius:14,padding:'16px 18px',opacity:hasData?1:0.5}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#f1f5f9'}}>{AVATAR_LABELS[key]}</div>
                      <div style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:c.bg,color:c.primary,border:`1px solid ${c.border}`}}>
                        {hasData ? `${m.sessions.length} sessions` : 'No data'}
                      </div>
                    </div>
                    {hasData && (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                        {[
                          ['G2G avg',    fmtMs(avg(m.g2g))],
                          ['Sessions',   m.sessions.length],
                          ['Avatar cost', m.cost.length ? fmt$(m.cost.reduce((a,b)=>a+b,0)) : '—'],
                          ['Avg duration', m.durations.length ? `${Math.round(avg(m.durations))}s` : '—'],
                        ].map(([l,v])=>(
                          <div key={l} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'8px 10px'}}>
                            <div style={{fontSize:10,color:'#4a5568',marginBottom:3}}>{l}</div>
                            <div style={{fontSize:15,fontWeight:500,color:'#f1f5f9'}}>{v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{fontSize:11,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>G2G latency over sessions</div>
            <div style={{background:'#0d1117',border:'1px solid #1e2535',borderRadius:14,padding:'20px',marginBottom:24}}>
              <TimelineChart sessions={sessions} />
            </div>

            <div style={{fontSize:11,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Recent sessions</div>
            <SessionTable sessions={sessions.slice(0,5)} onSelect={setSelected} compact />
          </>
        )}

        {/* ── COMPARISON TAB ── */}
        {tab === 'comparison' && (
          <>
            <ComparisonTable byModel={byModel} />
            <div style={{marginTop:24}}>
              <div style={{fontSize:11,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Latency distribution per model</div>
              <div style={{background:'#0d1117',border:'1px solid #1e2535',borderRadius:14,padding:'20px'}}>
                <BarChart byModel={byModel} />
              </div>
            </div>
          </>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === 'sessions' && (
          <>
            <div style={{display:'flex',gap:6,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{fontSize:11,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginRight:6}}>Model</div>
              {['all',...ALL_MODELS].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{fontSize:11,padding:'4px 10px',borderRadius:8,
                    border:`1px solid ${filter===f?'rgba(99,102,241,0.4)':'#1e2535'}`,
                    background:filter===f?'rgba(99,102,241,0.1)':'#0d1117',
                    color:filter===f?'#818cf8':'#4a5568',cursor:'pointer'}}>
                  {f==='all'?'All':MODEL_LABELS[f]||f}
                </button>
              ))}
              <div style={{marginLeft:'auto',fontSize:12,color:'#4a5568'}}>{filtered.length} sessions</div>
            </div>
            <SessionTable sessions={filtered} onSelect={setSelected} />
          </>
        )}

        {/* ── PRICING TAB ── */}
        {tab === 'pricing' && <PricingTab byModel={byModel} byAvatar={byAvatar} sessions={sessions} />}
      </div>

      {selected && <SessionPanel session={selected} onClose={()=>setSelected(null)} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PRICING TAB
// ─────────────────────────────────────────────────────────────────────────────
function PricingTab({ byModel, byAvatar, sessions }) {
  const [activeSection, setActiveSection] = useState('models')

  // Compute your real observed cost-per-min for each model
  const realCostPerMin = {}
  ALL_MODELS.forEach(key => {
    const m = byModel[key]
    if (!m || !m.sessions.length) { realCostPerMin[key] = null; return }
    const rates = []
    m.sessions.forEach(s => {
      if (s.total_cost_usd && s.session_duration_seconds > 0) {
        rates.push(s.total_cost_usd / (s.session_duration_seconds / 60))
      }
    })
    realCostPerMin[key] = rates.length ? avg(rates) : null
  })

  // Total spend per model
  const totalSpend = {}
  ALL_MODELS.forEach(key => {
    const m = byModel[key]
    totalSpend[key] = m ? m.cost.reduce((a,b)=>a+b,0) : 0
  })

  // Grand totals
  const totalSessionCost = sessions.reduce((a,s)=>a+(s.total_cost_usd||0),0)
  const totalMinutes     = sessions.reduce((a,s)=>a+(s.session_duration_seconds||0),0) / 60
  const globalRealCPM    = totalMinutes > 0 ? totalSessionCost / totalMinutes : null

  const S = {
    sectionBtn: (active) => ({
      padding:'6px 18px', borderRadius:8, border:`1px solid ${active?'rgba(99,102,241,0.5)':'#1e2535'}`,
      background:active?'rgba(99,102,241,0.12)':'#0d1117', color:active?'#818cf8':'#4a5568',
      fontSize:12, fontWeight:500, cursor:'pointer',
    }),
    card: { background:'#0d1117', border:'1px solid #1e2535', borderRadius:14, padding:'20px 22px', marginBottom:16 },
    subCard: { background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'14px 16px' },
    label: { fontSize:10, color:'#4a5568', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
    val: { fontSize:18, fontWeight:600, color:'#f1f5f9' },
    valSm: { fontSize:14, fontWeight:500, color:'#f1f5f9' },
    muted: { fontSize:12, color:'#64748b', lineHeight:1.5 },
    sectionTitle: { fontSize:11, color:'#4a5568', fontWeight:600, letterSpacing:1, textTransform:'uppercase', marginBottom:14 },
    divider: { height:'1px', background:'#1e2535', margin:'16px 0' },
    tag: (color) => ({ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:6,
      background:`${color}20`, color, border:`1px solid ${color}40` }),
    pill: { fontSize:10, padding:'2px 7px', borderRadius:12, background:'rgba(255,255,255,0.05)', color:'#64748b', border:'1px solid #1e2535' },
  }

  return (
    <div>
      {/* ── Global stats row ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          ['Total API spend',       fmt$(totalSessionCost),              '#f1f5f9'],
          ['Total session minutes',  `${totalMinutes.toFixed(1)} min`,   '#f1f5f9'],
          ['Blended real $/min',    globalRealCPM ? `$${globalRealCPM.toFixed(4)}/min` : '—', '#10b981'],
          ['Sessions tracked',      sessions.length,                     '#f1f5f9'],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:'#0d1117',border:'1px solid #1e2535',borderRadius:12,padding:'16px 18px'}}>
            <div style={{fontSize:11,color:'#4a5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>{l}</div>
            <div style={{fontSize:22,fontWeight:600,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Section switcher ── */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['models','S2S Models'],['avatars','Avatars'],['breakdown','Cost Breakdown']].map(([k,label])=>(
          <button key={k} onClick={()=>setActiveSection(k)} style={S.sectionBtn(activeSection===k)}>{label}</button>
        ))}
      </div>

      {/* ══ MODELS SECTION ══ */}
      {activeSection === 'models' && (
        <div>
          <div style={S.sectionTitle}>S2S model pricing — official vs. your real sessions</div>
          {ALL_MODELS.map(key => {
            const c  = MODEL_COLORS[key]
            const op = OFFICIAL_MODEL_PRICING[key]
            const m  = byModel[key]
            const realCPM  = realCostPerMin[key]
            const offCPM   = op.officialPerMinBlended
            const hasData  = m && m.sessions.length > 0
            const diff     = (realCPM != null && offCPM != null) ? ((realCPM - offCPM) / offCPM * 100) : null
            const diffClass = diff == null ? 'diff-neutral' : diff > 5 ? 'diff-positive' : diff < -5 ? 'diff-negative' : 'diff-neutral'

            return (
              <div key={key} style={{...S.card, borderColor: hasData ? c.border : '#1e2535'}}>
                {/* Header row */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:38,height:38,borderRadius:10,background:c.bg,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <div style={{width:14,height:14,borderRadius:'50%',background:c.primary}}/>
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:'#f1f5f9'}}>{MODEL_LABELS[key]}</div>
                      <div style={{fontSize:11,color:'#4a5568'}}>{op.provider} · {op.billingUnit}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    {hasData && <span style={S.tag(c.primary)}>{m.sessions.length} sessions</span>}
                    <span style={S.pill}>{op.billingUnit}</span>
                    {diff != null && (
                      <span className={diffClass} style={{fontSize:12,fontWeight:600}}>
                        {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`} vs official
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-column grid: Official pricing | Your real cost | Concurrency */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>

                  {/* Official pricing */}
                  <div style={S.subCard}>
                    <div style={{fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Official pricing</div>
                    <div style={{marginBottom:8}}>
                      <div style={S.label}>Blended $/min</div>
                      <div style={{fontSize:22,fontWeight:700,color:c.primary}}>
                        {offCPM != null ? `$${offCPM.toFixed(4)}` : '—'}
                      </div>
                    </div>
                    <div style={S.divider}/>
                    {op.audioInPerM != null ? (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                        {[
                          ['Audio in /M tok', `$${op.audioInPerM}`],
                          ['Audio out /M tok', `$${op.audioOutPerM}`],
                          ['Text in /M tok', `$${op.textInPerM}`],
                          ['Text out /M tok', `$${op.textOutPerM}`],
                          ['Audio in /min', op.officialPerMinIn != null ? `$${op.officialPerMinIn.toFixed(4)}` : '—'],
                          ['Audio out /min', op.officialPerMinOut != null ? `$${op.officialPerMinOut.toFixed(4)}` : '—'],
                        ].map(([l,v])=>(
                          <div key={l}>
                            <div style={{fontSize:10,color:'#4a5568',marginBottom:1}}>{l}</div>
                            <div style={{fontSize:12,fontWeight:500,color:'#94a3b8'}}>{v}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.6}}>
                        Flat-rate billing: <strong style={{color:'#f1f5f9'}}>${offCPM?.toFixed(2)}/min</strong><br/>
                        No separate token breakdown published.
                      </div>
                    )}
                    <div style={{marginTop:10}}>
                      <a href={op.pricingUrl} target="_blank" rel="noreferrer"
                        style={{fontSize:11,color:c.primary,textDecoration:'none'}}>
                        ↗ Official pricing page
                      </a>
                    </div>
                  </div>

                  {/* Your real cost from sessions */}
                  <div style={{...S.subCard, borderLeft:`2px solid ${c.primary}40`}}>
                    <div style={{fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Your real sessions</div>
                    {hasData ? (
                      <>
                        <div style={{marginBottom:8}}>
                          <div style={S.label}>Avg real $/min</div>
                          <div style={{fontSize:22,fontWeight:700,color: realCPM != null ? '#f1f5f9' : '#4a5568'}}>
                            {realCPM != null ? `$${realCPM.toFixed(4)}` : '—'}
                          </div>
                          {diff != null && (
                            <div className={diffClass} style={{fontSize:11,marginTop:3}}>
                              {diff > 0 ? `▲ ${diff.toFixed(1)}% above official` : `▼ ${Math.abs(diff).toFixed(1)}% below official`}
                            </div>
                          )}
                        </div>
                        <div style={S.divider}/>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          {[
                            ['Sessions', m.sessions.length],
                            ['Total spend', fmt$(m.cost.reduce((a,b)=>a+b,0))],
                            ['Min $/min', m.costPerMin.length ? `$${Math.min(...m.costPerMin).toFixed(4)}` : '—'],
                            ['Max $/min', m.costPerMin.length ? `$${Math.max(...m.costPerMin).toFixed(4)}` : '—'],
                            ['Avg tokens', avg(m.tokens)?.toLocaleString()||'—'],
                            ['Avg duration', m.durations.length ? `${Math.round(avg(m.durations))}s` : '—'],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:10,color:'#4a5568',marginBottom:1}}>{l}</div>
                              <div style={{fontSize:12,fontWeight:500,color:'#94a3b8'}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{fontSize:13,color:'#4a5568',padding:'16px 0',textAlign:'center'}}>
                        No session data yet.<br/>
                        <span style={{fontSize:11}}>Run sessions to see real costs here.</span>
                      </div>
                    )}
                  </div>

                  {/* Concurrency */}
                  <div style={S.subCard}>
                    <div style={{fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Concurrency</div>
                    <div style={{marginBottom:8}}>
                      <div style={S.label}>Max concurrent sessions</div>
                      <div style={{fontSize:28,fontWeight:700,color: op.concurrent ? c.primary : '#4a5568'}}>
                        {op.concurrent != null ? op.concurrent : '∞*'}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:'#64748b',lineHeight:1.6,marginTop:4}}>
                      {op.concurrentNote}
                    </div>
                    {op.concurrent != null && (
                      <>
                        <div style={S.divider}/>
                        <div>
                          <div style={S.label}>Utilisation estimate</div>
                          <div style={{height:6,background:'#1e2535',borderRadius:3,overflow:'hidden',margin:'4px 0 4px'}}>
                            <div style={{height:'100%',width:`${Math.min(100,(m?.sessions?.length||0)/op.concurrent*100)}%`,background:c.primary,borderRadius:3}}/>
                          </div>
                          <div style={{fontSize:11,color:'#4a5568'}}>
                            {m?.sessions?.length||0} / {op.concurrent} sessions in dataset
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Cost comparison bar */}
                {(realCPM != null || offCPM != null) && (
                  <div style={{marginTop:12,padding:'12px 14px',background:'rgba(255,255,255,0.02)',borderRadius:8,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{fontSize:11,color:'#4a5568',minWidth:90}}>Cost/min bar</div>
                    <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
                      {offCPM != null && (
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{fontSize:11,color:'#4a5568',width:80,flexShrink:0}}>Official</div>
                          <div style={{flex:1,height:8,background:'#1e2535',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(100,(offCPM/0.5)*100)}%`,background:'#374151',borderRadius:4}}/>
                          </div>
                          <div style={{fontSize:12,color:'#94a3b8',width:70,textAlign:'right'}}>${offCPM.toFixed(4)}</div>
                        </div>
                      )}
                      {realCPM != null && (
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{fontSize:11,color:'#4a5568',width:80,flexShrink:0}}>Your avg</div>
                          <div style={{flex:1,height:8,background:'#1e2535',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(100,(realCPM/0.5)*100)}%`,background:c.primary,borderRadius:4}}/>
                          </div>
                          <div style={{fontSize:12,color:c.primary,fontWeight:600,width:70,textAlign:'right'}}>${realCPM.toFixed(4)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ AVATARS SECTION ══ */}
      {activeSection === 'avatars' && (
        <div>
          <div style={S.sectionTitle}>Avatar pricing — official vs. your real sessions</div>
          {ALL_AVATARS.map(key => {
            const c  = AVATAR_COLORS[key]
            const ap = OFFICIAL_AVATAR_PRICING[key]
            const m  = byAvatar[key]
            const hasData = m && m.sessions.length > 0

            return (
              <div key={key} style={{...S.card, borderColor: hasData ? c.border : '#1e2535'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:38,height:38,borderRadius:10,background:c.bg,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:c.primary}}>
                      {AVATAR_LABELS[key][0]}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:'#f1f5f9'}}>{AVATAR_LABELS[key]}</div>
                      <div style={{fontSize:11,color:'#4a5568'}}>{ap.provider} · {ap.billingUnit}</div>
                    </div>
                  </div>
                  {hasData && <span style={S.tag(c.primary)}>{m.sessions.length} sessions</span>}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>

                  {/* Official */}
                  <div style={S.subCard}>
                    <div style={{fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Official pricing</div>
                    <div style={{marginBottom:8}}>
                      <div style={S.label}>Cost per minute</div>
                      <div style={{fontSize:22,fontWeight:700,color:c.primary}}>
                        {ap.officialPerMin != null ? `$${ap.officialPerMin.toFixed(4)}` : 'Custom'}
                      </div>
                    </div>
                    <div style={S.divider}/>
                    <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.6,marginBottom:8}}>
                      {ap.officialPerMinNote}
                    </div>
                    <div style={{fontSize:11,color:'#64748b',lineHeight:1.6}}>
                      <span style={{color:'#4a5568'}}>Free tier: </span>{ap.freeCredits}
                    </div>
                    <div style={{marginTop:10}}>
                      <a href={ap.pricingUrl} target="_blank" rel="noreferrer"
                        style={{fontSize:11,color:c.primary,textDecoration:'none'}}>↗ Pricing page</a>
                    </div>
                  </div>

                  {/* Your data */}
                  <div style={{...S.subCard, borderLeft:`2px solid ${c.primary}40`}}>
                    <div style={{fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Your sessions</div>
                    {hasData ? (
                      <>
                        <div style={{marginBottom:8}}>
                          <div style={S.label}>Total avatar cost</div>
                          <div style={{fontSize:22,fontWeight:700,color:m.cost.length ? c.primary : '#4a5568'}}>
                            {m.cost.length ? fmt$(m.cost.reduce((a,b)=>a+b,0)) : (ap.officialPerMin != null ? '—' : 'Custom')}
                          </div>
                          {m.cost.length > 0 && m.durations.length > 0 && (
                            <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
                              ${(m.cost.reduce((a,b)=>a+b,0) / (m.durations.reduce((a,b)=>a+b,0) / 60)).toFixed(4)}/min avg
                            </div>
                          )}
                        </div>
                        <div style={S.divider}/>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          {[
                            ['Sessions',      m.sessions.length],
                            ['Total minutes', m.durations.length ? `${(m.durations.reduce((a,b)=>a+b,0)/60).toFixed(1)} min` : '—'],
                            ['Avg G2G',       fmtMs(avg(m.g2g))],
                            ['Avg duration',  m.durations.length ? `${Math.round(avg(m.durations))}s` : '—'],
                            ['Min G2G',       m.g2g.length ? fmtMs(Math.min(...m.g2g)) : '—'],
                            ['Max G2G',       m.g2g.length ? fmtMs(Math.max(...m.g2g)) : '—'],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:10,color:'#4a5568',marginBottom:1}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:500,color:'#94a3b8'}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{fontSize:13,color:'#4a5568',padding:'16px 0',textAlign:'center'}}>
                        No session data yet.
                      </div>
                    )}
                  </div>

                  {/* Concurrency */}
                  <div style={S.subCard}>
                    <div style={{fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Concurrency</div>
                    <div style={{marginBottom:8}}>
                      <div style={S.label}>Max concurrent sessions</div>
                      <div style={{fontSize:28,fontWeight:700,color: ap.concurrent ? c.primary : '#4a5568'}}>
                        {ap.concurrent != null ? ap.concurrent : '∞*'}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:'#64748b',lineHeight:1.6,marginTop:4}}>
                      {ap.concurrentNote}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ COST BREAKDOWN SECTION ══ */}
      {activeSection === 'breakdown' && (
        <div>
          <div style={S.sectionTitle}>Cost breakdown · all models head-to-head</div>

          {/* Side-by-side comparison table */}
          <div style={{...S.card, padding:0, overflow:'hidden'}}>
            {/* Header */}
            <div style={{display:'grid',gridTemplateColumns:`180px repeat(${ALL_MODELS.length},1fr)`,background:'rgba(255,255,255,0.02)',borderBottom:'1px solid #1e2535'}}>
              <div style={{padding:'12px 16px',fontSize:11,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>Metric</div>
              {ALL_MODELS.map(key => {
                const c = MODEL_COLORS[key]
                return (
                  <div key={key} style={{padding:'12px 10px',fontSize:11,fontWeight:600,color:c.primary,background:c.bg,borderLeft:'1px solid #1e2535',textAlign:'center'}}>
                    {MODEL_LABELS[key]}
                  </div>
                )
              })}
            </div>

            {/* Rows */}
            {[
              { label: 'Provider',        fn: k => MODEL_PROVIDERS[k] },
              { label: 'Billing type',     fn: k => OFFICIAL_MODEL_PRICING[k]?.billingUnit || '—' },
              { label: 'Official $/min',   fn: k => {
                const p = OFFICIAL_MODEL_PRICING[k]?.officialPerMinBlended
                return p != null ? `$${p.toFixed(4)}` : '—'
              }},
              { label: 'Official audio in /M', fn: k => {
                const p = OFFICIAL_MODEL_PRICING[k]?.audioInPerM
                return p != null ? `$${p}` : 'flat'
              }},
              { label: 'Official audio out /M', fn: k => {
                const p = OFFICIAL_MODEL_PRICING[k]?.audioOutPerM
                return p != null ? `$${p}` : 'flat'
              }},
              { label: 'Your real $/min',  fn: k => {
                const v = realCostPerMin[k]
                return v != null ? `$${v.toFixed(4)}` : '—'
              }, highlight: true },
              { label: 'Diff vs official', fn: k => {
                const real = realCostPerMin[k]
                const off  = OFFICIAL_MODEL_PRICING[k]?.officialPerMinBlended
                if (real == null || off == null) return '—'
                const d = ((real - off) / off * 100)
                return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`
              }, diff: true },
              { label: 'Total spend',      fn: k => fmt$(totalSpend[k]) },
              { label: 'Sessions',         fn: k => byModel[k]?.sessions?.length || 0 },
              { label: 'Avg tokens/session', fn: k => {
                const v = avg(byModel[k]?.tokens)
                return v ? Math.round(v).toLocaleString() : '—'
              }},
              { label: 'Max concurrent',   fn: k => {
                const v = OFFICIAL_MODEL_PRICING[k]?.concurrent
                return v != null ? v : '∞*'
              }},
              { label: 'Concurrent note',  fn: k => OFFICIAL_MODEL_PRICING[k]?.concurrentNote || '—', wide: true },
            ].map((row, ri) => (
              <div key={row.label} style={{display:'grid',gridTemplateColumns:`180px repeat(${ALL_MODELS.length},1fr)`,borderBottom:'1px solid #0a0f1a',background:ri%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                <div style={{padding:'10px 16px',fontSize:12,color:'#64748b',display:'flex',alignItems:'center'}}>{row.label}</div>
                {ALL_MODELS.map(key => {
                  const c = MODEL_COLORS[key]
                  const val = row.fn(key)
                  let color = '#f1f5f9'
                  if (row.diff) {
                    if (val === '—') color = '#4a5568'
                    else if (val.startsWith('+')) color = '#f87171'
                    else color = '#10b981'
                  }
                  if (row.highlight) color = c.primary
                  return (
                    <div key={key} style={{padding:'10px 10px',fontSize:row.wide?10:12,fontWeight:row.highlight?600:400,color,borderLeft:'1px solid #0f1624',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {val}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Avatar comparison table */}
          <div style={{...S.sectionTitle, marginTop:28}}>Avatar providers head-to-head</div>
          <div style={{...S.card, padding:0, overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:`180px repeat(3,1fr)`,background:'rgba(255,255,255,0.02)',borderBottom:'1px solid #1e2535'}}>
              <div style={{padding:'12px 16px',fontSize:11,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>Metric</div>
              {ALL_AVATARS.map(key => {
                const c = AVATAR_COLORS[key]
                return (
                  <div key={key} style={{padding:'12px 10px',fontSize:11,fontWeight:600,color:c.primary,background:c.bg,borderLeft:'1px solid #1e2535',textAlign:'center'}}>
                    {AVATAR_LABELS[key]}
                  </div>
                )
              })}
            </div>
            {[
              { label: 'Provider',       fn: k => OFFICIAL_AVATAR_PRICING[k]?.provider },
              { label: 'Official $/min', fn: k => {
                const v = OFFICIAL_AVATAR_PRICING[k]?.officialPerMin
                return v != null ? `$${v.toFixed(4)}/min` : 'Custom'
              }, highlight: true },
              { label: 'Billing unit',   fn: k => OFFICIAL_AVATAR_PRICING[k]?.billingUnit },
              { label: 'Free credits',   fn: k => OFFICIAL_AVATAR_PRICING[k]?.freeCredits },
              { label: 'Max concurrent', fn: k => {
                const v = OFFICIAL_AVATAR_PRICING[k]?.concurrent
                return v != null ? v : '∞*'
              }},
              { label: 'Sessions in data', fn: k => byAvatar[k]?.sessions?.length || 0 },
            ].map((row, ri) => (
              <div key={row.label} style={{display:'grid',gridTemplateColumns:`180px repeat(3,1fr)`,borderBottom:'1px solid #0a0f1a',background:ri%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                <div style={{padding:'10px 16px',fontSize:12,color:'#64748b',display:'flex',alignItems:'center'}}>{row.label}</div>
                {ALL_AVATARS.map(key => {
                  const c = AVATAR_COLORS[key]
                  const val = row.fn(key)
                  return (
                    <div key={key} style={{padding:'10px 10px',fontSize:12,fontWeight:row.highlight?600:400,color:row.highlight?c.primary:'#f1f5f9',borderLeft:'1px solid #0f1624',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {val}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Cost legend note */}
          <div style={{marginTop:16,padding:'12px 16px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.15)',borderRadius:10}}>
            <div style={{fontSize:11,color:'#d97706',fontWeight:600,marginBottom:4}}>Note on "∞*" concurrency</div>
            <div style={{fontSize:12,color:'#92400e',lineHeight:1.6}}>
              Ultravox and Grok Voice advertise "no hard concurrency caps" on paid plans. This means they scale with demand
              but may still be subject to fair-use limits and SLA agreements. Simli is GPU-backed and scales on demand.
              Always confirm enterprise concurrency with the provider before production rollout.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Existing sub-components (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function LatencyBar({ values, color }) {
  if (!values.length) return null
  const mn = Math.min(...values), mx = Math.max(...values), av = avg(values)
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#4a5568',marginBottom:4}}>
        <span>min {mn}ms</span><span>avg {Math.round(av)}ms</span><span>max {mx}ms</span>
      </div>
      <div style={{height:4,background:'#1e2535',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${Math.min(100,(av||0)/600*100)}%`,background:color,borderRadius:2}}/>
      </div>
    </div>
  )
}

function TimelineChart({ sessions }) {
  const byModel = {}
  sessions.forEach((s,i) => {
    if (!s.glass_to_glass_avg_ms) return
    if (!byModel[s.model_key]) byModel[s.model_key] = []
    byModel[s.model_key].push({ x: i, y: s.glass_to_glass_avg_ms, s })
  })
  const maxY = Math.max(...sessions.map(s=>s.glass_to_glass_avg_ms||0)) * 1.2 || 500
  const W = 800, H = 140, PL = 40, PR = 20, PT = 10, PB = 30

  return (
    <svg viewBox={`0 0 ${W} ${H+PT+PB}`} style={{width:'100%',overflow:'visible'}}>
      {[0,0.25,0.5,0.75,1].map(t=>{
        const y = PT + H - t*H
        return <g key={t}>
          <line x1={PL} x2={W-PR} y1={y} y2={y} stroke="#1e2535" strokeWidth="0.5"/>
          <text x={PL-6} y={y+4} fill="#4a5568" fontSize="9" textAnchor="end">{Math.round(t*maxY)}</text>
        </g>
      })}
      {Object.entries(byModel).map(([key, pts])=>{
        const c = MODEL_COLORS[key]?.primary || '#6366f1'
        const n = sessions.length - 1 || 1
        const path = pts.map((p,i)=>{
          const x = PL + (p.x/n)*(W-PL-PR)
          const y = PT + H - (p.y/maxY)*H
          return `${i===0?'M':'L'} ${x} ${y}`
        }).join(' ')
        return <g key={key}>
          <path d={path} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {pts.map((p,i)=>{
            const x = PL + (p.x/n)*(W-PL-PR)
            const y = PT + H - (p.y/maxY)*H
            return <circle key={i} cx={x} cy={y} r="3" fill={c}/>
          })}
        </g>
      })}
      <line x1={PL} x2={PL} y1={PT} y2={PT+H} stroke="#1e2535" strokeWidth="0.5"/>
      <line x1={PL} x2={W-PR} y1={PT+H} y2={PT+H} stroke="#1e2535" strokeWidth="0.5"/>
    </svg>
  )
}

function BarChart({ byModel }) {
  const models = ALL_MODELS.filter(k => byModel[k] && byModel[k].g2g.length)
  if (!models.length) return <div style={{color:'#4a5568',fontSize:13,textAlign:'center',padding:20}}>No data yet</div>
  const maxVal = Math.max(...models.map(k => Math.max(...byModel[k].g2g))) * 1.2
  const W = 700, H = 160, barW = 60, gap = 40

  return (
    <svg viewBox={`0 0 ${W} ${H+60}`} style={{width:'100%'}}>
      {models.map((key,i) => {
        const m = byModel[key]
        const c = MODEL_COLORS[key]?.primary || '#6366f1'
        const x = 60 + i*(barW+gap)
        const [mn,av,mx] = [Math.min(...m.g2g), avg(m.g2g)||0, Math.max(...m.g2g)]
        const barH = (av/maxVal)*H
        const mnY = H - (mn/maxVal)*H
        const mxY = H - (mx/maxVal)*H
        return (
          <g key={key}>
            <line x1={x+barW/2} x2={x+barW/2} y1={mxY} y2={mnY} stroke={c} strokeWidth="2" strokeDasharray="3,2" opacity="0.4"/>
            <rect x={x} y={H-barH} width={barW} height={barH} rx="6" fill={c} opacity="0.8"/>
            <text x={x+barW/2} y={H-barH-6} fill={c} fontSize="11" fontWeight="600" textAnchor="middle">{Math.round(av)}ms</text>
            <text x={x+barW/2} y={H+28} fill="#4a5568" fontSize="9" textAnchor="middle">{m.sessions.length} sessions</text>
          </g>
        )
      })}
      <line x1={40} x2={W-20} y1={H} y2={H} stroke="#1e2535" strokeWidth="0.5"/>
    </svg>
  )
}

function ComparisonTable({ byModel }) {
  const models = ALL_MODELS.filter(k => byModel[k]?.sessions?.length > 0)
  const rows = [
    { label: 'Sessions',          fn: m => m.sessions.length },
    { label: 'Avg G2G latency',   fn: m => fmtMs(avg(m.g2g)), best: 'min' },
    { label: 'Min G2G',           fn: m => m.g2g.length ? fmtMs(Math.min(...m.g2g)) : '—', best: 'min' },
    { label: 'Max G2G',           fn: m => m.g2g.length ? fmtMs(Math.max(...m.g2g)) : '—', best: 'min' },
    { label: 'Avg session cost',  fn: m => fmt$(avg(m.cost)), best: 'min' },
    { label: 'Total cost',        fn: m => fmt$(m.cost.reduce((a,b)=>a+b,0)||null) },
    { label: 'Avg tokens',        fn: m => avg(m.tokens)?.toLocaleString() || '—', best: 'min' },
    { label: 'Avg duration',      fn: m => m.durations.length ? `${Math.round(avg(m.durations))}s` : '—' },
  ]

  return (
    <div style={{background:'#0d1117',border:'1px solid #1e2535',borderRadius:14,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:`200px ${models.map(()=>'1fr').join(' ')}`,borderBottom:'1px solid #1e2535'}}>
        <div style={{padding:'12px 16px',fontSize:11,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>Metric</div>
        {models.map(key => {
          const c = MODEL_COLORS[key] || {}
          return (
            <div key={key} style={{padding:'12px 16px',fontSize:12,fontWeight:600,color:c.primary||'#e2e8f0',background:c.bg||'rgba(255,255,255,0.02)',borderLeft:'1px solid #1e2535',textAlign:'center'}}>
              {MODEL_LABELS[key] || key}
            </div>
          )
        })}
      </div>
      {rows.map((row,ri) => (
        <div key={row.label} style={{display:'grid',gridTemplateColumns:`200px ${models.map(()=>'1fr').join(' ')}`,borderBottom:'1px solid #0f1624',background:ri%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
          <div style={{padding:'11px 16px',fontSize:12,color:'#64748b'}}>{row.label}</div>
          {models.map(key => {
            const m = byModel[key]
            const val = row.fn(m)
            return <div key={key} style={{padding:'11px 16px',fontSize:13,fontWeight:500,color:'#f1f5f9',borderLeft:'1px solid #0f1624',textAlign:'center'}}>{val}</div>
          })}
        </div>
      ))}
    </div>
  )
}

function SessionTable({ sessions, onSelect, compact }) {
  return (
    <div style={{background:'#0d1117',border:'1px solid #1e2535',borderRadius:12,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.5fr',padding:'10px 16px',background:'rgba(255,255,255,0.02)',fontSize:10,color:'#4a5568',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5,gap:8,borderBottom:'1px solid #1e2535'}}>
        <div>Student</div><div>Model</div><div>Avatar</div><div>Topic</div>
        <div style={{textAlign:'right'}}>G2G avg</div>
        <div style={{textAlign:'right'}}>Tokens</div>
        <div style={{textAlign:'right'}}>Cost</div>
        <div></div>
      </div>
      {sessions.length === 0 && (
        <div style={{padding:'32px',textAlign:'center',color:'#4a5568',fontSize:13}}>
          No sessions. <a href="/" style={{color:'#6366f1'}}>Start your first →</a>
        </div>
      )}
      {sessions.map((s,i) => {
        const c = MODEL_COLORS[s.model_key] || MODEL_COLORS['gpt-4o-realtime-mini']
        const g2g = s.glass_to_glass_avg_ms
        const g2gColor = !g2g ? '#4a5568' : g2g < 150 ? '#10b981' : g2g < 300 ? '#f59e0b' : '#f87171'
        return (
          <div key={s.session_id} style={{display:'grid',gridTemplateColumns:'1.5fr 1.8fr 1fr 1fr 1fr 1fr 1fr 0.6fr',padding:'12px 16px',borderBottom:'1px solid #0a0f1a',alignItems:'center',gap:8,background:i%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
            <div>
              <div style={{fontSize:13,color:'#f1f5f9',fontWeight:500}}>{s.student?.student_name||'—'}</div>
              <div style={{fontSize:11,color:'#4a5568'}}>{s.student?.level} → Band {s.student?.target_band}</div>
            </div>
            <div>
              <span style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:8,background:c.bg,color:c.primary,border:`1px solid ${c.border}`}}>
                {MODEL_LABELS[s.model_key] || s.model_key}
              </span>
            </div>
            <div style={{fontSize:12,color:'#94a3b8'}}>{s.avatar || s.avatar_key || '—'}</div>
            <div style={{fontSize:12,color:'#94a3b8'}}>{s.student?.topic||'—'}</div>
            <div style={{fontSize:13,fontWeight:600,color:g2gColor,textAlign:'right'}}>{g2g?`${g2g}ms`:'—'}</div>
            <div style={{fontSize:12,color:'#64748b',textAlign:'right'}}>{s.total_tokens?.toLocaleString()||'—'}</div>
            <div style={{fontSize:12,color:'#64748b',textAlign:'right'}}>{fmt$(s.total_cost_usd)}</div>
            <div style={{textAlign:'right'}}>
              <button onClick={()=>onSelect(s)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${c.border}`,background:c.bg,color:c.primary,cursor:'pointer'}}>View</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SessionPanel({ session: s, onClose }) {
  const c = MODEL_COLORS[s.model_key] || MODEL_COLORS['gpt-4o-realtime-mini']
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:100,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:700,background:'#0d1117',borderLeft:'1px solid #1e2535',display:'flex',flexDirection:'column',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'18px 20px',borderBottom:'1px solid #1e2535',display:'flex',justifyContent:'space-between',alignItems:'flex-start',position:'sticky',top:0,background:'#0d1117',zIndex:10}}>
          <div>
            <div style={{fontSize:11,color:'#4a5568',marginTop:3}}>{s.session_id} · {s.timestamp?.slice(0,19).replace('T',' ')} · {s.student?.topic}</div>
          </div>
          <button onClick={onClose} style={{background:'#1e2535',border:'none',color:'#94a3b8',width:28,height:28,borderRadius:6,cursor:'pointer',fontSize:14}}>✕</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,padding:'16px 20px',borderBottom:'1px solid #1e2535'}}>
          {[
            ['G2G avg', `${s.glass_to_glass_avg_ms||'—'}ms`, s.glass_to_glass_avg_ms < 200 ? '#10b981' : '#f59e0b'],
            ['G2G min/max', `${s.glass_to_glass_min_ms||'—'} / ${s.glass_to_glass_max_ms||'—'}ms`, null],
            ['Duration', `${s.session_duration_seconds}s`, null],
            ['Total tokens', s.total_tokens?.toLocaleString()||'—', null],
            ['Total cost', fmt$(s.total_cost_usd), null],
            ['Turns', s.total_turns, null],
          ].map(([l,v,color])=>(
            <div key={l} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:'#4a5568',marginBottom:3}}>{l}</div>
              <div style={{fontSize:16,fontWeight:500,color:color||'#f1f5f9'}}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{padding:'14px 20px',borderBottom:'1px solid #1e2535'}}>
          <div style={{fontSize:10,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>Token breakdown</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[['Audio in',s.total_input_audio_tokens],['Audio out',s.total_output_audio_tokens],['Text in',s.total_input_text_tokens],['Text out',s.total_output_text_tokens]].map(([l,v])=>(
              <div key={l} style={{background:'rgba(255,255,255,0.02)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,color:'#4a5568',marginBottom:3}}>{l}</div>
                <div style={{fontSize:14,fontWeight:500,color:'#f1f5f9'}}>{v?.toLocaleString()||'0'}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:'12px 20px',borderBottom:'1px solid #1e2535',display:'flex',gap:16,flexWrap:'wrap'}}>
          {Object.entries(s.pricing_used||{}).map(([k,v])=>(
            <div key={k} style={{fontSize:11,color:'#4a5568'}}>{k.replace(/_/g,' ')}: <span style={{color:'#94a3b8'}}>${v}/M</span></div>
          ))}
        </div>

        <div style={{padding:'14px 20px',flex:1}}>
          <div style={{fontSize:10,color:'#4a5568',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:14}}>
            Q&A Transcript ({s.transcript?.length||0} turns)
          </div>
          {(!s.transcript || s.transcript.length === 0) ? (
            <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8,padding:'12px 16px',fontSize:13,color:'#d97706'}}>
              No transcript captured.
            </div>
          ) : (
            s.transcript.map((t,i)=>(
              <div key={i} style={{marginBottom:16,background:'rgba(255,255,255,0.02)',borderRadius:10,overflow:'hidden'}}>
                <div style={{padding:'8px 14px',background:'rgba(255,255,255,0.03)',borderBottom:'1px solid #1e2535',display:'flex',justifyContent:'space-between',fontSize:11}}>
                  <span style={{color:c.primary,fontWeight:600}}>Turn {t.turn}</span>
                  <span style={{color:'#4a5568'}}>{t.g2g_ms}ms · ${t.cost_usd?.toFixed(6)||'0'} · {t.audio_tokens_in}/{t.audio_tokens_out} audio tk</span>
                </div>
                {t.user && (
                  <div style={{padding:'10px 14px',borderBottom:'1px solid #1e2535'}}>
                    <div style={{fontSize:10,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Student answer</div>
                    <div style={{fontSize:13,color:'#cbd5e1',lineHeight:1.6}}>{t.user}</div>
                  </div>
                )}
                {t.agent && (
                  <div style={{padding:'10px 14px'}}>
                    <div style={{fontSize:10,color:c.primary,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Sarah</div>
                    <div style={{fontSize:13,color:'#a5b4fc',lineHeight:1.6}}>{t.agent}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{padding:'12px 20px',borderTop:'1px solid #1e2535',display:'flex',gap:8,position:'sticky',bottom:0,background:'#0d1117'}}>
          <button onClick={()=>exportSession(s)} style={{fontSize:12,padding:'7px 14px',borderRadius:8,border:'1px solid #1e2535',background:'#060a14',color:'#94a3b8',cursor:'pointer'}}>Export JSON</button>
          <button onClick={()=>copyNotion(s)} style={{fontSize:12,padding:'7px 14px',borderRadius:8,border:'1px solid #1e2535',background:'#060a14',color:'#94a3b8',cursor:'pointer'}}>Copy for Notion</button>
        </div>
      </div>
    </div>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function exportCSV(sessions) {
  const rows = [
    ['session_id','model','student','level','target_band','topic','g2g_avg_ms','g2g_min_ms','g2g_max_ms','total_tokens','total_cost_usd','duration_s','timestamp'],
    ...sessions.map(s=>[s.session_id,s.model_key,s.student?.student_name,s.student?.level,s.student?.target_band,s.student?.topic,s.glass_to_glass_avg_ms,s.glass_to_glass_min_ms,s.glass_to_glass_max_ms,s.total_tokens,s.total_cost_usd,s.session_duration_seconds,s.timestamp])
  ]
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'))
  a.download = `kassel_benchmark_${Date.now()}.csv`
  a.click()
}

function exportSession(s) {
  const a = document.createElement('a')
  a.href = 'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(s,null,2))
  a.download = `session_${s.session_id}.json`
  a.click()
}

function copyNotion(s) {
  const t = `**Date:** ${s.timestamp?.slice(0,10)}  |  **Session:** \`${s.session_id}\`\n\n| Metric | Value |\n|---|---|\n| G2G avg | ${s.glass_to_glass_avg_ms}ms |\n| Total tokens | ${s.total_tokens?.toLocaleString()} |\n| Total cost | $${s.total_cost_usd?.toFixed(6)} |\n| Duration | ${s.session_duration_seconds}s |\n| Turns | ${s.total_turns} |`
  navigator.clipboard.writeText(t).then(()=>alert('Copied — paste into Notion'))
}

function avg(arr) {
  const nums = (arr || []).filter(v => typeof v === 'number' && !isNaN(v))
  if (!nums.length) return null
  return nums.reduce((a,b)=>a+b,0) / nums.length
}

function fmtMs(v) {
  if (v == null || isNaN(v)) return '—'
  return `${Math.round(v)}ms`
}

function fmt$(v) {
  if (!v || isNaN(v)) return '$0.000000'
  return `$${v.toFixed(6)}`
}