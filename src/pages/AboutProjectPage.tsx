import React from 'react';
import {
  GraduationCap,
  BookOpen,
  Cpu,
  Shield,
  Layers,
  Sparkles,
  HelpCircle,
  Code2,
  FileText,
  Lightbulb,
} from 'lucide-react';

export const AboutProjectPage: React.FC = () => {
  const vivaQuestions = [
    {
      q: '1. What is the fundamental problem with conventional fixed-time traffic controllers?',
      a: 'Conventional fixed-time controllers allocate static, predetermined green durations regardless of real-time vehicular density. During asymmetric traffic shifts (e.g. morning rush, sudden incidents), empty approaches receive unneeded green time while congested approaches experience exponential queue growth, leading to increased idle fuel consumption and elevated vehicle delays.',
    },
    {
      q: '2. How does the NEXUS Adaptive Controller formulate its signal decision?',
      a: 'The controller calculates a dynamic Weighted Queue Pressure Index P_i for each approach i: P_i = (W_q · Q_i) + (W_w · T_avg,i) + (W_a · λ_i / 10). The approach with the highest score is allocated the right-of-way, with dynamic green duration bounded strictly between G_min and G_max based on queue depth.',
    },
    {
      q: '3. How does the system prevent starvation on low-volume cross streets?',
      a: 'If any queued vehicle exceeds the configurable Starvation Threshold (default: 50s), the approach flags a starvation condition and receives an automatic high-priority override (+200 points). This mathematically guarantees that no approach is starved indefinitely by heavy arterial flows.',
    },
    {
      q: '4. How is intersection safety formally guaranteed?',
      a: 'Safety is enforced via a centralized SafetyValidator finite state machine. A strict interlock guarantees that no orthogonal approaches can display GREEN or YELLOW simultaneously. All phase transitions require a mandatory Yellow Clearance Interval (3s) followed by an All-Red Clearance Interval (1s) before the next phase can activate.',
    },
    {
      q: '5. Is this a rule-based expert system or a trained Reinforcement Learning (RL) model?',
      a: 'NEXUS implements a deterministic, explainable heuristic optimization policy designed as a reliable production baseline. It avoids the safety risks and training instabilities of black-box RL models in initial deployment, while exposing formal state vectors suitable for future Deep Q-Network (DQN) or PPO extensions.',
    },
    {
      q: '6. How is fair benchmarking ensured between Fixed and Adaptive controllers?',
      a: 'Both controllers are evaluated using a deterministic Mulberry32 pseudorandom number generator with identical seeds, simulation duration horizons, vehicle arrival distributions, and vehicle types. Independent state machines prevent one controller from altering the traffic input seen by the other.',
    },
  ];

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1100px' }}>
      {/* Hero Banner */}
      <div
        className="nexus-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 24, 38, 0.95), rgba(15, 23, 42, 0.9))',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-cyan">
            <GraduationCap size={14} />
            B.Tech CSE (AI & ML) Capstone Project
          </span>
          <span className="badge badge-emerald">Autonomous Systems</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          NEXUS — AI-Based Adaptive Traffic Signal Agent
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          An explainable, deterministic smart-city intersection control system that optimizes phase scheduling, eliminates starvation, and dynamically sizes green intervals to minimize vehicular delay.
        </p>
      </div>

      {/* Mathematical Model Card */}
      <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Code2 size={20} color="#38bdf8" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff' }}>
            Mathematical Model & Decision Policy
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <p>
            The intersection is modeled as a 4-approach junction <code style={{ color: '#38bdf8' }}>A = &#123;North, South, East, West&#125;</code>. At every decision epoch, the agent evaluates the state vector of each approach:
          </p>

          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: '#34d399',
            }}
          >
            P_i = (W_q · Q_i) + (W_w · T_avg,i) + (W_a · (λ_i / 10)) + S_i + E_i
          </div>

          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li><strong>Q_i:</strong> Current queue length (vehicles stationary behind stop line).</li>
            <li><strong>T_avg,i:</strong> Average waiting duration of all vehicles currently queued on approach i.</li>
            <li><strong>λ_i:</strong> Approaching traffic arrival intensity (vehicles per minute).</li>
            <li><strong>W_q, W_w, W_a:</strong> Configurable tuning weights (default 1.5, 1.2, 0.8).</li>
            <li><strong>S_i:</strong> Starvation penalty (+200) triggered when max(T_i) ≥ Starvation Threshold.</li>
            <li><strong>E_i:</strong> Emergency preemption boost (+1000) triggered if emergency vehicle is present.</li>
          </ul>

          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
            Dynamic Green Duration Allocation:
          </h3>
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: '#fbbf24',
            }}
          >
            G_alloc = clamp(G_min + (Q_chosen / 12) · (G_max - G_min), G_min, G_max)
          </div>
        </div>
      </div>

      {/* Safety Interlocking Matrix */}
      <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} color="#34d399" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff' }}>
            Phase Safety Interlocking Guarantee
          </h2>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          In accordance with the Manual on Uniform Traffic Control Devices (MUTCD), conflicting movements are locked out by a finite state machine:
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
            <thead style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-muted)' }}>
              <tr>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Phase</th>
                <th style={{ padding: '0.5rem' }}>North Signal</th>
                <th style={{ padding: '0.5rem' }}>South Signal</th>
                <th style={{ padding: '0.5rem' }}>East Signal</th>
                <th style={{ padding: '0.5rem' }}>West Signal</th>
                <th style={{ padding: '0.5rem' }}>Next Legal Transition</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600, color: '#34d399' }}>NS_GREEN (Phase A)</td>
                <td style={{ color: '#34d399', fontWeight: 700 }}>GREEN</td>
                <td style={{ color: '#34d399', fontWeight: 700 }}>GREEN</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td>NS_YELLOW</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600, color: '#fbbf24' }}>NS_YELLOW</td>
                <td style={{ color: '#fbbf24', fontWeight: 700 }}>YELLOW</td>
                <td style={{ color: '#fbbf24', fontWeight: 700 }}>YELLOW</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td>ALL_RED</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600, color: '#ef4444' }}>ALL_RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td>Next Selected GREEN (EW_GREEN or NS_GREEN)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600, color: '#34d399' }}>EW_GREEN (Phase B)</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#34d399', fontWeight: 700 }}>GREEN</td>
                <td style={{ color: '#34d399', fontWeight: 700 }}>GREEN</td>
                <td>EW_YELLOW</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600, color: '#fbbf24' }}>EW_YELLOW</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#ef4444' }}>RED</td>
                <td style={{ color: '#fbbf24', fontWeight: 700 }}>YELLOW</td>
                <td style={{ color: '#fbbf24', fontWeight: 700 }}>YELLOW</td>
                <td>ALL_RED</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Viva Voce Examiner Prep Guide */}
      <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HelpCircle size={20} color="#a78bfa" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff' }}>
            Viva Voce Examination Preparation Guide
          </h2>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Comprehensive model answers for questions frequently asked by project reviewers and external viva examiners:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {vivaQuestions.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                {item.q}
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Limitations & Future Work */}
      <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lightbulb size={20} color="#f59e0b" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff' }}>
            Limitations & Future Extensions
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-canvas)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ color: '#ffffff', fontWeight: 700, marginBottom: '4px' }}>1. Computer Vision Ingestion (YOLOv8)</h4>
            <p>Integrating real-time RTSP camera feeds with a lightweight YOLOv8 object detection model to extract exact vehicle bounding boxes and density without physical road loop detectors.</p>
          </div>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-canvas)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ color: '#ffffff', fontWeight: 700, marginBottom: '4px' }}>2. Deep Reinforcement Learning</h4>
            <p>Extending the heuristic policy with a Double Deep Q-Network (DDQN) trained via SUMO (Simulation of Urban MObility) to discover optimal green splits under non-linear arterial traffic.</p>
          </div>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-canvas)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ color: '#ffffff', fontWeight: 700, marginBottom: '4px' }}>3. Multi-Intersection Corridor Coordination</h4>
            <p>Synchronizing green waves along multi-intersection corridors (e.g. MaxBand or TRANSYT principles) to optimize end-to-end travel times across an entire urban grid.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
