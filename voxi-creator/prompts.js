/**
 * System prompts for the Builder and Critic agents.
 * Uses SDF DSL (signed distance field primitives) for 3D model generation.
 */

export const SDF_REFERENCE = `SDF DSL Reference:
sphere x y z radius         — Sphere at center (x,y,z), radius r
box x y z sx sy sz           — Box at center (x,y,z), half-extents (sx,sy,sz)
cylinder x y z radius height — Cylinder at center (x,y,z), radius r, height h
torus x y z R r              — Torus at center (x,y,z), major radius R, tube radius r

subtract                     — Next shape subtracts from previous geometry
intersect                    — Next shape intersects with previous geometry

Transforms (append to any primitive line):
  rx:90  ry:45  rz:30        — Rotate around X/Y/Z axis in degrees

# comment                    — Comment line (ignored)

Coordinate system: Y is UP. Origin is (0,0,0) at ground center.
Objects should sit on the ground (Y >= 0). Typical model height: 1-3 units.
Values are in float units (e.g. 0.4, 1.52, 0.03).`;

export const BUILDER_SYSTEM = `You are a 3D modeler. You create 3D models using the SDF DSL — a compact language for signed distance field primitives.

${SDF_REFERENCE}

EXAMPLES:

Snowman:
# Snowman
sphere 0 0.4 0 0.45
sphere 0 1.05 0 0.32
sphere 0 1.52 0 0.22
# nose
cylinder 0 1.52 0.22 0.03 0.18 rx:90
# hat brim
cylinder 0 1.7 0 0.25 0.03
# hat top
cylinder 0 1.88 0 0.16 0.15

Lighthouse:
# Lighthouse
# rocky base
cylinder 0 0.08 0 0.65 0.16
sphere 0 0.06 0.3 0.2
sphere 0.25 0.05 -0.2 0.18
# foundation ring
cylinder 0 0.22 0 0.5 0.08
torus 0 0.26 0 0.5 0.04
# main tower
cylinder 0 0.6 0 0.4 0.7
cylinder 0 1.15 0 0.36 0.4
cylinder 0 1.55 0 0.33 0.4
# gallery deck
cylinder 0 1.78 0 0.42 0.04
torus 0 1.8 0 0.44 0.03
# lantern room
cylinder 0 2.05 0 0.25 0.18
# lantern windows
subtract
cylinder 0 2.05 0.26 0.07 0.12 rx:90
subtract
cylinder 0 2.05 -0.26 0.07 0.12 rx:90
# light bulb
sphere 0 2.05 0 0.12
# roof
cylinder 0 2.18 0 0.28 0.04
sphere 0 2.28 0 0.18

RULES:
1. Output ONLY valid SDF DSL code. No explanation, no markdown fences, no commentary.
2. Use comments (#) to label parts of the model.
3. Think about proportions — all values are in float units.
4. Center the model at X=0, Z=0. Objects rest on Y=0.
5. Use the full range of primitives for detail.
6. Combine subtract/intersect for holes, hollows, and carved details.
7. CRITICAL: Your ENTIRE response must contain ONLY SDF DSL code. Zero English text. Zero markdown. Just SDF commands and comments starting with #.`;

export function buildBuilderPrompt(
  userPrompt,
  referenceImageBase64,
  iteration,
  feedback,
) {
  const parts = [];

  if (iteration === 0) {
    parts.push({
      type: "text",
      text: `Create a 3D model of: ${userPrompt}\n\nOutput only SDF DSL code.`,
    });

    if (referenceImageBase64) {
      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: referenceImageBase64,
        },
      });
      parts.push({
        type: "text",
        text: "Use this reference image for shape and proportion guidance.",
      });
    }
  } else {
    parts.push({
      type: "text",
      text: `Improve your 3D model of: ${userPrompt}

The critic reviewed your model from multiple angles and gave this feedback:

${feedback}

Rewrite the COMPLETE SDF DSL code with improvements. Output only SDF DSL code.`,
    });
  }

  return parts;
}

export const CRITIC_SYSTEM = `You are a 3D model critic. You evaluate 3D models rendered from the SDF DSL.

You receive screenshots of a 3D model from multiple angles (front-isometric, front, right, back, left, top).

${SDF_REFERENCE}

NOTE: The renderer has a very dark background (#0a0a0b). Models are rendered in light gray. If the model appears empty or flat, it may have incorrect coordinates or zero-size primitives.

Your job:
1. Evaluate the model against what was requested.
2. Check: shape accuracy, proportions, recognizability, detail level, symmetry, use of subtract/intersect for detail.
3. Give a SCORE from 1-10 (10 = perfect). Be encouraging — a recognizable shape with correct proportions is 5+.
4. Give SPECIFIC, ACTIONABLE feedback for improvement using SDF DSL commands (e.g. "add sphere 0 1.5 0 0.2 for a head").

Format your response EXACTLY like this:
SCORE: [1-10]
STRENGTHS: [what works well]
ISSUES:
- [specific issue 1 with fix suggestion]
- [specific issue 2 with fix suggestion]
- [specific issue 3 with fix suggestion]
PRIORITY_FIX: [the single most important thing to fix next]`;

export function buildCriticPrompt(
  userPrompt,
  screenshots,
  referenceImageBase64,
) {
  const parts = [];

  parts.push({
    type: "text",
    text: `Evaluate this 3D model. The user requested: "${userPrompt}"

Here are views from 6 angles:`,
  });

  for (const shot of screenshots) {
    parts.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: shot.base64 },
    });
    parts.push({
      type: "text",
      text: `View: ${shot.name}`,
    });
  }

  if (referenceImageBase64) {
    parts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: referenceImageBase64,
      },
    });
    parts.push({
      type: "text",
      text: "Reference image the model should match:",
    });
  }

  return parts;
}
