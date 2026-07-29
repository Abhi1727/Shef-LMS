import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ToolkitExplorer from './ToolkitExplorer';
import AccountMenu from './AccountMenu';
import '../styles/RoleShell.css';
import './resources.css';

export default function ResourcesHome({ user, onLogout }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [resourcesEnabled, setResourcesEnabled] = useState(false);
    const [message, setMessage] = useState('');
    const [isDualUniverse, setIsDualUniverse] = useState(false);
    const [activeUniverse, setActiveUniverse] = useState('data-science-ai');
    const [categories, setCategories] = useState([]);
    const [resources, setResources] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [showVisualizers, setShowVisualizers] = useState(false);

    const token = localStorage.getItem('token');
    const homePath = user?.role === 'admin' ? '/admin' : user?.role === 'teacher' ? '/teacher' : '/dashboard';

    const fetchResources = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/resources', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.resourcesEnabled === false) {
                setResourcesEnabled(false);
                setMessage(res.data.message || 'Resources not activated');
            } else {
                setResourcesEnabled(true);
                setIsDualUniverse(!!res.data.isDualUniverse);
                setActiveUniverse(
                    res.data.activeUniverse === 'both' ? 'data-science-ai' : (res.data.activeUniverse || 'data-science-ai')
                );
                setCategories(res.data.categories || []);
                setResources(res.data.resources || []);
            }
        } catch (err) {
            console.error('Error fetching resources:', err);
            setMessage(
                err.response?.status === 401
                    ? 'Your session expired. Please sign in again.'
                    : 'Failed to load resources. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchAssessmentsAndAttempts = async () => {
        try {
            const resAss = await axios.get('/api/assessment-studio/assessments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const resAtt = await axios.get('/api/assessment-studio/attempts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAssessments(Array.isArray(resAss.data) ? resAss.data : []);
            setAttempts(Array.isArray(resAtt.data) ? resAtt.data : []);
        } catch (err) {
            console.error('Error fetching student assessment data:', err);
        }
    };

    useEffect(() => {
        fetchResources();
        fetchAssessmentsAndAttempts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const universeCategories = useMemo(() => {
        const list = (categories || []).filter((c) => c.course === activeUniverse || c.course === 'both');
        const byKey = new Map();
        list.forEach((cat) => {
            const moduleMatch = String(cat.name || '').match(/module\s*(\d+)/i);
            const key = moduleMatch ? `module-${moduleMatch[1]}` : (cat.slug || cat.name || '').toLowerCase();
            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, cat);
                return;
            }
            // Prefer Drive-linked category when duplicate module rows exist
            const preferNew = !!cat.driveFolderUrl && !existing.driveFolderUrl;
            if (preferNew) byKey.set(key, cat);
        });
        return Array.from(byKey.values()).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || String(a.name).localeCompare(String(b.name)));
    }, [categories, activeUniverse]);

    const filteredResources = useMemo(() => {
        return (resources || []).filter((res) => {
            if (selectedCategory !== 'All' && res.categorySlug !== selectedCategory) return false;
            if (res.course !== 'both' && res.course !== activeUniverse) return false;
            return true;
        });
    }, [resources, selectedCategory, activeUniverse]);

    const notebooks = useMemo(
        () => filteredResources.filter((r) => r.resourceType === 'notebook'),
        [filteredResources]
    );

    const otherResources = useMemo(
        () => filteredResources.filter((r) => r.resourceType !== 'notebook'),
        [filteredResources]
    );

    // Dedupe quizzes that share the same title (legacy duplicate seed rows)
    const uniqueAssessments = useMemo(() => {
        const seen = new Set();
        return (assessments || []).filter((ass) => {
            const key = (ass.title || ass._id || '').trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [assessments]);

    const downloadNotebook = async (nb) => {
        try {
            const res = await axios.get(`/api/resources/download/${encodeURIComponent(nb.slug)}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            if (res.status >= 400) {
                throw new Error('Download failed');
            }
            // Detect JSON error payloads returned as blobs
            if ((res.data.type || '').includes('application/json')) {
                const text = await res.data.text();
                const parsed = JSON.parse(text);
                throw new Error(parsed.message || 'Download failed');
            }
            const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = nb.content?.fileName || `${nb.slug}.ipynb`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Notebook download failed', err);
            window.alert(err.message || 'Could not download this notebook. Please try again or contact support.');
        }
    };

    const pageHeader = (
        <div className="res-page-toolbar">
            <button type="button" className="res-back-btn" onClick={() => navigate(homePath)}>
                ← Back to dashboard
            </button>
            <AccountMenu user={user} onLogout={onLogout} />
        </div>
    );

    if (loading) {
        return (
            <div className="resources-center-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
                {pageHeader}
                <div style={{ border: '4px solid #d5dee3', borderTop: '4px solid #147a7a', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '20px', color: 'var(--res-text-secondary)' }}>Loading resources…</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!resourcesEnabled) {
        return (
            <div className="resources-center-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: '20px' }}>
                {pageHeader}
                <div className="res-glass-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: 'var(--res-text-primary)' }}>Resources Locked</h2>
                    <p style={{ color: 'var(--res-text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
                    <button
                        type="button"
                        onClick={() => navigate(homePath)}
                        style={{ marginTop: '24px', background: 'var(--res-accent-primary)', border: 'none', color: '#FFF', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                    >
                        Return to dashboard
                    </button>
                </div>
            </div>
        );
    }

    const themeClass = activeUniverse === 'cyber-security' ? 'theme-cyber-security' : 'theme-data-science';
    const visualizerCategories = new Set([
        'python-fundamentals',
        'statistics-mathematics',
        'advanced-statistics',
        'data-analysis',
        'eda-data',
        'supervised-learning',
        'deep-learning-ai',
        'nlp-mlops',
        'mysql'
    ]);
    const showToolkit =
        activeUniverse === 'data-science-ai' &&
        (showVisualizers || (selectedCategory !== 'All' && visualizerCategories.has(selectedCategory)));

    return (
        <div className={`resources-center-container ${themeClass}`}>
            {pageHeader}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--res-accent-primary)', fontWeight: '600', letterSpacing: '1.5px', marginBottom: '8px' }}>
                        Resources Center • {activeUniverse === 'cyber-security' ? 'Cyber Security & Ethical Hacking' : 'Data Science & AI'}
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px', margin: '0 0 6px 0', color: 'var(--res-text-primary)' }}>Resources</h1>
                    <p style={{ color: 'var(--res-text-secondary)', fontSize: '14px', margin: 0, maxWidth: '560px' }}>
                        {activeUniverse === 'cyber-security'
                            ? 'Toolkits, references, and materials for ethical hacking.'
                            : 'Module materials, notebooks, and practice tools for Data Science & AI.'}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {isDualUniverse && (
                        <div className="res-glass-card" style={{ padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '10px', transform: 'none' }}>
                            <span style={{ fontSize: '12px', color: 'var(--res-text-secondary)' }}>DS & AI</span>
                            <label className="res-toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={activeUniverse === 'cyber-security'}
                                    onChange={(e) => {
                                        setActiveUniverse(e.target.checked ? 'cyber-security' : 'data-science-ai');
                                        setSelectedCategory('All');
                                        setShowVisualizers(false);
                                    }}
                                />
                                <span className="res-toggle-slider"></span>
                            </label>
                            <span style={{ fontSize: '12px', color: 'var(--res-text-secondary)' }}>Cyber Security</span>
                        </div>
                    )}
                </div>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: 'var(--res-text-primary)' }}>Browse by Category</h3>
            <div className="res-categories-grid">
                <button
                    type="button"
                    onClick={() => setSelectedCategory('All')}
                    className={`res-glass-card res-category-card ${selectedCategory === 'All' ? 'active' : ''}`}
                    style={{ border: selectedCategory === 'All' ? '1px solid var(--res-accent-primary)' : '1px solid var(--res-glass-border)' }}
                >
                    <span className="res-category-icon">📂</span>
                    <span className="res-category-label">All categories</span>
                </button>

                {universeCategories.map((cat) => (
                    <button
                        type="button"
                        key={cat.slug || cat._id}
                        onClick={() => setSelectedCategory(cat.slug)}
                        className={`res-glass-card res-category-card ${selectedCategory === cat.slug ? 'active' : ''}`}
                        style={{
                            border: selectedCategory === cat.slug ? '1px solid var(--res-accent-primary)' : '1px solid var(--res-glass-border)',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            minHeight: '110px'
                        }}
                    >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                            <span className="res-category-icon" style={{ marginBottom: 0 }}>{cat.icon || '📘'}</span>
                            <span className="res-category-label">{cat.name}</span>
                        </div>
                        {cat.driveFolderUrl && (
                            <a
                                href={cat.driveFolderUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="res-drive-link"
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--res-accent-secondary)',
                                    textDecoration: 'none',
                                    marginTop: '12px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}
                            >
                                Drive materials →
                            </a>
                        )}
                    </button>
                ))}
            </div>

            {selectedCategory !== 'All' && (() => {
                const activeCatObj = universeCategories.find((c) => c.slug === selectedCategory);
                if (!activeCatObj) return null;
                return (
                    <div
                        className="res-glass-card"
                        style={{
                            padding: '24px',
                            marginBottom: '30px',
                            marginTop: '8px',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(129, 140, 248, 0.05) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '20px',
                            flexWrap: 'wrap',
                            transform: 'none'
                        }}
                    >
                        <div>
                            <h4 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 6px 0', color: 'var(--res-text-primary)' }}>
                                {activeCatObj.name}
                            </h4>
                            <p style={{ fontSize: '13px', color: 'var(--res-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                                {activeCatObj.description || 'Module notes, notebooks, and reference materials.'}
                            </p>
                        </div>
                        {activeCatObj.driveFolderUrl ? (
                            <a
                                href={activeCatObj.driveFolderUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    background: 'var(--res-accent-primary)',
                                    color: '#FFF',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: '700'
                                }}
                            >
                                Open Google Drive notes →
                            </a>
                        ) : (
                            <span style={{ fontSize: '13px', color: 'var(--res-text-secondary)' }}>Drive folder not linked yet</span>
                        )}
                    </div>
                );
            })()}

            {uniqueAssessments.length > 0 && (
                <div style={{ marginTop: '24px', marginBottom: '36px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: 'var(--res-text-primary)' }}>
                        Assigned quizzes
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {uniqueAssessments.map((ass) => {
                            const attempt = attempts.find(
                                (att) => att.assessmentId?._id === ass._id || att.assessmentId === ass._id
                            );
                            const totalPoints = ass.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;
                            let statusText = 'Not started';
                            let statusColor = 'var(--res-text-secondary)';
                            let action = (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/student/assessment/${ass._id}`)}
                                    style={{ background: 'var(--res-accent-primary)', border: 'none', color: '#FFF', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                >
                                    Start quiz
                                </button>
                            );

                            if (attempt?.status === 'completed') {
                                statusText = `Completed (${attempt.score}/${attempt.maxScore})`;
                                statusColor = '#10B981';
                                action = (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/student/assessment/results/${attempt._id}`)}
                                        style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', color: '#10B981', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        View results
                                    </button>
                                );
                            } else if (attempt?.status === 'in-progress') {
                                statusText = 'In progress';
                                statusColor = '#F59E0B';
                                action = (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/student/assessment/${ass._id}`)}
                                        style={{ background: '#F59E0B', border: 'none', color: '#FFF', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        Resume
                                    </button>
                                );
                            }

                            return (
                                <div key={ass._id} className="res-glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '160px', transform: 'none' }}>
                                    <span style={{ fontSize: '11px', color: statusColor, fontWeight: 700, textTransform: 'uppercase' }}>
                                        {statusText}
                                    </span>
                                    <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--res-text-primary)' }}>{ass.title}</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--res-text-secondary)', lineHeight: 1.4 }}>
                                        {ass.description || 'No description provided.'}
                                    </p>
                                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: '#818CF8' }}>{totalPoints} pts · {ass.duration || '—'} min</span>
                                        {action}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {notebooks.length > 0 && (
                <div style={{ marginBottom: '36px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--res-text-primary)' }}>
                        Course notebooks
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--res-text-secondary)', margin: '0 0 16px' }}>
                        Download Jupyter notebooks and open them in Jupyter, VS Code, or Google Colab.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                        {notebooks.map((nb) => (
                            <div
                                key={nb._id || nb.slug}
                                className="res-glass-card"
                                style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '140px', transform: 'none' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: '#818CF8', fontWeight: 700, textTransform: 'uppercase' }}>Notebook</span>
                                    <span style={{ fontSize: '11px', color: 'var(--res-text-secondary)' }}>
                                        {(nb.categorySlug || '').replace(/^ds-module-/, 'M')}
                                    </span>
                                </div>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 650, color: 'var(--res-text-primary)', lineHeight: 1.35 }}>
                                    {nb.title}
                                </h4>
                                {nb.description ? (
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--res-text-secondary)', lineHeight: 1.4 }}>
                                        {nb.description.length > 110 ? `${nb.description.slice(0, 110)}…` : nb.description}
                                    </p>
                                ) : null}
                                <div style={{ marginTop: 'auto' }}>
                                    <button
                                        type="button"
                                        onClick={() => downloadNotebook(nb)}
                                        style={{
                                            background: 'var(--res-accent-primary)',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Download .ipynb
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {otherResources.length > 0 && (
                <div style={{ marginBottom: '36px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: 'var(--res-text-primary)' }}>
                        Materials & tools
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                        {otherResources.map((item) => (
                            <div
                                key={item._id || item.slug}
                                className="res-glass-card"
                                style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', transform: 'none' }}
                            >
                                <span style={{ fontSize: '11px', color: '#818CF8', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {item.resourceType}
                                </span>
                                <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--res-text-primary)' }}>{item.title}</h4>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--res-text-secondary)', lineHeight: 1.4 }}>
                                    {item.description || 'No description provided.'}
                                </p>
                                {(item.content?.externalUrl || item.content?.officialUrl || item.content?.fileUrl) && (
                                    <a
                                        href={item.content.externalUrl || item.content.officialUrl || item.content.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ marginTop: 'auto', color: 'var(--res-accent-secondary)', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        Open resource →
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {filteredResources.length === 0 && uniqueAssessments.length === 0 && (
                <div className="res-glass-card" style={{ padding: '28px', textAlign: 'center', marginBottom: '30px', transform: 'none' }}>
                    <p style={{ margin: 0, color: 'var(--res-text-secondary)', fontSize: '14px' }}>
                        No resources in this category yet. Try another category or check back after your instructor publishes materials.
                    </p>
                </div>
            )}

            {activeUniverse === 'data-science-ai' && (
                <div style={{ marginBottom: '24px' }}>
                    {!showToolkit ? (
                        <button
                            type="button"
                            className="res-glass-card"
                            onClick={() => setShowVisualizers(true)}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                cursor: 'pointer',
                                padding: '18px 20px',
                                border: '1px solid var(--res-glass-border)',
                                color: 'var(--res-text-primary)',
                                transform: 'none'
                            }}
                        >
                            <strong style={{ display: 'block', marginBottom: '4px' }}>Interactive concept visualizers</strong>
                            <span style={{ fontSize: '13px', color: 'var(--res-text-secondary)' }}>
                                Optional practice boards for Python, stats, ML, and SQL — open when you want them.
                            </span>
                        </button>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--res-text-primary)' }}>Interactive concept visualizers</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowVisualizers(false)}
                                    style={{ background: 'transparent', border: '1px solid #d5dee3', color: 'var(--res-text-secondary)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}
                                >
                                    Hide
                                </button>
                            </div>
                            <ToolkitExplorer
                                universe={activeUniverse}
                                activeCategory={selectedCategory}
                                tools={resources.filter((r) => r.resourceType === 'tool')}
                            />
                        </div>
                    )}
                </div>
            )}

            {activeUniverse === 'cyber-security' && (
                <ToolkitExplorer
                    universe={activeUniverse}
                    activeCategory={selectedCategory}
                    tools={resources.filter((r) => r.resourceType === 'tool')}
                />
            )}
        </div>
    );
}
