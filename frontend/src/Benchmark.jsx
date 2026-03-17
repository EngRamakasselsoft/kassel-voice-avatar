import React from 'react'

function Bar({ label, value, max }) {
  const pct = Math.min(100, ((value||0)/max)*100)
  const color = pct < 40 ? '#34d399' : pct < 70 ? '#fbbf24' : '#f87171'
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:10,color:'#94a3b8'}}>{label}</span>
        <span style={{fontSize:11,fontWeight:700,color}}>{value != null ? `${Math.round(value)}ms` : '—'}</span>
      </div>
      <div style={{height:3,background:'#1e2432',borderRadius:2}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width 0.3s'}} />
      </div>
    </div>
  )
}

export default function BenchmarkPanel({ metrics, turnCount }) {
  return (
    <div style={{background:'#1a2035',border:'1px solid #2d3748',borderRadius:12,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:13}}>📊 Benchmark</span>
        <span style={{fontSize:11,color:'#64748b'}}>Turn #{turnCount||0}</span>
      </div>
      <Bar label="OpenAI TTFT"              value={metrics?.openai_ttft_ms}        max={1000} />
      <Bar label="Simli Video Latency"       value={metrics?.simli_video_latency_ms} max={500}  />
      <Bar label="Glass-to-Glass"            value={metrics?.glass_to_glass_ms}     max={2000} />
      <div style={{borderTop:'1px solid #2d3748',marginTop:10,paddingTop:10,fontSize:10,color:'#475569'}}>
        Logs → agent/logs/benchmark_*.jsonl
      </div>
    </div>
  )
}