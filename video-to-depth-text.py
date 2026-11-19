#!/usr/bin/env python3
"""
video-to-depth-text.py — Convert video frames into text depth matrices
that an LLM can read and reason about.

Pipeline: video → extract frames → depth estimation → downsample → quantize → text

Usage:
  python3 video-to-depth-text.py test-videos/ball-rolling-floor.mp4 --size 20 --fps 3
  python3 video-to-depth-text.py test-videos/cater-demo.mp4 --size 24 --fps 2 --start 10 --end 20
"""

import argparse
import sys
import os
import cv2
import numpy as np

def extract_frames(video_path, fps=3, start=0, end=None, max_frames=20):
    """Extract frames from video at given FPS."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: cannot open {video_path}")
        sys.exit(1)

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / video_fps

    print(f"Video: {video_path}")
    print(f"  Resolution: {int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
    print(f"  FPS: {video_fps:.1f}, Duration: {duration:.1f}s, Total frames: {total_frames}")

    if end is None:
        end = duration

    # Calculate which frames to grab
    frame_interval = video_fps / fps
    frames = []
    timestamps = []

    frame_idx = int(start * video_fps)
    end_idx = int(end * video_fps)

    while frame_idx < end_idx and len(frames) < max_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        timestamps.append(frame_idx / video_fps)
        frame_idx += int(frame_interval)

    cap.release()
    print(f"  Extracted {len(frames)} frames ({fps} fps, {start:.1f}s-{end:.1f}s)")
    return frames, timestamps


def estimate_depth_simple(frame):
    """Simple grayscale-based depth estimation (no ML model needed).
    Darker = closer, brighter = farther. Good enough for proof of concept."""
    gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY).astype(float)
    # Invert: dark objects (closer) get LOW depth values
    # Apply slight blur to reduce noise
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    return gray


def estimate_depth_ml(frames):
    """Use Depth Anything V2 for real monocular depth estimation."""
    from transformers import pipeline
    from PIL import Image
    import os
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

    print("  Loading Depth Anything V2 model...")
    depth_pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cpu")

    depths = []
    for i, frame in enumerate(frames):
        # Resize large frames to max 518px for speed
        h, w = frame.shape[:2]
        max_dim = 518
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        img = Image.fromarray(frame)
        result = depth_pipe(img)
        depth_map = np.array(result["depth"])
        depths.append(depth_map)
        if (i + 1) % 5 == 0 or i == 0:
            print(f"    Frame {i+1}/{len(frames)} done")

    print(f"  Depth estimation complete")
    return depths


def downsample_depth(depth_map, size=20):
    """Downsample depth map to size x size grid."""
    h, w = depth_map.shape
    # Resize to square
    resized = cv2.resize(depth_map, (size, size), interpolation=cv2.INTER_AREA)
    return resized


def quantize_depth(depth_map, levels=10):
    """Quantize depth values to 0-9 range. 0=close, 9=far, .=background."""
    dmin, dmax = depth_map.min(), depth_map.max()
    if dmax - dmin < 1e-6:
        return np.zeros_like(depth_map, dtype=int)

    normalized = (depth_map - dmin) / (dmax - dmin)
    quantized = np.clip((normalized * (levels - 1)).astype(int), 0, levels - 1)
    return quantized


def depth_to_text(quantized, timestamp=None):
    """Convert quantized depth matrix to text representation."""
    lines = []
    if timestamp is not None:
        lines.append(f"T={timestamp:.2f}s")

    h, w = quantized.shape
    # Column headers
    header = "   " + " ".join(f"{i%10}" for i in range(w))
    lines.append(header)

    for row in range(h):
        row_label = f"{row:2d} "
        cells = []
        for col in range(w):
            v = quantized[row, col]
            cells.append(str(v))
        lines.append(row_label + " ".join(cells))

    return "\n".join(lines)


def detect_motion(prev_q, curr_q, threshold=1):
    """Detect which cells changed between frames."""
    diff = np.abs(curr_q.astype(int) - prev_q.astype(int))
    changed = diff > threshold
    n_changed = np.sum(changed)

    if n_changed == 0:
        return "  No significant motion"

    # Find bounding box of changes
    rows, cols = np.where(changed)
    r_min, r_max = rows.min(), rows.max()
    c_min, c_max = cols.min(), cols.max()
    center_r = (r_min + r_max) // 2
    center_c = (c_min + c_max) // 2

    # Average direction of depth change
    depth_delta = np.mean(curr_q[changed].astype(float) - prev_q[changed].astype(float))
    depth_dir = "approaching" if depth_delta < -0.5 else "receding" if depth_delta > 0.5 else "lateral"

    return (f"  Motion: {n_changed} cells changed, "
            f"region ({c_min},{r_min})-({c_max},{r_max}), "
            f"center ~({center_c},{center_r}), {depth_dir}")


def frames_to_voxi_anim(quantized_frames, timestamps, size):
    """Convert depth frames to VOXI animation format with T commands."""
    lines = [f"V {size} {size} {size}", "-- Video depth frames as voxel animation"]

    for i, (q, t) in enumerate(zip(quantized_frames, timestamps)):
        lines.append(f"")
        lines.append(f"T {i}")
        lines.append(f"-- t={t:.2f}s")
        # Each cell becomes a column of voxels at that depth
        for row in range(size):
            for col in range(size):
                depth = q[row, col]
                # Map: depth 0 = close (high Y), depth 9 = far (low Y)
                # Place voxel at z=row, x=col, y proportional to depth
                y = size - 1 - depth  # invert: close = high
                lines.append(f"P {col} {y} {row} 8")  # white voxels

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Convert video to text depth matrices")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--size", type=int, default=20, help="Grid size (default: 20)")
    parser.add_argument("--fps", type=float, default=3, help="Frames per second to extract (default: 3)")
    parser.add_argument("--start", type=float, default=0, help="Start time in seconds")
    parser.add_argument("--end", type=float, default=None, help="End time in seconds")
    parser.add_argument("--max-frames", type=int, default=20, help="Max frames to extract")
    parser.add_argument("--method", choices=["simple", "ml"], default="ml", help="Depth method")
    parser.add_argument("--output", default=None, help="Output file (default: stdout)")
    parser.add_argument("--voxi", action="store_true", help="Also output VOXI animation format")
    args = parser.parse_args()

    # Extract frames
    frames, timestamps = extract_frames(
        args.video, fps=args.fps, start=args.start, end=args.end, max_frames=args.max_frames
    )

    if not frames:
        print("No frames extracted!")
        sys.exit(1)

    # Estimate depth
    if args.method == "ml":
        depth_maps = estimate_depth_ml(frames)
    else:
        depth_maps = [estimate_depth_simple(f) for f in frames]

    # Downsample and quantize
    quantized_frames = []
    for dm in depth_maps:
        ds = downsample_depth(dm, args.size)
        q = quantize_depth(ds)
        quantized_frames.append(q)

    # Generate text output
    output_lines = []
    output_lines.append(f"VIDEO DEPTH TEXT — {os.path.basename(args.video)}")
    output_lines.append(f"Grid: {args.size}x{args.size}, Frames: {len(frames)}, Method: {args.method}")
    output_lines.append(f"Depth: 0=close 9=far")
    output_lines.append("")

    for i, (q, t) in enumerate(zip(quantized_frames, timestamps)):
        output_lines.append(f"{'='*50}")
        output_lines.append(depth_to_text(q, t))

        # Motion detection between consecutive frames
        if i > 0:
            motion = detect_motion(quantized_frames[i-1], q)
            output_lines.append(motion)

        output_lines.append("")

    result = "\n".join(output_lines)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(result)
        print(f"\nOutput written to {args.output}")
    else:
        print("\n" + result)

    # Optional VOXI output
    if args.voxi:
        voxi_path = (args.output or args.video).rsplit('.', 1)[0] + ".voxi"
        voxi_code = frames_to_voxi_anim(quantized_frames, timestamps, args.size)
        with open(voxi_path, 'w') as f:
            f.write(voxi_code)
        print(f"VOXI animation written to {voxi_path}")


if __name__ == "__main__":
    main()
