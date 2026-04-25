"""Stress test: send N elements to ML API and measure response."""
import requests, json, time, sys

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100

elements = []
for i in range(N):
    elements.append({
        "id": f"el_{i}", "tag": "button" if i % 3 == 0 else "a",
        "text": f"Click action {i}" if i % 5 else f"Buy now limited offer {i}",
        "classes": [], "is_interactive": True, "is_visible": True,
        "element_type": "button" if i % 3 == 0 else "a",
        "bounding_box": {"x": 100 + (i % 10) * 80, "y": (i // 10) * 30, "w": 80, "h": 25},
        "computed_css": {"font_size": "14px", "color": "rgb(0,0,0)"},
        "aria": {}, "children": []
    })

print(f"Testing with {len(elements)} elements...")
start = time.time()
try:
    resp = requests.post("http://127.0.0.1:8000/api/v1/scan", json={
        "url": "https://test.com", "timestamp": "2026-04-25",
        "pages": [{"page_id": "test", "url": "https://test.com", "title": "Test",
            "screenshots": {}, "page_state": "initial", "elements": elements}]
    }, headers={"X-API-Key": "ncs-dark-pattern-auditor-2026"}, timeout=120)
    elapsed = time.time() - start
    print(f"Status: {resp.status_code} in {elapsed:.1f}s")
    data = resp.json()
    print(f"Findings: {data.get('total_findings', '?')}")
except Exception as e:
    elapsed = time.time() - start
    print(f"FAILED after {elapsed:.1f}s: {e}")
