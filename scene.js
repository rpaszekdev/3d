// Block A (right side) - has yellow on top, blue below
// Block B (left side) - has blue at bottom, yellow in middle, black at top

// VOXI format: V W H D (grid), B X Y Z W H D C (box), P X Y Z C (point)
// Y=UP, Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange 8=white 9=gray

// Grid: width=4, height=4, depth=1 (2D side view)
const code = `V 4 4 1
B 0 0 0 2 2 1 6
B 0 2 0 2 2 1 3
B 2 0 0 2 2 1 6
B 2 2 0 2 2 1 0`;

module.exports = { code };
