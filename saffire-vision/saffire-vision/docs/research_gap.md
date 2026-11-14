# Research gap (hypothesis to validate)
**Status: hypothesis, not a finding.** No literature review has been performed in this repository.

Hypothesis: quantitative analysis of microgravity-combustion imagery (flame shape, spread, standoff) depends on knowing the geometric distortion of the cameras, yet distortion correction is often applied inside bespoke experiment pipelines and may not be exposed as reusable, documented tooling. If true, an open, reproducible calibration-and-QA module could lower the barrier to using SAFFIRE-class imagery in AI-assisted fire-safety analysis.

How to validate: (1) survey published SAFFIRE / microgravity-combustion image-analysis methods and NASA data documentation; (2) check whether calibration parameters are published with the datasets; (3) compare this module's outputs with any NASA-provided calibration.

What this module does NOT show: that distortion-grid data supports fire-spread prediction. Grid images carry no combustion information.
