"""
visualize_paper.py — Generate comprehensive visualizations for the blind paper test.

Produces:
  1. Ground truth brain plots (nilearn)
  2. VOXI spatial reasoning snapshot (text grid)
  3. Cluster-by-cluster verification
  4. Atlas mismatch visualization (what the LLM caught)
  5. Complete documented reasoning report
"""

import sys
import os
from pathlib import Path

import numpy as np
import nibabel as nib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import Circle, FancyArrowPatch

from nilearn import plotting

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from nifti_to_voxi import (
    load_nifti, threshold_and_cluster, clusters_to_voxi,
    clusters_to_grid, generate_cropped_snapshot,
    lookup_region_mni, voxel_to_mni_affine,
    BRAIN_ATLAS_MNI, LOBE_COLORS,
)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from textvoxel import snapshot, projection

NIFTI_PATH = "/Users/robertpaszek/Desktop/Research/paper/FFA_localizer_ttest__Faces_mean.nii"
OUT = Path(__file__).parent / "visualizations"
THRESHOLD = 0.8


def load_data():
    """Load and inspect the NIfTI."""
    img = nib.load(NIFTI_PATH)
    img = nib.as_closest_canonical(img)
    data = img.get_fdata()
    affine = img.affine
    return img, data, affine


def plot_1_ground_truth(img):
    """Standard nilearn brain plots — the reference truth."""
    print("  Generating ground truth plots...")

    # Ortho view
    fig, ax = plt.subplots(1, 1, figsize=(16, 5))
    plotting.plot_stat_map(
        img, threshold=THRESHOLD,
        title="Ground Truth: Stat Map (|t| > 0.8)",
        display_mode="ortho", cut_coords=(0, -60, 20),
        axes=ax, colorbar=True,
    )
    fig.savefig(OUT / "01-ground-truth-ortho.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    # Glass brain
    fig, ax = plt.subplots(1, 1, figsize=(16, 5))
    plotting.plot_glass_brain(
        img, threshold=THRESHOLD,
        title="Glass Brain: All Activations (|t| > 0.8)",
        display_mode="lyrz", axes=ax, colorbar=True,
    )
    fig.savefig(OUT / "02-glass-brain.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    # Axial slices
    fig = plt.figure(figsize=(18, 12))
    plotting.plot_stat_map(
        img, threshold=THRESHOLD,
        title="Axial Slice Montage",
        display_mode="z", cut_coords=12,
        figure=fig, colorbar=True,
    )
    fig.savefig(OUT / "03-axial-slices.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    # Sagittal slices
    fig = plt.figure(figsize=(18, 8))
    plotting.plot_stat_map(
        img, threshold=THRESHOLD,
        title="Sagittal Slice Montage",
        display_mode="x", cut_coords=8,
        figure=fig, colorbar=True,
    )
    fig.savefig(OUT / "04-sagittal-slices.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    print("    01-ground-truth-ortho.png")
    print("    02-glass-brain.png")
    print("    03-axial-slices.png")
    print("    04-sagittal-slices.png")


def plot_2_voxi_spatial(data, affine):
    """Generate VOXI spatial reasoning views — what the LLM 'sees'."""
    print("  Generating VOXI spatial views...")

    clusters = threshold_and_cluster(data, THRESHOLD, min_cluster_size=5, affine=affine)

    # Generate VOXI text
    voxi_text = clusters_to_voxi(clusters, data.shape, "Paper: Blind Analysis", THRESHOLD)

    # Generate grid + snapshots
    grid = clusters_to_grid(clusters, data.shape, use_intensity=False)
    snap = snapshot(grid, label="VOXI Spatial View — What the LLM Reads")
    proj_top = projection(grid, "top")
    proj_front = projection(grid, "front")

    # Save text representations
    (OUT / "05-voxi-code.txt").write_text(voxi_text)
    (OUT / "06-voxi-snapshot.txt").write_text(snap)
    (OUT / "07-voxi-projections.txt").write_text(
        f"{proj_top}\n\n{proj_front}"
    )

    # Render the VOXI snapshot as an image for the report
    fig, axes = plt.subplots(1, 2, figsize=(20, 10))

    # Left: the VOXI code
    axes[0].text(0.02, 0.98, voxi_text, transform=axes[0].transAxes,
                 fontfamily="monospace", fontsize=8, verticalalignment="top",
                 bbox=dict(boxstyle="round", facecolor="black", alpha=0.9),
                 color="lime")
    axes[0].set_facecolor("black")
    axes[0].set_title("VOXI Primitive Code\n(What the converter outputs)", fontsize=12, fontweight="bold")
    axes[0].axis("off")

    # Right: the snapshot grid
    axes[1].text(0.02, 0.98, snap[:3000], transform=axes[1].transAxes,
                 fontfamily="monospace", fontsize=5, verticalalignment="top",
                 bbox=dict(boxstyle="round", facecolor="black", alpha=0.9),
                 color="cyan")
    axes[1].set_facecolor("black")
    axes[1].set_title("VOXI Text Snapshot\n(Layer-by-layer grid the LLM reads)", fontsize=12, fontweight="bold")
    axes[1].axis("off")

    fig.suptitle("VOXI Spatial Reasoning Format", fontsize=14, fontweight="bold")
    fig.savefig(OUT / "08-voxi-spatial-format.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    print("    05-voxi-code.txt")
    print("    06-voxi-snapshot.txt")
    print("    07-voxi-projections.txt")
    print("    08-voxi-spatial-format.png")

    return clusters


def plot_3_cluster_verification(img, clusters):
    """Show each cluster at its MNI peak — verify spatial accuracy."""
    print("  Generating cluster verification plots...")

    n = min(len(clusters), 8)
    fig, axes = plt.subplots(n, 3, figsize=(20, 4 * n))
    if n == 1:
        axes = axes.reshape(1, -1)

    for i, cluster in enumerate(clusters[:n]):
        mni_mm = cluster["mni_mm"]
        mx, my, mz = [round(v) for v in mni_mm]
        peak = cluster["peak_value"]
        size = cluster["size"]
        region = lookup_region_mni(mx, my, mz)
        name = region[0] if region else "unknown"

        for j, mode in enumerate(["x", "y", "z"]):
            cut = {"x": mx, "y": my, "z": mz}[mode]
            ax = axes[i, j]
            plotting.plot_stat_map(
                img, threshold=THRESHOLD,
                display_mode=mode, cut_coords=[cut],
                axes=ax, colorbar=False, annotate=True,
            )
            if j == 0:
                ax.set_title(
                    f"#{i+1}: {name}\n"
                    f"MNI ({mx},{my},{mz}), {size} vox, t={peak:.1f}",
                    fontsize=9, fontweight="bold",
                )

    fig.suptitle(
        "Cluster Verification: Each row = one cluster at its MNI peak\n"
        "If crosshair hits a bright blob, the conversion is correct",
        fontsize=13, fontweight="bold",
    )
    fig.tight_layout()
    fig.savefig(OUT / "09-cluster-verification.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("    09-cluster-verification.png")


def plot_4_atlas_mismatch(clusters):
    """Visualize the atlas mismatch the LLM caught."""
    print("  Generating atlas mismatch diagram...")

    fig, ax = plt.subplots(1, 1, figsize=(14, 10))

    # Draw a simplified sagittal brain outline
    brain_outline_x = [0, 10, 35, 55, 70, 80, 85, 80, 70, 50, 30, 10, 0]
    brain_outline_y = [50, 75, 90, 95, 90, 75, 50, 25, 10, 5, 8, 20, 50]
    ax.plot(brain_outline_x, brain_outline_y, "gray", linewidth=2, alpha=0.5)
    ax.fill(brain_outline_x, brain_outline_y, "gray", alpha=0.05)

    # Cerebellum outline (below and behind)
    cb_x = [25, 35, 50, 60, 65, 55, 40, 25]
    cb_y = [20, 8, 5, 8, 18, 25, 25, 20]
    ax.plot(cb_x, cb_y, "gray", linewidth=2, alpha=0.5)
    ax.fill(cb_x, cb_y, "gray", alpha=0.05)

    # Y axis = MNI z (bottom to top), X axis = MNI y (back to front)
    # Map MNI coords to plot coords: y_plot = (mni_z + 40) * 0.7, x_plot = (mni_y + 100) * 0.45

    def mni_to_plot(mni_y, mni_z):
        px = (mni_y + 110) * 0.42
        py = (mni_z + 50) * 0.65
        return px, py

    # Plot clusters — where our atlas said they are vs where they actually are
    for i, cluster in enumerate(clusters[:6]):
        mni_mm = cluster["mni_mm"]
        mx, my, mz = [round(v) for v in mni_mm]
        region = lookup_region_mni(mx, my, mz)
        atlas_name = region[0] if region else "unknown"
        peak = cluster["peak_value"]
        size = cluster["size"]

        px, py = mni_to_plot(my, mz)

        # Color by what atlas says
        color = "red" if "cerebellum" in atlas_name.lower() else "blue"

        # Determine what it ACTUALLY is based on MNI z
        if mz > 0 and "cerebellum" in atlas_name.lower():
            actual = "OCCIPITAL CORTEX"
            ax.plot(px, py, "o", markersize=max(6, size**0.4 * 3),
                    color="red", alpha=0.7, markeredgecolor="darkred", markeredgewidth=2)
            ax.annotate(
                f"#{i+1}: Atlas says '{atlas_name}'\n"
                f"LLM corrected → {actual}\n"
                f"MNI z={mz} (cerebellum is z<-20)",
                xy=(px, py), xytext=(px + 8, py + 5),
                fontsize=8, fontweight="bold", color="red",
                arrowprops=dict(arrowstyle="->", color="red", lw=1.5),
                bbox=dict(boxstyle="round,pad=0.3", facecolor="lightyellow", edgecolor="red"),
            )
        else:
            ax.plot(px, py, "o", markersize=max(6, size**0.4 * 3),
                    color="green", alpha=0.7, markeredgecolor="darkgreen", markeredgewidth=2)
            ax.annotate(
                f"#{i+1}: {atlas_name}\nMNI ({mx},{my},{mz})",
                xy=(px, py), xytext=(px + 6, py - 4),
                fontsize=7, color="darkgreen",
                arrowprops=dict(arrowstyle="->", color="green", lw=1),
            )

    # Add zone labels
    ax.text(15, 80, "FRONTAL", fontsize=11, color="gray", alpha=0.5, fontweight="bold")
    ax.text(55, 80, "PARIETAL", fontsize=11, color="gray", alpha=0.5, fontweight="bold")
    ax.text(55, 45, "OCCIPITAL", fontsize=11, color="gray", alpha=0.5, fontweight="bold")
    ax.text(40, 12, "CEREBELLUM", fontsize=11, color="gray", alpha=0.5, fontweight="bold")
    ax.text(10, 45, "TEMPORAL", fontsize=11, color="gray", alpha=0.5, fontweight="bold")

    # Add the z=0 line
    _, z0_y = mni_to_plot(0, 0)
    ax.axhline(y=z0_y, color="gray", linestyle="--", alpha=0.3, linewidth=1)
    ax.text(2, z0_y + 1, "MNI z = 0", fontsize=7, color="gray", alpha=0.5)

    # Add cerebellum boundary
    _, cb_boundary = mni_to_plot(0, -20)
    ax.axhline(y=cb_boundary, color="orange", linestyle="--", alpha=0.4, linewidth=1.5)
    ax.text(2, cb_boundary + 1, "z = -20 (cerebellum boundary)", fontsize=7, color="orange", alpha=0.7)

    ax.set_xlim(-5, 95)
    ax.set_ylim(-5, 100)
    ax.set_aspect("equal")
    ax.axis("off")

    ax.set_title(
        "Atlas Mismatch Detection\n"
        "The LLM caught that clusters labeled 'cerebellum' (z > 0) are actually in occipital cortex\n"
        "Red = mislabeled by atlas | Green = correctly labeled",
        fontsize=12, fontweight="bold",
    )

    # Legend
    ax.plot([], [], "o", color="red", markersize=10, label="Atlas ERROR (LLM corrected)")
    ax.plot([], [], "o", color="green", markersize=10, label="Atlas correct")
    ax.legend(loc="lower left", fontsize=10)

    fig.savefig(OUT / "10-atlas-mismatch.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("    10-atlas-mismatch.png")


def plot_5_llm_reasoning_flow():
    """Document the LLM's reasoning process as a flowchart."""
    print("  Generating LLM reasoning flow...")

    fig, ax = plt.subplots(1, 1, figsize=(18, 22))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 120)
    ax.axis("off")

    # Title
    ax.text(50, 118, "LLM Blind Analysis: Reasoning Flow",
            fontsize=16, fontweight="bold", ha="center", va="top")
    ax.text(50, 115, "Agent received VOXI data with NO task labels, NO filename, NO web access",
            fontsize=10, ha="center", va="top", style="italic", color="gray")

    # Step boxes
    steps = [
        {
            "y": 108, "color": "#E3F2FD", "border": "#1565C0",
            "title": "STEP 1: Data Quality Assessment",
            "content": (
                "• Peak t-values only 0.8-2.5 — 'remarkably weak'\n"
                "• Threshold |t| >= 0.8 is 'unusually liberal'\n"
                "• Most clusters 5-31 voxels — 'would not survive correction'\n"
                "• Concluded: group average with compressed statistics"
            ),
            "verdict": "CORRECT — This is indeed a group-averaged map",
        },
        {
            "y": 93, "color": "#FFF3E0", "border": "#E65100",
            "title": "STEP 2: Atlas Error Detection (KEY FINDING)",
            "content": (
                "• Cluster #1: labeled 'L-cerebellum' at MNI (-23,-86,+24)\n"
                "• LLM flagged: 'z = +24 is atypical for cerebellum'\n"
                "• 'Cerebellum generally occupies z < -20 to -30'\n"
                "• Re-identified as OCCIPITAL CORTEX (V1/V2/cuneus)\n"
                "• Same correction applied to clusters #2, #3, #6"
            ),
            "verdict": "CORRECT — Our atlas had a cerebellum boundary error",
        },
        {
            "y": 78, "color": "#E8F5E9", "border": "#2E7D32",
            "title": "STEP 3: Revised Spatial Interpretation",
            "content": (
                "• Reinterpreted as: large LEFT OCCIPITAL activation\n"
                "• Plus small L-STG (auditory), L-IFG (speech), L-DLPFC\n"
                "• Noted strong left lateralization\n"
                "• L-IFG and L-DLPFC show DEactivation (negative t)"
            ),
            "verdict": "CORRECT — Occipital dominance matches visual task",
        },
        {
            "y": 63, "color": "#F3E5F5", "border": "#7B1FA2",
            "title": "STEP 4: Task Identification",
            "content": (
                "• 'Most consistent with a basic visual processing task'\n"
                "• 'Perhaps passive viewing of visual stimuli'\n"
                "• Noted: no fusiform/FFA activation detected\n"
                "• Noted: no amygdala, no STS — missing face network\n"
                "• Could not identify faces specifically (data too weak)"
            ),
            "verdict": "PARTIALLY CORRECT — It IS a face viewing task,\nbut the FFA signal didn't survive the weak group stats",
        },
        {
            "y": 48, "color": "#FFEBEE", "border": "#C62828",
            "title": "STEP 5: Network Analysis",
            "content": (
                "• Checked against: Default Mode Network — NO\n"
                "• Checked against: Frontoparietal Control — NO\n"
                "• Checked against: Dorsal/Ventral Attention — NO\n"
                "• Checked against: Language Network — NO\n"
                "• Concluded: only early visual cortex active"
            ),
            "verdict": "VALID — Systematic network elimination is correct\nmethodology, even if the data was too weak for network ID",
        },
        {
            "y": 33, "color": "#FFF9C4", "border": "#F57F17",
            "title": "STEP 6: Red Flags Identified",
            "content": (
                "• MNI coordinate mislabeling (cerebellum z > 0)\n"
                "• Liberal threshold would fail multiple comparisons\n"
                "• Near-null result / underpowered\n"
                "• Cluster #5 at y=+65: possible frontal sinus artifact\n"
                "• Cluster #10 at x=-76: outside brain boundary"
            ),
            "verdict": "ALL VALID — These are real methodological concerns\na human reviewer would also raise",
        },
    ]

    for step in steps:
        y = step["y"]
        # Box
        box = plt.Rectangle((3, y - 9), 60, 12, linewidth=2,
                             edgecolor=step["border"], facecolor=step["color"],
                             alpha=0.8, zorder=2)
        ax.add_patch(box)

        # Title
        ax.text(5, y + 2, step["title"],
                fontsize=10, fontweight="bold", color=step["border"], va="top")

        # Content
        ax.text(5, y - 0.5, step["content"],
                fontsize=7.5, fontfamily="monospace", va="top", color="#333333")

        # Verdict box
        verdict_box = plt.Rectangle((66, y - 7), 32, 8, linewidth=1.5,
                                    edgecolor=step["border"], facecolor="white",
                                    alpha=0.9, zorder=2)
        ax.add_patch(verdict_box)
        ax.text(67, y - 0.5, step["verdict"],
                fontsize=7.5, fontweight="bold", va="top", color=step["border"])

        # Arrow down to next step
        if step != steps[-1]:
            ax.annotate("", xy=(33, y - 10), xytext=(33, y - 9),
                        arrowprops=dict(arrowstyle="->", color="gray", lw=2))

    # Final summary box
    summary_box = plt.Rectangle((3, 3), 94, 14, linewidth=3,
                                edgecolor="#1A237E", facecolor="#E8EAF6",
                                alpha=0.9, zorder=2)
    ax.add_patch(summary_box)
    ax.text(50, 15, "PROOF OF CONCEPT RESULT", fontsize=12,
            fontweight="bold", ha="center", va="top", color="#1A237E")
    ax.text(50, 12,
            "The LLM read VOXI-encoded brain data and:\n"
            "  ✓ Detected atlas coordinate errors purely from MNI values\n"
            "  ✓ Correctly identified this as a visual perception task\n"
            "  ✓ Applied proper neuroscientific reasoning (network analysis, statistical critique)\n"
            "  ✗ Could not identify 'faces' specifically (data too weak at group level)",
            fontsize=9, ha="center", va="top", fontfamily="monospace", color="#333333")

    fig.savefig(OUT / "11-llm-reasoning-flow.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("    11-llm-reasoning-flow.png")


def write_full_report(clusters, data):
    """Write the complete documented report."""
    print("  Writing full report...")

    report = """# Blind Brain Data Analysis — Proof of Concept Report

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
- Value range: [{min:.2f}, {max:.2f}]
- Threshold: |t| >= 0.8
- Clusters found: {n_clusters}
- Largest cluster: {largest_size} voxels (peak t = {largest_peak:.1f})

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
""".format(
        min=data.min(),
        max=data.max(),
        n_clusters=len(clusters),
        largest_size=clusters[0]["size"] if clusters else 0,
        largest_peak=clusters[0]["peak_value"] if clusters else 0,
    )

    (OUT / "12-full-report.md").write_text(report)
    print("    12-full-report.md")


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    print("Loading NIfTI data...")
    img, data, affine = load_data()
    print(f"  Shape: {data.shape}, range: [{data.min():.2f}, {data.max():.2f}]")
    print()

    print("Generating visualizations:")
    plot_1_ground_truth(img)
    clusters = plot_2_voxi_spatial(data, affine)
    plot_3_cluster_verification(img, clusters)
    plot_4_atlas_mismatch(clusters)
    plot_5_llm_reasoning_flow()
    write_full_report(clusters, data)

    print()
    print(f"All outputs saved to: {OUT}/")
    print("Opening key visualizations...")


if __name__ == "__main__":
    main()
