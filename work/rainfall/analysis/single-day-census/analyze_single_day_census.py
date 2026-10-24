#!/usr/bin/env python3
"""Enumerate 366 separate, controlled daily masks using only a pinned local CSV."""

import argparse
import calendar
import csv
import hashlib
import json
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal, localcontext
from pathlib import Path


INPUT_SHA256 = "113a694665a7d1be8e66f02442d4aac6c32fc3f846f9ec903fe192b5c19a7fed"
ZERO = Decimal("0")
SIX = Decimal("0.000001")


def day_range(start, end):
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def serialize(value):
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (date, Path)):
        return str(value)
    raise TypeError(type(value).__name__)


def direction(amount, reference):
    return "above" if amount > reference else "below" if amount < reference else "equal"


def main():
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=here.parents[1] / "data/noaa-daily-current.csv")
    parser.add_argument("--output-dir", type=Path, default=here / "reproduced")
    args = parser.parse_args()
    source, output = args.input.resolve(), args.output_dir.resolve()
    export_root = here.parents[1]
    source_label = source.relative_to(export_root).as_posix() if source.is_relative_to(export_root) else source.name
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != INPUT_SHA256:
        raise ValueError("Input differs from the authorized frozen snapshot")
    amounts, flags = {}, {}
    with source.open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            day = date.fromisoformat(row["DATE"])
            if day in amounts or row["STATION"] != "USW00093134":
                raise ValueError("Duplicate date or unexpected station")
            attributes = row["PRCP_ATTRIBUTES"].split(",")
            if len(attributes) != 4 or attributes[1] or not row["PRCP"].strip():
                raise ValueError("Expected numeric PRCP without quality flags")
            value = Decimal(row["PRCP"])
            if not value.is_finite() or value < ZERO:
                raise ValueError("Invalid amount")
            amounts[day], flags[day] = value, attributes[0]
    if set(amounts) != set(day_range(date(2018, 7, 1), date(2024, 12, 31))):
        raise ValueError("Expected complete pinned extraction interval")
    year_days = day_range(date(2024, 1, 1), date(2024, 12, 31))

    with localcontext() as context:
        context.prec = 50
        truth = sum((amounts[day] for day in year_days), ZERO)
        reference_totals = {
            str(year): sum((amounts[day] for day in day_range(date(year, 1, 1), date(year, 12, 31))), ZERO)
            for year in range(2019, 2024)
        }
        reference = sum(reference_totals.values(), ZERO) / 5
        margin = truth - reference
        if truth != Decimal("19.13") or reference != Decimal("16.45"):
            raise AssertionError("Unexpected direct-CSV truth/reference")
        rows = []
        for hidden in year_days:
            retained = {day for day in year_days if day != hidden}
            partial = sum((amounts[day] for day in sorted(retained)), ZERO)
            if partial + amounts[hidden] != truth:
                raise AssertionError("Withholding reconciliation failed")
            complete_months = sum(
                all(date(2024, month, day) in retained
                    for day in range(1, calendar.monthrange(2024, month)[1] + 1))
                for month in range(1, 13)
            )
            bound_direction = (
                "above" if partial > reference else
                "not_identified_below_equal_above_possible" if partial < reference else
                "not_below_equal_or_above_possible"
            )
            rows.append({
                "synthetically_hidden_date": hidden,
                "known_hidden_in_for_evaluation_only": amounts[hidden],
                "measurement_flag": flags[hidden],
                "retained_numeric_days": len(retained),
                "expected_annual_days": len(year_days),
                "annual_numeric_coverage_percent_6dp": (Decimal(len(retained)) * 100 / len(year_days)).quantize(SIX),
                "strictly_complete_months": complete_months,
                "expected_months": 12,
                "strict_annual_total_in": None if len(retained) != len(year_days) else partial,
                "observed_annual_partial_in": partial,
                "zero_fill_assumed_annual_total_in": partial,
                "zero_fill_assumed_direction": direction(partial, reference),
                "zero_fill_assumed_percent_difference_6dp": (100 * (partial / reference - 1)).quantize(SIX),
                "nonnegative_lower_bound_in": partial,
                "finite_upper_bound_from_retained_values_in": None,
                "direction_from_retained_values_and_nonnegativity": bound_direction,
                "known_hidden_exceeds_truth_reference_margin": amounts[hidden] > margin,
            })
        directions = Counter(row["zero_fill_assumed_direction"] for row in rows)
        identification = Counter(row["direction_from_retained_values_and_nonnegativity"] for row in rows)
        crossing = [{"date": row["synthetically_hidden_date"],
                     "known_withheld_in": row["known_hidden_in_for_evaluation_only"],
                     "retained_partial_in": row["observed_annual_partial_in"],
                     "zero_fill_assumed_direction": row["zero_fill_assumed_direction"],
                     "zero_fill_assumed_percent_difference_6dp": row["zero_fill_assumed_percent_difference_6dp"],
                     "additional_nonnegative_amount_for_equality_in": reference - row["observed_annual_partial_in"]}
                    for row in rows if row["known_hidden_in_for_evaluation_only"] >= margin]
        result = {
            "scope": "Deterministic enumeration of all 366 separate one-day masks in the complete 2024 record; no missingness probabilities or representative imputation claims",
            "input": {"path": source_label, "bytes": len(raw), "sha256": INPUT_SHA256,
                      "extract_start": "2018-07-01", "extract_end": "2024-12-31",
                      "supplied_dates": len(amounts), "actual_in_extract_gaps": 0,
                      "actual_blank_prcp": 0},
            "known_complete_2024_total_in": truth,
            "known_truth_direction": direction(truth, reference),
            "known_truth_percent_difference_6dp": (100 * (truth / reference - 1)).quantize(SIX),
            "reference_annual_totals_in": reference_totals,
            "reference_mean_in": reference,
            "known_truth_minus_reference_margin_in": margin,
            "mask_count": len(rows),
            "zero_fill_assumed_direction_counts": {name: directions[name] for name in ("above", "equal", "below")},
            "source_2024_numeric_zero_days": sum(amounts[day] == ZERO for day in year_days),
            "source_2024_positive_days": sum(amounts[day] > ZERO for day in year_days),
            "withheld_amount_at_or_above_margin": crossing,
            "withheld_amount_exactly_equal_to_margin_count": sum(amounts[day] == margin for day in year_days),
            "all_masked_strict_annual_totals_unavailable": all(row["strict_annual_total_in"] is None for row in rows),
            "retained_numeric_day_counts": sorted({row["retained_numeric_days"] for row in rows}),
            "strict_complete_month_counts": sorted({row["strictly_complete_months"] for row in rows}),
            "annual_numeric_coverage_percent": Decimal(365) * 100 / 366,
            "strict_complete_month_coverage_percent": Decimal(11) * 100 / 12,
            "all_pass_99_percent_annual_numeric_screen": all(row["retained_numeric_days"] * 100 >= row["expected_annual_days"] * 99 for row in rows),
            "identification_counts": dict(identification),
            "identification_information_set": "Retained precipitation values and nonnegativity only; deliberately excludes the known hidden value, known complete total, mask-selection metadata and cross-mask reconstruction",
            "finite_upper_bound_from_that_information": None,
            "old_suites_or_twelve_monthly_masks_rerun": False,
            "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        }
        output.mkdir(parents=True, exist_ok=True)
        (output / "results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False, default=serialize) + "\n", encoding="utf-8")
        with (output / "single-day-results.csv").open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=list(rows[0]))
            writer.writeheader()
            for row in rows:
                writer.writerow({key: "" if value is None else serialize(value) if isinstance(value, (Decimal, date)) else value
                                 for key, value in row.items()})
        crossing_lines = "\n".join(
            f"  {item['date']}: hide {item['known_withheld_in']} in; partial {item['retained_partial_in']} in; "
            f"zero-fill comparison {item['zero_fill_assumed_percent_difference_6dp']}%."
            for item in crossing
        )
        note = f"""ALL 366 SINGLE-DAY MASKS — FINITE RECORD ENUMERATION
22 October 2026 · controlled arithmetic example

RESULT
Zero filling each separately hidden 2024 day leaves {directions['above']} comparisons above,
{directions['equal']} equal to and {directions['below']} below the fixed 16.45-inch reference. These are counts
of deterministic masks of this record, not probabilities of missingness.
Every strict masked annual total remains unavailable.

WHY TWO CROSS
The known full-year total is {truth} in, {margin} in above the reference. A zero-fill
comparison falls below only when the known withheld amount exceeds {margin} in;
equality would require exactly {margin} in. The only dates at or above this margin are:
{crossing_lines}
No day equals {margin} in. The other {directions['above']} partials remain above. The source year's
{result['source_2024_numeric_zero_days']} numeric-zero days and {result['source_2024_positive_days']} positive days are all included, without selection
by outcome. This places the earlier deliberately selected maximum-day example
within the full set of 366 possible single-day masks of this observed year.

COMMON COVERAGE, DIFFERENT UNKNOWN AMOUNTS
Each mask retains 365/366 numeric days (99.726776%), passing a 99% annual
day-coverage screen. Each has only 11/12 strictly complete months (91.666667%).
Hiding a numeric zero still removes an observation; zero is not missing in the
original input. A coverage pass does not supply the missing value or a full total.
The actual frozen extract has no internal date gaps or blank precipitation.

EVALUATION VERSUS IDENTIFICATION
Known hidden values and the complete truth are used to evaluate the zero-fill
assumption across the finite set. Zero fill assigns an unknown day 0.00 inches;
its assumed total equals the retained partial, not the strict annual total.
These counts do not establish representative imputation error, a missingness
model, empirical robustness, or the chance that a real missing day changes a sign.

For identification, consider each mask separately using ONLY its retained values
and nonnegative precipitation. Exclude the hidden truth, known full-year total,
selection metadata and reconstruction from other masks. In {identification['above']} masks, the
partial alone exceeds the reference, so "above" is identified even though the
exact total is not. In the two crossing masks, below/equal/above remain possible:
an unknown {crossing[0]['additional_nonnegative_amount_for_equality_in']} in or {crossing[1]['additional_nonnegative_amount_for_equality_in']} in, respectively, would equal the reference.
Each retained partial is a lower bound; these inputs supply no finite upper bound.
This is a conditional mathematical statement, not a physical precipitation estimate.

METHOD / REPRODUCTION
Run using existing Python 3 from the export root:
  python3 analysis/single-day-census/analyze_single_day_census.py --output-dir reproduced-census
Default input: data/noaa-daily-current.csv in the export root, independent of working directory.
Use --input for another local copy with the same pinned hash. The standalone
standard-library script directly sums daily CSV values with Decimal precision 50,
recomputes the five annual reference totals, and enumerates every 2024 date.
Each retained sum plus its known withheld value reconciles exactly to the truth.
CSV blank totals and JSON null are unavailable/no finite bound, never zero.
results.json records the source/script hashes, counts, denominators and crossings;
single-day-results.csv supplies all 366 rows. No prior suite or monthly-mask
exercise was rerun. Earlier analyses and explorer files remain unchanged.

Input SHA-256: {INPUT_SHA256}

LIMITS / CREDIT
One frozen station identifier and one observed year do not establish general
missingness behavior. Short references are not climate normals. May 2024 station
handoff, continuity and homogenization remain unresolved. No climate finding,
forecast or causal wildfire result follows. Provider date keys remain as supplied.
NOAA PRCP / USW00093134 / 1 July 2018–31 December 2024; packet accessed
21 October 2026. Menne et al. (2012), GHCN-Daily Version 3, NOAA NCDC:
https://doi.org/10.7289/V5D21VHZ. Overview: https://doi.org/10.1175/JTECH-D-11-00103.1.
Independent work, not an official NOAA product or endorsement. No retrieval,
browser action, install, upload or publication occurred.
"""
        (output / "METHODS_RESULTS.txt").write_text(note, encoding="utf-8")
        print(json.dumps({"mask_count":len(rows), "directions":result['zero_fill_assumed_direction_counts'],
                          "crossing_dates":[str(item['date']) for item in crossing],
                          "all_strict_totals_null":result['all_masked_strict_annual_totals_unavailable']}))


if __name__ == "__main__":
    main()
