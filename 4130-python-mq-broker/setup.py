from setuptools import setup, find_packages

setup(
    name="mq-broker",
    version="0.1.0",
    description="Unified MQ proxy layer supporting RabbitMQ, Kafka, and Pulsar",
    author="MQ Broker Team",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "aio-pika>=9.3.0",
        "aiokafka>=0.8.1",
        "pulsar-client>=3.2.0",
        "pydantic>=2.0.0",
        "tenacity>=8.2.0",
        "python-json-logger>=2.0.0",
        "msgpack>=1.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "isort>=5.12.0",
            "mypy>=1.0.0",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
