import React, { useState, useEffect } from 'react';

const PRESETS = {
    basics: {
        code: [
            "# Python Basics",
            "name = 'Alice'",
            "age = 22",
            "print('Hello ' + name)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { name: "Alice" }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { name: "Alice", age: 22 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { name: "Alice", age: 22 }, stack: ["<module>"], stdout: "Hello Alice" }
        ]
    },
    datatypes: {
        code: [
            "# Data Types",
            "is_valid = True",
            "score = 95.5",
            "items = [1, 2]",
            "print(type(score))"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { is_valid: true }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { is_valid: true, score: 95.5 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { is_valid: true, score: 95.5, items: "[1, 2]" }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { is_valid: true, score: 95.5, items: "[1, 2]" }, stack: ["<module>"], stdout: "<class 'float'>" }
        ]
    },
    slicing: {
        code: [
            "# Indexing & Slicing",
            "text = 'Python'",
            "first = text[0]",
            "sub = text[2:5]",
            "print(sub)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { text: "Python" }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { text: "Python", first: "P" }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { text: "Python", first: "P", sub: "tho" }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { text: "Python", first: "P", sub: "tho" }, stack: ["<module>"], stdout: "tho" }
        ]
    },
    operators: {
        code: [
            "# Operators",
            "val = 15 % 4",
            "is_greater = val > 2",
            "status = is_greater or False",
            "print(status)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { val: 3 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { val: 3, is_greater: true }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { val: 3, is_greater: true, status: true }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { val: 3, is_greater: true, status: true }, stack: ["<module>"], stdout: "True" }
        ]
    },
    methods: {
        code: [
            "# Functions & Methods",
            "words = 'hello'",
            "upper_words = words.upper()",
            "word_len = len(words)",
            "print(upper_words)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { words: "hello" }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { words: "hello", upper_words: "HELLO" }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { words: "hello", upper_words: "HELLO", word_len: 5 }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { words: "hello", upper_words: "HELLO", word_len: 5 }, stack: ["<module>"], stdout: "HELLO" }
        ]
    },
    conditionals: {
        code: [
            "# Conditional Statements",
            "x = 12",
            "if x < 10:",
            "    res = 'small'",
            "elif x < 20:",
            "    res = 'medium'",
            "else:",
            "    res = 'large'",
            "print(res)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { x: 12 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { x: 12 }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { x: 12 }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { x: 12, res: "medium" }, stack: ["<module>"], stdout: "" },
            { line: 8, memory: { x: 12, res: "medium" }, stack: ["<module>"], stdout: "medium" }
        ]
    },
    loops: {
        code: [
            "# Loops & Iterators",
            "nums = [10, 20]",
            "sum_val = 0",
            "for n in nums:",
            "    sum_val += n",
            "print(sum_val)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { nums: "[10, 20]" }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { nums: "[10, 20]", sum_val: 0 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { nums: "[10, 20]", sum_val: 0, n: 10 }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { nums: "[10, 20]", sum_val: 10, n: 10 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { nums: "[10, 20]", sum_val: 10, n: 20 }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { nums: "[10, 20]", sum_val: 30, n: 20 }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { nums: "[10, 20]", sum_val: 30, n: 20 }, stack: ["<module>"], stdout: "30" }
        ]
    },
    cond_loops: {
        code: [
            "# Conditional Looping",
            "count = 0",
            "for i in [1, 2, 3]:",
            "    if i % 2 == 0:",
            "        count += 1",
            "print(count)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { count: 0 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { count: 0, i: 1 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { count: 0, i: 1 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { count: 0, i: 2 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { count: 0, i: 2 }, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { count: 1, i: 2 }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { count: 1, i: 3 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { count: 1, i: 3 }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { count: 1, i: 3 }, stack: ["<module>"], stdout: "1" }
        ]
    },
    custom_funcs: {
        code: [
            "# Custom Functions",
            "def square(num):",
            "    result = num * num",
            "    return result",
            "",
            "val = square(4)",
            "print(val)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { square: "<function>" }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { square: "<function>" }, stack: ["<module>", "square(4)"], localMemory: { num: 4 }, stdout: "" },
            { line: 2, memory: { square: "<function>" }, stack: ["<module>", "square(4)"], localMemory: { num: 4, result: 16 }, stdout: "" },
            { line: 3, memory: { square: "<function>" }, stack: ["<module>"], returnVal: 16, stdout: "" },
            { line: 5, memory: { square: "<function>", val: 16 }, stack: ["<module>"], stdout: "" },
            { line: 6, memory: { square: "<function>", val: 16 }, stack: ["<module>"], stdout: "16" }
        ]
    },
    adv_loops: {
        code: [
            "# Advance Looping",
            "items = [50, 60]",
            "for idx, val in enumerate(items):",
            "    if idx == 1:",
            "        break",
            "    print(val)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { items: "[50, 60]" }, stack: ["<module>"], stdout: "" },
            { line: 2, memory: { items: "[50, 60]", idx: 0, val: 50 }, stack: ["<module>"], stdout: "" },
            { line: 3, memory: { items: "[50, 60]", idx: 0, val: 50 }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { items: "[50, 60]", idx: 0, val: 50 }, stack: ["<module>"], stdout: "50" },
            { line: 2, memory: { items: "[50, 60]", idx: 1, val: 60 }, stack: ["<module>"], stdout: "50" },
            { line: 3, memory: { items: "[50, 60]", idx: 1, val: 60 }, stack: ["<module>"], stdout: "50" },
            { line: 4, memory: { items: "[50, 60]", idx: 1, val: 60 }, stack: ["<module>"], stdout: "50" }
        ]
    },
    oops: {
        code: [
            "# Python OOPs",
            "class Student:",
            "    def __init__(self, name):",
            "        self.name = name",
            "",
            "std = Student('John')",
            "print(std.name)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: { Student: "<class>" }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { Student: "<class>" }, stack: ["<module>", "Student.__init__"], localMemory: { self: "<Student instance>", name: "John" }, stdout: "" },
            { line: 2, memory: { Student: "<class>" }, stack: ["<module>", "Student.__init__"], localMemory: { self: "<Student instance name='John'>", name: "John" }, stdout: "" },
            { line: 3, memory: { Student: "<class>" }, stack: ["<module>", "Student.__init__"], localMemory: { self: "<Student instance name='John'>", name: "John" }, stdout: "" },
            { line: 5, memory: { Student: "<class>", std: "<Student instance name='John'>" }, stack: ["<module>"], stdout: "" },
            { line: 6, memory: { Student: "<class>", std: "<Student instance name='John'>" }, stack: ["<module>"], stdout: "John" }
        ]
    },
    exceptions: {
        code: [
            "# Exceptional Handling",
            "try:",
            "    x = 10 / 0",
            "except ZeroDivisionError:",
            "    x = -1",
            "finally:",
            "    print(x)"
        ],
        steps: [
            { line: 0, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 1, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 2, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 3, memory: {}, stack: ["<module>"], stdout: "" },
            { line: 4, memory: { x: -1 }, stack: ["<module>"], stdout: "" },
            { line: 5, memory: { x: -1 }, stack: ["<module>"], stdout: "" },
            { line: 6, memory: { x: -1 }, stack: ["<module>"], stdout: "-1" }
        ]
    }
};

export default function PythonFlowAnimator({ initialPreset, onChangePreset }) {
    const [localPreset, setLocalPreset] = useState("basics");
    const preset = initialPreset || localPreset;
    const setPreset = onChangePreset || setLocalPreset;

    const [stepIndex, setStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1500); // ms

    // Reset step index if preset changes
    useEffect(() => {
        setStepIndex(0);
        setIsPlaying(false);
    }, [preset]);

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
                        <option value="basics">1. Python Basics & Variables</option>
                        <option value="datatypes">2. Variable Types & Classes</option>
                        <option value="slicing">3. Indexing & String Slicing</option>
                        <option value="operators">4. Mathematical & Logical Operators</option>
                        <option value="methods">5. Built-in Functions & Methods</option>
                        <option value="conditionals">6. Conditional Statements (if/elif/else)</option>
                        <option value="loops">7. Loops & Collection Iterators</option>
                        <option value="cond_loops">8. Loops with Conditional Logic</option>
                        <option value="custom_funcs">9. Defining Custom Functions</option>
                        <option value="adv_loops">10. Advanced Loop Control (break/enumerate)</option>
                        <option value="oops">11. OOP Class & Constructor Methods</option>
                        <option value="exceptions">12. Exceptional Handling (try/except)</option>
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
