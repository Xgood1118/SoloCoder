"""Tests for pipeline execution engine."""

import asyncio
import pytest

from buildforge.pipeline import (
    StepExecutor,
    StageExecutor,
    PipelineExecutor,
    StepResult,
    StageResult,
    PipelineResult,
)


class TestStepResult:
    """Test StepResult dataclass."""

    def test_step_result_creation(self):
        """Test creating a StepResult."""
        result = StepResult(
            name="test",
            success=True,
            output="done",
            error="",
            duration=1.5,
            exit_code=0,
        )
        assert result.name == "test"
        assert result.success is True
        assert result.output == "done"
        assert result.duration == 1.5


class TestPipelineResult:
    """Test PipelineResult functionality."""

    def test_failed_stages_property(self):
        """Test failed_stages property returns only failed stages."""
        stage1 = StageResult(name="success", success=True)
        stage2 = StageResult(name="failed", success=False)
        pipeline = PipelineResult(success=False, stage_results=[stage1, stage2])

        assert len(pipeline.failed_stages) == 1
        assert pipeline.failed_stages[0].name == "failed"


class TestStepExecutor:
    """Test StepExecutor class."""

    @pytest.mark.asyncio
    async def test_execute_command_success(self, temp_workdir):
        """Test executing a successful command."""
        executor = StepExecutor(config={}, workdir=str(temp_workdir))
        step = {"name": "test", "command": ["python", "-c", "print('hello')"]}

        result = await executor.execute(step)
        assert result.name == "test"
        assert result.success is True
        assert "hello" in result.output
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_execute_command_failure(self, temp_workdir):
        """Test executing a failing command."""
        executor = StepExecutor(config={}, workdir=str(temp_workdir))
        step = {"name": "test", "command": ["python", "-c", "exit(1)"]}

        result = await executor.execute(step)
        assert result.success is False
        assert result.exit_code == 1
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_execute_script(self, temp_workdir):
        """Test executing a shell script."""
        executor = StepExecutor(config={}, workdir=str(temp_workdir))
        step = {"name": "test", "script": "echo script-test"}

        result = await executor.execute(step)
        assert result.success is True
        assert "script-test" in result.output

    @pytest.mark.asyncio
    async def test_retry_on_failure(self, temp_workdir):
        """Test retry mechanism on failure."""
        executor = StepExecutor(config={}, workdir=str(temp_workdir))
        step = {
            "name": "test",
            "command": ["python", "-c", "import sys; sys.exit(1)"],
            "retry": 2,
        }

        result = await executor.execute(step)
        assert result.success is False
        assert "Exit code 1" in result.error

    @pytest.mark.asyncio
    async def test_ignore_failure(self, temp_workdir):
        """Test ignore_failure flag."""
        executor = StepExecutor(config={}, workdir=str(temp_workdir))
        step = {
            "name": "test",
            "command": ["python", "-c", "exit(1)"],
            "ignore_failure": True,
        }

        result = await executor.execute(step)
        assert result.success is True
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_condition_skip(self, temp_workdir):
        """Test step is skipped when condition is false."""
        executor = StepExecutor(config={"skip": True}, workdir=str(temp_workdir))
        step = {
            "name": "test",
            "command": ["python", "-c", "print('should not run')"],
            "condition": "${config.skip == False}",
        }

        result = await executor.execute(step)
        assert result.success is True
        assert "skipped" in result.output

    @pytest.mark.asyncio
    async def test_timeout(self, temp_workdir):
        """Test step timeout."""
        executor = StepExecutor(config={}, workdir=str(temp_workdir))
        step = {
            "name": "test",
            "command": ["python", "-c", "import time; time.sleep(5)"],
            "timeout": 1,
        }

        result = await executor.execute(step)
        assert result.success is False
        assert "Timeout" in result.error


class TestStageExecutor:
    """Test StageExecutor class."""

    @pytest.mark.asyncio
    async def test_serial_execution(self, temp_workdir):
        """Test serial stage execution."""
        executor = StageExecutor(config={}, workdir=str(temp_workdir))
        stage = {
            "name": "serial-stage",
            "mode": "serial",
            "steps": [
                {"name": "step1", "command": ["python", "-c", "print('step1')"]},
                {"name": "step2", "command": ["python", "-c", "print('step2')"], "depends_on": ["step1"]},
            ],
        }

        result = await executor.execute(stage)
        assert result.name == "serial-stage"
        assert result.success is True
        assert len(result.step_results) == 2
        assert result.step_results[0].name == "step1"
        assert result.step_results[1].name == "step2"

    @pytest.mark.asyncio
    async def test_parallel_execution(self, temp_workdir):
        """Test parallel stage execution."""
        executor = StageExecutor(config={}, workdir=str(temp_workdir))
        stage = {
            "name": "parallel-stage",
            "mode": "parallel",
            "steps": [
                {"name": "step1", "command": ["python", "-c", "print('step1')"]},
                {"name": "step2", "command": ["python", "-c", "print('step2')"]},
            ],
        }

        result = await executor.execute(stage)
        assert result.success is True
        assert len(result.step_results) == 2

    @pytest.mark.asyncio
    async def test_parallel_with_dependencies(self, temp_workdir):
        """Test parallel execution with dependencies."""
        executor = StageExecutor(config={}, workdir=str(temp_workdir))
        stage = {
            "name": "parallel-deps",
            "mode": "parallel",
            "steps": [
                {"name": "step1", "command": ["python", "-c", "print('step1')"]},
                {"name": "step2", "command": ["python", "-c", "print('step2')"]},
                {"name": "step3", "command": ["python", "-c", "print('step3')"], "depends_on": ["step1", "step2"]},
            ],
        }

        result = await executor.execute(stage)
        assert result.success is True
        assert all(r.success for r in result.step_results)

    @pytest.mark.asyncio
    async def test_stage_condition_skip(self, temp_workdir):
        """Test stage is skipped when condition is false."""
        executor = StageExecutor(config={"skip": True}, workdir=str(temp_workdir))
        stage = {
            "name": "skipped-stage",
            "mode": "serial",
            "condition": "${config.skip == False}",
            "steps": [
                {"name": "step1", "command": ["python", "-c", "print('should not run')"]},
            ],
        }

        result = await executor.execute(stage)
        assert result.success is True
        assert len(result.step_results) == 0


class TestPipelineExecutor:
    """Test PipelineExecutor class."""

    @pytest.mark.asyncio
    async def test_execute_pipeline(self, temp_workdir, sample_pipeline_data):
        """Test executing a full pipeline."""
        sample_pipeline_data["stages"][0]["steps"][0]["command"] = ["python", "-c", "print('compile')"]
        sample_pipeline_data["stages"][0]["steps"][1]["command"] = ["python", "-c", "print('package')"]

        executor = PipelineExecutor(
            sample_pipeline_data,
            config={},
            workdir=str(temp_workdir),
        )

        result = await executor.execute()
        assert result.success is True
        assert len(result.stage_results) == 1
        assert result.stage_results[0].name == "build"

    @pytest.mark.asyncio
    async def test_pipeline_failure_stops_execution(self, temp_workdir, sample_pipeline_data):
        """Test that a stage failure stops pipeline execution."""
        sample_pipeline_data["stages"].append(
            {
                "name": "second",
                "mode": "serial",
                "steps": [{"name": "should-not-run", "command": ["echo", "nope"]}],
            }
        )
        sample_pipeline_data["stages"][0]["steps"][0]["command"] = ["python", "-c", "exit(1)"]

        executor = PipelineExecutor(
            sample_pipeline_data,
            config={},
            workdir=str(temp_workdir),
        )

        result = await executor.execute()
        assert result.success is False
        assert len(result.stage_results) == 1

    def test_sub_pipeline_inheritance(self, temp_workdir, sample_pipeline_data):
        """Test sub-pipeline stage inheritance."""
        sample_pipeline_data["pipelines"] = {
            "base": {
                "stages": [
                    {"name": "base-stage", "mode": "serial", "steps": [{"name": "base-step", "command": ["echo"]}]}
                ]
            },
            "child": {
                "extends": "base",
                "stages": [
                    {"name": "child-stage", "mode": "serial", "steps": [{"name": "child-step", "command": ["echo"]}]}
                ],
            },
        }

        executor = PipelineExecutor(sample_pipeline_data, config={}, workdir=str(temp_workdir))
        stages = executor._get_sub_pipeline_stages("child")

        stage_names = [s["name"] for s in stages]
        assert "base-stage" in stage_names
        assert "child-stage" in stage_names
