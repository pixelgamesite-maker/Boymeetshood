#!/usr/bin/env python3
"""
Turn the collection's OpenSea metadata export into the per-token rarity
tiers JuiceStaking needs, and write script/data/rarity.json for
SetJuiceRarity.s.sol to consume.

Usage:
    python3 scripts/compute_rarity.py path/to/opensea_metadata.csv

Input: OpenSea's metadata CSV export, one row per token, with at least
these columns: tokenID, attributes[Special], attributes[Rarity Rank].

Methodology
-----------
OpenSea's own `Rarity Rank` column is a solid rarity signal for ordinary
tokens, but it misjudges the 31 tokens marked `attributes[Special] = "1/1"`
-- these are hand-crafted, one-of-a-kind pieces with every ordinary trait
column left blank. OpenSea's statistical rarity algorithm reads "no traits
filled in" as a common shared pattern rather than as the signal of
uniqueness it actually is, so all 31 of them land at ranks ~2074-2104 out
of 2666 -- the more common half of the collection. Since a "Special: 1/1"
piece is meant to be the rarest thing in the set, not a middling one, this
script overrides those 31 to the top tier ("Mythic") regardless of their
raw OpenSea rank.

The remaining tokens are bucketed by OpenSea Rarity Rank percentile into
the rest of the tiers, in the usual pyramid shape:

    Mythic     the 31 "Special: 1/1" tokens (hard override, ~1.2%)
    Legendary  next   2% by rank
    Epic       next   6% by rank
    Rare       next  15% by rank
    Uncommon   next  32% by rank
    Common     remainder (~44.5%)

These percentile cutoffs are the only tunable part of this script --
change PERCENTILES below and rerun if the split should look different.
"""
import csv
import json
import sys
from pathlib import Path

# (tier, cumulative fraction of the *non-Mythic* pool that tier tops out at)
# Ordered rarest to most common; "Common" always soaks up the remainder.
PERCENTILES = [
    ("Legendary", 0.02),
    ("Epic", 0.08),
    ("Rare", 0.23),
    ("Uncommon", 0.55),
    # Common = everything left after the above (~44.5%)
]

SPECIAL_TIER = "Mythic"


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    rows = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rows.append(row)

    special = [r for r in rows if (r.get("attributes[Special]") or "").strip() == "1/1"]
    ordinary = [r for r in rows if r not in special]

    # Rarest first.
    ordinary.sort(key=lambda r: int(r["attributes[Rarity Rank]"]))

    n = len(ordinary)
    tiers: dict[str, str] = {}

    for r in special:
        tiers[r["tokenID"]] = SPECIAL_TIER

    cut_start = 0
    for tier, cum_frac in PERCENTILES:
        cut_end = round(n * cum_frac)
        for r in ordinary[cut_start:cut_end]:
            tiers[r["tokenID"]] = tier
        cut_start = cut_end
    for r in ordinary[cut_start:]:
        tiers[r["tokenID"]] = "Common"

    assert len(tiers) == len(rows), f"{len(tiers)} tiered vs {len(rows)} total rows"

    token_ids = sorted(tiers.keys(), key=int)
    out = {
        "tokenIds": [int(t) for t in token_ids],
        "rarities": [tiers[t] for t in token_ids],
    }

    out_path = Path(__file__).resolve().parent.parent / "script" / "data" / "rarity.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out))

    from collections import Counter

    counts = Counter(out["rarities"])
    print(f"Wrote {len(token_ids)} tokens to {out_path}")
    for tier in ["Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"]:
        c = counts.get(tier, 0)
        print(f"  {tier:<10} {c:>5}  ({c / len(token_ids):.1%})")


if __name__ == "__main__":
    main()
