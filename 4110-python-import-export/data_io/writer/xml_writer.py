from __future__ import annotations

import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import Any, Dict, List, Optional

from data_io.writer.base import BaseWriter
from data_io.utils.helpers import ensure_dir


class XmlWriter(BaseWriter):
    def __init__(
        self,
        file_path: str,
        headers: Optional[List[str]] = None,
        encoding: str = "utf-8",
        root_tag: str = "records",
        item_tag: str = "record",
        pretty: bool = True,
        indent: str = "  ",
        **kwargs,
    ):
        super().__init__(file_path, headers, encoding, **kwargs)
        self.root_tag = root_tag
        self.item_tag = item_tag
        self.pretty = pretty
        self.indent = indent
        self._root = None

    def _init_writer(self) -> None:
        ensure_dir(self.file_path)
        self._root = ET.Element(self.root_tag)

    def _write_header(self) -> None:
        pass

    def _escape_value(self, val: Any) -> str:
        if val is None:
            return ""
        return str(val)

    def _write_row(self, data: Dict[str, Any]) -> None:
        if not self.headers:
            self.headers = list(data.keys())
        item = ET.SubElement(self._root, self.item_tag)
        for h in self.headers:
            val = data.get(h)
            child = ET.SubElement(item, h)
            child.text = self._escape_value(val)

    def _finalize(self) -> None:
        tree = ET.ElementTree(self._root)
        if self.pretty:
            xml_str = ET.tostring(self._root, encoding=self.encoding)
            pretty_str = minidom.parseString(xml_str).toprettyxml(
                indent=self.indent,
                encoding=self.encoding,
            )
            with open(self.file_path, "wb") as f:
                f.write(pretty_str)
        else:
            tree.write(self.file_path, encoding=self.encoding, xml_declaration=True)
