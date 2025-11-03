/**
 * UIManager - Manages all UI elements (HUD, notifications, messages)
 */
export class UIManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.hud = null;
        this.hudElements = {};
        this.minimap = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.trackBounds = null;
        this.trackSkeletonPoints = null;
        this._createHUD();
    }

    _createHUD() {
        this.hud = document.createElement('div');
        this.hud.className = 'hud';
        this.hud.innerHTML = `
            <div class="title">🏎️ RACE TRACK</div>
            <div class="row">
                <div>Vies</div>
                <div id="hud-lives" style="color: #ff3333; font-weight: bold; font-size: 18px;">❤️ ❤️ ❤️</div>
            </div>
            <div class="row">
                <div>Boost</div>
                <div id="hud-boost" style="flex: 1;">
                    <div class="gauge">
                        <div class="gauge-fill" id="hud-boost-fill"></div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div>Tour</div>
                <div id="hud-lap" style="color: #00ff00; font-weight: bold; font-size: 18px;">0</div>
            </div>
            <div class="row" style="opacity: 0.6; font-size: 12px;">
                <div>Particules</div>
                <div id="hud-particles">0</div>
            </div>
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;">
            <button id="import-track-btn" class="host-btn primary" style="width: 100%; margin-top: 5px;">
                📁 Import Track
            </button>
        `;
        document.body.appendChild(this.hud);

        // Cache HUD elements
        this.hudElements.lives = document.getElementById('hud-lives');
        this.hudElements.boostFill = document.getElementById('hud-boost-fill');
        this.hudElements.particles = document.getElementById('hud-particles');
        this.hudElements.lap = document.getElementById('hud-lap');

        // Create hidden file input for track import
        this.trackFileInput = document.createElement('input');
        this.trackFileInput.type = 'file';
        this.trackFileInput.accept = '.json';
        this.trackFileInput.style.display = 'none';
        document.body.appendChild(this.trackFileInput);

        // Create now playing notification
        this._createNowPlaying();

        // Create leaderboard
        this._createLeaderboard();
    }

    /**
     * Create now playing notification
     */
    _createNowPlaying() {
        this.nowPlaying = document.createElement('div');
        this.nowPlaying.className = 'now-playing';
        this.nowPlaying.innerHTML = `
            <div class="now-playing-label">♪ Musique en cours</div>
            <div class="now-playing-track" id="now-playing-track"></div>
        `;
        document.body.appendChild(this.nowPlaying);
        this.hudElements.nowPlayingTrack = document.getElementById('now-playing-track');
        this.nowPlayingTimeout = null;
    }

    /**
     * Create leaderboard UI
     */
    _createLeaderboard() {
        this.leaderboard = document.createElement('div');
        this.leaderboard.className = 'leaderboard';
        this.leaderboard.innerHTML = `
            <div class="leaderboard-title">🏁 CLASSEMENT</div>
            <div id="leaderboard-content" class="leaderboard-content"></div>
        `;
        document.body.appendChild(this.leaderboard);

        this.hudElements.leaderboardContent = document.getElementById('leaderboard-content');
        
        // Create speedometer
        this._createSpeedometer();

        // Create minimap
        this._createMinimap();
    }

    /**
     * Create speedometer UI
     */
    _createSpeedometer() {
        this.speedometer = document.createElement('div');
        this.speedometer.className = 'speedometer';
        this.speedometer.innerHTML = `
            <div class="speedometer-value" id="speedometer-value">0</div>
            <div class="speedometer-label">KM/H</div>
        `;
        document.body.appendChild(this.speedometer);

        this.hudElements.speedometerValue = document.getElementById('speedometer-value');
    }

    /**
     * Update lives display
     */
    updateLives(current, max) {
        if (this.hudElements.lives) {
            const hearts = '❤️ '.repeat(Math.max(0, current));
            const emptyHearts = '🖤 '.repeat(Math.max(0, max - current));
            this.hudElements.lives.innerHTML = hearts + emptyHearts;
        }
    }

    /**
     * Update boost gauge
     */
    updateBoost(energy, maxEnergy) {
        if (this.hudElements.boostFill) {
            const ratio = Math.max(0, Math.min(1, energy / maxEnergy));
            this.hudElements.boostFill.style.transform = `scaleX(${ratio})`;
        }
    }

    /**
     * Update particle count
     */
    updateParticleCount(count) {
        if (this.hudElements.particles) {
            this.hudElements.particles.textContent = count;
        }
    }

    /**
     * Update speedometer
     */
    updateSpeed(speed) {
        if (this.hudElements.speedometerValue) {
            // Scale speed: 250 real units = 100 km/h displayed
            const speedScale = 100 / 250; // 0.4
            const displaySpeed = Math.round(Math.abs(speed) * speedScale);
            this.hudElements.speedometerValue.textContent = displaySpeed;
        }
    }

    /**
     * Update current lap display
     */
    updateLap(currentLap) {
        if (this.hudElements.lap) {
            this.hudElements.lap.textContent = currentLap;
        }
    }

    /**
     * Update leaderboard with all players' lap counts
     * @param {Array} players - Array of {id, name, laps, isLocal}
     */
    updateLeaderboard(players) {
        if (!this.hudElements.leaderboardContent) return;

        // Sort players by lap count (descending)
        const sortedPlayers = [...players].sort((a, b) => b.laps - a.laps);

        let html = '';
        sortedPlayers.forEach((player, index) => {
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
            const highlight = player.isLocal ? 'leaderboard-highlight' : '';
            const name = player.name || `Joueur ${player.id.substring(0, 4)}`;
            
            html += `
                <div class="leaderboard-entry ${highlight}">
                    <span class="leaderboard-position">${medal}</span>
                    <span class="leaderboard-name">${name}${player.isLocal ? ' (Vous)' : ''}</span>
                    <span class="leaderboard-laps">${player.laps} ${player.laps > 1 ? 'tours' : 'tour'}</span>
                </div>
            `;
        });

        this.hudElements.leaderboardContent.innerHTML = html || '<div style="opacity: 0.5;">Aucun joueur</div>';
    }

    /**
     * Show lap completion notification
     */
    showLapComplete(lapNumber) {
        const notification = document.createElement('div');
        notification.className = 'lap-complete-notification';
        notification.innerHTML = `
            <div class="notification-icon">🏁</div>
            <div class="notification-text">TOUR ${lapNumber} TERMINÉ!</div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    }

    /**
     * Show life lost notification
     */
    showLifeLost(livesRemaining) {
        const notification = document.createElement('div');
        notification.className = 'life-lost-notification';
        notification.innerHTML = `
            <div class="notification-icon">💔</div>
            <div class="notification-text">VIE PERDUE!</div>
            <div class="notification-subtext">${livesRemaining} ${livesRemaining > 1 ? 'vies restantes' : 'vie restante'}</div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    }

    /**
     * Show spectator mode message
     */
    showSpectatorMode(message = 'En attente de la fin du round...') {
        const spectatorDiv = document.createElement('div');
        spectatorDiv.id = 'spectator-message';
        spectatorDiv.className = 'spectator-banner';
        spectatorDiv.innerHTML = `
            <div class="spectator-icon">👻</div>
            <div class="spectator-text">MODE SPECTATEUR</div>
            <div class="spectator-subtext">${message}</div>
        `;
        document.body.appendChild(spectatorDiv);
    }

    /**
     * Show victory message
     */
    showVictory() {
        this._removeGameMessage();
        
        const victoryDiv = document.createElement('div');
        victoryDiv.id = 'game-message';
        victoryDiv.className = 'game-message victory';
        victoryDiv.innerHTML = `
            <div class="game-message-icon">🏆</div>
            <div class="game-message-title">VICTOIRE!</div>
            <div class="game-message-subtitle">${this.gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
        `;
        document.body.appendChild(victoryDiv);
        
        setTimeout(() => victoryDiv.classList.add('show'), 10);
    }

    /**
     * Show defeat message
     */
    showDefeat(winnerId) {
        this._removeGameMessage();
        
        const defeatDiv = document.createElement('div');
        defeatDiv.id = 'game-message';
        defeatDiv.className = 'game-message defeat';
        defeatDiv.innerHTML = `
            <div class="game-message-icon">💀</div>
            <div class="game-message-title">DÉFAITE</div>
            <div class="game-message-subtitle">Joueur ${winnerId} a gagné!</div>
            <div class="game-message-info">${this.gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
        `;
        document.body.appendChild(defeatDiv);
        
        setTimeout(() => defeatDiv.classList.add('show'), 10);
    }

    /**
     * Show draw message
     */
    showDraw() {
        this._removeGameMessage();
        
        const drawDiv = document.createElement('div');
        drawDiv.id = 'game-message';
        drawDiv.className = 'game-message draw';
        drawDiv.innerHTML = `
            <div class="game-message-icon">🤝</div>
            <div class="game-message-title">ÉGALITÉ!</div>
            <div class="game-message-subtitle">Tous les joueurs sont tombés!</div>
            <div class="game-message-info">${this.gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
        `;
        document.body.appendChild(drawDiv);
        
        setTimeout(() => drawDiv.classList.add('show'), 10);
    }

    /**
     * Show host controls
     */
    showHostControls(onStartGame, onResetGame) {
        let controls = document.getElementById('host-controls');
        
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'host-controls';
            controls.style.position = 'fixed';
            controls.style.bottom = '20px';
            controls.style.left = '20px';
            controls.style.padding = '15px 30px';
            controls.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            controls.style.color = '#ffffff';
            controls.style.fontSize = '18px';
            controls.style.fontWeight = 'bold';
            controls.style.borderRadius = '12px';
            controls.style.border = '3px solid #00ff00';
            controls.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
            controls.style.zIndex = '10000';
            controls.style.textAlign = 'center';
            document.body.appendChild(controls);
        }
        
        if (!this.gameState.isGameActive) {
            controls.innerHTML = `
                🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
                <button id="start-game-btn" class="host-btn primary">
                    🚀 DÉMARRER LA PARTIE
                </button>
            `;
            
            const startBtn = document.getElementById('start-game-btn');
            if (startBtn && onStartGame) {
                startBtn.addEventListener('click', onStartGame);
            }
        } else {
            controls.innerHTML = `
                🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
                <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
                    <button id="reset-game-btn" class="host-btn warning">
                        🔄 RÉINITIALISER
                    </button>
                </div>
            `;
            
            const resetBtn = document.getElementById('reset-game-btn');
            if (resetBtn && onResetGame) {
                resetBtn.addEventListener('click', onResetGame);
            }
        }
    }

    /**
     * Update host controls based on game state
     */
    updateHostControls(onStartGame, onResetGame) {
        if (this.gameState.isHost) {
            this.showHostControls(onStartGame, onResetGame);
        }
    }

    /**
     * Remove game over message
     */
    _removeGameMessage() {
        const existing = document.getElementById('game-message');
        if (existing) existing.remove();
    }

    /**
     * Remove spectator message
     */
    removeSpectatorMessage() {
        const spectatorMsg = document.getElementById('spectator-message');
        if (spectatorMsg) spectatorMsg.remove();
    }

    /**
     * Remove all messages
     */
    clearMessages() {
        this._removeGameMessage();
        this.removeSpectatorMessage();
    }

    /**
     * Show now playing notification
     */
    showNowPlaying(trackName) {
        if (!this.hudElements.nowPlayingTrack || !this.nowPlaying) return;

        // Clear existing timeout
        if (this.nowPlayingTimeout) {
            clearTimeout(this.nowPlayingTimeout);
        }

        // Update track name and show
        this.hudElements.nowPlayingTrack.textContent = trackName;
        this.nowPlaying.classList.add('show');

        // Hide after 3 seconds
        this.nowPlayingTimeout = setTimeout(() => {
            this.nowPlaying.classList.remove('show');
        }, 3000);
    }

    /**
     * Create minimap UI
     */
    _createMinimap() {
        this.minimap = document.createElement('div');
        this.minimap.className = 'minimap';
        this.minimap.innerHTML = `
            <canvas id="minimap-canvas" width="200" height="200"></canvas>
        `;
        document.body.appendChild(this.minimap);

        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
    }

    /**
     * Initialize minimap with track data
     * @param {Array} skeletonPoints - Array of THREE.Vector3 points defining the track centerline
     */
    initMinimap(skeletonPoints) {
        if (!skeletonPoints || skeletonPoints.length === 0) return;

        // Calculate track bounds
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        skeletonPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        });

        // Add padding
        const padding = 10;
        minX -= padding;
        maxX += padding;
        minZ -= padding;
        maxZ += padding;

        this.trackBounds = { minX, maxX, minZ, maxZ };
        
        // Store skeleton points for later drawing
        this.trackSkeletonPoints = skeletonPoints;

        // Draw track on minimap
        this._drawTrack(skeletonPoints);
    }

    /**
     * Draw the track on the minimap
     * @param {Array} skeletonPoints - Track skeleton points
     */
    _drawTrack(skeletonPoints) {
        if (!this.minimapCtx || !this.trackBounds) return;

        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        const bounds = this.trackBounds;

        // Clear canvas with transparency
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw track with semi-transparent dark background fill
        ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Create path for the track
        ctx.beginPath();
        skeletonPoints.forEach((point, index) => {
            const x = this._worldToMinimapX(point.x);
            const y = this._worldToMinimapY(point.z);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Close the loop
        const firstPoint = skeletonPoints[0];
        ctx.lineTo(
            this._worldToMinimapX(firstPoint.x),
            this._worldToMinimapY(firstPoint.z)
        );
        
        ctx.closePath();
        
        // Fill the track
        ctx.fill();
        
        // Stroke the track outline
        ctx.stroke();

        // Draw finish line marker (at first skeleton point)
        const finishX = this._worldToMinimapX(firstPoint.x);
        const finishY = this._worldToMinimapY(firstPoint.z);
        
        // Finish line glow
        ctx.shadowColor = 'rgba(0, 255, 0, 0.8)';
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(finishX, finishY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(finishX, finishY, 6, 0, Math.PI * 2);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }

    /**
     * Update minimap with player positions
     * @param {Array} players - Array of player objects with position and color
     */
    updateMinimap(players) {
        if (!this.minimapCtx || !this.trackBounds || !this.trackSkeletonPoints) return;

        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Redraw track using stored skeleton points
        if (this.trackSkeletonPoints) {
            const bounds = this.trackBounds;
            
            // Draw track with semi-transparent dark background fill
            ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Create path for the track
            ctx.beginPath();
            this.trackSkeletonPoints.forEach((point, index) => {
                const x = this._worldToMinimapX(point.x);
                const y = this._worldToMinimapY(point.z);

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            // Close the loop
            const firstPoint = this.trackSkeletonPoints[0];
            ctx.lineTo(
                this._worldToMinimapX(firstPoint.x),
                this._worldToMinimapY(firstPoint.z)
            );
            
            ctx.closePath();
            
            // Fill the track
            ctx.fill();
            
            // Stroke the track outline
            ctx.stroke();

            // Draw finish line marker (at first skeleton point)
            const finishX = this._worldToMinimapX(firstPoint.x);
            const finishY = this._worldToMinimapY(firstPoint.z);
            
            // Finish line glow
            ctx.shadowColor = 'rgba(0, 255, 0, 0.8)';
            ctx.shadowBlur = 15;
            
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(finishX, finishY, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(finishX, finishY, 6, 0, Math.PI * 2);
            ctx.stroke();
            
            // Reset shadow
            ctx.shadowBlur = 0;
        }

        // Draw players
        players.forEach(player => {
            if (!player.position) return;

            const x = this._worldToMinimapX(player.position.x);
            const y = this._worldToMinimapY(player.position.z);

            // Draw player glow
            ctx.shadowColor = player.color || '#ffffff';
            ctx.shadowBlur = 10;

            // Draw player dot
            ctx.fillStyle = player.color || '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, player.isLocal ? 6 : 5, 0, Math.PI * 2);
            ctx.fill();

            // Reset shadow
            ctx.shadowBlur = 0;

            // Draw white outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = player.isLocal ? 2 : 1.5;
            ctx.beginPath();
            ctx.arc(x, y, player.isLocal ? 6 : 5, 0, Math.PI * 2);
            ctx.stroke();

            // Draw direction indicator for local player
            if (player.isLocal && player.rotation !== undefined) {
                const dirLength = 10;
                const dirX = x + Math.sin(player.rotation) * dirLength;
                const dirY = y - Math.cos(player.rotation) * dirLength;

                ctx.strokeStyle = player.color || '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(dirX, dirY);
                ctx.stroke();
            }
        });
    }

    /**
     * Convert world X coordinate to minimap X coordinate
     */
    _worldToMinimapX(worldX) {
        const bounds = this.trackBounds;
        const canvas = this.minimapCanvas;
        const padding = 10;
        
        const normalized = (worldX - bounds.minX) / (bounds.maxX - bounds.minX);
        return padding + normalized * (canvas.width - padding * 2);
    }

    /**
     * Convert world Z coordinate to minimap Y coordinate (inverted)
     */
    _worldToMinimapY(worldZ) {
        const bounds = this.trackBounds;
        const canvas = this.minimapCanvas;
        const padding = 10;
        
        const normalized = (worldZ - bounds.minZ) / (bounds.maxZ - bounds.minZ);
        // Invert Y axis for canvas
        return canvas.height - (padding + normalized * (canvas.height - padding * 2));
    }

    /**
     * Setup track import functionality
     */
    setupTrackImport(callback) {
        const importBtn = document.getElementById('import-track-btn');
        
        importBtn.addEventListener('click', () => {
            this.trackFileInput.click();
        });
        
        this.trackFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.points || !Array.isArray(data.points)) {
                        throw new Error('Invalid track data format');
                    }
                    
                    // Call the callback with the loaded data
                    if (callback) {
                        callback(data);
                    }
                    
                    // Show success message
                    this.showGameMessage('Track Loaded!', `Custom track with ${data.points.length} points loaded successfully.`, 'success');
                    
                } catch (error) {
                    console.error('Error loading track:', error);
                    this.showGameMessage('Import Failed', 'Failed to load track: ' + error.message, 'defeat');
                }
            };
            reader.readAsText(file);
            
            // Reset file input so the same file can be loaded again
            e.target.value = '';
        });
    }
}
