'use client';

import { useState, useEffect } from 'react';

interface TimeBlock {
  id: string;
  day_number: number;
  label: string;
  date: string;
  start_time: string;
  end_time: string;
  max_observers: number;
  sort_order: number;
  observer_count: number;
}

export default function OsceEvaluatorSignup() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [agencyPref, setAgencyPref] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', title: '', agency: '', email: '', phone: '', role: '', agency_preference_note: ''
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [triedSubmit, setTriedSubmit] = useState(false);

  const fetchBlocks = () => {
    setLoading(true);
    fetch('/api/osce/time-blocks')
      .then(r => r.json())
      .then(data => setBlocks(data.blocks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBlocks(); }, []);

  const toggleBlock = (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block || block.observer_count >= block.max_observers) return;
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatTime = (t: string) => t.replace(/^(\d{2}):(\d{2}).*/, '$1$2');
  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fieldErrors: Record<string, string> = {};
  if (!formData.name.trim()) fieldErrors.name = 'Full name is required';
  if (!formData.title.trim()) fieldErrors.title = 'Title / rank is required';
  if (!formData.agency.trim()) fieldErrors.agency = 'Agency is required';
  if (!formData.email.trim()) fieldErrors.email = 'Email is required';
  else if (!emailRegex.test(formData.email.trim())) fieldErrors.email = 'Please enter a valid email address';

  const allBlocksFull = blocks.length > 0 && blocks.every(b => b.observer_count >= b.max_observers);
  const isFormValid = Object.keys(fieldErrors).length === 0 && selectedBlocks.size > 0 && !allBlocksFull;

  const showError = (field: string) => (touched[field] || triedSubmit) && fieldErrors[field];
  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setTriedSubmit(true);

    if (Object.keys(fieldErrors).length > 0) {
      setStatus({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }
    if (selectedBlocks.size === 0) {
      setStatus({ type: 'error', message: 'Please select at least one time block.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/osce/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          block_ids: Array.from(selectedBlocks),
          agency_preference: agencyPref,
          agency_preference_note: agencyPref ? formData.agency_preference_note : ''
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus({ type: 'success', message: "You're registered! We'll send evaluator materials and session details within 48 hours." });
        setFormData({ name: '', title: '', agency: '', email: '', phone: '', role: '', agency_preference_note: '' });
        setSelectedBlocks(new Set());
        setAgencyPref(false);
        setTouched({});
        setTriedSubmit(false);
        fetchBlocks();
      } else if (res.status === 409) {
        setStatus({ type: 'error', message: data.error || "You're already registered. Contact bhartnell@pmi.edu to update your registration." });
      } else {
        setStatus({ type: 'error', message: data.error || 'Something went wrong. Please email bhartnell@pmi.edu.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Something went wrong. Please email bhartnell@pmi.edu with your name, agency, and available times.' });
    }
    setSubmitting(false);
  };

  const renderDots = (block: TimeBlock) => {
    const dots = [];
    for (let i = 0; i < block.max_observers; i++) {
      dots.push(<span key={i} className={`osce-mini-dot${i < block.observer_count ? ' osce-taken' : ''}`} />);
    }
    return dots;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        .osce-signup * { margin: 0; padding: 0; box-sizing: border-box; }
        .osce-signup { font-family: 'DM Sans', -apple-system, sans-serif; background: #FAF8F4; color: #1A1A1A; min-height: 100vh; -webkit-font-smoothing: antialiased; position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto; z-index: 9999; }
        .osce-hero { background: linear-gradient(165deg, #0F1F3D 0%, #1A2F52 60%, #263D66 100%); padding: 3rem 2rem 3.5rem; position: relative; overflow: hidden; }
        .osce-hero::before { content: ''; position: absolute; top: -50%; right: -20%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%); pointer-events: none; }
        .osce-hero::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #C9A84C, transparent); }
        .osce-hero-inner { max-width: 720px; margin: 0 auto; position: relative; z-index: 1; }
        .osce-institution { font-weight: 500; font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: #C9A84C; margin-bottom: 1.25rem; opacity: 0; animation: osceSlideUp 0.6s ease forwards 0.1s; }
        .osce-hero h1 { font-family: 'DM Serif Display', serif; font-size: clamp(1.75rem, 4vw, 2.5rem); color: #FFFFFF; line-height: 1.2; margin-bottom: 0.75rem; opacity: 0; animation: osceSlideUp 0.6s ease forwards 0.2s; }
        .osce-hero-subtitle { font-size: 1.05rem; font-weight: 300; color: rgba(255,255,255,0.7); line-height: 1.5; max-width: 560px; opacity: 0; animation: osceSlideUp 0.6s ease forwards 0.35s; }
        .osce-info-strip { max-width: 720px; margin: -1.5rem auto 0; padding: 0 2rem; position: relative; z-index: 2; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; opacity: 0; animation: osceSlideUp 0.6s ease forwards 0.45s; }
        .osce-info-card { background: #FFFFFF; border-radius: 10px; padding: 1.25rem 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04); text-align: center; border: 1px solid rgba(0,0,0,0.04); }
        .osce-info-card .osce-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #8A8A8A; margin-bottom: 0.5rem; }
        .osce-info-card .osce-value { font-family: 'DM Serif Display', serif; font-size: 1rem; color: #0F1F3D; line-height: 1.35; }
        .osce-info-card .osce-sub { font-size: 0.8rem; color: #5A5A5A; margin-top: 0.25rem; }
        .osce-form-section { max-width: 720px; margin: 2.5rem auto 0; padding: 0 2rem 3rem; opacity: 0; animation: osceSlideUp 0.6s ease forwards 0.55s; }
        .osce-form-intro { font-size: 0.95rem; color: #5A5A5A; line-height: 1.6; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #E0DDD6; }
        .osce-form-container { background: #FFFFFF; border-radius: 12px; padding: 2.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.04); }
        .osce-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
        .osce-form-group { display: flex; flex-direction: column; }
        .osce-form-group label { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.05em; color: #1A1A1A; margin-bottom: 0.4rem; }
        .osce-optional { font-weight: 400; color: #8A8A8A; font-size: 0.72rem; }
        .osce-form-group input, .osce-form-group textarea, .osce-form-group select { font-family: 'DM Sans', sans-serif; font-size: 0.95rem; padding: 0.7rem 0.9rem; border: 1.5px solid #E0DDD6; border-radius: 8px; background: #FFFFFF; color: #1A1A1A; transition: border-color 0.2s ease, box-shadow 0.2s ease; outline: none; -webkit-appearance: none; }
        .osce-form-group input:focus, .osce-form-group textarea:focus, .osce-form-group select:focus { border-color: #C9A84C; box-shadow: 0 0 0 3px rgba(201,168,76,0.15); }
        .osce-form-group input::placeholder, .osce-form-group textarea::placeholder { color: #8A8A8A; }
        .osce-form-group textarea { resize: vertical; min-height: 70px; }
        .osce-form-group select { cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A8A8A' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2.5rem; }
        .osce-avail-group { margin-bottom: 1.25rem; }
        .osce-avail-label { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.05em; color: #1A1A1A; margin-bottom: 0.65rem; display: block; }
        .osce-avail-hint { font-size: 0.78rem; color: #8A8A8A; margin-bottom: 0.65rem; line-height: 1.4; }
        .osce-block-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .osce-block-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border: 1.5px solid #E0DDD6; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; user-select: none; }
        .osce-block-item:hover:not(.osce-locked) { border-color: #C9A84C; background: rgba(201,168,76,0.15); }
        .osce-block-item.osce-checked { border-color: #C9A84C; background: rgba(201,168,76,0.15); }
        .osce-block-item.osce-locked { opacity: 0.5; cursor: not-allowed; pointer-events: none; background: #FAF8F4; }
        .osce-check-box { width: 18px; height: 18px; border: 2px solid #E0DDD6; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink: 0; }
        .osce-checked .osce-check-box { background: #C9A84C; border-color: #C9A84C; }
        .osce-block-content { display: flex; flex-direction: column; flex: 1; gap: 1px; }
        .osce-block-day { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8A8A8A; }
        .osce-block-label { font-size: 0.95rem; font-weight: 600; color: #1A1A1A; }
        .osce-block-time { font-size: 0.82rem; color: #5A5A5A; }
        .osce-block-capacity { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 60px; }
        .osce-mini-dots { display: flex; gap: 4px; }
        .osce-mini-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #E0DDD6; background: #FFFFFF; transition: all 0.3s ease; }
        .osce-mini-dot.osce-taken { background: #0F1F3D; border-color: #0F1F3D; }
        .osce-cap-text { font-size: 0.65rem; font-weight: 500; color: #8A8A8A; white-space: nowrap; }
        .osce-locked .osce-cap-text { color: #0F1F3D; font-weight: 600; }
        .osce-agency-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1rem; border: 1.5px dashed #E0DDD6; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; user-select: none; margin-bottom: 1.25rem; }
        .osce-agency-item:hover { border-color: #C9A84C; background: rgba(201,168,76,0.15); }
        .osce-agency-item.osce-checked { border-color: #C9A84C; background: rgba(201,168,76,0.15); }
        .osce-agency-label { font-size: 0.88rem; font-weight: 500; color: #1A1A1A; }
        .osce-agency-detail { font-size: 0.72rem; color: #5A5A5A; line-height: 1.4; margin-top: 2px; }
        .osce-submit-row { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #E0DDD6; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .osce-submit-note { font-size: 0.78rem; color: #8A8A8A; line-height: 1.5; max-width: 340px; }
        .osce-submit-btn { font-family: 'DM Sans', sans-serif; font-size: 0.95rem; font-weight: 600; padding: 0.8rem 2.25rem; background: #0F1F3D; color: #FFFFFF; border: none; border-radius: 8px; cursor: pointer; transition: all 0.25s ease; letter-spacing: 0.02em; white-space: nowrap; }
        .osce-submit-btn:hover { background: #263D66; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,31,61,0.3); }
        .osce-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .osce-status-success { padding: 1rem 1.25rem; border-radius: 8px; font-size: 0.9rem; line-height: 1.5; margin-top: 1.25rem; background: #E8F5E9; color: #2E7D32; border: 1px solid rgba(46,125,50,0.2); }
        .osce-status-error { padding: 1rem 1.25rem; border-radius: 8px; font-size: 0.9rem; line-height: 1.5; margin-top: 1.25rem; background: #FFEBEE; color: #C62828; border: 1px solid rgba(198,40,40,0.2); }
        .osce-footer { max-width: 720px; margin: 0 auto; padding: 1.5rem 2rem 2.5rem; text-align: center; font-size: 0.78rem; color: #8A8A8A; line-height: 1.5; }
        .osce-footer a { color: #263D66; text-decoration: none; }
        .osce-footer a:hover { color: #C9A84C; }
        .osce-field-error { font-size: 0.72rem; color: #C62828; margin-top: 0.25rem; line-height: 1.3; }
        .osce-form-group input.osce-input-error, .osce-form-group select.osce-input-error { border-color: #C62828; }
        .osce-form-group input.osce-input-error:focus, .osce-form-group select.osce-input-error:focus { border-color: #C62828; box-shadow: 0 0 0 3px rgba(198,40,40,0.15); }
        .osce-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFFFFF; border-radius: 50%; animation: osceSpin 0.6s linear infinite; margin-right: 0.5rem; vertical-align: middle; }
        @keyframes osceSpin { to { transform: rotate(360deg); } }
        .osce-all-full-banner { padding: 1.25rem; border-radius: 8px; background: #FFEBEE; color: #C62828; border: 1px solid rgba(198,40,40,0.2); text-align: center; margin-bottom: 1.5rem; font-size: 0.9rem; line-height: 1.5; }
        .osce-loading-blocks { display: flex; align-items: center; justify-content: center; padding: 2rem; color: #8A8A8A; font-size: 0.9rem; gap: 0.5rem; }
        .osce-loading-spinner { width: 20px; height: 20px; border: 2px solid #E0DDD6; border-top-color: #0F1F3D; border-radius: 50%; animation: osceSpin 0.6s linear infinite; }
        @keyframes osceSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 640px) {
          .osce-hero { padding: 2.5rem 1.5rem 3rem; }
          .osce-info-strip { grid-template-columns: 1fr; padding: 0 1.5rem; }
          .osce-form-section { padding: 0 1.5rem 3rem; }
          .osce-form-container { padding: 1.75rem 1.5rem; }
          .osce-form-row { grid-template-columns: 1fr; }
          .osce-submit-row { flex-direction: column-reverse; text-align: center; }
          .osce-submit-note { max-width: none; }
        }
      `}</style>

      <div className="osce-signup">
        <header className="osce-hero">
          <div className="osce-hero-inner">
            <p className="osce-institution">Pima Medical Institute &mdash; Paramedic Program</p>
            <h1>Clinical Capstone<br />Evaluator Registration</h1>
            <p className="osce-hero-subtitle">Join our Medical Directors and faculty as an evaluator for the Spring 2026 Paramedic Clinical Capstone assessment.</p>
          </div>
        </header>

        <div className="osce-info-strip">
          <div className="osce-info-card">
            <div className="osce-label">Day 1</div>
            <div className="osce-value">Monday, March 30</div>
            <div className="osce-sub">0900 &ndash; 1700</div>
          </div>
          <div className="osce-info-card">
            <div className="osce-label">Day 2</div>
            <div className="osce-value">Tuesday, March 31</div>
            <div className="osce-sub">1300 &ndash; 1700</div>
          </div>
          <div className="osce-info-card">
            <div className="osce-label">Location</div>
            <div className="osce-value">PMI Paramedic Lab</div>
            <div className="osce-sub">Las Vegas Campus</div>
          </div>
        </div>

        <section className="osce-form-section">
          <p className="osce-form-intro">
            Evaluators observe live patient scenarios and participate in structured oral board questioning alongside our Medical Directors. A calibration briefing at the start of each session covers everything you need &mdash; no advance preparation required. You&apos;re welcome to attend any combination of time blocks, for as much time as your schedule allows.
          </p>

          <div className="osce-form-container">
            {allBlocksFull && (
              <div className="osce-all-full-banner">
                All time blocks are currently full. Please contact <a href="mailto:bhartnell@pmi.edu" style={{ color: '#C62828', fontWeight: 600 }}>bhartnell@pmi.edu</a> to be added to a waitlist.
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate>
              <div className="osce-form-row">
                <div className="osce-form-group">
                  <label>Full Name</label>
                  <input type="text" required placeholder="e.g., John Smith" className={showError('name') ? 'osce-input-error' : ''} value={formData.name} onBlur={() => markTouched('name')} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                  {showError('name') && <span className="osce-field-error">{fieldErrors.name}</span>}
                </div>
                <div className="osce-form-group">
                  <label>Title / Rank</label>
                  <input type="text" required placeholder="e.g., Battalion Chief, EMS Educator" className={showError('title') ? 'osce-input-error' : ''} value={formData.title} onBlur={() => markTouched('title')} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
                  {showError('title') && <span className="osce-field-error">{fieldErrors.title}</span>}
                </div>
              </div>

              <div className="osce-form-row">
                <div className="osce-form-group">
                  <label>Agency / Organization</label>
                  <input type="text" required placeholder="e.g., Clark County Fire Department" className={showError('agency') ? 'osce-input-error' : ''} value={formData.agency} onBlur={() => markTouched('agency')} onChange={e => setFormData(p => ({ ...p, agency: e.target.value }))} />
                  {showError('agency') && <span className="osce-field-error">{fieldErrors.agency}</span>}
                </div>
                <div className="osce-form-group">
                  <label>Email</label>
                  <input type="email" required placeholder="you@agency.gov" className={showError('email') ? 'osce-input-error' : ''} value={formData.email} onBlur={() => markTouched('email')} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                  {showError('email') && <span className="osce-field-error">{fieldErrors.email}</span>}
                </div>
              </div>

              <div className="osce-form-row">
                <div className="osce-form-group">
                  <label>Phone <span className="osce-optional">(optional)</span></label>
                  <input type="tel" placeholder="(702) 555-0100" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="osce-form-group">
                  <label>Primary Role <span className="osce-optional">(optional)</span></label>
                  <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
                    <option value="">Select your primary role&hellip;</option>
                    <option value="ems-educator">EMS Educator / Training Officer</option>
                    <option value="fto-preceptor">FTO / Field Preceptor</option>
                    <option value="supervisor-chief">Supervisor / Chief Officer</option>
                    <option value="medical-director">Medical Director / Physician</option>
                    <option value="clinical-coordinator">Clinical Coordinator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="osce-avail-group">
                <label className="osce-avail-label">When can you attend? <span className="osce-optional">(select all that work)</span></label>
                <p className="osce-avail-hint">Each time block is capped at {blocks[0]?.max_observers || 4} outside evaluators. Full blocks are locked.</p>
                {loading ? (
                  <div className="osce-loading-blocks">
                    <span className="osce-loading-spinner" />
                    Loading available time blocks...
                  </div>
                ) : (
                <div className="osce-block-list">
                  {blocks.map(block => {
                    const full = block.observer_count >= block.max_observers;
                    const checked = selectedBlocks.has(block.id);
                    const remaining = block.max_observers - block.observer_count;
                    return (
                      <div key={block.id} className={`osce-block-item${checked ? ' osce-checked' : ''}${full ? ' osce-locked' : ''}`} onClick={() => toggleBlock(block.id)}>
                        <span className="osce-check-box">
                          {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                        </span>
                        <span className="osce-block-content">
                          <span className="osce-block-day">Day {block.day_number} &mdash; {formatDate(block.date)}</span>
                          <span className="osce-block-label">{block.label}</span>
                          <span className="osce-block-time">{formatTime(block.start_time)} &ndash; {formatTime(block.end_time)}</span>
                        </span>
                        <span className="osce-block-capacity">
                          <span className="osce-mini-dots">{renderDots(block)}</span>
                          <span className="osce-cap-text">{full ? 'Full' : `${remaining} open`}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                )}
                {triedSubmit && selectedBlocks.size === 0 && !allBlocksFull && !loading && (
                  <span className="osce-field-error" style={{ marginTop: '0.5rem', display: 'block' }}>Please select at least one time block</span>
                )}
              </div>

              <div className={`osce-agency-item${agencyPref ? ' osce-checked' : ''}`} onClick={() => setAgencyPref(!agencyPref)}>
                <span className="osce-check-box">
                  {agencyPref && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </span>
                <span>
                  <span className="osce-agency-label">I&apos;d like to observe students connected to my agency</span><br />
                  <span className="osce-agency-detail">Current employees, clinical students placed at your agency, or candidates in your hiring process. We&apos;ll do our best to schedule those students during your selected time blocks.</span>
                </span>
              </div>

              {agencyPref && (
                <div className="osce-form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>Anything that would help us with scheduling? <span className="osce-optional">(optional)</span></label>
                  <textarea placeholder="e.g., We have two students currently in your program / We're interviewing one of your graduates next month" value={formData.agency_preference_note} onChange={e => setFormData(p => ({ ...p, agency_preference_note: e.target.value }))} />
                </div>
              )}

              <div className="osce-submit-row">
                <p className="osce-submit-note">We&apos;ll follow up with evaluator materials and a detailed schedule within 48 hours of your registration.</p>
                <button type="submit" className="osce-submit-btn" disabled={submitting || allBlocksFull}>
                  {submitting && <span className="osce-spinner" />}
                  {submitting ? 'Submitting\u2026' : allBlocksFull ? 'All Blocks Full' : 'Register'}
                </button>
              </div>

              {status && (
                <div className={status.type === 'success' ? 'osce-status-success' : 'osce-status-error'}>
                  {status.message}
                </div>
              )}
            </form>
          </div>
        </section>

        <div className="osce-footer">
          <p>Pima Medical Institute &mdash; Paramedic Program<br />
          Questions? Contact <a href="mailto:bhartnell@pmi.edu">Benjamin Hartnell</a> &mdash; Lead Paramedic Instructor &amp; Clinical Director</p>
        </div>
      </div>
    </>
  );
}
