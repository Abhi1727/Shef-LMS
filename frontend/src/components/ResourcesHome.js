import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ToolkitExplorer from './ToolkitExplorer';
import './resources.css';

export default function ResourcesHome({ user, onLogout }) {
    const [loading, setLoading] = useState(true);
    const [resourcesEnabled, setResourcesEnabled] = useState(false);
    const [message, setMessage] = useState('');
    const [isDualUniverse, setIsDualUniverse] = useState(false);
    const [activeUniverse, setActiveUniverse] = useState('data-science-ai'); // data-science-ai or cyber-security
    const [categories, setCategories] = useState([]);
    const [resources, setResources] = useState([]);
    
    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedTag, setSelectedTag] = useState('All');
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const token = localStorage.getItem('token');

    // Fetch initial data
    const fetchResources = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/resources', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.resourcesEnabled === false) {
                setResourcesEnabled(false);
                setMessage(res.data.message || 'Resources not activated');
            } else {
                setResourcesEnabled(true);
                setIsDualUniverse(res.data.isDualUniverse);
                setActiveUniverse(res.data.activeUniverse === 'both' ? 'data-science-ai' : res.data.activeUniverse);
                setCategories(res.data.categories || []);
                setResources(res.data.resources || []);
            }
        } catch (err) {
            console.error('Error fetching resources:', err);
            setMessage('Failed to load resources. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();
    }, []);

    // Filter resources dynamically
    const filteredResources = resources.filter(res => {
        // filter by category
        if (selectedCategory !== 'All' && res.categorySlug !== selectedCategory) return false;
        // filter by tag
        if (selectedTag !== 'All' && !(res.tags || []).includes(selectedTag)) return false;
        // filter by active universe
        if (res.course !== 'both' && res.course !== activeUniverse) return false;
        return true;
    });

    // Extract all unique tags for tag pills
    const allTags = Array.from(
        new Set(
            filteredResources.flatMap(r => r.tags || [])
        )
    ).slice(0, 12);

    // Trigger seed endpoint (for testing/admin convenience)
    const handleSeed = async () => {
        try {
            await axios.post('/api/resources/seed/all', {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            alert('Database seeded successfully!');
            fetchResources();
        } catch (err) {
            alert('Seeding failed: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) {
        return (
            <div className="resources-center-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
                <div style={{ border: '4px solid #1A2332', borderTop: '4px solid #6366F1', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '20px', color: '#8B949E' }}>Assembling resource ecosystem...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!resourcesEnabled) {
        return (
            <div className="resources-center-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="res-glass-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: '#F0F6FC' }}>Resources Locked</h2>
                    <p style={{ color: '#8B949E', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
                    {user?.role === 'admin' && (
                        <div style={{ marginTop: '30px' }}>
                            <p style={{ fontSize: '12px', color: '#8B949E', marginBottom: '10px' }}>Configure this batch to enable resources.</p>
                            <button onClick={handleSeed} style={{ background: '#6366F1', border: 'none', color: '#FFF', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                                Seed Initial Sample Resources
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Determine current theme class
    const themeClass = activeUniverse === 'cyber-security' ? 'theme-cyber-security' : 'theme-data-science';

    return (
        <div className={`resources-center-container ${themeClass}`}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--res-accent-primary)', fontWeight: '600', letterSpacing: '1.5px', marginBottom: '8px' }}>
                        Resources Center &bull; {activeUniverse === 'cyber-security' ? 'Cyber Security & Ethical Hacking' : 'Data Science & AI'}
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px', margin: '0 0 6px 0', color: '#F0F6FC' }}>Resources</h1>
                    <p style={{ color: '#8B949E', fontSize: '14px', margin: 0 }}>
                        {activeUniverse === 'cyber-security' 
                            ? 'Your complete toolkit, scanning references, and knowledge base for ethical hacking.'
                            : 'Everything you need to master mathematical models, optimization, and AI engineering.'}
                    </p>
                </div>

                {/* Universe Toggle for dual-enrolled students */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {isDualUniverse && (
                        <div className="res-glass-card" style={{ padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '10px', transform: 'none' }}>
                            <span style={{ fontSize: '12px', color: '#8B949E' }}>DS & AI</span>
                            <label className="res-toggle-switch">
                                <input 
                                    type="checkbox" 
                                    checked={activeUniverse === 'cyber-security'}
                                    onChange={(e) => setActiveUniverse(e.target.checked ? 'cyber-security' : 'data-science-ai')}
                                />
                                <span className="res-toggle-slider"></span>
                            </label>
                            <span style={{ fontSize: '12px', color: '#8B949E' }}>Cyber Security</span>
                        </div>
                    )}

                    {/* Admin seeding tool */}
                    {user?.role === 'admin' && (
                        <button onClick={handleSeed} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F6FC', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                            🔄 Re-seed Data
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="res-glass-card res-stats-bar" style={{ transform: 'none' }}>
                <div className="res-stat-item">
                    <span className="res-stat-number">{resources.filter(r => r.course === activeUniverse || r.course === 'both').length}</span>
                    <span className="res-stat-label">Total Resources</span>
                </div>
                <div className="res-stat-item" style={{ borderLeft: '1px solid var(--res-border-subtle)' }}>
                    <span className="res-stat-number">{categories.filter(c => c.course === activeUniverse || c.course === 'both').length}</span>
                    <span className="res-stat-label">Topic Categories</span>
                </div>
                <div className="res-stat-item" style={{ borderLeft: '1px solid var(--res-border-subtle)' }}>
                    <span className="res-stat-number">{resources.filter(r => r.resourceType === 'tool' || r.resourceType === 'notebook').length}</span>
                    <span className="res-stat-label">Practice Items</span>
                </div>
                <div className="res-stat-item" style={{ borderLeft: '1px solid var(--res-border-subtle)' }}>
                    <span className="res-stat-number">
                        {resources.reduce((sum, r) => sum + (r.views || 0), 0)}
                    </span>
                    <span className="res-stat-label">Learning Views</span>
                </div>
            </div>

            {/* Featured Section Grid */}
            <div className="res-asymmetric-grid">
                <div className="res-glass-card res-large-featured">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ background: 'var(--res-accent-primary)', fontSize: '10px', textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px', fontWeight: '700' }}>FEATURED HANDOUT</span>
                        <span style={{ fontSize: '11px', color: '#8B949E' }}>Updated 2 days ago</span>
                    </div>
                    <div className="res-featured-content" style={{ marginTop: '40px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '10px' }}>
                            {activeUniverse === 'cyber-security' 
                                ? 'Stealth Port Scanning & OS Footprinting Guides' 
                                : 'Advanced Transformers & Attention Weights Demystified'}
                        </h2>
                        <p style={{ color: '#8B949E', fontSize: '13px', lineHeight: '1.6', maxWidth: '500px', margin: '0 0 20px 0' }}>
                            {activeUniverse === 'cyber-security' 
                                ? 'Master Nmap flag configuration sweeps to profile network services and evade firewalls.'
                                : 'A comprehensive mathematical breakdown of multi-head attention mapping and prompt context assembly.'}
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <span style={{ fontSize: '12px', background: 'var(--res-accent-glow)', border: '1px solid var(--res-accent-primary)', padding: '4px 10px', borderRadius: '20px', color: '#FFF' }}>Advanced</span>
                            <span style={{ fontSize: '12px', color: '#8B949E', alignSelf: 'center' }}>25 min read</span>
                        </div>
                    </div>
                </div>

                <div className="res-small-cards-stack">
                    <div className="res-glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '132px' }}>
                        <h4 style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>Quick Cheatsheets</h4>
                        <p style={{ fontSize: '11px', color: '#8B949E', margin: '4px 0 0 0' }}>Download print-optimized syntax sheets and command guidelines.</p>
                        <span style={{ color: 'var(--res-accent-secondary)', fontSize: '11px', cursor: 'pointer', alignSelf: 'flex-end', fontWeight: '600' }}>Download PDF &rarr;</span>
                    </div>
                    <div className="res-glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '132px' }}>
                        <h4 style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>Learning Roadmaps</h4>
                        <p style={{ fontSize: '11px', color: '#8B949E', margin: '4px 0 0 0' }}>Track your curriculum milestones and recommended tool acquisitions.</p>
                        <span style={{ color: 'var(--res-accent-secondary)', fontSize: '11px', cursor: 'pointer', alignSelf: 'flex-end', fontWeight: '600' }}>View Roadmap &rarr;</span>
                    </div>
                </div>
            </div>

            {/* Search Command Palette Trigger */}
            <div 
                className="res-glass-card" 
                onClick={() => setShowSearchModal(true)}
                style={{ cursor: 'pointer', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', background: 'rgba(25,35,50,0.4)', borderColor: 'var(--res-border-strong)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '18px' }}>🔍</span>
                    <span style={{ color: 'var(--res-text-secondary)', fontSize: '14px' }}>Search resources, tool lists, categories...</span>
                </div>
                <div style={{ background: 'var(--res-bg-primary)', border: '1px solid var(--res-border-strong)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', color: '#8B949E' }}>
                    Press <kbd style={{ fontFamily: 'monospace' }}>Ctrl + K</kbd>
                </div>
            </div>

            {/* Browse by Category */}
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#F0F6FC' }}>Browse by Category</h3>
            <div className="res-categories-grid">
                <div 
                    onClick={() => setSelectedCategory('All')} 
                    className={`res-glass-card res-category-card ${selectedCategory === 'All' ? 'active' : ''}`}
                    style={{ border: selectedCategory === 'All' ? '1px solid var(--res-accent-primary)' : '1px solid var(--res-glass-border)' }}
                >
                    <span className="res-category-icon">📂</span>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>All categories</span>
                </div>

                {categories
                    .filter(c => c.course === activeUniverse || c.course === 'both')
                    .map((cat, idx) => (
                        <div 
                            key={idx}
                            onClick={() => setSelectedCategory(cat.slug)}
                            className={`res-glass-card res-category-card ${selectedCategory === cat.slug ? 'active' : ''}`}
                            style={{ 
                                border: selectedCategory === cat.slug ? '1px solid var(--res-accent-primary)' : '1px solid var(--res-glass-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                minHeight: '110px'
                            }}
                        >
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span className="res-category-icon">{cat.icon || '📘'}</span>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0F6FC' }}>{cat.name}</span>
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
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '4px',
                                        marginTop: '12px',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)'
                                    }}
                                >
                                    📂 Drive Materials &rarr;
                                </a>
                            )}
                        </div>
                    ))}
            </div>

            {/* Quick Access Tags */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '30px' }}>
                <span 
                    onClick={() => setSelectedTag('All')} 
                    className={`res-tag-pill ${selectedTag === 'All' ? 'active' : ''}`}
                >
                    #all-tags
                </span>
                {allTags.map((tag, idx) => (
                    <span 
                        key={idx}
                        onClick={() => setSelectedTag(tag)}
                        className={`res-tag-pill ${selectedTag === tag ? 'active' : ''}`}
                    >
                        #{tag}
                    </span>
                ))}
            </div>

            {/* Filtered Resources List */}
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#F0F6FC' }}>Targeted Resources</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {filteredResources.length === 0 ? (
                    <div className="res-glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#8B949E' }}>
                        No resources assigned to your batch match the selected filters.
                    </div>
                ) : (
                    filteredResources.map((item, idx) => (
                        <div key={idx} className="res-glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '10px', background: 'var(--res-bg-quaternary)', color: 'var(--res-accent-secondary)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '600' }}>{item.resourceType}</span>
                                    <span style={{ fontSize: '11px', color: item.difficulty === 'beginner' ? '#10B981' : item.difficulty === 'intermediate' ? '#F59E0B' : '#EF4444' }}>{item.difficulty}</span>
                                </div>
                                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 8px 0', color: '#F0F6FC' }}>{item.title}</h4>
                                <p style={{ fontSize: '12px', color: '#8B949E', margin: '0 0 15px 0', lineHeight: '1.5' }}>{item.description}</p>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--res-border-subtle)', paddingTop: '12px', marginTop: '10px' }}>
                                <span style={{ fontSize: '11px', color: '#484F58' }}>{item.estimatedMinutes} min &bull; {item.views} views</span>
                                <a 
                                    href={item.content?.externalUrl || item.content?.colabUrl || item.content?.videoUrl || '#'} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    onClick={async () => {
                                        try {
                                            await axios.get(`/api/resources/${item.slug}`, {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                        } catch(e){}
                                    }}
                                    style={{ fontSize: '12px', color: 'var(--res-accent-primary)', textDecoration: 'none', fontWeight: '600' }}
                                >
                                    Launch &rarr;
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Embedded interactive tool boards/explorers */}
            <ToolkitExplorer 
                universe={activeUniverse} 
                activeCategory={selectedCategory}
                tools={resources.filter(r => r.resourceType === 'tool')}
            />

            {/* Command Palette Search Modal */}
            {showSearchModal && (
                <div className="res-search-overlay" onClick={() => setShowSearchModal(false)}>
                    <div className="res-glass-card res-search-modal" onClick={e => e.stopPropagation()} style={{ transform: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600' }}>Command Search</span>
                            <span style={{ fontSize: '11px', color: '#484F58', cursor: 'pointer' }} onClick={() => setShowSearchModal(false)}>ESC</span>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Type to search resources..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="res-search-input"
                            autoFocus
                        />
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                            {resources
                                .filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
                                .slice(0, 5)
                                .map((res, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#111827', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '500' }}>{res.title}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--res-accent-primary)', textTransform: 'uppercase' }}>{res.resourceType}</span>
                                    </div>
                                ))}
                            {resources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                <div style={{ fontSize: '12px', color: '#484F58', textAlign: 'center', padding: '20px' }}>No matches found</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
