import React, { useState, useEffect, useRef } from 'react';
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

  // Proctoring States
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [cheatingLogs, setCheatingLogs] = useState([]);

  const isAlerting = useRef(false);

  useEffect(() => {
    startAttempt();
  }, [assessmentId]);

  // Proctoring Event Listeners
  useEffect(() => {
    if (!attemptId) return;

    const triggerAlert = (msg) => {
      if (isAlerting.current) return;
      isAlerting.current = true;
      alert(msg);
      isAlerting.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          const logEntry = { timestamp: new Date(), event: `Tab Switched / Hidden (Total: ${newCount})` };
          setCheatingLogs(logs => [...logs, logEntry]);
          
          triggerAlert(`⚠️ INCIDENT LOGGED!\n\nTab switching detected. You have accumulated ${newCount} tab switch violation(s).\n\nFocus must remain on the exam tab at all times.`);
          
          saveProctoringUpdate(newCount, focusLossCount, logEntry);
          return newCount;
        });
      }
    };

    const handleWindowBlur = () => {
      setTimeout(() => {
        if (isAlerting.current) return;
        setFocusLossCount(prev => {
          const newCount = prev + 1;
          const logEntry = { timestamp: new Date(), event: `Window Focus Lost (Total: ${newCount})` };
          setCheatingLogs(logs => [...logs, logEntry]);
          
          triggerAlert(`⚠️ INCIDENT LOGGED!\n\nFocus lost from the exam window. You have accumulated ${newCount} focus loss violation(s).\n\nPlease return to the exam immediately.`);
          
          saveProctoringUpdate(tabSwitchCount, newCount, logEntry);
          return newCount;
        });
      }, 100);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerAlert('⚠️ Right-click is disabled during this secure exam.');
    };

    const handleCopy = (e) => {
      e.preventDefault();
      triggerAlert('⚠️ Copying question content is strictly prohibited.');
    };

    const handleCut = (e) => {
      e.preventDefault();
      triggerAlert('⚠️ Cutting text is prohibited.');
    };

    const handleSelectStart = (e) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [attemptId, tabSwitchCount, focusLossCount]);

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
  }, [answers, attemptId, tabSwitchCount, focusLossCount]);

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

  const saveProctoringUpdate = async (tabCount, focusCount, logEntry) => {
    try {
      const token = localStorage.getItem('token');
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        studentAnswer: ans
      }));
      await axios.post('/api/assessment-studio/attempts/autosave', {
        attemptId,
        answers: formattedAnswers,
        tabSwitchCount: tabCount,
        focusLossCount: focusCount,
        cheatingLog: logEntry
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Proctoring save failed', err);
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
        answers: formattedAnswers,
        tabSwitchCount,
        focusLossCount
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
        answers: formattedAnswers,
        tabSwitchCount,
        focusLossCount,
        cheatingLogs
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px', background: '#0f172a', color: '#f8fafc' }}>
        <div className="loader"></div>
        <p>Initializing Secure Assessment Session...</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const formattedMinutes = Math.floor(timeLeft / 60);
  const formattedSeconds = timeLeft % 60;

  return (
    <div className="assessment-attempt-frame dark-theme" style={{ background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .assessment-attempt-frame.dark-theme {
          background: #0f172a !important;
          color: #f8fafc !important;
          font-family: 'Outfit', 'Inter', sans-serif;
        }
        .assessment-attempt-frame.dark-theme .attempt-topbar {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
          padding: 16px 24px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .assessment-attempt-frame.dark-theme .attempt-main {
          display: grid;
          grid-template-columns: 3fr 1fr;
          gap: 24px;
        }
        .assessment-attempt-frame.dark-theme .question-panel {
          background: #1e293b !important;
          border: 1px solid #334155 !important;
          border-radius: 16px;
          padding: 36px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .assessment-attempt-frame.dark-theme .navigator-panel {
          background: #1e293b !important;
          border: 1px solid #334155 !important;
          border-radius: 16px;
          padding: 24px;
        }
        .assessment-attempt-frame.dark-theme .nav-dot {
          aspect-ratio: 1;
          border: 1px solid #475569 !important;
          border-radius: 8px;
          background: none;
          color: #cbd5e1;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .assessment-attempt-frame.dark-theme .nav-dot:hover {
          background: #334155 !important;
        }
        .assessment-attempt-frame.dark-theme .nav-dot.active {
          border-color: #6366f1 !important;
          background: rgba(99, 102, 241, 0.15) !important;
          color: #818cf8 !important;
        }
        .assessment-attempt-frame.dark-theme .nav-dot.answered {
          background: #4f46e5 !important;
          color: white !important;
          border-color: #4f46e5 !important;
        }
        .assessment-attempt-frame.dark-theme .nav-dot.flagged {
          border-color: #d97706 !important;
          background: rgba(217, 119, 6, 0.15) !important;
          color: #fbbf24 !important;
        }
        .watermarked-container {
          position: relative;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><text fill='rgba(255,255,255,0.025)' font-size='12' font-family='sans-serif' x='150' y='100' transform='rotate(-25 150 100)' text-anchor='middle'>SECURE EXAM SYSTEM</text><text fill='rgba(255,255,255,0.015)' font-size='9' font-family='sans-serif' x='150' y='130' transform='rotate(-25 150 100)' text-anchor='middle'>DO NOT COPY / OCR PROTECTED</text></svg>");
          background-repeat: repeat;
          border-radius: 12px;
          padding: 24px;
          border: 1px dashed rgba(255,255,255,0.08);
          margin-bottom: 24px;
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        .blinking-violation {
          animation: blink 1.2s infinite;
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          fontWeight: bold;
          fontSize: 1rem;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>
      <ToastContainer />
      
      <div className="attempt-topbar">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#f8fafc' }}>{assessment.title}</h2>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Secure Exam Mode</span>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {(tabSwitchCount > 0 || focusLossCount > 0) && (
            <div className="blinking-violation" style={{ fontWeight: 'bold' }}>
              ⚠️ Violations: {tabSwitchCount + focusLossCount}
            </div>
          )}

          <div style={{ background: '#334155', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', color: timeLeft < 60 ? '#ef4444' : '#f8fafc' }}>
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
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 'bold' }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <button 
              onClick={() => toggleFlag(currentQuestion._id)}
              style={{
                background: flagged[currentQuestion._id] ? 'rgba(217, 119, 6, 0.2)' : 'none',
                border: '1px solid #475569', color: flagged[currentQuestion._id] ? '#fbbf24' : '#cbd5e1',
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              🚩 {flagged[currentQuestion._id] ? 'Flagged' : 'Flag Question'}
            </button>
          </div>

          <div className="watermarked-container">
            <h3 style={{ margin: 0, lineHeight: '1.5', fontSize: '1.25rem', color: '#f8fafc' }}>{currentQuestion.questionText}</h3>
          </div>

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
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : '#1e293b',
                      border: isSelected ? '2px solid #6366f1' : '1px solid #475569',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: isSelected ? '600' : 'normal',
                      color: isSelected ? '#818cf8' : '#cbd5e1'
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
              style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '1rem' }}
            />
          )}

          {currentQuestion.type === 'coding' && (
            <textarea 
              rows="12"
              placeholder="// Enter your code here..."
              value={answers[currentQuestion._id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
              style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontFamily: 'Courier New, monospace', fontSize: '0.95rem' }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px' }}>
            <button 
              className="btn-secondary" 
              disabled={currentIndex === 0} 
              onClick={() => setCurrentIndex(prev => prev - 1)}
              style={{ background: '#1e293b', color: '#cbd5e1', borderColor: '#475569' }}
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
          <h4 style={{ margin: 0, color: '#f8fafc' }}>Question Navigator</h4>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 16px 0' }}>Quickly jump to any question.</p>
          
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

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#4f46e5', borderRadius: '3px' }} />
              Answered
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(217, 119, 6, 0.2)', border: '1px solid #d97706', borderRadius: '3px' }} />
              Flagged
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'none', border: '1px solid #475569', borderRadius: '3px' }} />
              Unanswered
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentView;
