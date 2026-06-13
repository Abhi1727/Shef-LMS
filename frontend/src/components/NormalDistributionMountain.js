import React, { useState, useEffect, useRef } from 'react';

export default function NormalDistributionMountain() {
    const [mean, setMean] = useState(0);
    const [stdDev, setStdDev] = useState(1);
    const [zScore, setZScore] = useState(1);
    const canvasRef = useRef(null);

    const canvasWidth = 360;
    const canvasHeight = 240;

    // Normal probability density function
    const pdf = (x, mu, sigma) => {
        const exponent = -Math.pow(x - mu, 2) / (2 * Math.pow(sigma, 2));
        return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    };

    // Numerical integration (Trapezoidal rule) to find cumulative probability P(Z < z)
    const computeCumulativeProbability = (z) => {
        // Integrate standard normal distribution from -5 to z
        let sum = 0;
        const steps = 1000;
        const start = -5;
        const stepSize = (z - start) / steps;

        for (let i = 0; i <= steps; i++) {
            const x = start + i * stepSize;
            const y = pdf(x, 0, 1);
            if (i === 0 || i === steps) {
                sum += y / 2;
            } else {
                sum += y;
            }
        }
        return Math.max(0, Math.min(1, sum * stepSize));
    };

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Center mapping
        const scaleX = 40; // Pixels per unit
        const scaleY = 400; // Stretch vertical values
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight - 30;

        // Draw Axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(canvasWidth, centerY);
        ctx.stroke();

        // Generate points for the bell curve
        const points = [];
        for (let px = 0; px <= canvasWidth; px++) {
            // Map pixel position to standard coordinate X (-4.5 to 4.5)
            const x = (px - centerX) / scaleX;
            const y = pdf(x, mean, stdDev);
            points.push({ px, py: centerY - y * scaleY, x, y });
        }

        // Draw standard deviation zones (highlighted with indigo gradient fill)
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.beginPath();
        ctx.moveTo(centerX - 1 * stdDev * scaleX, centerY);
        for (let px = 0; px <= canvasWidth; px++) {
            const pt = points[px];
            if (pt.x >= mean - 1 * stdDev && pt.x <= mean + 1 * stdDev) {
                ctx.lineTo(pt.px, pt.py);
            }
        }
        ctx.lineTo(centerX + 1 * stdDev * scaleX, centerY);
        ctx.closePath();
        ctx.fill();

        // 2 sigma zone
        ctx.fillStyle = 'rgba(99, 102, 241, 0.05)';
        ctx.beginPath();
        ctx.moveTo(centerX - 2 * stdDev * scaleX, centerY);
        for (let px = 0; px <= canvasWidth; px++) {
            const pt = points[px];
            if (pt.x >= mean - 2 * stdDev && pt.x <= mean + 2 * stdDev) {
                ctx.lineTo(pt.px, pt.py);
            }
        }
        ctx.lineTo(centerX + 2 * stdDev * scaleX, centerY);
        ctx.closePath();
        ctx.fill();

        // Draw the bell curve outline
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.px, pt.py);
            else ctx.lineTo(pt.px, pt.py);
        });
        ctx.stroke();

        // Draw vertical slices at mean +/- stdDev intervals
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.setLineDash([4, 4]);
        [-1, 1].forEach(multiplier => {
            const sliceX = centerX + multiplier * stdDev * scaleX;
            ctx.beginPath();
            ctx.moveTo(sliceX, centerY);
            ctx.lineTo(sliceX, centerY - pdf(multiplier * stdDev, 0, stdDev) * scaleY);
            ctx.stroke();
        });
        ctx.setLineDash([]);

        // Plot draggable Z-score point
        const zPixelX = centerX + zScore * stdDev * scaleX;
        const zValueY = pdf(zScore, mean, stdDev);
        const zPixelY = centerY - zValueY * scaleY;

        // Draw critical drop-line
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(zPixelX, centerY);
        ctx.lineTo(zPixelX, zPixelY);
        ctx.stroke();

        // Glow indicator
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(zPixelX, zPixelY, 7, 0, 2 * Math.PI);
        ctx.fill();

        // Text tag indicating standard deviation bounds
        ctx.fillStyle = '#8B949E';
        ctx.font = '10px monospace';
        ctx.fillText('μ', centerX - 3, centerY + 15);
        ctx.fillText('+1σ', centerX + 1 * stdDev * scaleX - 10, centerY + 15);
        ctx.fillText('-1σ', centerX - 1 * stdDev * scaleX - 10, centerY + 15);

    }, [mean, stdDev, zScore]);

    // Handle canvas clicks to drag the critical point
    const handleCanvasClick = (e) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        
        // Map pixel x back to standard units
        const centerX = canvasWidth / 2;
        const scaleX = 40;
        const clickedX = (clientX - centerX) / scaleX;
        
        // Normalize click offset into standard zScore bounds
        const computedZ = clickedX / stdDev;
        setZScore(Math.max(-3.5, Math.min(3.5, computedZ)));
    };

    const pValue = computeCumulativeProbability(zScore);

    return (
        <div className="viz-panel-grid">
            {/* Visual Mountain Curve */}
            <div className="viz-canvas-container" style={{ flexDirection: 'column', padding: '15px' }}>
                <canvas 
                    ref={canvasRef} 
                    width={canvasWidth} 
                    height={canvasHeight} 
                    onClick={handleCanvasClick}
                    style={{ cursor: 'pointer', maxWidth: '100%' }}
                />
                <div style={{ fontSize: '11px', color: '#8B949E', marginTop: '10px', textAlign: 'center' }}>
                    💡 Tap anywhere on the grid space to reposition the <span style={{ color: '#FBBF24', fontWeight: 'bold' }}>Z-Score point</span>.
                </div>
            </div>

            {/* Parameter sliders */}
            <div className="viz-sidebar">
                <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Normal Mountain</h3>
                
                <div className="viz-control-group">
                    <span className="viz-control-label">
                        <span>Mean (μ)</span>
                        <span className="viz-control-value">{mean.toFixed(2)}</span>
                    </span>
                    <input 
                        type="range"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={mean}
                        onChange={(e) => setMean(parseFloat(e.target.value))}
                        className="viz-slider"
                    />
                </div>

                <div className="viz-control-group">
                    <span className="viz-control-label">
                        <span>Std Deviation (σ)</span>
                        <span className="viz-control-value">{stdDev.toFixed(2)}</span>
                    </span>
                    <input 
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={stdDev}
                        onChange={(e) => setStdDev(parseFloat(e.target.value))}
                        className="viz-slider"
                    />
                </div>

                <div className="viz-control-group">
                    <span className="viz-control-label">
                        <span>Z-Score position</span>
                        <span className="viz-control-value">{zScore.toFixed(3)}</span>
                    </span>
                    <input 
                        type="range"
                        min="-3"
                        max="3"
                        step="0.05"
                        value={zScore}
                        onChange={(e) => setZScore(parseFloat(e.target.value))}
                        className="viz-slider"
                    />
                </div>

                <div className="viz-glass-card" style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', transform: 'none' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Probability Calculations</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#8B949E' }}>
                        <div>Cumulative P(Z &lt; {zScore.toFixed(2)}): <strong style={{ color: '#34D399' }}>{(pValue * 100).toFixed(2)}%</strong></div>
                        <div>Critical Tail (Rejection Zone): <strong style={{ color: '#F87171' }}>{((1 - pValue) * 100).toFixed(2)}%</strong></div>
                    </div>
                </div>

                <div className="viz-equation-bar">
                    <div className="viz-equation-label">Gaussian PDF Equation</div>
                    <div className="viz-equation-math">
                        f(x) = (1 / σ√(2π)) * e^-(x-μ)²/2σ²
                    </div>
                </div>
            </div>
        </div>
    );
}
