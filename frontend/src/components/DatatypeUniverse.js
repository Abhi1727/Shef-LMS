import React, { useState, useEffect } from 'react';

const DATATYPES = [
    { name: 'int', type: 'Numeric', color: '#6366F1', desc: 'Immutable integers of arbitrary length.', example: 'x = 42', size: '28 bytes', mutable: false, icon: '🔵' },
    { name: 'float', type: 'Numeric', color: '#38BDF8', desc: 'Immutable double-precision floating-point numbers.', example: 'y = 3.14', size: '24 bytes', mutable: false, icon: '🟢' },
    { name: 'str', type: 'Sequence', color: '#F59E0B', desc: 'Immutable sequence of Unicode characters.', example: 's = "hello"', size: '54 bytes', mutable: false, icon: '🟡' },
    { name: 'bool', type: 'Boolean', color: '#10B981', desc: 'Boolean representation: True or False.', example: 'flag = True', size: '28 bytes', mutable: false, icon: '💚' },
    { name: 'list', type: 'Sequence', color: '#A855F7', desc: 'Mutable ordered collection of elements.', example: 'lst = [1, 2, 3]', size: '80 bytes', mutable: true, icon: '🟪' },
    { name: 'dict', type: 'Mapping', color: '#F43F5E', desc: 'Mutable key-value mapping associative hashes.', example: 'd = {"k": "v"}', size: '232 bytes', mutable: true, icon: '🟥' },
    { name: 'tuple', type: 'Sequence', color: '#94A3B8', desc: 'Immutable ordered sequence of items.', example: 'tup = (1, 2)', size: '56 bytes', mutable: false, icon: '🔘' }
];

export default function DatatypeUniverse() {
    const [selectedType, setSelectedType] = useState(DATATYPES[0]);
    const [rotation, setRotation] = useState(0);
    const [typedValue, setTypedValue] = useState('');
    const [mutabilityLog, setMutabilityLog] = useState([]);

    // Simulate orbital rotation
    useEffect(() => {
        const interval = setInterval(() => {
            setRotation(prev => (prev + 0.02) % (2 * Math.PI));
        }, 30);
        return () => clearInterval(interval);
    }, []);

    const handleInspectValue = (val) => {
        setTypedValue(val);
        const trimmed = val.trim();
        if (!trimmed) return;

        let detected = null;
        if (/^-?\d+$/.test(trimmed)) {
            detected = DATATYPES.find(d => d.name === 'int');
        } else if (/^-?\d+\.\d+$/.test(trimmed)) {
            detected = DATATYPES.find(d => d.name === 'float');
        } else if (/^(True|False)$/.test(trimmed)) {
            detected = DATATYPES.find(d => d.name === 'bool');
        } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            detected = DATATYPES.find(d => d.name === 'list');
        } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            detected = DATATYPES.find(d => d.name === 'dict');
        } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            detected = DATATYPES.find(d => d.name === 'tuple');
        } else {
            detected = DATATYPES.find(d => d.name === 'str');
        }

        if (detected) {
            setSelectedType(detected);
        }
    };

    const runMutabilityTest = (isMutable) => {
        if (isMutable) {
            setMutabilityLog(prev => [
                ...prev,
                `lst = [1, 2]`,
                `lst.append(3) -> SUCCESS (ID remains ${Math.floor(Math.random() * 90000) + 10000})`,
                `Result: [1, 2, 3] ✅ (Mutable!)`
            ].slice(-6));
        } else {
            setMutabilityLog(prev => [
                ...prev,
                `tup = (1, 2)`,
                `tup[0] = 99 -> ERROR! TypeError: 'tuple' object does not support item assignment ❌ (Immutable!)`
            ].slice(-6));
        }
    };

    return (
        <div className="viz-panel-grid">
            {/* 3D Simulated Orbital System */}
            <div className="viz-canvas-container" style={{ minHeight: '340px', background: 'radial-gradient(circle at center, #0e1726 0%, #06090e 100%)' }}>
                
                {/* Orbit system representation */}
                <div style={{ position: 'relative', width: '280px', height: '280px', borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.06)' }}>
                    
                    {/* Selected Type Hub in center */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: selectedType.color,
                        boxShadow: `0 0 40px ${selectedType.color}`,
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        zIndex: 10,
                        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        textAlign: 'center'
                    }}>
                        <span style={{ fontSize: '24px', lineHeight: '70px' }}>{selectedType.icon}</span>
                    </div>

                    {/* Orbiting Spheres */}
                    {DATATYPES.map((dt, idx) => {
                        const angle = rotation + (idx * (2 * Math.PI) / DATATYPES.length);
                        const radiusX = 110;
                        const radiusY = 40; // 3D perspective ellipse tilt
                        const x = radiusX * Math.cos(angle) + 140 - 18;
                        const y = radiusY * Math.sin(angle) + 140 - 18;
                        
                        // Z-depth perspective calculation (-1 to 1)
                        const zDepth = Math.sin(angle);
                        const scale = 0.7 + (zDepth + 1) * 0.25; // 0.7x to 1.2x size
                        const opacity = 0.5 + (zDepth + 1) * 0.25; // 0.5 to 1 opacity
                        const zIndex = zDepth > 0 ? 12 : 8; // behind or in front of core hub

                        return (
                            <button
                                key={dt.name}
                                onClick={() => setSelectedType(dt)}
                                style={{
                                    position: 'absolute',
                                    top: `${y}px`,
                                    left: `${x}px`,
                                    background: 'rgba(13, 17, 23, 0.85)',
                                    border: `1px solid ${selectedType.name === dt.name ? dt.color : 'rgba(255,255,255,0.1)'}`,
                                    boxShadow: selectedType.name === dt.name ? `0 0 15px ${dt.color}` : 'none',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    transform: `scale(${scale})`,
                                    opacity: opacity,
                                    transition: 'border-color 0.3s, transform 0.1s, opacity 0.1s',
                                    zIndex: zIndex
                                }}
                                title={dt.name}
                            >
                                {dt.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar Details and interactivemutability checks */}
            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Datatype Explorer</h3>

                <div className="viz-control-group">
                    <label className="viz-control-label">Type Value to Test</label>
                    <input 
                        type="text" 
                        placeholder="e.g. 100, 3.14, [1,2], True"
                        value={typedValue}
                        onChange={(e) => handleInspectValue(e.target.value)}
                        style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F6FC', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                    />
                </div>

                <div className="viz-glass-card" style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', transform: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: selectedType.color }}>class '{selectedType.name}'</span>
                        <span style={{ fontSize: '10px', background: selectedType.mutable ? '#EF4444' : '#10B981', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '700' }}>
                            {selectedType.mutable ? 'Mutable' : 'Immutable'}
                        </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#8B949E', margin: '0 0 8px 0', lineHeight: '1.4' }}>{selectedType.desc}</p>
                    <div style={{ fontSize: '11px', color: '#8B949E' }}>
                        <div><strong>Boilerplate:</strong> <code>{selectedType.example}</code></div>
                        <div style={{ marginTop: '3px' }}><strong>Approx. Size:</strong> {selectedType.size}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => runMutabilityTest(true)} className="viz-btn-primary" style={{ flex: 1, background: '#A855F7' }}>Test Mutable (List)</button>
                    <button onClick={() => runMutabilityTest(false)} className="viz-btn-secondary" style={{ flex: 1 }}>Test Immutable (Tuple)</button>
                </div>

                {mutabilityLog.length > 0 && (
                    <div style={{ background: '#000', borderRadius: '6px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '11px', maxHeight: '100px', overflowY: 'auto' }}>
                        {mutabilityLog.map((log, idx) => (
                            <div key={idx} style={{ color: log.includes('ERROR') ? '#EF4444' : '#34D399' }}>{log}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
