#!/usr/bin/env python3
"""VOXI Studio — Sketch Creator with Claude CLI Integration.

A Tkinter desktop app for generating UI sketches via natural language
prompts sent to Claude CLI, rendered inline using the VOXI UI Sketch DSL.
"""

import json
import os
import re
import subprocess
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import font as tkfont
from tkinter import ttk

# ── Constants ────────────────────────────────────────────────────────────────

CLAUDE_PATH = "/Users/robertpaszek/.claude/local/claude"
PROJECTS_DIR = Path.home() / ".voxi-studio" / "projects"
WINDOW_TITLE = "VOXI Studio"
WINDOW_SIZE = "1200x800"
SIDEBAR_WIDTH = 200
MAX_CANVAS_WIDTH = 700

# Dark theme colors
BG = "#1a1d27"
BG_DARK = "#0f1117"
SURFACE = "#232733"
BORDER = "#2d3244"
FG = "#e0e0e8"
FG_DIM = "#8888a0"
ACCENT = "#6c8cff"
CANVAS_BG = "#13151f"
USER_BUBBLE_BG = "#2d3244"
SKETCH_BUBBLE_BG = "#1a1d27"

SYSTEM_PROMPT = (
    "You are a UI sketch generator. Given a description, generate VOXI UI Sketch DSL code. "
    "FORMAT: CANVAS w h #bg, then RECT/TEXT/LINE/ELLIPSE/IMG elements. "
    "Each element: TYPE params z #color. z=depth (0=back, higher=front). "
    "OUTPUT ONLY DSL CODE. No explanations, no markdown fences. Start with CANVAS. "
    "Standard canvas: 1440x900 for desktop, 390x844 for mobile. "
    "Be detailed - capture every element."
)

# ── Color Parsing ────────────────────────────────────────────────────────────

FALLBACK_COLOR = "#888888"


def parse_color(raw: str) -> str:
    """Convert a color string to #RRGGBB format for Tkinter."""
    if not raw:
        return FALLBACK_COLOR
    raw = raw.strip()

    # #RRGGBB
    if re.match(r"^#[0-9a-fA-F]{6}$", raw):
        return raw

    # #RGB → #RRGGBB
    if re.match(r"^#[0-9a-fA-F]{3}$", raw):
        r, g, b = raw[1], raw[2], raw[3]
        return f"#{r}{r}{g}{g}{b}{b}"

    # #RRGGBBAA → strip alpha
    if re.match(r"^#[0-9a-fA-F]{8}$", raw):
        return raw[:7]

    # rgba(...) or rgb(...)
    m = re.match(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", raw)
    if m:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"#{r:02x}{g:02x}{b:02x}"

    return FALLBACK_COLOR


# ── DSL Parser ───────────────────────────────────────────────────────────────


def _tokenize_line(line: str) -> list[str]:
    """Split a DSL line into tokens, respecting quoted strings."""
    tokens = []
    current = ""
    in_quotes = False
    for ch in line:
        if ch == '"':
            if in_quotes:
                tokens.append(current)
                current = ""
                in_quotes = False
            else:
                if current:
                    tokens.append(current)
                    current = ""
                in_quotes = True
        elif ch in (" ", "\t") and not in_quotes:
            if current:
                tokens.append(current)
                current = ""
        else:
            current += ch
    if current:
        tokens.append(current)
    return tokens


def parse_dsl(code: str) -> dict:
    """Parse VOXI UI Sketch DSL into a structured dict.

    Returns dict with keys: width, height, bg, elements (sorted by z).
    """
    width, height, bg = 1440, 900, "#ffffff"
    elements = []

    for raw_line in code.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("--"):
            continue

        tokens = _tokenize_line(line)
        if not tokens:
            continue

        cmd = tokens[0].upper()

        if cmd == "CANVAS":
            width = _int(tokens, 1, 1440)
            height = _int(tokens, 2, 900)
            bg = _find_color(tokens[3:], "#ffffff")

        elif cmd == "RECT":
            x = _int(tokens, 1, 0)
            y = _int(tokens, 2, 0)
            w = _int(tokens, 3, 100)
            h = _int(tokens, 4, 50)
            z = _int(tokens, 5, 0)
            color = _find_color(tokens[6:], "#cccccc")
            radius = _find_bracket_int(tokens[6:], 0)
            elements.append({
                "type": "rect", "x": x, "y": y, "w": w, "h": h,
                "z": z, "color": color, "radius": radius,
            })

        elif cmd == "TEXT":
            x = _int(tokens, 1, 0)
            y = _int(tokens, 2, 0)
            text = _find_quoted(tokens, "Text")
            # Find remaining tokens after the quoted string
            rest = _tokens_after_quoted(tokens)
            size = _int_from_list(rest, 0, 14)
            z = _int_from_list(rest, 1, 0)
            color = _find_color(rest[2:], "#000000")
            bold = any(t.lower() == "bold" for t in rest)
            elements.append({
                "type": "text", "x": x, "y": y, "text": text,
                "size": size, "z": z, "color": color, "bold": bold,
            })

        elif cmd == "LINE":
            x1 = _int(tokens, 1, 0)
            y1 = _int(tokens, 2, 0)
            x2 = _int(tokens, 3, 100)
            y2 = _int(tokens, 4, 100)
            z = _int(tokens, 5, 0)
            color = _find_color(tokens[6:], "#000000")
            line_width = _find_bracket_int(tokens[6:], 1)
            elements.append({
                "type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "z": z, "color": color, "width": line_width,
            })

        elif cmd == "ELLIPSE":
            cx = _int(tokens, 1, 0)
            cy = _int(tokens, 2, 0)
            rx = _int(tokens, 3, 50)
            ry = _int(tokens, 4, 50)
            z = _int(tokens, 5, 0)
            color = _find_color(tokens[6:], "#cccccc")
            elements.append({
                "type": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry,
                "z": z, "color": color,
            })

        elif cmd == "IMG":
            x = _int(tokens, 1, 0)
            y = _int(tokens, 2, 0)
            w = _int(tokens, 3, 100)
            h = _int(tokens, 4, 80)
            z = _int(tokens, 5, 0)
            label = _find_bracket_str(tokens[6:], "IMG")
            elements.append({
                "type": "img", "x": x, "y": y, "w": w, "h": h,
                "z": z, "label": label,
            })

    # Sort by z-index (painter's algorithm)
    elements.sort(key=lambda e: e.get("z", 0))

    return {"width": width, "height": height, "bg": bg, "elements": elements}


def _int(tokens: list[str], idx: int, default: int) -> int:
    try:
        return int(tokens[idx])
    except (IndexError, ValueError):
        return default


def _int_from_list(tokens: list[str], idx: int, default: int) -> int:
    try:
        return int(tokens[idx])
    except (IndexError, ValueError):
        return default


def _find_color(tokens: list[str], default: str) -> str:
    for t in tokens:
        if t.startswith("#") or t.startswith("rgb"):
            return parse_color(t)
    return default


def _find_bracket_int(tokens: list[str], default: int) -> int:
    for t in tokens:
        if t.startswith("[") and t.endswith("]"):
            try:
                return int(t[1:-1])
            except ValueError:
                pass
        # Also accept bare numbers that could be optional params
    return default


def _find_bracket_str(tokens: list[str], default: str) -> str:
    for t in tokens:
        if t.startswith("[") and t.endswith("]"):
            return t[1:-1]
    # Also check for unbracketed label
    for t in tokens:
        if not t.startswith("#") and not t.startswith("rgb"):
            try:
                int(t)
            except ValueError:
                return t
    return default


def _find_quoted(tokens: list[str], default: str) -> str:
    """Find the first token that was a quoted string (already unquoted by tokenizer)."""
    # The tokenizer strips quotes, so quoted strings appear as tokens
    # that were between quotes. We need to find them by position:
    # TEXT x y "str" ... — token at index 3 is the text.
    if len(tokens) > 3:
        return tokens[3]
    return default


def _tokens_after_quoted(tokens: list[str]) -> list[str]:
    """Return tokens after position 3 (the quoted string position)."""
    return tokens[4:] if len(tokens) > 4 else []


# ── DSL Renderer on Tkinter Canvas ───────────────────────────────────────────


def render_dsl_on_canvas(canvas: tk.Canvas, parsed: dict, max_width: int = MAX_CANVAS_WIDTH):
    """Render parsed DSL elements onto a Tkinter Canvas widget.

    Scales to fit within max_width while maintaining aspect ratio.
    """
    orig_w = parsed["width"]
    orig_h = parsed["height"]
    bg = parse_color(parsed["bg"])

    scale = min(max_width / orig_w, 1.0)
    display_w = int(orig_w * scale)
    display_h = int(orig_h * scale)

    canvas.config(width=display_w, height=display_h, bg=bg, highlightthickness=0)
    canvas.delete("all")

    def s(v):
        return int(v * scale)

    for elem in parsed["elements"]:
        t = elem["type"]
        color = parse_color(elem.get("color", FALLBACK_COLOR))

        if t == "rect":
            x, y, w, h = s(elem["x"]), s(elem["y"]), s(elem["w"]), s(elem["h"])
            r = s(elem.get("radius", 0))
            if r > 0:
                _draw_rounded_rect(canvas, x, y, x + w, y + h, r, color)
            else:
                canvas.create_rectangle(x, y, x + w, y + h, fill=color, outline="")

        elif t == "text":
            x, y = s(elem["x"]), s(elem["y"])
            size = max(8, int(elem.get("size", 14) * scale))
            weight = "bold" if elem.get("bold") else "normal"
            canvas.create_text(
                x, y, text=elem.get("text", ""),
                fill=color, anchor="nw",
                font=("Helvetica", size, weight),
            )

        elif t == "line":
            x1, y1 = s(elem["x1"]), s(elem["y1"])
            x2, y2 = s(elem["x2"]), s(elem["y2"])
            w = max(1, int(elem.get("width", 1) * scale))
            canvas.create_line(x1, y1, x2, y2, fill=color, width=w)

        elif t == "ellipse":
            cx, cy = s(elem["cx"]), s(elem["cy"])
            rx, ry = s(elem["rx"]), s(elem["ry"])
            canvas.create_oval(cx - rx, cy - ry, cx + rx, cy + ry, fill=color, outline="")

        elif t == "img":
            x, y, w, h = s(elem["x"]), s(elem["y"]), s(elem["w"]), s(elem["h"])
            label = elem.get("label", "IMG")
            # Gray placeholder with X cross
            canvas.create_rectangle(x, y, x + w, y + h, fill="#555555", outline="#777777")
            canvas.create_line(x, y, x + w, y + h, fill="#777777", width=1)
            canvas.create_line(x + w, y, x, y + h, fill="#777777", width=1)
            lbl_size = max(8, int(10 * scale))
            canvas.create_text(
                x + w // 2, y + h // 2, text=label,
                fill="#aaaaaa", font=("Helvetica", lbl_size),
            )

    return len(parsed["elements"])


def _draw_rounded_rect(canvas, x1, y1, x2, y2, r, color):
    """Draw a rectangle with rounded corners on a Tkinter canvas."""
    r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
    points = [
        x1 + r, y1,
        x2 - r, y1,
        x2, y1,
        x2, y1 + r,
        x2, y2 - r,
        x2, y2,
        x2 - r, y2,
        x1 + r, y2,
        x1, y2,
        x1, y2 - r,
        x1, y1 + r,
        x1, y1,
        x1 + r, y1,
    ]
    canvas.create_polygon(points, fill=color, outline="", smooth=True)


# ── Project Manager ──────────────────────────────────────────────────────────


class ProjectManager:
    """Manages sketch projects stored in ~/.voxi-studio/projects/."""

    def __init__(self, base_dir: Path = PROJECTS_DIR):
        self._base = base_dir
        self._base.mkdir(parents=True, exist_ok=True)
        self._ensure_unsorted()

    def _ensure_unsorted(self):
        unsorted = self._base / "unsorted"
        unsorted.mkdir(exist_ok=True)
        meta_path = unsorted / "meta.json"
        if not meta_path.exists():
            self._write_meta(unsorted, {
                "name": "unsorted",
                "description": "Auto-saved sketches",
                "created": _today(),
                "variations": [],
            })

    def list_projects(self) -> list[str]:
        projects = []
        for p in sorted(self._base.iterdir()):
            if p.is_dir() and (p / "meta.json").exists():
                projects.append(p.name)
        return projects

    def list_variations(self, project: str) -> list[str]:
        proj_dir = self._base / project
        if not proj_dir.is_dir():
            return []
        voxi_files = sorted(proj_dir.glob("*.voxi"))
        return [f.stem for f in voxi_files]

    def create_project(self, name: str, description: str = "") -> bool:
        proj_dir = self._base / name
        if proj_dir.exists():
            return False
        proj_dir.mkdir(parents=True)
        self._write_meta(proj_dir, {
            "name": name,
            "description": description,
            "created": _today(),
            "variations": [],
        })
        return True

    def save_variation(self, project: str, dsl_code: str) -> str:
        proj_dir = self._base / project
        proj_dir.mkdir(parents=True, exist_ok=True)

        meta_path = proj_dir / "meta.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
        else:
            meta = {
                "name": project, "description": "",
                "created": _today(), "variations": [],
            }

        n = len(meta["variations"]) + 1
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        name = f"v{n}-{ts}"
        filename = f"{name}.voxi"

        (proj_dir / filename).write_text(dsl_code)
        meta["variations"].append(name)
        self._write_meta(proj_dir, meta)

        return str(proj_dir / filename)

    def load_variation(self, project: str, variation: str) -> str:
        path = self._base / project / f"{variation}.voxi"
        if path.exists():
            return path.read_text()
        return ""

    def _write_meta(self, proj_dir: Path, meta: dict):
        (proj_dir / "meta.json").write_text(json.dumps(meta, indent=2))


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


# ── Claude CLI Integration ───────────────────────────────────────────────────


def call_claude(prompt: str, callback, error_callback):
    """Call Claude CLI in a background thread.

    callback(dsl_code: str) is called on success.
    error_callback(error_msg: str) is called on failure.
    """

    def _run():
        try:
            result = subprocess.run(
                [
                    CLAUDE_PATH,
                    "-p", prompt,
                    "--append-system-prompt", SYSTEM_PROMPT,
                    "--allowedTools", "",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                error_callback(f"Claude CLI error (code {result.returncode}): {result.stderr.strip()}")
            else:
                output = result.stdout.strip()
                # Strip markdown fences if present
                output = _strip_markdown_fences(output)
                callback(output)
        except FileNotFoundError:
            error_callback(f"Claude CLI not found at {CLAUDE_PATH}")
        except subprocess.TimeoutExpired:
            error_callback("Claude CLI timed out after 120 seconds")
        except Exception as e:
            error_callback(f"Error calling Claude: {e}")

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()


def _strip_markdown_fences(text: str) -> str:
    """Remove markdown code fences if the output is wrapped in them."""
    lines = text.strip().splitlines()
    if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1])
    return text


# ── Main Application ─────────────────────────────────────────────────────────


class VoxiStudio(tk.Tk):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.title(WINDOW_TITLE)
        self.geometry(WINDOW_SIZE)
        self.configure(bg=BG)
        self.minsize(800, 500)

        self._project_mgr = ProjectManager()
        self._sketch_counter = 0
        self._current_project = "unsorted"

        self._build_ui()
        self._refresh_sidebar()

    # ── UI Construction ──────────────────────────────────────────────────

    def _build_ui(self):
        # Configure grid weights for resizing
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        self._build_sidebar()
        self._build_center()
        self._build_status_bar()

    def _build_sidebar(self):
        sidebar = tk.Frame(self, bg=BG_DARK, width=SIDEBAR_WIDTH)
        sidebar.grid(row=0, column=0, sticky="ns")
        sidebar.grid_propagate(False)

        # Header
        header = tk.Frame(sidebar, bg=BG_DARK)
        header.pack(fill="x", padx=8, pady=(8, 4))

        tk.Label(
            header, text="Projects", fg=FG, bg=BG_DARK,
            font=("Helvetica", 12, "bold"),
        ).pack(side="left")

        new_btn = tk.Button(
            header, text="+ New", fg=ACCENT, bg=SURFACE,
            activeforeground=FG, activebackground=SURFACE,
            relief="flat", font=("Helvetica", 10),
            command=self._on_new_project, cursor="hand2",
        )
        new_btn.pack(side="right")

        # Separator
        tk.Frame(sidebar, bg=BORDER, height=1).pack(fill="x", padx=8, pady=4)

        # Tree view
        style = ttk.Style()
        style.theme_use("default")
        style.configure(
            "Sidebar.Treeview",
            background=BG_DARK, foreground=FG, fieldbackground=BG_DARK,
            borderwidth=0, font=("Helvetica", 11),
        )
        style.configure(
            "Sidebar.Treeview.Heading",
            background=BG_DARK, foreground=FG_DIM,
        )
        style.map(
            "Sidebar.Treeview",
            background=[("selected", SURFACE)],
            foreground=[("selected", ACCENT)],
        )

        self._tree = ttk.Treeview(
            sidebar, style="Sidebar.Treeview", show="tree",
            selectmode="browse",
        )
        self._tree.pack(fill="both", expand=True, padx=4, pady=4)
        self._tree.bind("<<TreeviewSelect>>", self._on_tree_select)

    def _build_center(self):
        center = tk.Frame(self, bg=BG)
        center.grid(row=0, column=1, sticky="nsew")
        center.grid_rowconfigure(0, weight=1)
        center.grid_columnconfigure(0, weight=1)

        # Chat area (scrollable)
        chat_container = tk.Frame(center, bg=BG)
        chat_container.grid(row=0, column=0, sticky="nsew")
        chat_container.grid_rowconfigure(0, weight=1)
        chat_container.grid_columnconfigure(0, weight=1)

        self._chat_canvas = tk.Canvas(chat_container, bg=BG, highlightthickness=0)
        self._chat_scrollbar = tk.Scrollbar(
            chat_container, orient="vertical", command=self._chat_canvas.yview,
        )
        self._chat_frame = tk.Frame(self._chat_canvas, bg=BG)

        self._chat_frame.bind("<Configure>", self._on_chat_frame_configure)
        self._chat_canvas_window = self._chat_canvas.create_window(
            (0, 0), window=self._chat_frame, anchor="nw",
        )
        self._chat_canvas.configure(yscrollcommand=self._chat_scrollbar.set)
        self._chat_canvas.bind("<Configure>", self._on_chat_canvas_resize)

        self._chat_canvas.grid(row=0, column=0, sticky="nsew")
        self._chat_scrollbar.grid(row=0, column=1, sticky="ns")

        # Bind mouse wheel scrolling
        self._chat_canvas.bind("<MouseWheel>", self._on_mousewheel)
        self._chat_canvas.bind("<Button-4>", self._on_mousewheel)
        self._chat_canvas.bind("<Button-5>", self._on_mousewheel)

        # Input bar
        input_bar = tk.Frame(center, bg=SURFACE, pady=10, padx=16)
        input_bar.grid(row=1, column=0, sticky="ew")
        input_bar.grid_columnconfigure(0, weight=1)

        self._input_var = tk.StringVar()
        self._input_entry = tk.Entry(
            input_bar, textvariable=self._input_var,
            bg=SURFACE, fg=FG, insertbackground=FG,
            relief="flat", font=("Helvetica", 14),
            highlightthickness=1, highlightcolor=ACCENT,
            highlightbackground=BORDER,
        )
        self._input_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self._input_entry.bind("<Return>", self._on_send)
        self.bind_all("<Command-v>", self._on_paste)

        attach_btn = tk.Button(
            input_bar, text="📎", bg=SURFACE, fg=FG_DIM,
            activebackground=SURFACE, activeforeground=FG,
            relief="flat", font=("Helvetica", 16),
            padx=8, pady=4, command=self._on_attach, cursor="hand2",
        )
        attach_btn.grid(row=0, column=1, padx=(0, 8))

        send_btn = tk.Button(
            input_bar, text="Send", bg=ACCENT, fg="#ffffff",
            activebackground="#5a7ae6", activeforeground="#ffffff",
            relief="flat", font=("Helvetica", 13, "bold"),
            padx=20, pady=6, command=self._on_send, cursor="hand2",
        )
        send_btn.grid(row=0, column=2)

    def _build_status_bar(self):
        self._status_var = tk.StringVar(value="Ready")
        status_bar = tk.Label(
            self, textvariable=self._status_var,
            bg=BG_DARK, fg=FG_DIM, anchor="w",
            font=("Helvetica", 10), padx=12, pady=4,
        )
        status_bar.grid(row=1, column=0, columnspan=2, sticky="ew")

    # ── Chat Messages ────────────────────────────────────────────────────

    def _add_user_message(self, text: str):
        """Add a right-aligned user message bubble to the chat."""
        wrapper = tk.Frame(self._chat_frame, bg=BG)
        wrapper.pack(fill="x", padx=16, pady=(8, 4))

        bubble = tk.Label(
            wrapper, text=text, bg=USER_BUBBLE_BG, fg=FG,
            font=("Helvetica", 13), wraplength=500,
            justify="right", padx=14, pady=10,
            anchor="e",
        )
        bubble.pack(side="right")

    def _add_generating_indicator(self) -> tk.Frame:
        """Add a 'Generating...' indicator. Returns the frame for later removal."""
        wrapper = tk.Frame(self._chat_frame, bg=BG)
        wrapper.pack(fill="x", padx=16, pady=(4, 4))

        label = tk.Label(
            wrapper, text="Generating...", bg=BG, fg=ACCENT,
            font=("Helvetica", 12, "italic"),
        )
        label.pack(side="left")
        return wrapper

    def _add_sketch_message(self, dsl_code: str, label: str):
        """Add a sketch canvas inline in the chat area."""
        wrapper = tk.Frame(self._chat_frame, bg=BG)
        wrapper.pack(fill="x", padx=16, pady=(4, 12))

        inner = tk.Frame(wrapper, bg=SKETCH_BUBBLE_BG)
        inner.pack(side="left", fill="x")

        # Label
        tk.Label(
            inner, text=label, bg=SKETCH_BUBBLE_BG, fg=ACCENT,
            font=("Helvetica", 10, "bold"),
        ).pack(anchor="w", padx=12, pady=(8, 4))

        # Canvas
        canvas_frame = tk.Frame(inner, bg=CANVAS_BG, bd=1, relief="solid")
        canvas_frame.pack(padx=12, pady=(0, 8))

        sketch_canvas = tk.Canvas(canvas_frame, highlightthickness=0)
        sketch_canvas.pack()

        parsed = parse_dsl(dsl_code)
        elem_count = render_dsl_on_canvas(sketch_canvas, parsed)

        # Element count
        tk.Label(
            inner, text=f"{elem_count} elements",
            bg=SKETCH_BUBBLE_BG, fg=FG_DIM, font=("Helvetica", 9),
        ).pack(anchor="w", padx=12, pady=(0, 4))

        # DSL toggle
        dsl_visible = tk.BooleanVar(value=False)
        dsl_text = tk.Text(
            inner, bg=SURFACE, fg=FG_DIM,
            font=("Courier", 10), height=8, width=60,
            wrap="none", relief="flat", highlightthickness=0,
        )
        dsl_text.insert("1.0", dsl_code)
        dsl_text.config(state="disabled")

        def toggle_dsl():
            if dsl_visible.get():
                dsl_text.pack_forget()
                dsl_visible.set(False)
                toggle_btn.config(text="Show DSL")
            else:
                dsl_text.pack(padx=12, pady=(0, 8), fill="x")
                dsl_visible.set(True)
                toggle_btn.config(text="Hide DSL")

        toggle_btn = tk.Button(
            inner, text="Show DSL", bg=SURFACE, fg=FG_DIM,
            activeforeground=FG, activebackground=SURFACE,
            relief="flat", font=("Helvetica", 9),
            command=toggle_dsl, cursor="hand2",
        )
        toggle_btn.pack(anchor="w", padx=12, pady=(0, 8))

        self._set_status(f"Rendered {elem_count} elements")

    def _add_error_message(self, error: str):
        """Add an error message to the chat."""
        wrapper = tk.Frame(self._chat_frame, bg=BG)
        wrapper.pack(fill="x", padx=16, pady=(4, 8))

        label = tk.Label(
            wrapper, text=f"Error: {error}", bg=BG, fg="#e53935",
            font=("Helvetica", 11), wraplength=600, justify="left",
        )
        label.pack(side="left")

    # ── Event Handlers ───────────────────────────────────────────────────

    def _on_paste(self, event=None):
        """Cmd+V — check if clipboard has an image, save it and process."""
        import subprocess as sp
        import tempfile

        # Check if clipboard has image data (macOS)
        # Use osascript to check clipboard type
        try:
            result = sp.run(
                ["osascript", "-e", 'clipboard info'],
                capture_output=True, text=True, timeout=5
            )
            clipboard_info = result.stdout.strip()
        except Exception:
            return  # Let normal paste happen

        # If clipboard has image (TIFF, PNG, etc.)
        has_image = any(t in clipboard_info for t in ['«class PNGf»', '«class TIFF»', 'TIFF', 'PNGf', 'public.png', 'public.tiff'])

        if not has_image:
            return  # Let normal text paste happen (don't prevent default)

        # Save clipboard image to temp file using osascript + pngpaste or sips
        tmp_path = os.path.join("/tmp/voxi-creator", f"paste-{int(__import__('time').time())}.png")
        os.makedirs("/tmp/voxi-creator", exist_ok=True)

        try:
            # Try pngpaste first (brew install pngpaste)
            result = sp.run(["pngpaste", tmp_path], capture_output=True, timeout=5)
            if result.returncode != 0:
                # Fallback: use osascript to write clipboard image
                script = f'''
                    set theFile to POSIX file "{tmp_path}"
                    try
                        set imgData to the clipboard as «class PNGf»
                        set fileRef to open for access theFile with write permission
                        write imgData to fileRef
                        close access fileRef
                    on error
                        try
                            close access theFile
                        end try
                        error "No image on clipboard"
                    end try
                '''
                result = sp.run(["osascript", "-e", script], capture_output=True, text=True, timeout=5)
                if result.returncode != 0:
                    return  # No image, let normal paste happen
        except Exception:
            return

        if not os.path.exists(tmp_path):
            return

        # Got an image — show it and process
        self._add_image_message(tmp_path)
        self._scroll_to_bottom()

        extra = self._input_var.get().strip()
        self._input_var.set("")
        prompt = extra if extra else "Recreate this screenshot"

        self._set_status("Analyzing pasted screenshot...")
        indicator = self._add_generating_indicator()
        self._scroll_to_bottom()

        full_prompt = f"{prompt}\n\nImage: {tmp_path}"

        def on_success(dsl_code):
            self.after(0, lambda: self._handle_dsl_response(dsl_code, indicator))

        def on_error(msg):
            self.after(0, lambda: self._handle_error(msg, indicator))

        call_claude(full_prompt, on_success, on_error)

    def _on_attach(self):
        from tkinter import filedialog
        filetypes = [
            ("Images", "*.png *.jpg *.jpeg *.gif *.bmp *.webp"),
            ("All files", "*.*"),
        ]
        filepath = filedialog.askopenfilename(
            title="Attach Screenshot",
            filetypes=filetypes,
        )
        if not filepath:
            return

        # Show image in chat
        self._add_image_message(filepath)
        self._scroll_to_bottom()

        # Get optional prompt text
        extra = self._input_var.get().strip()
        self._input_var.set("")

        prompt = extra if extra else "Recreate this screenshot"

        self._set_status("Analyzing screenshot...")
        indicator = self._add_generating_indicator()
        self._scroll_to_bottom()

        full_prompt = f"{prompt}\n\nImage: {filepath}"

        def on_success(dsl_code):
            self.after(0, lambda: self._handle_dsl_response(dsl_code, indicator))

        def on_error(msg):
            self.after(0, lambda: self._handle_error(msg, indicator))

        call_claude(full_prompt, on_success, on_error)

    def _add_image_message(self, filepath: str):
        """Show an attached image in the chat."""
        wrapper = tk.Frame(self._chat_frame, bg=BG)
        wrapper.pack(fill="x", padx=16, pady=(8, 4))

        inner = tk.Frame(wrapper, bg=USER_BUBBLE_BG, padx=10, pady=10)
        inner.pack(side="right")

        # Load and resize image
        try:
            from tkinter import PhotoImage
            # Try to load with PIL if available, otherwise basic PhotoImage
            try:
                from PIL import Image, ImageTk
                img = Image.open(filepath)
                # Scale to max 400px wide
                max_w = 400
                if img.width > max_w:
                    ratio = max_w / img.width
                    img = img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)
                photo = ImageTk.PhotoImage(img)
            except ImportError:
                photo = PhotoImage(file=filepath)
                # Basic subsample for scaling
                w = photo.width()
                if w > 400:
                    factor = w // 400
                    if factor > 1:
                        photo = photo.subsample(factor)

            img_label = tk.Label(inner, image=photo, bg=USER_BUBBLE_BG)
            img_label.image = photo  # Keep reference
            img_label.pack()
        except Exception as e:
            tk.Label(inner, text=f"📎 {os.path.basename(filepath)}", bg=USER_BUBBLE_BG, fg=FG,
                     font=("Helvetica", 12)).pack()

        tk.Label(inner, text="Screenshot attached", bg=USER_BUBBLE_BG, fg=FG_DIM,
                 font=("Helvetica", 10)).pack(pady=(4, 0))

    def _on_send(self, event=None):
        text = self._input_var.get().strip()
        if not text:
            return

        self._input_var.set("")
        self._add_user_message(text)
        self._scroll_to_bottom()

        self._set_status("Generating...")
        indicator = self._add_generating_indicator()
        self._scroll_to_bottom()

        def on_success(dsl_code):
            self.after(0, lambda: self._handle_dsl_response(dsl_code, indicator))

        def on_error(msg):
            self.after(0, lambda: self._handle_error(msg, indicator))

        call_claude(text, on_success, on_error)

    def _handle_dsl_response(self, dsl_code: str, indicator: tk.Frame):
        indicator.destroy()

        self._sketch_counter += 1
        label = f"Sketch v{self._sketch_counter}"

        self._add_sketch_message(dsl_code, label)

        # Auto-save
        save_path = self._project_mgr.save_variation(self._current_project, dsl_code)
        self._set_status(f"Saved to {save_path}")
        self._refresh_sidebar()
        self._scroll_to_bottom()

    def _handle_error(self, msg: str, indicator: tk.Frame):
        indicator.destroy()
        self._add_error_message(msg)
        self._set_status("Error occurred")
        self._scroll_to_bottom()

    def _on_tree_select(self, event):
        selection = self._tree.selection()
        if not selection:
            return
        item_id = selection[0]
        parent = self._tree.parent(item_id)

        if parent:
            # It's a variation — load and render
            project = self._tree.item(parent, "text")
            variation = self._tree.item(item_id, "text")
            self._current_project = project
            dsl_code = self._project_mgr.load_variation(project, variation)
            if dsl_code:
                self._sketch_counter += 1
                label = f"Sketch v{self._sketch_counter}"
                self._add_sketch_message(dsl_code, label)
                self._scroll_to_bottom()
        else:
            # It's a project — just set as current
            self._current_project = self._tree.item(item_id, "text")
            self._set_status(f"Project: {self._current_project}")

    def _on_new_project(self):
        """Show a simple dialog for creating a new project."""
        dialog = tk.Toplevel(self)
        dialog.title("New Project")
        dialog.geometry("350x150")
        dialog.configure(bg=BG)
        dialog.transient(self)
        dialog.grab_set()

        tk.Label(
            dialog, text="Project Name:", bg=BG, fg=FG,
            font=("Helvetica", 12),
        ).pack(padx=16, pady=(16, 4), anchor="w")

        name_var = tk.StringVar()
        entry = tk.Entry(
            dialog, textvariable=name_var, bg=SURFACE, fg=FG,
            insertbackground=FG, relief="flat", font=("Helvetica", 13),
            highlightthickness=1, highlightcolor=ACCENT,
            highlightbackground=BORDER,
        )
        entry.pack(fill="x", padx=16, pady=(0, 12))
        entry.focus()

        def create():
            name = name_var.get().strip()
            if name:
                # Sanitize name for filesystem
                safe_name = re.sub(r"[^\w\-]", "-", name).lower()
                if self._project_mgr.create_project(safe_name):
                    self._current_project = safe_name
                    self._refresh_sidebar()
                    self._set_status(f"Created project: {safe_name}")
                else:
                    self._set_status(f"Project '{safe_name}' already exists")
            dialog.destroy()

        entry.bind("<Return>", lambda e: create())

        tk.Button(
            dialog, text="Create", bg=ACCENT, fg="#ffffff",
            activebackground="#5a7ae6", activeforeground="#ffffff",
            relief="flat", font=("Helvetica", 12, "bold"),
            padx=16, pady=4, command=create, cursor="hand2",
        ).pack(padx=16, pady=(0, 16))

    def _on_chat_frame_configure(self, event):
        self._chat_canvas.configure(scrollregion=self._chat_canvas.bbox("all"))

    def _on_chat_canvas_resize(self, event):
        self._chat_canvas.itemconfig(self._chat_canvas_window, width=event.width)

    def _on_mousewheel(self, event):
        if event.num == 4:
            self._chat_canvas.yview_scroll(-1, "units")
        elif event.num == 5:
            self._chat_canvas.yview_scroll(1, "units")
        else:
            # macOS
            self._chat_canvas.yview_scroll(-1 * event.delta, "units")

    # ── Helpers ──────────────────────────────────────────────────────────

    def _refresh_sidebar(self):
        self._tree.delete(*self._tree.get_children())
        for project in self._project_mgr.list_projects():
            proj_id = self._tree.insert("", "end", text=project, open=False)
            for var in self._project_mgr.list_variations(project):
                self._tree.insert(proj_id, "end", text=var)

    def _scroll_to_bottom(self):
        self.update_idletasks()
        self._chat_canvas.yview_moveto(1.0)

    def _set_status(self, text: str):
        self._status_var.set(text)


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = VoxiStudio()
    app.mainloop()
