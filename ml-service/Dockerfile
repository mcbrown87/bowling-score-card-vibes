FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY ml-service/requirements.txt /tmp/requirements.txt
COPY ml-service/requirements-donut.txt /tmp/requirements-donut.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ARG INSTALL_DONUT_DEPS=false
RUN if [ "$INSTALL_DONUT_DEPS" = "true" ]; then \
      pip install --no-cache-dir -r /tmp/requirements-donut.txt; \
    fi

COPY ml-service /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
