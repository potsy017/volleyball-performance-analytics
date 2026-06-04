# Planned features (not yet implemented)

Documentation for client-facing capabilities under consideration. **None of the items below are in the current VPA build** — shared here so stakeholders can plan adoption (especially WHOOP linkage) before development.

---

## Readiness vs. Reality Discrepancy Matrix

### Concept overview

The **Readiness vs. Reality Matrix** is an advanced diagnostic module designed to identify **Central Nervous System (CNS) masking**. Algorithmic wearables (WHOOP) track autonomic recovery (resting HR, HRV, recovery score). An athlete can show **false high readiness** (“green”) after good sleep while the neuromuscular system is still mechanically fatigued.

By mapping **internal recovery** (WHOOP) against **objective hardware output** (GymAware peak velocity), the matrix exposes gaps between perceived readiness and physical performance — supporting load decisions and injury-risk conversations.

### Visual framework: 4-quadrant scatter plot

Interactive scatter plot with two reference thresholds:

| Axis | Metric | Threshold |
|------|--------|-----------|
| **X (internal state)** | WHOOP recovery % | **67%** (vertical line) |
| **Y (physical reality)** | GymAware peak velocity as **% of 30-day average** for the selected explosive exercise | **90%** (horizontal line — flags a ≥10% neuromuscular drop) |

#### Quadrant definitions

| Quadrant | State | Description & coaching action |
|----------|--------|------------------------------|
| **Top-right** | **Prime readiness** | High recovery + high velocity. Cleared for maximal court output and heavy compound lifting. |
| **Bottom-left** | **True fatigue** | Low recovery + low velocity. Biological and mechanical sensors agree — active recovery or rest. |
| **Top-left** | **Adrenaline masking** | Low recovery + high velocity. Under-recovered biologically but CNS still acute (e.g. post-match). Monitor closely. |
| **Bottom-right** | **CNS masking (danger zone)** | **High recovery + low velocity.** Wearable suggests readiness; hardware shows compromised neuromuscular output. **Mandatory load reduction.** |

### Data strategy & fallback hierarchy

Gym sessions are typically **1–2× per week**, so the pipeline would use an automated exercise priority to avoid empty charts:

1. **Primary:** Explosive lower-body triple-extension — prefer **Countermovement Jump (CMJ)** or **Trap Bar Jump** naming in GymAware (today’s data is dominated by `Deadlift (Trap Bar - Conc Jump)` / count-jump variants; alias merge already exists in `gymaware_exercises.py`).
2. **Secondary:** If no jump test that week, use the compound lift with highest volume/load on that date (e.g. back squat, trap-bar deadlift).
3. **Coach override:** Dropdown above the chart to pin a specific exercise.

**Join rule:** One point per **calendar date** where both SCORED WHOOP recovery and at least one GymAware session exist for that athlete (same-day assumption as the existing efficiency scatter).

### Planned UI/UX

- **Comet trail:** Most recent gym day = solid, bright marker; prior ~14 days fade (semi-transparent) to show fatigue trajectory over a block.
- **CNS warning tag:** When the latest point falls in **bottom-right (CNS masking)**, show a **`[ CNS Warning ]`** badge on the squad view (e.g. Readiness table or team snapshot) so staff do not over-trust a high recovery % alone.

### Feasibility on the current VPA stack

| Area | Assessment |
|------|------------|
| **Engineering** | **High** — Same pattern as `EfficiencyScatterChart` + `GET /dashboard/efficiency-scatter`; reference lines, zones, and `StatusBadge` already exist. Estimated MVP **~2–3 days** (API + chart + squad flag). |
| **WHOOP + GymAware overlap** | **Limited today** — Matrix points require **same-day** WHOOP recovery and GymAware data. Roster-wide WHOOP linkage is still sparse; most athletes will show an empty chart until devices are linked and ETL is current (expected, not a wiring failure). |
| **CMJ label in silver** | **No literal “CMJ”** exercise name in current exports; **trap-bar jump** variants are the practical primary metric until naming or VALD force-plate silver is added. |
| **Session density** | **Low frequency** — Expect handfuls of points per athlete per month (gym 1–2×/week), suitable for diagnostics not daily monitoring. |

### Optional future enhancement (not in initial spec)

When GymAware is absent on a date but **Catapult BMP max jump height** exists, Y-axis could fall back to % of 30-day jump ceiling (same logic as the injury-risk Triad). Product decision — initial spec is GymAware-only.

### Related implemented features

| Feature | Status | Doc |
|---------|--------|-----|
| Internal vs external efficiency (load vs strain) | **Shipped** | [CHARTS.md](CHARTS.md) |
| Performance radar (power vs 30d baseline) | **Shipped** | [CHARTS.md](CHARTS.md) |
| Readiness table (ACWR + recovery RAG) | **Shipped** | `/readiness` |
| Readiness vs reality matrix | **Planned** | This document |

---

## Handoff note for client conversations

- Value scales with **WHOOP adoption** and consistent **GymAware** jump or trap-bar test sessions.
- The matrix complements (does not replace) ACWR, Triad, and efficiency scatter — each answers a different masking or load question.
- No commitment date; prioritize after roster WHOOP coverage improves if squad-wide charts are required at launch.
