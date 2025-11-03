# Track Editor Documentation

## Overview

The Track Editor is an interactive, browser-based tool that allows you to design custom racing circuits for the FloVrouuum racing game. Draw your track point by point, adjust its properties, and export it as a JSON file for later use.

## Features

### Drawing Tools
- **Draw Mode**: Click to add points and build your track
- **Edit Mode**: Drag existing points to reshape your track
- **Point Deletion**: Right-click any point to remove it
- **Undo**: Revert your last change (supports up to 50 steps)
- **Clear**: Start fresh with a blank canvas

### View Controls
- **Pan**: Hold Space + Drag to move around the canvas
- **Zoom**: Use mouse wheel to zoom in/out
- **Center View**: Automatically center and fit the track to the viewport

### Track Properties
- **Track Width**: Adjust the width of the racing surface (20-100 pixels)
- **Curve Smoothness**: Control how smooth the curves are between points (0 = straight lines, 1 = maximum smoothing)
- **Closed Loop**: Toggle whether the track connects back to the starting point (default: on for circuits)

### Grid System
- **Show Grid**: Display a reference grid on the canvas
- **Snap to Grid**: Automatically align new points to the grid (50px spacing)

### Import/Export
- **Export JSON**: Save your track design as a JSON file
- **Import JSON**: Load a previously saved track design

## How to Use

### Creating a New Track

1. **Open the Editor**: Click the "🎨 Track Editor" button from the main game page
2. **Start Drawing**: 
   - Make sure "Draw" mode is selected (it's the default)
   - Click on the canvas to place control points
   - Each click adds a new point to your track
3. **Shape Your Track**:
   - Add at least 3 points to create a valid track
   - Points are numbered automatically
   - The track surface is drawn between your points
4. **Adjust Properties**:
   - Use the sliders to modify track width and smoothness
   - Toggle the closed loop option if you want an open track
5. **Refine Your Design**:
   - Switch to "Edit" mode to drag points
   - Right-click points to delete them
   - Use Undo if you make a mistake

### Navigation Tips

- **Zooming**: Scroll with mouse wheel to zoom in/out (helpful for precision editing)
- **Panning**: Hold Space and drag to move around the canvas
- **Center View**: Click "🎯 Center View" to automatically frame your track

### Editing an Existing Track

1. Switch to **Edit Mode** using the toolbar
2. Click and drag any control point to move it
3. Right-click a point to remove it
4. The track updates in real-time as you edit

### Saving Your Work

1. Click **"💾 Export JSON"** when you're happy with your track
   - The button is only enabled when you have at least 3 points
2. A JSON file will be downloaded to your computer
3. The file contains:
   - All control points
   - Track properties (width, smoothness, closed loop)
   - Metadata (creation date, version)

### Loading a Saved Track

1. Click **"📁 Import JSON"**
2. Select a previously exported track file
3. The track and its settings will be loaded into the editor
4. Use "🎯 Center View" to frame the loaded track

## Track Data Format

The exported JSON file has the following structure:

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

### Field Descriptions

- **version**: Editor version (for future compatibility)
- **name**: Track name (currently "Custom Track")
- **created**: ISO timestamp of when the track was created
- **settings.trackWidth**: Width of the track surface in pixels
- **settings.smoothness**: Curve smoothness factor (0-1)
- **settings.closedLoop**: Whether the track forms a closed circuit
- **editor.gridSize**: Size of grid squares in pixels (50px)
- **editor.gridScale**: How many game units each grid square represents (10 units)
- **points**: Array of {x, y} coordinates for all control points

## Grid Scale System

The editor uses a **grid-based scale** for consistent sizing:

- **Grid Size**: 50 pixels per square in the editor
- **Game Scale**: Each grid square = 10 units in the 3D game world
- **Conversion**: 1 pixel = 0.2 units (10 units ÷ 50 pixels)

### Why This Matters

With the grid enabled, you can see exactly how large your track will be in the game:
- A track that's **10 grid squares wide** = **100 units** in the game
- A track that's **20 grid squares long** = **200 units** in the game

For reference, the procedurally generated tracks have a diameter of approximately **140-200 units**.

### Best Practice

✅ **Enable the grid** when designing to get a consistent sense of scale
✅ **Use Snap to Grid** for precise, symmetrical designs
✅ Aim for tracks that are **15-25 grid squares** in diameter for good racing

## Keyboard Shortcuts

- **Space + Drag**: Pan the view
- **Ctrl/Cmd + Z**: Undo last action
- **Delete**: Remove selected point (in Edit mode)
- **Right Click**: Delete point under cursor

## Design Tips

### Creating Good Tracks

1. **Start Simple**: Begin with 4-6 points to establish the basic shape
2. **Use Edit Mode**: Switch to Edit mode to fine-tune positions
3. **Smooth Curves**: Use higher smoothness values (0.6-0.8) for racing-style curves
4. **Sharp Corners**: Lower smoothness (0.2-0.4) for technical sections
5. **Track Width**: Wider tracks (60-80) are easier to race, narrower tracks (30-40) are more challenging
6. **Grid Alignment**: Enable "Snap to Grid" for symmetrical designs

### Visual Feedback

- **Yellow dashed line**: Shows the track centerline
- **Gray surface**: The actual racing surface
- **Red edges**: Track boundaries (simplified view)
- **White/Yellow/Green dots**: Control points (white = normal, yellow = hovered, green = selected)
- **Numbers**: Point order (helpful for understanding track flow)

## Known Limitations

### Current Version
- Track edge visualization is simplified
- No altitude/elevation support yet
- Export is JSON only (3D integration coming soon)
- No collision geometry generation
- No checkpoint placement tools

### Future Enhancements
These features are planned for future updates:
- 3D preview of the track
- Automatic checkpoint generation
- Track banking/camber controls
- Elevation editing
- Obstacle placement
- Direct integration with the game
- Multiple track layers/crossovers
- Texture/material selection

## Troubleshooting

### Track Won't Export
- **Issue**: Export button is disabled
- **Solution**: You need at least 3 points to export a valid track

### Can't See My Points
- **Issue**: Points are off-screen after zooming/panning
- **Solution**: Click "🎯 Center View" to reframe the track

### Track Looks Jagged
- **Issue**: Track curves are not smooth
- **Solution**: Increase the "Curve Smoothness" slider value

### Import Fails
- **Issue**: Error when loading a JSON file
- **Solution**: Make sure the file is a valid track JSON file exported from this editor

### Points Won't Delete
- **Issue**: Right-click doesn't remove points
- **Solution**: Make sure you're clicking directly on a point (they highlight yellow on hover)

## Technical Details

### Rendering
- Uses HTML5 Canvas API for 2D rendering
- Catmull-Rom spline interpolation for smooth curves
- Real-time rendering with efficient redraw
- View transformation for zoom/pan without quality loss

### Coordinate System
- Origin (0,0) is at the canvas center
- Positive X is right, positive Y is down
- Points are stored in world coordinates
- Canvas size adapts to window size

### Browser Compatibility
- Tested on modern browsers (Chrome, Firefox, Edge, Safari)
- Requires JavaScript enabled
- Canvas API support required
- File API for import/export

## Support

If you encounter issues or have suggestions:
1. Check this documentation first
2. Try the "🎯 Center View" button
3. Use Undo to revert problematic changes
4. Clear and start fresh if needed

## Version History

**Version 1.0** (Current)
- Initial release
- Basic drawing and editing tools
- JSON import/export
- Grid system
- Zoom and pan controls
- Undo functionality
- Smooth curve rendering
