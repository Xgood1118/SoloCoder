"""Command-line interface for BuildForge."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

import click

from .config import ConfigLoader
from .packager import Packager, PackageResult
from .pipeline import PipelineExecutor, PipelineResult
from .schema import PipelineLoader, SchemaValidator
from .signer import ArtifactSigner, KeyManager


class BuildForgeCLI:
    """Main CLI application class."""

    def __init__(self) -> None:
        self._loader = PipelineLoader()
        self._validator = SchemaValidator()
        self._signer = ArtifactSigner()
        self._key_manager = KeyManager()

    def load_pipeline(self, file_path: str) -> Dict:
        """Load and validate a pipeline file."""
        try:
            return self._loader.load(file_path)
        except Exception as e:
            click.echo(f"Error loading pipeline: {e}", err=True)
            sys.exit(1)

    def build_config(
        self,
        pipeline_data: Dict,
        environment: str,
        overrides: Optional[List[str]] = None,
    ) -> Dict:
        """Build resolved configuration."""
        cli_overrides = self._parse_overrides(overrides)
        config = ConfigLoader.build_root_config(
            pipeline_data, environment=environment, cli_overrides=cli_overrides
        )
        return config.get_all()

    @staticmethod
    def _parse_overrides(overrides: Optional[List[str]]) -> Dict:
        """Parse key=value override pairs."""
        result: Dict = {}
        for ovr in overrides or []:
            if "=" in ovr:
                key, value = ovr.split("=", 1)
                result[key.strip()] = value.strip()
        return result

    async def run_pipeline(
        self,
        file_path: str,
        environment: str,
        pipeline_name: Optional[str] = None,
        overrides: Optional[List[str]] = None,
        workdir: Optional[str] = None,
    ) -> PipelineResult:
        """Execute a pipeline."""
        pipeline_data = self.load_pipeline(file_path)
        config = self.build_config(pipeline_data, environment, overrides)

        workdir = workdir or str(Path(file_path).parent)

        click.echo(f"\n{'='*60}")
        click.echo(f"Running pipeline: {pipeline_data.get('name', 'unnamed')}")
        click.echo(f"Environment: {environment}")
        click.echo(f"Working directory: {workdir}")
        click.echo(f"{'='*60}\n")

        executor = PipelineExecutor(pipeline_data, config, workdir)
        result = await executor.execute(pipeline_name)

        self._print_pipeline_result(result)
        return result

    def _print_pipeline_result(self, result: PipelineResult) -> None:
        """Print pipeline execution results."""
        click.echo(f"\n{'='*60}")
        if result.success:
            click.echo(click.style("Pipeline completed successfully!", fg="green"))
        else:
            click.echo(click.style("Pipeline failed!", fg="red", bold=True))
        click.echo(f"Total duration: {result.duration:.2f}s")
        click.echo(f"{'='*60}\n")

        for stage in result.stage_results:
            status_icon = "[OK]" if stage.success else "[FAIL]"
            status_color = "green" if stage.success else "red"
            click.echo(
                f"{click.style(status_icon, fg=status_color)} Stage: {stage.name} "
                f"({stage.duration:.2f}s)"
            )

            for step in stage.step_results:
                step_icon = "[OK]" if step.success else "[FAIL]"
                step_color = "green" if step.success else "red"
                click.echo(
                    f"  {click.style(step_icon, fg=step_color)} Step: {step.name} "
                    f"({step.duration:.2f}s)"
                )
                if step.error:
                    click.echo(f"    Error: {step.error}")
                if step.output and not step.success:
                    click.echo(f"    Output: {step.output[:500]}")

    def package_artifacts(
        self,
        file_path: str,
        environment: str,
        output_dir: str,
        overrides: Optional[List[str]] = None,
        workdir: Optional[str] = None,
        sign: bool = True,
    ) -> List[PackageResult]:
        """Package artifacts defined in the pipeline."""
        pipeline_data = self.load_pipeline(file_path)
        artifacts = pipeline_data.get("artifacts", [])

        if not artifacts:
            click.echo("No artifacts defined in pipeline.")
            return []

        workdir = workdir or str(Path(file_path).parent)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        click.echo(f"\n{'='*60}")
        click.echo(f"Packaging {len(artifacts)} artifact(s)")
        click.echo(f"Output directory: {output_dir}")
        click.echo(f"{'='*60}\n")

        packager = Packager(workdir)
        results = packager.package_all(artifacts, output_dir)

        self._print_package_results(results)

        if sign:
            for result in results:
                if result.success and result.output_path:
                    try:
                        self._signer.sign(result.output_path)
                        click.echo(
                            click.style(f"  Signed: {result.output_path}.sig", fg="green")
                        )
                    except Exception as e:
                        click.echo(
                            click.style(f"  Signing failed: {e}", fg="yellow")
                        )

        return results

    def _print_package_results(self, results: List[PackageResult]) -> None:
        """Print packaging results."""
        for result in results:
            status_icon = "[OK]" if result.success else "[FAIL]"
            status_color = "green" if result.success else "red"
            click.echo(
                f"{click.style(status_icon, fg=status_color)} {result.name}"
            )
            if result.success:
                click.echo(f"  Output: {result.output_path}")
                size_mb = result.size / (1024 * 1024)
                click.echo(f"  Size: {size_mb:.2f} MB")
                if result.checksums:
                    click.echo(f"  SHA256: {result.checksums.get('sha256', '')}")
            else:
                click.echo(f"  Error: {result.error}")

    def validate_pipeline(self, file_path: str) -> None:
        """Validate a pipeline definition."""
        click.echo(f"Validating pipeline: {file_path}")
        try:
            self._loader.load(file_path)
            click.echo(click.style("[OK] Pipeline is valid!", fg="green"))
        except Exception as e:
            click.echo(click.style(f"[FAIL] Validation failed:\n{e}", fg="red"), err=True)
            sys.exit(1)

    def generate_keys(self, key_name: str = "default") -> None:
        """Generate signing keys."""
        click.echo(f"Generating key pair: {key_name}")
        try:
            private_path, public_path = self._key_manager.generate_keys(key_name)
            click.echo(click.style("[OK] Keys generated successfully!", fg="green"))
            click.echo(f"  Private key: {private_path}")
            click.echo(f"  Public key: {public_path}")
            click.echo(
                click.style(
                    "  Warning: Keep the private key secure!", fg="yellow", bold=True
                )
            )
        except Exception as e:
            click.echo(click.style(f"[FAIL] Key generation failed: {e}", fg="red"), err=True)
            sys.exit(1)

    def sign_artifact(self, artifact_path: str, key_name: str = "default") -> None:
        """Sign an artifact."""
        click.echo(f"Signing artifact: {artifact_path}")
        try:
            result = self._signer.sign(artifact_path, key_name)
            click.echo(click.style("[OK] Artifact signed successfully!", fg="green"))
            click.echo(f"  Signature file: {result['signature_file']}")
            click.echo(f"  SHA256: {result['file_hash']}")
        except Exception as e:
            click.echo(click.style(f"[FAIL] Signing failed: {e}", fg="red"), err=True)
            sys.exit(1)

    def verify_artifact(
        self,
        artifact_path: str,
        signature_path: Optional[str] = None,
        public_key_path: Optional[str] = None,
    ) -> None:
        """Verify an artifact's signature."""
        click.echo(f"Verifying artifact: {artifact_path}")
        try:
            result = self._signer.verify(artifact_path, signature_path, public_key_path)
            if result["valid"]:
                click.echo(click.style("[OK] Signature verified successfully!", fg="green"))
                click.echo(f"  Algorithm: {result.get('algorithm', 'N/A')}")
                click.echo(f"  Key: {result.get('key_name', 'N/A')}")
            else:
                click.echo(
                    click.style(f"[FAIL] Verification failed: {result['error']}", fg="red"),
                    err=True,
                )
                sys.exit(1)
        except Exception as e:
            click.echo(click.style(f"[FAIL] Verification error: {e}", fg="red"), err=True)
            sys.exit(1)

    def show_config(
        self,
        file_path: str,
        environment: str,
        overrides: Optional[List[str]] = None,
    ) -> None:
        """Show resolved configuration."""
        pipeline_data = self.load_pipeline(file_path)
        config = self.build_config(pipeline_data, environment, overrides)

        click.echo(f"\nResolved configuration for environment '{environment}':")
        click.echo("=" * 60)
        click.echo(json.dumps(config, indent=2, sort_keys=True))
        click.echo("=" * 60)


cli_app = BuildForgeCLI()


@click.group()
@click.version_option(version="0.1.0", prog_name="buildforge")
def cli() -> None:
    """BuildForge - A build tool for managing task pipelines and artifact packaging."""
    pass


@cli.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-e",
    "--environment",
    default="dev",
    show_default=True,
    help="Target environment (dev/test/prod)",
)
@click.option(
    "-p",
    "--pipeline",
    "pipeline_name",
    help="Run a specific sub-pipeline",
)
@click.option(
    "-o",
    "--override",
    "overrides",
    multiple=True,
    help="Override config value (key=value)",
)
@click.option(
    "-w",
    "--workdir",
    type=click.Path(file_okay=False),
    help="Working directory",
)
def run(file_path, environment, pipeline_name, overrides, workdir) -> None:
    """Execute a pipeline."""
    result = asyncio.run(
        cli_app.run_pipeline(file_path, environment, pipeline_name, list(overrides), workdir)
    )
    sys.exit(0 if result.success else 1)


@cli.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-e",
    "--environment",
    default="dev",
    show_default=True,
    help="Target environment",
)
@click.option(
    "-o",
    "--output-dir",
    default="dist",
    show_default=True,
    help="Output directory for artifacts",
)
@click.option(
    "--sign/--no-sign",
    default=True,
    show_default=True,
    help="Sign artifacts after packaging",
)
@click.option(
    "-w",
    "--workdir",
    type=click.Path(file_okay=False),
    help="Working directory",
)
@click.option(
    "--override",
    "overrides",
    multiple=True,
    help="Override config value (key=value)",
)
def package(file_path, environment, output_dir, sign, workdir, overrides) -> None:
    """Package artifacts defined in the pipeline."""
    results = cli_app.package_artifacts(
        file_path, environment, output_dir, list(overrides), workdir, sign
    )
    success = all(r.success for r in results)
    sys.exit(0 if success else 1)


@cli.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
def validate(file_path) -> None:
    """Validate a pipeline definition file."""
    cli_app.validate_pipeline(file_path)


@cli.command("config")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-e",
    "--environment",
    default="dev",
    show_default=True,
    help="Target environment",
)
@click.option(
    "-o",
    "--override",
    "overrides",
    multiple=True,
    help="Override config value (key=value)",
)
def show_config_cmd(file_path, environment, overrides) -> None:
    """Show resolved configuration for an environment."""
    cli_app.show_config(file_path, environment, list(overrides))


@cli.group()
def keys() -> None:
    """Manage signing keys."""
    pass


@keys.command("generate")
@click.option(
    "-n",
    "--name",
    "key_name",
    default="default",
    show_default=True,
    help="Key name",
)
def generate_keys(key_name) -> None:
    """Generate a new signing key pair."""
    cli_app.generate_keys(key_name)


@cli.group()
def sign() -> None:
    """Sign and verify artifacts."""
    pass


@sign.command("artifact")
@click.argument("artifact_path", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-k",
    "--key",
    "key_name",
    default="default",
    show_default=True,
    help="Signing key name",
)
def sign_artifact_cmd(artifact_path, key_name) -> None:
    """Sign an artifact."""
    cli_app.sign_artifact(artifact_path, key_name)


@sign.command("verify")
@click.argument("artifact_path", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-s",
    "--signature",
    "signature_path",
    type=click.Path(exists=True, dir_okay=False),
    help="Signature file path",
)
@click.option(
    "-p",
    "--public-key",
    "public_key_path",
    type=click.Path(exists=True, dir_okay=False),
    help="Public key path",
)
def verify_artifact_cmd(artifact_path, signature_path, public_key_path) -> None:
    """Verify an artifact's signature."""
    cli_app.verify_artifact(artifact_path, signature_path, public_key_path)


if __name__ == "__main__":
    cli()
