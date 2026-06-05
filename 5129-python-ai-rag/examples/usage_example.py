#!/usr/bin/env python3
"""
RAG System Usage Example

This script demonstrates how to use the RAG system programmatically.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from rag_system import (
    get_config,
    DocumentParser,
    TextChunker,
    EmbeddingGenerator,
    VectorStore,
    Reranker,
    QueryCache,
    VersionManager,
    IncrementalUpdater,
    RAGPipeline,
)


def example_standalone_components():
    """Example of using individual components"""
    print("=" * 60)
    print("Example 1: Using Individual Components")
    print("=" * 60)

    config = get_config()

    print("\n1. Document Parser")
    parser = DocumentParser(config)
    sample_doc = Path(__file__).parent / "sample_document.md"
    parsed_doc = parser.parse(str(sample_doc))
    print(f"   Parsed: {parsed_doc.file_name}")
    print(f"   Elements: {len(parsed_doc.elements)}")
    print(f"   Document ID: {parsed_doc.document_id}")

    print("\n2. Text Chunker")
    chunker = TextChunker(config)
    parsed_file = config.paths.parsed_dir / f"{parsed_doc.document_id}.json"
    chunked_doc = chunker.chunk_document(str(parsed_file))
    print(f"   Total chunks: {chunked_doc.total_chunks}")
    for i, chunk in enumerate(chunked_doc.chunks[:2]):
        print(f"   Chunk {i + 1}: {chunk.token_count} tokens, {len(chunk.content)} chars")

    print("\n3. Embedding Generator (skipped - requires API key)")
    print("   Uncomment the code below to generate embeddings")

    print("\n4. Version Manager")
    version_manager = VersionManager(config)
    version = version_manager.create_version(
        document_id=parsed_doc.document_id,
        content_hash=parsed_doc.content_hash,
        file_name=parsed_doc.file_name,
        file_size=parsed_doc.file_size,
        description="Initial version",
    )
    print(f"   Created version: {version.version_tag}")
    print(f"   Is latest: {version.is_latest}")

    print("\n5. Query Cache")
    cache = QueryCache(config)
    cache.set("What is RAG?", [{"content": "RAG is Retrieval-Augmented Generation"}])
    cached = cache.get("What is RAG?")
    print(f"   Cache hit: {cached is not None}")
    print(f"   Cache stats: {cache.get_stats()}")


def example_pipeline():
    """Example of using the pipeline"""
    print("\n" + "=" * 60)
    print("Example 2: Using RAG Pipeline")
    print("=" * 60)

    pipeline = RAGPipeline()

    print("\n1. Run full pipeline on examples directory")
    sample_dir = Path(__file__).parent
    print(f"   Input directory: {sample_dir}")
    print("   Note: Embedding step requires API key, skipping for demo")

    print("\n2. Search (requires documents in vector store)")
    print("   After processing documents, you can search:")
    print('   results = pipeline.search("What is RAG?")')
    print('   for result in results:')
    print('       print(result["content"][:100])')

    print("\n3. List documents")
    print("   docs = pipeline.list_documents()")

    print("\n4. Get version history")
    print('   versions = pipeline.get_version_history("doc_xxx")')

    print("\n5. Cache management")
    print("   stats = pipeline.get_cache_stats()")
    print('   pipeline.clear_cache()')


def example_cli_commands():
    """Example CLI commands"""
    print("\n" + "=" * 60)
    print("Example 3: CLI Commands")
    print("=" * 60)

    commands = [
        "# Parse a single document",
        "python main.py parse examples/sample_document.md",
        "",
        "# Parse all documents in a directory",
        "python main.py parse data/input",
        "",
        "# Chunk a parsed document",
        "python main.py chunk data/processed/parsed/doc_xxx.json",
        "",
        "# Generate embeddings",
        "python main.py embed data/processed/chunks/doc_xxx_chunks.json",
        "",
        "# Run full pipeline",
        "python main.py pipeline data/input",
        "",
        "# Run specific steps",
        "python main.py pipeline data/input -s parse chunk",
        "",
        "# Search",
        'python main.py search "What is RAG?"',
        'python main.py search "What is RAG?" --top-n 10 --show-full',
        'python main.py search "What is RAG?" --all-versions',
        "",
        "# List documents",
        "python main.py list",
        "",
        "# Version management",
        "python main.py versions doc_xxx",
        "python main.py compare doc_xxx v1 v2",
        "",
        "# Cache management",
        "python main.py cache stats",
        "python main.py cache clear",
        "",
        "# Delete document",
        "python main.py delete doc_xxx",
    ]

    for cmd in commands:
        print(f"   {cmd}")


def main():
    try:
        example_standalone_components()
        example_pipeline()
        example_cli_commands()

        print("\n" + "=" * 60)
        print("Examples completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
