import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

export default function StudentMaterialsPanel() {
  const [materials, setMaterials] = useState([]);
  const [batches, setBatches] = useState([]);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [batchId, setBatchId] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('assignment');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [matRes, shareRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/student/batch-materials`, { headers }),
        fetch(`${getApiBaseUrl()}/api/student/shares`, { headers })
      ]);
      const matData = await matRes.json().catch(() => ({}));
      const shareData = await shareRes.json().catch(() => ({}));
      if (matRes.ok) setMaterials(matData.materials || []);
      if (shareRes.ok) {
        setShares(shareData.shares || []);
        const b = shareData.batches || [];
        setBatches(b);
        const uploadable = b.find((x) => x.studentUploadsEnabled);
        if (uploadable && !batchId) setBatchId(uploadable.id);
        else if (b[0] && !batchId) setBatchId(b[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadableBatches = batches.filter((b) => b.studentUploadsEnabled);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!batchId) {
      setError('Select a batch first');
      return;
    }
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const body = new FormData();
      body.append('file', file);
      body.append('batchId', batchId);
      body.append('title', title.trim() || file.name);
      body.append('note', note.trim());
      body.append('kind', kind);
      const res = await fetch(`${getApiBaseUrl()}/api/student/shares`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setMessage('Shared with your trainer.');
      setTitle('');
      setNote('');
      await load();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="live-lobby">
      <div className="live-lobby__hero">
        <p className="live-lobby__eyebrow">Sky States · Materials</p>
        <h2>Batch materials & your shares</h2>
        <p>
          Open handouts, writing, and extra videos from your trainer. If uploads are enabled, share
          your work for review.
        </p>
      </div>

      <section className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>From your trainer</h3>
          <button
            type="button"
            className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
            onClick={load}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="live-lobby--empty">Loading…</p>
        ) : materials.length === 0 ? (
          <div className="live-lobby--empty">No batch materials posted yet.</div>
        ) : (
          <ul className="live-lobby__list">
            {materials.map((m) => (
              <li key={m.id} className="live-session">
                <div className="live-session__top">
                  <div>
                    <h4 className="live-session__title">{m.name}</h4>
                    <p className="live-session__meta">
                      {m.kind}
                      {m.classroomLectureId ? ' · also in Classroom' : ''}
                      {m.createdAt
                        ? ` · ${new Date(m.createdAt).toLocaleDateString('en-IN')}`
                        : ''}
                    </p>
                  </div>
                  <span className="live-session__badge">{m.kind}</span>
                </div>
                {m.driveLink && (
                  <div className="live-session__cta">
                    <a
                      className="live-lobby__btn live-lobby__btn--primary"
                      href={m.driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="live-lobby__card" style={{ marginTop: '1.1rem' }}>
        <h3>Share with your trainer</h3>
        {uploadableBatches.length === 0 ? (
          <p className="live-lobby__muted">
            Your trainer has not enabled student uploads for your batch yet. You can still open
            materials above.
          </p>
        ) : (
          <>
            <div className="live-lobby__form" style={{ marginTop: '0.75rem' }}>
              <label>
                Batch
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  {uploadableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="assignment">Assignment</option>
                  <option value="writing">Writing</option>
                  <option value="project">Project</option>
                  <option value="video">Video</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 3 homework"
                />
              </label>
              <label>
                Note (optional)
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything your trainer should know?"
                />
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.md,image/*,video/*,.mp4,.mov"
                style={{ display: 'none' }}
                onChange={onUpload}
              />
              <div className="live-lobby__actions">
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--primary"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? 'Uploading…' : 'Upload & share'}
                </button>
              </div>
            </div>
            {error && <p className="live-lobby__alert live-lobby__alert--err">{error}</p>}
            {message && <p className="live-lobby__alert live-lobby__alert--ok">{message}</p>}
          </>
        )}

        <h4 style={{ marginTop: '1.25rem' }}>Your submissions</h4>
        {shares.length === 0 ? (
          <p className="live-lobby--empty">No submissions yet.</p>
        ) : (
          <ul className="live-lobby__list">
            {shares.map((s) => (
              <li key={s.id} className="live-session">
                <div className="live-session__top">
                  <div>
                    <h4 className="live-session__title">{s.title}</h4>
                    <p className="live-session__meta">
                      {s.kind} · {s.status}
                      {s.createdAt
                        ? ` · ${new Date(s.createdAt).toLocaleDateString('en-IN')}`
                        : ''}
                    </p>
                    {s.teacherFeedback ? (
                      <p className="live-lobby__muted">Feedback: {s.teacherFeedback}</p>
                    ) : null}
                  </div>
                  <span className="live-session__badge">{s.status}</span>
                </div>
                {s.driveLink && (
                  <div className="live-session__cta">
                    <a
                      className="live-lobby__btn live-lobby__btn--ghost"
                      href={s.driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open file
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
