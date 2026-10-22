RAINFALL, IN CONTEXT — PORTABLE SOURCE EXPORT

BUILD THE APP
Use an existing Python 3.9 or newer. No dependency installation or retrieval is needed.
From this folder:
  python3 scripts/build.py
The helper locates this folder from its own path, verifies the frozen inputs listed
in data/INPUTS.json, then writes index.html deterministically from src/ and the
frozen app results. The generated page embeds its styles, data and JavaScript.
The app does not fetch data, use remote libraries, analytics, storage or credentials.

INSPECT THE SOURCE
  src/index.template.html       Semantic UI, visible methods, source citations
  src/styles.css                App presentation
  src/engine.js                 Original exact hundredth-inch accumulation logic
  src/app.js                    Original controls, tables, charts and status UI
  data/frozen-results.json      Frozen monthly/comparison/month-mask app inputs
  data/frozen-comparisons.csv   Frozen comparison values, including unavailable result
  data/noaa-daily-current.csv   Frozen daily NOAA subset for the census reproduction
  data/INPUTS.json              Exact input hashes and data citation
  case-study.html               Case study and methods
The engine, UI logic, styles and three frozen data files are unchanged byte copies.
Only the template's export labels and links were adapted for this selected export.

REPRODUCE THE SYNTHETIC DAILY-MASK CENSUS
From this folder, choose a fresh output directory:
  python3 analysis/single-day-census/analyze_single_day_census.py --output-dir reproduced-census
The script uses only the Python standard library and the pinned daily CSV. It
writes results.json, single-day-results.csv and METHODS_RESULTS.txt to that output
directory. The default input is relative to the script's export root, so it also
works from another current directory. The default output is a new reproduced/
subdirectory beside the script; use a fresh explicit output to preserve prior work.

analysis/single-day-census/results.json is a sanitized copy of the recorded result:
only its input path and explanatory export note changed. Its script_sha256 refers
to the original recorded script. The portable script changes input/output paths and
generated reproduction instructions, not the calculation. A fresh result records
the portable script's own hash. These provenance hashes may therefore differ;
compare numerical fields and scope separately from script/path metadata.

The census withholds each known 2024 day separately. These are hypothetical masks,
not observed missingness, missingness probabilities or a recommended imputation.
The case study distinguishes this census from the app's one-month masking controls.
Short selected references are not climate normals. Station continuity and
homogenization remain unresolved; no forecast, trend or wildfire-causation claim follows.

SOURCE CREDIT
Menne et al. (2012), GHCN-Daily Version 3, NOAA National Climatic Data Center.
https://doi.org/10.7289/V5D21VHZ
Overview: https://doi.org/10.1175/JTECH-D-11-00103.1
Subset: PRCP, USW00093134, 1 July 2018–31 December 2024; accessed 21 October 2026.
Recorded API retrieval completed 21 October 2026 at 14:58:21 UTC; a current
distribution tag was not exposed. The app retains API, flags and station-history links.
Independent analytical work, not an official NOAA product or endorsement.
Source policy: https://www.ncei.noaa.gov/data-submission/data-licensing
The policy is qualified; no blanket CC0 grant or station-specific rights warranty
is asserted. No additional license for the original code, charts or prose is
granted by this export. No Almanac table, series, screenshot or article is bundled.
