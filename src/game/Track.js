import * as THREE from 'three';

/**
 * Track - Manages the racing track generation and rendering
 * Uses a skeleton-based approach: first generate a path of points,
 * then build the track geometry around those points
 */
export class Track {
    constructor(scene, customData = null) {
        this.scene = scene;
        
        // Track configuration
        this.trackWidth = 12; // Width of the racing track (increased for larger track)
        this.wallHeight = 0.6; // Height of the track walls (reduced for better visibility)
        this.skeletonPoints = []; // Array of Vector3 points defining the centerline
        this.trackCurve = null; // Smooth curve for surface queries
        
        // Segment-based system for overlapping track support
        this.segments = []; // Array of track segments with connectivity
        this.segmentCurves = []; // Individual curves for each segment
        
        // Track meshes
        this.trackMesh = null;
        this.innerWall = null;
        this.outerWall = null;
        this.finishLineMesh = null;
        
        // Checkpoints for lap validation
        this.checkpoints = []; // Array of checkpoint data
        this.numCheckpoints = 4; // Number of validation checkpoints (excluding finish line)
        
        // Custom track data
        this.isCustomTrack = customData !== null;
        
        // Generate or load the track
        if (customData) {
            this._loadCustomTrack(customData);
        } else {
            this._generateSkeleton();
        }
        
        this._createSegments();
        this._buildTrack();
        this._buildWalls();
        this._createCheckpoints();
        this._createFinishLine();
    }

    /**
     * Generate the skeleton path for the track
     * Creates a circular base with radius variation for interesting turns and altitude changes
     */
    _generateSkeleton() {
        this.skeletonPoints = [];
        
        const baseRadius = 70; // Base radius of the track (increased for longer track)
        const segments = 64; // Number of points in the circle
        const radiusVariation = 0.3; // How much the radius can vary (0.3 = 30%)
        const smoothing = 0.6; // How much to smooth out sharp changes (0-1, higher = smoother)
        
        // Altitude variation parameters
        const maxAltitude = 8; // Maximum altitude change (positive or negative)
        const altitudeSmoothing = 0.7; // Higher = smoother altitude transitions
        const startLevelLength = 8; // Number of segments to keep level near start/finish
        
        // Generate random radius multipliers for each segment
        const radiusMultipliers = [];
        const altitudeValues = [];
        
        for (let i = 0; i < segments; i++) {
            // Calculate distance from finish line (segment 0)
            // Distance wraps around the circle
            const distanceFromStart = Math.min(i, segments - i);
            const startStraightLength = 8; // Number of segments to keep straighter near start
            
            // Reduce variation near the start/finish line
            let localVariation = radiusVariation;
            if (distanceFromStart < startStraightLength) {
                // Gradually reduce variation from 0% at start to 100% at startStraightLength
                const variationMultiplier = distanceFromStart / startStraightLength;
                localVariation = radiusVariation * variationMultiplier;
            }
            
            // Random variation between (1 - localVariation) and (1 + localVariation)
            const randomMultiplier = 1 + (Math.random() * 2 - 1) * localVariation;
            radiusMultipliers.push(randomMultiplier);
            
            // Generate altitude values
            // Reduce altitude variation near start/finish line for smoother start
            let localAltitudeVariation = maxAltitude;
            if (distanceFromStart < startLevelLength) {
                const altitudeMultiplier = distanceFromStart / startLevelLength;
                localAltitudeVariation = maxAltitude * altitudeMultiplier;
            }
            
            // Random altitude, biased towards previous segment's altitude
            let altitude;
            if (i === 0) {
                altitude = 0; // Start at ground level
            } else {
                const prevAltitude = altitudeValues[i - 1];
                // Random change from previous altitude (-localAltitudeVariation to +localAltitudeVariation)
                const maxChange = localAltitudeVariation * 0.3; // Limit change per segment
                const altitudeChange = (Math.random() * 2 - 1) * maxChange;
                altitude = prevAltitude + altitudeChange;
                // Clamp to max altitude range
                altitude = Math.max(-maxAltitude, Math.min(maxAltitude, altitude));
            }
            altitudeValues.push(altitude);
        }
        
        // Smooth the radius multipliers to avoid sharp transitions
        const smoothedMultipliers = [];
        for (let i = 0; i < segments; i++) {
            const prev = radiusMultipliers[(i - 1 + segments) % segments];
            const curr = radiusMultipliers[i];
            const next = radiusMultipliers[(i + 1) % segments];
            
            // Weighted average for smoothing
            const smoothed = prev * smoothing * 0.5 + 
                           curr * (1 - smoothing) + 
                           next * smoothing * 0.5;
            smoothedMultipliers.push(smoothed);
        }
        
        // Apply one more pass of smoothing for even better results
        const finalMultipliers = [];
        for (let i = 0; i < segments; i++) {
            const prev = smoothedMultipliers[(i - 1 + segments) % segments];
            const curr = smoothedMultipliers[i];
            const next = smoothedMultipliers[(i + 1) % segments];
            
            const smoothed = prev * 0.25 + curr * 0.5 + next * 0.25;
            finalMultipliers.push(smoothed);
        }
        
        // Smooth altitude values
        const smoothedAltitudes = [];
        for (let i = 0; i < segments; i++) {
            const prev = altitudeValues[(i - 1 + segments) % segments];
            const curr = altitudeValues[i];
            const next = altitudeValues[(i + 1) % segments];
            
            const smoothed = prev * altitudeSmoothing * 0.5 + 
                           curr * (1 - altitudeSmoothing) + 
                           next * altitudeSmoothing * 0.5;
            smoothedAltitudes.push(smoothed);
        }
        
        // Apply second pass of altitude smoothing
        const finalAltitudes = [];
        for (let i = 0; i < segments; i++) {
            const prev = smoothedAltitudes[(i - 1 + segments) % segments];
            const curr = smoothedAltitudes[i];
            const next = smoothedAltitudes[(i + 1) % segments];
            
            const smoothed = prev * 0.25 + curr * 0.5 + next * 0.25;
            finalAltitudes.push(smoothed);
        }
        
        // Generate points with varied radius and altitude
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const radius = baseRadius * finalMultipliers[i];
            
            const x = Math.cos(angle) * radius;
            const y = finalAltitudes[i]; // Use smoothed altitude
            const z = Math.sin(angle) * radius;
            
            this.skeletonPoints.push(new THREE.Vector3(x, y, z));
        }
        
        // Create smooth curve from skeleton points for surface queries
        const curvePoints = [...this.skeletonPoints];
        curvePoints.push(this.skeletonPoints[0].clone()); // Close the loop
        this.trackCurve = new THREE.CatmullRomCurve3(curvePoints);
        this.trackCurve.closed = true;
        
        console.log(`Track skeleton generated with ${this.skeletonPoints.length} points (varied radius and altitude)`);
    }

    /**
     * Load a custom track from editor JSON data
     * Converts 2D editor coordinates to 3D track coordinates
     */
    _loadCustomTrack(customData) {
        console.log('Loading custom track from editor data');
        
        if (!customData.points || customData.points.length < 3) {
            console.error('Invalid custom track data - not enough points');
            this._generateSkeleton(); // Fallback to generated track
            return;
        }
        
        // Apply custom track settings if available
        if (customData.settings) {
            // Convert editor track width (pixels) to 3D track width
            // Editor width is in pixels (20-100), 3D width is in units (8-16)
            if (customData.settings.trackWidth) {
                this.trackWidth = 8 + (customData.settings.trackWidth - 20) / 80 * 8;
                this.trackWidth = Math.max(8, Math.min(16, this.trackWidth));
            }
        }
        
        // Convert 2D editor points to 3D track points
        // Editor uses X,Y in screen space, we need X,Z in world space with Y for altitude
        const editorPoints = customData.points;
        
        // Check if editor provided grid scale information
        let scale;
        if (customData.editor && customData.editor.gridSize && customData.editor.gridScale) {
            // Use the grid-based scale: gridScale units per gridSize pixels
            // For example: 10 units per 50 pixels = 0.2 units per pixel
            const unitsPerPixel = customData.editor.gridScale / customData.editor.gridSize;
            scale = unitsPerPixel;
            console.log(`Using grid-based scale: ${customData.editor.gridSize}px = ${customData.editor.gridScale} units (${unitsPerPixel} units/px)`);
        } else {
            // Fallback to old auto-scaling method
            // Find bounding box of editor points
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            for (const p of editorPoints) {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            }
            
            const scaleX = maxX - minX;
            const scaleY = maxY - minY;
            const maxScale = Math.max(scaleX, scaleY);
            
            // Target size for the track in 3D world (much larger to match generated tracks)
            const targetSize = 200; // Increased from 140 to make tracks much larger
            scale = targetSize / maxScale;
            console.log(`Using auto-scale: ${maxScale.toFixed(0)}px → ${targetSize} units (${scale.toFixed(3)} units/px)`);
        }
        
        // Find center of editor points for centering
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const p of editorPoints) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        console.log(`Track center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) in editor space`);
        
        // Convert points
        this.skeletonPoints = [];
        for (const p of editorPoints) {
            // Center and scale the points
            const x = (p.x - centerX) * scale;
            const z = (p.y - centerY) * scale; // Y in editor becomes Z in 3D
            const y = 0; // Start with flat track (can add altitude later)
            
            this.skeletonPoints.push(new THREE.Vector3(x, y, z));
        }
        
        // Create smooth curve from skeleton points
        const closedLoop = customData.settings?.closedLoop !== false; // Default to closed
        const curvePoints = [...this.skeletonPoints];
        
        if (closedLoop) {
            curvePoints.push(this.skeletonPoints[0].clone()); // Close the loop
        }
        
        this.trackCurve = new THREE.CatmullRomCurve3(curvePoints);
        this.trackCurve.closed = closedLoop;
        
        console.log(`Custom track loaded with ${this.skeletonPoints.length} points (${closedLoop ? 'closed' : 'open'} loop)`);
    }

    /**
     * Create track segments for overlapping track support
     * Each segment has its own curve and knows its neighbors
     */
    _createSegments() {
        const numPoints = this.skeletonPoints.length;
        const pointsPerSegment = 4; // Each segment spans 4 skeleton points for smooth curves
        const numSegments = Math.floor(numPoints / pointsPerSegment);
        
        this.segments = [];
        this.segmentCurves = [];
        
        for (let i = 0; i < numSegments; i++) {
            const startIdx = i * pointsPerSegment;
            const endIdx = ((i + 1) * pointsPerSegment) % numPoints;
            
            // Get points for this segment (include extra points for smooth Catmull-Rom)
            const segmentPoints = [];
            const startPoint = (startIdx - 1 + numPoints) % numPoints;
            const pointCount = pointsPerSegment + 2; // Include one before and one after
            
            for (let j = 0; j < pointCount; j++) {
                const idx = (startPoint + j) % numPoints;
                segmentPoints.push(this.skeletonPoints[idx].clone());
            }
            
            // Create curve for this segment
            const segmentCurve = new THREE.CatmullRomCurve3(segmentPoints);
            segmentCurve.closed = false;
            this.segmentCurves.push(segmentCurve);
            
            // Create segment metadata
            const segment = {
                id: i,
                startIdx: startIdx,
                endIdx: endIdx,
                curve: segmentCurve,
                // t range on the curve (exclude the extra endpoints)
                tStart: 1 / (pointCount - 1), // Skip first point
                tEnd: (pointCount - 2) / (pointCount - 1), // Skip last point
                // Neighbors (previous and next segments)
                prevSegment: (i - 1 + numSegments) % numSegments,
                nextSegment: (i + 1) % numSegments,
                // Bounding box for quick rejection (calculated below)
                bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 }
            };
            
            // Calculate bounding box for this segment
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            for (let t = segment.tStart; t <= segment.tEnd; t += 0.1) {
                const point = segmentCurve.getPoint(t);
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minZ = Math.min(minZ, point.z);
                maxZ = Math.max(maxZ, point.z);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
            
            // Add padding to bounds
            const padding = this.trackWidth;
            segment.bounds = {
                minX: minX - padding, maxX: maxX + padding,
                minZ: minZ - padding, maxZ: maxZ + padding,
                minY: minY - padding, maxY: maxY + padding
            };
            
            this.segments.push(segment);
        }
        
        console.log(`Track divided into ${this.segments.length} segments`);
    }

    /**
     * Build the 3D track geometry from the skeleton points
     * Creates a path with width following the skeleton
     */
    _buildTrack() {
        if (this.skeletonPoints.length < 2) {
            console.error('Not enough skeleton points to build track');
            return;
        }

        // For now, create a simple tube-like track using THREE.TubeGeometry
        // First, create a curve from our skeleton points
        const curvePoints = [...this.skeletonPoints];
        // Close the loop by adding the first point at the end
        curvePoints.push(this.skeletonPoints[0].clone());
        
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;
        
        // Create tube geometry along the curve
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            this.skeletonPoints.length, // tubular segments
            this.trackWidth / 2, // radius (half width for circular cross-section)
            8, // radial segments
            true // closed
        );
        
        // Create a flattened version for the actual track surface
        // We'll use a custom approach to create a flat ribbon
        const trackGeometry = this._createFlatRibbon(curve);
        
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        
        this.trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        this.scene.add(this.trackMesh);
        
        console.log('Track geometry created');
    }

    /**
     * Create a flat ribbon geometry following the curve
     * This gives us a proper flat racing surface
     */
    _createFlatRibbon(curve) {
        const segments = this.skeletonPoints.length;
        const halfWidth = this.trackWidth / 2;
        
        const vertices = [];
        const indices = [];
        const uvs = [];
        
        // Generate vertices along the curve
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            // Calculate perpendicular vector (for width)
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Create left and right edge points
            const leftPoint = point.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
            const rightPoint = point.clone().add(perpendicular.clone().multiplyScalar(-halfWidth));
            
            vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);
            vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);
            
            // UV coordinates
            uvs.push(0, t);
            uvs.push(1, t);
            
            // Create triangles (except for the last iteration)
            if (i < segments) {
                const baseIndex = i * 2;
                // First triangle
                indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
                // Second triangle
                indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Build walls along the inner and outer edges of the track
     */
    _buildWalls() {
        if (this.skeletonPoints.length < 2) {
            console.error('Not enough skeleton points to build walls');
            return;
        }

        const halfWidth = this.trackWidth / 2;
        const wallThickness = 0.3;
        
        // Create curve from skeleton
        const curvePoints = [...this.skeletonPoints];
        curvePoints.push(this.skeletonPoints[0].clone());
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;

        // Build inner wall
        this.innerWall = this._createWall(curve, halfWidth, wallThickness, true);
        this.scene.add(this.innerWall);

        // Build outer wall
        this.outerWall = this._createWall(curve, halfWidth, wallThickness, false);
        this.scene.add(this.outerWall);

        console.log('Track walls created');
    }

    /**
     * Create a single wall (inner or outer)
     */
    _createWall(curve, halfWidth, wallThickness, isInner) {
        const segments = this.skeletonPoints.length;
        const vertices = [];
        const indices = [];
        const uvs = [];
        
        // Determine wall offset direction
        const offsetDistance = isInner ? -(halfWidth + wallThickness/2) : (halfWidth + wallThickness/2);
        
        // Generate wall vertices
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            // Calculate perpendicular vector (for width)
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Calculate wall position
            const wallCenter = point.clone().add(perpendicular.clone().multiplyScalar(offsetDistance));
            
            // Create inner and outer edge of the wall
            const innerEdge = wallCenter.clone().add(perpendicular.clone().multiplyScalar(-wallThickness/2));
            const outerEdge = wallCenter.clone().add(perpendicular.clone().multiplyScalar(wallThickness/2));
            
            // Bottom vertices
            vertices.push(innerEdge.x, innerEdge.y, innerEdge.z);
            vertices.push(outerEdge.x, outerEdge.y, outerEdge.z);
            
            // Top vertices
            vertices.push(innerEdge.x, innerEdge.y + this.wallHeight, innerEdge.z);
            vertices.push(outerEdge.x, outerEdge.y + this.wallHeight, outerEdge.z);
            
            // UV coordinates
            const uCoord = t;
            uvs.push(0, 0);
            uvs.push(1, 0);
            uvs.push(0, 1);
            uvs.push(1, 1);
            
            // Create triangles for the wall faces
            if (i < segments) {
                const baseIndex = i * 4;
                
                // Inner face (facing track)
                indices.push(baseIndex, baseIndex + 2, baseIndex + 4);
                indices.push(baseIndex + 2, baseIndex + 6, baseIndex + 4);
                
                // Outer face
                indices.push(baseIndex + 1, baseIndex + 5, baseIndex + 3);
                indices.push(baseIndex + 3, baseIndex + 5, baseIndex + 7);
                
                // Top face
                indices.push(baseIndex + 2, baseIndex + 3, baseIndex + 6);
                indices.push(baseIndex + 3, baseIndex + 7, baseIndex + 6);
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        // Wall material - red with some glow
        const material = new THREE.MeshStandardMaterial({
            color: 0xcc0000,
            roughness: 0.6,
            metalness: 0.3,
            emissive: 0x660000,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide
        });
        
        return new THREE.Mesh(geometry, material);
    }

    /**
     * Create invisible checkpoints along the track for lap validation
     */
    _createCheckpoints() {
        this.checkpoints = [];
        
        if (this.skeletonPoints.length < 2) {
            return;
        }

        // Create evenly spaced checkpoints around the track (excluding start/finish)
        for (let i = 0; i < this.numCheckpoints; i++) {
            // Space checkpoints evenly, starting after the finish line
            const index = Math.floor((i + 1) * this.skeletonPoints.length / (this.numCheckpoints + 1));
            const nextIndex = (index + 1) % this.skeletonPoints.length;
            
            const point = this.skeletonPoints[index];
            const nextPoint = this.skeletonPoints[nextIndex];
            
            // Calculate perpendicular vector for checkpoint width
            const tangent = new THREE.Vector3().subVectors(nextPoint, point).normalize();
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            const halfWidth = this.trackWidth / 2;
            
            this.checkpoints.push({
                id: i,
                position: point.clone(),
                leftEdge: point.clone().add(perpendicular.clone().multiplyScalar(halfWidth)),
                rightEdge: point.clone().add(perpendicular.clone().multiplyScalar(-halfWidth)),
                direction: tangent.clone(),
                perpendicular: perpendicular.clone()
            });
        }
        
        console.log(`Created ${this.checkpoints.length} checkpoints`);
    }

    /**
     * Create visual finish line at the track start
     */
    _createFinishLine() {
        if (this.skeletonPoints.length < 2) {
            return;
        }

        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1];
        
        // Calculate perpendicular vector
        const tangent = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();
        const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        const halfWidth = this.trackWidth / 2;
        
        // Create checkered pattern finish line
        const lineGeometry = new THREE.PlaneGeometry(this.trackWidth, 1);
        
        // Create a canvas texture for checkered pattern
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw checkered pattern (black and white squares)
        const squareSize = 64;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 1; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000';
                ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const lineMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        
        this.finishLineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
        
        // Position the finish line
        this.finishLineMesh.position.copy(startPoint);
        this.finishLineMesh.position.y += 0.05; // Slightly above ground
        
        // Rotate to lay flat on the ground and align with track direction
        this.finishLineMesh.rotation.x = -Math.PI / 2; // Lay flat
        this.finishLineMesh.rotation.z = Math.atan2(tangent.x, tangent.z); // Align with track
        
        this.scene.add(this.finishLineMesh);
        
        console.log('Finish line created');
    }

    /**
     * Check if a position crosses a checkpoint
     * Returns checkpoint info if crossed, null otherwise
     */
    checkCheckpoint(oldPos, newPos, checkpointId) {
        if (checkpointId >= this.checkpoints.length) {
            return null;
        }
        
        const checkpoint = this.checkpoints[checkpointId];
        
        // Check if the line from oldPos to newPos crosses the checkpoint line
        // using 2D line intersection (ignoring Y)
        const crossed = this._linesCross2D(
            oldPos, newPos,
            checkpoint.leftEdge, checkpoint.rightEdge
        );
        
        return crossed ? checkpoint : null;
    }

    /**
     * Check if a position crosses the finish line
     */
    checkFinishLine(oldPos, newPos) {
        if (this.skeletonPoints.length < 2) {
            return false;
        }
        
        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1];
        
        const tangent = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();
        const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const halfWidth = this.trackWidth / 2;
        
        const leftEdge = startPoint.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
        const rightEdge = startPoint.clone().add(perpendicular.clone().multiplyScalar(-halfWidth));
        
        return this._linesCross2D(oldPos, newPos, leftEdge, rightEdge);
    }

    /**
     * Check if two 2D line segments intersect (helper function)
     */
    _linesCross2D(a1, a2, b1, b2) {
        // Using 2D coordinates only (x, z)
        const x1 = a1.x, z1 = a1.z;
        const x2 = a2.x, z2 = a2.z;
        const x3 = b1.x, z3 = b1.z;
        const x4 = b2.x, z4 = b2.z;
        
        const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
        
        if (Math.abs(denom) < 0.0001) {
            return false; // Parallel or coincident
        }
        
        const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / denom;
        
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    /**
     * Get the starting position and rotation for spawning players
     * Returns the first point on the track
     */
    getStartPosition() {
        if (this.skeletonPoints.length === 0) {
            return { x: 0, y: 0.2, z: 0, rotY: 0 };
        }
        
        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1] || startPoint;
        
        // Calculate rotation to face along the track
        const direction = new THREE.Vector3()
            .subVectors(nextPoint, startPoint)
            .normalize();
        const rotY = Math.atan2(direction.x, direction.z);
        
        return {
            x: startPoint.x,
            y: 0.2,
            z: startPoint.z,
            rotY: rotY
        };
    }

    /**
     * Get a spawn position offset from the start
     * Useful for multiple players at the starting line
     */
    getStartPositionOffset(lateralOffset = 0, longitudinalOffset = 0) {
        if (this.skeletonPoints.length < 2) {
            return this.getStartPosition();
        }
        
        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1];
        
        // Calculate forward direction
        const forward = new THREE.Vector3()
            .subVectors(nextPoint, startPoint)
            .normalize();
        
        // Calculate perpendicular (lateral) direction
        const lateral = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
        
        // Calculate position with offsets
        const position = startPoint.clone()
            .add(lateral.multiplyScalar(lateralOffset))
            .add(forward.multiplyScalar(longitudinalOffset));
        
        const rotY = Math.atan2(forward.x, forward.z);
        
        return {
            x: position.x,
            y: 0.2,
            z: position.z,
            rotY: rotY
        };
    }

    /**
     * Check if a position is outside the track boundaries
     * Returns an object with collision info if outside, null if inside
     */
    checkWallCollision(position) {
        if (this.skeletonPoints.length < 2) {
            return null;
        }

        // Find the closest point on the track skeleton
        let closestDistance = Infinity;
        let closestSegmentIndex = 0;
        let closestT = 0;

        // Check each segment of the track
        for (let i = 0; i < this.skeletonPoints.length; i++) {
            const p1 = this.skeletonPoints[i];
            const p2 = this.skeletonPoints[(i + 1) % this.skeletonPoints.length];
            
            // Project point onto line segment
            const lineVec = new THREE.Vector3().subVectors(p2, p1);
            const pointVec = new THREE.Vector3().subVectors(position, p1);
            
            const lineLength = lineVec.length();
            if (lineLength === 0) continue;
            
            const t = Math.max(0, Math.min(1, pointVec.dot(lineVec) / (lineLength * lineLength)));
            const projection = p1.clone().add(lineVec.multiplyScalar(t));
            
            const distance = new THREE.Vector2(
                position.x - projection.x,
                position.z - projection.z
            ).length();
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSegmentIndex = i;
                closestT = t;
            }
        }

        // Calculate the closest point on the track centerline
        const p1 = this.skeletonPoints[closestSegmentIndex];
        const p2 = this.skeletonPoints[(closestSegmentIndex + 1) % this.skeletonPoints.length];
        const lineVec = new THREE.Vector3().subVectors(p2, p1);
        const closestPoint = p1.clone().add(lineVec.multiplyScalar(closestT));

        // Calculate distance from track center
        const halfWidth = this.trackWidth / 2;
        const carRadius = 1.0; // Approximate car size
        const maxDistance = halfWidth - carRadius; // More aggressive boundary check

        if (closestDistance > maxDistance) {
            // Outside track boundaries
            // Calculate correction vector (push toward track center)
            const toCenter = new THREE.Vector3()
                .subVectors(closestPoint, position);
            toCenter.y = 0; // Keep on same y level
            toCenter.normalize();

            return {
                isColliding: true,
                correctionVector: toCenter,
                penetrationDepth: closestDistance - maxDistance,
                closestPoint: closestPoint
            };
        }

        return null; // Inside track
    }

    /**
     * Get the track normal (perpendicular direction) at a given position
     * Useful for calculating bounce direction
     */
    getTrackNormalAt(position) {
        if (this.skeletonPoints.length < 2) {
            return new THREE.Vector3(0, 0, 1);
        }

        // Find closest segment
        let closestDistance = Infinity;
        let closestSegmentIndex = 0;

        for (let i = 0; i < this.skeletonPoints.length; i++) {
            const p = this.skeletonPoints[i];
            const dist = new THREE.Vector2(
                position.x - p.x,
                position.z - p.z
            ).length();
            
            if (dist < closestDistance) {
                closestDistance = dist;
                closestSegmentIndex = i;
            }
        }

        // Get tangent of the track at this point
        const p1 = this.skeletonPoints[closestSegmentIndex];
        const p2 = this.skeletonPoints[(closestSegmentIndex + 1) % this.skeletonPoints.length];
        const tangent = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        // Normal is perpendicular to tangent
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        return normal;
    }

    /**
     * Get track altitude and pitch at a given position
     * Uses segment-based approach to support overlapping tracks
     * @param {THREE.Vector3} position - Position to query
     * @param {number} currentSegmentId - The segment the car is currently on (null to search all)
     * @returns {Object} { altitude: number, pitch: number, roll: number, segmentId: number, t: number }
     */
    getTrackSurfaceAt(position, currentSegmentId = null) {
        if (!this.trackCurve || this.segments.length === 0) {
            return { altitude: 0, pitch: 0, roll: 0, segmentId: 0, t: 0 };
        }

        // Determine which segments to search
        let segmentsToSearch = [];
        
        if (currentSegmentId !== null && currentSegmentId >= 0 && currentSegmentId < this.segments.length) {
            // Search current segment and neighbors
            const current = this.segments[currentSegmentId];
            segmentsToSearch = [
                currentSegmentId,
                current.prevSegment,
                current.nextSegment
            ];
        } else {
            // Search all segments (initial placement or car lost track)
            // First, do a quick bounding box check to reduce search space
            for (let i = 0; i < this.segments.length; i++) {
                const bounds = this.segments[i].bounds;
                if (position.x >= bounds.minX && position.x <= bounds.maxX &&
                    position.z >= bounds.minZ && position.z <= bounds.maxZ) {
                    segmentsToSearch.push(i);
                }
            }
            
            // If no segments match bounds (shouldn't happen), search all
            if (segmentsToSearch.length === 0) {
                segmentsToSearch = Array.from({ length: this.segments.length }, (_, i) => i);
            }
        }

        // Find the best matching segment and position
        let bestSegmentId = currentSegmentId !== null ? currentSegmentId : 0;
        let bestT = 0;
        let bestDist = Infinity;
        
        for (const segmentId of segmentsToSearch) {
            const segment = this.segments[segmentId];
            const curve = segment.curve;
            
            // Sample points along this segment
            const samples = 20;
            const tRange = segment.tEnd - segment.tStart;
            
            for (let i = 0; i <= samples; i++) {
                const t = segment.tStart + (tRange * i / samples);
                const point = curve.getPoint(t);
                
                // Calculate 2D distance (ignore Y to support overlaps)
                const dist = Math.sqrt(
                    (position.x - point.x) ** 2 +
                    (position.z - point.z) ** 2
                );
                
                if (dist < bestDist) {
                    bestDist = dist;
                    bestT = t;
                    bestSegmentId = segmentId;
                }
            }
        }
        
        // Refine the best position with a fine search
        const segment = this.segments[bestSegmentId];
        const curve = segment.curve;
        const fineRange = 0.05;
        const fineSamples = 10;
        
        const fineStart = Math.max(segment.tStart, bestT - fineRange);
        const fineEnd = Math.min(segment.tEnd, bestT + fineRange);
        
        for (let i = 0; i <= fineSamples; i++) {
            const t = fineStart + (fineEnd - fineStart) * (i / fineSamples);
            const point = curve.getPoint(t);
            
            const dist = Math.sqrt(
                (position.x - point.x) ** 2 +
                (position.z - point.z) ** 2
            );
            
            if (dist < bestDist) {
                bestDist = dist;
                bestT = t;
            }
        }
        
        // Get the final surface information
        const curvePoint = curve.getPoint(bestT);
        const altitude = curvePoint.y;
        
        // Get tangent for pitch calculation
        const tangent = curve.getTangent(bestT);
        const horizontalLength = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
        const pitch = Math.atan2(tangent.y, horizontalLength);
        
        // Calculate roll from curvature
        const tBefore = Math.max(segment.tStart, bestT - 0.01);
        const tAfter = Math.min(segment.tEnd, bestT + 0.01);
        
        const pointBefore = curve.getPoint(tBefore);
        const pointAfter = curve.getPoint(tAfter);
        
        const dirBefore = new THREE.Vector2(
            curvePoint.x - pointBefore.x,
            curvePoint.z - pointBefore.z
        ).normalize();
        
        const dirAfter = new THREE.Vector2(
            pointAfter.x - curvePoint.x,
            pointAfter.z - curvePoint.z
        ).normalize();
        
        const angleBefore = Math.atan2(dirBefore.y, dirBefore.x);
        const angleAfter = Math.atan2(dirAfter.y, dirAfter.x);
        let angleDiff = angleAfter - angleBefore;
        
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const maxRoll = 0.15;
        const curvatureScale = 15;
        const roll = -angleDiff * curvatureScale;
        
        return { 
            altitude, 
            pitch, 
            roll: THREE.MathUtils.clamp(roll, -maxRoll, maxRoll),
            segmentId: bestSegmentId,
            t: bestT
        };
    }

    /**
     * Cleanup - remove track from scene
     */
    destroy() {
        if (this.trackMesh) {
            this.scene.remove(this.trackMesh);
            this.trackMesh.geometry.dispose();
            this.trackMesh.material.dispose();
        }
        if (this.innerWall) {
            this.scene.remove(this.innerWall);
            this.innerWall.geometry.dispose();
            this.innerWall.material.dispose();
        }
        if (this.outerWall) {
            this.scene.remove(this.outerWall);
            this.outerWall.geometry.dispose();
            this.outerWall.material.dispose();
        }
        if (this.finishLineMesh) {
            this.scene.remove(this.finishLineMesh);
            this.finishLineMesh.geometry.dispose();
            this.finishLineMesh.material.dispose();
        }
    }
}
