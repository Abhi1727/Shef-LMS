import React, { useState, useEffect } from 'react';
import './resources.css';

export default function DataAnalysisVisualizer() {
    const [operation, setOperation] = useState('pandas-filter'); // pandas-filter, numpy-vector, seaborn-plot, data-cleaning
    const [step, setStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [processedIndex, setProcessedIndex] = useState(-1);

    // Initial Data
    const initialDataset = [
        { id: 1, name: 'Alice', subject: 'Python', score: 85, completed: true },
        { id: 2, name: 'Bob', subject: 'ML', score: 42, completed: false },
        { id: 3, name: 'Charlie', subject: 'Python', score: 95, completed: true },
        { id: 4, name: 'Diana', subject: 'Stats', score: 72, completed: true },
        { id: 5, name: 'Ethan', subject: 'ML', score: 58, completed: false },
    ];

    const [dataset, setDataset] = useState(initialDataset);

    // Code snippets
    const codeSnippets = {
        'pandas-filter': `# Filter students scoring > 60
df_filtered = df[df['score'] > 60]`,
        'numpy-vector': `# Boost all ML scores by 10%
scores = np.array(df['score'])
is_ml = np.array(df['subject'] == 'ML')
scores[is_ml] = np.round(scores[is_ml] * 1.1)`,
        'data-cleaning': `# Fill missing values & cast
df['score'] = df['score'].fillna(df['score'].mean())
df['completed'] = df['completed'].astype(bool)`,
        'seaborn-plot': `# Generate subject score distribution
sns.barplot(data=df, x='subject', y='score', palette='viridis')`
    };

    // Reset simulator when operation changes
    useEffect(() => {
        setStep(0);
        setIsPlaying(false);
        setProcessedIndex(-1);
        setDataset(initialDataset);
    }, [operation]);

    // Step execution simulator
    useEffect(() => {
        let interval = null;
        if (isPlaying) {
            interval = setInterval(() => {
                setProcessedIndex(prev => {
                    const next = prev + 1;
                    if (next >= initialDataset.length) {
                        setIsPlaying(false);
                        return -1;
                    }
                    return next;
                });
            }, 800);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    // Apply operations step by step
    const getActiveDataset = () => {
        if (operation === 'pandas-filter') {
            return initialDataset.filter((row, idx) => {
                if (idx > processedIndex && processedIndex !== -1) return true; // Show all until processed
                return row.score > 60;
            });
        }
        if (operation === 'numpy-vector') {
            return initialDataset.map((row, idx) => {
                if (idx <= processedIndex) {
                    if (row.subject === 'ML') {
                        return { ...row, score: Math.round(row.score * 1.1) };
                    }
                }
                return row;
            });
        }
        if (operation === 'data-cleaning') {
            return initialDataset.map((row, idx) => {
                if (idx <= processedIndex) {
                    return { ...row, score: row.score || 70, completed: Boolean(row.completed) };
                }
                return row;
            });
        }
        return initialDataset;
    };

    const currentData = getActiveDataset();

    return (
        <div className="viz-panel-grid">
            <div className="viz-canvas-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: 'rgba(8, 12, 20, 0.4)', borderRadius: '12px', minHeight: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid var(--res-border-subtle)', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--res-accent-primary)' }}>
                        🖥️ {operation === 'seaborn-plot' ? 'Seaborn Output Canvas' : 'Pandas DataFrame Sandbox'}
                    </span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
                    </div>
                </div>

                {operation === 'seaborn-plot' ? (
                    /* Visualizing charts/plots */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '25px', height: '140px', borderBottom: '2px solid rgba(255,255,255,0.1)', borderLeft: '2px solid rgba(255,255,255,0.1)', padding: '10px 20px', width: '80%' }}>
                            {/* Python Bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1 }}>
                                <div style={{ 
                                    background: 'linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)', 
                                    width: '100%', 
                                    height: '90px', 
                                    borderRadius: '4px 4px 0 0',
                                    animation: 'growUp 0.8s ease-out',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }} />
                                <span style={{ fontSize: '10px', color: '#8B949E' }}>Python (90)</span>
                            </div>
                            {/* ML Bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1 }}>
                                <div style={{ 
                                    background: 'linear-gradient(180deg, #10B981 0%, #059669 100%)', 
                                    width: '100%', 
                                    height: '50px', 
                                    borderRadius: '4px 4px 0 0',
                                    animation: 'growUp 0.8s ease-out 0.2s',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                }} />
                                <span style={{ fontSize: '10px', color: '#8B949E' }}>ML (50)</span>
                            </div>
                            {/* Stats Bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1 }}>
                                <div style={{ 
                                    background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)', 
                                    width: '100%', 
                                    height: '72px', 
                                    borderRadius: '4px 4px 0 0',
                                    animation: 'growUp 0.8s ease-out 0.4s',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                                }} />
                                <span style={{ fontSize: '10px', color: '#8B949E' }}>Stats (72)</span>
                            </div>
                        </div>
                        <style>{`
                            @keyframes growUp {
                                from { height: 0; }
                                to { height: 100%; }
                            }
                        `}</style>
                    </div>
                ) : (
                    /* DataFrame Table Layout */
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#F0F6FC' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>ID</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>Name</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>Subject</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: '#8B949E' }}>Score</th>
                                <th style={{ padding: '8px', textAlign: 'center', color: '#8B949E' }}>Completed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map((row, idx) => {
                                const isCurrentProcessing = idx === processedIndex;
                                const isHighlighted = operation === 'pandas-filter' && row.score > 60 && idx <= processedIndex;
                                
                                return (
                                    <tr 
                                        key={row.id} 
                                        style={{ 
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            background: isCurrentProcessing ? 'rgba(99, 102, 241, 0.15)' : isHighlighted ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                                            transition: 'background 0.3s ease'
                                        }}
                                    >
                                        <td style={{ padding: '8px' }}>{row.id}</td>
                                        <td style={{ padding: '8px', fontWeight: '500' }}>{row.name}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                background: row.subject === 'Python' ? 'rgba(99,102,241,0.1)' : row.subject === 'ML' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                                color: row.subject === 'Python' ? '#818CF8' : row.subject === 'ML' ? '#34D399' : '#FBBF24',
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                {row.subject}
                                            </span>
                                        </td>
                                        <td style={{ 
                                            padding: '8px', 
                                            textAlign: 'right',
                                            color: operation === 'numpy-vector' && row.subject === 'ML' && idx <= processedIndex ? '#10B981' : '#F0F6FC',
                                            fontWeight: operation === 'numpy-vector' && row.subject === 'ML' && idx <= processedIndex ? '700' : 'normal'
                                        }}>
                                            {row.score}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            {row.completed ? '✅' : '❌'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#F0F6FC' }}>DataFrame Manipulator</h3>
                
                <div className="viz-control-group">
                    <label className="viz-control-label">Operation Mode</label>
                    <select 
                        value={operation} 
                        onChange={(e) => setOperation(e.target.value)}
                        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F6FC', padding: '8px', borderRadius: '6px', fontSize: '13px', width: '100%' }}
                    >
                        <option value="pandas-filter">Pandas Filter Row Filtering</option>
                        <option value="numpy-vector">NumPy Vectorized Calculations</option>
                        <option value="data-cleaning">Missing Data & Imputations</option>
                        <option value="seaborn-plot">Seaborn / Matplotlib Render</option>
                    </select>
                </div>

                <div className="viz-equation-bar" style={{ minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="viz-equation-label">Python Source Code</div>
                    <pre style={{ margin: 0, fontSize: '11px', color: '#818CF8', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {codeSnippets[operation]}
                    </pre>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button 
                        onClick={() => {
                            if (processedIndex >= initialDataset.length - 1) {
                                setProcessedIndex(-1);
                            }
                            setIsPlaying(!isPlaying);
                        }}
                        className="viz-btn-primary"
                        style={{ flex: 1 }}
                    >
                        {isPlaying ? '⏸️ Pause' : '▶️ Run Vector'}
                    </button>
                    <button 
                        onClick={() => {
                            setIsPlaying(false);
                            setProcessedIndex(-1);
                            setDataset(initialDataset);
                        }}
                        className="viz-btn-secondary"
                        style={{ flex: 1 }}
                    >
                        🔄 Reset
                    </button>
                </div>
            </div>
        </div>
    );
}
