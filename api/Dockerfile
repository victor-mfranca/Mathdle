# Imagem da nossa API (serviço de implementação própria)
# Versão e digest fixados: o build não muda quando a tag é atualizada no Docker Hub
FROM python:3.12.16-slim-trixie@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b

WORKDIR /app

# Instala as bibliotecas primeiro (aproveita o cache do Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da API
COPY . .

EXPOSE 5000
CMD ["python", "app.py"]
