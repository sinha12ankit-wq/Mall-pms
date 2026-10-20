# Sample data

Synthetic operating data for 10 fictional Indian malls, October 2025 to September 2026. Every
mall, brand, company, GSTIN and vendor is invented. Load it with:

```bash
pnpm db:seed:sample
```

This loads the operations tables only (malls, units, vendors, assets, work orders, compliance
register, security incidents). The full dataset, including leases, tenant sales, footfall and
energy, is produced by `generate.py` (`python3 generate.py`, needs pandas and numpy).

Planted patterns worth knowing when building features:

- 30 chronic assets (escalators, chillers, lifts, DG sets) break down about 4x as often.
- Some compliance items are overdue and others expire within 60 days of 20 Oct 2026.
- Work-order times are local mall time (IST); `sla_hours` is the resolution SLA.
- Most assets have no PPM history in the year, so the loader spreads their first due date across
  one cycle from 1 Oct 2026.
