import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, showToast } from './Toast';
import './AssessmentStudio.css';

const AssessmentStudio = ({ user }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sources, setSources] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Review states
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Builder states
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderForm, setBuilderForm] = useState({
    title: '',
    description: '',
    duration: 30,
    difficulty: 'medium',
    passingMarks: 40,
    negativeMarking: false,
    shuffleQuestions: true,
    shuffleOptions: true,
    retakeAllowed: true,
    questions: [], // IDs
    batchId: ''
  });

  // Question Bank Filter states
  const [filters, setFilters] = useState({
    type: '',
    difficulty: '',
    bloomLevel: '',
    topic: '',
    search: ''
  });

  useEffect(() => {
    fetchSources();
    fetchPendingQuestions();
    fetchQuestionBank();
    fetchAssessments();
    fetchAnalytics();
  }, []);

  const fetchSources = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/assessment-studio/knowledge-sources', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSources(res.data);
    } catch (err) {
      console.error('Error fetching sources', err);
    }
  };

  const fetchPendingQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/assessment-studio/questions/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingQuestions(res.data);
    } catch (err) {
      console.error('Error fetching pending questions', err);
    }
  };

  const fetchQuestionBank = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams(filters).toString();
      const res = await axios.get(`/api/assessment-studio/questions/bank?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestionBank(res.data);
    } catch (err) {
      console.error('Error fetching question bank', err);
    }
  };

  const fetchAssessments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/assessment-studio/assessments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssessments(res.data);
    } catch (err) {
      console.error('Error fetching assessments', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/assessment-studio/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching analytics', err);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleUploadFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async (file) => {
    setUploading(true);
    setUploadProgress(10);
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', uploadTitle || file.name);
    formData.append('description', uploadDesc);

    try {
      const token = localStorage.getItem('token');
      
      // Simulate progressive progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const res = await axios.post('/api/assessment-studio/upload', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadTitle('');
        setUploadDesc('');
        showToast('Document uploaded and AI questions generated!', 'success');
        fetchSources();
        fetchPendingQuestions();
      }, 500);

    } catch (err) {
      setUploading(false);
      setUploadProgress(0);
      showToast(err.response?.data?.message || 'Error uploading file', 'error');
    }
  };

  const handleQuestionAction = async (action, questionId, updatedData = null) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/assessment-studio/questions/review', {
        action,
        questionIds: [questionId],
        questionData: updatedData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showToast(`Question ${action}d successfully`, 'success');
      fetchPendingQuestions();
      fetchQuestionBank();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/assessment-studio/assessments', builderForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Assessment created and published successfully', 'success');
      setShowBuilder(false);
      setBuilderForm({
        title: '',
        description: '',
        duration: 30,
        difficulty: 'medium',
        passingMarks: 40,
        negativeMarking: false,
        shuffleQuestions: true,
        shuffleOptions: true,
        retakeAllowed: true,
        questions: [],
        batchId: ''
      });
      fetchAssessments();
    } catch (err) {
      showToast('Failed to build assessment', 'error');
    }
  };

  const toggleQuestionInBuilder = (qId) => {
    setBuilderForm(prev => {
      const questions = [...prev.questions];
      const index = questions.indexOf(qId);
      if (index > -1) {
        questions.splice(index, 1);
      } else {
        questions.push(qId);
      }
      return { ...prev, questions };
    });
  };

  return (
    <div className="studio-container">
      <ToastContainer />
      <div className="studio-header">
        <div>
          <h1>🧠 AI Assessment Studio</h1>
          <p>Generate, review, construct, and analyze student assessments from uploaded learning assets.</p>
        </div>
        <div className="studio-actions">
          <button className="btn-secondary" onClick={() => setActiveTab('upload')}>
            ➕ Upload Material
          </button>
          <button className="btn-primary" onClick={() => { setShowBuilder(true); setActiveTab('questions'); }}>
            📝 Assessment Builder
          </button>
        </div>
      </div>

      <nav className="studio-tabs">
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          📊 Dashboard
        </button>
        <button className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
          📂 Uploads & Processing
        </button>
        <button className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
          🔍 Pending Review ({pendingQuestions.length})
        </button>
        <button className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => { setActiveTab('questions'); fetchQuestionBank(); }}>
          🗃️ Question Bank ({questionBank.length})
        </button>
        <button className={`tab-btn ${activeTab === 'assessments' ? 'active' : ''}`} onClick={() => setActiveTab('assessments')}>
          📄 Assessments
        </button>
      </nav>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="studio-dashboard-tab">
          <div className="dashboard-grid">
            <div className="stat-box">
              <span className="stat-icon-large">📚</span>
              <div>
                <div className="stat-value">{sources.length}</div>
                <div className="stat-label">Knowledge Sources</div>
              </div>
            </div>
            <div className="stat-box">
              <span className="stat-icon-large">❓</span>
              <div>
                <div className="stat-value">{questionBank.length}</div>
                <div className="stat-label">Approved Questions</div>
              </div>
            </div>
            <div className="stat-box">
              <span className="stat-icon-large">📝</span>
              <div>
                <div className="stat-value">{assessments.length}</div>
                <div className="stat-label">Published Assessments</div>
              </div>
            </div>
            <div className="stat-box">
              <span className="stat-icon-large">📈</span>
              <div>
                <div className="stat-value">{analytics?.averageScore || 0}%</div>
                <div className="stat-label">Average Class Score</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px', marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>💡 Recent Knowledge Extraction & Recommendations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sources.map(src => (
                <div key={src._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{src.title}</strong>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Format: {src.fileFormat.toUpperCase()} • Size: {(src.fileSizeBytes / 1024).toFixed(1)} KB</div>
                  </div>
                  <span style={{ fontSize: '0.85rem', padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontWeight: 'bold' }}>
                    {src.status.toUpperCase()}
                  </span>
                </div>
              ))}
              {sources.length === 0 && <p style={{ color: '#64748b', margin: 0 }}>No knowledge documents uploaded yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD TAB */}
      {activeTab === 'upload' && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '36px' }}>
          <h3 style={{ margin: '0 0 24px 0' }}>Upload New Learning Material</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Document Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Machine Learning Basics Lecture 1"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Brief Description</label>
                <textarea 
                  rows="4"
                  placeholder="Describe the content. Helps AI scope difficulty and targets."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div>
              <div 
                className={`upload-dropzone ${dragActive ? 'dragover' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,.ppt,.pptx,.txt,.md,.html"
                />
                <div className="upload-icon">📁</div>
                <h4>Drag & Drop file here</h4>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '8px' }}>or click to browse from your computer (Max 20MB)</p>
                <span style={{ display: 'inline-block', marginTop: '16px', fontSize: '0.8rem', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', color: '#475569' }}>
                  Supports PDF, Word, PPTX, Markdown, Text, HTML
                </span>
              </div>

              {uploading && (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <span>Extracting Knowledge & Generating Questions...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PENDING REVIEW TAB */}
      {activeTab === 'review' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3>Questions Awaiting AI Review</h3>
            <div>
              <button className="btn-secondary" style={{ marginRight: '10px' }} onClick={async () => {
                const ids = pendingQuestions.map(q => q._id);
                if (ids.length) {
                  await Promise.all(ids.map(id => handleQuestionAction('approve', id)));
                }
              }}>
                ✅ Bulk Approve All
              </button>
              <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#fee2e2' }} onClick={async () => {
                const ids = pendingQuestions.map(q => q._id);
                if (ids.length) {
                  await Promise.all(ids.map(id => handleQuestionAction('reject', id)));
                }
              }}>
                ❌ Bulk Reject All
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pendingQuestions.map(q => (
              <div key={q._id} className="review-card">
                <div className="card-header-badge">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-medium">{q.type.toUpperCase()}</span>
                    <span className={`badge badge-${q.difficulty}`}>{q.difficulty.toUpperCase()}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Bloom: {q.bloomLevel.toUpperCase()}</span>
                  </div>
                  <span style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    AI Confidence: {Math.round(q.confidenceScore * 100)}%
                  </span>
                </div>
                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>{q.questionText}</h4>
                
                {q.options && q.options.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    {q.options.map((opt, i) => (
                      <div key={i} style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid #dcfce7', marginBottom: '12px' }}>
                  <strong>Correct Answer:</strong> {JSON.stringify(q.correctAnswer)}
                </div>

                {q.explanation && (
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}

                <div className="review-actions">
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { setSelectedQuestion(q); setIsEditing(true); }}>
                    ✏️ Edit & Save
                  </button>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#ef4444' }} onClick={() => handleQuestionAction('reject', q._id)}>
                    ❌ Reject
                  </button>
                  <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => handleQuestionAction('approve', q._id)}>
                    ✅ Approve
                  </button>
                </div>
              </div>
            ))}
            {pendingQuestions.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>All caught up! No pending questions to review.</p>}
          </div>
        </div>
      )}

      {/* QUESTION BANK TAB */}
      {activeTab === 'questions' && (
        <div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h4>🔍 Filter Question Bank</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '12px' }}>
              <select 
                value={filters.type} 
                onChange={(e) => { setFilters(prev => ({ ...prev, type: e.target.value })); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              >
                <option value="">All Types</option>
                <option value="mcq">Multiple Choice</option>
                <option value="true-false">True/False</option>
                <option value="fill-blank">Fill in the blank</option>
                <option value="coding">Coding Challenge</option>
              </select>

              <select 
                value={filters.difficulty} 
                onChange={(e) => { setFilters(prev => ({ ...prev, difficulty: e.target.value })); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>

              <select 
                value={filters.bloomLevel} 
                onChange={(e) => { setFilters(prev => ({ ...prev, bloomLevel: e.target.value })); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              >
                <option value="">All Bloom Levels</option>
                <option value="remember">Remember</option>
                <option value="understand">Understand</option>
                <option value="apply">Apply</option>
                <option value="analyze">Analyze</option>
                <option value="evaluate">Evaluate</option>
                <option value="create">Create</option>
              </select>

              <input 
                type="text" 
                placeholder="Topic..." 
                value={filters.topic}
                onChange={(e) => { setFilters(prev => ({ ...prev, topic: e.target.value })); }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />

              <button className="btn-primary" onClick={fetchQuestionBank}>
                Apply Filters
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questionBank.map(q => (
              <div key={q._id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', position: 'relative' }}>
                {showBuilder && (
                  <button 
                    onClick={() => toggleQuestionInBuilder(q._id)}
                    style={{
                      position: 'absolute', right: '20px', top: '20px',
                      background: builderForm.questions.includes(q._id) ? '#4f46e5' : 'white',
                      color: builderForm.questions.includes(q._id) ? 'white' : '#4f46e5',
                      border: '1px solid #4f46e5', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    {builderForm.questions.includes(q._id) ? '✓ Added' : '+ Add to assessment'}
                  </button>
                )}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-medium">{q.type.toUpperCase()}</span>
                  <span className={`badge badge-${q.difficulty}`}>{q.difficulty.toUpperCase()}</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Bloom: {q.bloomLevel.toUpperCase()}</span>
                </div>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>{q.questionText}</h5>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Topic: {q.topic} • Subtopic: {q.subtopic}</div>
              </div>
            ))}
            {questionBank.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>No approved questions in the library matching criteria.</p>}
          </div>
        </div>
      )}

      {/* PUBLISHED ASSESSMENTS TAB */}
      {activeTab === 'assessments' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {assessments.map(ass => (
            <div key={ass._id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {ass.status}
                </span>
                <h4 style={{ margin: '12px 0 8px 0', color: '#0f172a' }}>{ass.title}</h4>
                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 16px 0' }}>{ass.description || 'No description provided.'}</p>
                <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>⏱️ <strong>Duration:</strong> {ass.duration} minutes</div>
                  <div>❓ <strong>Questions:</strong> {ass.questions.length}</div>
                  <div>🎯 <strong>Passing Marks:</strong> {ass.passingMarks}%</div>
                </div>
              </div>
            </div>
          ))}
          {assessments.length === 0 && (
            <p style={{ color: '#64748b', gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
              No assessments created yet. Use the **Assessment Builder** to create one.
            </p>
          )}
        </div>
      )}

      {/* EDITOR MODAL */}
      {isEditing && selectedQuestion && (
        <div className="modal-overlay">
          <div className="modal-content-wide">
            <h3>Edit Question Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Question Text</label>
                <textarea 
                  rows="3"
                  value={selectedQuestion.questionText}
                  onChange={(e) => setSelectedQuestion({ ...selectedQuestion, questionText: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Difficulty</label>
                  <select 
                    value={selectedQuestion.difficulty}
                    onChange={(e) => setSelectedQuestion({ ...selectedQuestion, difficulty: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Bloom Level</label>
                  <select 
                    value={selectedQuestion.bloomLevel}
                    onChange={(e) => setSelectedQuestion({ ...selectedQuestion, bloomLevel: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="remember">Remember</option>
                    <option value="understand">Understand</option>
                    <option value="apply">Apply</option>
                    <option value="analyze">Analyze</option>
                    <option value="evaluate">Evaluate</option>
                    <option value="create">Create</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Correct Answer</label>
                <input 
                  type="text"
                  value={typeof selectedQuestion.correctAnswer === 'object' ? JSON.stringify(selectedQuestion.correctAnswer) : selectedQuestion.correctAnswer}
                  onChange={(e) => setSelectedQuestion({ ...selectedQuestion, correctAnswer: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Explanation</label>
                <textarea 
                  rows="2"
                  value={selectedQuestion.explanation}
                  onChange={(e) => setSelectedQuestion({ ...selectedQuestion, explanation: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                <button className="btn-primary" onClick={() => { handleQuestionAction('edit', selectedQuestion._id, selectedQuestion); setIsEditing(false); }}>
                  Save & Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSESSMENT BUILDER SIDE OVERLAY / FORM */}
      {showBuilder && (
        <div className="modal-overlay">
          <div className="modal-content-wide">
            <h3>📝 Assessment Builder</h3>
            <form onSubmit={handleCreateAssessment} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Assessment Title</label>
                <input 
                  type="text"
                  required
                  value={builderForm.title}
                  onChange={(e) => setBuilderForm({ ...builderForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Description</label>
                <textarea 
                  rows="2"
                  value={builderForm.description}
                  onChange={(e) => setBuilderForm({ ...builderForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Duration (min)</label>
                  <input 
                    type="number"
                    value={builderForm.duration}
                    onChange={(e) => setBuilderForm({ ...builderForm, duration: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Passing Marks (%)</label>
                  <input 
                    type="number"
                    value={builderForm.passingMarks}
                    onChange={(e) => setBuilderForm({ ...builderForm, passingMarks: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Overall Difficulty</label>
                  <select 
                    value={builderForm.difficulty}
                    onChange={(e) => setBuilderForm({ ...builderForm, difficulty: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={builderForm.negativeMarking}
                    onChange={(e) => setBuilderForm({ ...builderForm, negativeMarking: e.target.checked })}
                  />
                  Negative Marking
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={builderForm.shuffleQuestions}
                    onChange={(e) => setBuilderForm({ ...builderForm, shuffleQuestions: e.target.checked })}
                  />
                  Shuffle Questions
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={builderForm.shuffleOptions}
                    onChange={(e) => setBuilderForm({ ...builderForm, shuffleOptions: e.target.checked })}
                  />
                  Shuffle Options
                </label>
              </div>

              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '16px', borderRadius: '12px' }}>
                <strong>Selected Questions:</strong> {builderForm.questions.length} questions included in this quiz.
                <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#0369a1' }}>
                  Select questions from the **Question Bank** tab behind this panel to attach them.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBuilder(false)}>Close Builder</button>
                <button type="submit" className="btn-primary" disabled={builderForm.questions.length === 0}>
                  Create & Publish Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentStudio;
