import React, { useState } from 'react'

const TOPICS = [
  'Technology', 'Education', 'Environment', 'Health',
  'Travel', 'Work & Career', 'Society & Culture', 'Family & Relationships'
]
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const BANDS  = ['4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0']

const MODELS = [
  { key: 'gpt-4o-realtime-mini',  label: 'GPT-4o Mini',     provider: 'OpenAI',   badge: 'Fastest',       color: '#6366f1', desc: '$10/M audio · Low latency' },
  { key: 'gpt-4o-realtime',       label: 'GPT-4o Full',     provider: 'OpenAI',   badge: 'Best Quality',  color: '#10b981', desc: '$40/M audio · Highest accuracy' },
  { key: 'gemini-2.0-flash-live', label: 'Gemini 2.0 Live', provider: 'Google',   badge: '14x Cheaper',   color: '#f59e0b', desc: '$0.70/M audio · Native S2S' },
  { key: 'ultravox',              label: 'Ultravox 70B',    provider: 'Fixie AI', badge: '$0.05/min',     color: '#ec4899', desc: 'Open-weight S2S · Flat rate' },
  { key: 'phonic',                label: 'Phonic S2S',      provider: 'Phonic',   badge: 'New',           color: '#8b5cf6', desc: 'Native S2S · aiavatar project' },
  { key: 'xai-grok',             label: 'Grok Voice',       provider: 'xAI',      badge: 'Beta Only',     color: '#6b7280', desc: 'Eve voice · Awaiting realtime access', disabled: true },
]

const AVATARS = [
  { key: 'simli',    label: 'Simli',    badge: 'Current',       color: '#6366f1', desc: 'Fast lip-sync · Low latency' },
  { key: 'tavus',    label: 'Tavus',    badge: 'Photoreal',     color: '#10b981', desc: 'Phoenix-3 · Emotion-aware' },
  { key: 'keyframe', label: 'Keyframe', badge: '$0.06/min',     color: '#f59e0b', desc: 'persona-1.5-live · Expressive' },
]

export default function IntakeForm({ onStart }) {
  const [form, setForm] = useState({
    name: '', level: '', targetBand: '', topic: '',
    model: 'gpt-4o-realtime-mini', avatar: 'simli',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim())  e.name = 'Please enter your name'
    if (!form.level)        e.level = 'Please select your current level'
    if (!form.targetBand)   e.targetBand = 'Please select your target band'
    if (!form.topic)        e.topic = 'Please choose a topic'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleStart() {
    if (!onStart) return
    if (validate()) onStart(form)
  }

  const selModel  = MODELS.find(m => m.key === form.model)
  const selAvatar = AVATARS.find(a => a.key === form.avatar)

  return (
    <div style={S.page}>
      <style>{`
        select option { background: #0d1020; color: #f1f5f9; }
        select { color-scheme: dark; }
      `}</style>
      <div style={S.grid} />

      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoMark}>K</div>
          <div>
            <div style={S.logoName}>Kassel Academy</div>
            <div style={S.logoSub}>IELTS Speaking · AI Benchmark</div>
          </div>
        </div>
        <a href="/dashboard" style={S.dashLink}>View Dashboard →</a>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>Start your session</div>
          <div style={S.cardSub}>All sessions use the same 5 fixed questions per topic for fair model comparison</div>
        </div>

        <div style={S.form}>
          {/* Name */}
          <div style={S.field}>
            <label style={S.label}>Your name</label>
            <input style={{ ...S.input, ...(errors.name ? S.inputErr : {}) }}
              placeholder="e.g. Rama" value={form.name}
              onChange={e => set('name', e.target.value)} />
            {errors.name && <div style={S.err}>{errors.name}</div>}
          </div>

          {/* Level + Band */}
          <div style={S.row}>
            <div style={{ ...S.field, flex: 1 }}>
              <label style={S.label}>Current level</label>
              <div style={S.pills}>
                {LEVELS.map(l => (
                  <button key={l} style={{ ...S.pill, ...(form.level === l ? S.pillOn : {}) }}
                    onClick={() => set('level', l)}>{l}</button>
                ))}
              </div>
              {errors.level && <div style={S.err}>{errors.level}</div>}
            </div>
            <div style={{ ...S.field, flex: 1 }}>
              <label style={S.label}>Target band score</label>
              <select style={{ ...S.select, ...(errors.targetBand ? S.inputErr : {}) }}
                value={form.targetBand} onChange={e => set('targetBand', e.target.value)}>
                <option value="">Select band...</option>
                {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {errors.targetBand && <div style={S.err}>{errors.targetBand}</div>}
            </div>
          </div>

          {/* Topic */}
          <div style={S.field}>
            <label style={S.label}>Practice topic <span style={S.hint}>(same 5 fixed questions per topic)</span></label>
            <div style={S.topicGrid}>
              {TOPICS.map(t => (
                <button key={t} style={{ ...S.topicBtn, ...(form.topic === t ? S.topicOn : {}) }}
                  onClick={() => set('topic', t)}>{t}</button>
              ))}
            </div>
            {errors.topic && <div style={S.err}>{errors.topic}</div>}
          </div>

          {/* Model selector */}
          <div style={S.field}>
            <label style={S.label}>S2S Model</label>
            <div style={S.cardGrid}>
              {MODELS.map(m => (
                <button key={m.key}
                  disabled={m.disabled}
                  style={{ ...S.selCard, ...(form.model === m.key ? { ...S.selCardOn, borderColor: m.color + '60', background: m.color + '12' } : {}), ...(m.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                  onClick={() => !m.disabled && set('model', m.key)}>
                  <div style={S.selTop}>
                    <div style={S.selLabel}>{m.label}</div>
                    <div style={{ ...S.selBadge, background: m.color + '20', color: m.color, border: `1px solid ${m.color}40` }}>{m.badge}</div>
                  </div>
                  <div style={S.selProvider}>{m.provider}</div>
                  <div style={S.selDesc}>{m.desc}</div>
                  {form.model === m.key && <div style={{ ...S.selCheck, background: m.color }}>✓</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar selector */}
          <div style={S.field}>
            <label style={S.label}>Avatar</label>
            <div style={{ ...S.cardGrid, gridTemplateColumns: 'repeat(3,1fr)' }}>
              {AVATARS.map(a => (
                <button key={a.key}
                  style={{ ...S.selCard, ...(form.avatar === a.key ? { ...S.selCardOn, borderColor: a.color + '60', background: a.color + '12' } : {}) }}
                  onClick={() => set('avatar', a.key)}>
                  <div style={S.selTop}>
                    <div style={S.selLabel}>{a.label}</div>
                    <div style={{ ...S.selBadge, background: a.color + '20', color: a.color, border: `1px solid ${a.color}40` }}>{a.badge}</div>
                  </div>
                  <div style={S.selDesc}>{a.desc}</div>
                  {form.avatar === a.key && <div style={{ ...S.selCheck, background: a.color }}>✓</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {form.name && form.level && form.targetBand && form.topic && (
            <div style={S.preview}>
              <div style={S.previewLabel}>Session preview</div>
              <div style={S.previewText}>
                <strong>{form.name}</strong> ({form.level} → Band {form.targetBand}) · 5 fixed questions on{' '}
                <strong>{form.topic}</strong> · Model:{' '}
                <strong style={{ color: selModel?.color }}>{selModel?.label}</strong> · Avatar:{' '}
                <strong style={{ color: selAvatar?.color }}>{selAvatar?.label}</strong>
              </div>
            </div>
          )}

       <button style={S.startBtn} onClick={handleStart}>
            <span>Start with {selModel?.label} + {selAvatar?.label}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={S.fairNote}>Fixed question bank · Same 5 questions for all models · Full Q&A + latency + cost logging</div>
        </div>
      </div>
      <div style={S.footer}>OpenAI · Gemini · Ultravox · Simli · Tavus · Keyframe · LiveKit Cloud</div>
    </div>
  )
}

const S = {
  page: { minHeight:'100vh', background:'#080c18', display:'flex', flexDirection:'column', alignItems:'center', padding:'0 16px 40px', position:'relative', overflow:'hidden' },
  grid: { position:'absolute', inset:0, zIndex:0, backgroundImage:`linear-gradient(rgba(99,102,241,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.05) 1px,transparent 1px)`, backgroundSize:'40px 40px' },
  header: { width:'100%', maxWidth:760, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'24px 0 28px', position:'relative', zIndex:1 },
  logo: { display:'flex', alignItems:'center', gap:12 },
  logoMark: { width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff' },
  logoName: { fontSize:15, fontWeight:600, color:'#f1f5f9' },
  logoSub: { fontSize:11, color:'#64748b', marginTop:1 },
  dashLink: { fontSize:12, color:'#6366f1', textDecoration:'none', padding:'6px 14px', border:'1px solid rgba(99,102,241,0.3)', borderRadius:20 },
  card: { width:'100%', maxWidth:760, background:'rgba(15,20,40,0.85)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:20, overflow:'hidden', position:'relative', zIndex:1 },
  cardHeader: { padding:'22px 28px 16px', borderBottom:'1px solid rgba(99,102,241,0.1)', background:'rgba(99,102,241,0.04)' },
  cardTitle: { fontSize:20, fontWeight:600, color:'#f1f5f9', marginBottom:5 },
  cardSub: { fontSize:12, color:'#64748b' },
  form: { padding:'22px 28px', display:'flex', flexDirection:'column', gap:20 },
  field: { display:'flex', flexDirection:'column', gap:8 },
  row: { display:'flex', gap:20 },
  label: { fontSize:13, fontWeight:500, color:'#94a3b8' },
  hint: { fontWeight:400, color:'#475569' },
  input: { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 14px', fontSize:14, color:'#f1f5f9', outline:'none', width:'100%' },
  inputErr: { borderColor:'rgba(239,68,68,0.5)' },
  select: { background:'#0d1020', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 14px', fontSize:14, color:'#f1f5f9', outline:'none', width:'100%', cursor:'pointer' },
  err: { fontSize:12, color:'#f87171', marginTop:-4 },
  pills: { display:'flex', gap:7, flexWrap:'wrap' },
  pill: { padding:'6px 14px', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#94a3b8', fontSize:13, fontWeight:500, cursor:'pointer' },
  pillOn: { background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.5)', color:'#818cf8' },
  topicGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 },
  topicBtn: { padding:'9px 14px', borderRadius:10, textAlign:'left', border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', color:'#94a3b8', fontSize:13, cursor:'pointer' },
  topicOn: { background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', color:'#a5b4fc' },
  cardGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 },
  selCard: { padding:'12px 14px', borderRadius:12, textAlign:'left', border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.02)', cursor:'pointer', position:'relative', transition:'all 0.15s' },
  selCardOn: { },
  selTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4, marginBottom:3 },
  selLabel: { fontSize:12, fontWeight:600, color:'#f1f5f9' },
  selBadge: { fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:6, whiteSpace:'nowrap' },
  selProvider: { fontSize:10, color:'#64748b', marginBottom:4 },
  selDesc: { fontSize:10, color:'#475569', lineHeight:1.5 },
  selCheck: { position:'absolute', top:8, right:8, width:16, height:16, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 },
  preview: { background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:12, padding:'12px 16px' },
  previewLabel: { fontSize:11, fontWeight:600, color:'#6366f1', marginBottom:6, letterSpacing:1, textTransform:'uppercase' },
  previewText: { fontSize:13, color:'#94a3b8', lineHeight:1.6 },
  startBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:12, background:'linear-gradient(135deg,#6366f1,#4f46e5)', border:'none', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 },
  fairNote: { textAlign:'center', fontSize:11, color:'#334155' },
  footer: { marginTop:20, fontSize:11, color:'#334155', position:'relative', zIndex:1 },
}