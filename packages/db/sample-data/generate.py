"""Synthetic but realistic operating data for a 10-mall Indian portfolio.

Every mall, brand, company, GSTIN and person here is fictional. Ranges are
calibrated to public benchmarks (see README.md). Period: Oct 2025 - Sep 2026.

Run: python3 generate.py  -> writes csv/*.csv and mall_pms_sample_data.xlsx
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

SEED = 42
rng = np.random.default_rng(SEED)
OUT = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(OUT, "csv")
os.makedirs(CSV, exist_ok=True)

START = date(2025, 10, 1)
END = date(2026, 9, 30)
TODAY = date(2026, 10, 20)
MONTHS = pd.period_range("2025-10", "2026-09", freq="M")

# Festival and sale peaks that move footfall and sales in India.
PEAKS = {
    date(2025, 10, 20): 1.9, date(2025, 10, 21): 1.7,  # Diwali 2025
    date(2025, 12, 25): 1.6, date(2025, 12, 31): 1.7, date(2026, 1, 1): 1.5,
    date(2026, 3, 4): 1.3,  # Holi
    date(2026, 3, 21): 1.4,  # Eid al-Fitr (approx.)
    date(2026, 8, 15): 1.4,  # Independence Day sales
}
MONTH_SEASON = {10: 1.25, 11: 1.15, 12: 1.2, 1: 1.0, 2: 0.9, 3: 0.95,
                4: 0.9, 5: 0.95, 6: 0.95, 7: 0.85, 8: 1.0, 9: 0.95}

# ---------------------------------------------------------------- malls
MALLS = [
    # id, name, city, state, state_code, tier, opened
    ("M01", "Aurum Central", "Mumbai", "Maharashtra", "27", "metro", 2011),
    ("M02", "Saffron Square", "Gurugram", "Haryana", "06", "metro", 2014),
    ("M03", "Banyan Grove Mall", "Bengaluru", "Karnataka", "29", "metro", 2012),
    ("M04", "Pearl Bay Mall", "Hyderabad", "Telangana", "36", "metro", 2016),
    ("M05", "Coromandel Galleria", "Chennai", "Tamil Nadu", "33", "metro", 2013),
    ("M06", "Sahyadri Plaza", "Pune", "Maharashtra", "27", "metro", 2015),
    ("M07", "Sabarmati Walk", "Ahmedabad", "Gujarat", "24", "tier2", 2017),
    ("M08", "Pink City Arcade", "Jaipur", "Rajasthan", "08", "tier2", 2018),
    ("M09", "Awadh Crossing", "Lucknow", "Uttar Pradesh", "09", "tier2", 2019),
    ("M10", "Malabar Promenade", "Kochi", "Kerala", "32", "tier2", 2020),
]
TIER = {"metro": dict(density=(950, 1450), cam=(36, 55), mg=1.0, foot=(26000, 44000)),
        "tier2": dict(density=(550, 850), cam=(22, 36), mg=0.6, foot=(12000, 22000))}

# ---------------------------------------------------------------- unit mix
# category: (count per mall, carpet sq ft range, MG psf/month metro, rev share %, sales multiplier)
MIX = {
    "Department store anchor": (3, (25000, 45000), (55, 90), (7, 9), 0.55),
    "Hypermarket": (1, (30000, 45000), (35, 55), (3, 4), 0.7),
    "Multiplex": (1, (40000, 55000), (45, 70), (10, 14), 0.45),
    "Family entertainment": (2, (10000, 20000), (60, 90), (12, 15), 0.5),
    "Large format fashion": (14, (5000, 10000), (110, 180), (9, 12), 0.9),
    "Fashion and apparel": (158, (600, 2500), (170, 320), (10, 14), 1.1),
    "Footwear and accessories": (46, (500, 1600), (180, 300), (11, 14), 1.05),
    "Electronics": (14, (1200, 4500), (140, 240), (4, 6), 1.6),
    "Beauty and wellness": (35, (400, 1500), (200, 330), (12, 15), 1.0),
    "Jewellery and watches": (16, (500, 1800), (220, 380), (5, 8), 2.2),
    "Home and lifestyle": (20, (1200, 4000), (120, 200), (10, 13), 0.75),
    "Restaurant and cafe": (55, (1000, 3000), (150, 260), (12, 16), 0.95),
    "Food court counter": (28, (150, 350), (300, 500), (15, 20), 1.8),
    "Services and banking": (16, (300, 1500), (180, 280), (0, 0), 0.0),
    "Kiosk / RMU": (60, (40, 150), (450, 800), (0, 0), 0.0),
    "Luxury and premium": (12, (1200, 3500), (250, 420), (15, 17), 1.4),
}
LEVELS = ["LG", "G", "F1", "F2", "F3"]
ZONES = ["North Atrium", "South Atrium", "East Wing", "West Wing", "Central Court"]
LOADING = (1.35, 1.6)  # super area / carpet area

# Fictional brand stems, combined per category.
STEMS = ["Indigo", "Kesar", "Monsoon", "Tara", "Vayu", "Neel", "Ruhi", "Zeal", "Orchid",
         "Saanjh", "Lotus", "Mitti", "Vista", "Rang", "Kaveri", "Nimbu", "Arka", "Charu",
         "Dhara", "Ira", "Jhoola", "Kiran", "Lehar", "Mayur", "Noor", "Paras", "Rivaa",
         "Sitara", "Tulsi", "Urvi", "Veda", "Yatra", "Zara-ka", "Amber", "Banjara", "Chai",
         "Desi", "Elan", "Firaki", "Gulmohar", "Hira", "Ikat", "Jugnu", "Khadi", "Laya"]
SUFFIX = {
    "Department store anchor": ["Department Store", "Life", "Central"],
    "Hypermarket": ["Mart", "Bazaar", "Fresh"],
    "Multiplex": ["Cinemas", "Screens"],
    "Family entertainment": ["Funzone", "Play"],
    "Large format fashion": ["Studio", "Megastore"],
    "Fashion and apparel": ["Threads", "Couture", "Denim Co", "Ethnic", "Wear", "Label"],
    "Footwear and accessories": ["Footwear", "Steps", "Bags", "Eyewear"],
    "Electronics": ["Digital", "Electronics", "Tech"],
    "Beauty and wellness": ["Beauty", "Salon", "Naturals", "Spa"],
    "Jewellery and watches": ["Jewellers", "Watches", "Gems"],
    "Home and lifestyle": ["Home", "Living", "Decor"],
    "Restaurant and cafe": ["Kitchen", "Cafe", "Brewery", "Dhaba", "Bistro"],
    "Food court counter": ["Express", "Rolls", "Biryani", "Dosa Hut", "Chaat"],
    "Services and banking": ["Bank ATM", "Forex", "Pharmacy", "Opticals"],
    "Kiosk / RMU": ["Cases", "Candles", "Perfumes", "Toys", "Accessories"],
    "Luxury and premium": ["Maison", "Atelier", "Luxe"],
}


def rint(lo, hi):
    return int(rng.integers(lo, hi + 1))


def runi(lo, hi, nd=2):
    return round(float(rng.uniform(lo, hi)), nd)


# ---------------------------------------------------------------- build brands
brands = []
for cat, sfx in SUFFIX.items():
    n = {"Department store anchor": 6, "Hypermarket": 3, "Multiplex": 3,
         "Family entertainment": 3}.get(cat, max(8, MIX[cat][0] // 2))
    used = set()
    while len([b for b in brands if b["category"] == cat]) < n:
        name = f"{rng.choice(STEMS)} {rng.choice(sfx)}"
        if name in used:
            continue
        used.add(name)
        bid = f"B{len(brands) + 1:04d}"
        brands.append(dict(brand_id=bid, brand_name=name, category=cat,
                           legal_entity=f"{name.split()[0]} Retail Pvt Ltd",
                           pan=f"AA{'ABCDEFGHJK'[len(brands) % 10]}C{rng.integers(1000, 9999)}{chr(65 + len(brands) % 26)}",
                           national_brand=bool(rng.random() < 0.7)))
brands_df = pd.DataFrame(brands)
by_cat = {c: brands_df[brands_df.category == c].brand_id.tolist() for c in MIX}

# ---------------------------------------------------------------- malls, units, leases
malls, units, leases = [], [], []
for mid, name, city, state, sc, tier, opened in MALLS:
    t = TIER[tier]
    malls.append(dict(mall_id=mid, mall_name=name, city=city, state=state, tier=tier,
                      opened_year=opened, gstin=f"{sc}ZZTST{mid[1:]}00F1Z{mid[-1]}",
                      levels=len(LEVELS), parking_bays=rint(1800, 3500) if tier == "metro" else rint(900, 1800),
                      operating_hours="10:00-22:00", density_target_pspm=rint(*t["density"]),
                      cam_rate_psf_month=runi(*t["cam"], 1)))
    mall_density = malls[-1]["density_target_pspm"]
    mall_cam = malls[-1]["cam_rate_psf_month"]
    occupancy = runi(0.90, 0.97) if tier == "metro" else runi(0.86, 0.94)
    seq = 0
    for cat, (cnt, area, mg, rs, smult) in MIX.items():
        cnt = max(1, int(round(cnt * rng.uniform(0.95, 1.12)))) if cnt > 2 else cnt
        for _ in range(cnt):
            seq += 1
            lvl = rng.choice(LEVELS, p=[0.12, 0.3, 0.25, 0.2, 0.13])
            if cat in ("Multiplex", "Family entertainment", "Food court counter"):
                lvl = "F3"
            if cat == "Hypermarket":
                lvl = "LG"
            carpet = rint(*area)
            superA = round(carpet * rng.uniform(*LOADING))
            uid = f"{mid}-{lvl}-{seq:03d}"
            anchor = cat in ("Department store anchor", "Hypermarket", "Multiplex")
            r = rng.random()
            status = "Occupied" if (anchor or r < occupancy) else ("Fit-out" if r < occupancy + 0.02 else "Vacant")
            units.append(dict(unit_id=uid, mall_id=mid, level=lvl, zone=rng.choice(ZONES),
                              unit_type="Kiosk" if cat == "Kiosk / RMU" else ("Anchor" if anchor else "Inline"),
                              category=cat, carpet_area_sqft=carpet, super_area_sqft=superA,
                              frontage_ft=round(np.sqrt(carpet) * rng.uniform(0.4, 0.8), 1),
                              status=status))
            if status == "Vacant":
                continue
            start = date(rint(max(opened, 2019), 2026), rint(1, 12), 1)
            if start > TODAY:
                start = date(2026, rint(1, 9), 1)
            term = 9 if anchor else int(rng.choice([3, 5, 6, 9], p=[0.35, 0.3, 0.2, 0.15]))
            end = date(start.year + term, start.month, 1) - timedelta(days=1)
            if end < TODAY:  # roll expired leases forward as renewals
                start = date(end.year + 1, start.month, 1)
                end = date(start.year + 3, start.month, 1) - timedelta(days=1)
            mg_psf = round(rng.uniform(*mg) * (t["mg"] if not anchor else max(t["mg"], 0.75)), 0)
            rs_pct = round(float(rng.uniform(*rs)), 1) if rs[1] else 0.0
            leases.append(dict(
                lease_id=f"L{len(leases) + 1:05d}", unit_id=uid, mall_id=mid,
                brand_id=str(rng.choice(by_cat[cat])), status="Fit-out" if status == "Fit-out" else "Active",
                start_date=start, end_date=end, lock_in_months=36 if not anchor else 60,
                rent_model="Fixed" if rs_pct == 0 else "Higher of MG or revenue share",
                mg_rent_psf_month=mg_psf, revenue_share_pct=rs_pct,
                area_basis_rent="carpet", cam_psf_month=mall_cam, area_basis_cam="super",
                escalation_pct=15 if term >= 3 else 0, escalation_every_years=3,
                security_deposit_months=int(rng.choice([3, 6, 6, 9])),
                fit_out_rent_free_days=int(rng.choice([30, 45, 60, 90])),
                gst_pct=18, tds_section="194-I", tds_pct=10,
                sales_multiplier=smult, density=mall_density))

malls_df = pd.DataFrame(malls)
units_df = pd.DataFrame(units)
leases_df = pd.DataFrame(leases)
area = units_df.groupby("mall_id").super_area_sqft.sum()
malls_df["gla_super_sqft"] = malls_df.mall_id.map(area)
malls_df["unit_count"] = malls_df.mall_id.map(units_df.groupby("mall_id").size())

# ---------------------------------------------------------------- monthly tenant sales
carpet = units_df.set_index("unit_id").carpet_area_sqft
# Planted stories for the Tenant Health Score and under-reporting checks.
active = leases_df[(leases_df.status == "Active") & (leases_df.sales_multiplier > 0)]
declining = set(rng.choice(active.lease_id, size=60, replace=False))
underreport = set(rng.choice(sorted(set(active.lease_id) - declining), size=25, replace=False))
sales = []
for l in active.itertuples():
    base = l.density * l.sales_multiplier * carpet[l.unit_id] * rng.lognormal(0, 0.25)
    for i, p in enumerate(MONTHS):
        if pd.Timestamp(l.start_date).to_period("M") > p:
            continue
        trend = 1 - 0.035 * i if l.lease_id in declining else 1 + 0.004 * i
        v = base * MONTH_SEASON[p.month] * trend * rng.normal(1, 0.06)
        reported = v * (0.72 if l.lease_id in underreport and i >= 5 else 1)
        sales.append(dict(lease_id=l.lease_id, mall_id=l.mall_id, month=str(p),
                          gross_sales_inr=round(max(v, 0)), reported_sales_inr=round(max(reported, 0)),
                          source=str(rng.choice(["POS API", "POS API", "Manual upload"])),
                          bills_count=int(max(v, 0) / rng.uniform(900, 4500))))
sales_df = pd.DataFrame(sales)

# ---------------------------------------------------------------- footfall (daily)
foot = []
for m in malls:
    lo, hi = TIER[m["tier"]]["foot"]
    base = rng.uniform(lo, hi)
    d = START
    while d <= END:
        f = base * MONTH_SEASON[d.month] * (1.45 if d.weekday() >= 5 else 1.0) * PEAKS.get(d, 1.0)
        f *= rng.normal(1, 0.07)
        cnt = int(f)
        foot.append(dict(mall_id=m["mall_id"], date=d, footfall=cnt,
                         peak_hour=str(rng.choice(["18:00", "19:00", "20:00"] if d.weekday() < 5 else ["16:00", "17:00", "18:00"])),
                         avg_dwell_min=round(rng.normal(95 if d.weekday() >= 5 else 70, 8)),
                         vehicles_in=int(cnt * rng.uniform(0.08, 0.14))))
        d += timedelta(days=1)
foot_df = pd.DataFrame(foot)

# ---------------------------------------------------------------- assets
ASSETS = {
    # type: (count range, make options, ppm frequency, ppm task, criticality, reactive WOs per unit per year)
    "Chiller": ((4, 8), ["Carrier", "Trane", "Daikin", "Blue Star"], "Monthly", "Condenser tube cleaning, refrigerant check", "Critical", 3),
    "Cooling tower": ((4, 8), ["Paharpur", "Mihir"], "Monthly", "Fill and basin cleaning, water treatment", "High", 1.5),
    "AHU": ((60, 130), ["Zeco", "Edgetech", "Daikin"], "Monthly", "Filter cleaning, belt check", "High", 1.2),
    "Escalator": ((18, 40), ["Kone", "Otis", "Schindler", "Mitsubishi"], "Monthly", "Step chain and comb plate inspection", "Critical", 4),
    "Passenger lift": ((10, 24), ["Kone", "Otis", "Schindler", "Johnson"], "Monthly", "Safety gear and door operator check", "Critical", 3),
    "Service lift": ((4, 8), ["Kone", "Otis"], "Monthly", "Door operator and brake check", "High", 3),
    "Travelator": ((0, 4), ["Kone", "Schindler"], "Monthly", "Pallet and handrail check", "High", 3),
    "DG set": ((4, 8), ["Cummins", "Kirloskar", "Caterpillar"], "Fortnightly", "Load test, oil and coolant check", "Critical", 2),
    "Transformer": ((3, 5), ["ABB", "Siemens", "Voltamp"], "Quarterly", "Oil BDV test, IR values", "Critical", 0.5),
    "HT panel": ((2, 4), ["Schneider", "L&T"], "Quarterly", "Thermography, relay test", "Critical", 0.5),
    "Fire pump": ((3, 4), ["Kirloskar", "Grundfos"], "Weekly", "Auto start and pressure test", "Critical", 0.8),
    "Fire alarm panel": ((2, 4), ["Honeywell", "Siemens", "Bosch"], "Monthly", "Detector and hooter test", "Critical", 1),
    "Sprinkler zone": ((40, 80), ["Tyco", "Viking"], "Quarterly", "Flow switch and valve test", "Critical", 0.3),
    "STP": ((1, 2), ["Thermax", "Ion Exchange"], "Weekly", "MLSS, BOD and COD check", "High", 3),
    "Water pump": ((8, 16), ["Grundfos", "KSB"], "Monthly", "Bearing and seal check", "Medium", 1),
    "BMS controller": ((10, 20), ["Honeywell", "Johnson Controls", "Siemens"], "Quarterly", "Point checkout, backup", "Medium", 0.5),
    "CCTV camera": ((350, 700), ["Hikvision", "CP Plus", "Axis", "Bosch"], "Quarterly", "Lens cleaning, recording check", "Medium", 0.15),
    "Access control door": ((30, 60), ["HID", "Honeywell"], "Quarterly", "Reader and lock test", "Medium", 0.3),
    "Boom barrier": ((6, 14), ["FAAC", "Came"], "Monthly", "Arm and loop detector check", "Medium", 1.5),
    "EV charger": ((6, 30), ["Tata Power EZ", "Delta", "ABB"], "Monthly", "Connector and earthing check", "Medium", 1.5),
    "Solar inverter": ((2, 8), ["SMA", "Huawei", "Sungrow"], "Monthly", "Panel cleaning, string check", "Medium", 0.5),
    "Energy meter": ((450, 560), ["Secure", "L&T", "Schneider"], "Yearly", "Calibration check", "Low", 0.05),
}
VENDORS = {
    "HVAC": ["CoolAir Services", "ThermoServ India"], "Vertical transport": ["LiftCare OEM AMC", "Escalon Services"],
    "Electrical": ["Volt Facility Pvt Ltd", "PowerGrid FM"], "Fire": ["SafeFire Systems", "Agni Protect"],
    "Plumbing and STP": ["AquaServe", "BlueDrop Utilities"], "ELV and security": ["SecureVision Integrators", "Sentinel ELV"],
    "Housekeeping": ["Sparkle Facility", "CleanPro Services"], "Civil and carpentry": ["BuildRight Maintenance"],
}
TRADE = {"Chiller": "HVAC", "Cooling tower": "HVAC", "AHU": "HVAC", "BMS controller": "HVAC",
         "Escalator": "Vertical transport", "Passenger lift": "Vertical transport", "Service lift": "Vertical transport",
         "Travelator": "Vertical transport", "DG set": "Electrical", "Transformer": "Electrical", "HT panel": "Electrical",
         "Solar inverter": "Electrical", "Energy meter": "Electrical", "EV charger": "Electrical",
         "Fire pump": "Fire", "Fire alarm panel": "Fire", "Sprinkler zone": "Fire",
         "STP": "Plumbing and STP", "Water pump": "Plumbing and STP",
         "CCTV camera": "ELV and security", "Access control door": "ELV and security", "Boom barrier": "ELV and security"}
vendors_df = pd.DataFrame([dict(vendor_id=f"V{i + 1:03d}", vendor_name=v, trade=t,
                                contract_type=str(rng.choice(["Comprehensive AMC", "Non-comprehensive AMC", "On call"])),
                                sla_response_hrs={"Vertical transport": 1, "Fire": 1, "Electrical": 2}.get(t, 4),
                                gstin=f"27ZZVEN{i + 1:04d}F1Z{i % 10}")
                           for i, (t, vs) in enumerate([(t, v) for t, vl in VENDORS.items() for v in vl])
                           for v in [vs]])
vendor_by_trade = vendors_df.groupby("trade").vendor_id.apply(list).to_dict()

# Three-letter code per asset type, used in asset ids (unique and space-free).
ASSET_CODE = {"Chiller": "CHI", "Cooling tower": "CTW", "AHU": "AHU", "Escalator": "ESC",
              "Passenger lift": "PLF", "Service lift": "SLF", "Travelator": "TRV", "DG set": "DGS",
              "Transformer": "TRF", "HT panel": "HTP", "Fire pump": "FPM", "Fire alarm panel": "FAP",
              "Sprinkler zone": "SPR", "STP": "STP", "Water pump": "WPM", "BMS controller": "BMS",
              "CCTV camera": "CAM", "Access control door": "ACD", "Boom barrier": "BMB",
              "EV charger": "EVC", "Solar inverter": "SOL", "Energy meter": "EMT"}
assert set(ASSET_CODE) == set(ASSETS) and len(set(ASSET_CODE.values())) == len(ASSET_CODE)

assets = []
for m in malls:
    for atype, (cr, makes, freq, task, crit, rate) in ASSETS.items():
        for k in range(rint(*cr)):
            install = date(m["opened_year"] - (1 if atype in ("Transformer", "HT panel") else 0), rint(1, 12), 1)
            if atype in ("EV charger", "Solar inverter") or rng.random() < 0.12:
                install = date(rint(max(m["opened_year"], 2021), 2025), rint(1, 12), 1)
            age = (TODAY - install).days / 365
            health = max(5, min(100, round(rng.normal(92 - age * 2.6, 9))))
            assets.append(dict(asset_id=f"{m['mall_id']}-{ASSET_CODE[atype]}-{k + 1:03d}", mall_id=m["mall_id"],
                               asset_type=atype, trade=TRADE[atype], make=str(rng.choice(makes)),
                               model=f"{atype[:2].upper()}-{rint(100, 990)}",
                               location=f"{rng.choice(LEVELS)} {rng.choice(ZONES)}" if atype not in ("Transformer", "HT panel", "DG set", "STP", "Chiller", "Cooling tower") else str(rng.choice(["Basement plant room", "Terrace", "Utility yard"])),
                               install_date=install, criticality=crit, ppm_frequency=freq, ppm_task=task,
                               amc_vendor_id=str(rng.choice(vendor_by_trade[TRADE[atype]])),
                               warranty_end=install + timedelta(days=730), health_score=health,
                               status="Under repair" if health < 25 and rng.random() < 0.5 else "In service",
                               reactive_rate=rate))
assets_df = pd.DataFrame(assets)
# A few chronic offenders so predictive maintenance has something to find.
chronic = set(rng.choice(assets_df[assets_df.asset_type.isin(["Escalator", "Chiller", "Passenger lift", "DG set"])].asset_id, 30, replace=False))

# ---------------------------------------------------------------- work orders
FREQ_DAYS = {"Weekly": 7, "Fortnightly": 14, "Monthly": 30, "Quarterly": 91, "Yearly": 365}
SLA = {"Emergency": 2, "High": 8, "Medium": 24, "Low": 72}
FAULTS = {
    "Chiller": ["High head pressure trip", "Low chilled water temperature alarm", "Compressor tripped"],
    "Cooling tower": ["Fan motor noise", "Basin overflow"], "AHU": ["Low airflow complaint", "Belt snapped", "Hot zone complaint"],
    "Escalator": ["Emergency stop pressed", "Handrail speed mismatch", "Step chain noise", "Comb plate damaged"],
    "Passenger lift": ["Lift stuck between floors", "Door not closing", "Levelling error"],
    "Service lift": ["Door not closing", "Overload alarm"], "Travelator": ["Handrail stopped"],
    "DG set": ["Failed to start on mains failure", "Low coolant alarm", "Battery weak"],
    "Transformer": ["Oil temperature high"], "HT panel": ["Relay trip"], "Fire pump": ["Jockey pump hunting"],
    "Fire alarm panel": ["False alarm", "Detector fault"], "Sprinkler zone": ["Flow switch fault"],
    "STP": ["Foul smell complaint", "Blower tripped"], "Water pump": ["Seal leakage", "No water in toilets"],
    "BMS controller": ["Points offline"], "CCTV camera": ["Camera offline", "Blurry image"],
    "Access control door": ["Card reader fault"], "Boom barrier": ["Arm not lifting", "Loop detector fault"],
    "EV charger": ["Charger offline", "Payment failure"], "Solar inverter": ["Inverter fault code"],
    "Energy meter": ["Meter not communicating"],
}
TENANT_REQ = ["Store AC not cooling", "Water leakage in store", "Power fluctuation in store", "Shutter jammed",
              "Pest control request", "Signage light not working", "Drain choke in kitchen", "Exhaust not working"]
COST = {"Emergency": (3000, 60000), "High": (1500, 25000), "Medium": (500, 8000), "Low": (0, 3000)}

wos, n = [], 0


def add_wo(m, a, kind, created, title, prio, unit=None):
    global n
    n += 1
    sla = SLA[prio]
    resp_h = max(0.1, rng.gamma(2, sla / 6))
    res_h = resp_h + max(0.2, rng.gamma(2, sla / 7))
    if a is not None and a["asset_id"] in chronic:
        res_h *= 1.6
    closed = created + timedelta(hours=float(res_h))
    open_ = closed > datetime(2026, 9, 30, 23, 59) or (created > datetime(2026, 9, 25) and rng.random() < 0.4)
    wos.append(dict(
        wo_id=f"WO{n:07d}", mall_id=m, asset_id=a["asset_id"] if a is not None else None, unit_id=unit,
        wo_type=kind, trade=a["trade"] if a is not None else ("HVAC" if "AC" in title or "Exhaust" in title else
                                                            "Electrical" if "Power" in title or "light" in title else
                                                            "Plumbing and STP" if "Water" in title or "Drain" in title else
                                                            "Housekeeping" if "Pest" in title else "Civil and carpentry"),
        title=title, priority=prio, source=str(rng.choice(["Tenant app", "BMS alarm", "Patrol", "Help desk"])) if kind != "PPM" else "PPM schedule",
        created_at=created.replace(microsecond=0),
        responded_at=None if open_ and rng.random() < 0.3 else (created + timedelta(hours=float(resp_h))).replace(microsecond=0),
        closed_at=None if open_ else closed.replace(microsecond=0),
        status=("Open" if rng.random() < 0.5 else "In progress") if open_ else "Closed",
        sla_hours=sla, sla_breached=None if open_ else bool(res_h > sla),
        vendor_id=str(rng.choice(vendor_by_trade[a["trade"]])) if a is not None else None,
        labour_cost_inr=0 if open_ else round(rng.uniform(*COST[prio]) * 0.4, -1),
        material_cost_inr=0 if open_ else round(rng.uniform(*COST[prio]) * 0.6 * (rng.random() < 0.6), -1)))


hours = np.arange(8, 23)
days = (END - START).days + 1
for a in assets_df.to_dict("records"):
    m = a["mall_id"]
    # PPM: one WO per cycle; group cameras/meters/sprinklers into one WO per cycle per 50 assets.
    if a["asset_type"] in ("CCTV camera", "Energy meter", "Sprinkler zone", "AHU", "Access control door") and int(a["asset_id"][-3:]) % 25:
        pass
    else:
        step = FREQ_DAYS[a["ppm_frequency"]]
        d = START + timedelta(days=rint(0, step - 1))
        while d <= END:
            add_wo(m, a, "PPM", datetime.combine(d, datetime.min.time()) + timedelta(hours=int(rng.choice([7, 8, 9]))),
                   f"PPM: {a['ppm_task']}", "Low" if a["criticality"] in ("Low", "Medium") else "Medium")
            d += timedelta(days=step)
    rate = a["reactive_rate"] * (4 if a["asset_id"] in chronic else 1) * (1.4 if a["health_score"] < 50 else 1)
    for _ in range(rng.poisson(rate)):
        created = datetime.combine(START + timedelta(days=rint(0, days - 1)), datetime.min.time()) + timedelta(hours=int(rng.choice(hours)), minutes=rint(0, 59))
        prio = "Emergency" if a["criticality"] == "Critical" and rng.random() < 0.35 else str(rng.choice(["High", "Medium", "Low"], p=[0.4, 0.45, 0.15]))
        add_wo(m, a, "Reactive", created, str(rng.choice(FAULTS[a["asset_type"]])), prio)

occ_units = units_df[units_df.status != "Vacant"]
for u in occ_units.itertuples():
    for _ in range(rng.poisson(2.2)):
        created = datetime.combine(START + timedelta(days=rint(0, days - 1)), datetime.min.time()) + timedelta(hours=int(rng.choice(hours)), minutes=rint(0, 59))
        add_wo(u.mall_id, None, "Tenant request", created, str(rng.choice(TENANT_REQ)),
               str(rng.choice(["High", "Medium", "Low"], p=[0.25, 0.55, 0.2])), unit=u.unit_id)
wo_df = pd.DataFrame(wos).sort_values("created_at").reset_index(drop=True)

# ---------------------------------------------------------------- compliance register
COMPLIANCE = [
    ("Fire NOC", "State Fire and Emergency Services", 3), ("Lift and escalator licence", "State Electrical Inspectorate / Lift Inspector", 1),
    ("Consent to Operate (Air and Water)", "State Pollution Control Board", 5), ("DG set emission compliance", "State Pollution Control Board", 1),
    ("Electrical installation approval", "Chief Electrical Inspector", 1), ("Shops and Establishments registration", "Labour Department", 5),
    ("Trade licence", "Municipal Corporation", 1), ("Occupancy certificate", "Development Authority", 0),
    ("Structural stability certificate", "Licensed Structural Engineer", 3), ("Fire safety audit", "Third-party auditor", 1),
    ("Mock fire drill", "Internal / Fire Services", 0.25), ("Pressure vessel test (air receivers)", "Competent person", 1),
    ("Potable water test", "NABL lab", 0.25), ("STP treated water test", "NABL lab", 0.25),
    ("Public liability insurance", "Insurer", 1), ("Property all-risk insurance", "Insurer", 1),
    ("Diesel storage licence", "PESO", 5), ("Signage and hoarding permission", "Municipal Corporation", 1),
    ("Lift third-party safety audit", "Third-party auditor", 1), ("Energy audit", "BEE accredited auditor", 3),
]
comp = []
for m in malls:
    for i, (item, auth, yrs) in enumerate(COMPLIANCE):
        if yrs == 0:
            issued, expiry = date(m["opened_year"], rint(1, 12), rint(1, 28)), None
        else:
            span = int(yrs * 365)
            expiry = TODAY + timedelta(days=rint(-40, span))  # some overdue, some expiring soon
            issued = expiry - timedelta(days=span)
        days_left = (expiry - TODAY).days if expiry else None
        comp.append(dict(compliance_id=f"{m['mall_id']}-C{i + 1:02d}", mall_id=m["mall_id"], item=item, authority=auth,
                         renewal_cycle_years=yrs or None, issued_on=issued, expires_on=expiry, days_to_expiry=days_left,
                         status="Permanent" if expiry is None else "Overdue" if days_left < 0 else "Due within 60 days" if days_left <= 60 else "Valid",
                         owner_role=str(rng.choice(["Facility Manager", "Fire Officer", "Legal and Compliance", "Chief Engineer"]))))
comp_df = pd.DataFrame(comp)

# ---------------------------------------------------------------- security incidents
INC = {"Lost child (found)": 0.12, "Theft / shoplifting": 0.18, "Medical emergency": 0.14, "Lost and found item": 0.2,
       "Unattended bag": 0.06, "Altercation": 0.06, "Parking damage claim": 0.08, "Slip and fall": 0.07,
       "Fire alarm activation": 0.05, "Suspicious person": 0.04}
inc = []
fmap = foot_df.set_index(["mall_id", "date"]).footfall
for m in malls:
    d = START
    while d <= END:
        lam = fmap[(m["mall_id"], d)] / 9000
        for _ in range(rng.poisson(lam)):
            t = str(rng.choice(list(INC), p=list(INC.values())))
            inc.append(dict(incident_id=f"INC{len(inc) + 1:06d}", mall_id=m["mall_id"],
                            occurred_at=datetime.combine(d, datetime.min.time()) + timedelta(hours=int(rng.choice(hours)), minutes=rint(0, 59)),
                            type=t, location=f"{rng.choice(LEVELS)} {rng.choice(ZONES)}",
                            severity="High" if t in ("Medical emergency", "Fire alarm activation", "Altercation") and rng.random() < 0.4 else str(rng.choice(["Low", "Medium"])),
                            response_min=round(float(rng.gamma(2, 2.2)), 1), police_informed=bool(t in ("Theft / shoplifting", "Altercation") and rng.random() < 0.3),
                            status="Closed"))
        d += timedelta(days=1)
inc_df = pd.DataFrame(inc)

# ---------------------------------------------------------------- energy and water (monthly)
energy = []
for m in malls:
    gla = malls_df.set_index("mall_id").gla_super_sqft[m["mall_id"]]
    epi = rng.uniform(14, 22)  # kWh per sq ft per year, BEE benchmark ~24
    solar_kw = rint(300, 1500)
    for p in MONTHS:
        hot = {4: 1.25, 5: 1.35, 6: 1.2, 7: 1.05, 8: 1.05, 9: 1.1, 10: 1.05, 11: 0.9, 12: 0.8, 1: 0.8, 2: 0.85, 3: 1.05}[p.month]
        total = gla * epi / 12 * hot * rng.normal(1, 0.04)
        solar = solar_kw * 4.2 * p.days_in_month * rng.uniform(0.7, 1.0) * (0.6 if p.month in (7, 8) else 1)
        dg = total * rng.uniform(0.005, 0.03)
        grid = total - solar - dg
        energy.append(dict(mall_id=m["mall_id"], month=str(p), total_kwh=round(total), grid_kwh=round(grid),
                           solar_kwh=round(solar), dg_kwh=round(dg), hvac_share_pct=round(rng.uniform(38, 55) * hot / 1.05, 1),
                           diesel_litres=round(dg / 3.3), grid_tariff_inr_per_kwh=round(rng.uniform(8.0, 11.0), 2),
                           water_kl=round(gla * rng.uniform(0.0016, 0.0024) * hot), stp_recycled_kl=round(gla * rng.uniform(0.0007, 0.0011)),
                           co2_tonnes=round((grid * 0.71 + dg * 0.8) / 1000, 1)))
energy_df = pd.DataFrame(energy)

# ---------------------------------------------------------------- write
leases_out = leases_df.drop(columns=["sales_multiplier", "density"])
assets_out = assets_df.drop(columns=["reactive_rate"])
tables = {"malls": malls_df, "units": units_df, "brands": brands_df, "leases": leases_out, "tenant_sales_monthly": sales_df,
          "footfall_daily": foot_df, "vendors": vendors_df, "assets": assets_out, "work_orders": wo_df,
          "compliance_register": comp_df, "security_incidents": inc_df, "energy_water_monthly": energy_df}
for k, df in tables.items():
    df.to_csv(os.path.join(CSV, f"{k}.csv"), index=False)
with pd.ExcelWriter(os.path.join(OUT, "mall_pms_sample_data.xlsx"), engine="openpyxl") as xw:
    for k, df in tables.items():
        df.to_excel(xw, sheet_name=k[:31], index=False)
for k, df in tables.items():
    print(f"{k:24s} {len(df):>8,d} rows")
