import json
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    chunk_index: int
    start_position: int
    end_position: int
    token_count: int
    element_type: str
    page_number: Optional[int]
    metadata: Dict[str, Any]
    content_hash: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ChunkedDocument:
    document_id: str
    file_name: str
    total_chunks: int
    chunks: List[TextChunk]
    chunked_at: str
    chunking_config: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "file_name": self.file_name,
            "total_chunks": self.total_chunks,
            "chunks": [chunk.to_dict() for chunk in self.chunks],
            "chunked_at": self.chunked_at,
            "chunking_config": self.chunking_config,
        }

    def save_to_json(self, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
        logger.info(f"Chunked document saved to: {output_path}")

    @classmethod
    def load_from_json(cls, input_path: Path) -> "ChunkedDocument":
        if not input_path.exists():
            raise FileNotFoundError(f"Chunked document file not found: {input_path}")

        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        chunks = [TextChunk(**chunk_data) for chunk_data in data.get("chunks", [])]
        data["chunks"] = chunks
        return cls(**data)


def count_tokens(text: str) -> int:
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except ImportError:
        return len(text) // 2


def compute_content_hash(content: str, algorithm: str = "sha256") -> str:
    return hashlib.new(algorithm, content.encode("utf-8")).hexdigest()


class TextChunker:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.chunk_config = self.config.chunking
        self.output_dir = self.config.paths.chunks_dir

    def chunk_document(self, parsed_doc_path: str) -> ChunkedDocument:
        from .document_parser import ParsedDocument

        path = Path(parsed_doc_path)
        if not path.exists():
            raise FileNotFoundError(f"Parsed document file not found: {parsed_doc_path}")

        logger.info(f"Starting to chunk document: {parsed_doc_path}")

        try:
            parsed_doc = ParsedDocument.load_from_json(path)

            all_chunks: List[TextChunk] = []
            global_position = 0
            chunk_index = 0

            for element in parsed_doc.elements:
                element_chunks = self._chunk_element(
                    element,
                    parsed_doc.document_id,
                    parsed_doc.file_name,
                    global_position,
                    chunk_index,
                )
                all_chunks.extend(element_chunks)
                chunk_index += len(element_chunks)
                global_position += len(element.content)

            chunked_doc = ChunkedDocument(
                document_id=parsed_doc.document_id,
                file_name=parsed_doc.file_name,
                total_chunks=len(all_chunks),
                chunks=all_chunks,
                chunked_at=datetime.utcnow().isoformat() + "Z",
                chunking_config={
                    "chunk_size": self.chunk_config.chunk_size,
                    "chunk_overlap": self.chunk_config.chunk_overlap,
                    "respect_sentence_boundary": self.chunk_config.respect_sentence_boundary,
                    "min_chunk_size": self.chunk_config.min_chunk_size,
                },
            )

            output_file = self.output_dir / f"{parsed_doc.document_id}_chunks.json"
            chunked_doc.save_to_json(output_file)

            logger.info(
                f"Successfully chunked document {parsed_doc.file_name} "
                f"into {len(all_chunks)} chunks"
            )
            return chunked_doc

        except Exception as e:
            logger.error(f"Failed to chunk document {parsed_doc_path}: {str(e)}", exc_info=True)
            raise RuntimeError(f"Text chunking failed for {parsed_doc_path}: {str(e)}") from e

    def chunk_directory(self, dir_path: str) -> List[ChunkedDocument]:
        path = Path(dir_path)
        if not path.exists():
            raise FileNotFoundError(f"Directory not found: {dir_path}")

        chunked_docs = []
        for file_path in sorted(path.glob("*.json")):
            try:
                chunked_doc = self.chunk_document(str(file_path))
                chunked_docs.append(chunked_doc)
            except Exception as e:
                logger.warning(f"Skipping {file_path}: {str(e)}")

        logger.info(f"Chunked {len(chunked_docs)} documents from {dir_path}")
        return chunked_docs

    def _chunk_element(
        self,
        element,
        document_id: str,
        document_name: str,
        start_position: int,
        start_chunk_index: int,
    ) -> List[TextChunk]:
        content = element.content
        if not content.strip():
            return []

        chunks = []

        if element.type == "table":
            table_chunks = self._chunk_table(
                element,
                document_id,
                document_name,
                start_position,
                start_chunk_index,
            )
            return table_chunks

        if self.chunk_config.respect_sentence_boundary:
            raw_chunks = self._chunk_with_sentence_boundary(content)
        else:
            raw_chunks = self._chunk_simple(content)

        current_position = start_position
        for i, (chunk_text, chunk_start, chunk_end) in enumerate(raw_chunks):
            token_count = count_tokens(chunk_text)

            if token_count < self.chunk_config.min_chunk_size and chunks:
                chunks[-1].content += chunk_text
                chunks[-1].end_position = current_position + len(chunk_text)
                chunks[-1].token_count = count_tokens(chunks[-1].content)
                chunks[-1].content_hash = compute_content_hash(chunks[-1].content)
                current_position += len(chunk_text)
                continue

            chunk_id = f"{document_id}_chunk_{start_chunk_index + i}"
            chunks.append(
                TextChunk(
                    chunk_id=chunk_id,
                    document_id=document_id,
                    document_name=document_name,
                    content=chunk_text,
                    chunk_index=start_chunk_index + i,
                    start_position=current_position,
                    end_position=current_position + len(chunk_text),
                    token_count=token_count,
                    element_type=element.type,
                    page_number=getattr(element, "page_number", None),
                    metadata={
                        **element.metadata,
                        "text_direction": getattr(element, "text_direction", None),
                    },
                    content_hash=compute_content_hash(chunk_text),
                )
            )
            current_position += len(chunk_text)

        return chunks

    def _chunk_table(
        self,
        element,
        document_id: str,
        document_name: str,
        start_position: int,
        start_chunk_index: int,
    ) -> List[TextChunk]:
        chunks = []

        headers = getattr(element, "headers", [])
        rows = getattr(element, "rows", [])

        if not rows or len(rows) == 0:
            content = element.content
            token_count = count_tokens(content)
            chunks.append(
                TextChunk(
                    chunk_id=f"{document_id}_chunk_{start_chunk_index}",
                    document_id=document_id,
                    document_name=document_name,
                    content=content,
                    chunk_index=start_chunk_index,
                    start_position=start_position,
                    end_position=start_position + len(content),
                    token_count=token_count,
                    element_type="table",
                    page_number=getattr(element, "page_number", None),
                    metadata=element.metadata,
                    content_hash=compute_content_hash(content),
                )
            )
            return chunks

        header_text = " | ".join(headers) if headers else ""
        header_tokens = count_tokens(header_text)
        max_row_tokens = self.chunk_config.chunk_size - header_tokens - 20

        current_rows = []
        current_tokens = 0
        chunk_idx = 0
        current_pos = start_position

        for row in rows:
            row_text = " | ".join(row)
            row_tokens = count_tokens(row_text)

            if current_tokens + row_tokens > max_row_tokens and current_rows:
                chunk_content = header_text + "\n" + "\n".join(
                    " | ".join(r) for r in current_rows
                )
                token_count = count_tokens(chunk_content)
                chunks.append(
                    TextChunk(
                        chunk_id=f"{document_id}_chunk_{start_chunk_index + chunk_idx}",
                        document_id=document_id,
                        document_name=document_name,
                        content=chunk_content,
                        chunk_index=start_chunk_index + chunk_idx,
                        start_position=current_pos,
                        end_position=current_pos + len(chunk_content),
                        token_count=token_count,
                        element_type="table",
                        page_number=getattr(element, "page_number", None),
                        metadata=element.metadata,
                        content_hash=compute_content_hash(chunk_content),
                    )
                )
                chunk_idx += 1
                current_pos += len(chunk_content)
                current_rows = []
                current_tokens = 0

            current_rows.append(row)
            current_tokens += row_tokens

        if current_rows:
            chunk_content = header_text + "\n" + "\n".join(
                " | ".join(r) for r in current_rows
            )
            token_count = count_tokens(chunk_content)
            chunks.append(
                TextChunk(
                    chunk_id=f"{document_id}_chunk_{start_chunk_index + chunk_idx}",
                    document_id=document_id,
                    document_name=document_name,
                    content=chunk_content,
                    chunk_index=start_chunk_index + chunk_idx,
                    start_position=current_pos,
                    end_position=current_pos + len(chunk_content),
                    token_count=token_count,
                    element_type="table",
                    page_number=getattr(element, "page_number", None),
                    metadata=element.metadata,
                    content_hash=compute_content_hash(chunk_content),
                )
            )

        return chunks

    def _chunk_with_sentence_boundary(self, text: str) -> List[tuple]:
        sentences = self._split_sentences(text)

        chunks = []
        current_chunk = ""
        current_tokens = 0
        chunk_start = 0
        current_pos = 0

        for sentence in sentences:
            sentence_tokens = count_tokens(sentence)

            if current_tokens + sentence_tokens <= self.chunk_config.chunk_size:
                if current_chunk and not current_chunk.endswith(" "):
                    current_chunk += " "
                current_chunk += sentence
                current_tokens += sentence_tokens
            else:
                if current_chunk:
                    chunks.append((current_chunk, chunk_start, current_pos))
                    overlap_text = self._get_overlap(current_chunk)
                    overlap_tokens = count_tokens(overlap_text)
                    current_chunk = overlap_text + sentence
                    current_tokens = overlap_tokens + sentence_tokens
                    chunk_start = current_pos - len(overlap_text)
                else:
                    if sentence_tokens > self.chunk_config.chunk_size:
                        sub_chunks = self._split_long_sentence(sentence, current_pos)
                        for sub_chunk, sub_start, sub_end in sub_chunks:
                            chunks.append((sub_chunk, sub_start, sub_end))
                        current_pos += len(sentence)
                        current_chunk = ""
                        current_tokens = 0
                        continue
                    else:
                        current_chunk = sentence
                        current_tokens = sentence_tokens
                        chunk_start = current_pos

            current_pos += len(sentence)

        if current_chunk:
            chunks.append((current_chunk, chunk_start, current_pos))

        return chunks

    def _split_sentences(self, text: str) -> List[str]:
        sentence_endings = r"(?<=[.!?。！？])\s+(?=[^\u4e00-\u9fff])|(?<=[。！？])|(?<=[.!?])\s*"

        sentences = re.split(sentence_endings, text)

        merged = []
        current = ""
        for sent in sentences:
            sent = sent.strip()
            if not sent:
                continue

            current_tokens = count_tokens(current)
            sent_tokens = count_tokens(sent)

            if current and current_tokens < self.chunk_config.min_chunk_size // 2:
                if current and not current.endswith(" "):
                    current += " "
                current += sent
            else:
                if current:
                    merged.append(current)
                current = sent

        if current:
            merged.append(current)

        return [s for s in merged if s.strip()]

    def _split_long_sentence(self, sentence: str, start_pos: int) -> List[tuple]:
        chunks = []
        chunk_size = self.chunk_config.chunk_size
        overlap = self.chunk_config.chunk_overlap

        current_pos = 0
        while current_pos < len(sentence):
            end_pos = min(current_pos + chunk_size, len(sentence))
            chunk = sentence[current_pos:end_pos]
            chunks.append((chunk, start_pos + current_pos, start_pos + end_pos))
            current_pos = end_pos - overlap

        return chunks

    def _get_overlap(self, text: str) -> str:
        overlap = self.chunk_config.chunk_overlap
        if overlap <= 0:
            return ""

        sentences = self._split_sentences(text)
        overlap_text = ""
        overlap_tokens = 0

        for sentence in reversed(sentences):
            sent_tokens = count_tokens(sentence)
            if overlap_tokens + sent_tokens <= overlap:
                overlap_text = sentence + (" " if overlap_text else "") + overlap_text
                overlap_tokens += sent_tokens
            else:
                break

        return overlap_text.strip()

    def _chunk_simple(self, text: str) -> List[tuple]:
        chunks = []
        chunk_size = self.chunk_config.chunk_size
        overlap = self.chunk_config.chunk_overlap

        current_pos = 0
        while current_pos < len(text):
            end_pos = min(current_pos + chunk_size, len(text))

            if end_pos < len(text) and self.chunk_config.separators:
                for sep in self.chunk_config.separators:
                    sep_pos = text.rfind(sep, current_pos, end_pos)
                    if sep_pos != -1 and sep_pos > current_pos:
                        end_pos = sep_pos + len(sep)
                        break

            chunk = text[current_pos:end_pos]
            chunks.append((chunk, current_pos, end_pos))

            if end_pos >= len(text):
                break

            current_pos = end_pos - overlap
            if current_pos < 0:
                current_pos = 0

        return chunks


from .config import get_config
