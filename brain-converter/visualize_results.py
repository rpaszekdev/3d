"""
visualize_results.py — Visual verification of nifti-to-voxi conversion.

Generates side-by-side comparisons:
  1. Standard nilearn brain plots (ground truth)
  2. VOXI cluster overlay on glass brain
  3. Cluster-by-cluster verification with MNI coordinates

Usage:
    python visualize_results.py                    # all tests
    python visualize_results.py --test visual      # just one
    python visualize_results.py --interactive      # opens matplotlib windows
"""

import argparse
import sys
import os
from pathlib import Path

import numpy as np

try:
    import nibabel as nib
    import matplotlib
    matplotlib.use("Agg")  # non-interactive by default
    import matplotlib.pyplot as plt
    from nilearn import plotting, datasets, image
except ImportError:
    print("Required: pip install nibabel nilearn matplotlib")
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nifti_to_voxi import (
    load_nifti, threshold_and_cluster, lookup_region_mni,
    voxel_to_mni_affine, BRAIN_ATLAS_MNI, LOBE_COLORS,
)

OUT_DIR = Path(__file__).parent / "verification"


def verify_localizer(contrast_name, display_name, threshold=3.0):
    """Load a localizer contrast and generate verification plots."""
    print(f"\n{'='*60}")
    print(f"Verifying: {display_name}")
    print(f"{'='*60}")

    data_result = datasets.fetch_localizer_contrasts(
        [contrast_name], n_subjects=1, get_tmaps=True,
    )
    tmap_path = data_result["tmaps"][0]

    return verify_nifti(tmap_path, display_name, threshold)


def verify_nifti(nifti_path, display_name, threshold=3.0):
    """Generate verification plots for a NIfTI file."""
    out = OUT_DIR / display_name.lower().replace(" ", "-")
    out.mkdir(parents=True, exist_ok=True)

    img = nib.load(nifti_path)
    img = nib.as_closest_canonical(img)
    data = img.get_fdata()
    affine = img.affine

    if data.ndim == 4:
        data = data[:, :, :, 0]
        img = nib.Nifti1Image(data, affine)

    print(f"  Shape: {data.shape}, range: [{data.min():.1f}, {data.max():.1f}]")

    # ── Plot 1: Standard nilearn stat map (GROUND TRUTH) ────────────
    fig1, axes1 = plt.subplots(1, 1, figsize=(14, 5))
    plotting.plot_stat_map(
        img,
        threshold=threshold,
        title=f"GROUND TRUTH: {display_name} (t>{threshold})",
        display_mode="ortho",
        cut_coords=(0, -50, 20),
        axes=axes1,
        colorbar=True,
    )
    fig1.savefig(out / "1-ground-truth-ortho.png", dpi=150, bbox_inches="tight")
    plt.close(fig1)
    print(f"  Saved: 1-ground-truth-ortho.png")

    # ── Plot 2: Glass brain (all significant clusters) ──────────────
    fig2, axes2 = plt.subplots(1, 1, figsize=(14, 5))
    plotting.plot_glass_brain(
        img,
        threshold=threshold,
        title=f"Glass Brain: {display_name} (t>{threshold})",
        display_mode="lyrz",
        axes=axes2,
        colorbar=True,
    )
    fig2.savefig(out / "2-glass-brain.png", dpi=150, bbox_inches="tight")
    plt.close(fig2)
    print(f"  Saved: 2-glass-brain.png")

    # ── Plot 3: Axial slices montage ────────────────────────────────
    fig3 = plt.figure(figsize=(16, 10))
    plotting.plot_stat_map(
        img,
        threshold=threshold,
        title=f"Axial Slices: {display_name}",
        display_mode="z",
        cut_coords=8,
        figure=fig3,
        colorbar=True,
    )
    fig3.savefig(out / "3-axial-slices.png", dpi=150, bbox_inches="tight")
    plt.close(fig3)
    print(f"  Saved: 3-axial-slices.png")

    # ── Plot 4: VOXI cluster verification ───────────────────────────
    # Run our converter and verify each cluster
    clusters = threshold_and_cluster(data, threshold, min_cluster_size=10, affine=affine)

    if not clusters:
        print("  No clusters at this threshold — try lower")
        return out

    fig4, axes4 = plt.subplots(len(clusters[:8]), 3, figsize=(18, 4 * min(len(clusters), 8)))
    if len(clusters[:8]) == 1:
        axes4 = axes4.reshape(1, -1)

    for i, cluster in enumerate(clusters[:8]):
        cx, cy, cz, rx, ry, rz = cluster["ellipsoid"]
        mni_mm = cluster["mni_mm"]
        mx, my, mz = [round(v) for v in mni_mm]
        peak = cluster["peak_value"]
        region = lookup_region_mni(mx, my, mz)

        region_name = region[0] if region else "unknown"
        role = region[1] if region else ""

        # Plot the stat map centered on this cluster's peak
        for j, mode in enumerate(["x", "y", "z"]):
            cut = {"x": mx, "y": my, "z": mz}[mode]
            ax = axes4[i, j]
            plotting.plot_stat_map(
                img,
                threshold=threshold,
                display_mode=mode,
                cut_coords=[cut],
                axes=ax,
                colorbar=False,
                annotate=True,
            )
            if j == 0:
                ax.set_title(
                    f"#{i+1}: {region_name}\n"
                    f"MNI ({mx},{my},{mz}), {cluster['size']}vox, t={peak:.1f}",
                    fontsize=9, fontweight="bold",
                )

    fig4.suptitle(
        f"VOXI Cluster Verification: {display_name}\n"
        f"Each row = one cluster, shown at its MNI peak coordinate",
        fontsize=12, fontweight="bold",
    )
    fig4.tight_layout()
    fig4.savefig(out / "4-cluster-verification.png", dpi=150, bbox_inches="tight")
    plt.close(fig4)
    print(f"  Saved: 4-cluster-verification.png ({len(clusters[:8])} clusters)")

    # ── Plot 5: Atlas overlay — show where our atlas regions are ────
    fig5, axes5 = plt.subplots(1, 1, figsize=(14, 5))

    # Create a volume with atlas regions for visualization
    # Mark the center of each matched atlas region
    atlas_markers = []
    marker_labels = []
    for cluster in clusters[:10]:
        mni_mm = cluster["mni_mm"]
        mx, my, mz = mni_mm
        region = lookup_region_mni(round(mx), round(my), round(mz))
        if region:
            atlas_markers.append((mx, my, mz))
            marker_labels.append(f"{region[0]} (t={cluster['peak_value']:.1f})")

    if atlas_markers:
        plotting.plot_glass_brain(
            img,
            threshold=threshold,
            display_mode="lyrz",
            axes=axes5,
            title=f"Clusters + Atlas Labels: {display_name}",
        )
        # Add markers for each identified region
        for (mx, my, mz), label in zip(atlas_markers, marker_labels):
            plotting.plot_markers(
                [1.0],
                [[mx, my, mz]],
                axes=axes5,
                node_size=50,
                node_cmap="Set1",
            )

    fig5.savefig(out / "5-atlas-overlay.png", dpi=150, bbox_inches="tight")
    plt.close(fig5)
    print(f"  Saved: 5-atlas-overlay.png")

    # ── Summary text ────────────────────────────────────────────────
    summary_lines = [
        f"Verification: {display_name}",
        f"NIfTI: {nifti_path}",
        f"Shape: {data.shape}, Threshold: {threshold}",
        f"Clusters found: {len(clusters)}",
        "",
        "Cluster Details:",
        "-" * 80,
        f"{'#':>3} {'Region':<25} {'MNI (x,y,z)':<20} {'Size':>6} {'Peak t':>8}",
        "-" * 80,
    ]

    for i, cluster in enumerate(clusters):
        mni_mm = cluster["mni_mm"]
        mx, my, mz = [round(v) for v in mni_mm]
        region = lookup_region_mni(mx, my, mz)
        name = region[0] if region else "unknown"
        mni_str = f"({mx},{my},{mz})"
        summary_lines.append(
            f"{i+1:>3} {name:<25} {mni_str:<20} {cluster['size']:>6} {cluster['peak_value']:>8.1f}"
        )

    summary_lines.extend([
        "",
        "Files generated:",
        "  1-ground-truth-ortho.png   — Standard nilearn stat map (reference)",
        "  2-glass-brain.png          — 3D glass brain projection",
        "  3-axial-slices.png         — Axial slice montage",
        "  4-cluster-verification.png — Each VOXI cluster at its MNI peak",
        "  5-atlas-overlay.png        — Clusters with atlas labels",
        "",
        "To verify: Compare cluster locations in plot 4 against the VOXI output.",
        "Each row shows the activation at the exact MNI coordinate the converter reported.",
        "If the crosshair sits on a bright activation blob, the conversion is correct.",
    ])

    summary = "\n".join(summary_lines)
    (out / "verification-summary.txt").write_text(summary)
    print(f"  Saved: verification-summary.txt")
    print()
    print(summary)

    return out


def verify_haxby():
    """Verify the Haxby MVPA results."""
    tmap_path = Path(__file__).parent / "test-output" / "haxby-face-vs-house-tmap.nii.gz"
    if not tmap_path.exists():
        print("  Haxby t-map not found. Run test_real_data.py --test haxby first.")
        return None
    return verify_nifti(str(tmap_path), "Haxby Face vs House", threshold=0.8)


def main():
    parser = argparse.ArgumentParser(description="Visual verification of brain converter")
    parser.add_argument("--test", choices=["motor", "visual", "language", "haxby", "all"],
                        default="all")
    parser.add_argument("--interactive", action="store_true",
                        help="Open matplotlib windows instead of saving")
    args = parser.parse_args()

    if args.interactive:
        import matplotlib
        matplotlib.use("TkAgg")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    tests = {
        "motor": lambda: verify_localizer(
            "left button press (auditory cue)",
            "Motor Left Hand", threshold=3.0
        ),
        "visual": lambda: verify_localizer(
            "visual processing vs auditory processing",
            "Visual vs Auditory", threshold=3.0
        ),
        "language": lambda: verify_localizer(
            "auditory processing vs visual processing",
            "Auditory vs Visual", threshold=2.5
        ),
        "haxby": verify_haxby,
    }

    if args.test == "all":
        for name, fn in tests.items():
            try:
                fn()
            except Exception as e:
                print(f"  ERROR in {name}: {e}")
    else:
        tests[args.test]()

    print(f"\nAll verification images saved to: {OUT_DIR}/")
    print("Open the PNG files to visually inspect the results.")


if __name__ == "__main__":
    main()
