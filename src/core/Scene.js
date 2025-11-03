import * as THREE from 'three';
import { Track } from '../game/Track.js';

/**
 * SceneManager - Manages the Three.js scene and all static environment objects
 */
export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        
        // Track (replaces old circular platform)
        this.track = null;
        
        this._setupTrack();
        this._setupLights();
    }

    _setupTrack() {
        // Create racing track
        this.track = new Track(this.scene);
        console.log('Track initialized');
    }

    _setupLights() {
        // Hemisphere light
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        hemi.position.set(0, 20, 0);
        this.scene.add(hemi);

        // Directional light
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 30, 10);
        dirLight.castShadow = false;
        this.scene.add(dirLight);

        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
    }

    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }

    /**
     * Regenerate the track with a new random layout
     */
    regenerateTrack() {
        if (this.track) {
            this.track.destroy();
            this.track = null;
        }
        this._setupTrack();
        console.log('Track regenerated with new layout');
    }

    /**
     * Load a custom track from JSON data
     */
    loadCustomTrack(customData) {
        if (this.track) {
            this.track.destroy();
            this.track = null;
        }
        this.track = new Track(this.scene, customData);
        console.log('Custom track loaded');
        return this.track;
    }

    getTrack() {
        return this.track;
    }

    getScene() {
        return this.scene;
    }
}
