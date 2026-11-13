# Imagem da nossa API (serviço de implementação própria)
FROM python:3.12-slim

WORKDIR /app

# Instala as bibliotecas primeiro (aproveita o cache do Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da API
COPY . .

EXPOSE 5000
CMD ["python", "app.py"]
