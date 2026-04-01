from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(dotenv_path: Path, override: bool = False) -> bool:
        if not Path(dotenv_path).is_file():
            return False
        with open(dotenv_path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if not override and key in os.environ:
                    continue
                os.environ[key] = value
        return True


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)

PROVIDER_CONFIGS: dict[str, dict[str, str]] = {
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "default_image_model": "google/gemini-3-pro-image-preview",
        "default_svg_model": "google/gemini-3.1-pro-preview",
    },
    "bianxie": {
        "base_url": "https://api.bianxie.ai/v1",
        "default_image_model": "gemini-3-pro-image-preview",
        "default_svg_model": "gemini-3.1-pro-preview",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "default_image_model": "gemini-3-pro-image-preview",
        "default_svg_model": "gemini-3.1-pro",
    },
    "openai_compatible": {
        "base_url": "http://localhost:8000/v1",
        "default_image_model": "gpt-image-1",
        "default_svg_model": "gpt-4.1",
    },
}

DEFAULT_IMAGE_SIZE = "4K"
IMAGE_SIZE_CHOICES = ("1K", "2K", "4K")
DEFAULT_SAM_PROMPT = "icon,person,robot,animal"
DEFAULT_PLACEHOLDER_MODE = "label"
DEFAULT_MERGE_THRESHOLD = 0.9
DEFAULT_MIN_SCORE = 0.0
DEFAULT_OPTIMIZE_ITERATIONS = 0
DEFAULT_SAM_MAX_MASKS = 32
DEFAULT_WEB_PROVIDER = "gemini"
DEFAULT_CLI_PROVIDER = "bianxie"
DEFAULT_WEB_SAM_BACKEND = "roboflow"
DEFAULT_CLI_SAM_BACKEND = "local"

_PROVIDER_KEY_ENV_MAP: dict[str, tuple[str, ...]] = {
    "openrouter": ("OPENROUTER_API_KEY",),
    "bianxie": ("BIANXIE_API_KEY",),
    "gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "openai_compatible": ("AUTOFIGURE_API_KEY", "ARK_API_KEY"),
}


def _env_str(name: str) -> Optional[str]:
    value = os.environ.get(name)
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _env_float(name: str) -> Optional[float]:
    raw = _env_str(name)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _env_int(name: str) -> Optional[int]:
    raw = _env_str(name)
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _coalesce(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


def resolve_provider(provider: Optional[str], fallback: str) -> str:
    resolved = _coalesce(provider, _env_str("AUTOFIGURE_PROVIDER"), fallback)
    resolved = str(resolved).strip()
    if resolved not in PROVIDER_CONFIGS:
        supported = ", ".join(sorted(PROVIDER_CONFIGS))
        raise ValueError(f"Unsupported provider: {resolved}. Supported providers: {supported}")
    return resolved


def resolve_provider_api_key(
    provider: str,
    explicit_api_key: Optional[str] = None,
) -> Optional[str]:
    explicit_value = explicit_api_key.strip() if isinstance(explicit_api_key, str) else None
    if explicit_value:
        return explicit_value

    for env_name in _PROVIDER_KEY_ENV_MAP.get(provider, ()):
        env_value = _env_str(env_name)
        if env_value:
            return env_value

    default_provider = _env_str("AUTOFIGURE_PROVIDER")
    if default_provider == provider:
        return _env_str("AUTOFIGURE_API_KEY")

    return None


def resolve_provider_settings(
    provider: Optional[str] = None,
    *,
    base_url: Optional[str] = None,
    image_model: Optional[str] = None,
    svg_model: Optional[str] = None,
    image_size: Optional[str] = None,
    provider_fallback: str = DEFAULT_WEB_PROVIDER,
) -> dict[str, Any]:
    resolved_provider = resolve_provider(provider, fallback=provider_fallback)
    provider_config = PROVIDER_CONFIGS[resolved_provider]

    return {
        "provider": resolved_provider,
        "base_url": _coalesce(base_url, _env_str("AUTOFIGURE_BASE_URL"), provider_config["base_url"]),
        "image_model": _coalesce(
            image_model,
            _env_str("AUTOFIGURE_IMAGE_MODEL"),
            provider_config["default_image_model"],
        ),
        "svg_model": _coalesce(
            svg_model,
            _env_str("AUTOFIGURE_SVG_MODEL"),
            provider_config["default_svg_model"],
        ),
        "image_size": _coalesce(image_size, _env_str("AUTOFIGURE_IMAGE_SIZE"), DEFAULT_IMAGE_SIZE),
    }


def resolve_sam_settings(
    *,
    sam_backend: Optional[str] = None,
    sam_prompt: Optional[str] = None,
    min_score: Optional[float] = None,
    sam_max_masks: Optional[int] = None,
    placeholder_mode: Optional[str] = None,
    merge_threshold: Optional[float] = None,
    optimize_iterations: Optional[int] = None,
    sam_backend_fallback: str = DEFAULT_WEB_SAM_BACKEND,
) -> dict[str, Any]:
    return {
        "sam_backend": _coalesce(
            sam_backend,
            _env_str("AUTOFIGURE_SAM_BACKEND"),
            sam_backend_fallback,
        ),
        "sam_prompt": _coalesce(
            sam_prompt,
            _env_str("AUTOFIGURE_SAM_PROMPT"),
            DEFAULT_SAM_PROMPT,
        ),
        "min_score": _coalesce(
            min_score,
            _env_float("AUTOFIGURE_MIN_SCORE"),
            DEFAULT_MIN_SCORE,
        ),
        "sam_max_masks": _coalesce(
            sam_max_masks,
            _env_int("AUTOFIGURE_SAM_MAX_MASKS"),
            DEFAULT_SAM_MAX_MASKS,
        ),
        "placeholder_mode": _coalesce(
            placeholder_mode,
            _env_str("AUTOFIGURE_PLACEHOLDER_MODE"),
            DEFAULT_PLACEHOLDER_MODE,
        ),
        "merge_threshold": _coalesce(
            merge_threshold,
            _env_float("AUTOFIGURE_MERGE_THRESHOLD"),
            DEFAULT_MERGE_THRESHOLD,
        ),
        "optimize_iterations": _coalesce(
            optimize_iterations,
            _env_int("AUTOFIGURE_OPTIMIZE_ITERATIONS"),
            DEFAULT_OPTIMIZE_ITERATIONS,
        ),
    }


def build_public_web_config() -> dict[str, Any]:
    provider_settings = resolve_provider_settings(provider_fallback=DEFAULT_WEB_PROVIDER)
    sam_settings = resolve_sam_settings(sam_backend_fallback=DEFAULT_WEB_SAM_BACKEND)

    api_key_configured_by_provider = {
        provider: bool(resolve_provider_api_key(provider))
        for provider in PROVIDER_CONFIGS
    }

    return {
        "providers": PROVIDER_CONFIGS,
        "defaults": {
            "sam_prompt": sam_settings["sam_prompt"],
            "placeholder_mode": sam_settings["placeholder_mode"],
            "merge_threshold": sam_settings["merge_threshold"],
            "min_score": sam_settings["min_score"],
            "optimize_iterations": sam_settings["optimize_iterations"],
        },
        "formDefaults": {
            "provider": provider_settings["provider"],
            "baseUrl": provider_settings["base_url"],
            "imageModel": provider_settings["image_model"],
            "svgModel": provider_settings["svg_model"],
            "imageSize": provider_settings["image_size"],
            "samBackend": sam_settings["sam_backend"],
            "samPrompt": sam_settings["sam_prompt"],
            "samMaxMasks": sam_settings["sam_max_masks"],
            "placeholderMode": sam_settings["placeholder_mode"],
            "mergeThreshold": sam_settings["merge_threshold"],
            "minScore": sam_settings["min_score"],
            "optimizeIterations": sam_settings["optimize_iterations"],
            "apiKeyConfiguredByProvider": api_key_configured_by_provider,
        },
        "capabilities": {
            "geminiSupportsCustomBaseUrl": False,
        },
    }
