import argparse
import json
import sys
import logging
from pathlib import Path
from typing import List

from .config import get_config, set_config, Config
from .pipeline import RAGPipeline, PipelineStep


def setup_logging(log_level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )


def load_config(config_path: str = None) -> Config:
    if config_path and Path(config_path).exists():
        config = Config.from_yaml(config_path)
        set_config(config)
    return get_config()


def print_step_results(results, indent: int = 0) -> None:
    prefix = "  " * indent
    for result in results:
        status = "✓" if result.success else "✗"
        print(f"{prefix}{status} {result.step}: ", end="")
        if result.success:
            print(f"success ({result.details.get('duration', 0):.2f}s)")
            if result.output_file:
                print(f"{prefix}  → {result.output_file}")
            for key, value in result.details.items():
                if key not in ["duration", "traceback"]:
                    if isinstance(value, dict):
                        print(f"{prefix}  → {key}:")
                        for k, v in value.items():
                            print(f"{prefix}      {k}: {v}")
                    else:
                        print(f"{prefix}  → {key}: {value}")
        else:
            print(f"FAILED")
            if result.error_message:
                print(f"{prefix}  Error: {result.error_message}")


def cmd_parse(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        result = pipeline.run_step(PipelineStep.PARSE, args.input)
        print_step_results([result])
        return 0 if result.success else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_chunk(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        result = pipeline.run_step(PipelineStep.CHUNK, args.input)
        print_step_results([result])
        return 0 if result.success else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_embed(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        result = pipeline.run_step(PipelineStep.EMBED, args.input)
        print_step_results([result])
        return 0 if result.success else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_store(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        result = pipeline.run_step(PipelineStep.STORE, args.input)
        print_step_results([result])
        return 0 if result.success else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_incremental(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        result = pipeline.run_step(PipelineStep.INCREMENTAL, args.input)
        print_step_results([result])
        return 0 if result.success else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_pipeline(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    step_map = {
        "parse": PipelineStep.PARSE,
        "chunk": PipelineStep.CHUNK,
        "embed": PipelineStep.EMBED,
        "store": PipelineStep.STORE,
        "incremental": PipelineStep.INCREMENTAL,
        "all": PipelineStep.ALL,
    }

    steps = [step_map[s] for s in args.steps] if args.steps else None

    try:
        result = pipeline.run_pipeline(args.input, steps)
        print(f"\n=== Pipeline Result ===")
        print(f"Input: {result.input_path}")
        print(f"Steps: {', '.join(result.steps)}")
        print(f"Total duration: {result.total_duration:.2f}s")
        print(f"Success: {'✓' if result.success else '✗'}")
        print(f"\n=== Step Details ===")
        print_step_results(result.results)

        failed = result.get_failed_steps()
        if failed:
            print(f"\n=== Failed Steps ===")
            print_step_results(failed)
            return 1

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_search(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    filter_version = args.version if args.all_versions else "latest"

    try:
        results = pipeline.search(
            query=args.query,
            top_k=args.top_k,
            top_n=args.top_n,
            use_cache=not args.no_cache,
            filter_version=filter_version,
            filter_document_ids=args.doc_ids.split(",") if args.doc_ids else None,
        )

        print(f"\n=== Search Results for: {args.query} ===")
        print(f"Found {len(results)} results")
        print()

        for i, result in enumerate(results, 1):
            print(f"--- Result {i} (score: {result.get('final_score', result.get('score', 0)):.4f}) ---")
            print(f"Document: {result['document_name']}")
            print(f"Version: {result.get('version', 'latest')}")
            if result.get("page_number"):
                print(f"Page: {result['page_number']}")
            if result.get("initial_rank") != result.get("rerank_rank"):
                print(f"Rank: {result.get('initial_rank')} → {result.get('rerank_rank')}")
            print(f"Content: {result['content'][:200]}...")
            if args.show_full:
                print(f"Full content: {result['content']}")
            print()

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"Results saved to: {args.output}")

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_list(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        docs = pipeline.list_documents()

        print(f"\n=== Documents in Vector Store ===")
        print(f"Total: {len(docs)} documents")
        print()

        for doc in docs:
            print(f"📄 {doc['document_name']}")
            print(f"   ID: {doc['document_id']}")
            print(f"   Versions: {', '.join(doc['versions'])}")
            print(f"   Chunks: {doc['chunk_count']}")
            print()

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_versions(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        versions = pipeline.get_version_history(args.document_id)

        print(f"\n=== Version History for {args.document_id} ===")
        print(f"Total versions: {len(versions)}")
        print()

        for v in versions:
            marker = " (latest)" if v.get("is_latest") else ""
            print(f"Version {v['version_tag']}{marker}")
            print(f"  Created: {v['created_at']}")
            print(f"  File: {v['file_name']}")
            print(f"  Size: {v['file_size']} bytes")
            print(f"  Hash: {v['content_hash'][:16]}...")
            if v.get("description"):
                print(f"  Description: {v['description']}")
            print()

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_compare(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        comparison = pipeline.compare_versions(
            args.document_id, args.version1, args.version2
        )

        if "error" in comparison:
            print(f"Error: {comparison['error']}", file=sys.stderr)
            return 1

        print(f"\n=== Version Comparison ===")
        print(f"Document: {args.document_id}")
        print(f"{args.version1} vs {args.version2}")
        print()
        print(f"Content changed: {'✓' if comparison['content_changed'] else '✗'}")
        print(f"File size changed: {'✓' if comparison['file_size_changed'] else '✗'}")
        print(f"Days between: {comparison['days_between']}")
        print()

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_delete(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        if not args.yes:
            version_str = f" version {args.version}" if args.version else " all versions"
            confirm = input(
                f"Are you sure you want to delete {args.document_id}{version_str}? [y/N]: "
            )
            if confirm.lower() not in ["y", "yes"]:
                print("Cancelled")
                return 0

        count = pipeline.delete_document(args.document_id, args.version)
        print(f"Deleted {count} chunks for document {args.document_id}")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_cache(args) -> int:
    config = load_config(args.config)
    setup_logging(config.log_level)

    pipeline = RAGPipeline(config)

    try:
        if args.action == "stats":
            stats = pipeline.get_cache_stats()
            print(f"\n=== Cache Statistics ===")
            for key, value in stats.items():
                print(f"  {key}: {value}")
            print()
        elif args.action == "clear":
            if not args.yes:
                confirm = input("Are you sure you want to clear all cache? [y/N]: ")
                if confirm.lower() not in ["y", "yes"]:
                    print("Cancelled")
                    return 0
            count = pipeline.clear_cache()
            print(f"Cleared {count} cache entries")
        else:
            print(f"Unknown action: {args.action}", file=sys.stderr)
            return 1

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="RAG System - Document processing and retrieval pipeline"
    )
    parser.add_argument(
        "--config",
        "-c",
        type=str,
        default=None,
        help="Path to YAML configuration file",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    parse_parser = subparsers.add_parser("parse", help="Parse a document")
    parse_parser.add_argument("input", help="Input file or directory")
    parse_parser.set_defaults(func=cmd_parse)

    chunk_parser = subparsers.add_parser("chunk", help="Chunk a parsed document")
    chunk_parser.add_argument("input", help="Parsed JSON file")
    chunk_parser.set_defaults(func=cmd_chunk)

    embed_parser = subparsers.add_parser("embed", help="Generate embeddings for chunks")
    embed_parser.add_argument("input", help="Chunks JSON file")
    embed_parser.set_defaults(func=cmd_embed)

    store_parser = subparsers.add_parser("store", help="Store embeddings in vector store")
    store_parser.add_argument("input", help="Embeddings JSON file")
    store_parser.set_defaults(func=cmd_store)

    inc_parser = subparsers.add_parser(
        "incremental", help="Incremental update with versioning"
    )
    inc_parser.add_argument("input", help="Chunks JSON file")
    inc_parser.set_defaults(func=cmd_incremental)

    pipeline_parser = subparsers.add_parser(
        "pipeline", help="Run full pipeline (parse -> chunk -> embed -> incremental)"
    )
    pipeline_parser.add_argument("input", help="Input file or directory")
    pipeline_parser.add_argument(
        "--steps",
        "-s",
        nargs="+",
        choices=["parse", "chunk", "embed", "store", "incremental", "all"],
        default=None,
        help="Steps to run (default: all)",
    )
    pipeline_parser.set_defaults(func=cmd_pipeline)

    search_parser = subparsers.add_parser("search", help="Search the RAG system")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--top-k", type=int, default=50, help="Number of results to recall")
    search_parser.add_argument("--top-n", type=int, default=5, help="Number of results to return")
    search_parser.add_argument(
        "--all-versions",
        action="store_true",
        help="Search all versions (default: latest only)",
    )
    search_parser.add_argument(
        "--version",
        type=str,
        default=None,
        help="Search specific version",
    )
    search_parser.add_argument(
        "--doc-ids",
        type=str,
        default=None,
        help="Comma-separated document IDs to filter",
    )
    search_parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable cache for this query",
    )
    search_parser.add_argument(
        "--show-full",
        action="store_true",
        help="Show full content of results",
    )
    search_parser.add_argument("--output", "-o", type=str, help="Output JSON file")
    search_parser.set_defaults(func=cmd_search)

    list_parser = subparsers.add_parser("list", help="List documents in vector store")
    list_parser.set_defaults(func=cmd_list)

    versions_parser = subparsers.add_parser("versions", help="Show document version history")
    versions_parser.add_argument("document_id", help="Document ID")
    versions_parser.set_defaults(func=cmd_versions)

    compare_parser = subparsers.add_parser("compare", help="Compare two document versions")
    compare_parser.add_argument("document_id", help="Document ID")
    compare_parser.add_argument("version1", help="First version tag")
    compare_parser.add_argument("version2", help="Second version tag")
    compare_parser.set_defaults(func=cmd_compare)

    delete_parser = subparsers.add_parser("delete", help="Delete a document from vector store")
    delete_parser.add_argument("document_id", help="Document ID")
    delete_parser.add_argument("--version", type=str, default=None, help="Specific version to delete")
    delete_parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation")
    delete_parser.set_defaults(func=cmd_delete)

    cache_parser = subparsers.add_parser("cache", help="Manage query cache")
    cache_parser.add_argument("action", choices=["stats", "clear"], help="Action to perform")
    cache_parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation")
    cache_parser.set_defaults(func=cmd_cache)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
