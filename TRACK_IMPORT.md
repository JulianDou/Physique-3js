# Track Import Feature

## Overview

The game now supports importing custom tracks created in the Track Editor. When you import a track, the game automatically resets and loads your custom circuit.

## How to Import a Track

### From the Main Game

1. **Start the Game**: Open `index.html` in your browser
2. **Find the Import Button**: Look for the "📁 Import Track" button in the HUD (top-right corner)
3. **Click Import**: Click the button to open a file browser
4. **Select Your Track**: Choose a JSON file exported from the Track Editor
5. **Race**: The game will automatically reset with your custom track!

### What Happens on Import

When you import a custom track:

1. ✅ **Track is loaded** - Your custom track replaces the current procedurally generated track
2. ✅ **Game resets** - All players are respawned at new start positions
3. ✅ **Minimap updates** - The minimap reflects your custom track layout
4. ✅ **Track properties applied** - Track width and other settings from the editor are used
5. ✅ **Ready to race** - You can immediately start racing on your custom circuit

## Track Data Format

Custom tracks are imported from JSON files with this structure:

```json
{
  "version": "1.0",
  "name": "Custom Track",
  "created": "2025-11-03T12:34:56.789Z",
  "settings": {
    "trackWidth": 40,
    "smoothness": 0.5,
    "closedLoop": true
  },
  "editor": {
    "gridSize": 50,
    "gridScale": 10
  },
  "points": [
    { "x": 100, "y": 200 },
    { "x": 300, "y": 150 },
    { "x": 400, "y": 350 }
  ]
}
```

## Grid-Based Scale System

The editor now uses a **consistent grid-based scale** for predictable track sizing:

### How It Works

- **Editor Grid**: 50 pixels per grid square
- **Game Scale**: Each grid square = 10 units in 3D world
- **Conversion**: 1 pixel in editor = 0.2 units in game

### What This Means

When you draw in the editor with the grid enabled:
- **10 grid squares** in editor = **100 units** in game
- **20 grid squares** in editor = **200 units** in game

For reference:
- Procedurally generated tracks: ~140-200 units diameter
- Recommended custom tracks: 150-250 units diameter (15-25 grid squares)

### Legacy Support

Tracks exported before the grid scale system (without `editor.gridSize` and `editor.gridScale`) will still work but use automatic scaling based on bounding box.

## 2D to 3D Conversion

The editor uses 2D coordinates (X, Y on screen), which are converted to 3D world coordinates:

- **Editor X** → **Game X** (left/right position)
- **Editor Y** → **Game Z** (forward/backward position)
- **Game Y** = 0 (altitude - currently flat, future feature)

The track is automatically:
- **Centered** at world origin (0, 0, 0)
- **Scaled** using grid-based conversion (or auto-scaled for legacy tracks)
- **Closed** as a loop (if `closedLoop: true` in settings)

## Track Width Conversion

Track width from the editor is converted to game scale:

- **Editor**: 20-100 pixels
- **Game**: 8-16 units (3D world scale)
- Formula: `gameWidth = 8 + (editorWidth - 20) / 80 * 8`

## Creating Tracks for Import

### In the Track Editor

1. Open `editor.html`
2. **Enable the grid** to see scale (1 square = 10 game units)
3. Draw your track by clicking points
4. Adjust track width (20-100px)
5. Adjust curve smoothness (0-1)
6. Make sure "Closed Loop" is checked for racing circuits
7. Export as JSON (minimum 3 points required)

### Tips for Good Imported Tracks

✅ **Use enough points**: 6-12 points create interesting circuits
✅ **Smooth curves**: Use smoothness 0.5-0.8 for racing lines
✅ **Wider tracks**: Use 50-70px width for easier racing
✅ **Test in editor**: Make sure the track looks good before exporting
✅ **Closed loops**: Always use closed loops for racing circuits

## Technical Details

### Track.js Changes

The `Track` class now accepts an optional `customData` parameter:

```javascript
constructor(scene, customData = null)
```

If `customData` is provided, it calls `_loadCustomTrack()` instead of `_generateSkeleton()`.

### Scene.js Changes

The `SceneManager` now has a `loadCustomTrack()` method:

```javascript
loadCustomTrack(customData)
```

This destroys the current track and creates a new one with custom data.

### Game.js Changes

The `Game` class now has a `loadCustomTrack()` method that:

1. Loads the custom track via `SceneManager`
2. Updates the game state with the new track
3. Resets the minimap
4. Resets all players and spawns them
5. Resets the camera

### UIManager.js Changes

The `UIManager` now:

1. Creates an "Import Track" button in the HUD
2. Creates a hidden file input for JSON files
3. Provides a `setupTrackImport(callback)` method
4. Shows success/error messages

## Limitations

### Current Version

- ❌ No altitude/elevation (all tracks are flat)
- ❌ No bank/camber support
- ❌ Checkpoints are auto-generated (not customizable)
- ❌ No obstacle placement
- ❌ Single surface type only

### Future Enhancements

These features are planned:
- 🔮 Altitude editing in the editor
- 🔮 Custom checkpoint placement
- 🔮 Track banking and camber
- 🔮 Obstacle and decoration placement
- 🔮 Multiple surface types (dirt, ice, etc.)
- 🔮 Track preview before import
- 🔮 Server synchronization of custom tracks in multiplayer

## Troubleshooting

### Import Button Not Visible
- **Issue**: Can't find the import button
- **Solution**: Check the HUD in the top-right corner, below the lap counter

### Import Fails
- **Issue**: Error message when importing
- **Solution**: 
  - Make sure the file is a valid JSON
  - Ensure it was exported from the Track Editor
  - Check that it has at least 3 points

### Track Looks Wrong
- **Issue**: Track appears distorted or incorrect
- **Solution**: 
  - Check the track in the editor before exporting
  - Ensure points are well-distributed
  - Try adjusting the smoothness setting

### Track Too Small/Large
- **Issue**: Track is not the right size
- **Solution**: The size is automatically scaled, but you can adjust by:
  - Using more/fewer points
  - Spreading points further apart in the editor

### Game Freezes on Import
- **Issue**: Game becomes unresponsive
- **Solution**: 
  - Check browser console for errors
  - Try a simpler track with fewer points
  - Refresh the page and try again

## Example Workflow

### Complete Import Process

1. **Design**: Open `editor.html` and create a track
2. **Export**: Click "💾 Export JSON" (saves as `custom-track-[timestamp].json`)
3. **Play**: Open `index.html` in your browser
4. **Import**: Click "📁 Import Track" in the HUD
5. **Select**: Choose your exported JSON file
6. **Race**: Start racing on your custom track!

### Best Practices

1. **Test in Editor First**: Use the center view and zoom to inspect your track
2. **Export Multiple Versions**: Save different variations to test
3. **Start Simple**: Begin with 4-6 points, add complexity later
4. **Use Smooth Curves**: Set smoothness to 0.5-0.7 for best results
5. **Make it Raceable**: Ensure the track has clear racing lines

## API Reference

### Track.constructor(scene, customData)

Creates a new track, either procedurally generated or from custom data.

**Parameters:**
- `scene` (THREE.Scene) - The Three.js scene to add the track to
- `customData` (Object|null) - Optional custom track data from editor

### Track._loadCustomTrack(customData)

Internal method that converts 2D editor coordinates to 3D track skeleton points.

**Parameters:**
- `customData` (Object) - Track data with `points` and `settings`

### Game.loadCustomTrack(trackData)

Loads a custom track and resets the game.

**Parameters:**
- `trackData` (Object) - Track data from imported JSON file

### UIManager.setupTrackImport(callback)

Sets up the track import button and file input.

**Parameters:**
- `callback` (Function) - Called with track data when file is loaded

## Version History

**Version 1.0** (Current)
- Initial release
- Basic import functionality
- 2D to 3D conversion
- Automatic game reset
- UI integration
- Track width conversion
- Closed loop support
