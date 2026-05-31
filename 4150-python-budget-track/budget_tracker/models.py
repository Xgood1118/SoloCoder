from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from enum import Enum


class AccountType(Enum):
    CASH = "cash"
    BANK = "bank"
    CREDIT_CARD = "credit_card"
    EWALLET = "ewallet"
    OTHER = "other"


class TransactionType(Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"


class BudgetPeriod(Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class RecurringFrequency(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


@dataclass
class Account:
    id: Optional[int] = None
    name: str = ""
    account_type: str = "cash"
    currency: str = "CNY"
    balance: float = 0.0
    initial_balance: float = 0.0
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Category:
    id: Optional[int] = None
    name: str = ""
    category_type: str = "expense"
    icon: str = ""
    is_default: bool = False
    keywords: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Transaction:
    id: Optional[int] = None
    account_id: int = 0
    category_id: Optional[int] = None
    transaction_type: str = "expense"
    amount: float = 0.0
    original_amount: Optional[float] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    description: str = ""
    notes: str = ""
    tags: str = ""
    date: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    transfer_to_account_id: Optional[int] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Budget:
    id: Optional[int] = None
    category_id: int = 0
    period: str = "monthly"
    amount: float = 0.0
    start_date: str = ""
    end_date: str = ""
    warning_threshold: float = 0.8
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class BudgetAdjustment:
    id: Optional[int] = None
    budget_id: int = 0
    old_amount: float = 0.0
    new_amount: float = 0.0
    reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class RecurringBill:
    id: Optional[int] = None
    name: str = ""
    account_id: int = 0
    category_id: Optional[int] = None
    amount: float = 0.0
    frequency: str = "monthly"
    next_date: str = ""
    end_date: Optional[str] = None
    description: str = ""
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ExchangeRate:
    id: Optional[int] = None
    from_currency: str = ""
    to_currency: str = ""
    rate: float = 1.0
    source: str = ""
    fetched_at: str = field(default_factory=lambda: datetime.now().isoformat())
