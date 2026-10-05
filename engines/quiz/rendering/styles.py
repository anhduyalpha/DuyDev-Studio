"""
Style Presets & Registry for Quiz Document Rendering.
Provides declarative styling configuration (colors, margins, typography, banners).
Code-driven and config-driven: AI is strictly forbidden from generating freeform CSS.
"""

from pydantic import BaseModel, Field


class StylePreset(BaseModel):
    """Declarative visual style preset for PDF examination worksheets and answer keys."""
    preset_id: str = "blue_black_classic"
    display_name: str = "Blue Black Classic"
    page_size: str = "A4 portrait"
    margin_top_mm: float = 10.0
    margin_right_mm: float = 12.0
    margin_bottom_mm: float = 10.0
    margin_left_mm: float = 12.0
    
    # Palette
    primary_color: str = "#1e3a8a"       # Deep blue / navy
    secondary_color: str = "#2563eb"     # Medium blue
    text_color: str = "#0f172a"          # Slate-900 high contrast
    muted_color: str = "#64748b"         # Slate-500 for captions and footer
    border_color: str = "#cbd5e1"        # Slate-300
    banner_bg: str = "#1e3a8a"           # Solid navy for section banners
    banner_text_color: str = "#ffffff"   # High contrast white
    accent_bg: str = "#f8fafc"           # Slate-50 subtle box fill
    accent_border: str = "#93c5fd"       # Blue-300
    
    # Typography
    font_family_base: str = "'Roboto', 'Liberation Sans', 'DejaVu Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    font_family_heading: str = "'Roboto', 'Liberation Sans', 'DejaVu Sans', sans-serif"
    font_family_mono: str = "'JetBrains Mono', 'DejaVu Sans Mono', monospace"
    font_size_pt: float = 10.0
    line_height: float = 1.45
    
    # Components & Layout
    show_student_info: bool = False
    show_decor_lines: bool = True
    question_num_color: str = "#1e3a8a"
    option_letter_color: str = "#1e3a8a"


BLUE_BLACK_CLASSIC_STYLE = StylePreset(
    preset_id="blue_black_classic",
    display_name="Blue Black Classic",
    page_size="A4 portrait",
    margin_top_mm=10.0,
    margin_right_mm=12.0,
    margin_bottom_mm=10.0,
    margin_left_mm=12.0,
    primary_color="#1e3a8a",
    secondary_color="#2563eb",
    text_color="#0f172a",
    muted_color="#64748b",
    border_color="#cbd5e1",
    banner_bg="#1e3a8a",
    banner_text_color="#ffffff",
    accent_bg="#f8fafc",
    accent_border="#93c5fd",
    font_size_pt=10.0,
    line_height=1.45,
    show_student_info=False,
    show_decor_lines=True,
)

ANSWER_GREEN_STYLE = StylePreset(
    preset_id="answer_green",
    display_name="Answer Green Theme",
    page_size="A4 portrait",
    margin_top_mm=10.0,
    margin_right_mm=12.0,
    margin_bottom_mm=10.0,
    margin_left_mm=12.0,
    primary_color="#047857",       # Emerald-700 deep green for title, banners, and headers
    secondary_color="#059669",     # Emerald-600 medium green for indicators and subheadings
    text_color="#0f172a",          # Slate-900 high-contrast body text for readability
    muted_color="#065f46",         # Emerald-800 muted for running header/footer
    border_color="#10b981",        # Emerald-500 crisp green dividers and borders
    banner_bg="#047857",           # Emerald-700 solid green section banners
    banner_text_color="#ffffff",   # Pure white text
    accent_bg="#ecfdf5",           # Emerald-50 soft mint green for answer cells & badges
    accent_border="#6ee7b7",       # Emerald-300 light green border
    font_size_pt=10.0,
    line_height=1.45,
    show_student_info=False,
    show_decor_lines=True,
    question_num_color="#047857",
    option_letter_color="#047857",
)


class StyleRegistry:
    """Registry managing available style presets."""

    def __init__(self) -> None:
        self._presets: dict[str, StylePreset] = {}
        self.register(BLUE_BLACK_CLASSIC_STYLE)
        self.register(ANSWER_GREEN_STYLE)

    def register(self, preset: StylePreset) -> None:
        """Register a new style preset."""
        self._presets[preset.preset_id] = preset

    def get(self, preset_id: str | None = None) -> StylePreset:
        """Retrieve a style preset by ID with fallback to blue_black_classic."""
        if not preset_id:
            return BLUE_BLACK_CLASSIC_STYLE
        return self._presets.get(preset_id, BLUE_BLACK_CLASSIC_STYLE)

    def list_presets(self) -> list[str]:
        """List all registered style preset IDs."""
        return list(self._presets.keys())


# Global singleton instance
style_registry = StyleRegistry()
