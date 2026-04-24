"""
Report Renderer — generates HTML and JSON reports from the Roadmap.

Produces a self-contained, dark-mode HTML report with:
- Summary dashboard (severity breakdown, key stats)
- Prioritized ticket list
- Per-finding detail with evidence chain
- Compliance annotations
"""

import json
import os
import logging
from datetime import datetime
from schemas.output import Roadmap, RemediationTicket

logger = logging.getLogger(__name__)


def render_json(roadmap: Roadmap, output_dir: str = "output_reports") -> str:
    """Save roadmap as JSON and return the path."""
    os.makedirs(output_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(output_dir, f"report_{ts}.json")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(roadmap.model_dump(mode="json"), f, indent=2, default=str)

    logger.info(f"JSON report saved to {path}")
    return path


def render_html(roadmap: Roadmap, output_dir: str = "output_reports") -> str:
    """Generate a self-contained HTML report and return the path."""
    os.makedirs(output_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(output_dir, f"report_{ts}.html")

    html = _build_html(roadmap)

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)

    logger.info(f"HTML report saved to {path}")
    return path


def _severity_color(score: float) -> str:
    if score >= 4:
        return "#ef4444"   # red
    elif score >= 3:
        return "#f97316"   # orange
    elif score >= 2:
        return "#eab308"   # yellow
    return "#22c55e"       # green


def _severity_label(score: float) -> str:
    if score >= 4:
        return "CRITICAL"
    elif score >= 3:
        return "HIGH"
    elif score >= 2:
        return "MEDIUM"
    return "LOW"


def _effort_emoji(effort: str) -> str:
    return {"S": "⚡", "M": "🔧", "L": "🏗️"}.get(effort, "🔧")


def _build_html(roadmap: Roadmap) -> str:
    """Build the full HTML report string."""

    # Build ticket cards
    ticket_cards = ""
    for ticket in roadmap.tickets:
        severity_col = _severity_color(ticket.severity_score)
        severity_lbl = _severity_label(ticket.severity_score)

        # Compliance badges
        compliance_html = ""
        for ann in ticket.compliance_annotations[:3]:
            short_act = ann.act_name.split("(")[0].strip()
            compliance_html += f'<span class="compliance-badge">{short_act} — {ann.section}</span>\n'

        # SHAP if available
        evidence_html = f"<p class='evidence-text'>{ticket.evidence_summary}</p>" if ticket.evidence_summary else ""

        ticket_cards += f"""
        <div class="ticket-card" style="border-left-color: {severity_col};">
            <div class="ticket-header">
                <div class="ticket-id-group">
                    <span class="ticket-id">{ticket.ticket_id}</span>
                    <span class="severity-badge" style="background: {severity_col};">{severity_lbl}</span>
                    <span class="effort-badge">{_effort_emoji(ticket.effort_estimate)} Effort: {ticket.effort_estimate}</span>
                </div>
                <span class="priority-score">Priority: {ticket.priority_score}</span>
            </div>

            <h3 class="ticket-title">{ticket.dark_pattern_subtype.replace('_', ' ').title()}</h3>
            <p class="ticket-category">Category: {ticket.dark_pattern_category.replace('_', ' ').title()}</p>

            <div class="ticket-section">
                <h4>🔍 Problem</h4>
                <p>{ticket.problem_description}</p>
                <p class="element-ref">Element: <code>{ticket.element_reference}</code></p>
            </div>

            {f'<div class="ticket-section"><h4>📊 Evidence</h4>{evidence_html}</div>' if evidence_html else ''}

            <div class="ticket-section">
                <h4>⚖️ Regulatory Violations</h4>
                <div class="compliance-tags">{compliance_html if compliance_html else '<p class="no-match">No specific clause match</p>'}</div>
                <p class="reg-plain">{ticket.regulatory_clause_plain}</p>
            </div>

            <div class="ticket-section fix-section">
                <h4>🛠️ Recommended Fix</h4>
                <p>{ticket.fix_recommendation}</p>
            </div>

            <div class="ticket-section">
                <h4>✅ Acceptance Criterion</h4>
                <p class="acceptance">{ticket.acceptance_criterion}</p>
            </div>

            <div class="ticket-meta">
                <span>Confidence: {ticket.detection_confidence:.0%}</span>
                <span>Modalities: {ticket.modality_count}/3</span>
                {f'<span>Gemini: {ticket.gemini_confidence:.0%}</span>' if ticket.gemini_confidence else ''}
            </div>
        </div>
        """

    # Quick wins section
    quick_wins = roadmap.get_quick_wins()
    quick_wins_html = ""
    if quick_wins:
        quick_wins_items = "".join(
            f"<li><strong>{t.ticket_id}</strong> — {t.dark_pattern_subtype.replace('_', ' ').title()} "
            f"on <code>{t.element_reference}</code> (Priority: {t.priority_score})</li>"
            for t in quick_wins[:5]
        )
        quick_wins_html = f"""
        <div class="quick-wins">
            <h2>⚡ Quick Wins</h2>
            <p>High priority + low effort — fix these first:</p>
            <ul>{quick_wins_items}</ul>
        </div>
        """

    # Regulations list
    reg_list = "".join(f"<li>{r}</li>" for r in roadmap.regulations_violated) or "<li>None identified</li>"

    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dark Pattern Audit Report — {roadmap.scan_url}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}

        :root {{
            --bg-primary: #0f0f1a;
            --bg-card: #1a1a2e;
            --bg-card-hover: #1f1f35;
            --text-primary: #e2e8f0;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --accent: #818cf8;
            --accent-glow: rgba(129, 140, 248, 0.15);
            --border: #2d2d44;
            --critical: #ef4444;
            --high: #f97316;
            --medium: #eab308;
            --low: #22c55e;
            --radius: 12px;
        }}

        body {{
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }}

        .container {{
            max-width: 1100px;
            margin: 0 auto;
            padding: 2rem;
        }}

        header {{
            text-align: center;
            padding: 3rem 0 2rem;
        }}

        header h1 {{
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent), #a78bfa, #c084fc);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            margin-bottom: 0.5rem;
        }}

        header .subtitle {{
            color: var(--text-secondary);
            font-size: 1rem;
        }}

        header .scan-meta {{
            margin-top: 1rem;
            font-size: 0.85rem;
            color: var(--text-muted);
        }}

        /* Dashboard Summary */
        .dashboard {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }}

        .stat-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.5rem;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }}

        .stat-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }}

        .stat-number {{
            font-size: 2.5rem;
            font-weight: 800;
            display: block;
            margin-bottom: 0.3rem;
        }}

        .stat-label {{
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        /* Severity breakdown */
        .severity-bar {{
            display: flex;
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            margin: 2rem 0 1rem;
        }}

        .severity-segment {{
            transition: width 0.5s;
        }}

        .severity-legend {{
            display: flex;
            justify-content: center;
            gap: 1.5rem;
            margin-bottom: 2rem;
            font-size: 0.85rem;
        }}

        .legend-item {{
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }}

        .legend-dot {{
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }}

        /* Quick Wins */
        .quick-wins {{
            background: linear-gradient(135deg, rgba(129,140,248,0.1), rgba(167,139,250,0.05));
            border: 1px solid var(--accent);
            border-radius: var(--radius);
            padding: 1.5rem;
            margin-bottom: 2rem;
        }}

        .quick-wins h2 {{
            color: var(--accent);
            font-size: 1.3rem;
            margin-bottom: 0.5rem;
        }}

        .quick-wins ul {{
            padding-left: 1.5rem;
            margin-top: 0.8rem;
        }}

        .quick-wins li {{
            margin-bottom: 0.4rem;
        }}

        /* Ticket Cards */
        .ticket-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-left: 4px solid;
            border-radius: var(--radius);
            padding: 1.5rem;
            margin-bottom: 1rem;
            transition: background 0.2s, box-shadow 0.2s;
        }}

        .ticket-card:hover {{
            background: var(--bg-card-hover);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }}

        .ticket-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.8rem;
            flex-wrap: wrap;
            gap: 0.5rem;
        }}

        .ticket-id-group {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }}

        .ticket-id {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: var(--accent);
            font-weight: 600;
        }}

        .severity-badge {{
            font-size: 0.7rem;
            font-weight: 700;
            color: white;
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .effort-badge {{
            font-size: 0.75rem;
            color: var(--text-secondary);
            background: rgba(255,255,255,0.05);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
        }}

        .priority-score {{
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--accent);
        }}

        .ticket-title {{
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 0.2rem;
        }}

        .ticket-category {{
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 1rem;
        }}

        .ticket-section {{
            margin-bottom: 1rem;
        }}

        .ticket-section h4 {{
            font-size: 0.9rem;
            color: var(--accent);
            margin-bottom: 0.4rem;
        }}

        .ticket-section p {{
            font-size: 0.9rem;
            color: var(--text-secondary);
        }}

        .element-ref {{
            margin-top: 0.3rem;
            font-size: 0.8rem;
        }}

        .element-ref code {{
            background: rgba(129,140,248,0.1);
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            color: var(--accent);
        }}

        .compliance-tags {{
            display: flex;
            gap: 0.4rem;
            flex-wrap: wrap;
            margin-bottom: 0.5rem;
        }}

        .compliance-badge {{
            font-size: 0.75rem;
            background: rgba(239,68,68,0.15);
            color: #fca5a5;
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            border: 1px solid rgba(239,68,68,0.3);
        }}

        .reg-plain {{
            font-size: 0.8rem;
            color: var(--text-muted);
            font-style: italic;
        }}

        .no-match {{
            font-size: 0.8rem;
            color: var(--text-muted);
        }}

        .fix-section {{
            background: rgba(34,197,94,0.05);
            border: 1px solid rgba(34,197,94,0.2);
            border-radius: 8px;
            padding: 1rem;
        }}

        .fix-section h4 {{
            color: #4ade80 !important;
        }}

        .acceptance {{
            font-size: 0.85rem;
            font-style: italic;
            color: var(--text-muted);
        }}

        .evidence-text {{
            font-size: 0.85rem;
            font-family: 'JetBrains Mono', monospace;
            color: var(--text-muted);
        }}

        .ticket-meta {{
            display: flex;
            gap: 1rem;
            font-size: 0.75rem;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
            padding-top: 0.8rem;
            margin-top: 0.5rem;
        }}

        /* Regulations section */
        .regulations {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.5rem;
            margin-top: 2rem;
        }}

        .regulations h2 {{
            font-size: 1.3rem;
            margin-bottom: 1rem;
        }}

        .regulations ul {{
            padding-left: 1.5rem;
        }}

        .regulations li {{
            color: var(--text-secondary);
            margin-bottom: 0.3rem;
        }}

        footer {{
            text-align: center;
            padding: 3rem 0;
            color: var(--text-muted);
            font-size: 0.8rem;
        }}

        @media (max-width: 768px) {{
            .container {{ padding: 1rem; }}
            .dashboard {{ grid-template-columns: repeat(2, 1fr); }}
            header h1 {{ font-size: 1.6rem; }}
        }}
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header>
            <h1>🔍 Dark Pattern Audit Report</h1>
            <p class="subtitle">AI-Powered Regulatory Compliance Analysis</p>
            <p class="scan-meta">
                URL: {roadmap.scan_url}<br>
                Scanned: {roadmap.scan_timestamp.strftime('%Y-%m-%d %H:%M:%S')}<br>
                Elements analyzed: {roadmap.total_elements_scanned}
            </p>
        </header>

        <div class="dashboard">
            <div class="stat-card">
                <span class="stat-number" style="color: var(--accent);">{roadmap.total_findings}</span>
                <span class="stat-label">Total Findings</span>
            </div>
            <div class="stat-card">
                <span class="stat-number" style="color: var(--critical);">{roadmap.critical_count}</span>
                <span class="stat-label">Critical</span>
            </div>
            <div class="stat-card">
                <span class="stat-number" style="color: var(--high);">{roadmap.high_count}</span>
                <span class="stat-label">High</span>
            </div>
            <div class="stat-card">
                <span class="stat-number" style="color: var(--medium);">{roadmap.medium_count}</span>
                <span class="stat-label">Medium</span>
            </div>
            <div class="stat-card">
                <span class="stat-number" style="color: var(--low);">{roadmap.low_count}</span>
                <span class="stat-label">Low</span>
            </div>
        </div>

        <!-- Severity Bar -->
        <div class="severity-bar">
            <div class="severity-segment" style="width: {(roadmap.critical_count / max(roadmap.total_findings, 1)) * 100}%; background: var(--critical);"></div>
            <div class="severity-segment" style="width: {(roadmap.high_count / max(roadmap.total_findings, 1)) * 100}%; background: var(--high);"></div>
            <div class="severity-segment" style="width: {(roadmap.medium_count / max(roadmap.total_findings, 1)) * 100}%; background: var(--medium);"></div>
            <div class="severity-segment" style="width: {(roadmap.low_count / max(roadmap.total_findings, 1)) * 100}%; background: var(--low);"></div>
        </div>
        <div class="severity-legend">
            <span class="legend-item"><span class="legend-dot" style="background: var(--critical);"></span> Critical ({roadmap.critical_count})</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--high);"></span> High ({roadmap.high_count})</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--medium);"></span> Medium ({roadmap.medium_count})</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--low);"></span> Low ({roadmap.low_count})</span>
        </div>

        {quick_wins_html}

        <h2 style="margin-bottom: 1rem; font-size: 1.5rem;">📋 Findings (sorted by priority)</h2>

        {ticket_cards}

        <div class="regulations">
            <h2>📜 Regulations Referenced</h2>
            <ul>{reg_list}</ul>
        </div>

        <footer>
            <p>Generated by Dark Pattern Auditor — AI-powered regulatory compliance analysis</p>
            <p>All findings are backed by structured evidence chains. LLMs are used as structured reasoners, not open-ended generators.</p>
        </footer>
    </div>
</body>
</html>"""
