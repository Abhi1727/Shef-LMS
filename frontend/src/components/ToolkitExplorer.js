import React, { useState, useEffect, useRef } from 'react';
import PythonFlowAnimator from './PythonFlowAnimator';
import DatatypeUniverse from './DatatypeUniverse';
import NormalDistributionMountain from './NormalDistributionMountain';
import KMeansClusterTheater from './KMeansClusterTheater';
import DataAnalysisVisualizer from './DataAnalysisVisualizer';
import SqlJoinsVisualizer from './SqlJoinsVisualizer';
import './resources.css';

export default function ToolkitExplorer({ universe, activeCategory = 'All', tools = [] }) {
    // Tab selector for Data Science AI visualizers
    const [activeDsTab, setActiveDsTab] = useState('python-flow');
    const [pythonPreset, setPythonPreset] = useState('basics');
    const [analysisPreset, setAnalysisPreset] = useState('basics');
    const [statsPreset, setStatsPreset] = useState({ mean: 0, std: 1, z: 1, activeId: 'prob_theory' });
    const [supervisedPreset, setSupervisedPreset] = useState({ lr: 0.1, optimizer: 'SGD', activeId: 'ml_mechanisms' });
    const [unsupervisedPreset, setUnsupervisedPreset] = useState({ k: 3, method: 'kmeans++', activeId: 'kmeans_basics' });
    const [nnPresetId, setNnPresetId] = useState('nn_basics');

    // Define tabs mapping to categories
    const categoryTabs = {
        'python-fundamentals': ['python-flow', 'datatype-universe'],
        'statistics-mathematics': ['normal-mountain'],
        'advanced-statistics': ['normal-mountain'],
        'data-analysis': ['data-visualizer'],
        'eda-data': ['data-visualizer'],
        'supervised-learning': ['gradient-descent'],
        'deep-learning-ai': ['nn-builder'],
        'nlp-mlops': ['nn-builder'],
        'mysql': ['sql-joins']
    };

    // Determine which tabs to display based on activeCategory
    const allowedTabs = activeCategory === 'All' 
        ? ['python-flow', 'datatype-universe', 'normal-mountain', 'data-visualizer', 'gradient-descent', 'kmeans-theater', 'nn-builder', 'sql-joins']
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
        if (allowedTabs.length === 0) {
            return (
                <div className="res-glass-card" style={{ marginTop: '30px', padding: '40px 20px', textAlign: 'center', color: '#8B949E' }}>
                    <div style={{ fontSize: '32px', marginBottom: '15px' }}>🧪</div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#F0F6FC', marginBottom: '8px' }}>Interactive Concept Simulator</h3>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
                        The interactive 3D concept simulation for this module is currently in development. Please use the Google Drive notes link above to access the curriculum materials.
                    </p>
                </div>
            );
        }

        return (
            <div style={{ marginTop: '30px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px', color: '#F0F6FC' }}>Interactive Concept Visualizers</h2>
                
                {/* 12-session topic cards list for Python Fundamentals */}
                {activeCategory === 'python-fundamentals' && (
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '12px', color: 'var(--res-accent-secondary)', marginBottom: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Session Topic to Run Interactive Tracer</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                            {[
                                { id: 'basics', name: '1. Python Basics & Variables', tab: 'python-flow' },
                                { id: 'datatypes', name: '2. Variable Types & Classes', tab: 'datatype-universe' },
                                { id: 'slicing', name: '3. Indexing & String Slicing', tab: 'python-flow' },
                                { id: 'operators', name: '4. Math & Logic Operators', tab: 'python-flow' },
                                { id: 'methods', name: '5. Functions & Methods', tab: 'python-flow' },
                                { id: 'conditionals', name: '6. Conditional (if/else)', tab: 'python-flow' },
                                { id: 'loops', name: '7. Loops & Iterators', tab: 'python-flow' },
                                { id: 'cond_loops', name: '8. Conditional Looping', tab: 'python-flow' },
                                { id: 'custom_funcs', name: '9. Custom Functions', tab: 'python-flow' },
                                { id: 'adv_loops', name: '10. Advanced Loop Control', tab: 'python-flow' },
                                { id: 'oops', name: '11. OOP & Constructor Methods', tab: 'python-flow' },
                                { id: 'exceptions', name: '12. Exceptional Handling', tab: 'python-flow' }
                            ].map(topic => {
                                const isActive = (topic.tab === 'datatype-universe' && activeDsTab === 'datatype-universe') || 
                                                 (topic.tab === 'python-flow' && activeDsTab === 'python-flow' && pythonPreset === topic.id);
                                return (
                                    <button 
                                        key={topic.id}
                                        onClick={() => {
                                            setActiveDsTab(topic.tab);
                                            if (topic.tab === 'python-flow') {
                                                setPythonPreset(topic.id);
                                            }
                                        }}
                                        style={{
                                            background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                            border: isActive ? '1px solid var(--res-accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            color: isActive ? '#FFF' : '#8B949E',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            outline: 'none'
                                        }}
                                    >
                                        <span>{topic.name}</span>
                                        {isActive && <span style={{ color: 'var(--res-accent-primary)', fontSize: '12px' }}>●</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 10-session topic cards list for Data Analysis & EDA (Module 2 & 3) */}
                {(activeCategory === 'data-analysis' || activeCategory === 'eda-data') && (
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '12px', color: 'var(--res-accent-secondary)', marginBottom: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Session Topic to Run Interactive DataFrame Sandbox</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                            {[
                                { id: 'basics', name: '1. Getting Started (NumPy/Pandas)' },
                                { id: 'wrangling', name: '2. Mastering Data Wrangling' },
                                { id: 'advanced', name: '3. Advanced Wrangling & Groupby' },
                                { id: 'formats', name: '4. Wrangling Different Formats' },
                                { id: 'matplotlib', name: '5. Matplotlib & Seaborn Plots' },
                                { id: 'viz_tips', name: '6. Viz Tips & Variable Analysis' },
                                { id: 'apis', name: '7. Data Modelling via APIs' },
                                { id: 'plotly', name: '8. Interactive Plots (Plotly)' },
                                { id: 'eda_apis', name: '9. EDA via API Connections' },
                                { id: 'streamlit', name: '10. Streamlit Dashboards' }
                            ].map(topic => {
                                const isActive = activeDsTab === 'data-visualizer' && analysisPreset === topic.id;
                                return (
                                    <button 
                                        key={topic.id}
                                        onClick={() => {
                                            setActiveDsTab('data-visualizer');
                                            setAnalysisPreset(topic.id);
                                        }}
                                        style={{
                                            background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                            border: isActive ? '1px solid var(--res-accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            color: isActive ? '#FFF' : '#8B949E',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            outline: 'none'
                                        }}
                                    >
                                        <span>{topic.name}</span>
                                        {isActive && <span style={{ color: 'var(--res-accent-primary)', fontSize: '12px' }}>●</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 10-session topic cards list for Statistics (Module 6 & 7) */}
                {(activeCategory === 'statistics-mathematics' || activeCategory === 'advanced-statistics') && (
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '12px', color: 'var(--res-accent-secondary)', marginBottom: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Session Topic to Run Interactive Distribution Curve</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                            {[
                                { id: 'prob_theory', name: '1. Probability Theory Basics', mean: 0, std: 1, z: 0 },
                                { id: 'summary_stats', name: '2. Descriptive Summary Stats', mean: 0.5, std: 1.2, z: 0.5 },
                                { id: 'prob_dist', name: '3. Probability Distributions', mean: -0.2, std: 0.8, z: 1.0 },
                                { id: 'stat_inference', name: '4. Statistical Inference', mean: 0, std: 1.5, z: -1.0 },
                                { id: 'conf_intervals', name: '5. Confidence Intervals & Margin', mean: 0, std: 1, z: 1.96 },
                                { id: 'hypothesis_testing', name: '6. Hypothesis Testing (Z-test)', mean: 0, std: 1, z: 2.58 },
                                { id: 'business_metrics', name: '7. Core Business Metrics & KPIs', mean: 1.0, std: 0.5, z: 1.5 },
                                { id: 'web_analytics', name: '8. Web Analytics & Data Sources', mean: -0.5, std: 1.0, z: -1.5 },
                                { id: 'ab_testing', name: '9. A/B Testing & Experiment Design', mean: 0.1, std: 0.7, z: 1.64 },
                                { id: 'auto_execution', name: '10. Automated Execution & Workflows', mean: 0, std: 1, z: 0.5 }
                            ].map(topic => {
                                const isActive = activeDsTab === 'normal-mountain' && statsPreset.activeId === topic.id;
                                return (
                                    <button 
                                        key={topic.id}
                                        onClick={() => {
                                            setActiveDsTab('normal-mountain');
                                            setStatsPreset({ mean: topic.mean, std: topic.std, z: topic.z, activeId: topic.id });
                                        }}
                                        style={{
                                            background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                            border: isActive ? '1px solid var(--res-accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            color: isActive ? '#FFF' : '#8B949E',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            outline: 'none'
                                        }}
                                    >
                                        <span>{topic.name}</span>
                                        {isActive && <span style={{ color: 'var(--res-accent-primary)', fontSize: '12px' }}>●</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 5-session topic cards list for Supervised Learning (Module 8) */}
                {activeCategory === 'supervised-learning' && (
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '12px', color: 'var(--res-accent-secondary)', marginBottom: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Session Topic to Run Gradient Descent Optimizer</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                            {[
                                { id: 'regression', name: '1. Regression Analysis', lr: 0.05, optimizer: 'SGD' },
                                { id: 'classification', name: '2. Classification (Logistic)', lr: 0.1, optimizer: 'SGD' },
                                { id: 'decision_trees', name: '3. Decision Trees & Ensembles', lr: 0.2, optimizer: 'Adam' },
                                { id: 'validation', name: '4. Model Validation & Tuning', lr: 0.15, optimizer: 'Adam' },
                                { id: 'bagging_boosting', name: '5. Bagging & Boosting (XGBoost)', lr: 0.3, optimizer: 'Adam' }
                            ].map(topic => {
                                const isActive = activeDsTab === 'gradient-descent' && supervisedPreset.activeId === topic.id;
                                return (
                                    <button 
                                        key={topic.id}
                                        onClick={() => {
                                            setActiveDsTab('gradient-descent');
                                            setSupervisedPreset({ lr: topic.lr, optimizer: topic.optimizer, activeId: topic.id });
                                            setLr(topic.lr);
                                            setOptimizer(topic.optimizer);
                                        }}
                                        style={{
                                            background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                            border: isActive ? '1px solid var(--res-accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            color: isActive ? '#FFF' : '#8B949E',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            outline: 'none'
                                        }}
                                    >
                                        <span>{topic.name}</span>
                                        {isActive && <span style={{ color: 'var(--res-accent-primary)', fontSize: '12px' }}>●</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 6-session topic cards list for Deep Learning & GenAI (Module 9 & 10) */}
                {(activeCategory === 'deep-learning-ai' || activeCategory === 'nlp-mlops') && (
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '12px', color: 'var(--res-accent-secondary)', marginBottom: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Session Topic to Configure Neural Net Layers</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                            {[
                                { id: 'nn_basics', name: '1. Neural Networks & Backprop', layers: [{ type: 'Input', units: 4 }, { type: 'Dense', units: 8 }, { type: 'Output', units: 3 }] },
                                { id: 'time_series', name: '2. Time Series & Sequence Models', layers: [{ type: 'Input', units: 24 }, { type: 'Dense', units: 16 }, { type: 'Output', units: 1 }] },
                                { id: 'nlp', name: '3. NLP & Word Embeddings', layers: [{ type: 'Input', units: 300 }, { type: 'Dense', units: 64 }, { type: 'Output', units: 5 }] },
                                { id: 'cv', name: '4. Computer Vision (CNNs)', layers: [{ type: 'Input', units: 1024 }, { type: 'Dense', units: 128 }, { type: 'Dense', units: 64 }, { type: 'Output', units: 10 }] },
                                { id: 'llm_apis', name: '5. LLMs, GPT APIs & Prompting', layers: [{ type: 'Input', units: 2048 }, { type: 'Dense', units: 512 }, { type: 'Dense', units: 256 }, { type: 'Output', units: 16 }] },
                                { id: 'ml_lifecycle', name: '6. ML Lifecycle & MLOps', layers: [{ type: 'Input', units: 10 }, { type: 'Dense', units: 12 }, { type: 'Output', units: 2 }] }
                            ].map(topic => {
                                const isActive = activeDsTab === 'nn-builder' && nnPresetId === topic.id;
                                return (
                                    <button 
                                        key={topic.id}
                                        onClick={() => {
                                            setActiveDsTab('nn-builder');
                                            setNnPresetId(topic.id);
                                            setLayers(topic.layers);
                                        }}
                                        style={{
                                            background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                            border: isActive ? '1px solid var(--res-accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            color: isActive ? '#FFF' : '#8B949E',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            outline: 'none'
                                        }}
                                    >
                                        <span>{topic.name}</span>
                                        {isActive && <span style={{ color: 'var(--res-accent-primary)', fontSize: '12px' }}>●</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Visualizer Category Tabs */}
                {allowedTabs.length > 1 && activeCategory !== 'python-fundamentals' && activeCategory !== 'data-analysis' && (
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
                        {allowedTabs.includes('sql-joins') && (
                            <button 
                                onClick={() => setActiveDsTab('sql-joins')}
                                className={`viz-tab-btn ${activeDsTab === 'sql-joins' ? 'active' : ''}`}
                            >
                                🐬 SQL JOINs
                            </button>
                        )}
                    </div>
                )}
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

                {activeDsTab === 'python-flow' && allowedTabs.includes('python-flow') && (
                    <PythonFlowAnimator initialPreset={pythonPreset} onChangePreset={setPythonPreset} />
                )}
                {activeDsTab === 'datatype-universe' && allowedTabs.includes('datatype-universe') && <DatatypeUniverse />}
                {activeDsTab === 'normal-mountain' && allowedTabs.includes('normal-mountain') && (
                    <NormalDistributionMountain initialMean={statsPreset.mean} initialStd={statsPreset.std} initialZ={statsPreset.z} />
                )}
                {activeDsTab === 'kmeans-theater' && allowedTabs.includes('kmeans-theater') && (
                    <KMeansClusterTheater initialK={unsupervisedPreset.k} initialMethod={unsupervisedPreset.method} />
                )}
                {activeDsTab === 'data-visualizer' && allowedTabs.includes('data-visualizer') && (
                    <DataAnalysisVisualizer initialPreset={analysisPreset} onChangePreset={setAnalysisPreset} />
                )}
                {activeDsTab === 'sql-joins' && allowedTabs.includes('sql-joins') && <SqlJoinsVisualizer />}
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
