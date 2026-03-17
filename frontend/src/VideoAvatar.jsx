import React from 'react'
import { useParticipants, VideoTrack, useTracks } from '@livekit/components-react'
import { Track } from 'livekit-client'

export default function VideoAvatar({ isSpeaking }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const agentTrack = tracks.find(t => t.participant?.isAgent)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{
        position: 'relative', width: 400, height: 500, borderRadius: 20,
        overflow: 'hidden', border: `2px solid ${isSpeaking ? '#8b5cf6' : '#2d3748'}`,
        boxShadow: isSpeaking ? '0 0 40px rgba(139,92,246,0.5)' : 'none',
        background: '#0f1117', transition: 'all 0.3s'
      }}>
        {agentTrack ? (
          <VideoTrack trackRef={agentTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: 'rgba(10,14,26,0.85)', gap: 12 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #2d3748',
              borderTop: '3px solid #8b5cf6', borderRadius: '50%',
              animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Connecting avatar...</p>
          </div>
        )}
        {agentTrack && isSpeaking && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(139,92,246,0.9)', color: '#fff', fontSize: 12, fontWeight: 700,
            padding: '4px 14px', borderRadius: 20 }}>● Speaking</div>
        )}
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 8,
          background: agentTrack ? '#064e3b' : '#1e2432',
          color: agentTrack ? '#6ee7b7' : '#94a3b8' }}>
          {agentTrack ? '● LIVE' : 'WAITING'}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700 }}>AI Examiner</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>gpt-4o-realtime-mini · Simli</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}