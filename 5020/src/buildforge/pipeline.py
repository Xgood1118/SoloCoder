"""Pipeline execution engine with serial/parallel support and dependency management."""

from __future__ import annotations

import asyncio
import os
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


@dataclass
class StepResult:
    """Result of a step execution."""

    name: str
    success: bool
    output: str = ""
    error: str = ""
    duration: float = 0.0
    exit_code: int = 0


@dataclass
class StageResult:
    """Result of a stage execution."""

    name: str
    success: bool
    step_results: List[StepResult] = field(default_factory=list)
    duration: float = 0.0


@dataclass
class PipelineResult:
    """Result of a pipeline execution."""

    success: bool
    stage_results: List[StageResult] = field(default_factory=list)
    duration: float = 0.0

    @property
    def failed_stages(self) -> List[StageResult]:
        return [s for s in self.stage_results if not s.success]


class StepExecutor:
    """Executes individual pipeline steps."""

    def __init__(self, config: Dict[str, Any], workdir: str) -> None:
        self._config = config
        self._workdir = Path(workdir)
        self._env = os.environ.copy()

    async def execute(self, step: Dict[str, Any]) -> StepResult:
        """Execute a single step."""
        name = step["name"]
        start_time = time.time()

        retries = step.get("retry", 0)
        timeout = step.get("timeout")
        ignore_failure = step.get("ignore_failure", False)

        last_error: Optional[str] = None
        last_output = ""
        last_exit_code = 0

        for attempt in range(retries + 1):
            try:
                if not self._check_condition(step):
                    return StepResult(
                        name=name,
                        success=True,
                        output="Step skipped due to condition",
                        duration=time.time() - start_time,
                    )

                if "command" in step:
                    output, exit_code = await self._run_command(step, timeout)
                elif "script" in step:
                    output, exit_code = await self._run_script(step, timeout)
                else:
                    output, exit_code = "No execution required (pipeline reference)", 0

                if exit_code == 0:
                    return StepResult(
                        name=name,
                        success=True,
                        output=output,
                        duration=time.time() - start_time,
                        exit_code=exit_code,
                    )

                last_output = output
                last_exit_code = exit_code
                last_error = f"Exit code {exit_code}"

            except asyncio.TimeoutError:
                last_error = f"Timeout after {timeout}s"
                last_exit_code = -1
            except Exception as e:
                last_error = str(e)
                last_exit_code = -2

            if attempt < retries:
                await asyncio.sleep(1)

        success = ignore_failure
        return StepResult(
            name=name,
            success=success,
            output=last_output,
            error=last_error or "",
            duration=time.time() - start_time,
            exit_code=last_exit_code,
        )

    def _check_condition(self, step: Dict[str, Any]) -> bool:
        """Check if a step's condition is satisfied."""
        condition = step.get("condition")
        if not condition:
            return True
        try:
            return self._eval_condition(condition)
        except Exception:
            return False

    def _eval_condition(self, condition: str) -> bool:
        """Evaluate a condition expression."""
        context = {"env": self._env, "config": self._config}
        match = re.match(r"^\$\{(.+)\}$", condition.strip())
        if match:
            expr = match.group(1)
            return bool(eval(expr, {"__builtins__": {}}, context))
        return True

    async def _run_command(
        self, step: Dict[str, Any], timeout: Optional[int]
    ) -> tuple[str, int]:
        """Run a command step."""
        cmd = step["command"]
        cwd = step.get("cwd", str(self._workdir))
        extra_env = step.get("env", {})

        env = self._env.copy()
        env.update({k: str(v) for k, v in extra_env.items()})

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )

        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = stdout.decode("utf-8", errors="replace")
            return output, proc.returncode or 0
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise

    async def _run_script(
        self, step: Dict[str, Any], timeout: Optional[int]
    ) -> tuple[str, int]:
        """Run a script step."""
        script = step["script"]
        cwd = step.get("cwd", str(self._workdir))
        extra_env = step.get("env", {})

        env = self._env.copy()
        env.update({k: str(v) for k, v in extra_env.items()})

        proc = await asyncio.create_subprocess_shell(
            script,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )

        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = stdout.decode("utf-8", errors="replace")
            return output, proc.returncode or 0
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise


class StageExecutor:
    """Executes pipeline stages with serial or parallel mode."""

    def __init__(self, config: Dict[str, Any], workdir: str) -> None:
        self._config = config
        self._workdir = workdir

    async def execute(self, stage: Dict[str, Any]) -> StageResult:
        """Execute a stage."""
        name = stage["name"]
        start_time = time.time()
        mode = stage.get("mode", "parallel")
        steps = stage["steps"]

        if not self._check_condition(stage):
            return StageResult(
                name=name,
                success=True,
                step_results=[],
                duration=time.time() - start_time,
            )

        step_executor = StepExecutor(self._config, self._workdir)

        if mode == "serial":
            results = await self._execute_serial(steps, step_executor)
        else:
            results = await self._execute_parallel(steps, step_executor)

        success = all(r.success for r in results)
        return StageResult(
            name=name,
            success=success,
            step_results=results,
            duration=time.time() - start_time,
        )

    def _check_condition(self, stage: Dict[str, Any]) -> bool:
        """Check if a stage's condition is satisfied."""
        condition = stage.get("condition")
        if not condition:
            return True
        context = {"env": os.environ, "config": self._config}
        match = re.match(r"^\$\{(.+)\}$", condition.strip())
        if match:
            expr = match.group(1)
            try:
                return bool(eval(expr, {"__builtins__": {}}, context))
            except Exception:
                return False
        return True

    async def _execute_serial(
        self, steps: List[Dict[str, Any]], executor: StepExecutor
    ) -> List[StepResult]:
        """Execute steps in serial order."""
        results: List[StepResult] = []
        completed: Set[str] = set()

        for step in steps:
            depends_on = step.get("depends_on", [])
            for dep in depends_on:
                if dep not in completed:
                    results.append(
                        StepResult(
                            name=step["name"],
                            success=False,
                            error=f"Dependency '{dep}' not completed successfully",
                        )
                    )
                    continue

            result = await executor.execute(step)
            results.append(result)
            if result.success:
                completed.add(step["name"])

        return results

    async def _execute_parallel(
        self, steps: List[Dict[str, Any]], executor: StepExecutor
    ) -> List[StepResult]:
        """Execute steps in parallel with dependency resolution."""
        results: Dict[str, StepResult] = {}
        pending: Set[str] = {s["name"] for s in steps}
        steps_by_name: Dict[str, Dict[str, Any]] = {s["name"]: s for s in steps}

        while pending:
            ready = [
                name
                for name in pending
                if all(dep in results and results[dep].success for dep in steps_by_name[name].get("depends_on", []))
            ]

            if not ready:
                for name in pending:
                    results[name] = StepResult(
                        name=name,
                        success=False,
                        error="Circular dependency or unsatisfied dependencies",
                    )
                break

            tasks = [executor.execute(steps_by_name[name]) for name in ready]
            batch_results = await asyncio.gather(*tasks)

            for result in batch_results:
                results[result.name] = result
                pending.discard(result.name)

        return [results[s["name"]] for s in steps]


class PipelineExecutor:
    """Main pipeline execution engine."""

    def __init__(
        self,
        pipeline_data: Dict[str, Any],
        config: Dict[str, Any],
        workdir: Optional[str] = None,
    ) -> None:
        self._pipeline_data = pipeline_data
        self._config = config
        self._workdir = workdir or str(Path.cwd())
        self._stage_executor = StageExecutor(config, self._workdir)

    async def execute(self, pipeline_name: Optional[str] = None) -> PipelineResult:
        """Execute the pipeline."""
        start_time = time.time()

        if pipeline_name:
            stages = self._get_sub_pipeline_stages(pipeline_name)
        else:
            stages = self._pipeline_data.get("stages", [])

        stage_results: List[StageResult] = []
        overall_success = True

        for stage in stages:
            result = await self._stage_executor.execute(stage)
            stage_results.append(result)
            if not result.success:
                overall_success = False
                break

        return PipelineResult(
            success=overall_success,
            stage_results=stage_results,
            duration=time.time() - start_time,
        )

    def _get_sub_pipeline_stages(self, name: str) -> List[Dict[str, Any]]:
        """Get stages from a sub-pipeline with inheritance resolution."""
        pipelines = self._pipeline_data.get("pipelines", {})
        if name not in pipelines:
            raise ValueError(f"Sub-pipeline '{name}' not found")

        pipeline_def = pipelines[name]
        stages = list(pipeline_def.get("stages", []))

        extends = pipeline_def.get("extends")
        if extends:
            parent_stages = self._get_sub_pipeline_stages(extends)
            stage_map = {s["name"]: s for s in parent_stages}
            for stage in stages:
                stage_map[stage["name"]] = stage
            stages = list(stage_map.values())

        return stages
