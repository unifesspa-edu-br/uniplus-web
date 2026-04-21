FROM mcr.microsoft.com/playwright:v1.58.2-noble
LABEL org.opencontainers.image.source="https://github.com/unifesspa-edu-br/uniplus-web"
LABEL org.opencontainers.image.description="Playwright E2E runner com webkit para Ubuntu (uniplus-web)"

WORKDIR /workspace

# Copiar apenas os manifests para instalar dependências no layer de cache
COPY package.json package-lock.json ./

# npm install resolve apenas os bindings para linux/x64 (webkit exige libs Ubuntu)
RUN npm install --ignore-scripts --os=linux --cpu=x64

# O código-fonte é montado em runtime via bind mount — não copiado aqui
