import { UnidadePrazoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_DO_RECURSO,
  RECURSO_DA_FASE,
  etapaDoServidor,
  faseDoServidor,
  recursoDaEtapaDoServidor,
} from './cronograma-do-servidor.testing';
import { hidratarDraft } from './hidratacao';
import { DRAFT, FASE_COM_RECURSO, ETAPA, dtoComCronograma } from './hidratacao.testing';

const COM_CRONOGRAMA = dtoComCronograma({
  cronogramaFases: [FASE_COM_RECURSO],
  etapas: [ETAPA],
  algoritmoContagemPrazo: {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    hash: 'def456',
  },
});

const UNIDADE = { codigo: UnidadePrazoCodigo.diasUteis, rotulo: 'Dias úteis' };

function comParametros(parcial: Partial<typeof PARAMETROS_DO_RECURSO>) {
  return { ...RECURSO_DA_FASE, parametros: { ...PARAMETROS_DO_RECURSO, ...parcial } };
}

/** A regra de recurso da fase como a tela a recebe depois de ler os parâmetros que o servidor deu. */
function regraDaFaseLidaCom(parcial: Partial<typeof PARAMETROS_DO_RECURSO>) {
  const dto = dtoComCronograma({
    cronogramaFases: [faseDoServidor({ publicacoes: { regraRecurso: comParametros(parcial) } })],
    etapas: [],
  });
  return hidratarDraft(DRAFT, dto).cronograma.fases[0]?.regraRecurso;
}

describe('hidratarDraft — cronograma e etapas', () => {
  it('projeta a fase pelo id de origem, não pelo id do snapshot', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.faseCanonicaId).toBe('fase-canonica-homologacao');
    expect(fase.bancasRequeridas).toEqual([
      {
        id: 'snapshot-banca',
        identificadorLocal: 'banca-snapshot-banca',
        posicaoNoTipo: 1,
        copiaDoTipo: expect.objectContaining({ rotulo: 'BANCA_ANALISE_RECURSOS' }),
        tipoBancaId: 'tipo-banca-1',
        categoriasDocumentoIds: ['categoria-renda'],
        regraDeDeliberacao: null,
      },
    ]);
  });

  /**
   * O código acompanha o id porque as pendências derivadas e as precedências
   * falam em `INSCRICAO`, não em uuid.
   */
  it('projeta a unidade responsável pelo id de origem da cópia gravada', () => {
    const comUnidade = dtoComCronograma({
      cronogramaFases: [
        faseDoServidor({
          cronograma: {
            unidadeResponsavel: { origemId: 'unidade-cga', sigla: 'CGA', nome: 'CGA' },
          },
        }),
      ],
    });

    expect(hidratarDraft(DRAFT, comUnidade).cronograma.fases[0]?.unidadeResponsavelId).toBe(
      'unidade-cga',
    );
  });

  it('deixa a unidade da fase nula quando o processo não a tem', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.unidadeResponsavelId).toBeNull();
  });

  it('guarda o código canônico ao lado do identificador da fase', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.codigo).toBe('HOMOLOGACAO');
  });

  /**
   * O que a fase publica volta inteiro, com o papel de cada publicação: é dele
   * que a tela deriva o que a fase produz e se cabe recurso, e é ele que a
   * gravação do cronograma reenvia — a coleção é substituída por inteiro.
   */
  it('projeta os produtos da fase com o papel de cada publicação', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.produtos).toEqual([
      { atoCodigo: 'RESULTADO_HOMOLOGACAO', papel: 'PRELIMINAR' },
      { atoCodigo: 'COMUNICADO_HOMOLOGACAO', papel: null },
    ]);
  });

  /** Também não editados neste passo, e também reenviados a cada gravação. */
  it('projeta a promessa de parecer individual e o momento em relação à fase anterior', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.emiteParecerIndividual).toBe(true);
    expect(fase.noMesmoMomentoDaAnterior).toBe(false);
  });

  it.each([true, false])(
    'projeta a marca de acontecer no mesmo momento da anterior como o servidor a devolveu (%s)',
    (marca) => {
      const dto = dtoComCronograma({
        cronogramaFases: [faseDoServidor({ cronograma: { noMesmoMomentoDaAnterior: marca } })],
        etapas: [],
      });

      expect(hidratarDraft(DRAFT, dto).cronograma.fases[0]?.noMesmoMomentoDaAnterior).toBe(marca);
    },
  );

  it('preserva a janela como instante, com o deslocamento intacto', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.inicio).toBe('2026-03-25T08:00:00-03:00');
    expect(fase.fim).toBe('2026-03-25T23:59:59-03:00');
  });

  /**
   * O hash da referência não volta ao rascunho: o servidor o recompõe do
   * catálogo, e uma cópia aqui envelheceria sozinha.
   */
  it('projeta a regra de recurso sem carregar o hash da referência', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.regraRecurso?.regraCodigo).toBe('RECURSO-PRAZO-ANCORADO-EM-ATO');
    expect(fase.regraRecurso?.prazoValor).toBe('2');
    expect(fase.regraRecurso).not.toHaveProperty('hash');
  });

  it('preserva a declaração de instância superior que o servidor devolveu', () => {
    const semInstancia = dtoComCronograma({
      cronogramaFases: [
        faseDoServidor({
          publicacoes: {
            regraRecurso: {
              ...RECURSO_DA_FASE,
              parametros: { ...PARAMETROS_DO_RECURSO, admiteInstanciaSuperior: false },
            },
          },
        }),
      ],
      etapas: [],
    });

    const [fase] = hidratarDraft(DRAFT, semInstancia).cronograma.fases;

    expect(fase.regraRecurso?.admiteInstanciaSuperior).toBe(false);
  });

  /**
   * A leitura devolve a identidade da publicação; a gravação recebe o código do
   * tipo de ato. Sem cruzar os dois pelos produtos da fase, a gravação seguinte
   * sairia com a âncora em branco — recusada — ou com um código que aponta para
   * outra publicação, reancorando o prazo sem ninguém perceber.
   */
  it('reconstrói o código da âncora cruzando o produto ancorado com os da fase', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.regraRecurso?.atoAncoraCodigo).toBe('RESULTADO_HOMOLOGACAO');
  });

  /**
   * Nenhum produto da fase corresponde ao ancorado. Inventar um código elegeria
   * uma publicação em silêncio; devolver vazio deixa a ausência visível, e é ela
   * que a conferência do cronograma cobra antes de qualquer gravação.
   */
  it('devolve a âncora vazia quando o produto ancorado não está entre os da fase', () => {
    const semOProduto = dtoComCronograma({
      cronogramaFases: [faseDoServidor({ publicacoes: { produtos: [] } })],
      etapas: [],
    });

    const [fase] = hidratarDraft(DRAFT, semOProduto).cronograma.fases;

    expect(fase.regraRecurso?.atoAncoraCodigo).toBe('');
  });

  it('projeta os parâmetros do recurso pelo código, com o nome que a API deu a cada um', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.regraRecurso).toMatchObject({
      prazoValor: '2',
      prazoUnidade: 'diasUteis',
      admiteInstanciaSuperior: true,
      prazoSegundaInstanciaValor: '3',
      prazoSegundaInstanciaUnidade: 'diasUteis',
      efeitoSuspensivo: 'semEfeitoSuspensivo',
      guardaDaVaga: 'ateOResultadoDefinitivo',
    });
    expect(fase.regraRecurso?.leitura).toEqual({
      rotulos: {
        prazoUnidade: 'Dias úteis',
        prazoSegundaInstanciaUnidade: 'Dias úteis',
        efeitoSuspensivo: 'Sem efeito suspensivo',
        guardaDaVaga: 'Guarda a vaga até o resultado definitivo',
      },
      prazoDaSegundaInstanciaSemInstanciaSuperior: false,
    });
  });

  it('projeta o prazo da 2ª instância ausente como campos vazios', () => {
    const dto = dtoComCronograma({
      cronogramaFases: [
        faseDoServidor({
          publicacoes: {
            regraRecurso: comParametros({
              admiteInstanciaSuperior: false,
              prazoSegundaInstanciaValor: null,
              prazoSegundaInstanciaUnidade: null,
            }),
          },
        }),
      ],
      etapas: [],
    });

    const regra = hidratarDraft(DRAFT, dto).cronograma.fases[0]?.regraRecurso;

    expect(regra).toMatchObject({
      prazoSegundaInstanciaValor: '',
      prazoSegundaInstanciaUnidade: '',
    });
    expect(regra?.leitura.prazoDaSegundaInstanciaSemInstanciaSuperior).toBe(false);
  });

  it.each([
    ['o valor', { prazoSegundaInstanciaValor: 3, prazoSegundaInstanciaUnidade: null }],
    ['a unidade', { prazoSegundaInstanciaValor: null, prazoSegundaInstanciaUnidade: UNIDADE }],
    ['o par', { prazoSegundaInstanciaValor: 3, prazoSegundaInstanciaUnidade: UNIDADE }],
  ])(
    'marca a leitura quando o recurso sem instância superior traz %s do prazo da 2ª instância',
    (_nome, prazo) => {
      const dto = dtoComCronograma({
        cronogramaFases: [
          faseDoServidor({
            publicacoes: {
              regraRecurso: comParametros({
                admiteInstanciaSuperior: false,
                ...prazo,
              }),
            },
          }),
        ],
        etapas: [],
      });

      const regra = hidratarDraft(DRAFT, dto).cronograma.fases[0]?.regraRecurso;

      expect(regra?.leitura.prazoDaSegundaInstanciaSemInstanciaSuperior).toBe(true);
    },
  );

  it('lê o código de efeito e de guarda que o vocabulário atual não conhece, sem trocá-lo', () => {
    const regra = regraDaFaseLidaCom({
      efeitoSuspensivo: { codigo: 'efeitoDoFuturo' as never, rotulo: 'Efeito do futuro' },
      guardaDaVaga: { codigo: 'guardaDoFuturo' as never, rotulo: 'Guarda do futuro' },
    });

    expect(regra?.efeitoSuspensivo).toBe('efeitoDoFuturo');
    expect(regra?.guardaDaVaga).toBe('guardaDoFuturo');
    expect(regra?.leitura.rotulos).toMatchObject({
      efeitoSuspensivo: 'Efeito do futuro',
      guardaDaVaga: 'Guarda do futuro',
    });
  });

  it('projeta os parâmetros do recurso da etapa do mesmo jeito que os da fase', () => {
    const dto = dtoComCronograma({
      cronogramaFases: [],
      etapas: [etapaDoServidor({ publicacoes: { recursos: [recursoDaEtapaDoServidor()] } })],
    });

    const [etapa] = hidratarDraft(DRAFT, dto).cronograma.etapas;

    expect(etapa.recursos[0]).toMatchObject({
      prazoUnidade: 'diasUteis',
      efeitoSuspensivo: 'semEfeitoSuspensivo',
    });
    expect(etapa.recursos[0]?.leitura.rotulos.efeitoSuspensivo).toBe('Sem efeito suspensivo');
  });

  it('guarda o Id que o servidor deu ao recurso da etapa, que a recusa da publicação cita', () => {
    const dto = dtoComCronograma({
      cronogramaFases: [],
      etapas: [
        etapaDoServidor({
          publicacoes: { recursos: [recursoDaEtapaDoServidor({ id: 'recurso-lido' })] },
        }),
      ],
    });

    const [etapa] = hidratarDraft(DRAFT, dto).cronograma.etapas;

    expect(etapa.recursos[0]?.id).toBe('recurso-lido');
  });

  /**
   * O `id` da etapa é o único que volta ao rascunho, porque critério de
   * desempate e regra de eliminação o referenciam — perdê-lo ao reordenar
   * deixaria os dois apontando para uma etapa que deixou de existir.
   */
  it('preserva o id da etapa e o id de origem do tipo', () => {
    const [etapa] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.etapas;

    expect(etapa.id).toBe('etapa-persistida-1');
    expect(etapa.tipoEtapaOrigemId).toBe('tipo-etapa-1');
  });

  it('devolve nota mínima ausente como campo vazio, não como zero', () => {
    const [etapa] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.etapas;

    expect(etapa.notaMinima).toBe('');
    expect(etapa.peso).toBe('2');
  });

  /**
   * A etapa gravada sem ordem volta como zero. Com uma etapa só não há duplicata
   * que a conferência acuse nem botão de mover que a conserte: a gravação sairia
   * com ordem zero para voltar recusada, sem nada na tela explicando. Renumerar
   * na chegada preserva a sequência que o servidor devolveu.
   */
  it('renumera as etapas na chegada, corrigindo ordem ausente', () => {
    const semOrdem = dtoComCronograma({
      etapas: [
        etapaDoServidor({ id: 'etapa-sem-ordem', identificacao: { ordem: null } }),
        etapaDoServidor({ id: 'etapa-com-ordem', identificacao: { ordem: 7 } }),
      ],
    });

    const { etapas } = hidratarDraft(DRAFT, semOrdem).cronograma;

    expect(etapas.map((etapa) => etapa.ordem)).toEqual([1, 2]);
    expect(etapas.map((etapa) => etapa.id)).toEqual(['etapa-sem-ordem', 'etapa-com-ordem']);
  });

  it('projeta a convenção de contagem declarada', () => {
    const { cronograma } = hidratarDraft(DRAFT, COM_CRONOGRAMA);

    expect(cronograma.algoritmoContagemCodigo).toBe('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    expect(cronograma.algoritmoContagemVersao).toBe('v1');
  });

  it('trata processo sem cronograma, sem etapa e sem convenção', () => {
    const vazio = dtoComCronograma({ cronogramaFases: [], etapas: [] });
    const { cronograma } = hidratarDraft(DRAFT, vazio);

    expect(cronograma.fases).toEqual([]);
    expect(cronograma.etapas).toEqual([]);
    expect(cronograma.algoritmoContagemCodigo).toBe('');
  });
});
