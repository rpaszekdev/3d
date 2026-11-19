"""
test_real_data.py — Test the nifti-to-voxi converter with real public fMRI data.

Downloads statistical maps from nilearn's sample datasets and converts them
to VOXI format. No credentials or IRB needed — these are public shared results.

Available tests:
    python test_real_data.py                 # runs all tests
    python test_real_data.py --test motor    # just the motor task
    python test_real_data.py --test faces    # face vs house localizer
    python test_real_data.py --test language # auditory/visual language
"""

import argparse
import sys
import os
from pathlib import Path

# Ensure we can import the converter
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nifti_to_voxi import (
    load_nifti, threshold_and_cluster, clusters_to_voxi,
    clusters_to_voxi_intensity, generate_atlas_voxi,
    clusters_to_grid, generate_cropped_snapshot, build_llm_prompt,
)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from textvoxel import snapshot

import numpy as np

OUT_DIR = Path(__file__).parent / "test-output"


def test_motor_task():
    """Test with a motor task contrast map.

    Expected activations: primary motor cortex (M1), SMA, cerebellum,
    somatosensory cortex — the classic motor network.
    """
    from nilearn import datasets

    print("=" * 60)
    print("TEST 1: Motor Task (left vs right hand button press)")
    print("=" * 60)
    print()
    print("Downloading motor task stat map from nilearn samples...")

    # fetch_localizer_contrasts gives us a single-subject t-map
    motor = datasets.fetch_localizer_contrasts(
        ["left button press (auditory cue)"],
        n_subjects=1,
        get_tmaps=True,
    )
    tmap_path = motor["tmaps"][0]
    print(f"  File: {tmap_path}")

    return run_conversion(
        nifti_path=tmap_path,
        name="motor-left-vs-right",
        description="Motor: left vs right hand button press",
        threshold=3.0,
        question=(
            "Analyze this motor task contrast (left vs right hand). "
            "Which brain regions show lateralized motor activation? "
            "Is this consistent with contralateral motor organization?"
        ),
    )


def test_visual_processing():
    """Test with a visual processing contrast map.

    Expected activations: occipital cortex (V1-V4), fusiform,
    lateral occipital, possibly parietal attention regions.
    """
    from nilearn import datasets

    print("=" * 60)
    print("TEST 2: Visual Processing (visual vs auditory)")
    print("=" * 60)
    print()
    print("Downloading visual processing stat map...")

    visual = datasets.fetch_localizer_contrasts(
        ["visual processing vs auditory processing"],
        n_subjects=1,
        get_tmaps=True,
    )
    tmap_path = visual["tmaps"][0]
    print(f"  File: {tmap_path}")

    return run_conversion(
        nifti_path=tmap_path,
        name="visual-vs-auditory",
        description="Visual processing vs auditory processing",
        threshold=3.0,
        question=(
            "Analyze this visual vs auditory contrast. "
            "Which visual cortex regions are activated? "
            "Do you see the expected occipital and ventral stream activation? "
            "Any evidence of cross-modal suppression in auditory cortex (negative values)?"
        ),
    )


def test_language():
    """Test with an auditory vs visual language contrast.

    Expected activations: STG/Heschl's gyrus, Broca's area (IFG),
    Wernicke's area (posterior STG), possibly angular gyrus.
    """
    from nilearn import datasets

    print("=" * 60)
    print("TEST 3: Language (auditory calculation vs visual calculation)")
    print("=" * 60)
    print()
    print("Downloading language contrast stat map...")

    lang = datasets.fetch_localizer_contrasts(
        ["auditory processing vs visual processing"],
        n_subjects=1,
        get_tmaps=True,
    )
    tmap_path = lang["tmaps"][0]
    print(f"  File: {tmap_path}")

    return run_conversion(
        nifti_path=tmap_path,
        name="auditory-vs-visual-calc",
        description="Language: auditory vs visual calculation",
        threshold=2.5,  # lower threshold — language activations can be weaker
        question=(
            "Analyze this auditory vs visual calculation contrast. "
            "Which regions suggest auditory language processing? "
            "Do you see evidence of Broca's or Wernicke's area involvement?"
        ),
    )


def test_haxby_categories():
    """Test with the Haxby 2001 dataset — the classic MVPA study.

    This is the dataset that started MVPA: 8 visual categories
    (faces, houses, cats, bottles, scissors, shoes, chairs, scrambled).
    We compute a simple face-vs-house contrast from the raw time series.
    """
    from nilearn import datasets, image
    from nilearn.glm.first_level import FirstLevelModel

    print("=" * 60)
    print("TEST 4: Haxby 2001 (the original MVPA dataset)")
    print("=" * 60)
    print()
    print("Downloading Haxby 2001 dataset (this may take a minute)...")

    haxby = datasets.fetch_haxby(subjects=[1])

    # Load the functional data and labels
    import pandas as pd
    labels = pd.read_csv(haxby.session_target[0], sep=" ")
    func_img = haxby.func[0]

    print(f"  Functional data: {func_img}")
    print(f"  {len(labels)} volumes, conditions: {labels['labels'].unique().tolist()}")

    # Build a simple GLM: face vs house
    # Create a design with face=1, house=-1, rest=0
    conditions = labels["labels"].values
    n_volumes = len(conditions)

    # Simple approach: average face volumes - average house volumes
    print("  Computing face vs house contrast (simple averaging)...")
    func = image.load_img(func_img)
    func_data = func.get_fdata()

    face_mask = conditions == "face"
    house_mask = conditions == "house"

    face_mean = func_data[:, :, :, face_mask].mean(axis=3)
    house_mean = func_data[:, :, :, house_mask].mean(axis=3)
    rest_mean = func_data[:, :, :, conditions == "rest"].mean(axis=3)

    # Pseudo t-statistic: (face - house) / pooled_std
    face_vols = func_data[:, :, :, face_mask]
    house_vols = func_data[:, :, :, house_mask]
    pooled_std = np.sqrt(
        (face_vols.var(axis=3) + house_vols.var(axis=3)) / 2
    )
    pooled_std[pooled_std < 0.001] = 0.001  # avoid division by zero

    pseudo_t = (face_mean - house_mean) / pooled_std

    # Save as NIfTI
    out_nifti = OUT_DIR / "haxby-face-vs-house-tmap.nii.gz"
    import nibabel as nib
    t_img = nib.Nifti1Image(pseudo_t, func.affine, func.header)
    nib.save(t_img, str(out_nifti))
    print(f"  Saved pseudo t-map: {out_nifti}")
    print(f"  Value range: [{pseudo_t.min():.2f}, {pseudo_t.max():.2f}]")

    return run_conversion(
        nifti_path=str(out_nifti),
        name="haxby-face-vs-house",
        description="Haxby 2001: face vs house (pseudo t-statistic)",
        threshold=0.8,  # low threshold — simple averaging yields weak pseudo-t
        min_cluster=5,
        question=(
            "This is data from the Haxby 2001 study — the experiment that "
            "launched multi-voxel pattern analysis (MVPA). "
            "Analyze the face vs house contrast. "
            "Do you see ventral temporal activation consistent with the "
            "fusiform face area? What does the spatial pattern tell us "
            "about distributed category representations in visual cortex?"
        ),
    )


def run_conversion(nifti_path, name, description, threshold, min_cluster=10, question=None):
    """Run the full conversion pipeline on a NIfTI file."""
    out = OUT_DIR / name
    out.mkdir(parents=True, exist_ok=True)

    print()
    print(f"Loading {nifti_path}...")
    data, affine = load_nifti(nifti_path)
    print(f"  Shape: {data.shape}")
    print(f"  Range: [{data.min():.2f}, {data.max():.2f}]")
    print(f"  Voxel size: {np.sqrt((affine[:3,:3]**2).sum(axis=0)).round(1)} mm")
    print()

    # Threshold and cluster (pass affine for MNI coordinate conversion)
    clusters = threshold_and_cluster(data, threshold, min_cluster, affine=affine)
    if not clusters:
        print(f"  No clusters survived. Try lower threshold.")
        return False

    # Generate VOXI (both colorings)
    voxi_lobe = clusters_to_voxi(clusters, data.shape, description, threshold)
    voxi_intensity = clusters_to_voxi_intensity(clusters, data.shape, description, threshold)
    atlas = generate_atlas_voxi()

    # Generate snapshots
    grid = clusters_to_grid(clusters, data.shape, use_intensity=False)
    snap = snapshot(grid, label=f"{name} — whole brain overview")

    cropped = []
    for c in clusters[:5]:  # top 5 clusters
        cs = generate_cropped_snapshot(c, data)
        if cs:
            cropped.append(cs)

    # Build LLM prompt
    prompt = build_llm_prompt(voxi_lobe, atlas, snap, cropped, question)

    # Write outputs
    (out / f"{name}.voxi").write_text(voxi_lobe)
    (out / f"{name}-intensity.voxi").write_text(voxi_intensity)
    (out / "brain-atlas.voxi").write_text(atlas)
    (out / "snapshot.txt").write_text(snap)
    if cropped:
        (out / "cropped-snapshots.txt").write_text("\n\n".join(cropped))
    (out / "llm-prompt.md").write_text(prompt)

    # Print results
    print()
    print(f"  Output: {out}/")
    print(f"  Clusters found: {len(clusters)}")
    print()
    print("  --- VOXI (lobe-colored) ---")
    print(voxi_lobe)
    print()

    # Print region summary
    print("  --- Region Summary ---")
    for i, c in enumerate(clusters):
        r = c.get("region")
        if r:
            name_r, role, lobe = r
            print(f"    {i+1}. {name_r} ({lobe}) — {role}")
            print(f"       {c['size']} voxels, peak t={c['peak_value']:.1f}")
        else:
            print(f"    {i+1}. Unknown region, {c['size']} voxels, peak t={c['peak_value']:.1f}")
    print()

    return True


def main():
    parser = argparse.ArgumentParser(description="Test brain converter with real fMRI data")
    parser.add_argument("--test", choices=["motor", "visual", "language", "haxby", "all"],
                        default="all", help="Which test to run (default: all)")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    tests = {
        "motor": test_motor_task,
        "visual": test_visual_processing,
        "language": test_language,
        "haxby": test_haxby_categories,
    }

    if args.test == "all":
        results = {}
        for name, fn in tests.items():
            try:
                ok = fn()
                results[name] = "PASS" if ok else "NO CLUSTERS"
            except Exception as e:
                results[name] = f"ERROR: {e}"
            print()

        print("=" * 60)
        print("RESULTS")
        print("=" * 60)
        for name, result in results.items():
            print(f"  {name:12s}: {result}")
    else:
        tests[args.test]()


if __name__ == "__main__":
    main()
