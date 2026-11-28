import { describe, expect, it } from 'vitest';

import type { ExigenciasDoRascunho } from '../../modelos/exigencias.models';
import { operadorNoDocumento, operadorNoEditor } from './condicoes-da-exigencia';
import {
  comDocumento,
  comRegra,
  comDocumentosExigidos,
  documentoComExigencias,
  adicionando,
  idaEVolta,
  secaoDe,
} from './exigencias.testing';

const chavesDasExigencias = (documento: ReturnType<typeof documentoComExigencias>) =>
  (secaoDe(documento).exigencias ?? []).map(({ chave }) => chave);

describe('edição das exigências de documento', () => {
  it('mudar o texto e a obrigatoriedade mantém as chaves e deixa as outras exigências intactas', () => {
    const documento = documentoComExigencias();

    const volta = idaEVolta(documento, (e) =>
      comRegra(e, 0, (regra) =>
        comDocumento(regra, { obrigatorio: false, consequenciaIndeferimento: '' }),
      ),
    );

    const [rg, ...outras] = secaoDe(volta).exigencias ?? [];
    const originais = secaoDe(documento).exigencias ?? [];
    expect(rg.chave).toBe('exigencia_rg');
    expect(rg.obrigatorio).toBe(false);
    expect(rg.consequenciaDoDescumprimento).toBeUndefined();
    expect(rg.consequenciaDoDescumprimentoRotulo).toBeUndefined();
    expect(rg.tipoDocumentoNome).toBe('Documento de identidade');
    outras.forEach((exigencia, posicao) => expect(exigencia).toBe(originais[posicao + 1]));
    expect(secaoDe(volta).regrasDeComprovacao?.[0].exigenciaChave).toBe('exigencia_rg');
  });

  it('reordenar as regras mantém a chave e a referência de cada uma', () => {
    const documento = documentoComExigencias();

    const volta = idaEVolta(documento, (e) => ({
      ...e,
      regrasDeComprovacao: [...e.regrasDeComprovacao].reverse(),
    }));

    const regras = secaoDe(volta).regrasDeComprovacao ?? [];
    expect(regras[0]).toBe(secaoDe(documento).regrasDeComprovacao?.[1]);
    expect(regras[1].exigenciaChave).toBe('exigencia_rg');
    expect(chavesDasExigencias(volta)).toEqual(chavesDasExigencias(documento));
  });

  it('trocar o código do tipo descarta o nome e a classificação do código antigo', () => {
    const volta = idaEVolta(documentoComExigencias(), (e) =>
      comRegra(e, 0, (regra) =>
        comDocumento(regra, { tipoDocumentoId: 'CNH', tipoDocumentoCodigo: 'CNH' }),
      ),
    );

    const rg = secaoDe(volta).exigencias?.[0];
    expect(rg?.tipoDocumentoCodigo).toBe('CNH');
    expect(rg?.tipoDocumentoNome).toBeUndefined();
    expect(rg?.classificacaoProtecao).toBeUndefined();
    expect(rg?.chave).toBe('exigencia_rg');
    expect(rg?.id).toBe('0196b3c2-8a10-7c3e-b5d2-6f1e4a9c2d71');
  });

  it('a exigência nova vai ao fim, com chave livre pelo código do tipo', () => {
    const documento = documentoComExigencias();

    const volta = idaEVolta(documento, (e) => adicionando(e, 'CERTIDAO_NASCIMENTO'));

    expect(chavesDasExigencias(volta)).toEqual([
      'exigencia_rg',
      'exigencia_comprovante_renda',
      'exigencia_laudo_medico',
      'exigencia_certidao_nascimento',
      'exigencia_certidao_nascimento_2',
    ]);
    const regras = secaoDe(volta).regrasDeComprovacao ?? [];
    expect(regras[2].exigenciaChave).toBe('exigencia_certidao_nascimento_2');
  });

  it('retirar a regra retira a exigência que só ela citava e mantém a que nenhuma regra citava', () => {
    const documento = documentoComExigencias();

    const volta = idaEVolta(documento, (e) => ({
      ...e,
      regrasDeComprovacao: e.regrasDeComprovacao.slice(0, 1),
    }));

    expect(chavesDasExigencias(volta)).toEqual(['exigencia_rg', 'exigencia_certidao_nascimento']);
    expect(secaoDe(volta).regrasDeComprovacao).toHaveLength(1);
  });

  it('retirar uma regra preserva a que cita exigência inexistente', () => {
    const documento = documentoComExigencias();
    const secao = secaoDe(documento);
    const comOrfa = {
      ...documento,
      documentosExigidos: {
        ...secao,
        regrasDeComprovacao: [
          { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_sumida' },
          ...(secao.regrasDeComprovacao ?? []),
        ],
      },
    } as typeof documento;

    const volta = idaEVolta(comOrfa, (e) => ({
      ...e,
      regrasDeComprovacao: e.regrasDeComprovacao.slice(1),
    }));

    expect(secaoDe(volta).regrasDeComprovacao).toHaveLength(2);
    expect(secaoDe(volta).regrasDeComprovacao?.[0].exigenciaChave).toBe('exigencia_sumida');
  });

  it('editar uma cláusula mantém as outras e as condições intactas como o mesmo objeto', () => {
    const documento = documentoComExigencias();
    const originais = secaoDe(documento).exigencias?.[1].condicoes ?? [];

    const volta = idaEVolta(documento, (e) =>
      comRegra(e, 1, (grupo) => ({
        ...grupo,
        itens: (grupo.itens ?? []).map((item, posicao) =>
          posicao === 0 ? comRenda(item, '2') : item,
        ),
      })),
    );

    const condicoes = secaoDe(volta).exigencias?.[1].condicoes ?? [];
    expect(condicoes[0][0]).toBe(originais[0][0]);
    expect(condicoes[0][1]).toEqual({ ...originais[0][1], valor: 2 });
    expect(condicoes[1]).toBe(originais[1]);
  });

  it('grava o valor da condição pela conversão do texto do editor', () => {
    const volta = idaEVolta(documentoComExigencias(), (e) =>
      comRegra(e, 1, (grupo) => ({
        ...grupo,
        itens: (grupo.itens ?? []).map((item, posicao) =>
          posicao === 0 ? comTresCondicoes(item) : item,
        ),
      })),
    );

    const [clausula] = secaoDe(volta).exigencias?.[1].condicoes ?? [];
    expect(clausula.map(({ valor }) => valor)).toEqual([['LB_PPI', 'LB_PCD'], 7, false]);
  });

  it('leva ao documento cada campo da exigência que a tela mudou', () => {
    const volta = idaEVolta(documentoComExigencias(), (e) =>
      comRegra(e, 0, (regra) =>
        comDocumento(regra, {
          faseCodigo: 'HABILITACAO',
          etapaChave: 'etapa_analise',
          formularioCodigo: 'HABILITACAO',
          fatosComprovados: [],
          aplicabilidade: 'CONDICIONAL',
          abrePrazoParaReenvio: true,
          basesLegais: [
            {
              referencia: ' Lei 9 ',
              abrangencia: 'FEDERAL',
              situacao: 'PENDENTE',
              observacao: ' ',
            },
          ],
          prazoDeEmissao: null,
          validade: null,
          formatosPermitidos: { tipo: 'qualquer' },
          tamanhoMaximoBytes: null,
          modelo: null,
        }),
      ),
    );

    const rg = secaoDe(volta).exigencias?.[0];
    expect(rg).toMatchObject({
      faseChave: 'fase_habilitacao',
      etapaChave: 'etapa_analise',
      formularioCodigo: 'HABILITACAO',
      aplicabilidade: 'CONDICIONAL',
      abrePrazoParaReenvio: true,
      formatosPermitidos: { qualquer: true },
      basesLegais: [{ referencia: 'Lei 9', abrangencia: 'FEDERAL', situacao: 'PENDENTE' }],
    });
    expect(rg?.aplicabilidadeRotulo).toBeUndefined();
    expect(rg?.dadosComprovados).toEqual([]);
    expect(
      ['prazoDeEmissao', 'validade', 'tamanhoMaximoBytes', 'modeloId', 'modelo'].filter(
        (c) => c in (rg ?? {}),
      ),
    ).toEqual([]);
  });

  it('leva ao documento o prazo, a validade, os formatos e o modelo que a tela declarou', () => {
    const volta = idaEVolta(documentoComExigencias(), (e) =>
      comRegra(e, 0, (regra) =>
        comDocumento(regra, {
          prazoDeEmissao: {
            escolha: 'COM_PRAZO',
            valor: 30,
            unidade: 'DIAS',
            efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
            referencia: { tipo: 'INICIO_DA_FASE', data: null, faseCodigo: 'INSCRICAO' },
          },
          validade: {
            escolha: 'NAO_EXIGE_DOCUMENTO_VALIDO',
            referencia: null,
            efeitoDoVencimento: null,
          },
          formatosPermitidos: {
            tipo: 'lista',
            itens: [{ formato: 'PNG', tamanhoMaximoBytes: null }],
          },
          modelo: { modeloId: 'modelo-1', nomeArquivo: 'a.docx', formato: 'DOCX', hashSha256: 'x' },
        }),
      ),
    );

    const rg = secaoDe(volta).exigencias?.[0];
    expect(rg?.prazoDeEmissao).toEqual({
      escolha: 'COM_PRAZO',
      valor: 30,
      unidade: 'DIAS',
      efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
      referencia: { tipo: 'INICIO_DA_FASE', faseChave: 'fase_inscricao' },
    });
    expect(rg?.validade).toEqual({ escolha: 'NAO_EXIGE_DOCUMENTO_VALIDO' });
    expect(rg?.formatosPermitidos).toEqual({ lista: [{ formato: 'PNG' }] });
    expect(rg?.modeloId).toBe('modelo-1');
    expect(rg?.modelo).toBeUndefined();
  });

  it('o texto da condição que não é JSON vale como texto', () => {
    const volta = idaEVolta(documentoComExigencias(), (e) =>
      comRegra(e, 1, (grupo) => ({
        ...grupo,
        itens: (grupo.itens ?? []).map((item, posicao) =>
          posicao === 0 ? comCondicaoLivre(item) : item,
        ),
      })),
    );

    expect(secaoDe(volta).exigencias?.[1].condicoes?.[0].map(({ valor }) => valor)).toEqual([
      'Pará',
      '',
    ]);
  });

  it('o operador passa por um único ponto de conversão', () => {
    expect(operadorNoEditor(operadorNoDocumento('ALGUM_DE'))).toBe('ALGUM_DE');
  });

  it('a restrição às modalidades só é replicada em cada alternativa na exigência editada', () => {
    const documento = comDocumentosExigidos({
      exigencias: [
        {
          chave: 'exigencia_comprovante_renda',
          tipoDocumentoCodigo: 'COMPROVANTE_RENDA',
          faseChave: 'fase_inscricao',
          aplicabilidade: 'CONDICIONAL',
          obrigatorio: true,
          abrePrazoParaReenvio: false,
          condicoes: [
            [
              { codigoDoDado: 'MODALIDADE', operador: 'ALGUM_DE', valor: ['LB_PPI'] },
              { codigoDoDado: 'RENDA_PER_CAPITA', operador: 'MENOR_IGUAL', valor: 1.5 },
            ],
            [{ codigoDoDado: 'ESTADO', operador: 'IGUAL', valor: 'PA' }],
          ],
        },
      ],
      regrasDeComprovacao: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_comprovante_renda' }],
    });

    const intacta = idaEVolta(documento);
    const editada = idaEVolta(documento, (e) => comRegra(e, 0, (regra) => comRenda(regra, '2')));

    expect(secaoDe(intacta).exigencias?.[0]).toBe(secaoDe(documento).exigencias?.[0]);
    const alternativas = secaoDe(editada).exigencias?.[0].condicoes ?? [];
    expect(alternativas.map((a) => a.map((c) => c.codigoDoDado))).toEqual([
      ['MODALIDADE', 'RENDA_PER_CAPITA'],
      ['ESTADO', 'MODALIDADE'],
    ]);
  });

  it('a fase marcada como válida em todas as fases ganha a exigência nas que faltam', () => {
    const documento = documentoComExigencias();

    const volta = idaEVolta(documento, (e) => ({ ...e, emTodasAsFases: ['RG'] }));

    expect(chavesDasExigencias(volta)).toContain('exigencia_rg_2');
    const nova = secaoDe(volta).exigencias?.at(-1);
    expect(nova?.faseChave).toBe('fase_habilitacao');
  });
});

function comRenda(item: ExigenciasDoRascunho['regrasDeComprovacao'][number], valor: string) {
  const documento = item.documento;
  if (documento === null) return item;
  const condicoes = documento.condicoes.map((condicao) =>
    condicao.fato === 'RENDA_PER_CAPITA' ? { ...condicao, valor } : condicao,
  );
  return { ...item, documento: { ...documento, condicoes } };
}

function comTresCondicoes(item: ExigenciasDoRascunho['regrasDeComprovacao'][number]) {
  const documento = item.documento;
  if (documento === null) return item;
  const condicoes = [
    { clausula: 1, fato: 'MODALIDADE', operador: 'ALGUM_DE', valor: '["LB_PPI","LB_PCD"]' },
    { clausula: 1, fato: 'RENDA_PER_CAPITA', operador: 'MENOR_IGUAL', valor: '7' },
    { clausula: 1, fato: 'POSSUI_DEFICIENCIA', operador: 'IGUAL', valor: 'false' },
  ];
  return { ...item, documento: { ...documento, condicoes } };
}

function comCondicaoLivre(item: ExigenciasDoRascunho['regrasDeComprovacao'][number]) {
  const documento = item.documento;
  if (documento === null) return item;
  const condicoes = [
    { clausula: 1, fato: 'ESTADO', operador: 'IGUAL', valor: 'Pará' },
    { clausula: 1, fato: 'CIDADE', operador: 'IGUAL', valor: '' },
  ];
  return { ...item, documento: { ...documento, condicoes } };
}
