import * as THREE from 'three';
import { SceneManager } from './core/Scene.js';
import { RendererManager } from './core/Renderer.js';
import { CameraManager } from './core/Camera.js';
import { Car } from './game/Car.js';
import { GameState } from './game/GameState.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { NetworkClient } from './network/NetworkClient.js';
import { UIManager } from './ui/UIManager.js';
import { SoundManager } from './audio/SoundManager.js';

/**
 * Game - Main game coordinator
 */
export class Game {
    constructor() {
        // Core systems
        this.sceneManager = new SceneManager();
        this.renderer = new RendererManager();
        this.camera = new CameraManager(this.renderer.getRenderer());
        
        // Game state
        this.gameState = new GameState();
        
        // Set track reference in game state for spawning
        this.gameState.setTrack(this.sceneManager.getTrack());
        
        // Systems
        this.particles = new ParticleSystem(this.sceneManager.getScene());
        this.network = new NetworkClient(this.gameState);
        this.ui = new UIManager(this.gameState);
        this.sound = new SoundManager();
        
        // Players
        this.localCar = null;
        this.remotePlayers = new Map();
        this.carModelTemplate = null;
        
        // Timing
        this.prevTime = performance.now();
        
        // Sound state tracking
        this.soundStarted = false;
        
        this._setupNetworkHandlers();
    }

    /**
     * Initialize and start the game
     */
    async init() {
        // Initialize sound system
        await this.sound.init(this.camera.getCamera());
        
        // Set up track change callback for UI
        this.sound.setTrackChangeCallback((trackName) => {
            this.ui.showNowPlaying(trackName);
        });
        
        // Initialize minimap with track data
        const track = this.sceneManager.getTrack();
        if (track && track.skeletonPoints) {
            this.ui.initMinimap(track.skeletonPoints);
        }
        
        // Setup track import functionality
        this.ui.setupTrackImport((trackData) => {
            this.loadCustomTrack(trackData);
        });
        
        // Create local car
        this.localCar = new Car(this.sceneManager.getScene(), true);
        
        // Load car model
        try {
            const template = await this.localCar.loadModel();
            this.carModelTemplate = template;
            
            // Spawn local car
            const spawn = this.gameState.getRandomSpawnPosition();
            this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
            
            console.log('Car model loaded');
        } catch (err) {
            console.error('Failed to load car model:', err);
        }
        
        // Connect to multiplayer
        try {
            await this.network.connect();
            this.network.startStateUpdates(this.localCar);
        } catch (err) {
            console.warn('Running in offline mode');
        }
        
        // Start game loop
        this.animate();
    }

    /**
     * Setup network message handlers
     */
    _setupNetworkHandlers() {
        // Handle welcome message (already handled in NetworkClient)
        this.network.on('welcome', (msg) => {
            if (this.gameState.isHost) {
                this.ui.showHostControls(
                    () => this._onStartGame(),
                    () => this._onResetGame()
                );
            }
            
            if (!this.gameState.canPlay) {
                this.camera.enterSpectatorMode();
                this.ui.showSpectatorMode('Partie en cours, vous rejoindrez la prochaine');
            }
        });
        
        // Handle player state updates
        this.network.on('state', (msg) => this._handlePlayerState(msg));
        
        // Handle disconnections
        this.network.on('disconnect', (msg) => this._handleDisconnect(msg));
        
        // Handle collision push
        this.network.on('collision_push', (msg) => this._handleCollisionPush(msg));
        
        // Handle host transfer
        this.network.on('you_are_host', () => {
            this.gameState.setHost(true);
            console.log('You are now the host!');
            this.ui.showHostControls(
                () => this._onStartGame(),
                () => this._onResetGame()
            );
        });
        
        // Handle game restart
        this.network.on('game_restart', (msg) => this._handleGameRestart(msg));
        
        // Handle game over
        this.network.on('game_over', (msg) => this._handleGameOver(msg));
    }

    /**
     * Handle remote player state update
     */
    _handlePlayerState(msg) {
        const id = msg.sender;
        if (id === this.gameState.localId) return;
        
        let player = this.remotePlayers.get(id);
        
        if (!player) {
            // Create new remote player
            player = new Car(this.sceneManager.getScene(), false);
            
            if (this.carModelTemplate) {
                player.mesh = this.carModelTemplate.clone(true);
                player.mesh.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color = player.color.clone();
                    }
                });
                player.mesh.scale.set(0.8, 0.8, 0.8);
                this.sceneManager.add(player.mesh);
            } else {
                // Placeholder
                player.mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1.6, 0.8, 3.2),
                    new THREE.MeshStandardMaterial({ color: player.color })
                );
                this.sceneManager.add(player.mesh);
            }
            
            player.setTarget(msg.x, msg.y, msg.z, msg.rotY, msg.vx, msg.vz, msg.segmentId, msg.segmentT);
            this.remotePlayers.set(id, player);
            
            console.log('Created remote player:', id);
        } else {
            // Update existing player
            player.setTarget(msg.x, msg.y, msg.z, msg.rotY, msg.vx, msg.vz, msg.segmentId, msg.segmentT);
            if (msg.lives !== undefined) {
                player.lives = msg.lives;
                player.isDead = msg.lives <= 0;
            }
            if (msg.lap !== undefined) {
                player.currentLap = msg.lap;
            }
        }
    }

    /**
     * Handle player disconnect
     */
    _handleDisconnect(msg) {
        const player = this.remotePlayers.get(msg.id);
        if (player) {
            player.destroy();
            this.remotePlayers.delete(msg.id);
        }
    }

    /**
     * Handle collision push from server
     */
    _handleCollisionPush(msg) {
        if (msg.target === this.gameState.localId && this.localCar.mesh && !this.localCar.isDead) {
            const pushForce = new THREE.Vector3(msg.forceX || 0, msg.forceY || 0, msg.forceZ || 0);
            this.localCar.mesh.position.add(pushForce);
            this.localCar.speed *= 0.5;
            
            // Apply camera tilt when receiving collision push from server
            const pushDirection = pushForce.clone().normalize();
            const pushIntensity = Math.min(pushForce.length() * 0.2, 1.0);
            this.camera.applyImpactTilt(pushDirection, pushIntensity);
        }
    }

    /**
     * Handle game restart
     */
    _handleGameRestart(msg) {
        console.log('Game restarting!');
        
        // Regenerate track with new layout
        this.sceneManager.regenerateTrack();
        
        // Update game state with new track
        this.gameState.setTrack(this.sceneManager.getTrack());
        
        // Reinitialize minimap with new track
        const track = this.sceneManager.getTrack();
        if (track && track.skeletonPoints) {
            this.ui.initMinimap(track.skeletonPoints);
        }
        
        this.gameState.reset();
        this.gameState.setCanPlay(true);
        
        // Reset local car
        const spawn = this.gameState.getRandomSpawnPosition();
        this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
        
        // Reset remote players
        this.remotePlayers.forEach((player) => {
            player.lives = 3;
            player.isDead = false;
            player.resetLapProgress();
        });
        
        // Re-enable camera follow
        this.camera.enableFollow();
        
        // Clear UI
        this.ui.clearMessages();
        this.ui.updateHostControls(
            () => this._onStartGame(),
            () => this._onResetGame()
        );
    }

    /**
     * Handle game over
     */
    _handleGameOver(msg) {
        console.log('Game Over! Winner:', msg.winnerId);
        this.gameState.setWinner(msg.winnerId);
        
        if (msg.winnerId === null) {
            this.ui.showDraw();
        } else if (msg.winnerId === this.gameState.localId) {
            this.ui.showVictory();
        } else {
            this.ui.showDefeat(msg.winnerId);
        }
        
        this.ui.updateHostControls(
            () => this._onStartGame(),
            () => this._onResetGame()
        );
    }

    /**
     * Start game button handler
     */
    _onStartGame() {
        this.network.startGame();
    }

    /**
     * Reset game button handler
     */
    _onResetGame() {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser la partie ?')) {
            this.network.startGame();
        }
    }

    /**
     * Check collisions between local car and remote players
     */
    _checkCollisions(dt) {
        if (!this.localCar.mesh || this.localCar.isDead) return;
        
        if (this.localCar.collisionCooldown > 0) {
            this.localCar.collisionCooldown -= dt;
        }
        
        this.remotePlayers.forEach((player, id) => {
            if (!player.mesh || player.isDead) return;
            
            const collisionDistance = (this.localCar.collisionRadius + player.collisionRadius) * 1.3;
            const dist = this.localCar.mesh.position.distanceTo(player.mesh.position);
            
            if (dist < collisionDistance && this.localCar.collisionCooldown <= 0) {
                // Collision detected
                const collisionVector = new THREE.Vector3()
                    .subVectors(player.mesh.position, this.localCar.mesh.position)
                    .normalize();
                
                // Reduced collision forces for racetrack gameplay
                const impactForce = Math.abs(this.localCar.speed) * 0.015; // Reduced from 0.035
                const restitution = 0.6; // Reduced from 1.2
                const separationForce = 1.0; // Reduced from 2.5
                
                // Send collision to server
                this.network.sendCollisionPush(
                    id,
                    collisionVector.x * (impactForce * restitution + separationForce),
                    0,
                    collisionVector.z * (impactForce * restitution + separationForce)
                );
                
                // Reduce local car speed (less aggressive)
                this.localCar.speed *= 0.92; // Changed from 0.85
                
                // Play impact sound based on collision intensity
                const speedRatio = Math.abs(this.localCar.speed) / this.localCar.maxSpeed;
                this.sound.playImpact(speedRatio);
                
                // Apply camera tilt based on collision direction
                const impactIntensity = Math.min(speedRatio, 1.0);
                this.camera.applyImpactTilt(collisionVector, impactIntensity);
                
                // Emit explosion particles
                const impactPoint = new THREE.Vector3()
                    .addVectors(this.localCar.mesh.position, player.mesh.position)
                    .multiplyScalar(0.5);
                this.particles.emitExplosion(impactPoint);
                
                this.localCar.collisionCooldown = this.localCar.collisionCooldownTime;
            }
        });
    }

    /**
     * Check if car fell off platform
     * TEMPORARILY DISABLED for racetrack implementation
     */
    _checkFallOff() {
        // Disabled for now - will be reimplemented with track boundaries later
        /* 
        if (!this.localCar.mesh || this.localCar.isDead) return;
        
        const pos = this.localCar.mesh.position;
        if (this.gameState.isOutOfBounds(pos.x, pos.y, pos.z)) {
            console.log('Fell off platform! Lives remaining:', this.localCar.lives - 1);
            
            this.localCar.loseLife();
            this.network.notifyLivesChange(this.localCar.lives);
            this.ui.showLifeLost(this.localCar.lives);
            this.camera.shake();
            
            if (this.localCar.lives > 0) {
                // Respawn
                const spawn = this.gameState.getRandomSpawnPosition();
                this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
            } else {
                // Dead - enter spectator mode
                this.localCar.isDead = true;
                this.camera.enterSpectatorMode();
                this.ui.showSpectatorMode();
                this.network.notifyFall();
            }
        }
        */
    }

    /**
     * Check collisions with track walls
     */
    _checkWallCollisions() {
        if (!this.localCar.mesh || this.localCar.isDead) return;
        
        const track = this.sceneManager.getTrack();
        if (!track) return;

        const collision = track.checkWallCollision(this.localCar.mesh.position);
        
        if (collision) {
            // More aggressive push to prevent clipping
            const pushStrength = Math.min(collision.penetrationDepth * 1.5, 1.0);
            this.localCar.mesh.position.add(
                collision.correctionVector.multiplyScalar(pushStrength)
            );
            
            // Calculate impact intensity for sound
            const speedBeforeImpact = Math.abs(this.localCar.speed);
            
            // Reduce speed by 30%
            this.localCar.speed *= 0.7;
            
            // Play impact sound if speed is significant
            if (speedBeforeImpact > 10) {
                const speedRatio = speedBeforeImpact / this.localCar.maxSpeed;
                this.sound.playImpact(speedRatio);
            }
            
            // Turn the car away from the wall
            // Calculate the direction we want the car to face (along the correction vector)
            const desiredDirection = collision.correctionVector.clone();
            const currentRotation = this.localCar.mesh.rotation.y;
            const targetRotation = Math.atan2(desiredDirection.x, desiredDirection.z);
            
            // Calculate shortest rotation difference
            let rotationDiff = targetRotation - currentRotation;
            // Normalize to -PI to PI range
            while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
            while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
            
            // Apply stronger rotation toward the correction direction
            const turnStrength = 0.2; // Increased from 0.15 for more aggressive turning
            this.localCar.mesh.rotation.y += rotationDiff * turnStrength;
            
            // Emit particles on harder impacts
            if (Math.abs(this.localCar.speed) > 10) {
                this.particles.emitExplosion(this.localCar.mesh.position.clone());
            }
        }
    }

    /**
     * Check if car passes through checkpoints and finish line
     */
    _checkCheckpoints() {
        if (!this.localCar.mesh || this.localCar.isDead) return;
        
        const track = this.sceneManager.getTrack();
        if (!track) return;

        const currentPos = this.localCar.mesh.position.clone();
        const lastPos = this.localCar.lastPosition;
        
        // Check each checkpoint
        for (let i = 0; i < track.checkpoints.length; i++) {
            if (!this.localCar.checkpointsCleared.has(i)) {
                const checkpoint = track.checkCheckpoint(lastPos, currentPos, i);
                if (checkpoint) {
                    this.localCar.passCheckpoint(i);
                    console.log(`Checkpoint ${i + 1}/${track.checkpoints.length} passed`);
                    
                    // Send checkpoint update to server
                    this.network.sendMessage({
                        type: 'checkpoint',
                        checkpointId: i
                    });
                }
            }
        }
        
        // Check finish line (only if all checkpoints are cleared)
        if (this.localCar.allCheckpointsCleared()) {
            const crossedFinish = track.checkFinishLine(lastPos, currentPos);
            if (crossedFinish) {
                const lapCompleted = this.localCar.completeLap();
                if (lapCompleted) {
                    console.log(`🏁 Lap ${this.localCar.currentLap} completed!`);
                    
                    // Send lap completion to server
                    this.network.sendMessage({
                        type: 'lap_complete',
                        lap: this.localCar.currentLap
                    });
                    
                    // Show UI feedback
                    this.ui.showLapComplete(this.localCar.currentLap);
                }
            }
        }
        
        // Update last position for next frame
        this.localCar.lastPosition.copy(currentPos);
    }

    /**
     * Update leaderboard with all players' lap data
     */
    _updateLeaderboard() {
        const players = [];
        
        // Add local player
        if (this.localCar) {
            players.push({
                id: this.gameState.localId,
                name: 'You',
                laps: this.localCar.currentLap,
                isLocal: true
            });
        }
        
        // Add remote players
        this.remotePlayers.forEach((player, id) => {
            players.push({
                id: id,
                name: null,
                laps: player.currentLap || 0,
                isLocal: false
            });
        });
        
        this.ui.updateLeaderboard(players);
    }

    /**
     * Update minimap with all players' positions
     */
    _updateMinimap() {
        const players = [];
        
        // Add local player
        if (this.localCar && this.localCar.mesh) {
            players.push({
                position: {
                    x: this.localCar.mesh.position.x,
                    z: this.localCar.mesh.position.z
                },
                rotation: this.localCar.mesh.rotation.y,
                color: '#' + this.localCar.color.getHexString(),
                isLocal: true
            });
        }
        
        // Add remote players
        this.remotePlayers.forEach((player, id) => {
            if (player.mesh) {
                players.push({
                    position: {
                        x: player.mesh.position.x,
                        z: player.mesh.position.z
                    },
                    rotation: player.mesh.rotation.y,
                    color: '#' + player.color.getHexString(),
                    isLocal: false
                });
            }
        });
        
        this.ui.updateMinimap(players);
    }

    /**
     * Emit particles based on car actions
     */
    _emitCarParticles(actions) {
        if (!actions || !this.localCar.mesh) return;
        
        // Brake particles
        if (actions.forward > 0) { // S key
            const lights = this.localCar.getBrakeLightPositions();
            if (lights) {
                this.particles.emitBrake(lights.left, 6);
                this.particles.emitBrake(lights.right, 6);
            }
        }
        
        // Boost particles
        if (actions.boosting) {
            const boosts = this.localCar.getBoostPositions();
            if (boosts) {
                this.particles.emitBoost(boosts.left, 4);
                this.particles.emitBoost(boosts.right, 4);
            }
        }
        
        // Skid particles
        if (actions.skidding) {
            const skids = this.localCar.getSkidPositions();
            if (skids) {
                this.particles.emitSkid(skids.left, actions.turn !== 0 ? 2 : 1);
                this.particles.emitSkid(skids.right, actions.turn !== 0 ? 2 : 1);
            }
        }
    }

    /**
     * Main game loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = performance.now();
        const dt = Math.max(0, (now - this.prevTime) / 1000);
        this.prevTime = now;
        
        // Update remote players (interpolation)
        this.remotePlayers.forEach((player) => {
            player.interpolate(dt);
        });
        
        // Check collisions
        this._checkCollisions(dt);
        
        // Check wall collisions
        this._checkWallCollisions();
        
        // Check checkpoints and finish line
        this._checkCheckpoints();
        
        // Check if fell off platform
        this._checkFallOff();
        
        // Update local car physics
        const canMove = !this.localCar.isDead && 
                       this.gameState.isGameActive && 
                       this.gameState.canPlay;
        const actions = this.localCar.updatePhysics(dt, canMove);
        
        // Update car to follow track surface
        if (canMove) {
            const track = this.sceneManager.getTrack();
            this.localCar.followTrackSurface(track);
        }
        
        // Update remote players to follow track surface
        this.remotePlayers.forEach((player) => {
            if (!player.isDead) {
                const track = this.sceneManager.getTrack();
                player.followTrackSurface(track);
            }
        });
        
        // Start sound when game becomes active
        if (this.gameState.isGameActive && !this.soundStarted) {
            this.sound.start();
            this.soundStarted = true;
        } else if (!this.gameState.isGameActive && this.soundStarted) {
            this.sound.stop();
            this.soundStarted = false;
        }
        
        // Update sound system
        if (canMove) {
            const isAccelerating = actions && (actions.forward < 0 || actions.boosting);
            const isBoosting = actions && actions.boosting;
            const isSkidding = actions && actions.skidding;
            this.sound.update(
                this.localCar.speed, 
                this.localCar.maxSpeed, 
                isAccelerating,
                isBoosting,
                isSkidding,
                dt
            );
        }
        
        // Emit particles based on car actions
        if (canMove) {
            this._emitCarParticles(actions);
        }
        
        // Update particles
        this.particles.update(dt);
        
        // Update camera
        if (!this.localCar.isDead) {
            this.camera.follow(
                this.localCar.getActiveMesh(), 
                this.localCar.speed,
                this.localCar.angularVelocity
            );
        }
        this.camera.update();
        
        // Update UI
        this.ui.updateLives(this.localCar.lives, this.localCar.maxLives);
        this.ui.updateBoost(this.localCar.boostEnergy, this.localCar.boostMaxEnergy);
        this.ui.updateLap(this.localCar.currentLap);
        this.ui.updateSpeed(this.localCar.speed);
        this.ui.updateParticleCount(this.particles.getParticleCount());
        
        // Update leaderboard
        this._updateLeaderboard();
        
        // Update minimap
        this._updateMinimap();
        
        // Render
        this.renderer.render(this.sceneManager.getScene(), this.camera.getCamera());
    }

    /**
     * Load a custom track from imported JSON data
     */
    loadCustomTrack(trackData) {
        console.log('Loading custom track into game...');
        
        // Load the custom track in the scene
        const newTrack = this.sceneManager.loadCustomTrack(trackData);
        
        // Update game state with new track
        this.gameState.setTrack(newTrack);
        
        // Reinitialize minimap with new track
        if (newTrack && newTrack.skeletonPoints) {
            this.ui.initMinimap(newTrack.skeletonPoints);
        }
        
        // Reset game state
        this.gameState.reset();
        this.gameState.setCanPlay(true);
        
        // Reset and respawn local car
        if (this.localCar) {
            const spawn = this.gameState.getRandomSpawnPosition();
            this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
            this.localCar.reset();
        }
        
        // Reset remote players
        this.remotePlayers.forEach((player) => {
            player.lives = 3;
            player.isDead = false;
            player.resetLapProgress();
        });
        
        // Reset camera
        this.camera.exitSpectatorMode();
        
        console.log('Custom track loaded and game reset!');
    }
}
