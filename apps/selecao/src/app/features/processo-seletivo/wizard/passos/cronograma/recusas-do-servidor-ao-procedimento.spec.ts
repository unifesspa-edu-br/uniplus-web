import type { ProblemDetails } from '@uniplus/shared-core/http';
import {
  AreaDoEnemDoProcedimento as Area,
  TipoDeDecisaoDoDocumento as Tipo,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
  type RascunhoSubstituidoResponse,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../../documento/exemplos.testing';
import {
  recusasDosProcedimentosDaEtapa,
  recusasDosProcedimentosDaFase,
} from './recusas-do-servidor-ao-procedimento';
import { textoDaRecusaDoProcedimento } from './procedimentos-do-recurso/textos-das-recusas-do-procedimento';

const FASE = 'uniplus.selecao.regra_recurso_fase.';
const ETAPA = 'uniplus.selecao.recurso_da_etapa.';
const RAIZ_DA_FASE = '/cronograma/fases/1/regraRecurso';
const RAIZ_DA_ETAPA = '/etapas/2/recursos/1';
const CODIGO = 'uniplus.selecao.validacao_falhou';
const PAGINAS = 'https://developers.example.test/erros/';
const SUFIXOS = [
  'procedimento_de_recurso_ausente',
  'procedimento_de_recurso_desconhecido',
  'procedimento_de_recurso_duplicado',
  'procedimento_de_recurso_conflitante',
  'alvo_do_procedimento_de_recurso_inexistente',
  'procedimento_para_decisao_nao_declarada',
];
const HOMOLOGACAO: DocumentoDaConfiguracaoProcedimentoDeRecurso = {
  tipoDeDecisao: Tipo.HOMOLOGACAO_DAS_INSCRICOES,
  regra: { codigo: 'CONFERENCIA', versao: 'v1' },
};
const DO_ITEM: DocumentoDaConfiguracaoProcedimentoDeRecurso = {
  tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
  alvo: { itemDeAvaliacaoChave: 'clareza' },
  regra: { codigo: 'RECORRECAO', versao: 'v1' },
};
const DA_AREA: DocumentoDaConfiguracaoProcedimentoDeRecurso = {
  ...DO_ITEM,
  alvo: { areaDoEnem: Area.LINGUAGENS },
};
const ENVIADOS = [HOMOLOGACAO, DO_ITEM, DA_AREA];

function documento(procedimentos = ENVIADOS): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    cronograma: {
      fases: [
        { chave: 'outra', tipoFaseCodigo: 'INSCRICOES', noMesmoMomentoDaAnterior: false },
        {
          chave: 'fase',
          tipoFaseCodigo: 'INSCRICOES',
          noMesmoMomentoDaAnterior: false,
          regraRecurso: { procedimentosDeRecurso: procedimentos },
        },
      ],
    },
    etapas: [
      { chave: 'a' },
      { chave: 'b' },
      { chave: 'prova', recursos: [{}, { procedimentosDeRecurso: procedimentos }] },
    ],
  };
}

function problema(errors: ProblemDetails['errors'], type = PAGINAS + CODIGO): ProblemDetails {
  return { type, code: CODIGO, title: 'Validação', traceId: '', status: 422, errors };
}

function causa(field: string, code = FASE + SUFIXOS[1]) {
  return { field, code, message: 'Texto livre do servidor não deve aparecer.' };
}

const daFase = (field: string, code = FASE + SUFIXOS[1]) =>
  recusasDosProcedimentosDaFase(problema([causa(field, code)]), 1, documento());
const daEtapa = (field: string, code = ETAPA + SUFIXOS[1]) =>
  recusasDosProcedimentosDaEtapa(problema([causa(field, code)]), 2, 1, documento());

describe('recusas no documento enviado', () => {
  it.each(SUFIXOS)('associa %s ao tipo e alvo da fase pelo ponteiro JSON', (sufixo) => {
    const codigo = FASE + sufixo;
    const [recusa] = daFase(`${RAIZ_DA_FASE}/procedimentosDeRecurso/1`, codigo);
    expect(recusa).toMatchObject({
      tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
      alvo: DO_ITEM.alvo,
      recusa: { codigo, mensagem: textoDaRecusaDoProcedimento(codigo), pagina: PAGINAS + codigo },
    });
    expect(recusa.semLinha ?? false).toBe(sufixo === SUFIXOS[0]);
  });

  it.each(SUFIXOS)('associa %s ao tipo e alvo da janela da etapa', (sufixo) => {
    const codigo = ETAPA + sufixo;
    const [recusa] = daEtapa(`${RAIZ_DA_ETAPA}/procedimentosDeRecurso/2/alvo/areaDoEnem`, codigo);
    expect(recusa).toMatchObject({
      tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
      alvo: DA_AREA.alvo,
      recusa: { codigo, mensagem: textoDaRecusaDoProcedimento(codigo), pagina: PAGINAS + codigo },
    });
  });

  it.each(['', '/procedimentosDeRecurso'])(
    'mantém a ausência junto à janela da fase: %s',
    (campo) => {
      const recusas = daFase(RAIZ_DA_FASE + campo, FASE + SUFIXOS[0]);
      expect(recusas).toHaveLength(1);
      expect(recusas[0]).toMatchObject({ tipoDeDecisao: null, alvo: null, semLinha: true });
    },
  );

  it('mantém a ausência junto à janela da etapa', () => {
    expect(daEtapa(RAIZ_DA_ETAPA, ETAPA + SUFIXOS[0])[0]).toMatchObject({
      tipoDeDecisao: null,
      semLinha: true,
    });
  });

  it.each([
    'regra',
    'regra/codigo',
    'regra/versao',
    'tipoDeDecisao',
    'alvo',
    'alvo/itemDeAvaliacaoChave',
  ])('aceita o campo %s do procedimento', (campo) => {
    expect(daFase(`${RAIZ_DA_FASE}/procedimentosDeRecurso/1/${campo}`)[0].alvo).toEqual(
      DO_ITEM.alvo,
    );
  });

  it.each([
    'fases[1].regraRecurso.procedimentos[0]',
    '',
    '/',
    '/cronograma/fases/1/regra~2Recurso/procedimentosDeRecurso/0',
    '/cronograma/fases/1/regraRecurso/procedimentosDeRecurso/01',
    '/cronograma/fases/1/regraRecurso/procedimentosDeRecurso/-1',
    '/cronograma/fases/1/regraRecurso/procedimentosDeRecurso/99',
    '/cronograma/fases/1/regraRecurso/procedimentosDeRecurso/0/',
    '/cronograma/fases/1/regraRecurso/procedimentosDeRecurso/0/regra~1codigo',
    '/cronograma/fases/1/regraRecurso/procedimentosDeRecurso/0/regra/parametros',
    '/cronograma/fases/1/tiposDeDecisao/0',
    '/cronograma/fases/0/regraRecurso/procedimentosDeRecurso/0',
    '/etapas/2/recursos/1/procedimentosDeRecurso/0',
  ])('não atribui à fase um caminho fora do contrato: %s', (field) => {
    expect(daFase(field)).toEqual([]);
  });

  it.each(['/etapas/2/recursos/0', '/etapas/1/recursos/1', RAIZ_DA_FASE])(
    'isola as janelas da etapa de %s',
    (field) => {
      expect(daEtapa(`${field}/procedimentosDeRecurso/0`)).toEqual([]);
    },
  );

  it('ignora código desconhecido e conserva apenas o texto seguro da tela', () => {
    expect(daFase(`${RAIZ_DA_FASE}/procedimentosDeRecurso/0`, 'outro.codigo')).toEqual([]);
    expect(daFase(`${RAIZ_DA_FASE}/procedimentosDeRecurso/0`)[0].recusa.mensagem).not.toContain(
      'Texto livre',
    );
  });

  it('não inventa página para URN nem para type incompatível com o código', () => {
    const errors = [causa(`${RAIZ_DA_FASE}/procedimentosDeRecurso/0`)];
    for (const type of [
      'urn:uniplus:erro',
      'http://example.test/erros/' + CODIGO,
      PAGINAS + 'outro.codigo',
    ]) {
      expect(
        recusasDosProcedimentosDaFase(problema(errors, type), 1, documento())[0].recusa.pagina,
      ).toBeNull();
    }
  });

  it('lê diagnósticos de salvamento bem-sucedido sem fabricar type ou página', () => {
    const resposta: RascunhoSubstituidoResponse = {
      revisao: 2,
      diagnosticos: [
        causa(RAIZ_DA_FASE, FASE + SUFIXOS[0]),
        { field: null, code: FASE + SUFIXOS[1], message: 'Geral' },
        { code: FASE + SUFIXOS[1], message: 'Geral' },
      ],
    };
    const recusas = recusasDosProcedimentosDaFase(resposta, 1, documento());
    expect(recusas).toHaveLength(1);
    expect(recusas[0].recusa.pagina).toBeNull();
    expect(recusas[0].recusa.codigo).toBe(FASE + SUFIXOS[0]);
  });

  it('preserva ocorrências e ordem, inclusive recusas repetidas da mesma posição', () => {
    const duplicado = documento([DO_ITEM, DO_ITEM]);
    const codigo = FASE + SUFIXOS[2];
    const errors = [
      causa(`${RAIZ_DA_FASE}/procedimentosDeRecurso/1`, codigo),
      causa(`${RAIZ_DA_FASE}/procedimentosDeRecurso/0`, codigo),
      causa(`${RAIZ_DA_FASE}/procedimentosDeRecurso/1`, codigo),
    ];
    const recusas = recusasDosProcedimentosDaFase(problema(errors), 1, duplicado);
    expect(recusas.map((recusa) => recusa.ocorrencia ?? 0)).toEqual([1, 0, 1]);
    expect(recusas.map((recusa) => recusa.recusa.codigo)).toEqual([codigo, codigo, codigo]);
  });

  it('usa o documento enviado sem mudar as identidades quando a edição reordena os itens', () => {
    const enviado = documento();
    const recusas = recusasDosProcedimentosDaFase(
      problema([causa(`${RAIZ_DA_FASE}/procedimentosDeRecurso/1`)]),
      1,
      enviado,
    );
    const editado = documento([DA_AREA, HOMOLOGACAO, DO_ITEM]);
    expect(recusas[0].alvo).toEqual(DO_ITEM.alvo);
    expect(editado.cronograma?.fases?.[1].regraRecurso?.procedimentosDeRecurso?.[1]).toBe(
      HOMOLOGACAO,
    );
    expect(enviado.cronograma?.fases?.[1].regraRecurso?.procedimentosDeRecurso).toEqual(ENVIADOS);
  });

  it('não acessa fase, etapa ou janela inexistentes e admite resposta sem erros', () => {
    const resposta = problema(undefined);
    expect(recusasDosProcedimentosDaFase(resposta, 1, documento())).toEqual([]);
    expect(recusasDosProcedimentosDaFase(resposta, 99, documento())).toEqual([]);
    expect(recusasDosProcedimentosDaEtapa(resposta, 99, 0, documento())).toEqual([]);
    expect(recusasDosProcedimentosDaEtapa(resposta, 2, 99, documento())).toEqual([]);
    expect(recusasDosProcedimentosDaFase(resposta, 0, documentoSemNada())).toEqual([]);
    expect(recusasDosProcedimentosDaEtapa(resposta, 0, 0, documentoSemNada())).toEqual([]);
  });
});
