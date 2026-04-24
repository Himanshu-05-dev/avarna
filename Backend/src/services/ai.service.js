import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { crawlAndScan } from './crawl.service.js';
import { config } from '../config/config.js';

// ─── Model ────────────────────────────────────────────────────────────────────

console.log('[ai.service] Loading... API key present:', !!process.env.GEMINI_API_KEY);

const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash-lite',
    temperature: 0.3,
    apiKey: config.geminiApiKey,
});

// ─── Data Cleaner ─────────────────────────────────────────────────────────────

/**
 * Parses and cleans raw crawl result into a compact payload for the AI.
 * - Parses stringified scan JSON
 * - Removes base64 image blobs
 * - Deduplicates repetitive tickets by subtype
 */
const buildCleanPayload = (crawlResult) => {
    const scanData = typeof crawlResult.scan === 'string'
        ? JSON.parse(crawlResult.scan)
        : crawlResult.scan;

    // Group tickets by subtype to avoid sending dozens of near-identical tickets
    const grouped = {};
    for (const ticket of scanData.tickets) {
        const key = ticket.dark_pattern_subtype;
        if (!grouped[key]) {
            grouped[key] = {
                subtype: ticket.dark_pattern_subtype,
                category: ticket.dark_pattern_category,
                count: 0,
                sample_problem: ticket.problem_description,
                fix_recommendation: ticket.fix_recommendation,
                effort_estimate: ticket.effort_estimate,
                acceptance_criterion: ticket.acceptance_criterion,
                severity_score: ticket.severity_score,
                max_priority_score: 0,
                regulations_violated: [
                    ...new Set(
                        ticket.compliance_annotations.map(a => a.act_name)
                    )
                ],
            };
        }
        grouped[key].count++;
        grouped[key].max_priority_score = Math.max(
            grouped[key].max_priority_score,
            ticket.priority_score
        );
    }

    return {
        scan_url: scanData.scan_url,
        scan_timestamp: scanData.scan_timestamp,
        summary: {
            total_elements_scanned: scanData.total_elements_scanned,
            total_findings: scanData.total_findings,
            critical_count: scanData.critical_count,
            high_count: scanData.high_count,
            medium_count: scanData.medium_count,
            low_count: scanData.low_count,
            categories_found: scanData.categories_found,
            regulations_violated: scanData.regulations_violated,
        },
        grouped_issues: Object.values(grouped).sort(
            (a, b) => b.max_priority_score - a.max_priority_score
        ),
    };
};

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a dark pattern auditor AI. You receive ML model scan results and must output a SINGLE valid JSON object — no markdown, no explanation, no code fences, no extra text.

The JSON must follow this schema exactly:

{
  "scan_url": "<the scanned URL>",
  "scan_timestamp": "<ISO 8601 timestamp>",
  "executive_summary": "<4-6 sentence comprehensive narrative summarizing the overall risk posture, key dark patterns found, their real-world impact on users, and recommended immediate actions. Write this as a human-readable briefing a non-technical executive can understand.>",

  "stat_cards": {
    "risk_score": <number 0-100>,
    "risk_score_delta": "<string like '+2.4%'>",
    "open_controls_critical": <number — critical findings count>,
    "total_findings": <number>,
    "critical_count": <number>,
    "high_count": <number>,
    "medium_count": <number>,
    "low_count": <number>,
    "total_elements_scanned": <number>
  },

  "analysis_findings": [
    {
      "id": "<string like 'AF-001'>",
      "entity": "<dark_pattern_subtype — name of the UI pattern>",
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "controlStatus": "<Non-Compliant|Partial Compliance|Review Required|Compliant>",
      "statusTone": "<bg-rose-500|bg-orange-500|bg-slate-400|bg-emerald-500>",
      "date": "<formatted like 'Apr 24, 2026'>",
      "what_it_is": "<2-3 sentence plain-English explanation of what this dark pattern is and how it manifests on the scanned page. Use concrete language a non-technical person can understand.>",
      "why_it_matters": "<2-3 sentences explaining the legal, ethical, and business consequences. Reference specific regulations violated.>",
      "user_impact": "<1-2 sentences describing how this pattern harms or misleads end users.>",
      "evidence_summary": "<1-2 sentences describing what the ML scanner detected — e.g. 'Found 12 instances of hidden pre-checked subscription checkboxes in the checkout flow.'>"
    }
  ],

  "remediation_tasks": [
    {
      "id": <sequential number starting at 1>,
      "title": "<short name of the fix>",
      "description": "<designer-targeted plain-English description, max 180 chars>",
      "priority": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "penalty": "<estimated regulatory exposure like '$450k/yr'>",
      "assignee": { "name": "Unassigned", "color": "bg-slate-300" },
      "icon": "<ban|eye-off|alert|timer>",
      "iconBg": "<Tailwind classes for icon bg+text>",
      "fix_recommendation": "<actionable fix>",
      "effort_estimate": "<S|M|L>",
      "acceptance_criterion": "<testable QA criterion>",
      "regulations_violated": ["<regulation name>"],
      "detailed_steps": [
        "<Step 1: concrete implementation instruction>",
        "<Step 2: concrete implementation instruction>",
        "<Step 3: concrete implementation instruction>"
      ],
      "business_rationale": "<2-3 sentences explaining WHY this fix matters from a business, legal, and user-trust perspective.>"
    }
  ],

  "compliance_frameworks": [
    { "id": "gdpr",  "name": "GDPR",         "score": <0-100>, "controls": <number>, "passed": <number>, "icon": "shield-check", "explanation": "<2-3 sentences explaining what GDPR violations were found and their implications.>" },
    { "id": "ccpa",  "name": "CCPA",         "score": <0-100>, "controls": <number>, "passed": <number>, "icon": "scale",        "explanation": "<2-3 sentences explaining CCPA compliance status.>" },
    { "id": "dpdp",  "name": "DPDP (India)", "score": <0-100>, "controls": <number>, "passed": <number>, "icon": "scale",        "explanation": "<2-3 sentences explaining DPDP compliance status.>" },
    { "id": "soc2",  "name": "SOC 2 Type II","score": <0-100>, "controls": <number>, "passed": <number>, "icon": "lock",         "explanation": "<2-3 sentences explaining SOC 2 compliance status.>" },
    { "id": "eu-ai", "name": "EU AI Act",    "score": <0-100>, "controls": <number>, "passed": <number>, "icon": "cpu",          "explanation": "<2-3 sentences explaining EU AI Act compliance status.>" },
    { "id": "nist",  "name": "NIST AI RMF",  "score": <0-100>, "controls": <number>, "passed": <number>, "icon": "list-checks",  "explanation": "<2-3 sentences explaining NIST RMF compliance status.>" }
  ],

  "audit_entry": {
    "id": "<AUD-YYYYMMDD>",
    "target": "<hostname only of scanned URL>",
    "framework": "<comma-joined violated regulations>",
    "status": "Completed",
    "findings": <number>,
    "risk": <number 0-100>,
    "date": "<formatted like 'Apr 24, 2026'>"
  },

  "ai_insight": {
    "title": "<name of the highest-priority dark pattern>",
    "threat_vector": "<4-5 sentence detailed technical explanation of the worst pattern: what it does, how it works, why it's harmful, and what users experience.>",
    "recommendation_title": "<short action title>",
    "recommendation_body": "<2-3 sentence practical recommendation with specific, concrete actions to take.>",
    "risk_decomposition": {
      "exploitability": <1-5>,
      "data_exposure": <1-5>,
      "compliance_impact": <1-5>
    },
    "deep_dive": "<A detailed 6-10 sentence narrative that explains the overall dark pattern landscape found on this website. Discuss patterns of manipulation, how they work together, which user journeys are most affected, and what the cumulative effect is on user trust and regulatory exposure. Write as if briefing a product manager.>"
  },

  "remediation_timeline": [
    { "month": "JAN", "resolved": <number>, "projected": 0 },
    { "month": "FEB", "resolved": <number>, "projected": 0 },
    { "month": "MAR", "resolved": <number>, "projected": 0 },
    { "month": "APR", "resolved": <number>, "projected": 0 },
    { "month": "MAY", "resolved": 0, "projected": <number> },
    { "month": "JUN", "resolved": 0, "projected": <number> },
    { "month": "JUL", "resolved": 0, "projected": <number> },
    { "month": "AUG", "resolved": 0, "projected": <number> }
  ],

  "quick_wins": ["<title of effort=S fix highest priority first>"]
}

RULES (follow exactly):
1. Output ONLY the raw JSON object. Zero extra characters outside the JSON.
2. Base ALL data on the ML scan results. Do not fabricate findings not in the data. IGNORE any grouped_issue whose severity_score < 2 — these are low-confidence noise.
3. risk_score = min(100, round(Math.sqrt(critical_count) * 25 + Math.sqrt(high_count) * 12 + Math.sqrt(medium_count) * 5 + Math.sqrt(low_count) * 2)). Use square root to apply diminishing returns — 1 critical = 25, 4 critical = 50, 16 critical = 100. A site with any CRITICAL findings must have risk_score >= 25.
4. compliance_frameworks: regulations that appear in regulations_violated get scores 30-55; others get 75-92. passed = round(score/100 * controls).
5. remediation_tasks: derive icon from pattern type — ban=blocking/roach-motel, eye-off=hidden/visibility, alert=confirmshaming/urgency, timer=countdown/scarcity.
6. iconBg per priority: CRITICAL="bg-rose-100 text-rose-600", HIGH="bg-orange-100 text-orange-600", MEDIUM="bg-blue-100 text-blue-600", LOW="bg-slate-100 text-slate-700".
7. penalty per priority: CRITICAL≈"$400k-600k/yr", HIGH≈"$200k-350k/yr", MEDIUM≈"$50k-120k/yr", LOW≈"$5k-30k/yr".
8. analysis_findings: one entry per grouped_issue (only those with severity_score >= 2), severity based on severity_score (>=3.5=CRITICAL, >=2.5=HIGH, >=1.5=MEDIUM, else LOW). statusTone matches severity. Include detailed what_it_is, why_it_matters, user_impact, evidence_summary for each.
9. remediation_timeline: fill JAN-APR with resolved counts scaled to total_findings, MAY-AUG with projected counts.
10. quick_wins: list titles of ALL grouped_issues where effort_estimate="S", ordered by max_priority_score descending.
11. Write ALL explanations, summaries, and narratives in clear, jargon-free English. These will be shown directly to users — they must be insightful, specific, and actionable.
12. detailed_steps in remediation_tasks must contain 3-5 concrete implementation steps a developer can follow.
13. business_rationale must explain the ROI of each fix in terms of user trust, legal risk reduction, and business impact.`;

// ─── Runner Function ──────────────────────────────────────────────────────────

/**
 * Run the audit pipeline on a given URL.
 *
 * @param {string} url - The website URL to audit.
 * @returns {Promise<{success: boolean, auditData?: object, error?: string}>}
 */
export const runCrawlAgent = async (url) => {
    try {
        console.log(`[crawlAgent] Starting audit for: ${url}`);

        // Step 1: Crawl and scan
        const crawlResult = await crawlAndScan(url);

        if (!crawlResult.success) {
            return {
                success: false,
                error: crawlResult.error || 'Crawl failed',
                errorCode: crawlResult.errorCode || 'CRAWL_ERROR',
            };
        }

        // Step 2: Parse and clean the data
        let cleanPayload;
        try {
            cleanPayload = buildCleanPayload(crawlResult);
        } catch (parseError) {
            console.error('[crawlAgent] Failed to parse scan data:', parseError.message);
            return { success: false, error: `Data parsing failed: ${parseError.message}` };
        }

        console.log(`[crawlAgent] Clean payload ready. Unique issue types: ${cleanPayload.grouped_issues.length}`);

        // Step 3: Send clean data to Gemini — request structured JSON
        const result = await model.invoke([
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Here is the dark pattern scan result for ${url}. Produce the structured JSON audit report.\n\n` +
                `\`\`\`json\n${JSON.stringify(cleanPayload, null, 2)}\n\`\`\``
            ),
        ]);

        // Step 4: Parse the JSON response — strip any accidental markdown fences
        let auditData;
        try {
            const raw = result.content
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim();
            auditData = JSON.parse(raw);
        } catch (jsonErr) {
            console.error('[crawlAgent] AI returned invalid JSON:', jsonErr.message);
            console.error('[crawlAgent] Raw response:', result.content.substring(0, 500));
            return { success: false, error: `AI returned invalid JSON: ${jsonErr.message}` };
        }

        console.log('[crawlAgent] Audit complete. Total findings:', auditData?.stat_cards?.total_findings);
        return {
            success: true,
            auditData,
        };

    } catch (error) {
        console.error('[crawlAgent] Error:', error.message);
        return { success: false, error: error.message };
    }
};