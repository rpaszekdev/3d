"""
nifti_to_voxi.py — Convert NIfTI brain maps to VOXI format for LLM reasoning.

Converts thresholded statistical maps (t-maps, accuracy maps from MVPA)
into compact VOXI primitives with atlas-based region labels.

Pipeline:
  NIfTI stat map → threshold → cluster → fit ellipsoids → atlas lookup → .voxi

Usage:
    python nifti_to_voxi.py --input stats.nii.gz --threshold 3.5 --output result.voxi
    python nifti_to_voxi.py --input stats.nii.gz --threshold 3.5 --atlas harvard-oxford
    python nifti_to_voxi.py --input stats.nii.gz --threshold 3.5 --snapshot  # also emit slice views
    python nifti_to_voxi.py --demo  # generate a synthetic demo without nibabel

Requires: nibabel, nilearn, numpy, scipy (for real NIfTI files)
          numpy only (for --demo mode)
"""

import argparse
import sys
import math
import os
import numpy as np
from pathlib import Path

# Import from parent project for snapshot/rendering
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from textvoxel import Grid, set_voxel, fill_box, fill_sphere, snapshot, projection

# Try neuroimaging libs — graceful fallback for demo mode
try:
    import nibabel as nib
    HAS_NIBABEL = True
except ImportError:
    HAS_NIBABEL = False

try:
    from nilearn import datasets, image
    from nilearn.regions import connected_regions
    HAS_NILEARN = True
except ImportError:
    HAS_NILEARN = False

try:
    from scipy import ndimage
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


# ── Brain Atlas ─────────────────────────────────────────────────────

# Compact atlas: major regions as ellipsoids in MNI152 2mm space (91x109x91)
# Each entry: (name, cx, cy, cz, rx, ry, rz, functional_role, lobe)
# Coordinates are voxel indices in 2mm MNI space
BRAIN_ATLAS = [
    # Frontal lobe
    ("L-DLPFC",       26, 70, 50, 10, 14, 16, "working memory, executive control", "frontal"),
    ("R-DLPFC",       64, 70, 50, 10, 14, 16, "working memory, executive control", "frontal"),
    ("mPFC",          45, 68, 60, 7,  9,  7,  "self-reference, default mode", "frontal"),
    ("ACC",           45, 58, 34, 5,  6,  7,  "conflict monitoring, error detection", "frontal"),
    ("L-IFG",         22, 58, 48, 8,  7,  12, "speech production (Broca's), syntax", "frontal"),
    ("R-IFG",         68, 58, 48, 8,  7,  12, "inhibition, prosody", "frontal"),
    ("SMA",           45, 62, 68, 8,  5,  6,  "motor planning, sequencing", "frontal"),
    ("L-premotor",    30, 60, 62, 8,  6,  10, "motor preparation", "frontal"),
    ("R-premotor",    60, 60, 62, 8,  6,  10, "motor preparation", "frontal"),
    ("L-OFC",         30, 72, 34, 8,  6,  6,  "reward, decision-making", "frontal"),
    ("R-OFC",         60, 72, 34, 8,  6,  6,  "reward, decision-making", "frontal"),

    # Temporal lobe
    ("L-fusiform",    28, 38, 28, 5,  4,  12, "face perception (FFA), visual word form", "temporal"),
    ("R-fusiform",    62, 38, 28, 5,  4,  12, "face perception (FFA)", "temporal"),
    ("L-hippocampus", 26, 48, 24, 4,  3,  10, "memory encoding, spatial navigation", "temporal"),
    ("R-hippocampus", 64, 48, 24, 4,  3,  10, "memory encoding, spatial navigation", "temporal"),
    ("L-STG",         20, 52, 36, 6,  5,  14, "auditory processing, speech perception", "temporal"),
    ("R-STG",         70, 52, 36, 6,  5,  14, "auditory processing, voice", "temporal"),
    ("L-MTG",         24, 46, 32, 5,  4,  12, "semantic processing, language", "temporal"),
    ("R-MTG",         66, 46, 32, 5,  4,  12, "semantic processing", "temporal"),
    ("L-STS",         22, 50, 34, 4,  3,  12, "biological motion, social cues", "temporal"),
    ("R-STS",         68, 50, 34, 4,  3,  12, "biological motion, social cues", "temporal"),
    ("L-temporal-pole", 20, 62, 22, 6, 5,  6, "social concepts, semantic memory", "temporal"),
    ("R-temporal-pole", 70, 62, 22, 6, 5,  6, "social concepts, semantic memory", "temporal"),

    # Parietal lobe
    ("L-IPL",         30, 58, 58, 8,  7,  10, "attention, tool use, number", "parietal"),
    ("R-IPL",         60, 58, 58, 8,  7,  10, "attention, spatial awareness", "parietal"),
    ("L-SPL",         28, 54, 66, 6,  6,  8,  "visuospatial, reaching", "parietal"),
    ("R-SPL",         62, 54, 66, 6,  6,  8,  "visuospatial, reaching", "parietal"),
    ("precuneus",     45, 52, 64, 6,  7,  7,  "self-awareness, episodic memory", "parietal"),
    ("L-SMG",         28, 56, 52, 6,  5,  6,  "phonological processing", "parietal"),
    ("R-SMG",         62, 56, 52, 6,  5,  6,  "spatial attention", "parietal"),
    ("L-AG",          26, 52, 54, 5,  5,  5,  "semantic integration, reading", "parietal"),
    ("R-AG",          64, 52, 54, 5,  5,  5,  "spatial cognition", "parietal"),

    # Occipital lobe
    ("V1",            45, 30, 24, 12, 8,  8,  "primary visual, edges/orientation", "occipital"),
    ("L-V2/V3",       34, 32, 22, 6,  6,  6,  "early visual processing", "occipital"),
    ("R-V2/V3",       56, 32, 22, 6,  6,  6,  "early visual processing", "occipital"),
    ("L-V4",          30, 36, 22, 5,  5,  6,  "color, form perception", "occipital"),
    ("R-V4",          60, 36, 22, 5,  5,  6,  "color, form perception", "occipital"),
    ("L-V5/MT",       22, 40, 32, 4,  4,  4,  "motion perception", "occipital"),
    ("R-V5/MT",       68, 40, 32, 4,  4,  4,  "motion perception", "occipital"),
    ("L-LOC",         26, 38, 30, 6,  5,  8,  "object recognition", "occipital"),
    ("R-LOC",         64, 38, 30, 6,  5,  8,  "object recognition", "occipital"),

    # Subcortical
    ("L-thalamus",    36, 52, 38, 4,  4,  4,  "sensory relay, attention gating", "subcortical"),
    ("R-thalamus",    54, 52, 38, 4,  4,  4,  "sensory relay, attention gating", "subcortical"),
    ("L-amygdala",    32, 50, 28, 3,  3,  3,  "emotion, threat detection, salience", "subcortical"),
    ("R-amygdala",    58, 50, 28, 3,  3,  3,  "emotion, threat detection, salience", "subcortical"),
    ("L-caudate",     34, 58, 42, 3,  4,  4,  "learning, habit formation", "subcortical"),
    ("R-caudate",     56, 58, 42, 3,  4,  4,  "learning, habit formation", "subcortical"),
    ("L-putamen",     32, 54, 38, 4,  3,  5,  "motor control, reward learning", "subcortical"),
    ("R-putamen",     58, 54, 38, 4,  3,  5,  "motor control, reward learning", "subcortical"),
    ("L-NAcc",        34, 60, 32, 2,  2,  2,  "reward, motivation", "subcortical"),
    ("R-NAcc",        56, 60, 32, 2,  2,  2,  "reward, motivation", "subcortical"),

    # Cingulate
    ("PCC",           45, 46, 52, 5,  5,  5,  "default mode, self-reflection", "cingulate"),
    ("dACC",          45, 62, 42, 4,  5,  5,  "cognitive control, pain", "cingulate"),
    ("mid-cingulate", 45, 54, 48, 4,  6,  5,  "salience, motor", "cingulate"),

    # Insular
    ("L-insula",      24, 56, 36, 4,  6,  8,  "interoception, empathy, disgust", "insular"),
    ("R-insula",      66, 56, 36, 4,  6,  8,  "interoception, empathy, disgust", "insular"),

    # Cerebellum
    ("L-cerebellum",  30, 30, 36, 14, 10, 12, "motor coordination, timing", "cerebellum"),
    ("R-cerebellum",  60, 30, 36, 14, 10, 12, "motor coordination, timing", "cerebellum"),
    ("vermis",        45, 32, 30, 4,  8,  6,  "balance, posture", "cerebellum"),
]

# Lobe → VOXI color mapping
LOBE_COLORS = {
    "frontal":     "3",  # blue
    "temporal":    "2",  # green
    "parietal":    "5",  # magenta
    "occipital":   "1",  # red
    "subcortical": "9",  # gray
    "cingulate":   "6",  # yellow
    "insular":     "7",  # orange
    "cerebellum":  "4",  # cyan
}

# Intensity → VOXI color for activation maps
# Maps binned t-values to colors (hot colormap style)
INTENSITY_COLORS = {
    1: "6",  # yellow  (low)
    2: "7",  # orange  (medium)
    3: "1",  # red     (high)
    4: "e",  # maroon  (very high)
    5: "8",  # white   (peak)
}


# ── Atlas in MNI mm ─────────────────────────────────────────────────
# Pre-compute atlas entries in MNI mm for affine-independent matching.
# Original atlas is in 2mm voxel space; convert centers and radii to mm.

def _atlas_voxel_to_mni(vx, vy, vz):
    """Convert atlas 2mm voxel indices to MNI mm."""
    return (vx - 45) * 2, (vy - 63) * 2, (vz - 36) * 2

BRAIN_ATLAS_MNI = []
for _name, _cx, _cy, _cz, _rx, _ry, _rz, _role, _lobe in BRAIN_ATLAS:
    _mx, _my, _mz = _atlas_voxel_to_mni(_cx, _cy, _cz)
    # Radii in mm (each voxel = 2mm)
    BRAIN_ATLAS_MNI.append((_name, _mx, _my, _mz, _rx * 2, _ry * 2, _rz * 2, _role, _lobe))


# ── Atlas Lookup ────────────────────────────────────────────────────

def point_in_ellipsoid(px, py, pz, cx, cy, cz, rx, ry, rz):
    """Check if point is inside an ellipsoid."""
    if rx == 0 or ry == 0 or rz == 0:
        return False
    return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 + ((pz - cz) / rz) ** 2 <= 1.0


def lookup_region_mni(mx, my, mz):
    """Find which atlas region an MNI mm coordinate falls in.
    Returns (name, functional_role, lobe) or None.
    """
    best = None
    best_dist = float("inf")

    for name, cx, cy, cz, rx, ry, rz, role, lobe in BRAIN_ATLAS_MNI:
        if point_in_ellipsoid(mx, my, mz, cx, cy, cz, rx, ry, rz):
            dist = math.sqrt((mx - cx)**2 + (my - cy)**2 + (mz - cz)**2)
            if dist < best_dist:
                best_dist = dist
                best = (name, role, lobe)

    return best


def lookup_region_for_cluster_mni(mx, my, mz, rx_mm, ry_mm, rz_mm):
    """Find atlas region that best matches a cluster ellipsoid in MNI mm.
    Uses overlap estimation — which atlas region has most overlap with this cluster.
    """
    best = None
    best_overlap = 0

    for name, ax, ay, az, arx, ary, arz, role, lobe in BRAIN_ATLAS_MNI:
        # Approximate overlap: how close are the centers relative to combined radii
        dx = abs(mx - ax) / max(rx_mm + arx, 1)
        dy = abs(my - ay) / max(ry_mm + ary, 1)
        dz = abs(mz - az) / max(rz_mm + arz, 1)
        normalized_dist = math.sqrt(dx**2 + dy**2 + dz**2)

        if normalized_dist < 1.5:  # centers within combined radii
            overlap = 1.0 / (normalized_dist + 0.01)
            if overlap > best_overlap:
                best_overlap = overlap
                best = (name, role, lobe)

    return best


def voxel_to_mni_affine(vx, vy, vz, affine):
    """Convert voxel indices to MNI mm using the NIfTI affine matrix."""
    if affine is not None:
        coord = affine @ np.array([vx, vy, vz, 1.0])
        return float(coord[0]), float(coord[1]), float(coord[2])
    # Fallback: assume 2mm MNI
    return (vx - 45) * 2, (vy - 63) * 2, (vz - 36) * 2


def voxel_to_mni(vx, vy, vz):
    """Convert 2mm MNI voxel indices to MNI mm (for atlas/demo use)."""
    return (vx - 45) * 2, (vy - 63) * 2, (vz - 36) * 2


def mni_to_voxel(mx, my, mz):
    """Convert MNI mm to 2mm MNI voxel indices."""
    return round(mx / 2 + 45), round(my / 2 + 63), round(mz / 2 + 36)


# ── Clustering ──────────────────────────────────────────────────────

def cluster_voxels(binary_mask):
    """Find connected components in a 3D binary mask.
    Returns list of clusters, each a dict with voxel coordinates and stats.
    """
    if HAS_SCIPY:
        labeled, n_clusters = ndimage.label(binary_mask)
    else:
        # Simple flood-fill fallback
        labeled = np.zeros_like(binary_mask, dtype=int)
        n_clusters = 0
        visited = set()

        for z in range(binary_mask.shape[0]):
            for y in range(binary_mask.shape[1]):
                for x in range(binary_mask.shape[2]):
                    if binary_mask[z, y, x] and (z, y, x) not in visited:
                        n_clusters += 1
                        stack = [(z, y, x)]
                        while stack:
                            cz, cy, cx = stack.pop()
                            if (cz, cy, cx) in visited:
                                continue
                            if not (0 <= cz < binary_mask.shape[0] and
                                    0 <= cy < binary_mask.shape[1] and
                                    0 <= cx < binary_mask.shape[2]):
                                continue
                            if not binary_mask[cz, cy, cx]:
                                continue
                            visited.add((cz, cy, cx))
                            labeled[cz, cy, cx] = n_clusters
                            for dz, dy, dx in [
                                (1,0,0),(-1,0,0),(0,1,0),
                                (0,-1,0),(0,0,1),(0,0,-1)
                            ]:
                                stack.append((cz+dz, cy+dy, cx+dx))

    clusters = []
    for i in range(1, n_clusters + 1):
        coords = np.argwhere(labeled == i)
        if len(coords) < 1:
            continue
        clusters.append({
            "id": i,
            "coords": coords,  # (z, y, x) indices
            "size": len(coords),
        })

    # Sort by size descending
    clusters.sort(key=lambda c: c["size"], reverse=True)
    return clusters


def fit_ellipsoid(coords):
    """Fit a bounding ellipsoid to a cluster of voxel coordinates.
    Returns (cx, cy, cz, rx, ry, rz) in voxel space.
    coords: Nx3 array of (z, y, x) indices.
    """
    # Center
    center = coords.mean(axis=0)
    cz, cy, cx = center

    # Radii from standard deviation (scaled to approximate bounding ellipsoid)
    if len(coords) < 3:
        rz = ry = rx = 1
    else:
        std = coords.std(axis=0)
        # ~2 std covers ~95% of voxels for a roughly Gaussian cluster
        rz = max(1, round(std[0] * 2))
        ry = max(1, round(std[1] * 2))
        rx = max(1, round(std[2] * 2))

    return round(cx), round(cy), round(cz), rx, ry, rz


# ── NIfTI Loading ───────────────────────────────────────────────────

def load_nifti(filepath):
    """Load a NIfTI file, return (data_3d, affine).
    Data is oriented to standard RAS+ / MNI space.
    """
    if not HAS_NIBABEL:
        print("ERROR: nibabel required for NIfTI files.")
        print("  pip install nibabel")
        sys.exit(1)

    img = nib.load(filepath)

    # Reorient to RAS+ (standard orientation)
    img = nib.as_closest_canonical(img)

    data = img.get_fdata()
    affine = img.affine

    # If 4D (e.g. time series), take the first volume
    if data.ndim == 4:
        print(f"  4D volume detected ({data.shape[3]} timepoints), using first volume")
        data = data[:, :, :, 0]

    return data, affine


def threshold_and_cluster(data, threshold, min_cluster_size=10, affine=None):
    """Threshold a statistical map and extract clusters.
    Returns list of cluster dicts with fitted ellipsoids.
    If affine is provided, also computes MNI mm coordinates for each cluster.
    """
    binary = np.abs(data) >= threshold
    n_surviving = binary.sum()
    total = data.size
    pct = 100 * n_surviving / total

    print(f"  Threshold {threshold}: {n_surviving}/{total} voxels survive ({pct:.1f}%)")

    if n_surviving == 0:
        print("  WARNING: No voxels survive threshold. Try a lower value.")
        return []

    clusters = cluster_voxels(binary)
    print(f"  Found {len(clusters)} clusters (before size filter)")

    # Filter by minimum size
    clusters = [c for c in clusters if c["size"] >= min_cluster_size]
    print(f"  {len(clusters)} clusters >= {min_cluster_size} voxels")

    # Compute voxel spacing from affine (for converting radii to mm)
    if affine is not None:
        voxel_size = np.sqrt((affine[:3, :3] ** 2).sum(axis=0))  # mm per voxel
    else:
        voxel_size = np.array([2.0, 2.0, 2.0])

    # Fit ellipsoids and get peak values
    for cluster in clusters:
        coords = cluster["coords"]
        cx, cy, cz, rx, ry, rz = fit_ellipsoid(coords)
        cluster["ellipsoid"] = (cx, cy, cz, rx, ry, rz)

        # Peak value within cluster
        values = [data[c[0], c[1], c[2]] for c in coords]
        cluster["peak_value"] = max(values, key=abs)
        peak_idx = np.argmax(np.abs(values))
        cluster["peak_coord"] = tuple(coords[peak_idx])

        # Compute MNI mm coordinates using affine
        # Note: coords are (z, y, x) in array space, but affine expects (i, j, k)
        mni = voxel_to_mni_affine(cx, cy, cz, affine)
        cluster["mni_mm"] = mni

        # Radii in mm
        cluster["radii_mm"] = (
            rx * voxel_size[2],  # x-radius in mm
            ry * voxel_size[1],  # y-radius in mm
            rz * voxel_size[0],  # z-radius in mm
        )

    return clusters


# ── VOXI Generation ────────────────────────────────────────────────

def clusters_to_voxi(clusters, volume_shape, description="", threshold=0.0):
    """Convert clusters to VOXI format with atlas labels.
    Uses MNI mm coordinates (from affine) for atlas lookup.
    """
    # Use the actual volume dimensions
    w, h, d = volume_shape[2], volume_shape[0], volume_shape[1]

    lines = []
    lines.append(f"V {w} {h} {d}")
    if description:
        lines.append(f"-- {description}")
    lines.append(f"-- Threshold: |t| >= {threshold}")
    lines.append(f"-- {len(clusters)} significant clusters")
    lines.append("")

    # Region function lookup for header
    lines.append("-- REGION FUNCTIONS:")
    regions_seen = set()

    for i, cluster in enumerate(clusters):
        cx, cy, cz, rx, ry, rz = cluster["ellipsoid"]
        peak = cluster["peak_value"]
        size = cluster["size"]

        # Atlas lookup in MNI mm space
        mni_mm = cluster.get("mni_mm", voxel_to_mni(cx, cy, cz))
        radii_mm = cluster.get("radii_mm", (rx * 2, ry * 2, rz * 2))
        mni_x, mni_y, mni_z = mni_mm

        region = lookup_region_for_cluster_mni(
            mni_x, mni_y, mni_z, radii_mm[0], radii_mm[1], radii_mm[2]
        )

        if region:
            name, role, lobe = region
            color = LOBE_COLORS.get(lobe, "8")

            if name not in regions_seen:
                lines.append(f"--   {name}: {role}")
                regions_seen.add(name)
        else:
            color = "8"  # white for unknown

        # Intensity-based color override
        abs_peak = abs(peak)
        if abs_peak > 8:
            intensity_color = INTENSITY_COLORS[5]
        elif abs_peak > 6:
            intensity_color = INTENSITY_COLORS[4]
        elif abs_peak > 5:
            intensity_color = INTENSITY_COLORS[3]
        elif abs_peak > 4:
            intensity_color = INTENSITY_COLORS[2]
        else:
            intensity_color = INTENSITY_COLORS[1]

        cluster["region"] = region
        cluster["color"] = color
        cluster["intensity_color"] = intensity_color

    lines.append("")

    # Emit clusters as primitives
    for i, cluster in enumerate(clusters):
        cx, cy, cz, rx, ry, rz = cluster["ellipsoid"]
        peak = cluster["peak_value"]
        size = cluster["size"]
        region = cluster["region"]
        color = cluster["color"]

        mni_mm = cluster.get("mni_mm", voxel_to_mni(cx, cy, cz))
        mni_x, mni_y, mni_z = [round(v) for v in mni_mm]

        if region:
            name, role, lobe = region
            comment = f"cluster-{i+1}: {name}, {size} vox, peak t={peak:.1f}, MNI ({mni_x},{mni_y},{mni_z})"
        else:
            comment = f"cluster-{i+1}: unknown, {size} vox, peak t={peak:.1f}, MNI ({mni_x},{mni_y},{mni_z})"

        lines.append(f"-- {comment}")

        # Use sphere if roughly spherical, ellipsoid otherwise
        if rx == ry == rz:
            lines.append(f"S {cx} {cz} {cy} {rx} {color}")
        else:
            lines.append(f"E {cx} {cz} {cy} {rx} {rz} {ry} {color}")

    return "\n".join(lines)


def clusters_to_voxi_intensity(clusters, volume_shape, description="", threshold=0.0):
    """Alternative output: color by activation intensity instead of lobe."""
    w, h, d = volume_shape[2], volume_shape[0], volume_shape[1]

    lines = []
    lines.append(f"V {w} {h} {d}")
    if description:
        lines.append(f"-- {description}")
    lines.append(f"-- Threshold: |t| >= {threshold}")
    lines.append(f"-- Color = activation intensity: yellow(low) → orange → red → maroon → white(peak)")
    lines.append(f"-- {len(clusters)} significant clusters")
    lines.append("")

    for i, cluster in enumerate(clusters):
        cx, cy, cz, rx, ry, rz = cluster["ellipsoid"]
        peak = cluster["peak_value"]
        size = cluster["size"]
        region = cluster.get("region")
        color = cluster.get("intensity_color", "6")

        mni_mm = cluster.get("mni_mm", voxel_to_mni(cx, cy, cz))
        region_name = region[0] if region else "unknown"
        role = region[1] if region else ""

        lines.append(f"-- cluster-{i+1}: {region_name} ({role}), {size} vox, peak t={peak:.1f}")

        if rx == ry == rz:
            lines.append(f"S {cx} {cz} {cy} {rx} {color}")
        else:
            lines.append(f"E {cx} {cz} {cy} {rx} {rz} {ry} {color}")

    return "\n".join(lines)


# ── Atlas VOXI ──────────────────────────────────────────────────────

def generate_atlas_voxi():
    """Generate the brain atlas as a standalone .voxi file."""
    lines = []
    lines.append("V 91 109 91")
    lines.append("-- Human Brain Atlas (MNI152 2mm space)")
    lines.append("-- Color = lobe: blue=frontal, green=temporal, magenta=parietal,")
    lines.append("--   red=occipital, gray=subcortical, yellow=cingulate,")
    lines.append("--   orange=insular, cyan=cerebellum")
    lines.append("")

    current_lobe = None
    for name, cx, cy, cz, rx, ry, rz, role, lobe in BRAIN_ATLAS:
        color = LOBE_COLORS.get(lobe, "8")

        if lobe != current_lobe:
            lines.append(f"")
            lines.append(f"-- === {lobe.upper()} ===")
            current_lobe = lobe

        lines.append(f"-- {name}: {role}")
        if rx == ry == rz:
            lines.append(f"S {cx} {cz} {cy} {rx} {color}")
        else:
            lines.append(f"E {cx} {cz} {cy} {rx} {rz} {ry} {color}")

    return "\n".join(lines)


# ── Snapshot Generation ─────────────────────────────────────────────

def clusters_to_grid(clusters, volume_shape, use_intensity=False):
    """Render clusters into a textvoxel Grid for snapshot viewing.
    Downsamples to manageable size if needed.
    """
    # Determine if we need to downsample
    w, h, d = volume_shape[2], volume_shape[0], volume_shape[1]
    max_dim = max(w, h, d)

    if max_dim > 48:
        scale = 48 / max_dim
        gw = max(8, round(w * scale))
        gh = max(8, round(h * scale))
        gd = max(8, round(d * scale))
        print(f"  Downsampling snapshot: {w}x{h}x{d} → {gw}x{gh}x{gd}")
    else:
        gw, gh, gd = w, h, d
        scale = 1.0

    grid = Grid(gw, gh, gd)

    for cluster in clusters:
        cx, cy, cz, rx, ry, rz = cluster["ellipsoid"]
        color_key = "intensity_color" if use_intensity else "color"
        color = cluster.get(color_key, "8")

        # Scale coordinates
        scx = round(cx * scale) if scale != 1.0 else cx
        scy = round(cz * scale) if scale != 1.0 else cz  # swap y/z for grid
        scz = round(cy * scale) if scale != 1.0 else cy
        srx = max(1, round(rx * scale)) if scale != 1.0 else rx
        sry = max(1, round(rz * scale)) if scale != 1.0 else rz
        srz = max(1, round(ry * scale)) if scale != 1.0 else ry

        # Fill ellipsoid into grid
        for gy in range(max(0, scy - sry), min(gh, scy + sry + 1)):
            for gz in range(max(0, scz - srz), min(gd, scz + srz + 1)):
                for gx in range(max(0, scx - srx), min(gw, scx + srx + 1)):
                    if srx > 0 and sry > 0 and srz > 0:
                        if ((gx - scx)/srx)**2 + ((gy - scy)/sry)**2 + ((gz - scz)/srz)**2 <= 1.0:
                            grid = set_voxel(grid, gx, gy, gz, color)

    return grid


def generate_cropped_snapshot(cluster, data, margin=3):
    """Generate a detailed snapshot of a single cluster's neighborhood."""
    coords = cluster["coords"]
    mins = coords.min(axis=0)
    maxs = coords.max(axis=0)

    # Bounding box with margin
    z0 = max(0, mins[0] - margin)
    z1 = min(data.shape[0], maxs[0] + margin + 1)
    y0 = max(0, mins[1] - margin)
    y1 = min(data.shape[1], maxs[1] + margin + 1)
    x0 = max(0, mins[2] - margin)
    x1 = min(data.shape[2], maxs[2] + margin + 1)

    # Extract sub-volume
    sub = data[z0:z1, y0:y1, x0:x1]
    sw, sh, sd = sub.shape[2], sub.shape[0], sub.shape[1]

    # Don't create snapshots larger than 32^3
    if max(sw, sh, sd) > 32:
        return None

    grid = Grid(sw, sh, sd)

    # Bin values to intensity colors
    max_val = np.abs(sub).max() or 1
    for z in range(sub.shape[0]):
        for y in range(sub.shape[1]):
            for x in range(sub.shape[2]):
                val = sub[z, y, x]
                if abs(val) > 0.5:  # above noise floor
                    intensity = min(5, max(1, round(abs(val) / max_val * 5)))
                    color = INTENSITY_COLORS.get(intensity, "6")
                    grid = set_voxel(grid, x, z, y, color)

    region = cluster.get("region")
    label = region[0] if region else f"cluster-{cluster['id']}"

    return snapshot(grid, label=f"Zoomed: {label} ({sw}x{sh}x{sd})")


# ── Demo Mode ───────────────────────────────────────────────────────

def generate_demo():
    """Generate a synthetic face-vs-house MVPA result for demonstration."""
    print("Generating synthetic MVPA demo (face vs house decoding)...")
    print()

    # Simulate a 91x109x91 volume with synthetic activation clusters
    shape = (91, 109, 91)

    # Create synthetic clusters at known brain locations
    synthetic_clusters = [
        # (center_z, center_y, center_x, radius_z, radius_y, radius_x, peak_t)
        # Right fusiform (FFA) — strongest
        (28, 38, 62, 5, 4, 6, 7.2),
        # Left fusiform (FFA)
        (28, 38, 28, 4, 4, 5, 6.1),
        # Right STS — biological motion
        (34, 50, 68, 4, 3, 4, 4.8),
        # mPFC — self-referential
        (60, 68, 45, 4, 5, 4, 4.3),
        # Right amygdala — emotion
        (28, 50, 58, 3, 3, 3, 5.1),
        # Left LOC — object recognition
        (30, 38, 26, 4, 4, 5, 4.5),
    ]

    # Build fake data array
    data = np.zeros(shape, dtype=np.float32)
    for cz, cy, cx, rz, ry, rx, peak in synthetic_clusters:
        for z in range(max(0, cz - rz * 2), min(shape[0], cz + rz * 2)):
            for y in range(max(0, cy - ry * 2), min(shape[1], cy + ry * 2)):
                for x in range(max(0, cx - rx * 2), min(shape[2], cx + rx * 2)):
                    d = math.sqrt(
                        ((z - cz) / max(rz, 1))**2 +
                        ((y - cy) / max(ry, 1))**2 +
                        ((x - cx) / max(rx, 1))**2
                    )
                    if d <= 1.5:
                        # Gaussian falloff from peak
                        data[z, y, x] = peak * math.exp(-d**2)

    # Now run through the same pipeline as real data
    clusters = threshold_and_cluster(data, threshold=3.5, min_cluster_size=5)

    # Generate outputs
    description = "MVPA: face vs house decoding (synthetic demo)"

    voxi_lobe = clusters_to_voxi(clusters, shape, description, threshold=3.5)
    voxi_intensity = clusters_to_voxi_intensity(clusters, shape, description, threshold=3.5)
    atlas = generate_atlas_voxi()

    # Generate snapshot
    grid = clusters_to_grid(clusters, shape, use_intensity=False)
    snap = snapshot(grid, label="MVPA face vs house — whole brain overview")

    # Generate cropped snapshots for top 3 clusters
    cropped_snaps = []
    for cluster in clusters[:3]:
        cs = generate_cropped_snapshot(cluster, data)
        if cs:
            cropped_snaps.append(cs)

    return {
        "voxi_lobe": voxi_lobe,
        "voxi_intensity": voxi_intensity,
        "atlas": atlas,
        "snapshot": snap,
        "cropped_snapshots": cropped_snaps,
        "clusters": clusters,
    }


# ── LLM Prompt Assembly ────────────────────────────────────────────

def build_llm_prompt(voxi_code, atlas_voxi=None, snapshot_text=None,
                     cropped_snapshots=None, question=None):
    """Assemble a complete prompt for an LLM to reason about brain data."""
    sections = []

    sections.append("# Brain Activation Analysis (VOXI Format)")
    sections.append("")

    if atlas_voxi:
        sections.append("## Reference Atlas")
        sections.append("```voxi")
        # Include only the legend, not full atlas (too long)
        for line in atlas_voxi.split("\n"):
            if line.startswith("--") or line.startswith("V "):
                sections.append(line)
        sections.append("```")
        sections.append("")

    sections.append("## Activation Data")
    sections.append("```voxi")
    sections.append(voxi_code)
    sections.append("```")
    sections.append("")

    if snapshot_text:
        sections.append("## Spatial Overview (downsampled)")
        sections.append("```")
        sections.append(snapshot_text)
        sections.append("```")
        sections.append("")

    if cropped_snapshots:
        sections.append("## Detailed Cluster Views")
        for cs in cropped_snapshots:
            sections.append("```")
            sections.append(cs)
            sections.append("```")
            sections.append("")

    if question:
        sections.append(f"## Question")
        sections.append(question)
    else:
        sections.append("## Question")
        sections.append("Analyze the activation pattern. Which brain regions show significant activation?")
        sections.append("What cognitive processes do these regions suggest? Is this pattern consistent")
        sections.append("with known functional networks?")

    return "\n".join(sections)


# ── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convert NIfTI brain maps to VOXI format for LLM spatial reasoning"
    )
    parser.add_argument("--input", "-i", help="NIfTI file (.nii or .nii.gz)")
    parser.add_argument("--threshold", "-t", type=float, default=3.5,
                        help="Statistical threshold (default: 3.5)")
    parser.add_argument("--min-cluster", type=int, default=10,
                        help="Minimum cluster size in voxels (default: 10)")
    parser.add_argument("--output", "-o", help="Output .voxi file")
    parser.add_argument("--intensity", action="store_true",
                        help="Color by activation intensity instead of lobe")
    parser.add_argument("--snapshot", action="store_true",
                        help="Also generate text snapshot for LLM reading")
    parser.add_argument("--atlas", action="store_true",
                        help="Also output the reference atlas")
    parser.add_argument("--prompt", action="store_true",
                        help="Generate a complete LLM prompt with all context")
    parser.add_argument("--question", "-q", help="Question to include in LLM prompt")
    parser.add_argument("--demo", action="store_true",
                        help="Run with synthetic data (no nibabel needed)")

    args = parser.parse_args()

    if args.demo:
        result = generate_demo()

        out_dir = Path(__file__).parent
        out_base = out_dir / "demo-output"
        out_base.mkdir(exist_ok=True)

        # Write all outputs
        (out_base / "mvpa-face-house.voxi").write_text(result["voxi_lobe"])
        (out_base / "mvpa-face-house-intensity.voxi").write_text(result["voxi_intensity"])
        (out_base / "brain-atlas.voxi").write_text(result["atlas"])
        (out_base / "snapshot.txt").write_text(result["snapshot"])

        if result["cropped_snapshots"]:
            all_cropped = "\n\n".join(result["cropped_snapshots"])
            (out_base / "cropped-snapshots.txt").write_text(all_cropped)

        # Build LLM prompt
        prompt = build_llm_prompt(
            result["voxi_lobe"],
            atlas_voxi=result["atlas"],
            snapshot_text=result["snapshot"],
            cropped_snapshots=result["cropped_snapshots"],
        )
        (out_base / "llm-prompt.md").write_text(prompt)

        print()
        print(f"Demo output written to {out_base}/")
        print(f"  mvpa-face-house.voxi       — clusters colored by lobe")
        print(f"  mvpa-face-house-intensity.voxi — clusters colored by t-value")
        print(f"  brain-atlas.voxi           — reference atlas")
        print(f"  snapshot.txt               — text grid for LLM reading")
        print(f"  cropped-snapshots.txt      — zoomed views of top clusters")
        print(f"  llm-prompt.md              — complete LLM prompt")
        print()
        print("--- VOXI output (lobe-colored) ---")
        print(result["voxi_lobe"])
        print()
        print("--- Snapshot ---")
        print(result["snapshot"])
        return

    # Real NIfTI mode
    if not args.input:
        parser.print_help()
        print("\nUse --demo to run without a NIfTI file")
        sys.exit(1)

    if not HAS_NIBABEL:
        print("ERROR: nibabel is required for NIfTI files")
        print("  pip install nibabel nilearn scipy")
        sys.exit(1)

    print(f"Loading {args.input}...")
    data, affine = load_nifti(args.input)
    print(f"  Volume shape: {data.shape}")
    print(f"  Value range: [{data.min():.2f}, {data.max():.2f}]")

    clusters = threshold_and_cluster(data, args.threshold, args.min_cluster, affine=affine)

    if not clusters:
        print("No clusters found. Try a lower threshold.")
        sys.exit(1)

    description = f"NIfTI: {Path(args.input).name}"

    if args.intensity:
        voxi = clusters_to_voxi_intensity(clusters, data.shape, description, args.threshold)
    else:
        voxi = clusters_to_voxi(clusters, data.shape, description, args.threshold)

    # Output
    if args.prompt:
        atlas_voxi = generate_atlas_voxi() if args.atlas else None
        snap = None
        cropped = None

        if args.snapshot:
            grid = clusters_to_grid(clusters, data.shape, args.intensity)
            snap = snapshot(grid, label=f"Overview: {Path(args.input).stem}")
            cropped = []
            for c in clusters[:3]:
                cs = generate_cropped_snapshot(c, data)
                if cs:
                    cropped.append(cs)

        prompt = build_llm_prompt(voxi, atlas_voxi, snap, cropped, args.question)

        if args.output:
            Path(args.output).write_text(prompt)
            print(f"\nLLM prompt written to {args.output}")
        else:
            print(prompt)
    else:
        if args.output:
            Path(args.output).write_text(voxi)
            print(f"\nVOXI written to {args.output}")
        else:
            print()
            print(voxi)

        if args.snapshot:
            grid = clusters_to_grid(clusters, data.shape, args.intensity)
            snap = snapshot(grid, label=f"Overview: {Path(args.input).stem}")
            print()
            print(snap)

        if args.atlas:
            atlas = generate_atlas_voxi()
            atlas_path = Path(args.output).parent / "brain-atlas.voxi" if args.output else None
            if atlas_path:
                atlas_path.write_text(atlas)
                print(f"Atlas written to {atlas_path}")
            else:
                print()
                print(atlas)


if __name__ == "__main__":
    main()
