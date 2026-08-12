import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

const MATERIAL_KINDS = [
  { value: 'writing', label: 'Writing / notes (PDF, DOC…)' },
  { value: 'video', label: 'Extra video (not from live class)' },
  { value: 'handout', label: 'Handout' },
  { value: 'project', label: 'Project brief / files' },
  { value: 'notes', label: 'Class notes' },
  { value: 'other', label: 'Other' }
];

const ACCEPT_BY_KIND = {
  writing: '.pdf,.doc,.docx,.txt,.md,.rtf,application/pdf,text/*',
  video: 'video/*,.mp4,.mov,.webm,.mkv',
  handout: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.csv,image/*,video/*',
  project: '.pdf,.doc,.docx,.zip,.rar,.ppt,.pptx,.xls,.xlsx,image/*,.txt',
  notes: '.pdf,.doc,.docx,.txt,.md,image/*',
  other: undefined
};

export default function TeacherMaterialsPanel({ batchId, batchName = '' }) {
  const [materials, setMaterials] = useState([]);
  const [shares, setShares] = useState([]);
  const [folderLink, setFolderLink] = useState('');
  const [studentUploadsEnabled, setStudentUploadsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState('writing');
  const [addAsLecture, setAddAsLecture] = useState(true);
  const [kindFilter, setKindFilter] = useState('all');
  const [tab, setTab] = useState('library'); // library | shares
  const fileRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError('');
    try {
      const [matRes, shareRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/teacher/batches/${batchId}/materials`, {
          headers: authHeaders()
        }),
        fetch(`${getApiBaseUrl()}/api/teacher/batches/${batchId}/shares`, {
          headers: authHeaders()
        })
      ]);
      const matData = await matRes.json().catch(() => ({}));
      const shareData = await shareRes.json().catch(() => ({}));
      if (!matRes.ok) throw new Error(matData.message || 'Failed to load materials');
      setMaterials(matData.materials || []);
      setFolderLink(matData.driveFolderLink || '');
      setStudentUploadsEnabled(Boolean(matData.studentUploadsEnabled));
      if (shareRes.ok) {
        setShares(shareData.shares || []);
        if (shareData.studentUploadsEnabled != null) {
          setStudentUploadsEnabled(Boolean(shareData.studentUploadsEnabled));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      body.append('name', file.name);
      if (kind === 'video' && addAsLecture) {
        body.append('addAsLecture', 'true');
      }
      const res = await fetch(`${getApiBaseUrl()}/api/teacher/batches/${batchId}/materials`, {
        method: 'POST',
        headers: authHeaders(),
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setMessage(
        data.classroomLectureId
          ? 'Uploaded to Drive and added to Classroom as an extra lecture.'
          : 'Uploaded to Google Drive.'
      );
      await load();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this material from the batch library?')) return;
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/teacher/batches/${batchId}/materials/${id}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const toggleStudentUploads = async () => {
    const next = !studentUploadsEnabled;
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/teacher/batches/${batchId}/student-uploads`,
        {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      setStudentUploadsEnabled(Boolean(data.studentUploadsEnabled));
      setMessage(
        next
          ? 'Students can now upload work for you to review.'
          : 'Student uploads disabled for this batch.'
      );
    } catch (err) {
      setError(err.message || 'Failed to update');
    }
  };

  const reviewShare = async (shareId, status) => {
    const feedback =
      status === 'returned'
        ? window.prompt('Optional feedback for the student:', '') || ''
        : '';
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/teacher/batches/${batchId}/shares/${shareId}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, teacherFeedback: feedback })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      await load();
    } catch (err) {
      setError(err.message || 'Update failed');
    }
  };

  const filteredMaterials =
    kindFilter === 'all'
      ? materials
      : materials.filter((m) => m.kind === kindFilter);

  return (
    <div className="live-lobby">
      <div className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>Materials · {batchName || 'Batch'}</h3>
          <button
            type="button"
            className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
            onClick={load}
          >
            Refresh
          </button>
        </div>
        <p className="live-attendance__note">
          Upload writing (PDF/DOC), handouts, projects, or extra videos (outside live class). Videos can
          also appear in Classroom. Enable student uploads so learners can share work for review.
        </p>
        {folderLink && (
          <p className="live-lobby__muted">
            Drive folder:{' '}
            <a href={folderLink} target="_blank" rel="noopener noreferrer">
              Open folder
            </a>
          </p>
        )}

        <div className="live-lobby__chip-row" style={{ marginBottom: '0.85rem' }}>
          <button
            type="button"
            className={`live-lobby__chip${tab === 'library' ? ' is-active' : ''}`}
            onClick={() => setTab('library')}
          >
            Library ({materials.length})
          </button>
          <button
            type="button"
            className={`live-lobby__chip${tab === 'shares' ? ' is-active' : ''}`}
            onClick={() => setTab('shares')}
          >
            Student shares ({shares.length})
          </button>
        </div>

        {tab === 'library' && (
          <>
            <div className="live-session__cta" style={{ marginBottom: '0.85rem', flexWrap: 'wrap' }}>
              <label className="live-lobby__muted" style={{ display: 'grid', gap: '0.25rem' }}>
                Type
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {MATERIAL_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              {kind === 'video' && (
                <label className="live-lobby__muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={addAsLecture}
                    onChange={(e) => setAddAsLecture(e.target.checked)}
                  />
                  Also add to Classroom
                </label>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_BY_KIND[kind]}
                style={{ display: 'none' }}
                onChange={onUpload}
              />
              <button
                type="button"
                className="live-lobby__btn live-lobby__btn--primary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Upload to Drive'}
              </button>
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                aria-label="Filter materials"
              >
                <option value="all">All types</option>
                {MATERIAL_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="live-lobby__alert live-lobby__alert--err">{error}</p>}
            {message && <p className="live-lobby__alert live-lobby__alert--ok">{message}</p>}
            {loading ? (
              <p className="live-lobby--empty">Loading materials…</p>
            ) : filteredMaterials.length === 0 ? (
              <div className="live-lobby--empty">
                No materials yet. Upload writing, a handout, or an extra video.
              </div>
            ) : (
              <ul className="live-lobby__list">
                {filteredMaterials.map((m) => (
                  <li key={m.id} className="live-session">
                    <div className="live-session__top">
                      <div>
                        <h4 className="live-session__title">{m.name}</h4>
                        <p className="live-session__meta">
                          {m.kind}
                          {m.liveClassId ? ' · session material' : ''}
                          {m.classroomLectureId ? ' · Classroom lecture' : ''}
                          {m.createdAt
                            ? ` · ${new Date(m.createdAt).toLocaleDateString('en-IN')}`
                            : ''}
                        </p>
                      </div>
                      <span className="live-session__badge">{m.kind}</span>
                    </div>
                    <div className="live-session__cta">
                      {m.driveLink && (
                        <a
                          className="live-lobby__btn live-lobby__btn--primary"
                          href={m.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      )}
                      <button
                        type="button"
                        className="live-lobby__btn live-lobby__btn--danger"
                        onClick={() => remove(m.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'shares' && (
          <>
            <div className="live-session__cta" style={{ marginBottom: '0.85rem' }}>
              <button
                type="button"
                className={`live-lobby__btn ${
                  studentUploadsEnabled ? 'live-lobby__btn--primary' : 'live-lobby__btn--ghost'
                }`}
                onClick={toggleStudentUploads}
              >
                {studentUploadsEnabled ? 'Student uploads: ON' : 'Student uploads: OFF'}
              </button>
            </div>
            <p className="live-attendance__note">
              When ON, students in this batch can upload assignments, writing, or videos for you to
              review below.
            </p>
            {error && <p className="live-lobby__alert live-lobby__alert--err">{error}</p>}
            {message && <p className="live-lobby__alert live-lobby__alert--ok">{message}</p>}
            {loading ? (
              <p className="live-lobby--empty">Loading shares…</p>
            ) : shares.length === 0 ? (
              <div className="live-lobby--empty">
                No student uploads yet.
                {!studentUploadsEnabled ? ' Turn on student uploads to collect work.' : ''}
              </div>
            ) : (
              <ul className="live-lobby__list">
                {shares.map((s) => (
                  <li key={s.id} className="live-session">
                    <div className="live-session__top">
                      <div>
                        <h4 className="live-session__title">{s.title}</h4>
                        <p className="live-session__meta">
                          {s.studentName || s.studentId} · {s.kind} · {s.status}
                          {s.createdAt
                            ? ` · ${new Date(s.createdAt).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata'
                              })}`
                            : ''}
                        </p>
                        {s.note ? <p className="live-lobby__muted">{s.note}</p> : null}
                        {s.teacherFeedback ? (
                          <p className="live-lobby__muted">Feedback: {s.teacherFeedback}</p>
                        ) : null}
                      </div>
                      <span className="live-session__badge">{s.status}</span>
                    </div>
                    <div className="live-session__cta">
                      {s.driveLink && (
                        <a
                          className="live-lobby__btn live-lobby__btn--primary"
                          href={s.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open file
                        </a>
                      )}
                      {s.status === 'submitted' && (
                        <>
                          <button
                            type="button"
                            className="live-lobby__btn live-lobby__btn--ghost"
                            onClick={() => reviewShare(s.id, 'reviewed')}
                          >
                            Mark reviewed
                          </button>
                          <button
                            type="button"
                            className="live-lobby__btn live-lobby__btn--ghost"
                            onClick={() => reviewShare(s.id, 'returned')}
                          >
                            Return w/ feedback
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
