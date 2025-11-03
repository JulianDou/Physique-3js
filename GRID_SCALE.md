# Grid-Based Track Scaling - Quick Reference

## Overview

Tracks are now exported with **consistent grid-based scaling** so you always know how large your track will be in the game.

## The Scale

```
Editor Grid Square (50px) = 10 Game Units
```

### Quick Conversions

| Editor (Grid Squares) | Game (Units) | Relative Size |
|-----------------------|--------------|---------------|
| 5 squares             | 50 units     | Very Small    |
| 10 squares            | 100 units    | Small         |
| 15 squares            | 150 units    | Medium        |
| 20 squares            | 200 units    | Large         |
| 25 squares            | 250 units    | Very Large    |

### Recommended Sizes

- **Tight Technical Track**: 15 grid squares (150 units)
- **Standard Racing Circuit**: 20 grid squares (200 units)
- **Large High-Speed Track**: 25 grid squares (250 units)

For reference, the procedurally generated tracks are approximately **14-20 grid squares** in diameter.

## How to Use

### 1. Enable the Grid
- Check "Show Grid" in the Track Editor
- Grid squares appear as a reference

### 2. Design Your Track
- Each grid square = 10 units in-game
- Count squares to estimate size
- Use "Snap to Grid" for precise alignment

### 3. Export
- Track data includes grid scale info
- Game automatically uses correct scale
- No manual conversion needed!

## Example

If you create a track that spans:
- **Width**: 20 grid squares = 200 units
- **Length**: 25 grid squares = 250 units

Your track will be **200 x 250 units** in the 3D game world.

## Visual Reference

```
[Grid Square] = 10 units

🟩🟩🟩🟩🟩 = 50 units
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
= 50 units

(5x5 grid = 50x50 units)
```

## Technical Details

### Export Format
```json
"editor": {
  "gridSize": 50,     // pixels per grid square
  "gridScale": 10     // game units per grid square
}
```

### Import Conversion
```javascript
unitsPerPixel = gridScale / gridSize
// 10 / 50 = 0.2 units per pixel

gameX = editorX * 0.2
gameZ = editorY * 0.2
```

## Backward Compatibility

Old tracks without grid info still work - they use automatic bounding-box scaling.

## Tips

✅ **Always enable the grid** when designing for consistent sizing
✅ **Count grid squares** to estimate final size
✅ **Use snap to grid** for symmetrical designs
✅ **Test in-game** to verify scale feels right
✅ **Adjust if needed** - you can always re-export with different sizes
