"""Schema validation for pipeline definitions."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from jsonschema import Draft7Validator, ValidationError


class SchemaValidator:
    """Validates pipeline definitions against JSON Schema."""

    def __init__(self) -> None:
        self._schema = self._load_schema()
        self._validator = Draft7Validator(self._schema)

    def _load_schema(self) -> Dict[str, Any]:
        """Load the pipeline JSON schema."""
        schema_path = Path(__file__).parent / "schemas" / "pipeline.json"
        with open(schema_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def validate(self, data: Dict[str, Any]) -> List[str]:
        """Validate pipeline data against the schema.
        
        Returns a list of validation error messages. Empty list means valid.
        """
        errors: List[str] = []
        for error in self._validator.iter_errors(data):
            errors.append(self._format_error(error))
        errors.extend(self._validate_custom_rules(data))
        return errors

    def _format_error(self, error: ValidationError) -> str:
        """Format a validation error into a human-readable message."""
        path = " -> ".join(str(p) for p in error.path) if error.path else "root"
        return f"[{path}] {error.message}"

    def _validate_custom_rules(self, data: Dict[str, Any]) -> List[str]:
        """Apply custom validation rules not expressible in JSON Schema."""
        errors: List[str] = []

        stage_names = set()
        for i, stage in enumerate(data.get("stages", [])):
            name = stage.get("name")
            if name in stage_names:
                errors.append(f"Duplicate stage name '{name}' at index {i}")
            stage_names.add(name)

            step_names = set()
            for j, step in enumerate(stage.get("steps", [])):
                step_name = step.get("name")
                if step_name in step_names:
                    errors.append(
                        f"Duplicate step name '{step_name}' in stage '{name}' at index {j}"
                    )
                step_names.add(step_name)

                depends_on = step.get("depends_on", [])
                for dep in depends_on:
                    if dep not in step_names:
                        errors.append(
                            f"Step '{step_name}' in stage '{name}' depends on "
                            f"undefined step '{dep}'"
                        )

        pipeline_names = set(data.get("pipelines", {}).keys())
        for stage in data.get("stages", []):
            for step in stage.get("steps", []):
                pipeline_ref = step.get("pipeline")
                if pipeline_ref and pipeline_ref not in pipeline_names:
                    errors.append(
                        f"Step '{step.get('name')}' references undefined "
                        f"pipeline '{pipeline_ref}'"
                    )

        for name, pipeline_def in data.get("pipelines", {}).items():
            extends = pipeline_def.get("extends")
            if extends and extends not in pipeline_names:
                errors.append(
                    f"Pipeline '{name}' extends undefined pipeline '{extends}'"
                )
            if extends and extends == name:
                errors.append(f"Pipeline '{name}' cannot extend itself")

        return errors

    def is_valid(self, data: Dict[str, Any]) -> bool:
        """Check if pipeline data is valid."""
        return len(self.validate(data)) == 0


class PipelineLoader:
    """Load and validate pipeline definitions from files."""

    def __init__(self) -> None:
        self._validator = SchemaValidator()

    def load(self, file_path: str) -> Dict[str, Any]:
        """Load and validate a pipeline definition file.
        
        Supports both YAML and JSON formats.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Pipeline file not found: {file_path}")

        data = self._parse_file(path)
        errors = self._validator.validate(data)
        if errors:
            raise ValidationError(
                "Pipeline validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
            )

        return data

    def _parse_file(self, path: Path) -> Dict[str, Any]:
        """Parse a YAML or JSON file."""
        suffix = path.suffix.lower()
        with open(path, "r", encoding="utf-8") as f:
            if suffix in (".yaml", ".yml"):
                return yaml.safe_load(f)
            elif suffix == ".json":
                return json.load(f)
            else:
                raise ValueError(
                    f"Unsupported file format: {suffix}. Use .yaml, .yml, or .json"
                )
