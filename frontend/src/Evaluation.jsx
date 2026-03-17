import React, { useState } from 'react'

const BAND_DESCRIPTIONS = {
  9: 'Expert user',
  8: 'Very good user',
  7: 'Good user',
  6: 'Competent user',
  5: 'Modest user',
  4: 'Limited user',
  3: 'Extremely limited',
  2: 'Intermittent',
  1: 'Non-user',
}

const CRITERIA_INFO = {
  fluency: {
    label: 'Fluency & Coherence',
    desc: 'How naturally and logically speech flows',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
  },
  lexical: {
    label: 'Lexical Resource',
    desc: 'Range and accuracy of vocabulary',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
  },
  grammar: {
    label: 'Grammatical Range & Accuracy',
    desc: 'Range and accuracy of grammatical structures',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
  },
  pronunciation: {
    label: 'Pronunciation',
    desc: 'Clarity and naturalness of pronunciation',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
  },
}

const MODEL_LABELS = {
  'gpt-4o-realtime-mini':  'GPT-4o Mini',
  'gpt-4o-realtime':       'GPT-4o Full',
  'gemini-2.0-flash-live': 'Gemini 2.0 Live',
  'ultravox':              'Ultravox 70B',
  'xai-grok':              'Grok Voice',
  'phonic':                'Phonic S2S',
}

// Evaluation always uses OpenAI gpt-4o-mini — same API key, ~$0.0005/eval
const EVAL_MODEL_MAP = {
  'gpt-4o-realtime-mini':  { provider: 'openai', model: 'gpt-4o-mini' },
  'gpt-4o-realtime':       { provider: 'openai', model: 'gpt-4o-mini' },
  'gemini-2.0-flash-live': { provider: 'openai', model: 'gpt-4o-mini' },
  'ultravox':              { provider: 'openai', model: 'gpt-4o-mini' },
  'xai-grok':              { provider: 'openai', model: 'gpt-4o-mini' },
  'phonic':                { provider: 'openai', model: 'gpt-4o-mini' },
}

export default function Evaluation({ transcript, studentInfo, model, onClose }) {
  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [evalModel, setEvalModel]   = useState(null)

  async function runEvaluation() {
    setLoading(true)
    setError(null)

    try {
      const transcriptText = (transcript || [])
        .map(t => `Turn ${t.turn}:\nStudent: ${t.user || '[no response]'}\nExaminer: ${t.agent || ''}`)
        .join('\n\n')

      const prompt = `You are an expert IELTS examiner. Evaluate the following student responses from an IELTS Speaking practice session.

Student: ${studentInfo?.student_name || 'Unknown'}
Current Level: ${studentInfo?.level || 'Unknown'}
Target Band: ${studentInfo?.target_band || 'Unknown'}
Topic: ${studentInfo?.topic || 'Unknown'}

Full conversation transcript:
${transcriptText}

Provide a detailed IELTS evaluation. Respond ONLY with a valid JSON object, no markdown, no code blocks, no explanation, just raw JSON:
{
  "overall_band": <number 1-9, can be .5>,
  "fluency_band": <number 1-9, can be .5>,
  "lexical_band": <number 1-9, can be .5>,
  "grammar_band": <number 1-9, can be .5>,
  "pronunciation_band": <number 1-9, can be .5>,
  "fluency_comment": "<1-2 sentence specific comment on their fluency>",
  "lexical_comment": "<1-2 sentence specific comment on their vocabulary>",
  "grammar_comment": "<1-2 sentence specific comment on their grammar>",
  "pronunciation_comment": "<1-2 sentence comment on pronunciation based on transcript patterns>",
  "strengths": "<one key strength observed>",
  "improvement_tip_1": "<most important improvement tip>",
  "improvement_tip_2": "<second improvement tip>",
  "improvement_tip_3": "<third improvement tip>",
  "encouragement": "<one short encouraging sentence personalised to their level and target>"
}`

      const TOKEN_SERVER = import.meta.env.VITE_TOKEN_SERVER || 'http://localhost:8080'

      // Use Gemini 2.0 Flash — free tier, no quota issues, ~$0.0004/eval in production
      const chosen = EVAL_MODEL_MAP[model] || { provider: 'gemini', model: 'gemini-2.0-flash' }
      setEvalModel(chosen.model)

      const response = await fetch(`${TOKEN_SERVER}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: chosen.provider,
          model:    chosen.model,
          prompt:   prompt,
        }),
      })

      const rawText = await response.text()

      if (!rawText || rawText.trim() === '') {
        throw new Error('Empty response from evaluation server')
      }
      if (!response.ok) {
        throw new Error(`Server error ${response.status}: ${rawText.slice(0, 300)}`)
      }

      // Parse outer server response
      let text = ''
      try {
        const data = JSON.parse(rawText)
        // Support both { text: '...' } and { content: [{ text: '...' }] }
        text = data.text || data.content?.[0]?.text || rawText
        // Read actual eval model from server response (not frontend guess)
        if (data.eval_model) setEvalModel(data.eval_model)
      } catch {
        text = rawText
      }

      // Strip any accidental markdown fences
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
      if (!clean) throw new Error('No evaluation content in response')

      const parsed = JSON.parse(clean)
      setEvaluation(parsed)

    } catch (e) {
      setError('Evaluation failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function bandColor(band) {
    if (band >= 7) return '#10b981'
    if (band >= 5) return '#f59e0b'
    return '#ef4444'
  }

  function bandLabel(band) {
    const rounded = Math.round(band)
    return BAND_DESCRIPTIONS[Math.min(9, Math.max(1, rounded))] || ''
  }

  return (
    <div style={S.overlay}>
      <div style={S.panel}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.headerTitle}>IELTS Speaking Evaluation</div>
            <div style={S.headerSub}>
              {studentInfo?.student_name} · {studentInfo?.topic} · Target Band {studentInfo?.target_band}
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>

          {/* ── Ready state ── */}
          {!evaluation && !loading && (
            <div style={S.startState}>
              <div style={S.startIcon}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="12" fill="rgba(99,102,241,0.1)"/>
                  <path d="M14 34l6-8 6 4 6-10 6 14" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="24" cy="18" r="4" stroke="#6366f1" strokeWidth="2"/>
                </svg>
              </div>

              <div style={S.startTitle}>Ready to evaluate your session</div>

              <div style={S.startDesc}>
                {model && MODEL_LABELS[model] && (
                  <span style={{ display:'block', fontSize:11, color:'#475569', marginBottom:6 }}>
                    Session model: <strong style={{ color:'#94a3b8' }}>{MODEL_LABELS[model]}</strong>
                  </span>
                )}
                <span style={{ display:'block', fontSize:11, color:'#475569', marginBottom:10 }}>
                  Evaluation model: <strong style={{ color:'#6366f1' }}>GPT-4o Mini</strong>
                  <span style={{ color:'#334155' }}> · OpenAI · ~$0.0005/eval</span>
                </span>
                Gemini will analyse your{' '}
                <strong style={{ color:'#f1f5f9' }}>{transcript?.length || 0} responses</strong> on{' '}
                <strong style={{ color:'#f1f5f9' }}>{studentInfo?.topic}</strong> and give you a full IELTS band assessment.
              </div>

              <button style={S.evaluateBtn} onClick={runEvaluation}>
                Generate IELTS Evaluation
              </button>

              {(!transcript || transcript.length === 0) && (
                <div style={S.warning}>
                  No transcript available — evaluation may be limited.
                </div>
              )}
            </div>
          )}

          {/* ── Loading state ── */}
          {loading && (
            <div style={S.loadingState}>
              <div style={S.spinner}/>
              <div style={S.loadingText}>Analysing your responses...</div>
              <div style={S.loadingDesc}>Checking fluency, vocabulary, grammar and more</div>
              <div style={{ fontSize:11, color:'#334155', marginTop:4 }}>
                Using GPT-4o Mini
              </div>
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div>
              <div style={S.errorBox}>{error}</div>
              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <button style={S.retryBtn} onClick={runEvaluation}>
                  Try again
                </button>
                <button style={S.retryBtn} onClick={() => setError(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {evaluation && (
            <div>

              {/* Eval model badge */}
              {evalModel && (
                <div style={{ fontSize:11, color:'#334155', marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1' }}/>
                  Evaluated with <span style={{ color:'#6366f1' }}>{evalModel}</span>
                </div>
              )}

              {/* Overall band */}
              <div style={S.overallCard}>
                <div style={S.overallLeft}>
                  <div style={S.overallLabel}>Overall Band Score</div>
                  <div style={{ ...S.overallBand, color: bandColor(evaluation.overall_band) }}>
                    {evaluation.overall_band}
                  </div>
                  <div style={{ ...S.overallDesc, color: bandColor(evaluation.overall_band) }}>
                    {bandLabel(evaluation.overall_band)}
                  </div>
                </div>
                <div style={S.overallRight}>
                  <BandBar label="Fluency"       value={evaluation.fluency_band}       color={CRITERIA_INFO.fluency.color}/>
                  <BandBar label="Lexical"        value={evaluation.lexical_band}        color={CRITERIA_INFO.lexical.color}/>
                  <BandBar label="Grammar"        value={evaluation.grammar_band}        color={CRITERIA_INFO.grammar.color}/>
                  <BandBar label="Pronunciation"  value={evaluation.pronunciation_band}  color={CRITERIA_INFO.pronunciation.color}/>
                </div>
              </div>

              {/* Criteria breakdown */}
              <div style={S.criteriaGrid}>
                {Object.entries(CRITERIA_INFO).map(([key, info]) => {
                  const band    = evaluation[`${key}_band`]
                  const comment = evaluation[`${key}_comment`]
                  return (
                    <div key={key} style={{ ...S.criteriaCard, borderColor: info.color + '30' }}>
                      <div style={S.criteriaTop}>
                        <div>
                          <div style={S.criteriaLabel}>{info.label}</div>
                          <div style={S.criteriaDesc}>{info.desc}</div>
                        </div>
                        <div style={{ ...S.criteriaBand, color: info.color, background: info.bg }}>
                          {band}
                        </div>
                      </div>
                      <div style={S.criteriaComment}>{comment}</div>
                    </div>
                  )
                })}
              </div>

              {/* Strengths */}
              {evaluation.strengths && (
                <div style={S.strengthCard}>
                  <div style={S.strengthIcon}>✓</div>
                  <div>
                    <div style={S.strengthLabel}>Key strength</div>
                    <div style={S.strengthText}>{evaluation.strengths}</div>
                  </div>
                </div>
              )}

              {/* Improvement tips */}
              <div style={S.tipsSection}>
                <div style={S.tipsTitle}>Improvement tips</div>
                {[evaluation.improvement_tip_1, evaluation.improvement_tip_2, evaluation.improvement_tip_3]
                  .filter(Boolean)
                  .map((tip, i) => (
                    <div key={i} style={S.tip}>
                      <div style={S.tipNum}>{i + 1}</div>
                      <div style={S.tipText}>{tip}</div>
                    </div>
                  ))}
              </div>

              {/* Encouragement */}
              {evaluation.encouragement && (
                <div style={S.encouragement}>{evaluation.encouragement}</div>
              )}

              {/* Actions */}
              <div style={S.actions}>
                <button style={S.retryBtn} onClick={() => { setEvaluation(null); setError(null) }}>
                  Re-evaluate
                </button>
                <button style={S.exportBtn} onClick={() => exportEvaluation(evaluation, studentInfo)}>
                  Export report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function BandBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
        <span style={{ color:'#64748b' }}>{label}</span>
        <span style={{ color, fontWeight:600 }}>{value}</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
        <div style={{
          height:'100%',
          width:`${(value / 9) * 100}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.8s ease',
        }}/>
      </div>
    </div>
  )
}

function exportEvaluation(ev, student) {
  const text = `IELTS Speaking Evaluation Report
=====================================
Student:      ${student?.student_name}
Topic:        ${student?.topic}
Level:        ${student?.level} → Target Band: ${student?.target_band}
Date:         ${new Date().toLocaleDateString()}
Eval model:   GPT-4o Mini (OpenAI)

OVERALL BAND SCORE: ${ev.overall_band}

CRITERIA SCORES
---------------
Fluency & Coherence:           ${ev.fluency_band}
Lexical Resource:              ${ev.lexical_band}
Grammatical Range & Accuracy:  ${ev.grammar_band}
Pronunciation:                 ${ev.pronunciation_band}

DETAILED FEEDBACK
-----------------
Fluency:       ${ev.fluency_comment}
Lexical:       ${ev.lexical_comment}
Grammar:       ${ev.grammar_comment}
Pronunciation: ${ev.pronunciation_comment}

KEY STRENGTH
------------
${ev.strengths}

IMPROVEMENT TIPS
----------------
1. ${ev.improvement_tip_1}
2. ${ev.improvement_tip_2}
3. ${ev.improvement_tip_3}

${ev.encouragement}
`
  const a = document.createElement('a')
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
  a.download = `IELTS_Evaluation_${student?.student_name}_${Date.now()}.txt`
  a.click()
}

const S = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'stretch', justifyContent:'flex-end' },
  panel:        { width:680, background:'#0d1117', borderLeft:'1px solid rgba(99,102,241,0.2)', display:'flex', flexDirection:'column', overflowY:'auto' },
  header:       { padding:'20px 24px', borderBottom:'1px solid #1e2535', display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'sticky', top:0, background:'#0d1117', zIndex:10 },
  headerTitle:  { fontSize:16, fontWeight:600, color:'#f1f5f9', marginBottom:4 },
  headerSub:    { fontSize:12, color:'#4a5568' },
  closeBtn:     { background:'#1e2535', border:'none', color:'#94a3b8', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:14, flexShrink:0 },
  body:         { padding:24, flex:1 },

  startState:   { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px', textAlign:'center', gap:16 },
  startIcon:    { marginBottom:8 },
  startTitle:   { fontSize:18, fontWeight:600, color:'#f1f5f9' },
  startDesc:    { fontSize:14, color:'#64748b', lineHeight:1.6, maxWidth:420 },
  evaluateBtn:  { padding:'12px 28px', background:'linear-gradient(135deg,#6366f1,#4f46e5)', border:'none', color:'#fff', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:8 },
  warning:      { fontSize:12, color:'#f59e0b', marginTop:8 },

  loadingState: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 24px', gap:14 },
  spinner:      { width:36, height:36, border:'3px solid #1e2535', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 1s linear infinite' },
  loadingText:  { fontSize:15, color:'#f1f5f9', fontWeight:500 },
  loadingDesc:  { fontSize:12, color:'#4a5568' },

  errorBox:     { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'14px 16px', fontSize:13, color:'#f87171', lineHeight:1.6 },

  overallCard:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:14, padding:'20px 24px', marginBottom:16, display:'flex', gap:32, alignItems:'center' },
  overallLeft:  { textAlign:'center', minWidth:120 },
  overallLabel: { fontSize:11, color:'#4a5568', fontWeight:600, letterSpacing:1, textTransform:'uppercase', marginBottom:8 },
  overallBand:  { fontSize:64, fontWeight:700, lineHeight:1 },
  overallDesc:  { fontSize:12, fontWeight:500, marginTop:6 },
  overallRight: { flex:1 },

  criteriaGrid:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 },
  criteriaCard:    { background:'rgba(255,255,255,0.02)', border:'1px solid', borderRadius:12, padding:'14px 16px' },
  criteriaTop:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 },
  criteriaLabel:   { fontSize:13, fontWeight:600, color:'#f1f5f9', marginBottom:2 },
  criteriaDesc:    { fontSize:11, color:'#4a5568' },
  criteriaBand:    { fontSize:20, fontWeight:700, padding:'4px 10px', borderRadius:8, minWidth:40, textAlign:'center' },
  criteriaComment: { fontSize:12, color:'#94a3b8', lineHeight:1.6 },

  strengthCard:  { background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', gap:12, alignItems:'flex-start' },
  strengthIcon:  { width:24, height:24, borderRadius:6, background:'rgba(16,185,129,0.2)', color:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 },
  strengthLabel: { fontSize:11, color:'#10b981', fontWeight:600, letterSpacing:1, textTransform:'uppercase', marginBottom:4 },
  strengthText:  { fontSize:13, color:'#a7f3d0', lineHeight:1.6 },

  tipsSection: { marginBottom:16 },
  tipsTitle:   { fontSize:11, color:'#4a5568', fontWeight:600, letterSpacing:1, textTransform:'uppercase', marginBottom:10 },
  tip:         { display:'flex', gap:12, alignItems:'flex-start', marginBottom:10 },
  tipNum:      { width:22, height:22, borderRadius:6, background:'rgba(99,102,241,0.15)', color:'#818cf8', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  tipText:     { fontSize:13, color:'#94a3b8', lineHeight:1.6 },

  encouragement: { background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#a5b4fc', lineHeight:1.6, marginBottom:20, fontStyle:'italic' },

  actions:    { display:'flex', gap:10 },
  retryBtn:   { fontSize:12, padding:'8px 16px', borderRadius:8, border:'1px solid #1e2535', background:'#060a14', color:'#94a3b8', cursor:'pointer' },
  exportBtn:  { fontSize:12, padding:'8px 16px', borderRadius:8, border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.1)', color:'#818cf8', cursor:'pointer' },
}