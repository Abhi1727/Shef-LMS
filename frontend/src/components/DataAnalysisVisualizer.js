import React, { useState, useEffect } from 'react';
import './resources.css';

const PRESETS = {
    basics: {
        title: "1. Getting Started with NumPy & Pandas",
        description: "Observe NumPy array vectorization and creation of a Pandas Series with custom index mappings.",
        code: [
            "# NumPy vector math & Pandas Series creation",
            "arr = np.array([25, 40, 15, 30])",
            "boosted = arr * 1.2",
            "s = pd.Series(boosted, index=['a', 'b', 'c', 'd'])",
            "print(s)"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Raw input array", type: "numpy", val: [25, 40, 15, 30] } },
            { line: 1, stdout: "", data: { label: "Raw input array", type: "numpy", val: [25, 40, 15, 30] } },
            { line: 2, stdout: "", data: { label: "Vectorized 1.2x Boost", type: "numpy", val: [30.0, 48.0, 18.0, 36.0] } },
            { line: 3, stdout: "", data: { label: "Pandas Series (Labeled Index)", type: "pandas_series", val: { a: 30.0, b: 48.0, c: 18.0, d: 36.0 } } },
            { line: 4, stdout: "a    30.0\nb    48.0\nc    18.0\nd    36.0\ndtype: float64", data: { label: "Pandas Series (Labeled Index)", type: "pandas_series", val: { a: 30.0, b: 48.0, c: 18.0, d: 36.0 } } }
        ]
    },
    wrangling: {
        title: "2. Mastering Data Wrangling",
        description: "Filter out low scores and sort the remaining students in descending order.",
        code: [
            "# Row filtering & sorting",
            "filtered = df[df['score'] > 50]",
            "sorted_df = filtered.sort_values(by='score', ascending=False)",
            "print(sorted_df)"
        ],
        steps: [
            {
                line: 0,
                stdout: "",
                data: {
                    label: "Initial DataFrame (df)",
                    type: "dataframe",
                    val: [
                        { id: 1, name: "Alice", score: 45 },
                        { id: 2, name: "Bob", score: 85 },
                        { id: 3, name: "Charlie", score: 38 },
                        { id: 4, name: "Diana", score: 92 }
                    ]
                }
            },
            {
                line: 1,
                stdout: "",
                data: {
                    label: "Filtered DataFrame (score > 50)",
                    type: "dataframe",
                    val: [
                        { id: 2, name: "Bob", score: 85 },
                        { id: 4, name: "Diana", score: 92 }
                    ]
                }
            },
            {
                line: 2,
                stdout: "",
                data: {
                    label: "Sorted DataFrame (score DESC)",
                    type: "dataframe",
                    val: [
                        { id: 4, name: "Diana", score: 92 },
                        { id: 2, name: "Bob", score: 85 }
                    ]
                }
            },
            {
                line: 3,
                stdout: "   id   name  score\n3   4  Diana     92\n1   2    Bob     85",
                data: {
                    label: "Sorted DataFrame (score DESC)",
                    type: "dataframe",
                    val: [
                        { id: 4, name: "Diana", score: 92 },
                        { id: 2, name: "Bob", score: 85 }
                    ]
                }
            }
        ]
    },
    advanced: {
        title: "3. Advanced Wrangling & Aggregation",
        description: "Add a pass/fail flag using lambda functions, then calculate the average score.",
        code: [
            "# Lambda mappings & mean aggregation",
            "df['status'] = df['score'].apply(lambda x: 'Pass' if x >= 60 else 'Fail')",
            "summary = df.groupby('subject')['score'].mean()",
            "print(summary)"
        ],
        steps: [
            {
                line: 0,
                stdout: "",
                data: {
                    label: "Initial DataFrame",
                    type: "dataframe_adv",
                    val: [
                        { name: "Alice", subject: "Python", score: 85, status: "-" },
                        { name: "Bob", subject: "ML", score: 42, status: "-" },
                        { name: "Charlie", subject: "Python", score: 95, status: "-" },
                        { name: "Diana", subject: "ML", score: 58, status: "-" }
                    ]
                }
            },
            {
                line: 1,
                stdout: "",
                data: {
                    label: "Status Assigned (score >= 60)",
                    type: "dataframe_adv",
                    val: [
                        { name: "Alice", subject: "Python", score: 85, status: "Pass" },
                        { name: "Bob", subject: "ML", score: 42, status: "Fail" },
                        { name: "Charlie", subject: "Python", score: 95, status: "Pass" },
                        { name: "Diana", subject: "ML", score: 58, status: "Fail" }
                    ]
                }
            },
            {
                line: 2,
                stdout: "",
                data: {
                    label: "Group By Subject Mean Aggregation",
                    type: "summary",
                    val: [
                        { subject: "Python", avg_score: 90.0 },
                        { subject: "ML", avg_score: 50.0 }
                    ]
                }
            },
            {
                line: 3,
                stdout: "subject\nML        50.0\nPython    90.0\nName: score, dtype: float64",
                data: {
                    label: "Group By Subject Mean Aggregation",
                    type: "summary",
                    val: [
                        { subject: "Python", avg_score: 90.0 },
                        { subject: "ML", avg_score: 50.0 }
                    ]
                }
            }
        ]
    },
    formats: {
        title: "4. Multi-format Serialization",
        description: "Parse a raw JSON string and normalize the nested objects into a clean Pandas DataFrame.",
        code: [
            "# Normalize nested JSON strings",
            "raw = '{\"data\": [{\"id\":1, \"score\":80}, {\"id\":2, \"score\":90}]}'",
            "parsed = json.loads(raw)",
            "df = pd.json_normalize(parsed, record_path=['data'])",
            "print(df)"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Unparsed raw string payload", type: "json_raw", val: '{"data": [{"id": 1, "score": 80}, {"id": 2, "score": 90}]}' } },
            { line: 1, stdout: "", data: { label: "Unparsed raw string payload", type: "json_raw", val: '{"data": [{"id": 1, "score": 80}, {"id": 2, "score": 90}]}' } },
            { line: 2, stdout: "", data: { label: "Decoded Python Dictionary Object", type: "json_dict", val: { data: [{ id: 1, score: 80 }, { id: 2, score: 90 }] } } },
            {
                line: 3,
                stdout: "",
                data: {
                    label: "Normalized DataFrame (df)",
                    type: "dataframe",
                    val: [
                        { id: 1, name: "ID 1", score: 80 },
                        { id: 2, name: "ID 2", score: 90 }
                    ]
                }
            },
            {
                line: 4,
                stdout: "   id  score\n0   1     80\n1   2     90",
                data: {
                    label: "Normalized DataFrame (df)",
                    type: "dataframe",
                    val: [
                        { id: 1, name: "ID 1", score: 80 },
                        { id: 2, name: "ID 2", score: 90 }
                    ]
                }
            }
        ]
    },
    matplotlib: {
        title: "5. Data Visualization (Matplotlib & Seaborn)",
        description: "Trace building a figure axes layout and plotting data coordinates onto canvas elements.",
        code: [
            "# Create figure & plot line graph",
            "fig, ax = plt.subplots(figsize=(6, 3))",
            "ax.plot([1, 2, 3], [10, 30, 20], color='indigo')",
            "plt.show()"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Initialize Subplots Canvas", type: "plot_canvas", val: { points: [], color: "#FFF" } } },
            { line: 1, stdout: "", data: { label: "Empty Axes Subplot Area", type: "plot_canvas", val: { points: [], color: "#FFF" } } },
            { line: 2, stdout: "", data: { label: "Render Indigo Coordinate Lines", type: "plot_canvas", val: { points: [{ x: 50, y: 150 }, { x: 150, y: 30 }, { x: 250, y: 90 }], color: "var(--res-accent-primary)" } } },
            { line: 3, stdout: "[Canvas Render Complete]", data: { label: "Render Indigo Coordinate Lines", type: "plot_canvas", val: { points: [{ x: 50, y: 150 }, { x: 150, y: 30 }, { x: 250, y: 90 }], color: "var(--res-accent-primary)" } } }
        ]
    },
    viz_tips: {
        title: "6. Vizualization Tips & Variable Analysis",
        description: "Study correlation values and render the variable heatmap grid.",
        code: [
            "# Create correlation matrix heatmap",
            "corr = df.corr()",
            "sns.heatmap(corr, annot=True, cmap='coolwarm')",
            "plt.show()"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "DataFrame Variables", type: "heatmap", val: { stage: "empty" } } },
            { line: 1, stdout: "", data: { label: "Compute Correlation Matrix", type: "heatmap", val: { stage: "matrix", matrix: [[1.0, 0.85], [0.85, 1.0]] } } },
            { line: 2, stdout: "", data: { label: "Draw Heatmap Grid", type: "heatmap", val: { stage: "grid", matrix: [[1.0, 0.85], [0.85, 1.0]] } } },
            { line: 3, stdout: "[Heatmap Drawn Successfully]", data: { label: "Draw Heatmap Grid", type: "heatmap", val: { stage: "grid", matrix: [[1.0, 0.85], [0.85, 1.0]] } } }
        ]
    },
    apis: {
        title: "7. Data Modelling via APIs",
        description: "Query mock REST API endpoints using request triggers and map parsed payloads.",
        code: [
            "# Query endpoint & verify HTTP status code",
            "res = requests.get('https://api.lms/stats')",
            "data = res.json()",
            "print(data['active_batches'])"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Send API GET Request", type: "api_console", val: { status: "IDLE", payload: null } } },
            { line: 1, stdout: "", data: { label: "HTTP 200 OK Received", type: "api_console", val: { status: "HTTP 200", payload: null } } },
            { line: 2, stdout: "", data: { label: "Decompress JSON Payload", type: "api_console", val: { status: "RESOLVED", payload: { active_batches: 14, total_students: 420 } } }, returnVal: { active_batches: 14, total_students: 420 } },
            { line: 3, stdout: "14", data: { label: "Decompress JSON Payload", type: "api_console", val: { status: "RESOLVED", payload: { active_batches: 14, total_students: 420 } } } }
        ]
    },
    plotly: {
        title: "8. Interactive Plots (Plotly)",
        description: "Construct interactive D3-powered scatter graphs with active hover states.",
        code: [
            "# Render interactive Plotly scatter",
            "fig = px.scatter(df, x='gpa', y='score', hover_name='name')",
            "fig.write_html('scatter.html')",
            "fig.show()"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Load Data coordinates", type: "plotly_scatter", val: { hoverIndex: -1 } } },
            { line: 1, stdout: "", data: { label: "Plotly Canvas Initialized", type: "plotly_scatter", val: { hoverIndex: -1 } } },
            { line: 2, stdout: "", data: { label: "Exporting interactive scatter.html file", type: "plotly_scatter", val: { hoverIndex: -1 } } },
            { line: 3, stdout: "[Plotly Sandbox active - Hover over points]", data: { label: "Interactive Plotly Canvas Active", type: "plotly_scatter", val: { hoverIndex: 1 } } }
        ]
    },
    eda_apis: {
        title: "9. Exploratory Data Analysis via APIs",
        description: "Pull student logs from external server APIs and transform into tabular formats.",
        code: [
            "# Query user logs & parse response key lists",
            "res = requests.get('https://api.lms/students')",
            "logs = res.json()['students']",
            "df = pd.DataFrame(logs)",
            "print(df.head(2))"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Querying Remote API Log Server", type: "api_console", val: { status: "PENDING", payload: null } } },
            { line: 1, stdout: "", data: { label: "Querying Remote API Log Server", type: "api_console", val: { status: "PENDING", payload: null } } },
            { line: 2, stdout: "", data: { label: "JSON array payload extracted", type: "json_raw", val: '{"students": [{"id": 101, "name": "Eve", "gpa": 3.9}, {"id": 102, "name": "Sam", "gpa": 3.6}]}' } },
            {
                line: 3,
                stdout: "",
                data: {
                    label: "Pandas DataFrame created from API records",
                    type: "dataframe_api",
                    val: [
                        { id: 101, name: "Eve", gpa: 3.9 },
                        { id: 102, name: "Sam", gpa: 3.6 }
                    ]
                }
            },
            {
                line: 4,
                stdout: "    id  name  gpa\n0  101   Eve  3.9\n1  102   Sam  3.6",
                data: {
                    label: "Pandas DataFrame created from API records",
                    type: "dataframe_api",
                    val: [
                        { id: 101, name: "Eve", gpa: 3.9 },
                        { id: 102, name: "Sam", gpa: 3.6 }
                    ]
                }
            }
        ]
    },
    streamlit: {
        title: "10. Streamlit Dashboards",
        description: "Simulate a live dashboard with interactive controls that filter dataset records dynamically.",
        code: [
            "# Streamlit interactive app code",
            "st.title('LMS Grade Tracker')",
            "min_score = st.slider('Filter Score', 0, 100, 60)",
            "filtered = df[df['score'] >= min_score]",
            "st.dataframe(filtered)"
        ],
        steps: [
            { line: 0, stdout: "", data: { label: "Initializing Streamlit Web Server", type: "streamlit_dashboard", val: { sliderVal: 60 } } },
            { line: 1, stdout: "", data: { label: "Dashboard title container loaded", type: "streamlit_dashboard", val: { sliderVal: 60 } } },
            { line: 2, stdout: "", data: { label: "Interactive slider widget initialized", type: "streamlit_dashboard", val: { sliderVal: 60 } } },
            { line: 3, stdout: "", data: { label: "Interactive DataFrame filter query computed", type: "streamlit_dashboard", val: { sliderVal: 60 } } },
            { line: 4, stdout: "[Streamlit server listening - Move slider to filter]", data: { label: "Streamlit Dashboard App Live", type: "streamlit_dashboard", val: { sliderVal: 60 } } }
        ]
    }
};

export default function DataAnalysisVisualizer({ initialPreset, onChangePreset }) {
    const [localPreset, setLocalPreset] = useState("basics");
    const preset = initialPreset || localPreset;
    const setPreset = onChangePreset || setLocalPreset;

    const [stepIndex, setStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1500); // ms

    // Streamlit interactive slider state
    const [stSlider, setStSlider] = useState(60);

    const currentPreset = PRESETS[preset] || PRESETS.basics;
    const currentStep = currentPreset.steps[stepIndex] || currentPreset.steps[0];

    useEffect(() => {
        setStepIndex(0);
        setIsPlaying(false);
    }, [preset]);

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
        setStSlider(60);
    };

    const renderVisualization = () => {
        const { type, val } = currentStep.data;

        if (type === 'numpy') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#8B949E' }}>Type: <code style={{ color: '#F59E0B' }}>numpy.ndarray</code></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {val.map((v, i) => (
                            <div key={i} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', padding: '15px 20px', borderRadius: '8px', textAlign: 'center', minWidth: '60px' }}>
                                <div style={{ fontSize: '10px', color: '#484F58', marginBottom: '4px' }}>[{i}]</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#F0F6FC' }}>{v}</div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === 'pandas_series') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#8B949E' }}>Type: <code style={{ color: '#6366F1' }}>pandas.Series</code></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '200px' }}>
                        {Object.entries(val).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: '#111827', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: '#8B949E', fontFamily: 'monospace' }}>{k}</span>
                                <span style={{ fontWeight: 'bold', color: '#6366F1' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === 'dataframe') {
            return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#F0F6FC' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>ID</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>Name</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#8B949E' }}>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {val.map((row) => (
                            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px', color: '#8B949E' }}>{row.id}</td>
                                <td style={{ padding: '8px', fontWeight: '500' }}>{row.name}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#6366F1' }}>{row.score}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (type === 'dataframe_api') {
            return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#F0F6FC' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>ID</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>Name</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#8B949E' }}>GPA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {val.map((row) => (
                            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px', color: '#8B949E' }}>{row.id}</td>
                                <td style={{ padding: '8px', fontWeight: '500' }}>{row.name}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#10B981' }}>{row.gpa}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (type === 'dataframe_adv') {
            return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#F0F6FC' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>Name</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#8B949E' }}>Subject</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#8B949E' }}>Score</th>
                            <th style={{ padding: '8px', textAlign: 'center', color: '#8B949E' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {val.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px' }}>{row.name}</td>
                                <td style={{ padding: '8px', color: '#8B949E' }}>{row.subject}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>{row.score}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <span style={{ 
                                        padding: '2px 6px', 
                                        borderRadius: '4px', 
                                        fontSize: '10px',
                                        background: row.status === 'Pass' ? 'rgba(16, 185, 129, 0.1)' : row.status === 'Fail' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                        color: row.status === 'Pass' ? '#34D399' : row.status === 'Fail' ? '#F87171' : '#8B949E'
                                    }}>
                                        {row.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (type === 'summary') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#8B949E' }}>Grouped Result: <code style={{ color: '#10B981' }}>groupby().mean()</code></div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        {val.map((row, idx) => (
                            <div key={idx} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', padding: '15px 20px', borderRadius: '8px', textAlign: 'center', minWidth: '100px' }}>
                                <div style={{ fontSize: '11px', color: '#8B949E', marginBottom: '4px' }}>{row.subject}</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10B981' }}>{row.avg_score.toFixed(1)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === 'json_raw') {
            return (
                <div style={{ width: '100%', background: '#070A0F', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '15px', fontFamily: 'monospace', fontSize: '11px', color: '#F0F6FC', whiteSpace: 'pre-wrap' }}>
                    {val}
                </div>
            );
        }

        if (type === 'json_dict') {
            return (
                <pre style={{ margin: 0, fontSize: '11px', color: '#F59E0B', fontFamily: 'monospace', background: '#0D1117', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {JSON.stringify(val, null, 2)}
                </pre>
            );
        }

        if (type === 'plot_canvas') {
            return (
                <div style={{ width: '280px', height: '180px', background: '#070A0F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', position: 'relative' }}>
                    {/* Y-axis label */}
                    <div style={{ position: 'absolute', left: '2px', top: '10px', fontSize: '8px', color: '#484F58' }}>Y</div>
                    {/* X-axis label */}
                    <div style={{ position: 'absolute', right: '10px', bottom: '2px', fontSize: '8px', color: '#484F58' }}>X</div>

                    {/* SVG plotting lines */}
                    <svg style={{ width: '100%', height: '100%' }}>
                        {val.points.map((pt, i) => (
                            <React.Fragment key={i}>
                                <circle cx={pt.x} cy={pt.y} r="4" fill={val.color} />
                                {i > 0 && (
                                    <line 
                                        x1={val.points[i-1].x} 
                                        y1={val.points[i-1].y} 
                                        x2={pt.x} 
                                        y2={pt.y} 
                                        stroke={val.color} 
                                        strokeWidth="2" 
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </svg>
                </div>
            );
        }

        if (type === 'heatmap') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    {val.stage === 'empty' ? (
                        <div style={{ fontSize: '12px', color: '#484F58' }}>[Empty Heatmap Canvas]</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 80px', gap: '4px' }}>
                            <div style={{ background: '#3B82F6', color: '#FFF', padding: '20px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>1.0</div>
                            <div style={{ background: '#EF4444', color: '#FFF', padding: '20px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>0.85</div>
                            <div style={{ background: '#EF4444', color: '#FFF', padding: '20px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>0.85</div>
                            <div style={{ background: '#3B82F6', color: '#FFF', padding: '20px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>1.0</div>
                        </div>
                    )}
                    {val.stage !== 'empty' && (
                        <div style={{ display: 'flex', gap: '20px', fontSize: '10px', color: '#8B949E', marginTop: '5px' }}>
                            <span>X Variables: ['score', 'gpa']</span>
                            <span>Y Variables: ['score', 'gpa']</span>
                        </div>
                    )}
                </div>
            );
        }

        if (type === 'api_console') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '90%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: '#111827', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#8B949E' }}>Status:</span>
                        <span style={{ fontWeight: 'bold', color: val.status.includes('200') || val.status === 'RESOLVED' ? '#10B981' : '#F59E0B' }}>{val.status}</span>
                    </div>
                    {val.payload && (
                        <pre style={{ margin: 0, fontSize: '11px', color: '#34D399', background: '#000', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace' }}>
                            {JSON.stringify(val.payload, null, 2)}
                        </pre>
                    )}
                </div>
            );
        }

        if (type === 'plotly_scatter') {
            // Plotly interactive dots
            const points = [
                { name: "Eve", x: 45, y: 150, gpa: 3.9, score: 95 },
                { name: "Sam", x: 145, y: 60, gpa: 3.4, score: 72 },
                { name: "Joe", x: 220, y: 110, gpa: 3.1, score: 85 }
            ];
            const activeHoverIndex = currentStep.line === 3 ? 1 : -1; // Trigger hover in step 3
            return (
                <div style={{ width: '280px', height: '180px', background: '#070A0F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', position: 'relative' }}>
                    <svg style={{ width: '100%', height: '100%' }}>
                        {points.map((pt, i) => (
                            <circle 
                                key={i} 
                                cx={pt.x} 
                                cy={pt.y} 
                                r={activeHoverIndex === i ? "8" : "5"} 
                                fill={activeHoverIndex === i ? "var(--res-accent-primary)" : "#6366F1"} 
                                style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                            />
                        ))}
                    </svg>
                    {activeHoverIndex !== -1 && (
                        <div style={{ position: 'absolute', left: '100px', top: '25px', background: 'rgba(13,17,23,0.95)', border: '1px solid var(--res-accent-primary)', padding: '6px 10px', borderRadius: '4px', fontSize: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', zIndex: 10 }}>
                            <div style={{ fontWeight: 'bold', color: '#FFF' }}>{points[activeHoverIndex].name}</div>
                            <div style={{ color: '#8B949E' }}>GPA: {points[activeHoverIndex].gpa}</div>
                            <div style={{ color: 'var(--res-accent-primary)' }}>Score: {points[activeHoverIndex].score}</div>
                        </div>
                    )}
                </div>
            );
        }

        if (type === 'streamlit_dashboard') {
            // Streamlit interactive simulation
            const students = [
                { name: "Alice", score: 85 },
                { name: "Bob", score: 42 },
                { name: "Charlie", score: 95 },
                { name: "Diana", score: 72 },
                { name: "Ethan", score: 58 }
            ];
            const filtered = students.filter(s => s.score >= stSlider);
            return (
                <div style={{ width: '90%', display: 'flex', flexDirection: 'column', gap: '15px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '15px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFF', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>🎈 Streamlit Local Host</div>
                    
                    {/* Score Filter Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8B949E' }}>
                            <span>Filter Score Slider</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--res-accent-secondary)' }}>{stSlider}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={stSlider} 
                            onChange={(e) => setStSlider(parseInt(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Filtered records */}
                    <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <tbody>
                                {filtered.map((s, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '4px 0', color: '#FFF' }}>{s.name}</td>
                                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold', color: '#6366F1' }}>{s.score}</td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="2" style={{ textAlign: 'center', color: '#484F58', padding: '10px 0' }}>No records match filter</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="viz-panel-grid">
            <div className="viz-canvas-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: 'rgba(8, 12, 20, 0.4)', borderRadius: '12px', minHeight: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid var(--res-border-subtle)', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--res-accent-primary)' }}>
                        🖥️ {currentStep.data.label}
                    </span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderVisualization()}
                </div>

                {/* Console Log stdout */}
                <div style={{ background: '#000', borderRadius: '6px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '11px', color: '#34D399' }}>
                    <span style={{ color: '#8B949E', marginRight: '10px' }}>stdout:</span>
                    {currentStep.stdout || <span style={{ opacity: 0.2 }}>[No console output]</span>}
                </div>
            </div>

            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#F0F6FC' }}>DataFrame Manipulator</h3>
                <p style={{ fontSize: '12px', color: '#8B949E', margin: '4px 0 15px 0' }}>{currentPreset.description}</p>

                <div className="viz-equation-bar" style={{ minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: '15px' }}>
                    <div className="viz-equation-label">Python Source Code</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px', background: '#0D1117', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', color: '#818CF8' }}>
                        {currentPreset.code.map((line, idx) => (
                            <div 
                                key={idx} 
                                style={{ 
                                    padding: '2px 4px', 
                                    background: currentStep.line === idx ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    borderLeft: currentStep.line === idx ? '2px solid #6366F1' : '2px solid transparent'
                                }}
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="viz-btn-primary"
                        style={{ flex: 1 }}
                    >
                        {isPlaying ? '⏸️ Pause' : '▶️ Auto Play'}
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

                <button onClick={handleReset} className="viz-btn-secondary" style={{ width: '100%', marginTop: '10px' }}>
                    🔄 Reset Sandbox
                </button>
            </div>
        </div>
    );
}
