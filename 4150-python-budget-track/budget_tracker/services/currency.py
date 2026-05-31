from datetime import datetime, timedelta
from budget_tracker.models import ExchangeRate
from budget_tracker.database import get_db, Database


class CurrencyService:
    def __init__(self, db: Database = None):
        self.db = db or get_db()

    _BASE_RATES = {
        "USD": 1.0,
        "EUR": 0.92,
        "JPY": 155.0,
        "GBP": 0.79,
        "HKD": 7.82,
        "CNY": 7.25,
    }

    def get_exchange_rate(self, from_currency, to_currency, use_cache=True, cache_hours=24) -> float:
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()

        if from_currency == to_currency:
            return 1.0

        if use_cache:
            row = self.db.query_one(
                "SELECT rate, fetched_at FROM exchange_rates WHERE from_currency = ? AND to_currency = ? ORDER BY fetched_at DESC LIMIT 1",
                (from_currency, to_currency),
            )
            if row:
                fetched_at = datetime.fromisoformat(row["fetched_at"])
                if datetime.now() - fetched_at < timedelta(hours=cache_hours):
                    return float(row["rate"])

        rate = self._fetch_rate(from_currency, to_currency)
        now = datetime.now().isoformat()
        self.db.execute(
            "INSERT INTO exchange_rates (from_currency, to_currency, rate, source, fetched_at) VALUES (?, ?, ?, ?, ?)",
            (from_currency, to_currency, rate, "mock", now),
        )
        return rate

    def _fetch_rate(self, from_currency, to_currency) -> float:
        rates = self._BASE_RATES
        if from_currency not in rates or to_currency not in rates:
            raise ValueError(f"Unsupported currency pair: {from_currency}/{to_currency}")
        return rates[to_currency] / rates[from_currency]

    def convert_currency(self, amount, from_currency, to_currency) -> float:
        rate = self.get_exchange_rate(from_currency, to_currency)
        return amount * rate

    def list_supported_currencies(self) -> list:
        return sorted(self._BASE_RATES.keys())

    def clear_cache(self) -> None:
        self.db.execute("DELETE FROM exchange_rates")
