import React, { useState, useEffect, useRef } from 'react';
import PythonFlowAnimator from './PythonFlowAnimator';
import DatatypeUniverse from './DatatypeUniverse';
import NormalDistributionMountain from './NormalDistributionMountain';
import KMeansClusterTheater from './KMeansClusterTheater';
import DataAnalysisVisualizer from './DataAnalysisVisualizer';
import './resources.css';

export default function ToolkitExplorer({ universe, activeCategory = 'All', tools = [] }) {
    // Tab selector for Data Science AI visualizers
    const [activeDsTab, setActiveDsTab] = useState('python-flow');

    // Define tabs mapping to categories
    const categoryTabs = {
        'python-fundamentals': ['python-flow', 'datatype-universe'],
        'statistics-mathematics': ['normal-mountain'],
        'data-analysis': ['data-visualizer'],
        'supervised-learning': ['gradient-descent'],
        'unsupervised-learning': ['kmeans-theater'],
        'deep-learning-ai': ['nn-builder']
    };

    // Determine which tabs to display based on activeCategory
    const allowedTabs = activeCategory === 'All' 
        ? ['python-flow', 'datatype-universe', 'normal-mountain', 'data-visualizer', 'gradient-descent', 'kmeans-theater', 'nn-builder']
        : (categoryTabs[activeCategory] || []);

    // Automatically sync active visualizer tab with the sidebar module category
    useEffect(() => {
        if (!activeCategory || activeCategory === 'All') {
            if (!allowedTabs.includes(activeDsTab)) {
                setActiveDsTab('python-flow');
            }
            return;
        }

        const allowed = categoryTabs[activeCategory] || [];
        if (allowed.length > 0) {
            if (!allowed.includes(activeDsTab)) {
                setActiveDsTab(allowed[0]);
            }
        } else {
            setActiveDsTab('');
        }
    }, [activeCategory]);

    // DS States (Gradient Descent)
    const [lr, setLr] = useState(0.1);
    const [optimizer, setOptimizer] = useState('SGD');
    const [gdPoints, setGdPoints] = useState([]);
    const canvasRef = useRef(null);

    // NN Builder States
    const [layers, setLayers] = useState([
        { type: 'Input', units: 784 },
        { type: 'Dense', units: 128 },
        { type: 'Dense', units: 64 },
        { type: 'Output', units: 10 }
    ]);

    // Cyber Security States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('All');

    // Run Gradient Descent Simulation (simple 2D visualization)
    useEffect(() => {
        if (universe !== 'data-science-ai' || activeDsTab !== 'gradient-descent' || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw 2D Loss Function: y = x^2
        ctx.strokeStyle = '#484F58';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = -150; x <= 150; x++) {
            const canvasX = x + 175;
            const y = (x * x) / 100;
            const canvasY = 175 - y;
            if (x === -150) ctx.moveTo(canvasX, canvasY);
            else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();

        // Calculate GD steps starting at x = 120
        let currentX = 120;
        const steps = [];
        for (let i = 0; i < 20; i++) {
            const y = (currentX * currentX) / 100;
            steps.push({ x: currentX, y });
            
            // gradient of x^2 is 2x
            const gradient = (2 * currentX) / 100;
            
            // update rule depends on optimizer
            if (optimizer === 'SGD') {
                currentX = currentX - lr * gradient * 50;
            } else {
                // Adam approximation (faster decay)
                currentX = currentX - lr * Math.sign(gradient) * 15;
            }
        }

        // Draw optimization steps
        ctx.fillStyle = '#6366F1';
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 1.5;
        
        steps.forEach((p, idx) => {
            const canvasX = p.x + 175;
            const canvasY = 175 - p.y;
            
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
            ctx.fill();

            if (idx > 0) {
                const prev = steps[idx - 1];
                ctx.beginPath();
                ctx.moveTo(prev.x + 175, 175 - prev.y);
                ctx.lineTo(canvasX, canvasY);
                ctx.stroke();
            }
        });

        setGdPoints(steps);
    }, [lr, optimizer, universe, activeDsTab]);

    // Calculate parameter counts
    const calculateParams = () => {
        let total = 0;
        for (let i = 1; i < layers.length; i++) {
            const prev = layers[i - 1].units;
            const curr = layers[i].units;
            total += (prev * curr) + curr; // weights + biases
        }
        return total.toLocaleString();
    };

    if (universe === 'data-science-ai') {
        return (
            <div style={{ marginTop: '30px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px', color: '#F0F6FC' }}>Interactive Concept Visualizers</h2>
                
                {/* Visualizer Category Tabs */}
                <div className="viz-tabs-row">
                    {allowedTabs.includes('python-flow') && (
                        <button 
                            onClick={() => setActiveDsTab('python-flow')}
                            className={`viz-tab-btn ${activeDsTab === 'python-flow' ? 'active' : ''}`}
                        >
                            🐍 Python Flow
                        </button>
                    )}
                    {allowedTabs.includes('datatype-universe') && (
                        <button 
                            onClick={() => setActiveDsTab('datatype-universe')}
                            className={`viz-tab-btn ${activeDsTab === 'datatype-universe' ? 'active' : ''}`}
                        >
                            🌌 Datatype Universe
                        </button>
                    )}
                    {allowedTabs.includes('data-visualizer') && (
                        <button 
                            onClick={() => setActiveDsTab('data-visualizer')}
                            className={`viz-tab-btn ${activeDsTab === 'data-visualizer' ? 'active' : ''}`}
                        >
                            📈 Data Visualizer
                        </button>
                    )}
                    {allowedTabs.includes('normal-mountain') && (
                        <button 
                            onClick={() => setActiveDsTab('normal-mountain')}
                            className={`viz-tab-btn ${activeDsTab === 'normal-mountain' ? 'active' : ''}`}
                        >
                            🏔️ Normal distribution
                        </button>
                    )}
                    {allowedTabs.includes('gradient-descent') && (
                        <button 
                            onClick={() => setActiveDsTab('gradient-descent')}
                            className={`viz-tab-btn ${activeDsTab === 'gradient-descent' ? 'active' : ''}`}
                        >
                            📈 Gradient Descent
                        </button>
                    )}
                    {allowedTabs.includes('kmeans-theater') && (
                        <button 
                            onClick={() => setActiveDsTab('kmeans-theater')}
                            className={`viz-tab-btn ${activeDsTab === 'kmeans-theater' ? 'active' : ''}`}
                        >
                            🎭 K-Means Clustering
                        </button>
                    )}
                    {allowedTabs.includes('nn-builder') && (
                        <button 
                            onClick={() => setActiveDsTab('nn-builder')}
                            className={`viz-tab-btn ${activeDsTab === 'nn-builder' ? 'active' : ''}`}
                        >
                            🧠 Neural Network Builder
                        </button>
                    )}
                </div>

                {/* Tab Views */}
                {activeDsTab === 'gradient-descent' && allowedTabs.includes('gradient-descent') && (
                    <div className="viz-panel-grid">
                        <div className="viz-canvas-container">
                            <canvas ref={canvasRef} width="350" height="200" style={{ maxWidth: '100%' }} />
                        </div>
                        <div className="viz-sidebar">
                            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Gradient Descent Convergence</h3>
                            <div className="viz-control-group">
                                <span className="viz-control-label">
                                    <span>Learning Rate</span>
                                    <span className="viz-control-value">{lr}</span>
                                </span>
                                <input 
                                    type="range" 
                                    min="0.01" 
                                    max="0.5" 
                                    step="0.01" 
                                    value={lr} 
                                    onChange={(e) => setLr(parseFloat(e.target.value))}
                                    className="viz-slider"
                                />
                            </div>
                            <div className="viz-control-group">
                                <label className="viz-control-label">Optimizer</label>
                                <select 
                                    value={optimizer} 
                                    onChange={(e) => setOptimizer(e.target.value)}
                                    style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F6FC', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                                >
                                    <option value="SGD">Stochastic Gradient Descent (SGD)</option>
                                    <option value="Adam">Adam (Adaptive Estimation)</option>
                                </select>
                            </div>
                            <div className="viz-equation-bar">
                                <div className="viz-equation-label">Update Formula</div>
                                <div className="viz-equation-math">θ_t = θ_t-1 - η * ∇J(θ)</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeDsTab === 'nn-builder' && allowedTabs.includes('nn-builder') && (
                    <div className="viz-panel-grid">
                        <div className="viz-canvas-container" style={{ flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
                                {layers.map((layer, idx) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                        <div style={{
                                            background: idx === 0 ? '#10B981' : idx === layers.length - 1 ? '#EF4444' : '#6366F1',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            color: '#fff',
                                            fontSize: '11px'
                                        }}>
                                            {layer.units}
                                        </div>
                                        <span style={{ fontSize: '10px', color: '#8B949E' }}>{layer.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="viz-sidebar">
                            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>NN Architect</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                                {layers.map((layer, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '8px 12px', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '12px' }}>{layer.type} Layer ({idx === 0 ? 'Input' : idx === layers.length - 1 ? 'Output' : `Hidden #${idx}`})</span>
                                        <input 
                                            type="number"
                                            value={layer.units}
                                            onChange={(e) => {
                                                const updated = [...layers];
                                                updated[idx].units = parseInt(e.target.value) || 0;
                                                setLayers(updated);
                                            }}
                                            style={{ width: '70px', background: '#080C14', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F6FC', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                <div>
                                    <span style={{ fontSize: '10px', color: '#8B949E', display: 'block' }}>Total Parameters</span>
                                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#6366F1' }}>{calculateParams()}</span>
                                </div>
                                <button 
                                    onClick={() => setLayers([...layers.slice(0, -1), { type: 'Dense', units: 32 }, layers[layers.length - 1]])}
                                    className="viz-btn-primary"
                                >
                                    + Add Layer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeDsTab === 'python-flow' && allowedTabs.includes('python-flow') && <PythonFlowAnimator />}
                {activeDsTab === 'datatype-universe' && allowedTabs.includes('datatype-universe') && <DatatypeUniverse />}
                {activeDsTab === 'normal-mountain' && allowedTabs.includes('normal-mountain') && <NormalDistributionMountain />}
                {activeDsTab === 'kmeans-theater' && allowedTabs.includes('kmeans-theater') && <KMeansClusterTheater />}
                {activeDsTab === 'data-visualizer' && allowedTabs.includes('data-visualizer') && <DataAnalysisVisualizer />}
            </div>
        );
    }

    // Cyber Security Universe: Attack Chain Explorer
    const columns = [
        { name: 'Reconnaissance', icon: '🔍', phase: 'recon' },
        { name: 'Scanning & Enumeration', icon: '📡', phase: 'scanning' },
        { name: 'Exploitation', icon: '⚔️', phase: 'exploitation' },
        { name: 'Privilege Escalation', icon: '🔑', phase: 'privilege-escalation' }
    ];

    const filteredTools = tools.filter(tool => {
        const matchesSearch = tool.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (tool.tags || []).some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (selectedPlatform === 'All') return matchesSearch;
        return matchesSearch && (tool.content?.platforms || []).includes(selectedPlatform.toLowerCase());
    });

    return (
        <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', color: '#F0F6FC' }}>🛡️ Interactive Kill Chain Explorer</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="text" 
                        placeholder="Search toolkit..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F6FC', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                    />
                    <select
                        value={selectedPlatform}
                        onChange={(e) => setSelectedPlatform(e.target.value)}
                        style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F6FC', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                    >
                        <option value="All">All Platforms</option>
                        <option value="Linux">Linux</option>
                        <option value="Windows">Windows</option>
                        <option value="macOS">macOS</option>
                    </select>
                </div>
            </div>

            <div className="res-toolkit-columns">
                {columns.map((col, idx) => {
                    const colTools = filteredTools.filter(t => t.categorySlug === col.phase || (t.tags || []).includes(col.phase));
                    return (
                        <div key={idx} className="res-toolkit-col">
                            <div className="res-toolkit-header">
                                <span>{col.icon} {col.name}</span>
                                <span style={{ float: 'right', opacity: 0.6 }}>({colTools.length})</span>
                            </div>
                            
                            {colTools.length === 0 ? (
                                <div style={{ fontSize: '11px', color: '#484F58', textAlign: 'center', padding: '20px' }}>
                                    No tools available
                                </div>
                            ) : (
                                colTools.map((tool, tIdx) => (
                                    <div 
                                        key={tIdx} 
                                        className="res-glass-card" 
                                        style={{ padding: '12px', cursor: 'pointer', background: 'rgba(13,17,23,0.9)' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600' }}>{tool.title}</span>
                                            <span style={{ 
                                                width: '8px', 
                                                height: '8px', 
                                                borderRadius: '50%', 
                                                background: tool.difficulty === 'beginner' ? '#10B981' : tool.difficulty === 'intermediate' ? '#F59E0B' : '#EF4444' 
                                            }} />
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#8B949E', marginTop: '6px', margin: '4px 0 0 0' }}>{tool.description}</p>
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                                            {(tool.content?.platforms || []).map((p, pIdx) => (
                                                <span key={pIdx} style={{ fontSize: '9px', background: '#1A2332', padding: '1px 4px', borderRadius: '3px', color: '#8B949E', textTransform: 'capitalize' }}>{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
