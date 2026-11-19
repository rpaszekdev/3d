# Spatial Reasoning DSL for LLM Cognition — Knowledge Base

> **Purpose**: Comprehensive reference for designing a 3D spatial language that enables
> faster, more efficient AI reasoning. Compiled from 35+ academic papers (1987-2025).
>
> **How to use**: Each chunk (## section) is self-contained. Navigate by chunk ID.
> Cross-references use `[→ CHUNK-ID]` format.

---

## TABLE OF CONTENTS

| Chunk ID | Title | Purpose |
|----------|-------|---------|
| CORE-01 | Core Thesis & Problem Statement | Why this language should exist |
| CORE-02 | The Token Bottleneck (Quantified) | Hard numbers on inefficiency |
| CORE-03 | Information Density: Text vs Spatial | Mathematical argument for spatial |
| THEORY-01 | Larkin & Simon Foundation | Why diagrams beat text (1987) |
| THEORY-02 | Cognitive Science of Sketching | How humans use sketches to think |
| THEORY-03 | Computational Limits of Sequential Tokens | Formal proofs on token limitations |
| LATENT-01 | Coconut: Chain of Continuous Thought | Full latent-space reasoning |
| LATENT-02 | JEPA: LeCun's Alternative Architecture | Prediction in embedding space |
| LATENT-03 | Quiet-STaR & Internal Reasoning | Silent thinking before speaking |
| LATENT-04 | Pause Tokens & Dot-by-Dot | Meaningless tokens that help reasoning |
| LATENT-05 | Diffusion of Thoughts | Non-sequential holistic reasoning |
| LATENT-06 | Implicit CoT & Reasoning Compression | Distilling reasoning into hidden states |
| LATENT-07 | Continuous Thought Machines | Variable-time continuous reasoning |
| SPATIAL-01 | Visualization-of-Thought (VoT) | Spatial intermediates in LLM reasoning |
| SPATIAL-02 | Whiteboard-of-Thought (WoT) | The draw-render-perceive loop |
| SPATIAL-03 | VisProg & ViperGPT | Visual programs as reasoning traces |
| SPATIAL-04 | Scene Graphs & 3D-LLM | Structured spatial representations |
| SPATIAL-05 | TikZ/SVG Generation | LLMs outputting spatial code |
| SPATIAL-06 | Layout Generation (LayoutGPT) | Spatial layouts as intermediates |
| SPATIAL-07 | Sketch-RNN & Generative Sketch Models | Neural sketch representations |
| SPATIAL-08 | tldraw & Sketch2Code | Practical sketch-to-AI interfaces |
| WORLD-01 | World Models (Ha & Schmidhuber) | Reasoning by simulation |
| WORLD-02 | DreamerV3 | Latent-space planning at scale |
| WORLD-03 | Mind's Eye & Simulation Grounding | Physics simulation for reasoning |
| EFFICIENCY-01 | CoT Verbosity Tax | 5-10x overhead of text reasoning |
| EFFICIENCY-02 | Unfaithful Explanations | CoT doesn't reflect real reasoning |
| EFFICIENCY-03 | Token-Free Models | ByT5, MEGABYTE, SpaceByte |
| EFFICIENCY-04 | Formal Representations > Natural Language | Code/logic beats prose for reasoning |
| DESIGN-01 | Design Principles (Extracted) | What the DSL must have |
| DESIGN-02 | Design Anti-Patterns | What to avoid |
| DESIGN-03 | Primitive Operations Catalog | Core operations the DSL needs |
| DESIGN-04 | The Whiteboard Loop Architecture | System-level integration pattern |
| DESIGN-05 | Comparison of Existing Spatial Languages | TikZ vs SVG vs Scene Graphs vs DSL |
| GAP-01 | Open Research Questions | What nobody has done yet |
| GAP-02 | Potential Contribution Space | Where original work lives |
| REF-01 | Complete Paper Index | All papers, sorted by relevance |
| REF-02 | Key Figures & Research Groups | Who to follow |

---

## CORE-01: Core Thesis & Problem Statement

### The Problem

Large Language Models reason by generating sequences of natural language tokens.
This is suboptimal because:

1. **Language evolved for communication between humans, not for computation.**
   It carries massive redundancy (articles, prepositions, filler) that wastes
   compute. Every token gets equal processing cost, whether it's "the" or the
   key insight.

2. **Spatial/structural information is compressed in space but exploded in text.**
   A simple diagram of "box containing a circle" takes 2 drawn shapes but ~30
   tokens to describe textually.

3. **Sequential left-to-right generation prevents parallel reasoning.**
   Text forces one thought path at a time. Continuous representations can hold
   multiple hypotheses simultaneously.

4. **Compositionality degrades beyond ~5 steps in text.**
   Formal proofs show transformers hit accuracy cliffs on multi-step reasoning
   when expressed as token sequences. [→ THEORY-03]

### The Thesis

A purpose-built spatial domain-specific language (DSL) could serve as an
intermediate reasoning representation for LLMs that:

- Encodes spatial relationships in fewer tokens than natural language
- Preserves structural information that text discards
- Enables the "whiteboard loop" (draw → render → perceive → reason)
- Is compilable/renderable for verification
- Bridges the gap between latent-space reasoning and human-interpretable output

### Supporting Evidence Strength

| Claim | Evidence Level | Key Papers |
|-------|---------------|------------|
| Text is inefficient for spatial reasoning | **Strong** (formal proofs + empirical) | Larkin & Simon 1987, BIG-bench 2022 |
| Latent reasoning works without tokens | **Strong** (multiple replications) | Coconut 2024, Implicit CoT 2024 |
| Spatial intermediates improve reasoning | **Strong** (multiple papers) | VoT 2024, WoT 2024, VisProg 2023 |
| A new DSL would outperform existing options | **Untested** (the research gap) | — |

---

## CORE-02: The Token Bottleneck (Quantified)

### Hard Numbers

| Metric | Value | Source |
|--------|-------|--------|
| CoT overhead vs direct answer | 5-10x more tokens | Wei et al. 2022 |
| Text vs diagram for geometry | 10-100x more tokens in text | GeoQA benchmarks |
| Image token info density vs text token | ~16x (one image patch ≈ 16 text tokens) | ViT (Dosovitskiy 2020) |
| CoT redundancy (distillation shows) | 60-80% of CoT tokens are redundant | Hsieh et al. 2023 |
| Compositional reasoning accuracy cliff | Sharp drop after 5 steps | Dziri et al. 2023 |
| Spatial description tax | A simple 2D layout: ~3 spatial primitives vs ~50 text tokens | Estimated from LayoutGPT |

### What This Means for DSL Design

If the DSL can express a spatial concept in N tokens where text needs 10N-100N tokens:
- **Fewer sequential generation steps** → lower latency
- **More reasoning fits in context window** → deeper reasoning possible
- **Less redundancy** → every token carries meaning
- **Structural fidelity** → no information lost in translation

### The "Dot by Dot" Revelation

Pfau et al. (2024) showed that replacing chain-of-thought text with literal dots
("...") still improves reasoning. This proves:

> **The model doesn't need the MEANING of reasoning tokens — it needs the COMPUTE
> STEPS.** A spatial DSL would give those compute steps meaningful spatial structure
> instead of wasting them on prose.

---

## CORE-03: Information Density: Text vs Spatial

### Larkin & Simon's Fundamental Insight (1987)

A 2D diagram encodes O(n²) relationships in O(n) space:
- Each element's POSITION implicitly defines its relationship to ALL other elements
- Text must enumerate each relationship explicitly: O(n²) tokens

### Example: 5 Objects in a Room

**Text representation** (~120 tokens):
```
There is a table in the center of the room. A chair is to the left of the
table and slightly behind it. A lamp stands in the far right corner. A rug
is under the table, extending slightly beyond it on all sides. A bookshelf
is against the back wall, centered behind the table.
```

**Spatial DSL representation** (~25 tokens):
```
room(10,10,3)
  table(5,5,0, 2x1x0.8)
  chair(3,4.5,0, 0.5x0.5x1)
  lamp(9,9,0, 0.3x0.3x1.5)
  rug(5,5,0, 3x2x0.01)
  shelf(5,9,0, 3x0.4x2)
```

**Compression ratio: ~5:1**

For complex scenes (20+ objects with relationships), the ratio grows to 10:1 or higher
because text must enumerate pairwise relationships while spatial positions encode them
implicitly.

### Information Types and Their Optimal Representations

| Information Type | Best Representation | Worst Representation |
|-----------------|-------------------|---------------------|
| Spatial position | Coordinates / visual | Natural language |
| Containment | Nesting / hierarchy | Natural language |
| Adjacency | Spatial proximity | Natural language |
| Sequential order | List / timeline | Comparable |
| Causal reasoning | Natural language | Spatial (weak) |
| Abstract logic | Formal notation | Spatial (poor fit) |
| Quantity comparison | Bar chart / numbers | Natural language |
| Flow/process | Directed graph | Natural language |

### Key Insight for DSL Design

The DSL should NOT try to replace natural language for everything. It should
target the specific information types where spatial representation has a 5-100x
advantage: position, containment, adjacency, proportion, and structural relationships.

---

## THEORY-01: Larkin & Simon Foundation

### Paper: "Why a Diagram is (Sometimes) Worth Ten Thousand Words"
- **Authors**: Jill H. Larkin, Herbert A. Simon
- **Year**: 1987
- **Venue**: Cognitive Science
- **Citations**: 5000+

### Core Arguments

1. **Computational Equivalence vs Informational Equivalence**
   Two representations can be informationally equivalent (contain the same info)
   but computationally different (one requires more steps to extract the info).
   Diagrams and text can be informationally equivalent but diagrams are often
   computationally superior.

2. **Perceptual Inference**
   Diagrams support "reading off" conclusions that require complex logical
   derivations in text. Example: "Is A between B and C?" is O(1) in a diagram
   (just look) but O(n) in text (must parse and reconstruct spatial model).

3. **Locality**
   Diagrams group related information spatially. In text, related information
   may be scattered across distant paragraphs. Spatial locality enables
   efficient search.

4. **Minimal Labeling**
   A diagram element serves as its own label — its position IS its identity.
   Text requires explicit naming and reference tracking.

### Implications for DSL

- The DSL should preserve **spatial locality** — related objects should be
  syntactically close
- Support **implicit relationships** through position (like diagrams) rather
  than requiring explicit enumeration (like text)
- Enable **O(1) perceptual queries** — "what's next to X?" should be answerable
  from the representation structure, not by parsing
- Minimize labeling overhead — position should carry meaning

---

## THEORY-02: Cognitive Science of Sketching

### Key Sources
- Buxton, "Sketching User Experiences" (2007)
- Tversky, "How Diagrams Aid Thinking" (2005)
- Kirsh, "Thinking with External Representations" (2010)

### Why Sketching Is Thinking (Not Just Recording)

1. **Externalization**: Sketching offloads spatial working memory, freeing
   cognitive resources for higher-level reasoning

2. **Productive Ambiguity**: Unlike formal languages, sketches tolerate
   imprecision. This is a FEATURE — it enables exploration without premature
   commitment. A rough circle means "roughly circular thing here" without
   specifying exact radius.

3. **Reinterpretation**: Sketchers often see new patterns in their own sketches
   that they didn't intend. The sketch becomes a stimulus for new ideas.

4. **Consistency Enforcement**: The spatial constraints of a sketch force
   consistency — you can't draw an object that is simultaneously left of
   and right of another object. Text has no such constraint.

5. **Incremental Refinement**: Sketches are naturally built up layer by layer,
   from rough to precise. This matches how reasoning often proceeds.

### Implications for DSL

| Sketch Property | DSL Design Implication |
|----------------|----------------------|
| Productive ambiguity | Support approximate values (`~5`, `near(table)`) |
| Externalization | DSL output should be renderable (visual feedback) |
| Reinterpretation | Support multiple valid readings of same spec |
| Consistency | Spatial constraints should be enforceable |
| Incremental refinement | Support progressive detail (`rough` → `precise` modes) |

---

## THEORY-03: Computational Limits of Sequential Tokens

### Paper: "The Expressive Power of Transformers with Chain of Thought"
- **Authors**: William Merrill, Ashish Sabharwal (Allen AI)
- **Year**: 2024

### Formal Results

- **Without CoT**: Transformers are limited to the complexity class TC⁰
  (constant-depth threshold circuits). This means they CANNOT solve problems
  requiring sequential multi-step reasoning in a single forward pass.

- **With polynomial-length CoT**: Transformers can solve problems in P
  (polynomial time). The CoT tokens provide the sequential "tape" needed for
  multi-step computation.

- **Critical insight**: CoT tokens function as **computation steps**, not as
  **communication**. Their linguistic content is secondary to their role as
  intermediate hidden states.

### Paper: "Faith and Fate: Limits of Transformers on Compositionality"
- **Authors**: Dziri et al. (Allen AI)
- **Year**: 2023

### Key Finding

Compositional reasoning accuracy drops sharply after 5 reasoning steps.
This is tied to the **sequential, left-to-right generation constraint** —
each token must be generated before the next, with no ability to revise
earlier tokens based on later insights.

### Paper: "Thinking Like Transformers"
- **Authors**: Weiss, Goldberg, Yahav
- **Year**: 2021

### Key Finding

The autoregressive left-to-right constraint limits the computational graph.
Certain reasoning patterns (bidirectional, graph-structured, parallel
hypothesis evaluation) are **structurally impossible** in sequential
token generation.

### Implications for DSL

1. The DSL should provide **structured computation slots** — each token
   is a meaningful reasoning step, not filler
2. Consider **non-sequential** syntax — allow references to earlier/later
   elements (like a scene graph, not a paragraph)
3. Design for **compositionality** — the DSL should support deep nesting
   without the accuracy degradation seen in text CoT
4. If possible, support **parallel specification** — multiple independent
   spatial facts in a single "step"

---

## LATENT-01: Coconut — Chain of Continuous Thought

### Paper Details
- **Title**: "Training Large Language Models to Reason in a Continuous Latent Space"
- **Authors**: Shibo Hao, Sainbayar Sukhbaatar, DiJia Su, Xian Li, Zhiting Hu,
  Jason Weston, Yuandong Tian
- **Affiliation**: Meta FAIR, UC San Diego
- **Year**: 2024 (December)
- **ArXiv**: 2412.06769

### How It Works

1. Special `<bot>` (beginning of thought) and `<eot>` (end of thought) tokens
   bracket latent reasoning steps
2. During these steps, NO tokens are generated
3. The last hidden state of each thought step feeds back as input embedding
   for the next step
4. Model "thinks" entirely in continuous vector space

### Training Method

Curriculum-based:
1. Train on standard chain-of-thought first
2. Progressively replace text reasoning tokens with continuous latent thoughts
3. Replacement goes from LAST reasoning steps backward (preserving early
   framing in text)

### Key Results

| Task | Standard CoT | Coconut | Improvement |
|------|-------------|---------|-------------|
| ProntoQA (logic) | Baseline | Matches or exceeds | Fewer tokens |
| ProsQA (logic) | Baseline | Significantly better | BFS-like behavior |
| GSM8K (math) | Baseline | Comparable | Fewer steps |

### Critical Finding: BFS-Like Reasoning

Continuous latent representations can encode an **implicit breadth-first search**:
- Multiple reasoning paths maintained simultaneously as superpositions in
  the continuous state
- Text-based CoT is forced into a single serial path (DFS-like)
- This is fundamentally impossible in discrete token space

### Implications for DSL

- The DSL occupies a **middle ground** between fully continuous (Coconut) and
  fully textual (standard CoT)
- A spatial DSL could capture some BFS-like properties through **parallel
  specification** — describing multiple spatial configurations simultaneously
- The DSL could serve as a **human-interpretable bridge** between latent
  reasoning and text output
- Consider designing the DSL so it maps efficiently to/from continuous
  representations (e.g., each primitive has a clean embedding)

---

## LATENT-02: JEPA — LeCun's Alternative Architecture

### Paper Details
- **Title**: "A Path Towards Autonomous Machine Intelligence"
- **Author**: Yann LeCun
- **Affiliation**: Meta / NYU
- **Year**: 2022 (Position paper)

### Core Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  Perception  │────▶│  World Model │────▶│  Actor   │
│  (encoder)   │     │  (latent     │     │  (output │
│              │     │   predictor) │     │   policy)│
└──────────────┘     └──────────────┘     └──────────┘
                           │
                     ┌─────┴──────┐
                     │ Cost Module│
                     │ (evaluator)│
                     └────────────┘
```

### LeCun's Five Arguments Against Token-Based Reasoning

1. **"Autoregressive prediction is exponentially wasteful"**
   Token space grows exponentially. Most sequences are meaningless.
   Latent space is compact and continuous.

2. **"Language is a lossy, low-bandwidth channel"**
   Human thought is richer than words. Forcing AI to reason through
   language discards high-dimensional structure.

3. **"Every token gets equal compute"**
   Predicting "the" costs the same as predicting the key insight.
   Wasteful allocation of computation.

4. **"LLMs cannot plan"**
   Left-to-right generation cannot search or backtrack without
   explicitly writing out all alternatives.

5. **"Prediction should happen in representation space"**
   JEPA predicts abstract representations, not specific tokens.
   This avoids modeling irrelevant details.

### Experimental Implementations

| System | Year | Domain | Result |
|--------|------|--------|--------|
| I-JEPA | 2023 | Images | Strong representations without pixel prediction |
| V-JEPA | 2024 | Video | Temporal reasoning in latent space |

### Implications for DSL

- The DSL should be **lossy by design** for irrelevant details but
  **precise for spatial relationships**
- Consider **variable-resolution** specifications (coarse to fine)
- The DSL is essentially creating a structured "representation space"
  that sits between raw text and raw latent vectors
- LeCun's critique suggests the DSL should minimize redundant tokens
  (no articles, minimal syntax sugar)

---

## LATENT-03: Quiet-STaR & Internal Reasoning

### Paper Details
- **Title**: "Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking"
- **Authors**: Eric Zelikman, Georges Harik, Yijia Shao, Varuna Jayasiri,
  Nick Haber, Noah D. Goodman
- **Affiliation**: Stanford University
- **Year**: 2024
- **ArXiv**: 2403.09629

### Mechanism

1. At every token position, model generates internal "thought" tokens
2. A learned **mixing head** blends thought-augmented prediction with
   direct prediction
3. Thoughts are generated but **never shown** in output
4. The model learns WHEN thinking helps (some positions benefit, others don't)

### Results

| Model | Task | Before Quiet-STaR | After | Improvement |
|-------|------|-------------------|-------|-------------|
| Mistral 7B | GSM8K | 5.9% | 10.9% | +85% |
| Mistral 7B | CommonsenseQA | 36.3% | 47.2% | +30% |

### Key Insight

The model benefits from **thinking before committing to output**.
This is analogous to a human sketching rough ideas before presenting
a final design. The internal thoughts don't need to be polished prose —
they just need to help the model make better predictions.

### Implications for DSL

- The DSL could serve as an "internal sketch language" — rough, fast,
  not meant for human consumption
- A "thinking DSL" doesn't need to be pretty — it needs to be
  **computationally useful**
- The mixing head concept is relevant: sometimes spatial thinking helps,
  sometimes text is fine. The system should switch modalities dynamically.

---

## LATENT-04: Pause Tokens & Dot-by-Dot

### Paper 1: Pause Tokens
- **Title**: "Think before you speak: Training Language Models With Pause Tokens"
- **Authors**: Goyal, Ji, Rawat, Menon, Kumar, Nagarajan
- **Affiliation**: Google Research, Carnegie Mellon
- **Year**: 2023

### Paper 2: Dot by Dot
- **Title**: "Let's Think Dot by Dot: Hidden Computation in Transformer Language Models"
- **Authors**: Jacob Pfau, William Merrill, Samuel R. Bowman
- **Year**: 2024

### Combined Findings

**Pause Tokens**: Appending M meaningless `<pause>` tokens after the input
gives the model extra forward passes before producing an answer. This
improves reasoning accuracy on SQuAD and GSM8K.

**Dot by Dot**: Filler tokens like "..." enable computations that are
**provably impossible** in a single forward pass. The tokens carry
ZERO semantic content — their value is purely computational.

### The Profound Implication

> If meaningless tokens improve reasoning, then the content of reasoning
> tokens is secondary to their COUNT. The model uses tokens as compute
> slots, not as meaningful language.

### What This Means for DSL Design

This is perhaps the strongest argument FOR a spatial DSL:

1. If the model needs N compute steps, those steps might as well carry
   **meaningful spatial information** instead of meaningless dots
2. Each spatial primitive in the DSL serves double duty:
   - **Computational**: provides a forward pass for deeper reasoning
   - **Informational**: encodes actual spatial structure
3. The DSL should be designed so that **every token is both a compute step
   AND a meaningful spatial specification**

---

## LATENT-05: Diffusion of Thoughts

### Paper Details
- **Title**: "Diffusion of Thoughts: Chain-of-Thought Reasoning in Diffusion Language Models"
- **Authors**: Jiacheng Ye, Shansan Gong, Liheng Chen, Lin Zheng, et al.
- **Year**: 2024
- **ArXiv**: 2402.07754

### How It Works

Instead of generating reasoning tokens left-to-right:
1. The entire reasoning chain is initialized as noise
2. Iterative denoising gradually reveals the full chain
3. All parts of the chain are refined simultaneously
4. Earlier parts can be revised based on later discoveries

### Key Advantage: Non-Sequential Reasoning

```
Standard CoT (autoregressive):
  Step 1 → Step 2 → Step 3 → Step 4
  (cannot revise Step 1 after generating Step 3)

Diffusion of Thoughts:
  [noise] → [rough outline] → [refined chain] → [final]
  (all steps refined simultaneously, earlier steps updated by later insights)
```

### Implications for DSL

- The DSL could be designed for **iterative refinement** rather than
  sequential specification
- Support "rough draft" spatial specs that get progressively refined
- Allow **forward references** — an object's position can be constrained
  by something specified later
- Consider a **constraint-based** rather than imperative syntax:
  instead of "place X at (3,4)", say "X is near Y and above Z"
  and let the system resolve positions

---

## LATENT-06: Implicit CoT & Reasoning Compression

### Paper Details
- **Title**: "Implicit Chain of Thought Reasoning via Knowledge Distillation"
- **Authors**: Yuntian Deng, Kiran Prasad, Roland Fernandez, Paul Smolensky,
  Vishrav Chaudhary, Stuart Shieber
- **Affiliation**: Harvard, Microsoft Research
- **Year**: 2024
- **ArXiv**: 2311.01460

### How It Works

1. **Teacher model** generates explicit chain-of-thought reasoning
2. **Student model** is trained to produce correct answers WITHOUT generating
   intermediate reasoning tokens
3. The student learns to compress multi-step reasoning into its hidden states
4. Same accuracy, dramatically fewer output tokens

### What This Proves

Explicit textual reasoning can be **fully internalized**. The natural
language format is not necessary for the reasoning — it was only necessary
for training (showing the model what reasoning looks like).

### Related: Compressed Chain of Thought (Cheng & Van Durme, 2024)

Replaces verbose natural language CoT with dense vector representations.
Same accuracy, far fewer tokens. Most CoT tokens are proven **redundant**.

### Related: Distilling Step-by-Step (Hsieh et al., 2023)

Smaller models can match larger models' reasoning by distilling
reasoning traces. The compressed version retains most capability,
suggesting **60-80% of CoT tokens carry no essential information**.

### Implications for DSL

- The DSL should be **maximally compressed** — no token should be
  redundant
- If 60-80% of natural language reasoning is redundant, a well-designed
  DSL achieving 5:1 compression is realistic
- The DSL could serve as the **intermediate training representation**:
  train on spatial specs, then distill into hidden states
- Design the DSL to have a **clean mapping to continuous representations**
  so distillation is straightforward

---

## LATENT-07: Continuous Thought Machines

### Paper Details
- **Title**: "Continuous Thought Machines"
- **Authors**: Sachin Goyal, Peter Hartog, et al. (Google DeepMind)
- **Year**: 2025

### Core Idea

Instead of discrete layer-by-layer forward passes:
- Neural ODE-inspired continuous dynamics for hidden states
- The model "thinks" for a variable amount of continuous time
- Harder problems automatically get more computation
- Reasoning depth is NOT fixed by architecture

### Key Advance Over Previous Work

| Approach | Compute Allocation |
|----------|-------------------|
| Standard transformer | Fixed (number of layers) |
| Pause tokens | Fixed (number of pause tokens chosen at inference) |
| Coconut | Fixed (number of latent thought steps) |
| Continuous Thought | **Variable** (adapts to problem difficulty) |

### Implications for DSL

- The DSL should support **variable granularity** — some spatial specs
  need high detail, others need minimal
- Consider **adaptive depth**: simple spatial relationships get terse
  expression, complex ones get verbose expression
- The DSL grammar should allow natural expansion/contraction of detail
  level without changing the core structure

---

## SPATIAL-01: Visualization-of-Thought (VoT)

### Paper Details
- **Title**: "Visualization-of-Thought Elicits Spatial Reasoning in Large Language Models"
- **Authors**: Wenshan Wu, Shaoguang Mao, Yadong Zhang, et al.
- **Affiliation**: Microsoft Research
- **Year**: 2024

### THIS IS THE MOST DIRECTLY RELEVANT PAPER

### How It Works

LLMs generate spatial visualizations as intermediate reasoning steps:
- ASCII art grids
- Coordinate systems
- Spatial layouts

These serve as "working memory" for spatial information during reasoning.

### Example: Navigation Task

```
Standard CoT:
"I start facing north. I turn right, so now I face east. I walk 3 steps.
I turn left, so now I face north. I walk 2 steps..."
(Error-prone after 5+ steps)

VoT:
"My path:
. . . . .
. . X . .    X = current position
. . | . .    | = path taken
. . +---→    → = facing direction
. . . . .
"
(Visual working memory prevents errors)
```

### Results

Significant improvement on:
- Natural language navigation tasks
- Geometric reasoning
- Spatial relationship questions

### Key Finding

> The spatial visualization FORCES the model to commit to a concrete
> spatial layout, reducing ambiguity. Text descriptions of spatial
> arrangements are inherently ambiguous; visualizations are not.

### Implications for DSL

This paper is the **proof of concept** for the DSL idea:

1. LLMs already benefit from spatial intermediate representations
2. ASCII art is crude — a proper DSL would be far more expressive
3. The DSL should be designed as a **reasoning aid**, not just an
   output format
4. Coordinate-based representations work — the DSL should be
   coordinate-native
5. Grid/cell-based spatial discretization is effective for LLM reasoning

---

## SPATIAL-02: Whiteboard-of-Thought (WoT)

### Paper Details
- **Title**: "Whiteboard-of-Thought: Thinking Step-by-Step Across Modalities"
- **Authors**: Sachit Menon, Richard Zemel, Carl Vondrick
- **Affiliation**: Columbia University
- **Year**: 2024

### The Whiteboard Loop

```
┌─────────────────────────────────────────────────────┐
│                  THE WHITEBOARD LOOP                  │
│                                                       │
│   1. LLM reasons in text                             │
│      ↓                                                │
│   2. LLM generates code that draws (matplotlib, etc) │
│      ↓                                                │
│   3. Code executes → produces image                   │
│      ↓                                                │
│   4. Multimodal LLM reads the image back              │
│      ↓                                                │
│   5. LLM reasons further, informed by visual          │
│      ↓                                                │
│   (repeat as needed)                                  │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Why This Works

- **Externalization**: The drawing offloads spatial working memory
- **Verification**: The model can check its own spatial reasoning visually
- **Reinterpretation**: The model may notice patterns in its drawing
  it didn't explicitly plan
- **Grounding**: Abstract spatial descriptions become concrete visual
  representations

### Results

Significant improvements on:
- ASCII art understanding
- Spatial reasoning tasks
- Visual pattern recognition

### Implications for DSL

The DSL should be designed to enable an efficient whiteboard loop:

1. **Fast rendering**: DSL → visual must be nearly instant
2. **Round-trippable**: visual → DSL parsing should also be possible
3. **Incrementally buildable**: the loop is iterative, so the DSL
   should support adding detail to existing specs
4. **Code-like**: WoT uses Python code to generate drawings; the DSL
   should be similarly executable
5. **Lightweight**: the loop may execute many times, so DSL parsing
   and rendering must be fast

---

## SPATIAL-03: VisProg & ViperGPT

### VisProg
- **Title**: "Visual Programming for Compositional Visual Reasoning"
- **Authors**: Tanmay Gupta, Aniruddha Kembhavi (AI2)
- **Year**: 2023 (CVPR)

### ViperGPT
- **Title**: "Visual Inference via Python Execution for Reasoning"
- **Authors**: Dídac Surís, Sachit Menon, Carl Vondrick
- **Year**: 2023 (ICCV)

### Core Idea

Instead of reasoning about visual/spatial content in natural language,
the LLM generates a **program** — a sequence of modular operations
(detect, classify, crop, measure, compare) executed on the input.

### VisProg Example

```python
# "Is the dog to the left of the cat?"
img = INPUT(image)
dog_box = LOC(img, "dog")        # detect dog
cat_box = LOC(img, "cat")        # detect cat
result = LEFT_OF(dog_box, cat_box)  # spatial comparison
ANSWER(result)
```

### Why Programs Beat Prose

1. **Unambiguous**: Programs have precise semantics
2. **Composable**: Operations chain cleanly
3. **Debuggable**: Each step can be inspected
4. **Spatial-native**: Operations like `LEFT_OF`, `INSIDE`, `ABOVE`
   are first-class citizens
5. **Zero-shot capable**: New spatial questions can be answered by
   composing existing primitives

### Implications for DSL

The DSL should borrow from programming language design:

- **First-class spatial operations** as primitives
- **Composability** through nesting and chaining
- **Clear semantics** — no ambiguity about what each primitive means
- **Executable** — the DSL should run, not just describe
- Consider a **functional style**: spatial queries as function
  compositions rather than imperative steps

---

## SPATIAL-04: Scene Graphs & 3D-LLM

### Scene Graphs

Scene graphs represent visual scenes as directed graphs:
- **Nodes** = objects (with attributes: type, color, size)
- **Edges** = relationships (spatial, semantic, functional)

```
[table] --on_top_of--> [floor]
[cup]   --on_top_of--> [table]
[cup]   --left_of-->   [plate]
[plate] --on_top_of--> [table]
```

### Key Papers
- Visual Genome (Krishna et al., 2017)
- Scene Graph Generation (Xu et al., 2017)
- Unbiased SGG (Tang et al., 2020)

### 3D-LLM
- **Authors**: Yining Hong, Haoyu Zhen, Peihao Chen, et al.
- **Year**: 2023 (NeurIPS)

Integrates 3D point cloud representations directly into LLMs.
Enables spatial reasoning about 3D scenes (navigation, object
relationships, spatial questions).

### SpatialVLM
- **Authors**: Boyuan Chen, Zhuo Xu, Sean Kirmani, et al. (DeepMind)
- **Year**: 2024

Standard VLMs **fail** at precise spatial reasoning. Explicit spatial
training data is required. Language alone is insufficient.

### Implications for DSL

Scene graphs offer a proven spatial representation format:

1. **Graph structure** works for spatial relationships
2. **Node-edge representation** is compact and queryable
3. **Typed edges** (spatial, semantic) allow rich relationships
4. Consider whether the DSL should be **graph-based** rather than
   purely coordinate-based
5. A hybrid approach (coordinates + relational edges) may be optimal:
   coordinates for precise placement, edges for semantic relationships

---

## SPATIAL-05: TikZ/SVG Generation

### DaTikZ / AutomaTikZ
- **Authors**: Jonas Belouadi, Simone Palazzo, et al.
- **Year**: 2023-2024
- **Summary**: Large dataset of TikZ drawings from arXiv; LLMs fine-tuned
  for TikZ diagram generation

### StarVector (SVG Generation)
- **Authors**: Rodriguez et al.
- **Year**: 2024
- **Summary**: Generates SVG code from images or text descriptions

### TikZ as Spatial Language

```tikz
\begin{tikzpicture}
  \draw (0,0) rectangle (4,3);          % room
  \filldraw[blue] (2,1.5) circle (0.5); % object
  \draw[->] (2,1.5) -- (3.5,2.5);      % relationship
  \node at (2,0.3) {table};
\end{tikzpicture}
```

**Pros**: Formal, compilable, rich ecosystem, LLMs already know it
**Cons**: Verbose syntax, 2D only, designed for publication graphics
not spatial reasoning, many tokens for simple shapes

### SVG as Spatial Language

```svg
<svg width="400" height="300">
  <rect x="0" y="0" width="400" height="300" fill="none" stroke="black"/>
  <circle cx="200" cy="150" r="50" fill="blue"/>
  <line x1="200" y1="150" x2="350" y2="250" stroke="red"/>
</svg>
```

**Pros**: Web-native, renderable everywhere, composable
**Cons**: XML verbosity, 2D only, no semantic meaning (just shapes)

### Implications for DSL

The DSL should improve on existing spatial languages:

| Feature | TikZ | SVG | Target DSL |
|---------|------|-----|-----------|
| Dimensions | 2D (2.5D possible) | 2D | **3D native** |
| Verbosity | High | High (XML) | **Minimal** |
| Semantics | None (just shapes) | None | **Spatial relationships** |
| Renderability | LaTeX pipeline | Browser | **Fast, lightweight** |
| LLM familiarity | High (arXiv data) | High (web data) | Needs training |
| Composability | Medium | Medium | **High (functional)** |

---

## SPATIAL-06: Layout Generation (LayoutGPT)

### Paper Details
- **Title**: "LayoutGPT: Compositional Visual Planning and Generation with
  Large Language Models"
- **Authors**: Weixi Feng et al.
- **Year**: 2023

### How It Works

LLMs generate structured spatial layouts as intermediate representations:

```json
{
  "objects": [
    {"type": "sofa", "x": 2.0, "y": 1.0, "w": 2.5, "h": 1.0, "rotation": 0},
    {"type": "table", "x": 2.5, "y": 2.5, "w": 1.0, "h": 0.6, "rotation": 0},
    {"type": "tv", "x": 2.0, "y": 4.0, "w": 1.5, "h": 0.1, "rotation": 0}
  ]
}
```

### Key Finding

LLMs have **emergent spatial layout capabilities** — they can generate
reasonable spatial arrangements from text descriptions, even without
explicit spatial training.

### Implication

The DSL doesn't need to invent spatial cognition from scratch — LLMs
already have it. The DSL just needs to give it a better output format
than natural language.

---

## SPATIAL-07: Sketch-RNN & Generative Sketch Models

### Paper Details
- **Title**: "A Neural Representation of Sketch Drawings"
- **Authors**: David Ha, Douglas Eck (Google Brain)
- **Year**: 2017

### How It Works

Represents sketches as sequences of pen strokes:
```
(Δx, Δy, pen_down, pen_up, end_of_sketch)
```

Each stroke is a 5-dimensional vector. A complete sketch is a sequence
of these vectors.

### Learned Latent Space

Sketch-RNN learns a latent space where:
- Similar concepts are nearby
- Interpolation produces meaningful transitions
- Spatial structure is captured as temporal sequence

### CLIPDraw (Frans et al., 2022)

Uses CLIP guidance to generate sketches from text:
- Sketch = minimal, compressed spatial representation
- Captures essential structure, discards detail
- Bridges text ↔ spatial representation

### Implications for DSL

- Strokes/curves as primitives (not just shapes)
- A DSL could support **stroke-level** AND **shape-level** abstractions
- The latent space property is desirable: DSL specifications that are
  "close" in representation should describe "close" spatial arrangements

---

## SPATIAL-08: tldraw & Sketch2Code

### tldraw "Make Real"
- **Creators**: Steve Ruiz and tldraw team
- **Year**: 2023-2024

Users draw rough UI sketches on a canvas → GPT-4V converts to
working HTML/CSS code. Demonstrates that:
- Spatial sketch input is faster than text descriptions
- AI can parse freehand spatial layouts
- Ambiguity in sketches is resolved contextually

### Sketch2Code (Microsoft AI Lab, 2018)

Hand-drawn wireframes → HTML code using computer vision.
Even crude sketches contain sufficient structural information.

### Implications for DSL

- The DSL should support **freehand-quality input** (approximate positions)
- Consider bidirectional: **DSL → visual** AND **visual → DSL**
- The system should **resolve ambiguity** rather than requiring precision

---

## WORLD-01: World Models (Ha & Schmidhuber)

### Paper Details
- **Title**: "World Models"
- **Authors**: David Ha, Jurgen Schmidhuber
- **Year**: 2018

### Core Idea

An agent learns a compressed model of its environment and reasons by
**dreaming** — simulating future states internally without real interaction.

```
Real World → Encoder → Latent World Model → Decoder → Predictions
                            ↕
                      Planning/Reasoning
                  (happens in latent space)
```

### Why This Matters for DSL Design

The world model IS a spatial reasoning engine:
- It represents space as a learned continuous model
- It reasons by simulating spatial dynamics
- It's massively more efficient than textual reasoning about space

The DSL could serve as a **human-readable interface to a spatial world model**:
- DSL spec → initialize world model state
- World model simulation → DSL output (what changed?)
- Human reads DSL output → understands spatial reasoning result

---

## WORLD-02: DreamerV3

### Paper Details
- **Title**: "Mastering Diverse Domains through World Models"
- **Authors**: Danijar Hafner, Jurgis Pasukonis, Jimmy Ba, Timothy Lillicrap
- **Year**: 2023 (Google DeepMind)

### Achievement

Human-level Minecraft diamond collection through purely **imagined**
reasoning in latent space. No text, no explicit symbolic reasoning —
just latent state simulation.

### Implication

Complex spatial planning (navigate cave, find diamond, craft tools)
can happen entirely in latent representations. Text is not needed.
The DSL could be the **readable summary** of what the latent model computed.

---

## WORLD-03: Mind's Eye & Simulation Grounding

### Paper Details
- **Title**: "Mind's Eye: Grounded Language Model Reasoning Through Simulation"
- **Authors**: Ruibo Liu, Jason Wei, Shixiang Shane Gu, et al. (Google)
- **Year**: 2022

### How It Works

1. LLM receives a physics reasoning question
2. LLM generates code to set up a physics simulation (MuJoCo)
3. Simulation runs → produces result
4. LLM interprets simulation result → produces answer

### Key Insight

The LLM's role shifts from **doing** spatial reasoning to **specifying**
spatial scenarios. The actual reasoning is offloaded to a spatial engine.

### Implications for DSL

- The DSL could serve as the **specification language** between an LLM
  and a spatial reasoning engine
- LLM writes DSL → Engine simulates → Results returned as DSL
- This is essentially the "whiteboard loop" [→ SPATIAL-02] with a
  simulation engine instead of a renderer

---

## EFFICIENCY-01: CoT Verbosity Tax

### Key Data Points

| Finding | Source | Number |
|---------|--------|--------|
| CoT costs 5-10x more tokens | Wei et al. 2022 | 5-10x |
| Verification adds more overhead | Lightman et al. 2023 | Additional 2-3x |
| 60-80% of CoT is redundant | Hsieh et al. 2023 | 60-80% waste |
| Geometry text vs diagram | GeoQA benchmarks | 10-100x difference |
| Spatial scene descriptions | Estimated from LayoutGPT | ~5:1 text:spatial |

### The Compounding Problem

```
Simple task:      CoT ≈ 2x tokens (manageable)
Medium task:      CoT ≈ 5x tokens (significant)
Complex spatial:  CoT ≈ 10-100x tokens (prohibitive)
Multi-step + verification: CoT ≈ 20-300x tokens (impractical)
```

### Implication

For complex spatial reasoning tasks, the verbosity tax makes
text-based reasoning **impractical at scale**. A spatial DSL with
5-10x compression would bring these tasks back into the feasible range.

---

## EFFICIENCY-02: Unfaithful Explanations

### Paper Details
- **Title**: "Language Models Don't Always Say What They Think"
- **Authors**: Miles Turpin, Julian Michael, Ethan Perez, Samuel R. Bowman
- **Year**: 2024

### Key Finding

Chain-of-thought explanations often **don't reflect the model's actual
reasoning process**. Models produce plausible-sounding but unfaithful
reasoning chains.

### Paper: "Reasoning or Reciting?"
- **Authors**: Zhaofeng Wu et al. (MIT)
- **Year**: 2023

Under counterfactual conditions, LLM "reasoning" collapses — suggesting
text CoT often masks **pattern-matching** as reasoning.

### Implication for DSL

If text-based CoT doesn't faithfully represent reasoning, then:
1. We lose nothing by switching to a different representation
2. A spatial DSL that is **executable/verifiable** is strictly better
   because we can CHECK whether the spatial reasoning is correct
3. The DSL serves as a **ground truth** for spatial reasoning
   (positions are unambiguous, unlike text descriptions)

---

## EFFICIENCY-03: Token-Free Models

### Models That Bypass Tokenization

| Model | Authors | Year | Approach | Result |
|-------|---------|------|----------|--------|
| ByT5 | Xue et al. (Google) | 2022 | Byte-level T5 | Matches T5, more robust |
| MEGABYTE | Yu et al. (Meta) | 2023 | Hierarchical bytes | Competitive, flexible |
| SpaceByte | Slagle | 2024 | Multi-scale bytes | Closes gap with tokenized |
| Mamba | Gu & Dao | 2023 | State space model | Linear-time, continuous state |

### Implication

Tokenization is an **engineering convenience**, not a cognitive necessity.
The DSL should not be constrained by tokenizer-friendly design —
if byte-level models become standard, the DSL can use any character set
and syntax that maximizes spatial expressiveness.

---

## EFFICIENCY-04: Formal Representations > Natural Language

### Consistent Finding Across Multiple Papers (2024)

When LLMs use formal representations (code, logic, mathematical notation)
instead of natural language for intermediate reasoning steps:
- Accuracy improves
- Token usage decreases
- Results are verifiable

### Relevant Systems

- **Toolformer** (Schick et al., Meta, 2023): Offloading to tools beats
  pure language reasoning
- **Program-aided Language Models** (Gao et al., 2023): Python code for
  math reasoning outperforms text CoT
- **Searchformer** (Wang et al., 2024): Formal search traces beat natural
  language planning descriptions

### Implication

The DSL should be a **formal language**, not a simplified natural language.
Formal syntax with precise semantics beats "English-like" descriptions
for reasoning tasks.

---

## DESIGN-01: Design Principles (Extracted from All Papers)

### PRINCIPLE 1: Maximum Information Density
Every token must carry spatial meaning. No articles, no filler.
**Source**: Larkin & Simon 1987, CoT compression research

### PRINCIPLE 2: Coordinate-Native
Positions expressed as numeric coordinates, not relative descriptions.
**Source**: VoT 2024, LayoutGPT 2023

### PRINCIPLE 3: 3D Native
Three-dimensional from the ground up, not 2D with Z bolted on.
**Source**: 3D-LLM 2023, gap in existing tools

### PRINCIPLE 4: Composable Primitives
Small set of primitives that combine to express complex scenes.
**Source**: VisProg 2023, ViperGPT 2023, DreamCoder 2021

### PRINCIPLE 5: Executable/Renderable
Every DSL expression must compile to a visual representation.
**Source**: WoT 2024, Mind's Eye 2022

### PRINCIPLE 6: Approximate Values Welcome
Support fuzzy positioning (`~5`, `near(X)`, `above(Y)`).
**Source**: Cognitive science of sketching (Buxton 2007)

### PRINCIPLE 7: Implicit Relationships via Position
Object position should implicitly encode spatial relationships
without explicit enumeration.
**Source**: Larkin & Simon 1987

### PRINCIPLE 8: Variable Granularity
Support rough sketches AND precise specifications in the same language.
**Source**: Continuous Thought Machines 2025, sketch literature

### PRINCIPLE 9: Non-Sequential Support
Allow references forward/backward; support constraint-based placement.
**Source**: Diffusion of Thoughts 2024, THEORY-03

### PRINCIPLE 10: Minimal Syntax Overhead
Brackets, keywords, delimiters should be minimized.
Every structural token is a "wasted" compute step. [→ LATENT-04]
**Source**: Pause tokens / Dot-by-Dot research

---

## DESIGN-02: Design Anti-Patterns

### ANTI-PATTERN 1: Natural Language Syntax
```
BAD:  "Place a large red cube at position three comma five comma two"
GOOD: cube(3,5,2, s=L, c=red)
```
Natural language adds 5-10x tokens with zero additional information.

### ANTI-PATTERN 2: Verbose Relationship Enumeration
```
BAD:  cube1 is_left_of cube2; cube1 is_below sphere1; cube2 is_near sphere1
GOOD: cube1(1,0,0) cube2(3,0,0) sphere1(2,0,2)
      # Relationships are IMPLICIT from coordinates
```

### ANTI-PATTERN 3: Rigid Precision Requirements
```
BAD:  circle(3.14159, 2.71828, 1.41421)  # Forced precision
GOOD: circle(~3, ~3, ~1.5)                # Appropriate precision
```

### ANTI-PATTERN 4: 2D With Z Afterthought
```
BAD:  rect(10, 20, width=5, height=3, z_index=2, depth=4)
GOOD: box(10, 20, 2, 5x3x4)
```

### ANTI-PATTERN 5: Excessive Nesting
```
BAD:  scene { layer { group { transform { object { ... } } } } }
GOOD: scene > object(pos, transform)
```

### ANTI-PATTERN 6: Requiring Complete Specification
```
BAD:  Must specify: position, rotation, scale, color, material, physics...
GOOD: Defaults for everything; only specify what matters
      box(5,5,0)  # All other properties use sensible defaults
```

---

## DESIGN-03: Primitive Operations Catalog

### Core Spatial Primitives

```
# Objects
point(x,y,z)                    # 0D
line(x1,y1,z1 → x2,y2,z2)     # 1D
plane(x,y,z, nx,ny,nz)         # 2D surface
box(x,y,z, w,h,d)              # 3D volume
sphere(x,y,z, r)               # 3D volume
mesh(vertices, faces)           # Arbitrary 3D
```

### Spatial Relationships (Implicit + Explicit)

```
# Implicit (from coordinates)
A(1,0,0) B(3,0,0)              # A is left of B (implicit)

# Explicit (when precision matters less than semantics)
A near B                        # Fuzzy proximity
A above B                       # Relative position
A inside B                      # Containment
A between B C                   # Betweenness
A facing B                      # Orientation
```

### Transformations

```
move(obj, Δx, Δy, Δz)          # Translation
rotate(obj, axis, angle)        # Rotation
scale(obj, factor)              # Uniform scale
mirror(obj, plane)              # Reflection
```

### Composition

```
group(obj1, obj2, ...)          # Logical grouping
align(obj1, obj2, axis)         # Alignment constraint
distribute(objs, axis, spacing) # Even distribution
array(obj, nx, ny, nz, spacing) # Repetition pattern
```

### Queries (for the whiteboard loop)

```
distance(A, B)                  # Spatial query
contains?(A, B)                 # Containment test
visible?(A, from=camera)        # Visibility test
intersects?(A, B)               # Collision test
nearest(point, objects)         # Proximity query
```

---

## DESIGN-04: The Whiteboard Loop Architecture

### Full System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     REASONING SYSTEM                         │
│                                                               │
│  ┌─────────┐     ┌──────────┐     ┌──────────────┐          │
│  │   LLM   │────▶│ DSL Gen  │────▶│  DSL Parser  │          │
│  │(reasoning│     │(spatial  │     │  & Validator  │          │
│  │ engine)  │     │ output)  │     └──────┬───────┘          │
│  └────▲─────┘     └──────────┘            │                   │
│       │                                    │                   │
│       │           ┌──────────┐     ┌──────▼───────┐          │
│       │           │ DSL desc │     │   Renderer   │          │
│       └───────────│ of scene │◀────│  (3D engine) │          │
│                   │ (updated)│     └──────┬───────┘          │
│                   └──────────┘            │                   │
│                                    ┌──────▼───────┐          │
│                                    │  Visual      │          │
│                                    │  Output      │          │
│                                    │  (image/3D)  │          │
│                                    └──────────────┘          │
│                                                               │
│  LOOP: LLM generates DSL → Render → LLM perceives →         │
│        LLM refines DSL → Render → ... until done             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Loop Timing Requirements

| Step | Target Latency | Why |
|------|---------------|-----|
| DSL generation | ~100ms/token (standard LLM speed) | Can't be faster than model |
| DSL parsing | <10ms | Must not bottleneck the loop |
| Validation | <10ms | Quick constraint checking |
| Rendering | <50ms | Fast visual feedback |
| Visual perception | ~100ms (if multimodal) | Model forward pass |
| **Full loop iteration** | **<500ms** | Must feel interactive |

### Integration Points

The DSL interfaces with:
1. **LLM reasoning engine**: DSL as output format for spatial reasoning
2. **3D renderer**: DSL as scene description for visualization
3. **Multimodal model**: Rendered image as input for next reasoning step
4. **Physics engine**: DSL as initial conditions for simulation [→ WORLD-03]
5. **Code generators**: DSL as intermediate representation for UI/3D code

---

## DESIGN-05: Comparison of Existing Spatial Languages

| Feature | TikZ | SVG | USD/glTF | Scene Graph | Proposed DSL |
|---------|------|-----|----------|-------------|-------------|
| **Dimensions** | 2D | 2D | 3D | Abstract | **3D** |
| **Tokens per simple scene** | ~80 | ~60 | ~200 | ~30 | **~15-20** |
| **Semantic meaning** | None | None | Material/physics | Relationships | **Both** |
| **Approximate values** | No | No | No | Yes (types) | **Yes** |
| **LLM familiarity** | High | High | Low | Medium | **Needs training** |
| **Renderability** | LaTeX | Browser | 3D viewers | Needs engine | **Built-in** |
| **Composability** | Medium | Medium | High | High | **High** |
| **Human readable** | Medium | Low | Low | High | **High** |
| **Designed for reasoning** | No | No | No | Partially | **Yes** |
| **Constraint support** | No | No | No | Yes | **Yes** |
| **Incremental updates** | Hard | Medium | Medium | Easy | **Easy** |

### Key Takeaway

No existing spatial language was designed for LLM reasoning efficiency.
Each was designed for a different purpose (publication, web display,
3D interchange, knowledge representation). The proposed DSL would be
the first language designed specifically as a **reasoning substrate**.

---

## GAP-01: Open Research Questions

### Q1: What is the optimal token vocabulary for spatial reasoning?
Should primitives be single tokens or multi-token? Should coordinates
use digit tokens or special number tokens?
**Status**: No research exists on tokenizer design for spatial DSLs.

### Q2: Can LLMs be fine-tuned to "think in" a spatial DSL?
Coconut showed latent reasoning works. Can a DSL serve as a structured
intermediate representation that maps cleanly to latent space?
**Status**: Unexplored. Would require training experiments.

### Q3: What is the right balance between precision and ambiguity?
Too precise → brittle, many tokens. Too ambiguous → unusable for reasoning.
Where is the sweet spot?
**Status**: Cognitive science suggests ambiguity for exploration,
precision for execution. No AI-specific research.

### Q4: How does 3D spatial reasoning differ from 2D for LLMs?
Most research uses 2D. Does adding a third dimension linearly increase
difficulty or is there a qualitative jump?
**Status**: 3D-LLM (2023) is the closest work but doesn't address
this question directly.

### Q5: Can a spatial DSL serve as training data for better spatial reasoning?
Could generating a large corpus of DSL specifications and corresponding
spatial arrangements teach LLMs to reason spatially?
**Status**: Analogous to code pre-training improving reasoning (proven
for Python, unexplored for spatial DSLs).

### Q6: What is the minimum set of primitives?
How few primitives can express the majority of useful spatial scenarios?
Is there a "spatial Pareto frontier"?
**Status**: DreamCoder (2021) addresses this for LOGO but not for general
3D spatial reasoning.

### Q7: How should the DSL handle time/animation?
Static spatial reasoning is one thing; dynamic spatial reasoning (movement,
physics, temporal change) adds complexity.
**Status**: World models research handles dynamics but not through a DSL.

---

## GAP-02: Potential Contribution Space

### Where Original Work Would Live

```
ESTABLISHED                          YOUR CONTRIBUTION SPACE
─────────────                        ─────────────────────────
Coconut (latent reasoning)    →→→    DSL as structured bridge between
                                     latent and symbolic reasoning

VoT/WoT (spatial intermediates) →→→  Purpose-built DSL replacing ad-hoc
                                     ASCII art / matplotlib code

VisProg (visual programs)     →→→    Spatial DSL as the programming
                                     language for visual reasoning

3D-LLM (3D understanding)    →→→    DSL as I/O format for 3D spatial
                                     reasoning in LLMs

Larkin & Simon (theory)       →→→    Formal evaluation of DSL vs text
                                     information density for AI reasoning

Sketch-RNN (neural sketches)  →→→    DSL with learnable latent space
                                     mapping (sketch ↔ latent ↔ DSL)
```

### Potential Paper Titles

1. "SpatialScript: A Domain-Specific Language for LLM Spatial Reasoning"
2. "Thinking in Three Dimensions: Spatial DSLs as Reasoning Substrates for LLMs"
3. "Beyond Chain-of-Thought: Spatial Intermediate Representations for Efficient Reasoning"
4. "The Whiteboard Protocol: Iterative Spatial Reasoning with Renderable DSLs"

---

## REF-01: Complete Paper Index

### Tier 1: Must-Read (Directly relevant)

| # | Paper | Authors | Year | ArXiv/Venue |
|---|-------|---------|------|-------------|
| 1 | Coconut: Chain of Continuous Thought | Hao et al. | 2024 | 2412.06769 |
| 2 | Visualization-of-Thought | Wu et al. | 2024 | Microsoft Research |
| 3 | Whiteboard-of-Thought | Menon et al. | 2024 | Columbia |
| 4 | Why a Diagram is Worth 10K Words | Larkin & Simon | 1987 | Cognitive Science |
| 5 | A Path Towards Autonomous Machine Intelligence | LeCun | 2022 | Position paper |
| 6 | Let's Think Dot by Dot | Pfau et al. | 2024 | — |
| 7 | Expressive Power of Transformers with CoT | Merrill & Sabharwal | 2024 | Allen AI |
| 8 | VisProg | Gupta & Kembhavi | 2023 | CVPR 2023 |

### Tier 2: Important Context

| # | Paper | Authors | Year | ArXiv/Venue |
|---|-------|---------|------|-------------|
| 9 | Quiet-STaR | Zelikman et al. | 2024 | 2403.09629 |
| 10 | Pause Tokens | Goyal et al. | 2023 | 2310.02226 |
| 11 | Diffusion of Thoughts | Ye et al. | 2024 | 2402.07754 |
| 12 | Implicit CoT via Distillation | Deng et al. | 2024 | 2311.01460 |
| 13 | ViperGPT | Surís et al. | 2023 | ICCV 2023 |
| 14 | 3D-LLM | Hong et al. | 2023 | NeurIPS 2023 |
| 15 | SpatialVLM | Chen et al. | 2024 | DeepMind |
| 16 | LayoutGPT | Feng et al. | 2023 | — |
| 17 | DreamerV3 | Hafner et al. | 2023 | DeepMind |
| 18 | Faith and Fate | Dziri et al. | 2023 | Allen AI |
| 19 | Continuous Thought Machines | Goyal et al. | 2025 | DeepMind |
| 20 | Mind's Eye | Liu et al. | 2022 | Google |

### Tier 3: Supporting Evidence

| # | Paper | Authors | Year | ArXiv/Venue |
|---|-------|---------|------|-------------|
| 21 | World Models | Ha & Schmidhuber | 2018 | — |
| 22 | Sketch-RNN | Ha & Eck | 2017 | Google Brain |
| 23 | DreamCoder | Ellis et al. | 2021 | PLDI |
| 24 | BIG-bench | Collaboration | 2022 | — |
| 25 | DaTikZ / AutomaTikZ | Belouadi et al. | 2023-24 | — |
| 26 | StarVector (SVG) | Rodriguez et al. | 2024 | — |
| 27 | Unfaithful Explanations | Turpin et al. | 2024 | — |
| 28 | Reasoning or Reciting | Wu et al. | 2023 | MIT |
| 29 | Toolformer | Schick et al. | 2023 | Meta AI |
| 30 | ByT5 | Xue et al. | 2022 | Google |
| 31 | MEGABYTE | Yu et al. | 2023 | Meta AI |
| 32 | SpaceByte | Slagle | 2024 | — |
| 33 | Mamba | Gu & Dao | 2023 | — |
| 34 | CoT Prompting | Wei et al. | 2022 | Google Brain |
| 35 | Distilling Step-by-Step | Hsieh et al. | 2023 | — |
| 36 | PaLM-E | Driess et al. | 2023 | Google |
| 37 | Genie | Bruce et al. | 2024 | DeepMind |
| 38 | I-JEPA | Assran et al. | 2023 | CVPR 2023 |
| 39 | V-JEPA | Bardes et al. | 2024 | Meta AI |
| 40 | Compressed Chain of Thought | Cheng & Van Durme | 2024 | — |

---

## REF-02: Key Figures & Research Groups

### People to Follow

| Person | Affiliation | Relevance |
|--------|-------------|-----------|
| **Yann LeCun** | Meta / NYU | JEPA, anti-autoregressive arguments |
| **Jason Weston** | Meta FAIR | Coconut, reasoning research |
| **Eric Zelikman** | Stanford | Quiet-STaR, STaR |
| **Carl Vondrick** | Columbia | WoT, ViperGPT |
| **Aniruddha Kembhavi** | AI2 | VisProg, visual reasoning |
| **Danijar Hafner** | DeepMind | DreamerV3, world models |
| **David Ha** | Stability AI (prev. Google) | World Models, Sketch-RNN |
| **William Merrill** | Allen AI | Formal analysis of transformer reasoning |
| **Samuel Bowman** | NYU | Reasoning analysis, Dot by Dot |

### Research Groups

| Group | Focus | Key Work |
|-------|-------|----------|
| **Meta FAIR** | Latent reasoning, JEPA | Coconut, I-JEPA, V-JEPA |
| **Stanford NLP** | Internal reasoning | Quiet-STaR, STaR |
| **Allen AI (AI2)** | Visual reasoning, formal analysis | VisProg, Faith and Fate |
| **Columbia Vision Lab** | Spatial reasoning | WoT, ViperGPT |
| **Google DeepMind** | World models, continuous reasoning | DreamerV3, Genie, CTM |
| **Microsoft Research** | Visualization-of-Thought | VoT |

---

*Knowledge base compiled: March 2026*
*Sources: 40 academic papers spanning 1987-2025*
*Purpose: Foundation for designing a 3D spatial reasoning DSL for LLM cognition*
