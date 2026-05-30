from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from typing import Any, Dict, Iterator, List, Optional

from data_io.reader.base import BaseReader
from data_io.models import Record


class XmlReader(BaseReader):
    def __init__(
        self,
        file_path: str,
        encoding: Optional[str] = None,
        item_xpath: Optional[str] = "./*",
        **kwargs,
    ):
        super().__init__(file_path, encoding, **kwargs)
        self.item_xpath = item_xpath
        self._encoding = encoding or "utf-8"
        self._headers: Optional[List[str]] = None
        self._total: Optional[int] = None

    def _get_root(self):
        return ET.parse(self.file_path).getroot()

    def _elem_to_dict(self, elem: ET.Element) -> Dict[str, Any]:
        result = {}
        for child in elem:
            if child.tag not in result:
                if len(child):
                    result[child.tag] = self._elem_to_dict(child)
                else:
                    result[child.tag] = child.text
            else:
                existing = result[child.tag]
                if not isinstance(existing, list):
                    result[child.tag] = [existing]
                if len(child):
                    result[child.tag].append(self._elem_to_dict(child))
                else:
                    result[child.tag].append(child.text)
        result.update(elem.attrib)
        return result

    def _flatten_dict(self, d: Dict, parent_key: str = "") -> Dict[str, Any]:
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}_{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key).items())
            elif isinstance(v, list):
                items.append((new_key, json.dumps(v, ensure_ascii=False)))
            else:
                items.append((new_key, v))
        return dict(items)

    def _get_iterable(self) -> List[Dict]:
        root = self._get_root()
        elements = root.findall(self.item_xpath)
        result = []
        for elem in elements:
            item = self._elem_to_dict(elem)
            flat_item = self._flatten_dict(item)
            result.append(flat_item)
        return result

    def read_headers(self) -> List[str]:
        if self._headers is not None:
            return self._headers
        data_list = self._get_iterable()
        if not data_list:
            self._headers = []
            return self._headers
        all_keys = set()
        for item in data_list:
            all_keys.update(item.keys())
        self._headers = sorted(list(all_keys))
        return self._headers

    def read_rows(
        self,
        start: int = 0,
        batch_size: Optional[int] = None,
    ) -> Iterator[Record]:
        data_list = self._get_iterable()
        headers = self.read_headers()
        row_index = 0
        yielded = 0
        for item in data_list:
            if row_index < start:
                row_index += 1
                continue
            data = {}
            for h in headers:
                data[h] = item.get(h)
            if self._kwargs.get("skip_empty_rows", True):
                if all(v is None or v == "" for v in data.values()):
                    row_index += 1
                    continue
            yield Record(row_index=row_index, data=data)
            row_index += 1
            yielded += 1
            if batch_size is not None and yielded >= batch_size:
                break

    def total_rows(self) -> int:
        if self._total is not None:
            return self._total
        data_list = self._get_iterable()
        self._total = len(data_list)
        return self._total
