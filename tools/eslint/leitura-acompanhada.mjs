// A falha de uma leitura com "Tentar novamente" tem um só modelo: `acompanharLeitura` e os avisos
// `ui-falha-de-leitura`, `ui-falha-de-leitura-do-campo` e `ui-lookup-alert [leituras]`. Texto de
// botão ou título de alerta escritos à mão num modelo fora de `shared-ui` refazem a fiação.
const MENSAGEM =
  'A falha de leitura com "Tentar novamente" usa acompanharLeitura e ui-falha-de-leitura (ou a variante do campo), não um botão ou alerta escritos à mão.';

const TENTAR_NOVAMENTE = String.raw`/Tentar\s+novamente/i`;
const TITULO_DE_FALHA = String.raw`(Não foi possível|Falha ao) (carregar|ler|listar|buscar|consultar)`;

/** Entradas de `no-restricted-syntax` para modelos Angular (arquivos `.html` e templates inline). */
export const SELETORES_DE_LEITURA = [
  `Text[value=${TENTAR_NOVAMENTE}]`,
  `BoundText[value.source=${TENTAR_NOVAMENTE}]`,
  `Element[name='ui-alert'] > TextAttribute[name='heading'][value=/^${TITULO_DE_FALHA}/i]`,
  `Element[name='ui-alert'] > BoundAttribute[name='heading'][value.source=/${TITULO_DE_FALHA}/i]`,
].map((selector) => ({ selector, message: MENSAGEM }));

/**
 * Bloco de configuração dos modelos; vai em cada app, e não em `shared-ui`, que implementa o botão.
 * Cada app sobe a severidade para `'error'` quando a última leitura sua migra: o que a regra não
 * alcança é barrado pela retirada dos exports antigos.
 */
export function blocoDaLeituraNosModelos(severidade = 'warn') {
  return {
    files: ['**/*.html'],
    rules: { 'no-restricted-syntax': [severidade, ...SELETORES_DE_LEITURA] },
  };
}
