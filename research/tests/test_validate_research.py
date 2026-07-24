from pathlib import Path
import json
import sys
import unittest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RESEARCH_ROOT = PROJECT_ROOT / "research" / "2026-07-23"
sys.path.insert(0, str(PROJECT_ROOT))


class ExistingClaimBaselineTests(unittest.TestCase):
    def test_existing_claims_are_source_linked(self):
        path = RESEARCH_ROOT / "data" / "existing-claims.json"
        records = json.loads(path.read_text(encoding="utf-8"))
        self.assertGreater(len(records), 20)
        self.assertTrue(all(record["sourceFile"] for record in records))
        self.assertTrue(any("11.1" in record["claimText"] for record in records))


class ResearchPackageTests(unittest.TestCase):
    def test_research_package_has_no_validation_errors(self):
        from research.tools.validate_research import validate

        self.assertEqual(validate(), [])

    def test_package_counts_and_reports_are_complete(self):
        root = RESEARCH_ROOT
        metadata = json.loads(
            (root / "research-metadata.json").read_text(encoding="utf-8")
        )
        self.assertEqual(metadata["counts"]["newEvidenceRecords"], 40)
        self.assertEqual(metadata["counts"]["competitors"], 16)
        self.assertEqual(metadata["counts"]["impactMetrics"], 26)
        reports = {path.name for path in (root / "reports").glob("*.md")}
        self.assertEqual(len(reports), 6)
        self.assertIn("crit12-decision-gap.md", reports)


if __name__ == "__main__":
    unittest.main()
