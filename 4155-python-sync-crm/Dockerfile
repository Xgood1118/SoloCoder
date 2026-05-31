FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

COPY src/ ./src/
COPY config/ ./config/
COPY .env.example ./.env

RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["uvicorn", "crm_sync.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
