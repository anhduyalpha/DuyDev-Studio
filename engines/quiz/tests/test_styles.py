"""
Unit Tests for Style Presets and Style Registry (TASK-09).
"""

import unittest
from engines.quiz.rendering.styles import (
    StylePreset,
    StyleRegistry,
    BLUE_BLACK_CLASSIC_STYLE,
    style_registry,
)


class TestStylePresets(unittest.TestCase):
    def test_default_blue_black_classic(self):
        preset = BLUE_BLACK_CLASSIC_STYLE
        self.assertEqual(preset.preset_id, "blue_black_classic")
        self.assertEqual(preset.page_size, "A4 portrait")
        self.assertEqual(preset.margin_top_mm, 15.0)
        self.assertEqual(preset.margin_right_mm, 15.0)
        self.assertEqual(preset.primary_color, "#1e3a8a")
        self.assertEqual(preset.text_color, "#0f172a")
        self.assertFalse(preset.show_student_info)

    def test_style_registry_lookup(self):
        reg = StyleRegistry()
        # Lookup default
        preset = reg.get("blue_black_classic")
        self.assertEqual(preset.preset_id, "blue_black_classic")

        # Lookup None or empty string -> falls back to blue_black_classic
        self.assertEqual(reg.get(None).preset_id, "blue_black_classic")
        self.assertEqual(reg.get("").preset_id, "blue_black_classic")

        # Lookup unknown preset -> falls back to blue_black_classic
        self.assertEqual(reg.get("non_existent_preset").preset_id, "blue_black_classic")

    def test_register_custom_preset(self):
        reg = StyleRegistry()
        custom = StylePreset(
            preset_id="modern_emerald",
            display_name="Modern Emerald",
            primary_color="#047857",
            banner_bg="#047857",
        )
        reg.register(custom)
        retrieved = reg.get("modern_emerald")
        self.assertEqual(retrieved.preset_id, "modern_emerald")
        self.assertEqual(retrieved.primary_color, "#047857")
        self.assertIn("modern_emerald", reg.list_presets())


if __name__ == "__main__":
    unittest.main()
