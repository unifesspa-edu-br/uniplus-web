import { describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento, RegraDeComprovacao } from '../../processo-seletivo.models';
import { todasAsExigencias } from './consulta-das-exigencias';
import { regraDeDocumento } from './exigencias-documentais';
import {
  agrupadosPorFormulario,
  aguardaFormulario,
  codigoEnviado,
  comFormularioDaExigencia,
  faltaOFormulario,
  formularioDaExigencia,
  formulariosEscolhiveis,
} from './formulario-da-exigencia';
import { regrasDeComprovacaoParaEnvio } from './gravacao-das-exigencias';
import {
  ETAPAS_VIVAS,
  FASES,
  FORMULARIOS_POR_FASE,
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
  const documentoNoGrupo = (documento: ExigenciaDeDocumento): RegraDeComprovacao =>
    regraDeDocumento(documento);
  const grupoDeAlternativas = (
    ...documentos: readonly ExigenciaDeDocumento[]
  ): RegraDeComprovacao => ({
    ...regraDeDocumento(documentos[0]),
    forma: 'QUANTIDADE_MINIMA_DE_ITENS',
    documento: null,
    itens: documentos.map(documentoNoGrupo),
  });

  it('viaja o declarado, ou o único que a fase responde; na fase dividida sem declaração, nenhum', () => {
    const regrasDeComprovacao = comando(
      rascunho(
        exigencia({ faseCodigo: 'HABILITACAO' }),
        exigencia({
          tipoDocumentoId: ID_DIPLOMA,
          faseCodigo: 'ISENCAO',
          formularioCodigo: 'ISENCAO_TAXA',
        }),
        exigencia({ tipoDocumentoId: ID_CONTRACHEQUE, faseCodigo: 'ISENCAO' }),
      ),
    );

    expect(
      regrasDeComprovacao.map(
        (regraPrincipal) => regraPrincipal.documento?.momento?.formularioCodigo,
      ),
    ).toEqual(['HABILITACAO', 'ISENCAO_TAXA', '']);
  });

  it('o formulário declarado que a fase não responde mais não é trocado pelo que ela responde, e a falta é dita', () => {
    const regrasDeComprovacao = comando(
      rascunho(exigencia({ faseCodigo: 'HABILITACAO', formularioCodigo: 'ISENCAO_TAXA' })),
    );

    expect(regrasDeComprovacao[0].documento?.momento?.formularioCodigo).toBe('ISENCAO_TAXA');
    expect(faltaOFormulario('ISENCAO_TAXA', ['HABILITACAO'])).toBe(
      'O formulário ISENCAO_TAXA não é respondido nesta fase; escolha o formulário.',
    );
  });

  it('no regime de todas as fases, a cópia não herda o formulário do modelo: cada fase resolve o seu', () => {
    const fases = new Map([...FASES, ['RESULTADO', '01960000-0000-7000-0000-0000000000f3']]);
    const formularios = new Map([...FORMULARIOS_POR_FASE, ['RESULTADO', []]]);
    const modelo = exigencia({ faseCodigo: 'ISENCAO', formularioCodigo: 'INSCRICAO' });

    const regrasDeComprovacao = regrasDeComprovacaoParaEnvio(
      { regrasDeComprovacao: [regraDeDocumento(modelo)], emTodasAsFases: [ID_RG] },
      {
        faseIdPorCodigo: fases,
        modalidadesOfertadas: ['AC'],
        etapasVivas: ETAPAS_VIVAS,
        formulariosPorFase: formularios,
      },
    ).regras;

    expect(
      regrasDeComprovacao.map((regraPrincipal) => [
        regraPrincipal.documento?.momento?.faseId,
        regraPrincipal.documento?.momento?.formularioCodigo,
      ]),
    ).toEqual([
      [ID_ISENCAO, 'INSCRICAO'],
      [ID_HABILITACAO, 'HABILITACAO'],
      ['01960000-0000-7000-0000-0000000000f3', ''],
    ]);
  });

  it('os documentos de um grupo viajam com o formulário declarado na regra principal', () => {
    const grupo = grupoDeAlternativas(
      exigencia({ faseCodigo: 'ISENCAO', formularioCodigo: 'ISENCAO_TAXA' }),
      exigencia({
        tipoDocumentoId: ID_CONTRACHEQUE,
        faseCodigo: 'ISENCAO',
        formularioCodigo: 'INSCRICAO',
      }),
    );

    const [regraPrincipal] = comando({ regrasDeComprovacao: [grupo], emTodasAsFases: [] });

    expect(
      regraPrincipal.itens?.map((itemDoGrupo) => itemDoGrupo.documento?.momento?.formularioCodigo),
    ).toEqual(['ISENCAO_TAXA', 'ISENCAO_TAXA']);
  });

  it('declarar o formulário de um documento de grupo declara o do grupo inteiro, e só dele', () => {
    const grupo = grupoDeAlternativas(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ tipoDocumentoId: ID_CONTRACHEQUE, faseCodigo: 'ISENCAO' }),
    );
    const solta = regraDeDocumento(
      exigencia({ tipoDocumentoId: ID_DIPLOMA, faseCodigo: 'ISENCAO' }),
    );

    const declarado = comFormularioDaExigencia(
      { regrasDeComprovacao: [grupo, solta], emTodasAsFases: [] },
      grupo.itens?.[1].identificadorNoRascunho ?? '',
      'ISENCAO_TAXA',
    );

    expect(todasAsExigencias(declarado).map((documento) => documento.formularioCodigo)).toEqual([
      'ISENCAO_TAXA',
      'ISENCAO_TAXA',
      null,
    ]);
  });

  it('na fase dividida, agrupa por formulário com o que falta escolher por último; a de um formulário só não se divide', () => {
    const itens = [
      { nome: 'sem', codigo: null },
      { nome: 'isenção', codigo: 'ISENCAO_TAXA' },
      { nome: 'inscrição', codigo: 'INSCRICAO' },
    ];
    const agrupar = (atendidas: readonly string[]) =>
      agrupadosPorFormulario(itens, (item) => item.codigo, atendidas).map((grupo) => [
        grupo.codigo,
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

describe('a exigência numa fase sem formulário', () => {
  it('aguarda o formulário, tenha ou não declarado um', () => {
    expect(formularioDaExigencia(null, [])).toEqual({ situacao: 'AGUARDA_FORMULARIO' });
    expect(formularioDaExigencia('INSCRICAO', [])).toEqual({ situacao: 'AGUARDA_FORMULARIO' });
    expect(aguardaFormulario([])).toBe(true);
    expect(aguardaFormulario(['INSCRICAO'])).toBe(false);
  });

  it('não é falta a recusar: a tela só avisa', () => {
    expect(faltaOFormulario(null, [])).toBeNull();
  });

  it('não leva código de formulário ao servidor', () => {
    expect(codigoEnviado(null, [])).toBeNull();
    expect(codigoEnviado('INSCRICAO', ['INSCRICAO'])).toBe('INSCRICAO');
    expect(codigoEnviado(null, ['INSCRICAO'])).toBe('INSCRICAO');
  });

  it('não oferece a opção "Nenhum"; a escolha lista só os formulários da fase', () => {
    expect(formulariosEscolhiveis([])).toEqual([]);
    expect(formulariosEscolhiveis([{ codigo: 'INSCRICAO', rotulo: 'de inscrição' }])).toEqual([
      { valor: 'INSCRICAO', rotulo: 'Formulário de inscrição' },
    ]);
  });
});
