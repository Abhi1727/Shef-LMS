import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, showToast } from './Toast';
import './AssessmentStudio.css';

const StudentAssessmentResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);

  useEffect(() => {
    fetchResults();
  }, [attemptId]);

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/assessment-studio/attempts/${attemptId}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttempt(res.data);
      setLoading(false);
    } catch (err) {
      showToast('Error loading results', 'error');
      navigate('/dashboard');
    }
  };

  if (loading || !attempt) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px' }}>
        <div className="loader"></div>
        <p>Analyzing Performance Metrics...</p>
      </div>
    );
  }

  const isPassed = attempt.percentage >= (attempt.assessmentId?.passingMarks || 40);

  return (
    <div className="studio-container" style={{ padding: '40px 20px' }}>
      <ToastContainer />
      
      <div className="results-header-banner" style={{ background: isPassed ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
        <div style={{ fontSize: '3rem' }}>{isPassed ? '🎉' : '⏳'}</div>
        <h1 style={{ color: 'white', margin: '12px 0 6px 0' }}>{isPassed ? 'Assessment Passed!' : 'Requires Revision'}</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: 0 }}>
          {attempt.assessmentId?.title}
        </p>
        <div className="results-score" style={{ color: 'white', marginTop: '16px' }}>{attempt.percentage}%</div>
        <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.95rem' }}>
          Score: {attempt.score} / {attempt.maxScore} marks
        </div>
      </div>

      <div className="results-grid-cards">
        <div className="result-card">
          <h4>⏱️ Time Taken</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '8px 0 0 0', color: '#1e293b' }}>
            {Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s
          </p>
        </div>
        <div className="result-card">
          <h4>✅ Correct Questions</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '8px 0 0 0', color: '#10b981' }}>
            {attempt.answers.filter(a => a.isCorrect).length}
          </p>
        </div>
        <div className="result-card">
          <h4>❌ Incorrect Questions</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '8px 0 0 0', color: '#ef4444' }}>
            {attempt.answers.filter(a => !a.isCorrect).length}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginTop: '30px' }}>
        <div>
          <h3 style={{ marginBottom: '16px' }}>📚 Review Questions & Answers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {attempt.answers.map((ans, idx) => {
              const q = ans.questionId;
              if (!q) return null;
              return (
                <div key={idx} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>Question {idx + 1}</span>
                    <span style={{ 
                      fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold',
                      background: ans.isCorrect ? '#e0f2fe' : '#fee2e2',
                      color: ans.isCorrect ? '#0369a1' : '#991b1b'
                    }}>
                      {ans.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>{q.questionText}</h4>

                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <strong>Your Answer:</strong> {JSON.stringify(ans.studentAnswer || '(No answer provided)')}
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '12px', border: '1px solid #dcfce7' }}>
                    <strong>Correct Answer:</strong> {JSON.stringify(q.correctAnswer)}
                  </div>

                  {q.explanation && (
                    <div style={{ fontSize: '0.9rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '16px' }}>🧠 Performance Insights</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>✨ Strengths</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {attempt.strengths && attempt.strengths.map((st, i) => (
                  <span key={i} style={{ background: '#ecfdf5', color: '#047857', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    ✓ {st}
                  </span>
                ))}
                {(!attempt.strengths || attempt.strengths.length === 0) && (
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>No high-mastery topics identified yet.</p>
                )}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>⚠️ Focus Areas</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {attempt.weakAreas && attempt.weakAreas.map((wk, i) => (
                  <span key={i} style={{ background: '#fff1f2', color: '#b91c1c', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    ✗ {wk}
                  </span>
                ))}
                {(!attempt.weakAreas || attempt.weakAreas.length === 0) && (
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Excellent! No weak areas found.</p>
                )}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#4f46e5' }}>💡 Study Suggestions</h4>
              <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {attempt.learningSuggestions && attempt.learningSuggestions.map((sug, i) => (
                  <li key={i}>{sug}</li>
                ))}
                {(!attempt.learningSuggestions || attempt.learningSuggestions.length === 0) && (
                  <li>Keep studying current modules to maintain your high standing!</li>
                )}
              </ul>
            </div>

            <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentResults;
