import React, { useState, useEffect, useRef } from 'react';

export default function KMeansClusterTheater({ initialK = 3, initialMethod = 'kmeans++' }) {
    const [k, setK] = useState(initialK);
    const [initMethod, setInitMethod] = useState(initialMethod);

    useEffect(() => {
        setK(initialK);
        setInitMethod(initialMethod);
    }, [initialK, initialMethod]);

    const [points, setPoints] = useState([]);
    const [centroids, setCentroids] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [step, setStep] = useState(0); // 0: init, 1: assign, 2: update
    const [inertia, setInertia] = useState(0);
    const canvasRef = useRef(null);

    const canvasWidth = 360;
    const canvasHeight = 240;

    const COLORS = ['#6366F1', '#F59E0B', '#10B981', '#F43F5E', '#A855F7', '#38BDF8'];

    // Generate random synthetic blobs
    const generateDataset = () => {
        const generated = [];
        const centers = [
            { x: 100, y: 80 },
            { x: 260, y: 90 },
            { x: 180, y: 170 }
        ];

        // Plant points around centers to form natural clusters
        centers.forEach(center => {
            for (let i = 0; i < 25; i++) {
                const r = Math.random() * 40;
                const theta = Math.random() * 2 * Math.PI;
                generated.push({
                    x: Math.max(10, Math.min(canvasWidth - 10, center.x + r * Math.cos(theta))),
                    y: Math.max(10, Math.min(canvasHeight - 10, center.y + r * Math.sin(theta)))
                });
            }
        });
        setPoints(generated);
        setStep(0);
        setAssignments([]);
        
        // Initialize centroids
        initializeCentroids(generated, k, initMethod);
    };

    const initializeCentroids = (dataset, clusterCount, method) => {
        if (dataset.length === 0) return;
        let selected = [];

        if (method === 'random') {
            for (let i = 0; i < clusterCount; i++) {
                const randomPoint = dataset[Math.floor(Math.random() * dataset.length)];
                selected.push({ x: randomPoint.x, y: randomPoint.y });
            }
        } else {
            // Smart K-Means++ initialization
            // First centroid chosen uniformly at random
            selected.push({ ...dataset[Math.floor(Math.random() * dataset.length)] });

            for (let c = 1; c < clusterCount; c++) {
                // Compute distance squared to nearest existing centroid
                const distances = dataset.map(p => {
                    const minDistSq = Math.min(...selected.map(s => Math.pow(p.x - s.x, 2) + Math.pow(p.y - s.y, 2)));
                    return minDistSq;
                });

                // Probability proportional to distance squared
                const sumDistSq = distances.reduce((a, b) => a + b, 0);
                let randVal = Math.random() * sumDistSq;
                let targetIndex = 0;

                for (let i = 0; i < distances.length; i++) {
                    randVal -= distances[i];
                    if (randVal <= 0) {
                        targetIndex = i;
                        break;
                    }
                }
                selected.push({ ...dataset[targetIndex] });
            }
        }
        setCentroids(selected);
        setAssignments(new Array(dataset.length).fill(-1));
        setStep(0);
    };

    // Lloyd's Step 1: Assignment (assign points to nearest centroid)
    const assignPoints = () => {
        let currentInertia = 0;
        const nextAssignments = points.map(p => {
            let minDist = Infinity;
            let closestIndex = -1;
            centroids.forEach((c, idx) => {
                const dist = Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2);
                if (dist < minDist) {
                    minDist = dist;
                    closestIndex = idx;
                }
            });
            currentInertia += minDist;
            return closestIndex;
        });

        setAssignments(nextAssignments);
        setInertia(Math.round(currentInertia));
        setStep(1);
    };

    // Lloyd's Step 2: Update (slide centroids to means of cluster)
    const updateCentroids = () => {
        const sumsX = new Array(k).fill(0);
        const sumsY = new Array(k).fill(0);
        const counts = new Array(k).fill(0);

        assignments.forEach((cIdx, pIdx) => {
            if (cIdx !== -1) {
                sumsX[cIdx] += points[pIdx].x;
                sumsY[cIdx] += points[pIdx].y;
                counts[cIdx]++;
            }
        });

        const nextCentroids = centroids.map((c, idx) => {
            if (counts[idx] > 0) {
                return {
                    x: sumsX[idx] / counts[idx],
                    y: sumsY[idx] / counts[idx]
                };
            }
            return c; // fallback
        });

        setCentroids(nextCentroids);
        setStep(2);
    };

    useEffect(() => {
        generateDataset();
    }, [k, initMethod]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Draw points with their cluster coloring
        points.forEach((p, idx) => {
            const assign = assignments[idx];
            ctx.fillStyle = assign !== undefined && assign !== -1 ? COLORS[assign % COLORS.length] : 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Draw assignment trace lines to centroids in assignment step
            if (step === 1 && assign !== -1 && centroids[assign]) {
                ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(centroids[assign].x, centroids[assign].y);
                ctx.stroke();
            }
        });

        // Draw Centroids
        centroids.forEach((c, idx) => {
            ctx.strokeStyle = '#FFFFFF';
            ctx.fillStyle = COLORS[idx % COLORS.length];
            ctx.lineWidth = 2;
            
            // Draw a distinct star/cross to designate cluster center
            ctx.beginPath();
            ctx.arc(c.x, c.y, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText(idx + 1, c.x - 3, c.y + 3);
        });
    }, [points, centroids, assignments, step]);

    return (
        <div className="viz-panel-grid">
            {/* Visual Canvas Board */}
            <div className="viz-canvas-container" style={{ flexDirection: 'column', padding: '15px' }}>
                <canvas 
                    ref={canvasRef} 
                    width={canvasWidth} 
                    height={canvasHeight}
                    style={{ maxWidth: '100%', background: '#080C14', borderRadius: '6px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '10px', fontSize: '11px', color: '#8B949E' }}>
                    <span>Step state: <strong>{step === 0 ? 'Initialized' : step === 1 ? 'Points Assigned' : 'Centroids Shifted'}</strong></span>
                    <span>Inertia (WCSS): <strong style={{ color: '#6366F1' }}>{inertia > 0 ? inertia.toLocaleString() : 'N/A'}</strong></span>
                </div>
            </div>

            {/* controls */}
            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600' }}>K-Means Theater</h3>

                <div className="viz-control-group">
                    <span className="viz-control-label">
                        <span>Clusters (K)</span>
                        <span className="viz-control-value">{k}</span>
                    </span>
                    <input 
                        type="range"
                        min="2"
                        max="6"
                        step="1"
                        value={k}
                        onChange={(e) => setK(parseInt(e.target.value))}
                        className="viz-slider"
                    />
                </div>

                <div className="viz-control-group">
                    <label className="viz-control-label">Centroid Initialization</label>
                    <select 
                        value={initMethod} 
                        onChange={(e) => setInitMethod(e.target.value)}
                        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F6FC', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                    >
                        <option value="kmeans++">K-Means++ (Smart spacing)</option>
                        <option value="random">Pure Random Coordinates</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={assignPoints} className="viz-btn-primary" style={{ flex: 1 }}>
                            Step 1: Assign
                        </button>
                        <button onClick={updateCentroids} className="viz-btn-primary" style={{ flex: 1, background: '#10B981' }}>
                            Step 2: Update
                        </button>
                    </div>
                    
                    <button onClick={generateDataset} className="viz-btn-secondary">
                        🔄 Regerate Points
                    </button>
                </div>

                <div className="viz-equation-bar">
                    <div className="viz-equation-label">Optimization Target</div>
                    <div className="viz-equation-math">
                        arg min Σ_i Σ_x||x - μ_i||²
                    </div>
                </div>
            </div>
        </div>
    );
}
