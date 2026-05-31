from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from loguru import logger
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from crm_sync.config import get_settings


class APIConnectionError(Exception):
    pass


class APIResponseError(Exception):
    pass


class BaseAPIAdapter:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: int = 30,
        max_retries: int = 5,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self._client: Optional[httpx.Client] = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url=self.base_url,
                timeout=self.timeout,
                headers=self._get_default_headers(),
            )
        return self._client

    def _get_default_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def health_check(self) -> bool:
        try:
            response = self.client.get("/health")
            return response.status_code == 200
        except Exception:
            return False

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((
            httpx.ConnectError,
            httpx.ReadTimeout,
            httpx.TransportError,
            APIConnectionError,
        )),
    )
    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        try:
            response = self.client.request(
                method=method,
                url=endpoint,
                params=params,
                json=json_data,
            )

            if response.status_code >= 500:
                raise APIConnectionError(f"Server error: {response.status_code}")

            if response.status_code == 429:
                raise APIConnectionError("Rate limit exceeded")

            if response.status_code >= 400:
                raise APIResponseError(
                    f"Request failed: {response.status_code}, {response.text}"
                )

            return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Connection error: {e}")
            raise APIConnectionError(f"Failed to connect: {e}")
        except httpx.ReadTimeout as e:
            logger.error(f"Request timeout: {e}")
            raise APIConnectionError(f"Request timeout: {e}")

    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, json_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._request("POST", endpoint, json_data=json_data)

    def put(self, endpoint: str, json_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._request("PUT", endpoint, json_data=json_data)

    def patch(self, endpoint: str, json_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._request("PATCH", endpoint, json_data=json_data)

    def delete(self, endpoint: str) -> Dict[str, Any]:
        return self._request("DELETE", endpoint)

    def close(self) -> None:
        if self._client:
            self._client.close()
            self._client = None

    def __enter__(self) -> "BaseAPIAdapter":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
