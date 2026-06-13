import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, showToast } from './Toast';
import './AssessmentStudio.css';

const StudentAssessmentView = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: answerTextOrArray }
  const [flagged, setFlagged] = useState({}); // { questionId: boolean }
  const [timeLeft, setTimeLeft] = useState(0); // seconds

  useEffect(() => {
    startAttempt();
  }, [assessmentId]);

  // Timer Effect
  useEffect(() => {
    if (timeLeft <= 0 && !loading) {
      if (timeLeft === 0) {
        showToast('Time is up! Submitting your answers...', 'info');
        handleSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, loading]);

  // Auto-save Effect (saves state every 10 seconds)
  useEffect(() => {
    if (!attemptId) return;
    const autosaveInterval = setInterval(() => {
      autosaveProgress();
    }, 10000);

    return () => clearInterval(autosaveInterval);
  }, [answers, attemptId]);

  const startAttempt = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/assessment-studio/attempts/start', { assessmentId }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAttemptId(res.data.attemptId);
      setAssessment(res.data.assessment);
      setQuestions(res.data.assessment.questions);
      setTimeLeft(res.data.assessment.duration * 60);

      // Restore answers if any
      const restoredAnswers = {};
      res.data.answers.forEach(ans => {
        restoredAnswers[ans.questionId] = ans.studentAnswer;
      });
      setAnswers(restoredAnswers);

      setLoading(false);
    } catch (err) {
      showToast('Error starting assessment', 'error');
      navigate('/dashboard');
    }
  };

  const autosaveProgress = async () => {
    try {
      const token = localStorage.getItem('token');
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        studentAnswer: ans
      }));

      await axios.post('/api/assessment-studio/attempts/autosave', {
        attemptId,
        answers: formattedAnswers
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Autosave failed', err);
    }
  };

  const handleAnswerChange = (qId, ansVal) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: ansVal
    }));
  };

  const toggleFlag = (qId) => {
    setFlagged(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        studentAnswer: ans,
        timeTaken: 10 // Simulated average per question
      }));

      await axios.post('/api/assessment-studio/attempts/submit', {
        attemptId,
        answers: formattedAnswers
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showToast('Assessment submitted successfully!', 'success');
      navigate(`/student/assessment/results/${attemptId}`);
    } catch (err) {
      showToast('Submission failed', 'error');
      setLoading(false);
    }
  };

  if (loading || !assessment) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px' }}>
        <div className="loader"></div>
        <p>Initializing Secure Assessment Session...</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const formattedMinutes = Math.floor(timeLeft / 60);
  const formattedSeconds = timeLeft % 60;

  return (
    <div className="assessment-attempt-frame">
      <ToastContainer />
      <div className="attempt-topbar">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>{assessment.title}</h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Secure Exam Mode</span>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ background: '#f1f5f9', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', color: timeLeft < 60 ? '#ef4444' : '#1e293b' }}>
            ⏱️ {formattedMinutes}:{formattedSeconds < 10 ? '0' : ''}{formattedSeconds}
          </div>
          <button className="btn-primary" onClick={handleSubmit} style={{ background: '#10b981' }}>
            Submit Assessment
          </button>
        </div>
      </div>

      <div className="attempt-main">
        <div className="question-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold' }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <button 
              onClick={() => toggleFlag(currentQuestion._id)}
              style={{
                background: flagged[currentQuestion._id] ? '#fef3c7' : 'none',
                border: '1px solid #e2e8f0', color: flagged[currentQuestion._id] ? '#d97706' : '#64748b',
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              🚩 {flagged[currentQuestion._id] ? 'Flagged' : 'Flag Question'}
            </button>
          </div>

          <h3 style={{ margin: '0 0 24px 0', lineHeight: '1.5', fontSize: '1.25rem' }}>{currentQuestion.questionText}</h3>

          {/* Render Options based on type */}
          {(currentQuestion.type === 'mcq' || currentQuestion.type === 'true-false') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = answers[currentQuestion._id] === opt;
                return (
                  <div 
                    key={idx}
                    onClick={() => handleAnswerChange(currentQuestion._id, opt)}
                    style={{
                      padding: '16px 20px',
                      background: isSelected ? 'rgba(79, 70, 229, 0.05)' : 'white',
                      border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: isSelected ? '600' : 'normal'
                    }}
                  >
                    {opt}
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'fill-blank' && (
            <input 
              type="text"
              placeholder="Type your answer here..."
              value={answers[currentQuestion._id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
              style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
            />
          )}

          {currentQuestion.type === 'coding' && (
            <textarea 
              rows="12"
              placeholder="// Enter your code here..."
              value={answers[currentQuestion._id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
              style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontFamily: 'Courier New, monospace', fontSize: '0.95rem' }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px' }}>
            <button 
              className="btn-secondary" 
              disabled={currentIndex === 0} 
              onClick={() => setCurrentIndex(prev => prev - 1)}
            >
              Previous Question
            </button>
            <button 
              className="btn-primary" 
              disabled={currentIndex === questions.length - 1} 
              onClick={() => setCurrentIndex(prev => prev + 1)}
            >
              Next Question
            </button>
          </div>
        </div>

        <div className="navigator-panel">
          <h4 style={{ margin: 0 }}>Question Navigator</h4>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 16px 0' }}>Quickly jump to any question.</p>
          
          <div className="navigator-grid">
            {questions.map((q, idx) => {
              const isAnswered = answers[q._id] !== undefined && answers[q._id] !== '';
              const isFlagged = flagged[q._id];
              let classes = 'nav-dot';
              if (idx === currentIndex) classes += ' active';
              else if (isFlagged) classes += ' flagged';
              else if (isAnswered) classes += ' answered';

              return (
                <button 
                  key={q._id} 
                  className={classes}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#4f46e5', borderRadius: '3px' }} />
              Answered
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #eab308', borderRadius: '3px' }} />
              Flagged
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
              Unanswered
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentView;
