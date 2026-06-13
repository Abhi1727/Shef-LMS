import React, { useState, useEffect } from 'react';

const PRESETS = {
    simple: {
        code: [
            "# Simple Assignment & Math",
            "x = 5",
            "y = 10",
            "z = x + y",
            "print(z)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { x: 5 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { x: 5, y: 10 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { x: 5, y: 10, z: 15 }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { x: 5, y: 10, z: 15 }, stack: ["<module>"], stdout: "15" }
        ]
    },
    condition: {
        code: [
            "age = 20",
            "if age >= 18:",
            "    status = 'Adult'",
            "else:",
            "    status = 'Minor'",
            "print(status)"
        ],
        steps: [
            { line: 0, memory: { age: 20 }, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { age: 20 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { age: 20, status: "Adult" }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { age: 20, status: "Adult" }, stack: ["<module>"], stdout: "Adult" }
        ]
    },
    loop: {
        code: [
            "total = 0",
            "for i in range(3):",
            "    total += i",
            "print(total)"
        ],
        steps: [
            { line: 0, memory: { total: 0 }, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { total: 0, i: 0 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { total: 0, i: 0 }, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { total: 0, i: 1 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { total: 1, i: 1 }, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { total: 1, i: 2 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { total: 3, i: 2 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { total: 3, i: 2 }, stack: ["<module>"], stdout: "3" }
        ]
    },
    nested: {
        code: [
            "def add(a, b):",
            "    val = a + b",
            "    return val",
            "",
            "x = 10",
            "ans = add(x, 20)",
            "print(ans)"
        ],
        steps: [
            { line: 0, memory: { add: "<function>" }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { add: "<function>", x: 10 }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { add: "<function>", x: 10 }, stack: ["<module>", "add(10, 20)"], localMemory: { a: 10, b: 20 }, stdout: "" },
            { line: 1, memory: { add: "<function>", x: 10 }, stack: ["<module>", "add(10, 20)"], localMemory: { a: 10, b: 20, val: 30 }, stdout: "" },
            { line: 2, memory: { add: "<function>", x: 10 }, stack: ["<module>"], returnVal: 30, stdout: "" },
            { line: 5, memory: { add: "<function>", x: 10, ans: 30 }, stack: ["<module>"], stdout: "" },
            { line: 6, memory: { add: "<function>", x: 10, ans: 30 }, stack: ["<module>"], stdout: "30" }
        ]
    },
    oops: {
        code: [
            "class Dog:",
            "    def __init__(self, name):",
            "        self.name = name",
            "",
            "d = Dog('Buddy')",
            "print(d.name)"
        ],
        steps: [
            { line: 0, memory: { Dog: "<class>" }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { Dog: "<class>" }, stack: ["<module>", "Dog.__init__"], localMemory: { self: "<Dog instance>", name: "Buddy" }, stdout: "" },
            { line: 1, memory: { Dog: "<class>" }, stack: ["<module>", "Dog.__init__"], localMemory: { self: "<Dog instance name='Buddy'>", name: "Buddy" }, stdout: "" },
            { line: 2, memory: { Dog: "<class>" }, stack: ["<module>", "Dog.__init__"], localMemory: { self: "<Dog instance name='Buddy'>", name: "Buddy" }, stdout: "" },
            { line: 4, memory: { Dog: "<class>", d: "<Dog instance name='Buddy'>" }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { Dog: "<class>", d: "<Dog instance name='Buddy'>" }, stack: ["<module>"], stdout: "Buddy" }
        ]
    }
};

export default function PythonFlowAnimator() {
    const [preset, setPreset] = useState("simple");
    const [stepIndex, setStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1500); // ms

    const currentPreset = PRESETS[preset];
    const currentStep = currentPreset.steps[stepIndex] || { line: 0, memory: {}, stack: ["<module>"], stdout: "" };

    useEffect(() => {
        let timer;
        if (isPlaying) {
            timer = setInterval(() => {
                setStepIndex((prev) => {
                    if (prev >= currentPreset.steps.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, speed);
        }
        return () => clearInterval(timer);
    }, [isPlaying, speed, currentPreset.steps.length]);

    const handleReset = () => {
        setStepIndex(0);
        setIsPlaying(false);
    };

    return (
        <div className="viz-panel-grid">
            {/* Visual Workspace */}
            <div className="viz-canvas-container" style={{ flexDirection: 'column', padding: '20px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: '20px', height: '100%', minHeight: '300px' }}>
                    
                    {/* Read-only Code View */}
                    <div style={{ flex: 1, background: '#080C14', borderRadius: '6px', padding: '15px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                        {currentPreset.code.map((line, idx) => (
                            <div 
                                key={idx} 
                                style={{ 
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: currentStep.line === idx ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    borderLeft: currentStep.line === idx ? '3px solid #6366F1' : '3px solid transparent',
                                    color: currentStep.line === idx ? '#fff' : '#8B949E'
                                }}
                            >
                                <span style={{ marginRight: '15px', opacity: 0.3, userSelect: 'none' }}>{idx + 1}</span>
                                {line}
                            </div>
                        ))}
                    </div>

                    {/* Stack & Z-axis Depth Memory Visualization */}
                    <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ flex: 1, background: '#0D1117', borderRadius: '6px', padding: '15px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8B949E', marginBottom: '10px', fontWeight: 'bold' }}>Memory Sandbox</div>
                            
                            {/* Layered Scope visualizer */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Global Scope */}
                                <div className="trace-scope-box">
                                    <div style={{ fontSize: '9px', color: '#6366F1', marginBottom: '5px' }}>Global Scope</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {Object.entries(currentStep.memory).map(([key, val]) => (
                                            <span key={key} className="trace-var-badge">
                                                <span className="trace-var-name">{key}</span>:
                                                <span className="trace-var-val">{String(val)}</span>
                                            </span>
                                        ))}
                                        {Object.keys(currentStep.memory).length === 0 && <span style={{ fontSize: '11px', color: '#484F58' }}>empty</span>}
                                    </div>
                                </div>

                                {/* Local Frame Scope (nested layers representing Z depth stacking) */}
                                {currentStep.localMemory && (
                                    <div className="trace-scope-box" style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)', transform: 'translateZ(10px) scale(0.95)' }}>
                                        <div style={{ fontSize: '9px', color: '#818CF8', marginBottom: '5px' }}>Local Scope (nested frame)</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {Object.entries(currentStep.localMemory).map(([key, val]) => (
                                                <span key={key} className="trace-var-badge">
                                                    <span className="trace-var-name">{key}</span>:
                                                    <span className="trace-var-val">{String(val)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Call Stack Frame Lists */}
                        <div style={{ height: '100px', background: '#0D1117', borderRadius: '6px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8B949E', marginBottom: '5px', fontWeight: 'bold' }}>Call Stack Depth</div>
                            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px', fontFamily: 'monospace', fontSize: '11px' }}>
                                {currentStep.stack.map((frame, idx) => (
                                    <div key={idx} style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', borderLeft: '3px solid #34D399' }}>
                                        {frame}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Console Log stdout */}
                <div style={{ marginTop: '15px', background: '#000', borderRadius: '6px', padding: '10px 15px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '12px', color: '#34D399' }}>
                    <span style={{ color: '#8B949E', marginRight: '10px' }}>stdout:</span>
                    {currentStep.stdout || <span style={{ opacity: 0.2 }}>[Waiting for output]</span>}
                </div>
            </div>

            {/* Sidebar Controls */}
            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Trace Executions</h3>
                <p style={{ fontSize: '12px', color: '#8B949E' }}>Observe the stack and environment bindings in real-time as statements run.</p>

                <div className="viz-control-group">
                    <label className="viz-control-label">Demo Program</label>
                    <select 
                        value={preset} 
                        onChange={(e) => { setPreset(e.target.value); setStepIndex(0); setIsPlaying(false); }}
                        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F6FC', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                    >
                        <option value="simple">Simple Assignment & Variables</option>
                        <option value="condition">Conditional Statements (if/else)</option>
                        <option value="loop">Loops (for total accumulator)</option>
                        <option value="nested">Function Stack Frame Depth</option>
                        <option value="oops">OOP Class & Instance objects</option>
                    </select>
                </div>

                <div className="viz-control-group">
                    <span className="viz-control-label">
                        <span>Speed (Interval)</span>
                        <span className="viz-control-value">{speed}ms</span>
                    </span>
                    <input 
                        type="range"
                        min="500"
                        max="3000"
                        step="250"
                        value={speed}
                        onChange={(e) => setSpeed(parseInt(e.target.value))}
                        className="viz-slider"
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)} 
                        className="viz-btn-primary" 
                        style={{ flex: 1 }}
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Auto Play'}
                    </button>
                    <button 
                        onClick={() => setStepIndex(prev => Math.max(0, prev - 1))}
                        disabled={stepIndex === 0}
                        className="viz-btn-secondary"
                        style={{ opacity: stepIndex === 0 ? 0.5 : 1 }}
                    >
                        ◀ Back
                    </button>
                    <button 
                        onClick={() => setStepIndex(prev => Math.min(currentPreset.steps.length - 1, prev + 1))}
                        disabled={stepIndex === currentPreset.steps.length - 1}
                        className="viz-btn-secondary"
                        style={{ opacity: stepIndex === currentPreset.steps.length - 1 ? 0.5 : 1 }}
                    >
                        Next ▶
                    </button>
                </div>

                <button onClick={handleReset} className="viz-btn-secondary" style={{ width: '100%' }}>
                    🔄 Reset Progress
                </button>

                <div className="viz-equation-bar">
                    <div className="viz-equation-label">Conceptual Model</div>
                    <div className="viz-equation-math">Python Scope = {'{ Local Frame }'} → {'{ Global Frame }'}</div>
                </div>
            </div>
        </div>
    );
}
