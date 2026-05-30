from __future__ import annotations

import re
from typing import Optional, Any


PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
EMAIL_PATTERN = re.compile(r"^[\w.-]+@[\w.-]+\.\w+$")
ID_CARD_PATTERN = re.compile(r"^\d{17}[\dXx]$")


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if phone is None:
        return None
    phone = str(phone).strip()
    if len(phone) < 7:
        return "*" * len(phone)
    return phone[:3] + "*" * 4 + phone[-4:]


def mask_email(email: Optional[str]) -> Optional[str]:
    if email is None:
        return None
    email = str(email).strip()
    if "@" not in email:
        return "*" * len(email)
    username, domain = email.split("@", 1)
    if len(username) <= 2:
        masked_user = "*" * len(username)
    else:
        masked_user = username[0] + "*" * (len(username) - 2) + username[-1]
    return f"{masked_user}@{domain}"


def mask_id_card(id_card: Optional[str]) -> Optional[str]:
    if id_card is None:
        return None
    id_card = str(id_card).strip()
    if len(id_card) < 8:
        return "*" * len(id_card)
    return id_card[:6] + "*" * 8 + id_card[-4:]


def mask_name(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    name = str(name).strip()
    if len(name) <= 1:
        return name
    return name[0] + "*" * (len(name) - 1)


def mask_address(address: Optional[str], show_last: int = 4) -> Optional[str]:
    if address is None:
        return None
    address = str(address).strip()
    if len(address) <= show_last:
        return "*" * len(address)
    return "*" * (len(address) - show_last) + address[-show_last:]


SENSITIVE_FIELD_RULES = {
    "phone": mask_phone,
    "mobile": mask_phone,
    "tel": mask_phone,
    "email": mask_email,
    "mail": mask_email,
    "id_card": mask_id_card,
    "idcard": mask_id_card,
    "identity": mask_id_card,
    "name": mask_name,
    "username": mask_name,
    "address": mask_address,
}


def desensitize_field(field_name: str, value: Any) -> Any:
    if value is None:
        return None
    name_lower = field_name.lower()
    for key, rule in SENSITIVE_FIELD_RULES.items():
        if key in name_lower:
            return rule(value)
    return value


def desensitize_data(data: dict, fields: Optional[list[str]] = None) -> dict:
    result = dict(data)
    if fields:
        for field in fields:
            if field in result:
                result[field] = desensitize_field(field, result[field])
    else:
        for field in result:
            result[field] = desensitize_field(field, result[field])
    return result
