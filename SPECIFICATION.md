# System Specification Document: Post-Tonal Serial Workstation

> **Revision 4.** There are **no scales** — only series **length** *N*. A series is simply *N*
> pitch classes, each freely chosen from the 24-EDO space (`0 … 23`, quarter-tones included),
> with optional repeats. All serial operations run in **absolute 24-EDO space (mod 24)**; the
> earlier scale-degree / Scalar-Preserving layer is removed. Any pitch may be **quarter-tone
> inflected**. Both matrix modes support **optional repetition** (strict non-repetition is a
> toggle, off by default). The duration engine uses a **palette + permutation** model
> (value-inversion of durations removed); **rests** split into **structural** (silent durations)
> and **stochastic** (density thinning with a min-voices floor) mechanisms; and every series
> input can be **entered manually or generated with a seeded, constraint-respecting Randomize**
> control (§1.4).

## 0. Functional & Conceptual Description of the Application

### 0.1 System Purpose

The Post-Tonal Serial Workstation is a specialized computational environment for the
analysis, generation, and algorithmic composition of serial music. It unifies four
avant-garde traditions that historically remained largely segregated:

- **Schoenbergian Dodecaphony:** Classical matrix-based permutation of pitch classes (P, I,
  R, RI). Strict non-repetition is available as an option but is **not imposed** — the engine
  does not assume twelve-tone equal temperament. *(The 12×12 "matrix" is a modern pedagogical
  device rather than Schoenberg's own tool, but the P/I/R/RI operations it encodes are
  authentic.)*
- **Stravinskyan Rotational Serialism:** Hexachord/segment **rotational arrays** (after
  Krenek), in which each rotation is transposed back to the segment's original starting pitch,
  and new harmony is drawn from the resulting verticals. Repetition is permitted.
- **Boulezian Total Serialism:** Extension of serial ordering onto the temporal domain via a
  **duration palette** whose deployment order is permuted by the serial operations, coupling
  pitch and rhythm into one integral structure.
- **Wyschnegradsky Quarter-Tone Microtonality:** A full 24-tone Quarter-Tone Equal Division
  of the Octave (24-EDO) as the pitch substrate. *(Partch is intentionally not cited: his
  system was 43-tone just intonation, philosophically opposed to equal temperament.)*

### 0.2 Operational Workflow

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│   1. Vector Input &    │ ───> │  2. Matrix Generation  │ ───> │  3. Macro-Algorithmic  │
│   Tuning Normalization │      │   & Domain Coupling    │      │    Quartet Assembly    │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

1. **Vector Input & Tuning Normalization.** The user chooses a series **length** *N* and defines
   a primary series of *N* pitch classes — **entered manually or generated with one-click
   Randomize** (§1.4). Inputs are normalized to absolute 24-EDO pitch classes (`0 … 23`); any
   pitch may be quarter-tone inflected.
2. **Matrix Generation & Domain Coupling.** The series expands into an *N × N* matrix via
   classical inversion (Schoenberg) or rotational shifting (Stravinsky), computed in **absolute
   24-EDO space (mod 24)**. A parallel duration structure is either coupled to the pitch matrix
   or generated independently.
3. **Macro-Algorithmic Quartet Assembly.** Structural vectors are extracted (rows, columns,
   diagonals, or stochastic walks) and fed to a scheduler that renders to real-time 24-EDO
   audio or to **MusicXML** (quarter-tones via `<alter>`), constrained by the ranges and
   voice-leading safeguards of a string quartet.

## 1. Core Pitch Architecture & Tuning Space

### 1.1 Pitch Space

**Absolute pitch space (24-EDO).** Every pitch is an integer in a modulo-24 space, `0 … 23`,
where even integers are the twelve chromatic semitones (0 = C, 2 = C♯/D♭, 4 = D, …) and odd
integers are the quarter-tones between them (1 = C quarter-sharp, 3 = C three-quarter-sharp =
D quarter-flat, …). All serial arithmetic and all frequencies live here (§5).

**A series is just length + pitches.** There are **no scales or modes**. A **Series** of length
*N* is an ordered list of *N* pitch classes, **each independently chosen from the full 24-EDO
set** `0 … 23` (semitone or quarter-tone), with repeats permitted (§2.3). Length *N* fixes only
*how many* notes the series has, never *which* ones. All transposition, inversion, and rotation
are computed on these absolute pitch classes **mod 24**; absolute pitch is mapped to a specific
octave/register only at render time (§4.3).

### 1.2 Pitch Input Transformation Modes

Inputs are normalized to an absolute pitch class (`0 … 23`):

- **Full 24-EDO Mode:** inputs are entered directly on the `0 … 23` set (quarter-tones are
  simply the odd values).
- **12-Tone Hybrid Mode:** accepts standard 12-EDO inputs (`0 … 11`, C = 0) plus a discrete
  microtonal modifier per node — `+0.5` (quarter-sharp), `0` (natural), `−0.5` (quarter-flat):

  $$\text{Absolute pitch class} = (\text{12-EDO semitone} \times 2) + (\text{Modifier} \times 2) \pmod{24}$$

  (e.g. C♯ quarter-sharp = `1×2 + 0.5×2 = 3`.)

**Universal quarter-tone inflection.** Any individual pitch of *any* series, regardless of
length *N*, may be a quarter tone: in Full 24-EDO Mode by entering an odd value directly, and in
12-Tone Hybrid Mode via the `±0.5` modifier on any node. No pitch position is restricted to
semitones.

### 1.3 Series Length (*N*)

The only structural choice is the length. Valid lengths:

$$N \in \{5, 6, 7, 8, 9, 10, 11, 12, 24\}$$

Each of the *N* positions holds any pitch class in `0 … 23`, chosen independently, with repeats
allowed by default (§2.3). Lengths are not tied to any collection: a length-5 series is *any*
five 24-EDO pitches, a length-7 series *any* seven, and so on. The familiar cases fall out as
special configurations rather than built-in scales — e.g. a strict (repeat-free) length-12
series of the even values is a classical twelve-tone chromatic row, and a strict length-24
series is a full quarter-tone aggregate — but neither is required or assumed.

### 1.4 Series Input Modality: Manual or Randomized

Every series- or vector-valued input in the system — the **primary pitch series** and the
**duration palette/seed** (§3.1) — is populated through the *same dual control*. For each, the
user may **enter the values manually**, or press **Randomize** to have the engine synthesize a
valid series on demand. This choice is guaranteed at *every* such input; the two paths are
composable — Randomize fills the editable field, after which the user may hand-edit any element.

**Constraint-respecting randomization.** Randomize always yields output valid under the
parameters currently in effect:

- **Length** = the selected *N*.
- **Pitch range** = the full 24-EDO space (`0 … 23`) by default. An optional **semitones-only**
  toggle restricts draws to the even (12-EDO) values; leaving it off allows quarter-tones.
- **Repetition** = obeys the Strict Serialism flag (§2.3): with strict **on** it samples
  *without replacement* (all distinct — requires the allowed range to hold ≥ *N* values); with
  strict **off**, repeats are allowed.
- **Duration randomization** draws multipliers within a user-set min/max (default `1 … N`) and
  may randomly flag slots silent up to a chosen silent-slot budget (§3.1, §4.4).

**Reproducibility.** Randomize accepts an optional integer **seed**; the same seed plus the same
parameters regenerates an identical series, so random material can be recalled, versioned, or
shared.

## 2. Permutation & Matrix Generation Engine

All arithmetic below is on **absolute pitch classes, mod 24**. `P` denotes a series of *N* pitch
classes.

### 2.1 Mode A: Schoenberg Matrix Generator (*N × N*)

Classical dodecaphonic operations, applied to a series of any length.

**Inversion vector (I₀),** anchored so `I₀[0] = P₀[0]`:

$$I_0[i] = (2\,P_0[0] - P_0[i]) \pmod{24}$$

**Transposition** of a row by `t`: `(P[i] + t) mod 24`.

**Grid compilation.** Row *y* is `P₀` transposed so its first pitch equals `I₀[y]`. Because
`I₀[0] = P₀[0]`, **row 0 is exactly the user's series**, the main diagonal is constant
(`= P₀[0]`), the leftmost column spells I₀, and column reads are true inversions of row reads
(see §5).

**Repetition.** Repeated pitch classes are permitted by default. See §2.3.

### 2.2 Mode B: Stravinsky Rotational Array Generator

Segment rotation after Krenek/Stravinsky, on absolute pitch classes (mod 24).

**Grid compilation.** For a primary series `P` of length *N*:

- **Row 0:** the series `P`.
- **Row k:** left-rotate `P` by *k* places (first *k* elements wrap to the tail), then
  transpose the rotated series so its new index-0 pitch equals the original `P[0]`.

Harmony is drawn from the columns (verticals). Repetition is permitted.

> **Historical note & generalization.** Stravinsky rotated the two **hexachords** of a
> twelve-tone row independently (paired 6×6 arrays). Applying rotation to a single length-*N*
> series is a deliberate generalization; for hexachordal behaviour at N=12, run the generator
> on each 6-note half.

### 2.3 Repetition & Validation

- **Strict Serialism flag (default OFF).** When **off**, both modes accept series containing
  repeated pitch classes — the engine imposes no twelve-tone or aggregate requirement. When
  **on**, Mode A rejects any series with a duplicated pitch class (classical repetition-free
  rows); this is offered purely for composers who want dodecaphonic rigor.
- With repeats allowed, rows and columns may contain duplicate entries; the P/I/R/RI arithmetic
  is unaffected. The only property forfeited is aggregate/combinatorial completeness.
- Pitch identity is resolved on the *absolute* 24-EDO value (after quarter-tone inflection), so
  `C` and `C-quarter-sharp` are distinct pitches.

## 3. Rhythmic Serialization Engine (Boulez Logic)

Durations are **not** transformed as values (a duration has no meaningful "inversion"). Instead
rhythm is modeled as a fixed **duration palette** whose *deployment order* is permuted by the
same serial operations used for pitch — the procedure Boulez used in *Structures Ia*.

### 3.1 The Duration Palette

An ordered set of *N* durations, each an integer multiple of a user-defined atomic time unit
`t₀` (e.g. a 16th or 32nd note).

- **Default palette:** `1, 2, 3, … , N` units ("chromatic durations," after Messiaen).
- **User palette:** any *N* positive multipliers, in any order — **entered manually or produced
  by Randomize** (§1.4), which draws within a user-set min/max and may seed silent slots.
- **Silent slots:** any palette entry may be flagged **silent**, making it a *rest* of that
  length rather than a sounding note (§4.4). This is how structural silence enters the fabric.

### 3.2 Duration Deployment Modes

```
                  ┌─── [ Integral / Boulez ] ─> Pitch-matrix permutation orders the palette
[ Duration Mode ] ┤
                  └─── [ Independent ] ───────> Palette permuted by its own rotational array
```

- **Integral (Boulez) coupling.** A pitch vector extracted from the matrix carries an *order of
  index positions*; that same order is applied to the duration palette. "Retrograde rhythm" =
  the palette read in the order of the retrograde pitch vector; "inverted rhythm" = the order
  given by the inverted vector. The durations themselves never change — only their sequence —
  which is exactly what makes the operation meaningful.
- **Independent.** The duration palette is permuted by its **own rotational (Stravinsky)
  array**, since cyclic rotation *is* a meaningful rhythmic transform. Two additional native
  transforms are available: **Retrograde** (reverse the sequence) and **Augmentation /
  Diminution** (scale every duration by a constant factor). The Schoenberg inversion generator
  is **not** used on durations.

### 3.3 Structural Playback Paradigms

- **Pitch-Only:** pitch sequences over a static, uniform rhythm.
- **Duration-Only:** rhythm sequences on a single fixed pitch.
- **Integral Serialism (Boulez Mode):** pitch matrix and duration deployment read in lockstep;
  each event adopts the frequency of the active pitch cell and the length of the corresponding
  palette entry.

## 4. Algorithmic Piece Generator (String Quartet Module)

A macro-arranger feeding vectors into four parts mapped to a standard string quartet
(Violin I, Violin II, Viola, Cello).

### 4.1 Global Structural Parameters

- **Tempo:** 40–240 BPM.
- **Meter Processing:**
  - **Static Mode:** a fixed, user-chosen time signature.
  - **Variable Mode:** derived from the duration stream. For each measure the engine sums the
    duration multipliers assigned to it; the sum (in `t₀` units) is the numerator and the
    atomic unit is the denominator. *(t₀ = 16th note, cells summing to 7 → 7/16.)* A
    `Max Measure Length` cap may split an oversized sum across consecutive measures.
- **Length Boundary:** total measure count, specified before generation.

### 4.2 The Determinism Axis

A control `d ∈ [0%, 100%]` governs vector extraction.

| Determinism `d` | Extraction logic | Voice allocation |
|---|---|---|
| **100% (Strict)** | Linearly exhausts standard matrix paths. | Queues of P, I, R, RI assigned to distinct instruments. |
| **1–99% (Hybrid)** | Per step, follow the systematic path with prob. `d`; else deviate. | Voices read related blocks from opposing vectors (rows vs. columns). |
| **0% (Stochastic)** | Cell choice decoupled from linear vectors. | Each instrument does an independent adjacent-cell random walk. |

**Hybrid algorithm.** For `0 < d < 1`, at each step draw uniform `r ∈ [0,1)`: if `r < d`, emit
the next cell of the voice's queued systematic vector and advance its pointer; otherwise emit a
**constrained deviation** — a one-step walk to an adjacent cell within the current block, after
which the systematic pointer resumes from the nearest position. `d = 1` reduces to Strict,
`d = 0` to Stochastic.

### 4.3 Voice Architecture, Register Mapping & Physical Safeguards

```
[High Register]  Violin I   (Preferred: C5 – E7)
                 Violin II  (Preferred: G3 – A5)
                 Viola      (Preferred: C3 – E5)
[Low Register]   Cello      (Preferred: C2 – G4)
```

Bands respect each instrument's real open-string floor (Violin G3, Viola C3, Cello C2) and
practical ceilings; overlap is intentional and idiomatic.

**Pitch → register.** A matrix cell is an absolute 24-EDO pitch class. A **Registral Dispersion**
parameter `D_reg ∈ [0.0, 1.0]` assigns the octave ("how jumpy"):

- `D_reg = 0.0` — **smooth:** octave chosen to minimize the leap from the previous note in the
  voice.
- `D_reg = 1.0` — **dispersed:** pitch class mapped linearly across the instrument's range, so
  it alone fixes the octave (matrix-faithful, jumpy).
- Intermediate: `octave = round((1 − D_reg)·octave_smooth + D_reg·octave_linear)`.

Result is clamped to the preferred range, then the absolute range if needed.

**Voice-leading optimization.** When active, a melodic leap greater than one octave triggers
octave transposition to keep the interval within registral bounds (relaxed at high `D_reg`).

### 4.4 Rests

Two orthogonal, stackable mechanisms:

- **Structural silence (deterministic).** Silent duration-palette slots (§3.1) — and,
  optionally, a reserved **rest token** placed directly in a series — propagate through
  P/I/R/RI/rotation like any other element, so composed silence is part of the serial
  structure.
- **Stochastic thinning (texture).** A `Rest Probability ∈ [0%, 100%]` is evaluated *after*
  extraction: each emitted event becomes a rest with that probability. To prevent the texture
  from collapsing, a **Min-Sounding-Voices floor** guards each vertical attack — the engine
  will not silence a voice if doing so would drop the number of sounding voices below the
  floor. **Default floor = 1** (never accidental total silence; set to 0 to permit it, 2+ for
  denser counterpoint).

### 4.5 Export

- **Real-time audio:** direct 24-EDO synthesis (§5).
- **Score / interchange:** **MusicXML.** Quarter-tones are encoded per `<note>` via
  `<pitch><alter>` in half-step fractions — `<alter>0.5</alter>` (quarter-sharp),
  `<alter>-0.5</alter>` (quarter-flat) — with matching `<accidental>` elements
  (`quarter-sharp`, `quarter-flat`) for engraving. Rests export as `<rest>` with the
  corresponding duration. This is lossless for microtonal notation, unlike plain MIDI.

## 5. Vector Traversal Paths

The engine reads the *N × N* matrices along six pathways (absolute pitch classes throughout):

- **Prime (Pᵧ):** row *y*, left to right (`0 → N−1`).
- **Retrograde (Rᵧ):** row *y*, right to left (`N−1 → 0`).
- **Inversion (Iₓ):** column *x*, top to bottom (`0 → N−1`).
- **Retrograde-Inversion (RIₓ):** column *x*, bottom to top (`N−1 → 0`).
- **Downward diagonal:** `(0,0) → (N−1, N−1)`.
- **Upward diagonal:** `(0, N−1) → (N−1, 0)`.

> **Scope of the P/I/R/RI labels.** These serial identities hold **only for the Mode A
> (Schoenberg) matrix**, where columns are genuine inversions of rows. In the Mode B
> (Stravinsky) rotational array the columns are rotational *verticals*; for Mode B, read these
> paths as neutral geometry (row-forward, row-back, column-down, column-up, diagonals) and do
> **not** label them I/RI.

**Frequency output.** Each traversed pitch class is placed in a register (§4.3), yielding a
quarter-tone step count `k` relative to A₄ = 440 Hz:

$$f = 440 \times 2^{\frac{k}{24}}$$
