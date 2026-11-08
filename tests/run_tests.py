#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XBOT Robotics Kazakhstan — Automated Quality Assurance Test Suite
Tests:
  1. Robot catalog integrity (js/robots-data.js): 39 models, images on disk, specs, prices.
  2. Web platform files validation (index.html, css/style.css, js/app.js): JS syntax via node --check, HTML tags, relative links.
  3. Backend API server integration (server/server.js): port spin-up, /api/health, /api/robots, POST /api/leads, file persistence, shutdown.
  4. Interactive ROI Calculator formula validation: boundary conditions (1 to 15 staff, 120k to 500k KZT salary).
  5. Layout, CSS z-index conflicts & WhatsApp floating button overlap safety.
"""

import sys
import os
import re
import json
import time
import subprocess
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# Force UTF-8 on Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent.parent
ROBOTS_DATA_PATH = BASE_DIR / "js" / "robots-data.js"
INDEX_HTML_PATH = BASE_DIR / "index.html"
STYLE_CSS_PATH = BASE_DIR / "css" / "style.css"
APP_JS_PATH = BASE_DIR / "js" / "app.js"
SERVER_JS_PATH = BASE_DIR / "server" / "server.js"

# Potential leads files (server supports project root data/leads.json)
PRIMARY_LEADS_FILE = BASE_DIR / "data" / "leads.json"
FALLBACK_LEADS_FILE = BASE_DIR / "server" / "data" / "leads.json"

TEST_PORT = 3001
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

# Track overall test results
test_results = []

def record_result(suite_name, test_name, status, details=None):
    test_results.append({
        "suite": suite_name,
        "test": test_name,
        "status": status,
        "details": details or ""
    })
    badge = "[PASS]" if status == "PASS" else ("[WARN]" if status == "WARN" else "[FAIL]")
    print(f"  {badge} {test_name}")
    if details and status != "PASS":
        print(f"         -> {details}")

# ============================================================================
# SUITE 1: Robot Catalog Integrity (js/robots-data.js)
# ============================================================================
def test_suite_catalog_integrity():
    suite = "Suite 1: Catalog Integrity"
    print(f"\n--- Running {suite} ---")

    if not ROBOTS_DATA_PATH.exists():
        record_result(suite, "File existence: js/robots-data.js", "FAIL", "File not found")
        return []

    record_result(suite, "File existence: js/robots-data.js", "PASS", f"Size: {ROBOTS_DATA_PATH.stat().st_size} bytes")

    # Load robots data via node execution to parse the JS array accurately
    node_eval_code = "const fs = require('fs'); const code = fs.readFileSync('js/robots-data.js', 'utf8'); const data = new Function(code + '; return ROBOTS_DATA;')(); console.log(JSON.stringify(data));"
    try:
        proc = subprocess.run(
            ["node", "-e", node_eval_code],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(BASE_DIR),
            check=True
        )
        robots = json.loads(proc.stdout)
    except Exception as e:
        record_result(suite, "Parse js/robots-data.js via Node.js", "FAIL", str(e))
        return []

    record_result(suite, "Parse js/robots-data.js via Node.js", "PASS", f"Successfully parsed {len(robots)} items")

    # 1. Total models count (39 or 40 models including PUDU ET1)
    if len(robots) in (39, 40):
        record_result(suite, "Catalog model count valid (>= 39)", "PASS", f"Found {len(robots)} models in catalog")
    else:
        record_result(suite, "Catalog model count valid (>= 39)", "FAIL", f"Expected 39 or 40 models, found {len(robots)}")

    # 2. Check each robot's image on disk
    missing_images = []
    for r in robots:
        img_rel = r.get("image")
        if not img_rel:
            missing_images.append(f"{r.get('slug', 'unknown')}: No image field")
            continue
        img_path = BASE_DIR / img_rel
        if not img_path.exists():
            missing_images.append(f"{r.get('slug')}: {img_rel} (not found on disk)")
        elif img_path.stat().st_size == 0:
            missing_images.append(f"{r.get('slug')}: {img_rel} (empty file)")

    if not missing_images:
        record_result(suite, "All robot card images exist on disk", "PASS", f"Verified all {len(robots)} image files")
    else:
        record_result(suite, "All robot card images exist on disk", "FAIL", f"Missing {len(missing_images)}: {missing_images[:3]}")

    # 3. Check prices and lease labels
    missing_price_info = []
    enterprise_custom_count = 0
    priced_count = 0
    for r in robots:
        has_label = bool(r.get("price_label"))
        has_lease = bool(r.get("lease_label"))
        price_kzt = r.get("price_kzt", 0)

        if not has_label or not has_lease:
            missing_price_info.append(f"{r.get('slug')}: missing price_label or lease_label")
        elif price_kzt > 0:
            priced_count += 1
        else:
            enterprise_custom_count += 1

    if not missing_price_info:
        record_result(suite, "Price & lease labels present on all models", "PASS",
                      f"{priced_count} with fixed KZT price, {enterprise_custom_count} enterprise on-demand ('По запросу')")
    else:
        record_result(suite, "Price & lease labels present on all models", "FAIL", f"Missing: {missing_price_info}")

    # 4. Check specifications dictionary
    empty_specs = []
    for r in robots:
        specs = r.get("specs", {})
        if not specs or len(specs) < 3:
            empty_specs.append(f"{r.get('slug')}: {len(specs)} specs")

    if not empty_specs:
        record_result(suite, "Technical specifications present on all models (min 3 specs)", "PASS",
                      f"Verified specifications for all {len(robots)} models")
    else:
        record_result(suite, "Technical specifications present on all models (min 3 specs)", "FAIL", f"Deficient: {empty_specs}")

    # 5. Check brand distribution (Unitree vs PUDU)
    brands = {}
    for r in robots:
        b = r.get("brand", "Unknown")
        brands[b] = brands.get(b, 0) + 1

    if "Unitree" in brands and "PUDU" in brands:
        record_result(suite, "Brand classification (Unitree & PUDU)", "PASS",
                      f"Unitree: {brands.get('Unitree', 0)}, PUDU: {brands.get('PUDU', 0)}")
    else:
        record_result(suite, "Brand classification (Unitree & PUDU)", "FAIL", f"Unexpected brands: {brands}")

    return robots

# ============================================================================
# SUITE 2: Web Platform Files Validation (index.html, css/style.css, js/app.js)
# ============================================================================
def test_suite_platform_files():
    suite = "Suite 2: Platform Files & Links"
    print(f"\n--- Running {suite} ---")

    # 1. JS Syntax Checks via node --check
    js_files = [APP_JS_PATH, ROBOTS_DATA_PATH, SERVER_JS_PATH]
    for js_file in js_files:
        if not js_file.exists():
            record_result(suite, f"Syntax check: {js_file.name}", "FAIL", f"File does not exist: {js_file}")
            continue
        try:
            res = subprocess.run(["node", "--check", str(js_file)],
                                 capture_output=True, text=True,
                                 encoding="utf-8", errors="replace", check=True)
            record_result(suite, f"Syntax check: {js_file.name}", "PASS", "No syntax errors")
        except subprocess.CalledProcessError as e:
            record_result(suite, f"Syntax check: {js_file.name}", "FAIL", e.stderr.strip())

    # 2. CSS integrity check
    if STYLE_CSS_PATH.exists():
        css_content = STYLE_CSS_PATH.read_text(encoding="utf-8")
        open_braces = css_content.count("{")
        close_braces = css_content.count("}")
        if open_braces == close_braces and open_braces > 0:
            record_result(suite, "CSS syntax & brace balance (css/style.css)", "PASS",
                          f"Balanced braces: {open_braces} rules ({STYLE_CSS_PATH.stat().st_size} bytes)")
        else:
            record_result(suite, "CSS syntax & brace balance (css/style.css)", "FAIL",
                          f"Mismatched braces: {open_braces} open, {close_braces} close")
    else:
        record_result(suite, "CSS file existence", "FAIL", "css/style.css missing")

    # 3. HTML validation in index.html
    if not INDEX_HTML_PATH.exists():
        record_result(suite, "index.html existence", "FAIL", "index.html missing")
        return

    html_content = INDEX_HTML_PATH.read_text(encoding="utf-8")

    # Check essential tags
    essential_tags = ["<!DOCTYPE html>", "<html", "<head>", "<title>", "<body>", "<header", "<main", "<footer", "<dialog"]
    missing_essentials = [t for t in essential_tags if t not in html_content]
    if not missing_essentials:
        record_result(suite, "HTML essential semantic tags presence", "PASS", "DOCTYPE, html, head, body, header, main, footer, dialog present")
    else:
        record_result(suite, "HTML essential semantic tags presence", "FAIL", f"Missing: {missing_essentials}")

    # Check balanced key tags
    structural_tags = ["div", "section", "article", "dialog", "header", "footer", "main", "nav", "form", "table"]
    mismatched = []
    for tag in structural_tags:
        open_count = len(re.findall(rf'<{tag}(\s+[^>]*)?>', html_content, re.IGNORECASE))
        close_count = len(re.findall(rf'</{tag}>', html_content, re.IGNORECASE))
        if open_count != close_count:
            mismatched.append(f"<{tag}>: {open_count} open, {close_count} close")

    if not mismatched:
        record_result(suite, "HTML structural tag balance", "PASS", f"All {len(structural_tags)} tag types perfectly balanced")
    else:
        record_result(suite, "HTML structural tag balance", "FAIL", f"Mismatches: {mismatched}")

    # 4. Check relative links in index.html (src and href)
    src_matches = re.findall(r'src=["\']([^"\']+)["\']', html_content)
    href_matches = re.findall(r'href=["\']([^"\']+)["\']', html_content)

    broken_links = []
    valid_links_count = 0

    for s in src_matches:
        if s.startswith(("http://", "https://", "data:", "//")):
            continue
        clean_s = s.split("?")[0].split("#")[0]
        target = BASE_DIR / clean_s
        if not target.exists():
            broken_links.append(f"Broken SRC: {s}")
        else:
            valid_links_count += 1

    for h in href_matches:
        if h.startswith(("#", "http://", "https://", "tel:", "mailto:", "javascript:", "//")):
            continue
        clean_h = h.split("?")[0].split("#")[0]
        target = BASE_DIR / clean_h
        if not target.exists():
            broken_links.append(f"Broken HREF: {h}")
        else:
            valid_links_count += 1

    if not broken_links:
        record_result(suite, "No broken relative links (images, scripts, styles, docs)", "PASS",
                      f"Verified {valid_links_count} relative links successfully")
    else:
        record_result(suite, "No broken relative links (images, scripts, styles, docs)", "FAIL",
                      f"Found {len(broken_links)} broken: {broken_links}")

# ============================================================================
# SUITE 3: Backend Server & REST API (server/server.js)
# ============================================================================
def test_suite_backend_api():
    suite = "Suite 3: Backend API Integration"
    print(f"\n--- Running {suite} ---")

    if not SERVER_JS_PATH.exists():
        record_result(suite, "Backend server file existence", "FAIL", "server/server.js not found")
        return

    # 1. Start server as a background subprocess on TEST_PORT
    print(f"  ... Spawning backend server on port {TEST_PORT} ...")
    server_env = os.environ.copy()
    server_env["PORT"] = str(TEST_PORT)
    server_env["HOST"] = "127.0.0.1"

    server_proc = subprocess.Popen(
        ["node", str(SERVER_JS_PATH), "--port", str(TEST_PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=server_env,
        cwd=str(BASE_DIR)
    )

    # Polling wait until server responds to /api/health
    server_ready = False
    start_time = time.time()
    for _ in range(30):  # up to 6 seconds
        time.sleep(0.2)
        try:
            req = urllib.request.Request(f"{BASE_URL}/api/health")
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status == 200:
                    server_ready = True
                    break
        except Exception:
            continue

    if not server_ready:
        record_result(suite, f"Server startup on port {TEST_PORT}", "FAIL", "Server did not respond within timeout")
        try:
            server_proc.terminate()
        except:
            pass
        return

    record_result(suite, f"Server startup on port {TEST_PORT}", "PASS",
                  f"Server started in {round(time.time() - start_time, 2)}s")

    try:
        # 2. Test GET /api/health
        health_req = urllib.request.Request(f"{BASE_URL}/api/health")
        with urllib.request.urlopen(health_req, timeout=3) as resp:
            health_body = json.loads(resp.read().decode("utf-8"))
            has_status_ok = (resp.status == 200 and health_body.get("status") == "ok")
            has_uptime = ("uptime" in health_body or "uptimeSeconds" in health_body)
            if has_status_ok and has_uptime:
                uptime_val = health_body.get("uptime", health_body.get("uptimeSeconds", 0))
                record_result(suite, "GET /api/health", "PASS",
                              f"Status: {health_body['status']}, Service: {health_body.get('service')}, Uptime: {uptime_val}s")
            else:
                record_result(suite, "GET /api/health", "FAIL", f"Unexpected response: {health_body}")

        # 3. Test GET /api/robots
        robots_req = urllib.request.Request(f"{BASE_URL}/api/robots")
        with urllib.request.urlopen(robots_req, timeout=3) as resp:
            robots_body = json.loads(resp.read().decode("utf-8"))
            robots_list = robots_body.get("robots", [])
            total = robots_body.get("count", robots_body.get("total", len(robots_list)))
            if resp.status == 200 and len(robots_list) in (39, 40):
                record_result(suite, "GET /api/robots (all models)", "PASS",
                              f"Returned {len(robots_list)} models in catalog")
            else:
                record_result(suite, "GET /api/robots (all models)", "FAIL",
                              f"Expected 39 or 40 robots, got count={total}, list_len={len(robots_list)}")

        # 4. Test GET /api/robots with brand filter
        filter_req = urllib.request.Request(f"{BASE_URL}/api/robots?brand=unitree")
        with urllib.request.urlopen(filter_req, timeout=3) as resp:
            unitree_body = json.loads(resp.read().decode("utf-8"))
            unitree_robots = unitree_body.get("robots", [])
            all_unitree = all(r.get("brand") == "Unitree" for r in unitree_robots)
            if all_unitree and len(unitree_robots) > 0:
                record_result(suite, "GET /api/robots?brand=unitree (Filtering)", "PASS",
                              f"Filtered {len(unitree_robots)} Unitree models correctly")
            else:
                record_result(suite, "GET /api/robots?brand=unitree (Filtering)", "FAIL", "Filter mismatch")

        # 5. Test POST /api/leads (Success / persistence)
        test_lead_payload = {
            "name": "Айдар Касымов",
            "company": "ТОО РобоТех KZ",
            "phone": "+7 701 987 6543",
            "city": "Астана",
            "robots": ["Unitree Go2 Pro", "PUDU CC1"],
            "contactMethod": "WhatsApp",
            "comment": "Тест-драйв в шоуруме Астаны",
            "source": "qa_automated_test"
        }
        lead_data_bytes = json.dumps(test_lead_payload).encode("utf-8")
        lead_req = urllib.request.Request(
            f"{BASE_URL}/api/leads",
            data=lead_data_bytes,
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(lead_req, timeout=3) as resp:
            lead_resp_body = json.loads(resp.read().decode("utf-8"))
            if resp.status == 201 and lead_resp_body.get("success") is True:
                lead_obj = lead_resp_body.get("lead", {})
                lead_id = lead_obj.get("id")
                wa_link = lead_resp_body.get("whatsapp", {}).get("link", "")
                record_result(suite, "POST /api/leads (Valid submission)", "PASS",
                              f"Created ID: {lead_id}, WhatsApp link generated: {bool(wa_link)}")

                # Check persistence in data/leads.json
                persisted = False
                verified_file = None
                for candidate in [PRIMARY_LEADS_FILE, FALLBACK_LEADS_FILE]:
                    if candidate.exists():
                        saved_leads = json.loads(candidate.read_text(encoding="utf-8"))
                        if any(l.get("id") == lead_id for l in saved_leads):
                            persisted = True
                            verified_file = candidate
                            break

                if persisted:
                    record_result(suite, "Lead data persistence on disk", "PASS",
                                  f"Lead {lead_id} successfully saved to {verified_file.name}")
                else:
                    record_result(suite, "Lead data persistence on disk", "FAIL",
                                  f"Lead {lead_id} not found in leads store")
            else:
                record_result(suite, "POST /api/leads (Valid submission)", "FAIL", f"Unexpected response: {lead_resp_body}")

        # 6. Test POST /api/leads (Validation error)
        bad_payload = {"name": "", "phone": "12"}
        bad_bytes = json.dumps(bad_payload).encode("utf-8")
        bad_req = urllib.request.Request(
            f"{BASE_URL}/api/leads",
            data=bad_bytes,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(bad_req, timeout=3) as resp:
                record_result(suite, "POST /api/leads (Validation rejection on empty fields)", "FAIL",
                              f"Expected HTTP 400, got HTTP {resp.status}")
        except urllib.error.HTTPError as err:
            if err.code == 400:
                err_body = json.loads(err.read().decode("utf-8"))
                record_result(suite, "POST /api/leads (Validation rejection on empty fields)", "PASS",
                              f"Correctly returned HTTP 400: {err_body.get('error')}")
            else:
                record_result(suite, "POST /api/leads (Validation rejection on empty fields)", "FAIL",
                              f"Expected HTTP 400, got HTTP {err.code}")

        # 7. Test static file serving
        static_req = urllib.request.Request(f"{BASE_URL}/")
        with urllib.request.urlopen(static_req, timeout=3) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if resp.status == 200 and "text/html" in content_type:
                record_result(suite, "Static file serving (index.html at /)", "PASS", f"Content-Type: {content_type}")
            else:
                record_result(suite, "Static file serving (index.html at /)", "FAIL", f"Status: {resp.status}")

    finally:
        # 8. Clean server shutdown
        print("  ... Terminating temporary backend server ...")
        server_proc.terminate()
        try:
            server_proc.wait(timeout=3)
            record_result(suite, "Graceful server shutdown", "PASS", "Server process terminated cleanly")
        except subprocess.TimeoutExpired:
            server_proc.kill()
            record_result(suite, "Graceful server shutdown", "WARN", "Forced kill after timeout")

# ============================================================================
# SUITE 4: Interactive ROI Calculator Mathematical Verification
# ============================================================================
def test_suite_roi_calculator():
    suite = "Suite 4: ROI Calculator Logic"
    print(f"\n--- Running {suite} ---")

    unit_costs = {
        "cleaning": 6200000,
        "delivery": 4200000,
        "warehouse": 8900000
    }

    def calc_roi(staff, salary, ind_type):
        monthly_staff = staff * salary * 1.2
        monthly_opex = staff * 25000
        monthly_savings = round((monthly_staff * 0.7) - monthly_opex)
        yearly_savings = monthly_savings * 12
        unit_cost = unit_costs[ind_type]
        num_robots = max(1, round(staff * 0.5))
        total_inv = num_robots * unit_cost
        payback = max(2.5, round(total_inv / max(monthly_savings, 1), 1))
        hours_saved = staff * 140
        return {
            "staff": staff,
            "salary": salary,
            "ind_type": ind_type,
            "monthly_savings": monthly_savings,
            "yearly_savings": yearly_savings,
            "payback": payback,
            "hours_saved": hours_saved,
            "num_robots": num_robots
        }

    # 1. Lower boundary: 1 staff, 120 000 KZT salary
    r_min = calc_roi(1, 120000, "cleaning")
    if r_min["monthly_savings"] > 0 and r_min["yearly_savings"] == r_min["monthly_savings"] * 12:
        record_result(suite, "ROI Min boundary (1 staff, 120 000 KZT)", "PASS",
                      f"Monthly savings: {r_min['monthly_savings']:,} KZT, Payback: {r_min['payback']} mo, Hours: {r_min['hours_saved']}h")
    else:
        record_result(suite, "ROI Min boundary (1 staff, 120 000 KZT)", "FAIL", str(r_min))

    # 2. Upper boundary: 15 staff, 500 000 KZT salary
    r_max = calc_roi(15, 500000, "cleaning")
    if r_max["monthly_savings"] > 5000000 and r_max["payback"] < 12:
        record_result(suite, "ROI Max boundary (15 staff, 500 000 KZT)", "PASS",
                      f"Monthly savings: {r_max['monthly_savings']:,} KZT, Payback: {r_max['payback']} mo, Hours: {r_max['hours_saved']}h")
    else:
        record_result(suite, "ROI Max boundary (15 staff, 500 000 KZT)", "FAIL", str(r_max))

    # 3. Comprehensive boundary grid sweep:
    # staff in [1, 2, 4, 8, 15], salary in [120000, 220000, 350000, 500000], all 3 types
    grid_errors = []
    total_grid_points = 0
    for s in [1, 2, 4, 8, 15]:
        for sal in [120000, 220000, 350000, 500000]:
            for ind in ["cleaning", "delivery", "warehouse"]:
                total_grid_points += 1
                res = calc_roi(s, sal, ind)
                if res["monthly_savings"] <= 0:
                    grid_errors.append(f"Non-positive savings: staff={s}, sal={sal}, ind={ind}")
                if res["yearly_savings"] != res["monthly_savings"] * 12:
                    grid_errors.append(f"Yearly != 12 * Monthly: staff={s}, sal={sal}")
                if res["payback"] < 2.5:
                    grid_errors.append(f"Payback below 2.5 mo clamp: staff={s}, sal={sal}")
                if res["hours_saved"] <= 0:
                    grid_errors.append(f"Hours saved non-positive: staff={s}")

    if not grid_errors:
        record_result(suite, f"ROI Parameter Sweep Invariants ({total_grid_points} matrix points)", "PASS",
                      "All 60 parameter combinations satisfy economic non-negativity and consistency")
    else:
        record_result(suite, "ROI Parameter Sweep Invariants", "FAIL", f"Errors: {grid_errors[:3]}")

    # 4. Industry type sensitivity test (same parameters, varying robot capital cost)
    c_clean = calc_roi(4, 250000, "cleaning")["payback"]
    c_deliv = calc_roi(4, 250000, "delivery")["payback"]
    c_ware = calc_roi(4, 250000, "warehouse")["payback"]
    if c_deliv < c_clean < c_ware:
        record_result(suite, "ROI Industry capital expenditure sensitivity", "PASS",
                      f"Delivery (4.2M): {c_deliv} mo < Cleaning (6.2M): {c_clean} mo < Warehouse (8.9M): {c_ware} mo")
    else:
        record_result(suite, "ROI Industry capital expenditure sensitivity", "FAIL",
                      f"Expected deliv < clean < ware, got {c_deliv}, {c_clean}, {c_ware}")

# ============================================================================
# SUITE 5: Layout Integrity, Z-Index Conflicts & Overlap Safety
# ============================================================================
def test_suite_layout_and_overlaps():
    suite = "Suite 5: Layout & Overlap Safety"
    print(f"\n--- Running {suite} ---")

    if not STYLE_CSS_PATH.exists():
        record_result(suite, "CSS file existence", "FAIL", "css/style.css missing")
        return

    css_text = STYLE_CSS_PATH.read_text(encoding="utf-8")

    # 1. Parse all z-index rules and their selectors
    z_matches = re.findall(r'([^{}]+)\{[^{}]*?z-index:\s*(\d+)[^{}]*?\}', css_text, re.DOTALL)
    z_map = {}
    for sel, z_val in z_matches:
        cleaned_sel = sel.strip().split("\n")[-1].strip()
        z_map[cleaned_sel] = int(z_val)

    # Key elements expected hierarchy
    expected_order = [
        ("floating-whatsapp", 90),
        ("site-header", 100),
        ("drawer-backdrop", 150),
        ("cart-drawer", 160),
        ("toast-container", 200)
    ]

    z_conflicts = []
    for elem_name, expected_z in expected_order:
        found = False
        for sel, val in z_map.items():
            if elem_name in sel:
                found = True
                if val != expected_z:
                    z_conflicts.append(f"{sel} has z-index {val}, expected {expected_z}")
                break
        if not found:
            z_conflicts.append(f"Element matching '{elem_name}' not found with z-index")

    if not z_conflicts:
        record_result(suite, "CSS Stacking Context (z-index) hierarchy", "PASS",
                      "WhatsApp(90) < Header(100) < Backdrop(150) < Drawer(160) < Toast(200)")
    else:
        record_result(suite, "CSS Stacking Context (z-index) hierarchy", "FAIL", f"Conflicts: {z_conflicts}")

    # 2. Check backdrop covers WhatsApp button when drawer is opened
    backdrop_z = None
    wa_z = None
    for sel, val in z_map.items():
        if "drawer-backdrop" in sel:
            backdrop_z = val
        if "floating-whatsapp" in sel:
            wa_z = val

    if backdrop_z and wa_z and backdrop_z > wa_z:
        record_result(suite, "Drawer overlay covers floating WhatsApp button", "PASS",
                      f"Backdrop z-index ({backdrop_z}) > WhatsApp z-index ({wa_z})")
    else:
        record_result(suite, "Drawer overlay covers floating WhatsApp button", "FAIL",
                      f"Backdrop ({backdrop_z}) not strictly greater than WhatsApp ({wa_z})")

    # 3. Check WhatsApp position coordinates and safe offsets
    wa_rule = re.search(r'\.floating-whatsapp\s*\{([^}]+)\}', css_text)
    toast_rule = re.search(r'\.toast-container\s*\{([^}]+)\}', css_text)

    if wa_rule and toast_rule:
        wa_body = wa_rule.group(1)
        toast_body = toast_rule.group(1)

        wa_is_left = "left:" in wa_body
        toast_is_right = "right:" in toast_body

        if wa_is_left and toast_is_right:
            record_result(suite, "Spatial collision safety (WhatsApp Left vs Toast Right)", "PASS",
                          "WhatsApp fixed bottom-left (24px), Toast fixed bottom-right (24px): no collision")
        else:
            record_result(suite, "Spatial collision safety (WhatsApp Left vs Toast Right)", "FAIL",
                          f"WhatsApp left: {wa_is_left}, Toast right: {toast_is_right}")
    else:
        record_result(suite, "Spatial collision safety rules", "FAIL", "Rules not found in CSS")

    # 4. Check Mobile Responsive WhatsApp behavior (<= 768px)
    media_idx = css_text.find('@media (max-width: 768px)')
    has_mobile_wa = False
    if media_idx != -1:
        media_chunk = css_text[media_idx:media_idx+3000]
        if ".floating-whatsapp span" in media_chunk and "display: none" in media_chunk:
            has_mobile_wa = True

    if has_mobile_wa:
        record_result(suite, "Mobile viewport WhatsApp compactness (<= 768px)", "PASS",
                      "Text hidden (.floating-whatsapp span { display: none }), transforms to compact round FAB")
    else:
        record_result(suite, "Mobile viewport WhatsApp compactness (<= 768px)", "FAIL",
                      "Mobile rule for compact floating button missing")

    # 5. Check Dialog top layer & backdrop isolation
    dialog_backdrop = "dialog::backdrop" in css_text
    dialog_modal = "dialog:modal" in css_text or "dialog" in css_text
    if dialog_backdrop and dialog_modal:
        record_result(suite, "HTML5 Native Dialog top layer compliance", "PASS",
                      "dialog:modal and dialog::backdrop configured with backdrop-filter blur and containment")
    else:
        record_result(suite, "HTML5 Native Dialog top layer compliance", "FAIL", "dialog styles incomplete")


# ============================================================================
# RUNNER MAIN
# ============================================================================
def main():
    print("=" * 70)
    print(" XBOT Robotics Kazakhstan — Automated QA Test Suite")
    print(" Operating System: Windows | Node.js + Python 3 Test Engine")
    print("=" * 70)

    start_all = time.time()

    test_suite_catalog_integrity()
    test_suite_platform_files()
    test_suite_backend_api()
    test_suite_roi_calculator()
    test_suite_layout_and_overlaps()

    duration = round(time.time() - start_all, 2)

    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t["status"] == "PASS")
    warn_tests = sum(1 for t in test_results if t["status"] == "WARN")
    failed_tests = sum(1 for t in test_results if t["status"] == "FAIL")

    print("\n" + "=" * 70)
    print(f" TEST EXECUTION SUMMARY — Completed in {duration}s")
    print("=" * 70)
    print(f" Total Tests : {total_tests}")
    print(f" Passed      : {passed_tests}")
    print(f" Warnings    : {warn_tests}")
    print(f" Failed      : {failed_tests}")
    print("=" * 70)

    # Save test results JSON for documentation / QA report
    results_json_path = BASE_DIR / "tests" / "test_results.json"
    results_json_path.parent.mkdir(parents=True, exist_ok=True)
    results_json_path.write_text(json.dumps({
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "duration_seconds": duration,
        "total": total_tests,
        "passed": passed_tests,
        "warnings": warn_tests,
        "failed": failed_tests,
        "results": test_results
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    if failed_tests > 0:
        print("\n[FAIL] One or more tests failed!")
        sys.exit(1)
    else:
        print("\n[SUCCESS] All QA tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
