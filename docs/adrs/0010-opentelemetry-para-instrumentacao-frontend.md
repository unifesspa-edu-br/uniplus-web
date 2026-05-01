---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0010: OpenTelemetry para instrumentação do `uniplus-web` (RUM)

## Contexto e enunciado do problema

Durante janelas de inscrição, o `uniplus-web` recebe milhares de candidatos simultâneos em redes heterogêneas (mobile, residencial, institucional). Sem instrumentação client-side, problemas como latência percebida alta, erros silenciosos em rotas raras, falhas de upload de documentos ou bugs específicos de browser passam despercebidos até serem reportados pelos próprios candidatos — quando o impacto já ocorreu.

A correlação entre a sessão do candidato no browser e a requisição correspondente no backend depende de propagação de `traceId` entre as duas pontas. Sem isso, investigar uma falha exige cruzar logs manualmente.

## Drivers da decisão

- Necessidade de traces end-to-end correlacionando frontend ↔ backend ↔ consumers.
- Métricas de Real User Monitoring (Web Vitals: LCP, FID, CLS, INP).
- Detecção proativa de erros JavaScript não tratados em produção.
- Padrão aberto, sem vendor lock-in, alinhado ao backend (que também adota OpenTelemetry).
- Conformidade LGPD: instrumentação **não** pode coletar PII (CPF, nome, endereço, claims do token).

## Opções consideradas

- OpenTelemetry JavaScript SDK (`@opentelemetry/sdk-trace-web` + auto-instrumentações para fetch/XHR/document load).
- Sentry (ou similar) como SaaS de error tracking + RUM.
- Application Insights JavaScript SDK.
- Sem instrumentação cliente (apenas server-side).

## Resultado da decisão

**Escolhida:** OpenTelemetry JavaScript SDK como instrumentação canônica do `uniplus-web`, exportando traces via OTLP/HTTP para o OpenTelemetry Collector da plataforma.

Diretrizes derivadas da decisão:

1. Inicializar o SDK no `main.ts` (ou em provider dedicado) **antes** do bootstrap do Angular, para capturar o `document load`.
2. Habilitar auto-instrumentações para `fetch`, `XMLHttpRequest`, `document-load` e `user-interaction`.
3. Propagar `traceparent` (W3C Trace Context) em todas as requisições para o backend Uni+ — o `tokenInterceptor` (ADR-0009) e o trace exporter convivem no mesmo pipeline HTTP.
4. Coletar Web Vitals (LCP, FID, CLS, INP, TTFB) como métricas separadas, exportadas via OTLP/HTTP.
5. **Nunca** anexar PII a spans, eventos ou atributos. Atributos permitidos: `app.name` (selecao/ingresso/portal), `app.version`, `route`, `http.status_code`, `error.type`. Atributos proibidos: CPF, nome, e-mail, claims do token, valores de input.
6. Aplicar sampling adaptativo: head-based 10% para tráfego normal, 100% para sessões com erro detectado.
7. Configurar URL do Collector e sample rates por ambiente (dev/staging/prod) via variáveis injetadas em build (`environment.ts` por configuração Nx).

## Consequências

### Positivas

- Traces end-to-end correlacionando sessão do candidato à requisição backend e ao consumer Kafka.
- Web Vitals em painel único, com alertas proativos antes que candidatos reportem lentidão.
- Padrão aberto sem vendor lock-in — o backend de armazenamento (Tempo, outro qualquer) pode mudar sem reescrever instrumentação.
- Erros JS em produção capturados como spans com `error.type` e stack trace, sem expor PII.

### Negativas

- SDK adiciona ~30–50 KB ao bundle inicial (gzip), parcialmente mitigado por tree-shaking das auto-instrumentações não usadas.
- Configuração inicial exige cuidado com sampling, propagators e exporters.
- Política de privacidade do app deve refletir a coleta de telemetria sem PII.

### Neutras

- A decisão é independente do backend escolhido para armazenamento de traces (Tempo, Jaeger, etc.).

## Confirmação

- Lint/CI pode verificar que atributos sensíveis (CPF, nome, e-mail) não aparecem em chamadas a `span.setAttribute`.
- Painéis de Web Vitals e error rate em Grafana cobrem cada uma das três apps separadamente.
- Suíte E2E pode validar a presença do header `traceparent` em requisições ao backend.

## Mais informações

- ADR-0009 detalha o token interceptor que coexiste com o trace exporter.
- Documentação: [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/), [W3C Trace Context](https://www.w3.org/TR/trace-context/).
- **Origem:** revisão da ADR interna Uni+ ADR-014 (não publicada), recorte de instrumentação frontend (RUM).
