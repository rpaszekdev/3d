# Blind Brain Data Analysis — Proof of Concept Report

## Experiment Setup

**Source data:** NeuroVault FFA localizer t-test (Faces > baseline), group average
**File:** FFA_localizer_ttest__Faces_mean.nii (670KB, 52×62×52 voxels)
**True task:** Face perception localizer (faces vs baseline)
**Given to agent:** VOXI cluster data only — NO filename, NO task labels, NO web access

## Pipeline

```
NIfTI stat map
    │
    ▼
nifti_to_voxi.py (threshold=0.8, min_cluster=5)
    │
    ▼
VOXI clusters + atlas labels + MNI coordinates
    │
    ▼
Blind LLM agent (no tools, no web, no filename)
    │
    ▼
Neuroscientific analysis
```

## Data Summary

- Volume: 52 × 62 × 52 voxels
- Value range: [-1.48, 2.46]
- Threshold: |t| >= 0.8
- Clusters found: 12
- Largest cluster: 943 voxels (peak t = 2.5)

## What the LLM Received

```
12 clusters with:
  - Atlas region labels (some incorrect)
  - MNI coordinates (accurate)
  - Cluster sizes
  - Peak t-values
  - A brain atlas reference (region → function mapping)
```

## LLM Reasoning (Documented)

### Step 1: Data Quality Assessment
The agent immediately noted:
- t-values (max 2.46) are "remarkably weak" for neuroimaging
- Threshold of 0.8 is "unusually liberal"
- Most clusters too small to survive standard correction
- **Verdict: CORRECT** — This is a group average with compressed statistics

### Step 2: Atlas Error Detection ★ KEY FINDING ★
The agent caught a bug in our atlas:
- Cluster #1 labeled "L-cerebellum" at MNI z = +24
- Agent flagged: "cerebellum generally occupies z < -20"
- Corrected to: OCCIPITAL CORTEX (V1/V2/cuneus)
- Applied same correction to 4 clusters
- **Verdict: CORRECT** — Our atlas ellipsoids for cerebellum were too large

### Step 3: Revised Spatial Interpretation
After correcting the atlas errors:
- Large LEFT OCCIPITAL activation (condition > baseline)
- Small L-STG involvement (auditory cortex)
- L-IFG and L-DLPFC deactivation
- Strong left lateralization
- **Verdict: CORRECT** — Occipital dominance matches a visual task

### Step 4: Task Identification
The agent concluded:
- "Most consistent with a basic visual processing task"
- "Perhaps passive viewing of visual stimuli"
- Could not identify "faces" specifically
- Noted absence of FFA, amygdala, STS activation
- **Verdict: PARTIALLY CORRECT** — It IS face viewing, but FFA signal
  didn't survive the weak group-level statistics

### Step 5: Systematic Network Elimination
Checked the pattern against known networks:
- Default Mode Network: NO (no mPFC, precuneus, AG)
- Frontoparietal Control: NO (minimal DLPFC, no parietal)
- Attention Networks: NO (no FEF, IPS, TPJ)
- Language Network: NO (L-IFG deactivated)
- Only early visual cortex clearly active
- **Verdict: VALID** — Proper neuroscientific methodology

### Step 6: Methodological Red Flags
Identified 5 concerns:
1. MNI coordinate ↔ label mismatch (cerebellum z > 0)
2. Liberal threshold wouldn't survive multiple comparisons
3. Near-null result suggests underpowered analysis
4. Cluster #5 (y=+65): possible frontal sinus artifact
5. Cluster #10 (x=-76): outside normal brain boundary
- **Verdict: ALL VALID** — A human reviewer would raise these same issues

## Scorecard

| Criterion | Result |
|-----------|--------|
| Read VOXI spatial data | ✓ Successfully parsed all clusters |
| Spatial reasoning from MNI coords | ✓ Detected coordinate errors |
| Atlas error correction | ✓ Caught cerebellum mislabeling |
| Task identification | ◐ Got "visual task" but not "faces" |
| Network analysis | ✓ Systematic and correct |
| Statistical critique | ✓ Valid methodological concerns |
| Artifact detection | ✓ Flagged boundary violations |

## Why It Didn't Identify "Faces"

The FFA (fusiform face area) is the primary neural signature of face
perception. This group-averaged map has a maximum t-value of only 2.46.
The FFA signal, which typically appears at MNI (~40, -55, -20) with
t > 4-6 in individual subjects, was washed out by group averaging.
Without FFA activation, no classifier — human or AI — could confidently
identify this as a face task rather than a generic visual task.

This is actually a **validation of the LLM's reasoning**: it correctly
noted the ABSENCE of face-selective regions rather than hallucinating
their presence.

## Conclusion

The VOXI format successfully enabled an LLM to:
1. Parse spatial brain data from text
2. Reason about neuroanatomy using MNI coordinates
3. Detect errors in atlas labeling
4. Apply standard neuroscientific inference
5. Produce methodologically sound analysis

The proof of concept demonstrates that VOXI can serve as a bridge
between neuroimaging data and LLM reasoning for MVPA and related
brain mapping analyses.

## Files Generated

```
paper-test/visualizations/
├── 01-ground-truth-ortho.png      — Standard nilearn stat map
├── 02-glass-brain.png             — 3D transparent projection
├── 03-axial-slices.png            — Horizontal slice montage
├── 04-sagittal-slices.png         — Vertical slice montage
├── 05-voxi-code.txt               — Raw VOXI primitives
├── 06-voxi-snapshot.txt           — Text grid (LLM's spatial view)
├── 07-voxi-projections.txt        — Top/front projections
├── 08-voxi-spatial-format.png     — VOXI format visualization
├── 09-cluster-verification.png    — Cluster-by-cluster accuracy check
├── 10-atlas-mismatch.png          — Atlas error diagram
├── 11-llm-reasoning-flow.png      — Step-by-step reasoning flowchart
└── 12-full-report.md              — This document
```
