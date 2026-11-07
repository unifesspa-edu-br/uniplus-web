import { describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento, NoDeExigencia } from '../../processo-seletivo.models';
import { todasAsExigencias } from './consulta-das-exigencias';
import { folhaDe } from './exigencias-documentais';
import { agrupadosPorFormulario, comFinalidade, faltaOFormulario } from './formulario-da-exigencia';
import { arvoreDeExigencias } from './gravacao-das-exigencias';
import {
  ETAPAS_VIVAS,
  FASES,
  FINALIDADES_POR_FASE,
  ID_CONTRACHEQUE,
  ID_DIPLOMA,
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  comando,
  exigencia,
  rascunho,
} from './exigencias.testing';

describe('o formulário em que o documento é apresentado', () => {
  const folhaNoGrupo = (documento: ExigenciaDeDocumento): NoDeExigencia => folhaDe(documento);
  const grupoOu = (...documentos: readonly ExigenciaDeDocumento[]): NoDeExigencia => ({
    ...folhaDe(documentos[0]),
    tipo: 'OU',
    documento: null,
    filhos: documentos.map(folhaNoGrupo),
  });

  it('viaja o declarado, ou o único que a fase responde; na fase dividida sem declaração, nenhum', () => {
    const raizes = comando(
      rascunho(
        exigencia({ faseCodigo: 'HABILITACAO' }),
        exigencia({
          tipoDocumentoId: ID_DIPLOMA,
          faseCodigo: 'ISENCAO',
          finalidade: 'ISENCAO_TAXA',
        }),
        exigencia({ tipoDocumentoId: ID_CONTRACHEQUE, faseCodigo: 'ISENCAO' }),
      ),
    );

    expect(raizes.map((raiz) => raiz.documento?.finalidade)).toEqual([
      'HABILITACAO',
      'ISENCAO_TAXA',
      null,
    ]);
  });

  it('o formulário declarado que a fase não responde mais não é trocado pelo que ela responde, e a falta é dita', () => {
    const raizes = comando(
      rascunho(exigencia({ faseCodigo: 'HABILITACAO', finalidade: 'ISENCAO_TAXA' })),
    );

    expect(raizes[0].documento?.finalidade).toBe('ISENCAO_TAXA');
    expect(faltaOFormulario('ISENCAO_TAXA', ['HABILITACAO'])).toBe(
      'O formulário de isenção da taxa de inscrição não é respondido nesta fase; escolha o formulário.',
    );
  });

  it('no regime de todas as fases, a cópia não herda o formulário do modelo: cada fase resolve o seu', () => {
    const fases = new Map([...FASES, ['RESULTADO', '01960000-0000-7000-0000-0000000000f3']]);
    const finalidades = new Map([...FINALIDADES_POR_FASE, ['RESULTADO', []]]);
    const modelo = exigencia({ faseCodigo: 'ISENCAO', finalidade: 'INSCRICAO' });

    const raizes = arvoreDeExigencias(
      { raizes: [folhaDe(modelo)], emTodasAsFases: [ID_RG] },
      {
        faseIdPorCodigo: fases,
        modalidadesOfertadas: ['AC'],
        etapasVivas: ETAPAS_VIVAS,
        finalidadesPorFase: finalidades,
      },
    );

    expect(
      raizes.map((raiz) => [raiz.documento?.exigidoNaFaseId, raiz.documento?.finalidade]),
    ).toEqual([
      [ID_ISENCAO, 'INSCRICAO'],
      [ID_HABILITACAO, 'HABILITACAO'],
      ['01960000-0000-7000-0000-0000000000f3', null],
    ]);
  });

  it('os documentos de um grupo viajam com o formulário declarado na raiz', () => {
    const grupo = grupoOu(
      exigencia({ faseCodigo: 'ISENCAO', finalidade: 'ISENCAO_TAXA' }),
      exigencia({
        tipoDocumentoId: ID_CONTRACHEQUE,
        faseCodigo: 'ISENCAO',
        finalidade: 'INSCRICAO',
      }),
    );

    const [raiz] = comando({ raizes: [grupo], emTodasAsFases: [] });

    expect(raiz.filhos?.map((filho) => filho.documento?.finalidade)).toEqual([
      'ISENCAO_TAXA',
      'ISENCAO_TAXA',
    ]);
  });

  it('declarar o formulário de um documento de grupo declara o do grupo inteiro, e só dele', () => {
    const grupo = grupoOu(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ tipoDocumentoId: ID_CONTRACHEQUE, faseCodigo: 'ISENCAO' }),
    );
    const solta = folhaDe(exigencia({ tipoDocumentoId: ID_DIPLOMA, faseCodigo: 'ISENCAO' }));

    const declarado = comFinalidade(
      { raizes: [grupo, solta], emTodasAsFases: [] },
      ID_CONTRACHEQUE,
      'ISENCAO',
      'ISENCAO_TAXA',
    );

    expect(todasAsExigencias(declarado).map((documento) => documento.finalidade)).toEqual([
      'ISENCAO_TAXA',
      'ISENCAO_TAXA',
      null,
    ]);
  });

  it('na fase dividida, agrupa por formulário com o que falta escolher por último; a de um formulário só não se divide', () => {
    const itens = [
      { nome: 'sem', finalidade: null },
      { nome: 'isenção', finalidade: 'ISENCAO_TAXA' },
      { nome: 'inscrição', finalidade: 'INSCRICAO' },
    ];
    const agrupar = (atendidas: readonly string[]) =>
      agrupadosPorFormulario(itens, (item) => item.finalidade, atendidas).map((grupo) => [
        grupo.finalidade,
        grupo.itens.map((item) => item.nome),
      ]);

    expect(agrupar(['INSCRICAO', 'ISENCAO_TAXA'])).toEqual([
      ['INSCRICAO', ['inscrição']],
      ['ISENCAO_TAXA', ['isenção']],
      [null, ['sem']],
    ]);
    expect(agrupar(['HABILITACAO'])).toEqual([['HABILITACAO', ['sem', 'isenção', 'inscrição']]]);
  });
});
