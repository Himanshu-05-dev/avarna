"""
Diagnose what the CRAWLER actually extracts from a real page.
Hit the ML /scan endpoint directly with known data.
"""
import json, requests, sys

ML = "http://localhost:8000"

# Simulate minimal crawl data with a known dark pattern
crawl_data = {
    "url": "https://test.example.com",
    "timestamp": "2026-04-25T00:00:00",
    "pages": [{
        "page_id": "test",
        "url": "https://test.example.com",
        "title": "Test Dark Pattern Page",
        "screenshots": {},
        "page_state": "initial",
        "elements": [
            {
                "id": "accept-btn", "tag": "button", "text": "Accept All Cookies",
                "classes": ["cookie-accept"], "is_interactive": True, "is_visible": True,
                "element_type": "button",
                "bounding_box": {"x": 400, "y": 50, "w": 200, "h": 50},
                "computed_css": {"font_size": "16px", "font_weight": "700",
                    "color": "rgb(255,255,255)", "background_color": "rgb(0,113,194)", "opacity": "1"},
                "aria": {}, "children": [],
                "semantic_context": "dialog"
            },
            {
                "id": "reject-btn", "tag": "button", "text": "Reject",
                "classes": ["cookie-reject"], "is_interactive": True, "is_visible": True,
                "element_type": "button",
                "bounding_box": {"x": 620, "y": 55, "w": 60, "h": 30},
                "computed_css": {"font_size": "11px", "font_weight": "400",
                    "color": "rgb(150,150,150)", "background_color": "rgb(255,255,255)", "opacity": "0.7"},
                "aria": {}, "children": [],
                "semantic_context": "dialog"
            },
            {
                "id": "scarcity-text", "tag": "a",
                "text": "Only 2 rooms left at this price on our site!",
                "classes": [], "is_interactive": True, "is_visible": True, "element_type": "a",
                "bounding_box": {"x": 100, "y": 400, "w": 300, "h": 20},
                "computed_css": {"font_size": "13px", "font_weight": "700",
                    "color": "rgb(204,0,0)"},
                "aria": {}, "children": []
            },
            {
                "id": "urgency-text", "tag": "a",
                "text": "In high demand - booked 5 times today! Limited availability. Don't miss out!",
                "classes": [], "is_interactive": True, "is_visible": True, "element_type": "a",
                "bounding_box": {"x": 100, "y": 420, "w": 350, "h": 20},
                "computed_css": {"font_size": "12px", "color": "rgb(204,0,0)"},
                "aria": {}, "children": []
            },
            {
                "id": "newsletter-check", "tag": "input",
                "text": "Send me emails with travel deals and special offers",
                "classes": [], "is_interactive": True, "is_visible": True,
                "element_type": "input", "input_type": "checkbox", "default_checked": True,
                "bounding_box": {"x": 100, "y": 700, "w": 16, "h": 16},
                "computed_css": {"font_size": "12px"},
                "aria": {}, "children": [],
                "semantic_context": "form"
            }
        ]
    }]
}

print("Sending mock data to ML pipeline...")
resp = requests.post(
    f"{ML}/api/v1/scan",
    json=crawl_data,
    headers={"X-API-Key": "ncs-dark-pattern-auditor-2026", "Content-Type": "application/json"},
    timeout=120,
)

print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    result = resp.json()
    roadmap = result.get("roadmap", {})
    findings = roadmap.get("findings", [])
    print(f"\n✅ TOTAL FINDINGS: {len(findings)}")
    for f in findings:
        print(f"  🔴 {f.get('pattern_subtype', '?')} [{f.get('severity', '?')}] — {f.get('justification', '')[:100]}")
    
    if len(findings) == 0:
        print("\n⚠️ Zero findings — the detection pipeline has an issue")
    else:
        print(f"\n✅ Pipeline works! {len(findings)} findings from mock data.")
        print("The problem is the CRAWLER — it's not extracting the right elements from real pages.")
else:
    print(f"Error: {resp.text[:500]}")
