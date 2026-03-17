import React, { useCallback, useRef, useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer, useTracks, useLocalParticipant, useRoomContext } from '@livekit/components-react'
import { Track } from 'livekit-client'
import BenchmarkPanel from './Benchmark.jsx'
import IntakeForm from './IntakeForm.jsx'
import Dashboard from './Dashboard.jsx'
import Evaluation from './Evaluation.jsx'

const LIVEKIT_URL  = import.meta.env.VITE_LIVEKIT_URL  || 'wss://ielets-dajbgqlm.livekit.cloud'
const TOKEN_SERVER = import.meta.env.VITE_TOKEN_SERVER || 'http://localhost:8080'

const MODEL_COLORS = {
  'gpt-4o-realtime-mini':  '#6366f1',
  'gpt-4o-realtime':       '#10b981',
  'gemini-2.0-flash-live': '#f59e0b',
  'ultravox':              '#ec4899',
  'xai-grok':              '#ef4444',
  'phonic':                '#8b5cf6',
}
const MODEL_LABELS = {
  'gpt-4o-realtime-mini':  'GPT-4o Realtime Mini',
  'gpt-4o-realtime':       'GPT-4o Realtime',
  'gemini-2.0-flash-live': 'Gemini 2.0 Flash Live',
  'ultravox':              'Ultravox 70B',
  'xai-grok':              'Grok Voice',
  'phonic':                'Phonic S2S',
}

export default function App() {
  const path = window.location.pathname
  if (path === '/dashboard') return <Dashboard />

  const [token, setToken]             = useState(null)
  const [joined, setJoined]           = useState(false)
  const [studentInfo, setStudentInfo] = useState(null)
  const [error, setError]             = useState(null)
  const [busy, setBusy]               = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [evalTranscript, setEvalTranscript] = useState([])
  const [showEval, setShowEval]       = useState(false)
  const name = useRef(`student-${Math.random().toString(36).slice(2,6)}`).current
  const sessionEndedRef = useRef(false)

  const handleFormStart = useCallback(async (info) => {
    setStudentInfo(info)
    setBusy(true)
    setError(null)
    setSessionEnded(false)
    setShowEval(false)
    sessionEndedRef.current = false
    try {
      const r = await fetch(
        `${TOKEN_SERVER}/token?room=kassel-exam-room&identity=${name}` +
        `&student_name=${encodeURIComponent(info.name)}` +
        `&level=${encodeURIComponent(info.level)}` +
        `&target_band=${encodeURIComponent(info.targetBand)}` +
        `&topic=${encodeURIComponent(info.topic)}` +
        `&questions=${encodeURIComponent(info.questions || 5)}` +
        `&model=${encodeURIComponent(info.model)}` +
        `&avatar=${encodeURIComponent(info.avatar)}`
      )
      if (!r.ok) throw new Error(await r.text())
      const { token } = await r.json()
      setToken(token)
      setJoined(true)
    } catch(e) { setError(e.message) }
    finally { setBusy(false) }
  }, [name])

  const handleSessionEnd = async () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true
    setSessionEnded(true)
    // Wait for backend agent to flush + write summary_*.json (triggered by LiveKit disconnect)
    await new Promise(r => setTimeout(r, 1500))
    try {
      const r = await fetch(`${TOKEN_SERVER}/sessions`)
      const sessions = await r.json()
      if (sessions.length > 0) {
        setEvalTranscript(sessions[0].transcript || [])
      }
    } catch(e) { console.log('Could not fetch transcript', e) }
  }

  if (!joined) return (
    <div>
      {error && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',
          background:'#450a0a',color:'#fca5a5',padding:'10px 20px',borderRadius:8,
          fontSize:13,zIndex:999,border:'1px solid #7f1d1d'}}>{error}</div>
      )}
      {busy ? (
        <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
          background:'#080c18',color:'#94a3b8',fontSize:14,gap:12,flexDirection:'column'}}>
          <div style={{width:36,height:36,border:'3px solid #1e2432',
            borderTop:'3px solid #6366f1',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
          <div>Connecting to {MODEL_LABELS[studentInfo?.model] || 'examiner'}...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : sessionEnded ? (
        <>
          <div style={{minHeight:'100vh',background:'#080c18',display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',gap:20,padding:24}}>
            <div style={{width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,#6366f1,#4f46e5)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:700,color:'#fff'}}>K</div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:600,color:'#f1f5f9',marginBottom:6}}>Session complete</div>
              <div style={{fontSize:13,color:'#64748b'}}>
                {studentInfo?.name} · {studentInfo?.topic} · {MODEL_LABELS[studentInfo?.model]}
              </div>
            </div>
            <button onClick={() => setShowEval(true)}
              style={{padding:'14px 36px',background:'linear-gradient(135deg,#6366f1,#4f46e5)',
                border:'none',color:'#fff',borderRadius:12,fontWeight:600,fontSize:15,cursor:'pointer'}}>
              View IELTS Evaluation →
            </button>
            <button onClick={() => { setSessionEnded(false); sessionEndedRef.current = false }}
              style={{fontSize:13,color:'#475569',background:'none',border:'1px solid #1e2535',
                borderRadius:8,padding:'8px 20px',cursor:'pointer'}}>
              Start new session
            </button>
            <a href="/dashboard" style={{fontSize:12,color:'#6366f1',textDecoration:'none'}}>
              View benchmark dashboard →
            </a>
          </div>
          {showEval && (
            <Evaluation
              transcript={evalTranscript}
              studentInfo={{
                student_name: studentInfo?.name,
                level:        studentInfo?.level,
                target_band:  studentInfo?.targetBand,
                topic:        studentInfo?.topic,
              }}
              model={studentInfo?.model}
              onClose={() => setShowEval(false)}
            />
          )}
        </>
      ) : (
        <IntakeForm onStart={handleFormStart} />
      )}
    </div>
  )

  return (
    <>
      <LiveKitRoom token={token} serverUrl={LIVEKIT_URL} connect audio video={false}
        onDisconnected={() => {
          setJoined(false)
          handleSessionEnd()
        }}
        style={{height:'100vh',background:'#080c18',color:'#e2e8f0',fontFamily:'system-ui'}}>
        <RoomAudioRenderer />
        <ExamRoom
          studentInfo={studentInfo}
          sessionEnded={sessionEnded}
          onShowEval={() => setShowEval(true)}
        />
      </LiveKitRoom>

    </>
  )
}

function ExamRoom({ studentInfo, sessionEnded, onShowEval }) {
  const [micOn, setMicOn]    = useState(true)
  const { localParticipant } = useLocalParticipant()
  const room                 = useRoomContext()
  const videoRef             = useRef(null)
  const modelColor           = MODEL_COLORS[studentInfo?.model] || '#6366f1'
  const modelLabel           = MODEL_LABELS[studentInfo?.model] || studentInfo?.model

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false },
     { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  )
  // Simli joins as a separate participant — identity may not contain 'agent'
  // so pick the first video track from any non-local participant
  const agentVideoTrack = tracks.find(t => !t.participant?.isLocal)

  React.useEffect(() => {
    const video = videoRef.current
    const mediaTrack = agentVideoTrack?.publication?.track?.mediaStreamTrack
    if (!video || !mediaTrack) return
    // Only re-attach if the underlying track actually changed
    const existing = video.srcObject?.getVideoTracks?.()?.[0]
    if (existing === mediaTrack) return
    video.srcObject = new MediaStream([mediaTrack])
    video.play().catch(() => {})
  }, [agentVideoTrack])

  React.useEffect(() => {
    if (!localParticipant) return
    const h = async () => JSON.stringify({ success: true })
    try {
      localParticipant.registerRpcMethod('lk.agent.playback_finished', h)
      localParticipant.registerRpcMethod('clearBuffer', h)
    } catch(e) {}
    return () => {
      try {
        localParticipant.unregisterRpcMethod('lk.agent.playback_finished')
        localParticipant.unregisterRpcMethod('clearBuffer')
      } catch(e) {}
    }
  }, [localParticipant])

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#080c18'}}>

      <header style={{padding:'12px 24px',borderBottom:'1px solid rgba(99,102,241,0.15)',
        background:'rgba(8,12,24,0.95)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{width:32,height:32,borderRadius:8,
            background:`linear-gradient(135deg,${modelColor},${modelColor}cc)`,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:14,fontWeight:700,color:'#fff'}}>K</div>
          <div>
            <div style={{fontWeight:600,fontSize:14,color:'#f1f5f9'}}>Kassel Academy — IELTS Speaking</div>
            <div style={{fontSize:11,color:'#64748b'}}>Fixed 5-question benchmark · {modelLabel}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {studentInfo && <>
            <span style={{fontSize:11,background:'rgba(255,255,255,0.05)',color:'#94a3b8',padding:'3px 10px',borderRadius:10}}>
              {studentInfo.name} · {studentInfo.level} → Band {studentInfo.targetBand}
            </span>
            <span style={{fontSize:11,background:'rgba(255,255,255,0.05)',color:'#94a3b8',padding:'3px 10px',borderRadius:10}}>
              {studentInfo.topic}
            </span>
            <span style={{fontSize:11,background:modelColor+'20',color:modelColor,
              padding:'3px 10px',borderRadius:10,border:`1px solid ${modelColor}40`}}>
              {modelLabel}
            </span>
          </>}
          <span style={{fontSize:11,background:'rgba(16,185,129,0.12)',color:'#6ee7b7',
            padding:'3px 10px',borderRadius:10,border:'1px solid rgba(16,185,129,0.2)'}}>● LIVE</span>
          <a href="/dashboard" style={{fontSize:11,color:'#64748b',textDecoration:'none',
            padding:'3px 10px',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10}}>
            Dashboard
          </a>
        </div>
      </header>

      <div style={{flex:1,display:'flex',gap:24,padding:24,justifyContent:'center',alignItems:'flex-start'}}>

        {/* Avatar */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
          <div style={{position:'relative',width:400,height:500,borderRadius:20,overflow:'hidden',
            border:`1px solid ${modelColor}30`,background:'#0d1020',
            boxShadow:agentVideoTrack?`0 0 30px ${modelColor}20`:'none',transition:'box-shadow 0.5s'}}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{width:'100%',height:'100%',objectFit:'cover',
                opacity:agentVideoTrack?1:0,transition:'opacity 0.3s'}}/>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',background:'rgba(8,12,24,0.9)',gap:12,
              opacity:agentVideoTrack?0:1,transition:'opacity 0.3s',pointerEvents:'none'}}>
              <div style={{width:36,height:36,border:`3px solid ${modelColor}30`,
                borderTop:`3px solid ${modelColor}`,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
              <p style={{fontSize:13,color:'#64748b'}}>Loading {studentInfo?.avatar === 'keyframe' ? 'James' : 'Sarah'}...</p>
              <p style={{fontSize:11,color:'#475569'}}>15–20 seconds</p>
            </div>
            <div style={{position:'absolute',top:10,right:10,fontSize:10,fontWeight:600,
              padding:'2px 8px',borderRadius:8,
              background:agentVideoTrack?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.05)',
              color:agentVideoTrack?'#6ee7b7':'#475569',
              border:`1px solid ${agentVideoTrack?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.08)'}`}}>
              {agentVideoTrack?'● LIVE':'WAITING'}
            </div>
            <div style={{position:'absolute',bottom:10,left:10,fontSize:10,fontWeight:600,
              padding:'3px 10px',borderRadius:8,background:modelColor+'20',color:modelColor,
              border:`1px solid ${modelColor}40`}}>{modelLabel}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:600,color:'#f1f5f9'}}>Sarah</div>
            <div style={{fontSize:11,color:'#475569'}}>IELTS Examiner · Kassel Academy</div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{display:'flex',flexDirection:'column',gap:14,width:300}}>

          {studentInfo && (
            <div style={{background:'rgba(15,20,40,0.6)',border:`1px solid ${modelColor}20`,borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:600,color:modelColor,marginBottom:10,letterSpacing:1,textTransform:'uppercase'}}>Session</div>
              <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                {[['Student',studentInfo.name],['Level',studentInfo.level],['Target',`Band ${studentInfo.targetBand}`],
                  ['Topic',studentInfo.topic],['Model',modelLabel],['Questions','5 (fixed)']].map(([k,v])=>(
                  <tr key={k}>
                    <td style={{color:'#64748b',padding:'3px 0',width:'40%'}}>{k}</td>
                    <td style={{color:'#f1f5f9',padding:'3px 0',fontWeight:500,fontSize:12}}>{v}</td>
                  </tr>
                ))}
              </table>
            </div>
          )}

          <BenchmarkPanel metrics={null} turnCount={0} />

          {/* Mic button */}
          <div style={{background:'rgba(15,20,40,0.6)',border:'1px solid rgba(99,102,241,0.15)',
            borderRadius:12,padding:14}}>
            <button onClick={() => { localParticipant?.setMicrophoneEnabled(!micOn); setMicOn(m=>!m) }}
              style={{width:'100%',padding:'11px',
                background:micOn?`linear-gradient(135deg,${modelColor},${modelColor}cc)`:'rgba(255,255,255,0.04)',
                color:'#fff',border:micOn?'none':'1px solid rgba(255,255,255,0.1)',
                borderRadius:10,fontWeight:600,fontSize:13,cursor:'pointer'}}>
              {micOn?'🎤 Mic Active — speak now':'🔇 Mic Muted — click to unmute'}
            </button>
            <div style={{fontSize:11,color:'#475569',marginTop:6,textAlign:'center'}}>
              {micOn?'Sarah is listening · Answer each question fully':'Click to start speaking'}
            </div>
          </div>

          {/* End session button */}
          {!sessionEnded && (
            <button onClick={() => room.disconnect()}
              style={{width:'100%',padding:'10px',background:'rgba(239,68,68,0.08)',
                color:'#f87171',border:'1px solid rgba(239,68,68,0.2)',
                borderRadius:10,fontWeight:500,fontSize:13,cursor:'pointer'}}>
              End Session
            </button>
          )}

          {/* Evaluation button — appears after session ends */}
          {sessionEnded && (
            <button onClick={onShowEval}
              style={{width:'100%',padding:'13px',
                background:'linear-gradient(135deg,#6366f1,#4f46e5)',
                border:'none',color:'#fff',borderRadius:10,fontWeight:600,
                fontSize:14,cursor:'pointer',animation:'glow 2s ease-in-out infinite'}}>
              View IELTS Evaluation →
            </button>
          )}

          <a href="/dashboard" style={{display:'block',textAlign:'center',fontSize:12,
            color:'#6366f1',textDecoration:'none',padding:'8px',
            border:'1px solid rgba(99,102,241,0.2)',borderRadius:8,
            background:'rgba(99,102,241,0.05)'}}>
            View benchmark dashboard →
          </a>
        </div>
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 10px rgba(99,102,241,0.3)} 50%{box-shadow:0 0 20px rgba(99,102,241,0.6)}}
      `}</style>
    </div>
  )
}