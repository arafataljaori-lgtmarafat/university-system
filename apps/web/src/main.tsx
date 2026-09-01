import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ApiError } from '@dentpilot/contracts';
import './styles.css';

function App(): React.ReactElement {
  const [result,setResult]=useState('No API check run.');
  async function check(path:string): Promise<void> { try { const response=await fetch(`http://localhost:3000${path}`,{credentials:'include'}); const body=await response.text(); setResult(`${path} → ${response.status}\n${body}`); } catch { setResult(`${path} → network error`); } }
  return <main><h1>DentPilot Production Core</h1><p>Phase 1 diagnostic shell. The v7 prototype remains read-only reference material.</p><section><button onClick={()=>check('/health/live')}>Live health</button><button onClick={()=>check('/health/ready')}>Readiness</button><button onClick={()=>check('/openapi.json')}>OpenAPI</button></section><pre>{result}</pre></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
