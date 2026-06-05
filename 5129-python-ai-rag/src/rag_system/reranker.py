import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RerankedResult:
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    initial_score: float
    rerank_score: float
    final_score: float
    initial_rank: int
    rerank_rank: int
    version: str
    metadata: Dict[str, Any]
    page_number: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "document_name": self.document_name,
            "content": self.content,
            "initial_score": self.initial_score,
            "rerank_score": self.rerank_score,
            "final_score": self.final_score,
            "initial_rank": self.initial_rank,
            "rerank_rank": self.rerank_rank,
            "version": self.version,
            "metadata": self.metadata,
            "page_number": self.page_number,
        }


class BaseReranker:
    def __init__(self, config):
        self.config = config
        self.enabled = config.enabled
        self.top_k = config.top_k
        self.top_n = config.top_n
        self.device = config.device
        self.max_length = config.max_length

    def rerank(
        self,
        query: str,
        search_results,
        top_n: Optional[int] = None,
    ) -> List[RerankedResult]:
        raise NotImplementedError


class CrossEncoderReranker(BaseReranker):
    def __init__(self, config):
        super().__init__(config)
        self.model_name = config.model_name
        self._model = None

        if self.enabled:
            self._load_model()

    def _load_model(self):
        try:
            from sentence_transformers import CrossEncoder
        except ImportError:
            raise ImportError(
                "Cross-encoder reranking requires sentence-transformers. "
                "Install with: pip install sentence-transformers"
            )

        logger.info(f"Loading cross-encoder model: {self.model_name}")
        self._model = CrossEncoder(
            self.model_name,
            device=self.device,
            max_length=self.max_length,
        )

    def rerank(
        self,
        query: str,
        search_results,
        top_n: Optional[int] = None,
    ) -> List[RerankedResult]:
        if not self.enabled or not search_results:
            return self._passthrough_results(search_results)

        top_n = top_n or self.top_n
        num_to_rerank = min(self.top_k, len(search_results))
        results_to_rerank = search_results[:num_to_rerank]

        pairs = [[query, result.content] for result in results_to_rerank]

        try:
            scores = self._model.predict(pairs, convert_to_numpy=True, show_progress_bar=False)
        except Exception as e:
            logger.warning(f"Cross-encoder prediction failed, falling back to initial scores: {e}")
            return self._passthrough_results(search_results)[:top_n]

        reranked = []
        for i, (result, rerank_score) in enumerate(zip(results_to_rerank, scores)):
            final_score = self._combine_scores(result.score, float(rerank_score))

            reranked.append(
                RerankedResult(
                    chunk_id=result.chunk_id,
                    document_id=result.document_id,
                    document_name=result.document_name,
                    content=result.content,
                    initial_score=result.score,
                    rerank_score=float(rerank_score),
                    final_score=final_score,
                    initial_rank=result.rank,
                    rerank_rank=0,
                    version=result.version,
                    metadata=result.metadata,
                    page_number=result.page_number,
                )
            )

        reranked.sort(key=lambda x: x.final_score, reverse=True)

        for i, result in enumerate(reranked):
            result.rerank_rank = i + 1

        return reranked[:top_n]

    def _combine_scores(self, initial_score: float, rerank_score: float) -> float:
        initial_weight = 0.3
        rerank_weight = 0.7
        return initial_weight * initial_score + rerank_weight * rerank_score

    def _passthrough_results(self, search_results) -> List[RerankedResult]:
        results = []
        for result in search_results:
            results.append(
                RerankedResult(
                    chunk_id=result.chunk_id,
                    document_id=result.document_id,
                    document_name=result.document_name,
                    content=result.content,
                    initial_score=result.score,
                    rerank_score=result.score,
                    final_score=result.score,
                    initial_rank=result.rank,
                    rerank_rank=result.rank,
                    version=result.version,
                    metadata=result.metadata,
                    page_number=result.page_number,
                )
            )
        return results


class Reranker:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.rerank_config = self.config.reranker
        self._reranker = CrossEncoderReranker(self.rerank_config)

    def rerank(
        self,
        query: str,
        search_results,
        top_n: Optional[int] = None,
    ) -> List[RerankedResult]:
        if not search_results:
            return []

        logger.info(
            f"Reranking {len(search_results)} results for query: {query[:50]}..."
        )

        results = self._reranker.rerank(query, search_results, top_n)

        logger.info(f"Reranking complete, returning top {len(results)} results")
        return results

    def is_enabled(self) -> bool:
        return self.rerank_config.enabled


from .config import get_config
