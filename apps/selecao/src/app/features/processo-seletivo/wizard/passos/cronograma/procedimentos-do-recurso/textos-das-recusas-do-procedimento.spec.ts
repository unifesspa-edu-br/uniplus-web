import { describe, expect, it } from 'vitest';

import { textoDaRecusaDosTiposDeDecisao } from '../../../shared/decisoes-da-fase-ou-etapa/recusas-dos-tipos-de-decisao';
import { textoDaRecusaDoProcedimento } from './textos-das-recusas-do-procedimento';

const DA_ETAPA = 'uniplus.selecao.recurso_da_etapa.';
const DA_FASE = 'uniplus.selecao.regra_recurso_fase.';
const SUFIXOS = [
  'procedimento_de_recurso_ausente',
  'procedimento_de_recurso_desconhecido',
  'procedimento_de_recurso_duplicado',
  'procedimento_de_recurso_conflitante',
  'alvo_do_procedimento_de_recurso_inexistente',
  'procedimento_para_decisao_nao_declarada',
];
const CODIGOS = SUFIXOS.flatMap((sufixo) => [DA_ETAPA + sufixo, DA_FASE + sufixo]);

describe('textoDaRecusaDoProcedimento', () => {
  it.each(CODIGOS)('dá texto à recusa %s', (codigo) => {
    const texto = textoDaRecusaDoProcedimento(codigo);

    expect(texto).not.toBeNull();
    expect(texto).not.toContain('uniplus.');
  });

  it.each(SUFIXOS)('dá à fase e à etapa o mesmo texto para %s', (sufixo) => {
    expect(textoDaRecusaDoProcedimento(DA_FASE + sufixo)).toBe(
      textoDaRecusaDoProcedimento(DA_ETAPA + sufixo),
    );
  });

  it('reaproveita o texto da declaração dos tipos de decisão para a decisão não declarada', () => {
    const codigo = `${DA_FASE}procedimento_para_decisao_nao_declarada`;

    expect(textoDaRecusaDoProcedimento(codigo)).toBe(textoDaRecusaDosTiposDeDecisao(codigo));
  });

  it('dá a cada motivo da recusa um texto próprio', () => {
    const textos = SUFIXOS.map((sufixo) => textoDaRecusaDoProcedimento(DA_FASE + sufixo));

    expect(new Set(textos).size).toBe(SUFIXOS.length);
  });

  it.each([
    'uniplus.selecao.motivo_de_decisao.tipo_invalido',
    `${DA_FASE}outra_recusa`,
    'uniplus.selecao.outra.procedimento_de_recurso_duplicado',
  ])('deixa a recusa %s a quem a explica', (codigo) => {
    expect(textoDaRecusaDoProcedimento(codigo)).toBeNull();
  });
});

const EXPLICACOES = [
  [
    'procedimento_de_recurso_ausente',
    'Falta declarar o procedimento de recurso para uma decisão ou um item contestado.',
  ],
  [
    'procedimento_de_recurso_desconhecido',
    'O procedimento escolhido não está na lista de procedimentos de recurso disponíveis. Escolha outro.',
  ],
  [
    'procedimento_de_recurso_duplicado',
    'Há mais de um procedimento para a mesma decisão e mesmo item contestado. Remova a repetição.',
  ],
  [
    'procedimento_de_recurso_conflitante',
    'Há um procedimento para a decisão inteira e procedimentos por item contestado. Mantenha o procedimento da decisão inteira ou os procedimentos por item e remova os demais.',
  ],
  [
    'alvo_do_procedimento_de_recurso_inexistente',
    'O item contestado ou a área do ENEM contestada não existe mais nesta fase ou etapa. Escolha outro item ou remova o procedimento.',
  ],
];
describe.each([DA_FASE, DA_ETAPA])('explicações concretas em %s', (prefixo) => {
  it.each(EXPLICACOES)('explica %s', (sufixo, mensagem) => {
    expect(textoDaRecusaDoProcedimento(prefixo + sufixo)).toBe(mensagem);
  });
});
