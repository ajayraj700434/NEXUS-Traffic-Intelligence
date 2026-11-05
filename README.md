# NEXUS — Adaptive Traffic Intelligence
## AI-Based Adaptive Traffic Signal Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-cyan.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-5.x-green.svg)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Academic Capstone Project**  
> **Course / Degree:** Bachelor of Technology in Computer Science & Engineering (AI & ML)  
> **Tagline:** *Smarter signals. Shorter queues. Better mobility.*

---

## 1. Executive Summary & Vision

**NEXUS** is an interactive, smart-city traffic signal operations and simulation platform designed to demonstrate the tangible benefits of **AI-driven adaptive signal control** over conventional fixed-time round-robin schedulers.

Conventional traffic signal controllers operate on rigid, static time-of-day plans that fail to adapt to stochastic vehicular surges, unexpected bottlenecks, and directional morning/evening commuter shifts. This leads to empty approaches holding unneeded green time while cross-streets accumulate long, idling queues.

**NEXUS** replaces static timing with an explainable, deterministic **Weighted Queue Pressure Policy** equipped with:
- Real-time queue depth assessment.
- Cumulative waiting time tracking.
- Guaranteed starvation prevention overrides.
- Instant emergency vehicle preemption.
- Safe phase interlocking complying with Manual on Uniform Traffic Control Devices (MUTCD) clearance standards.
- Reproducible, seeded side-by-side comparative benchmarking.

---

## 2. System Architecture

The application is structured into decoupled, modular subsystems ensuring separation of concerns:

```
nexus-traffic-intelligence/
├── src/
│   ├── types/               # TypeScript domain interfaces (Approaches, Signals, Vehicles, Metrics)
│   ├── simulation/
│   │   ├── prng.ts          # Seeded 32-bit Mulberry32 PRNG for deterministic reproducibility
│   │   ├── safetyValidator.ts # Interlocking finite state machine (zero conflicting greens)
│   │   ├── trafficGenerator.ts # Stochastic arrival stream generator (Poisson process)
│   │   ├── scenarios.ts     # Predefined scenario matrices (Morning Rush, Evening, Spike, etc.)
│   │   └── SimulationEngine.ts # Physics clock, queue kinematics, headway, vehicle state machine
│   ├── controllers/
│   │   ├── BaseController.ts       # Abstract controller contract
│   │   ├── FixedTimeController.ts  # Sequential cyclic baseline (MUTCD standard)
│   │   └── AdaptiveController.ts   # Explainable weighted pressure optimization policy
│   ├── analytics/
│   │   ├── comparisonEngine.ts     # Side-by-side dual-engine benchmarker
│   │   └── csvExport.ts            # CSV telemetry and audit log serialiser
│   ├── components/
│   │   ├── IntersectionSimulator.tsx # High-fidelity top-down SVG 4-way intersection
│   │   ├── NavigationSidebar.tsx     # Responsive command center navigation
│   │   ├── TopHeader.tsx             # Clock, mode toggle, step/pause controls
│   │   └── MetricCard.tsx            # Tabular numeral KPI cards
│   ├── pages/
│   │   ├── OverviewPage.tsx          # Real-time operational dashboard preview
│   │   ├── LiveSimulationPage.tsx    # Interactive simulation workspace & sliders
│   │   ├── AnalyticsPage.tsx         # Recharts queue & waiting time distributions
│   │   ├── ComparisonLabPage.tsx     # Side-by-side Fixed vs Adaptive experiment lab
│   │   ├── DecisionLogsPage.tsx      # Filterable event audit stream
│   │   ├── ScenariosPage.tsx         # Scenario preset configuration & weight tuning
│   │   └── AboutProjectPage.tsx      # Viva voce guide, formulas, & technical docs
│   ├── styles/
│   │   └── designSystem.css          # Midnight smart-city palette & tokens
│   └── tests/
│       └── nexus.test.ts             # Automated Vitest test suite
```

---

## 3. Mathematical Formulation & Decision Policy

### 3.1. Approach State Vector
For every approach $i \in \{N, S, E, W\}$:
- $Q_i$: Number of vehicles stopped behind the stop line ($v.state = \text{'queued'}$).
- $\bar{T}_i$: Average waiting duration of all queued vehicles on approach $i$.
- $T_{\max, i}$: Maximum waiting time observed on approach $i$.
- $\lambda_i$: Current arrival intensity in vehicles per minute.
- $E_i \in \{0, 1\}$: Binary indicator for priority emergency response vehicle.

### 3.2. Priority Pressure Index Formula
At every clearance interval (decision epoch), the Adaptive Agent computes:

$$\text{Priority}(i) = \left( W_q \cdot Q_i \right) + \left( W_w \cdot \bar{T}_i \right) + \left( W_a \cdot \frac{\lambda_i}{10} \right) + \text{Bonus}_{\text{starvation}}(i) + \text{Bonus}_{\text{emergency}}(i)$$

Where:
- $W_q$ (Queue Weight): Default $1.5$
- $W_w$ (Wait Weight): Default $1.2$
- $W_a$ (Arrival Weight): Default $0.8$
- **Starvation Override:**
  $$\text{Bonus}_{\text{starvation}}(i) = \begin{cases} 200 + 2 \cdot (T_{\max, i} - \tau_{\text{thresh}}), & \text{if } T_{\max, i} \ge \tau_{\text{thresh}} \\ 0, & \text{otherwise} \end{cases}$$
  *(Guarantees that low-traffic cross streets are never starved by high-volume arteries).*
- **Emergency Vehicle Preemption:**
  $$\text{Bonus}_{\text{emergency}}(i) = \begin{cases} 1000, & \text{if } E_i = 1 \\ 0, & \text{otherwise} \end{cases}$$

### 3.3. Dynamic Green Allocation Formula
The chosen winning approach is allocated a duration dynamically scaled to its queue backlog:

$$G_{\text{allocated}} = \text{clamp}\left( G_{\min} + \left( \frac{Q_{\text{chosen}}}{12} \right) \cdot (G_{\max} - G_{\min}), G_{\min}, G_{\max} \right)$$

Bounds:
- $G_{\min}$: Configurable lower bound (default: $10\text{ s}$).
- $G_{\max}$: Configurable upper bound (default: $45\text{ s}$).

---

## 4. Phase Safety & Interlocking Formalism

To ensure collision-free operation under all circumstances:
1. **Zero Conflicting Greens:** At no point may perpendicular approaches display green simultaneously.
2. **Mandatory Clearance Interlocks:**
   $$\text{Phase}(t) = \text{GREEN} \xrightarrow{G_{\text{alloc}}} \text{YELLOW} \xrightarrow{Y = 3\text{ s}} \text{ALL\_RED} \xrightarrow{AR = 1\text{ s}} \text{NEXT\_GREEN}$$
3. All transitions are verified by `SafetyValidator.validatePhaseTransition()`. Direct jumps from Green to another Green or bypasses of Yellow clearance are strictly rejected.

---

## 5. Getting Started & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18, v20, or v24 LTS recommended)
- `npm` (v9+)

### Installation
Clone the repository and install dependencies:
```bash
cd nexus-traffic-intelligence
npm install
```

### Running Locally (Development Server)
Launch the interactive web application:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Executing Automated Unit Tests
Run the Vitest test suite:
```bash
npm test
```

### Production Build
Validate types and compile the optimized production bundle:
```bash
npm run build
```

---

## 6. Predefined Scenarios for Academic Evaluation

| Scenario Preset | Seed | North | South | East | West | Key Observation |
|---|---|---|---|---|---|---|
| **Balanced City Traffic** | 42 | 14 vpm | 14 vpm | 14 vpm | 14 vpm | Baseline; Fixed and Adaptive perform similarly |
| **Morning Arterial Inbound** | 101 | 30 vpm | 24 vpm | 8 vpm | 8 vpm | Adaptive cuts average wait by 25-40% |
| **Evening Outbound Commute** | 202 | 7 vpm | 7 vpm | 28 vpm | 26 vpm | Adaptive prioritizes heavy East-West axis |
| **Northbound Bottleneck Spike** | 303 | 36 vpm | 10 vpm | 10 vpm | 10 vpm | Tests localized surge absorption |
| **Randomized Stress Test** | 777 | 24 vpm | 26 vpm | 28 vpm | 22 vpm | Maximum network throughput test |
| **Emergency Priority Demo** | 999 | 16 vpm | 16 vpm | 12 vpm | 12 vpm | Demonstrates preemption of normal queues |

---

## 7. Viva Voce Examination Preparation Guide

### Q1: Why use a heuristic adaptive agent instead of a deep neural network?
**Answer:** While Deep Reinforcement Learning (DQN, PPO) is promising in research simulations, black-box neural networks exhibit dangerous unpredictability during distribution shifts and lack explainability. In municipal safety-critical infrastructure, an explainable deterministic heuristic provides provable safety bounds, deterministic tie-breaking, and transparent auditability, while establishing a robust baseline for future RL policies.

### Q2: What is the significance of the Mulberry32 Seeded PRNG?
**Answer:** Comparing two controllers with non-deterministic random streams invalidates empirical evaluation because one controller might arbitrarily receive more vehicles than the other. The Seeded PRNG guarantees bit-exact identical vehicle arrivals, types, and arrival timestamps across both Fixed-Time and Adaptive runs.

### Q3: How is starvation mathematically avoided?
**Answer:** In pure queue-length algorithms, a quiet street with 1 vehicle would wait forever if perpendicular traffic had continuous arrivals. The Starvation Override penalty (+200) mathematically forces the priority index to elevate above any standard queue as soon as the vehicle's wait exceeds the threshold $\tau_{\text{thresh}}$ (50s).

### Q4: Does the adaptive controller always win?
**Answer:** No, and NEXUS does not hardcode results. When traffic is extremely balanced and low, the extra yellow and all-red clearance overhead incurred by frequent dynamic phase switches can cause the Adaptive controller to perform comparably or slightly worse than a fixed-time schedule. This empirical honesty is a vital hallmark of sound scientific methodology.

---

## 8. Limitations & Future Roadmap
1. **Computer Vision Layer:** Connect RTSP surveillance cameras using YOLOv8 for vehicle counting and queue extraction from video frames.
2. **Deep Q-Learning (DQN):** Train an RL agent in SUMO using the Open-AI Gym / Gymnasium interface using NEXUS heuristic metrics as reward shaping.
3. **Corridor Synchronization (Green Wave):** Coordinate multiple adjacent 4-way intersections along arterial boulevards.

---

## 9. License
Developed for academic submission and educational purposes under the MIT License.
