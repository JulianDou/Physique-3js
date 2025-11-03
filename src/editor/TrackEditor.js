/**
 * TrackEditor - Interactive canvas-based track editor
 * Allows users to draw custom racing circuits point by point
 */

class TrackEditor {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('trackCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Editor state
        this.points = []; // Array of {x, y} points
        this.mode = 'draw'; // 'draw' or 'edit'
        this.selectedPoint = null; // Index of selected point in edit mode
        this.hoveredPoint = null; // Index of hovered point
        this.isDragging = false;
        this.isPanning = false;
        
        // View transformation
        this.offset = { x: 0, y: 0 };
        this.zoom = 1;
        this.panStart = { x: 0, y: 0 };
        
        // Settings
        this.trackWidth = 40;
        this.smoothness = 0.5;
        this.showGrid = false;
        this.snapToGrid = false;
        this.closedLoop = true;
        this.gridSize = 50;
        
        // History for undo
        this.history = [];
        this.maxHistory = 50;
        
        // Initialize
        this.initCanvas();
        this.setupEventListeners();
        this.render();
    }

    initCanvas() {
        // Set canvas size to container size
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Center the view
        this.offset.x = this.canvas.width / 2;
        this.offset.y = this.canvas.height / 2;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.render();
        });
    }

    setupEventListeners() {
        // Canvas mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));
        
        // Keyboard events
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // UI Controls
        document.getElementById('drawMode').addEventListener('click', () => this.setMode('draw'));
        document.getElementById('editMode').addEventListener('click', () => this.setMode('edit'));
        
        document.getElementById('trackWidth').addEventListener('input', (e) => {
            this.trackWidth = parseInt(e.target.value);
            document.getElementById('trackWidthValue').textContent = this.trackWidth;
            this.render();
        });
        
        document.getElementById('smoothness').addEventListener('input', (e) => {
            this.smoothness = parseFloat(e.target.value);
            document.getElementById('smoothnessValue').textContent = this.smoothness.toFixed(1);
            this.render();
        });
        
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
        
        document.getElementById('snapToGrid').addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
        });
        
        document.getElementById('closedLoop').addEventListener('change', (e) => {
            this.closedLoop = e.target.checked;
            this.render();
        });
        
        document.getElementById('clearBtn').addEventListener('click', () => this.clearTrack());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('centerBtn').addEventListener('click', () => this.centerView());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportTrack());
        document.getElementById('importBtn').addEventListener('click', () => this.importTrack());
        
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    setMode(mode) {
        this.mode = mode;
        this.selectedPoint = null;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${mode}Mode`).classList.add('active');
        
        // Update cursor
        this.canvas.className = mode === 'edit' ? 'edit-mode' : '';
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        
        // Check for space key (panning)
        if (e.button === 0 && this.spacePressed) {
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.offset.x, y: e.clientY - this.offset.y };
            this.canvas.classList.add('pan-mode');
            return;
        }
        
        if (this.mode === 'draw' && e.button === 0) {
            this.addPoint(pos);
        } else if (this.mode === 'edit' && e.button === 0) {
            const pointIndex = this.findNearestPoint(pos, 15);
            if (pointIndex !== -1) {
                this.selectedPoint = pointIndex;
                this.isDragging = true;
            }
        }
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);
        
        // Update mouse position display
        document.getElementById('mousePos').textContent = 
            `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;
        
        // Handle panning
        if (this.isPanning) {
            this.offset.x = e.clientX - this.panStart.x;
            this.offset.y = e.clientY - this.panStart.y;
            this.render();
            return;
        }
        
        // Handle point dragging in edit mode
        if (this.mode === 'edit' && this.isDragging && this.selectedPoint !== null) {
            this.points[this.selectedPoint] = this.snapToGrid ? this.snapPoint(pos) : pos;
            this.render();
            return;
        }
        
        // Highlight hovered point
        const nearestPoint = this.findNearestPoint(pos, 15);
        if (nearestPoint !== this.hoveredPoint) {
            this.hoveredPoint = nearestPoint;
            this.render();
        }
    }

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.classList.remove('pan-mode');
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            this.saveHistory();
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        const mousePos = { x: e.clientX, y: e.clientY };
        const worldPosBefore = this.screenToWorld(mousePos);
        
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= zoomFactor;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom)); // Clamp zoom
        
        // Adjust offset to keep zoom centered on mouse
        const worldPosAfter = this.screenToWorld(mousePos);
        this.offset.x += (worldPosAfter.x - worldPosBefore.x) * this.zoom;
        this.offset.y += (worldPosAfter.y - worldPosBefore.y) * this.zoom;
        
        this.render();
    }

    onContextMenu(e) {
        e.preventDefault();
        
        const pos = this.getMousePos(e);
        const pointIndex = this.findNearestPoint(pos, 15);
        
        if (pointIndex !== -1) {
            this.removePoint(pointIndex);
        }
    }

    onKeyDown(e) {
        if (e.key === ' ') {
            e.preventDefault();
            this.spacePressed = true;
            if (!this.isPanning) {
                this.canvas.style.cursor = 'grab';
            }
        }
        
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.undo();
        }
        
        if (e.key === 'Delete' && this.selectedPoint !== null) {
            this.removePoint(this.selectedPoint);
            this.selectedPoint = null;
        }
    }

    onKeyUp(e) {
        if (e.key === ' ') {
            this.spacePressed = false;
            this.canvas.style.cursor = this.mode === 'edit' ? 'move' : 'crosshair';
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        return this.screenToWorld(screenPos);
    }

    screenToWorld(screenPos) {
        return {
            x: (screenPos.x - this.offset.x) / this.zoom,
            y: (screenPos.y - this.offset.y) / this.zoom
        };
    }

    worldToScreen(worldPos) {
        return {
            x: worldPos.x * this.zoom + this.offset.x,
            y: worldPos.y * this.zoom + this.offset.y
        };
    }

    snapPoint(pos) {
        return {
            x: Math.round(pos.x / this.gridSize) * this.gridSize,
            y: Math.round(pos.y / this.gridSize) * this.gridSize
        };
    }

    addPoint(pos) {
        const point = this.snapToGrid ? this.snapPoint(pos) : pos;
        this.points.push(point);
        this.saveHistory();
        this.render();
        this.updateExportButton();
    }

    removePoint(index) {
        this.points.splice(index, 1);
        this.saveHistory();
        this.render();
        this.updateExportButton();
    }

    findNearestPoint(pos, threshold) {
        let nearest = -1;
        let minDist = threshold / this.zoom;
        
        for (let i = 0; i < this.points.length; i++) {
            const dx = this.points[i].x - pos.x;
            const dy = this.points[i].y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        }
        
        return nearest;
    }

    clearTrack() {
        if (this.points.length === 0) return;
        
        if (confirm('Are you sure you want to clear the track?')) {
            this.points = [];
            this.saveHistory();
            this.render();
            this.updateExportButton();
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify(this.points));
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    undo() {
        if (this.history.length > 1) {
            this.history.pop(); // Remove current state
            const prevState = this.history[this.history.length - 1];
            this.points = JSON.parse(prevState);
            this.render();
            this.updateExportButton();
        } else if (this.history.length === 1) {
            this.points = [];
            this.history = [];
            this.render();
            this.updateExportButton();
        }
    }

    centerView() {
        if (this.points.length === 0) {
            this.offset.x = this.canvas.width / 2;
            this.offset.y = this.canvas.height / 2;
            this.zoom = 1;
        } else {
            // Calculate bounding box
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const point of this.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            
            const width = maxX - minX;
            const height = maxY - minY;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            // Calculate zoom to fit
            const padding = 100;
            const zoomX = (this.canvas.width - padding) / width;
            const zoomY = (this.canvas.height - padding) / height;
            this.zoom = Math.min(zoomX, zoomY, 2);
            
            // Center on track
            this.offset.x = this.canvas.width / 2 - centerX * this.zoom;
            this.offset.y = this.canvas.height / 2 - centerY * this.zoom;
        }
        
        this.render();
    }

    updateExportButton() {
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.disabled = this.points.length < 3;
        
        document.getElementById('pointCount').textContent = `Points: ${this.points.length}`;
    }

    exportTrack() {
        if (this.points.length < 3) {
            alert('You need at least 3 points to export a track!');
            return;
        }
        
        const trackData = {
            version: '1.0',
            name: 'Custom Track',
            created: new Date().toISOString(),
            settings: {
                trackWidth: this.trackWidth,
                smoothness: this.smoothness,
                closedLoop: this.closedLoop
            },
            editor: {
                gridSize: this.gridSize,  // Grid size in pixels (50px per grid square)
                gridScale: 10  // Each grid square = 10 units in 3D world
            },
            points: this.points
        };
        
        const json = JSON.stringify(trackData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `custom-track-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    importTrack() {
        const fileInput = document.getElementById('fileInput');
        fileInput.click();
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.points || !Array.isArray(data.points)) {
                        throw new Error('Invalid track data format');
                    }
                    
                    this.points = data.points;
                    
                    if (data.settings) {
                        this.trackWidth = data.settings.trackWidth || this.trackWidth;
                        this.smoothness = data.settings.smoothness || this.smoothness;
                        this.closedLoop = data.settings.closedLoop !== undefined ? 
                            data.settings.closedLoop : this.closedLoop;
                        
                        // Update UI
                        document.getElementById('trackWidth').value = this.trackWidth;
                        document.getElementById('trackWidthValue').textContent = this.trackWidth;
                        document.getElementById('smoothness').value = this.smoothness;
                        document.getElementById('smoothnessValue').textContent = this.smoothness.toFixed(1);
                        document.getElementById('closedLoop').checked = this.closedLoop;
                    }
                    
                    this.saveHistory();
                    this.centerView();
                    this.updateExportButton();
                    
                } catch (error) {
                    alert('Error loading track: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
    }

    render() {
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.save();
        
        // Draw grid if enabled
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // Draw track if we have enough points
        if (this.points.length >= 2) {
            this.drawTrack();
        }
        
        // Draw control points
        this.drawPoints();
        
        ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        const gridSize = this.gridSize * this.zoom;
        
        // Calculate visible grid range
        const startX = Math.floor(-this.offset.x / gridSize) * gridSize;
        const startY = Math.floor(-this.offset.y / gridSize) * gridSize;
        const endX = this.canvas.width;
        const endY = this.canvas.height;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Vertical lines
        for (let x = startX; x < endX; x += gridSize) {
            ctx.moveTo(x + this.offset.x, 0);
            ctx.lineTo(x + this.offset.x, this.canvas.height);
        }
        
        // Horizontal lines
        for (let y = startY; y < endY; y += gridSize) {
            ctx.moveTo(0, y + this.offset.y);
            ctx.lineTo(this.canvas.width, y + this.offset.y);
        }
        
        ctx.stroke();
        
        // Draw origin
        const origin = this.worldToScreen({ x: 0, y: 0 });
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x - 10, origin.y);
        ctx.lineTo(origin.x + 10, origin.y);
        ctx.moveTo(origin.x, origin.y - 10);
        ctx.lineTo(origin.x, origin.y + 10);
        ctx.stroke();
    }

    drawTrack() {
        const ctx = this.ctx;
        const screenPoints = this.points.map(p => this.worldToScreen(p));
        
        // Draw track surface
        ctx.strokeStyle = '#1a1a1a';
        ctx.fillStyle = '#2a2a2a';
        ctx.lineWidth = this.trackWidth * this.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        this.drawCurve(screenPoints, this.closedLoop);
        ctx.stroke();
        
        // Draw center line
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10 * this.zoom, 10 * this.zoom]);
        
        this.drawCurve(screenPoints, this.closedLoop);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw track edges
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        this.drawTrackEdges(screenPoints, this.closedLoop);
    }

    drawCurve(points, closed) {
        if (points.length < 2) return;
        
        const ctx = this.ctx;
        ctx.beginPath();
        
        if (this.smoothness === 0) {
            // No smoothing - just straight lines
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            if (closed) {
                ctx.lineTo(points[0].x, points[0].y);
            }
        } else {
            // Catmull-Rom spline for smooth curves
            const tension = this.smoothness;
            
            if (closed) {
                // For closed curves, wrap around
                const extendedPoints = [
                    points[points.length - 1],
                    ...points,
                    points[0],
                    points[1]
                ];
                
                ctx.moveTo(extendedPoints[1].x, extendedPoints[1].y);
                
                for (let i = 1; i < extendedPoints.length - 2; i++) {
                    const p0 = extendedPoints[i - 1];
                    const p1 = extendedPoints[i];
                    const p2 = extendedPoints[i + 1];
                    const p3 = extendedPoints[i + 2];
                    
                    this.drawCatmullRomSegment(ctx, p0, p1, p2, p3, tension);
                }
            } else {
                ctx.moveTo(points[0].x, points[0].y);
                
                for (let i = 0; i < points.length - 1; i++) {
                    const p0 = i > 0 ? points[i - 1] : points[i];
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
                    
                    this.drawCatmullRomSegment(ctx, p0, p1, p2, p3, tension);
                }
            }
        }
    }

    drawCatmullRomSegment(ctx, p0, p1, p2, p3, tension) {
        const steps = 20;
        
        for (let t = 0; t <= steps; t++) {
            const u = t / steps;
            const u2 = u * u;
            const u3 = u2 * u;
            
            // Standard Catmull-Rom spline formula
            const catmullX = 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * u +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
            );
            
            const catmullY = 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * u +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
            );
            
            // Linear interpolation between p1 and p2
            const linearX = p1.x + (p2.x - p1.x) * u;
            const linearY = p1.y + (p2.y - p1.y) * u;
            
            // Blend between Catmull-Rom and linear based on tension
            const x = catmullX * tension + linearX * (1 - tension);
            const y = catmullY * tension + linearY * (1 - tension);
            
            ctx.lineTo(x, y);
        }
    }

    drawTrackEdges(points, closed) {
        // This is a simplified version - in a real implementation,
        // you'd calculate perpendicular offsets for accurate edges
        // For now, just draw the curve outline
        this.drawCurve(points, closed);
        this.ctx.stroke();
    }

    drawPoints() {
        const ctx = this.ctx;
        
        for (let i = 0; i < this.points.length; i++) {
            const screenPos = this.worldToScreen(this.points[i]);
            const isHovered = i === this.hoveredPoint;
            const isSelected = i === this.selectedPoint;
            
            // Point outer circle
            ctx.fillStyle = isSelected ? '#00ff00' : (isHovered ? '#ffff00' : '#ffffff');
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, isHovered || isSelected ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Point inner circle
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, isHovered || isSelected ? 4 : 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Point number
            if (this.zoom > 0.5) {
                ctx.fillStyle = isSelected ? '#00ff00' : (isHovered ? '#ffff00' : '#ffffff');
                ctx.font = `${Math.max(10, 12 * this.zoom)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(i + 1, screenPos.x, screenPos.y - 10);
            }
        }
    }
}

// Initialize the editor when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new TrackEditor();
});
