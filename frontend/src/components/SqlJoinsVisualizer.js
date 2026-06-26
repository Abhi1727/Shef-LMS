import React, { useState } from 'react';
import './resources.css';

const LEFT_TABLE = [
    { id: 1, name: "Alice", role_id: 10 },
    { id: 2, name: "Bob", role_id: 20 },
    { id: 3, name: "Charlie", role_id: null }
];

const RIGHT_TABLE = [
    { id: 10, role_name: "Admin" },
    { id: 20, role_name: "Mentor" },
    { id: 30, role_name: "Student" }
];

const SQL_SYNTAX = {
    inner: `SELECT users.name, roles.role_name\nFROM users\nINNER JOIN roles ON users.role_id = roles.id;`,
    left: `SELECT users.name, roles.role_name\nFROM users\nLEFT JOIN roles ON users.role_id = roles.id;`,
    right: `SELECT users.name, roles.role_name\nFROM users\nRIGHT JOIN roles ON users.role_id = roles.id;`,
    full: `SELECT users.name, roles.role_name\nFROM users\nFULL OUTER JOIN roles ON users.role_id = roles.id;`
};

export default function SqlJoinsVisualizer() {
    const [joinType, setJoinType] = useState('inner'); // inner, left, right, full

    const getJoinedData = () => {
        if (joinType === 'inner') {
            return [
                { name: "Alice", role_id: 10, role_name: "Admin" },
                { name: "Bob", role_id: 20, role_name: "Mentor" }
            ];
        }
        if (joinType === 'left') {
            return [
                { name: "Alice", role_id: 10, role_name: "Admin" },
                { name: "Bob", role_id: 20, role_name: "Mentor" },
                { name: "Charlie", role_id: "NULL", role_name: "NULL" }
            ];
        }
        if (joinType === 'right') {
            return [
                { name: "Alice", role_id: 10, role_name: "Admin" },
                { name: "Bob", role_id: 20, role_name: "Mentor" },
                { name: "NULL", role_id: 30, role_name: "Student" }
            ];
        }
        if (joinType === 'full') {
            return [
                { name: "Alice", role_id: 10, role_name: "Admin" },
                { name: "Bob", role_id: 20, role_name: "Mentor" },
                { name: "Charlie", role_id: "NULL", role_name: "NULL" },
                { name: "NULL", role_id: 30, role_name: "Student" }
            ];
        }
        return [];
    };

    const joinedData = getJoinedData();

    return (
        <div className="viz-panel-grid" style={{ marginTop: '20px' }}>
            {/* Visual SQL Canvas Area */}
            <div className="viz-canvas-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: 'rgba(8, 12, 20, 0.4)', borderRadius: '12px', minHeight: '360px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid var(--res-border-subtle)', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--res-accent-primary)' }}>
                        🐬 Interactive SQL Join Playground
                    </span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
                    </div>
                </div>

                {/* Database Source Tables Row */}
                <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
                    {/* Left Table: Users */}
                    <div style={{ flex: 1, background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B949E', marginBottom: '8px' }}>LEFT TABLE: users</div>
                        <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#8B949E' }}>
                                    <th style={{ padding: '4px' }}>id</th>
                                    <th style={{ padding: '4px' }}>name</th>
                                    <th style={{ padding: '4px' }}>role_id</th>
                                </tr>
                            </thead>
                            <tbody>
                                {LEFT_TABLE.map(row => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '4px' }}>{row.id}</td>
                                        <td style={{ padding: '4px', color: '#FFF' }}>{row.name}</td>
                                        <td style={{ padding: '4px', color: '#6366F1' }}>{row.role_id || 'NULL'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Right Table: Roles */}
                    <div style={{ flex: 1, background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B949E', marginBottom: '8px' }}>RIGHT TABLE: roles</div>
                        <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#8B949E' }}>
                                    <th style={{ padding: '4px' }}>id</th>
                                    <th style={{ padding: '4px' }}>role_name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RIGHT_TABLE.map(row => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '4px', color: '#6366F1' }}>{row.id}</td>
                                        <td style={{ padding: '4px', color: '#FFF' }}>{row.role_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Venn diagram & Result Area */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', width: '100%', marginTop: '10px' }}>
                    {/* SVG Venn Diagram */}
                    <div style={{ width: '140px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <svg width="120" height="80" viewBox="0 0 120 80">
                            {/* Define overlap clipping */}
                            <defs>
                                <clipPath id="overlap-clip">
                                    <circle cx="45" cy="40" r="30" />
                                </clipPath>
                            </defs>

                            {/* Left Circle */}
                            <circle 
                                cx="45" 
                                cy="40" 
                                r="30" 
                                fill={['left', 'full'].includes(joinType) ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.05)'} 
                                stroke="#6366F1" 
                                strokeWidth="1.5" 
                            />

                            {/* Right Circle */}
                            <circle 
                                cx="75" 
                                cy="40" 
                                r="30" 
                                fill={['right', 'full'].includes(joinType) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.05)'} 
                                stroke="#10B981" 
                                strokeWidth="1.5" 
                            />

                            {/* Overlap Area */}
                            <circle 
                                cx="75" 
                                cy="40" 
                                r="30" 
                                clipPath="url(#overlap-clip)" 
                                fill={['inner', 'left', 'right', 'full'].includes(joinType) ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.05)'} 
                            />
                        </svg>
                    </div>

                    {/* Output Table Result */}
                    <div style={{ flex: 1, background: '#070A0F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', minHeight: '110px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--res-accent-primary)', marginBottom: '5px' }}>JOIN OUTPUT RESULT DATASET</div>
                        <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#8B949E' }}>
                                    <th style={{ padding: '3px' }}>users.name</th>
                                    <th style={{ padding: '3px' }}>roles.role_name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {joinedData.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                        <td style={{ padding: '3px', color: row.name === 'NULL' ? '#EF4444' : '#FFF' }}>{row.name}</td>
                                        <td style={{ padding: '3px', color: row.role_name === 'NULL' ? '#EF4444' : '#34D399' }}>{row.role_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sidebar Controls */}
            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#F0F6FC' }}>SQL JOIN Controller</h3>
                <p style={{ fontSize: '12px', color: '#8B949E', margin: '4px 0 15px 0' }}>Select a JOIN command to inspect mapping logical sets and Venn filters.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                    {[
                        { id: 'inner', name: 'INNER JOIN (Match Overlap)' },
                        { id: 'left', name: 'LEFT JOIN (Left + Overlap)' },
                        { id: 'right', name: 'RIGHT JOIN (Right + Overlap)' },
                        { id: 'full', name: 'FULL OUTER JOIN (All Sets)' }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setJoinType(btn.id)}
                            className={joinType === btn.id ? "viz-btn-primary" : "viz-btn-secondary"}
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: '600' }}
                        >
                            {btn.name}
                        </button>
                    ))}
                </div>

                <div className="viz-equation-bar">
                    <div className="viz-equation-label">Generated SQL Code</div>
                    <pre style={{ margin: 0, fontSize: '11px', color: '#818CF8', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {SQL_SYNTAX[joinType]}
                    </pre>
                </div>
            </div>
        </div>
    );
}
