"""Tests for schema validation."""

import pytest
from jsonschema import ValidationError

from buildforge.schema import SchemaValidator, PipelineLoader


class TestSchemaValidator:
    """Test SchemaValidator class."""

    def test_valid_pipeline(self, sample_pipeline_data):
        """Test valid pipeline passes validation."""
        validator = SchemaValidator()
        errors = validator.validate(sample_pipeline_data)
        assert len(errors) == 0
        assert validator.is_valid(sample_pipeline_data)

    def test_missing_required_fields(self):
        """Test missing required fields are detected."""
        validator = SchemaValidator()
        errors = validator.validate({"name": "test"})
        assert len(errors) > 0
        assert any("version" in e for e in errors)
        assert any("stages" in e for e in errors)

    def test_invalid_version(self, sample_pipeline_data):
        """Test invalid version is detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["version"] = "2.0"
        errors = validator.validate(data)
        assert len(errors) > 0
        assert any("version" in e for e in errors)

    def test_invalid_stage_mode(self, sample_pipeline_data):
        """Test invalid stage mode is detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["stages"][0]["mode"] = "invalid"
        errors = validator.validate(data)
        assert len(errors) > 0
        assert any("mode" in e for e in errors)

    def test_step_missing_command_script_or_pipeline(self, sample_pipeline_data):
        """Test step must have command, script, or pipeline."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["stages"][0]["steps"][0] = {"name": "bad-step"}
        errors = validator.validate(data)
        assert len(errors) > 0

    def test_duplicate_stage_names(self, sample_pipeline_data):
        """Test duplicate stage names are detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["stages"].append(
            {"name": "build", "mode": "serial", "steps": [{"name": "step", "command": ["echo"]}]}
        )
        errors = validator.validate(data)
        assert any("Duplicate stage name 'build'" in e for e in errors)

    def test_duplicate_step_names(self, sample_pipeline_data):
        """Test duplicate step names are detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["stages"][0]["steps"].append({"name": "compile", "command": ["echo"]})
        errors = validator.validate(data)
        assert any("Duplicate step name 'compile'" in e for e in errors)

    def test_invalid_step_dependency(self, sample_pipeline_data):
        """Test step dependencies on undefined steps are detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["stages"][0]["steps"][1]["depends_on"] = ["undefined-step"]
        errors = validator.validate(data)
        assert any("depends on undefined step 'undefined-step'" in e for e in errors)

    def test_undefined_pipeline_reference(self, sample_pipeline_data):
        """Test references to undefined pipelines are detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["stages"][0]["steps"].append(
            {"name": "run-pipeline", "pipeline": "undefined-pipeline"}
        )
        errors = validator.validate(data)
        assert any("references undefined pipeline" in e for e in errors)

    def test_circular_pipeline_extends(self, sample_pipeline_data):
        """Test pipeline cannot extend itself."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["pipelines"] = {"test": {"extends": "test", "stages": []}}
        errors = validator.validate(data)
        assert any("cannot extend itself" in e for e in errors)

    def test_invalid_artifact_type(self, sample_pipeline_data):
        """Test invalid artifact type is detected."""
        validator = SchemaValidator()
        data = dict(sample_pipeline_data)
        data["artifacts"][0]["type"] = "invalid"
        errors = validator.validate(data)
        assert any("type" in e for e in errors)


class TestPipelineLoader:
    """Test PipelineLoader class."""

    def test_load_yaml_file(self, temp_workdir, sample_pipeline_data):
        """Test loading a YAML pipeline file."""
        import yaml

        yaml_file = temp_workdir / "pipeline.yaml"
        yaml_file.write_text(yaml.dump(sample_pipeline_data))

        loader = PipelineLoader()
        data = loader.load(str(yaml_file))
        assert data["name"] == "Test Pipeline"
        assert len(data["stages"]) == 1

    def test_load_json_file(self, temp_workdir, sample_pipeline_data):
        """Test loading a JSON pipeline file."""
        import json

        json_file = temp_workdir / "pipeline.json"
        json_file.write_text(json.dumps(sample_pipeline_data))

        loader = PipelineLoader()
        data = loader.load(str(json_file))
        assert data["name"] == "Test Pipeline"

    def test_load_invalid_file_raises(self, temp_workdir, sample_pipeline_data):
        """Test loading an invalid file raises ValidationError."""
        import yaml

        invalid_data = {"name": "invalid"}
        yaml_file = temp_workdir / "invalid.yaml"
        yaml_file.write_text(yaml.dump(invalid_data))

        loader = PipelineLoader()
        with pytest.raises(ValidationError):
            loader.load(str(yaml_file))

    def test_load_nonexistent_file_raises(self):
        """Test loading a nonexistent file raises FileNotFoundError."""
        loader = PipelineLoader()
        with pytest.raises(FileNotFoundError):
            loader.load("/nonexistent/pipeline.yaml")

    def test_unsupported_format_raises(self, temp_workdir):
        """Test unsupported file format raises ValueError."""
        txt_file = temp_workdir / "pipeline.txt"
        txt_file.write_text("not valid")

        loader = PipelineLoader()
        with pytest.raises(ValueError):
            loader.load(str(txt_file))
