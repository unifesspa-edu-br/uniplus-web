import { describe, expect, it } from 'vitest';
import {
  recusaDaEtapaDeNotaDoEnem,
  localDoErroDaEtapa,
  recusaDoCampoDaEtapa,
  campoDaRecusa,
  fasesComUnidadeNaoEncontrada,
  recusaDaBancaDaEtapa,
  textoDaRecusaDaEtapa,
} from './recusas-do-servidor-da-etapa';

describe('recusas do servidor à etapa', () => {
  it('dá texto às recusas de avaliação do servidor e ignora as de outra natureza', () => {
    expect(
      recusaDoCampoDaEtapa('uniplus.selecao.etapa_processo.passo_na_forma_objetiva'),
    ).toContain('avaliação humana');
    expect(recusaDoCampoDaEtapa('uniplus.selecao.etapa_processo.nome_obrigatorio')).toBeNull();
  });

  it('lê a etapa e o campo que a recusa do servidor aponta', () => {
    expect(localDoErroDaEtapa('etapas[1].notaMaxima')).toMatchObject({
      indice: 1,
      campo: 'notaMaxima',
    });
    expect(localDoErroDaEtapa('etapas[2]')).toMatchObject({ indice: 2, campo: null });
    expect(localDoErroDaEtapa('etapas[0].itensDeAvaliacao[3].pontuacaoMaxima')).toEqual({
      indice: 0,
      campo: 'itensDeAvaliacao',
      posicao: 3,
      subcampo: 'pontuacaoMaxima',
    });
    expect(localDoErroDaEtapa('fases[0].codigo')).toBeNull();
  });

  it('dá texto às recusas do servidor a item e nível e as aponta no campo', () => {
    expect(
      recusaDoCampoDaEtapa('uniplus.selecao.item_de_avaliacao.pontuacao_fora_do_passo'),
    ).toContain('passo do lançamento');
    expect(campoDaRecusa(localDoErroDaEtapa('etapas[0].itensDeAvaliacao[1].pontuacaoMaxima'))).toBe(
      'itensDeAvaliacao.1.pontuacaoMaxima',
    );
    expect(campoDaRecusa(localDoErroDaEtapa('etapas[0].escalaDeAtendimento'))).toBe(
      'escalaDeAtendimento',
    );
    expect(campoDaRecusa(localDoErroDaEtapa('etapas[0].itensDeAvaliacao[1].outro'))).toBeNull();
  });

  it('a recusa do servidor à etapa de nota do ENEM ganha texto próprio', () => {
    expect(
      recusaDaEtapaDeNotaDoEnem(
        'uniplus.selecao.processo_seletivo.etapa_nota_enem_nao_compoe_nota',
      ),
    ).toContain('compõe a média');
    expect(
      recusaDaEtapaDeNotaDoEnem('uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca'),
    ).toContain('não admite banca');
    expect(
      recusaDaEtapaDeNotaDoEnem(
        'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_produto_ou_recurso_em_ato',
      ),
    ).toContain('recurso da fase que a divulga');
    expect(
      recusaDaEtapaDeNotaDoEnem('uniplus.selecao.processo_seletivo.etapa_nota_enem_com_lancamento'),
    ).toBeNull();
  });
});

describe('fases cuja unidade o servidor não encontrou', () => {
  const NAO_ENCONTRADA = 'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada';

  it('devolve a posição de cada fase citada no campo da unidade', () => {
    expect(
      fasesComUnidadeNaoEncontrada([
        { field: 'fases[2].unidadeResponsavelId', code: NAO_ENCONTRADA },
        { field: 'fases[0].unidadeResponsavelId', code: NAO_ENCONTRADA },
      ]),
    ).toEqual([2, 0]);
  });

  it.each(['$.fases[2].unidadeResponsavelId', 'request.Fases[2].UnidadeResponsavelId'])(
    'reconhece o campo com prefixo de caminho e caixa diferentes: %s',
    (field) => {
      expect(fasesComUnidadeNaoEncontrada([{ field, code: NAO_ENCONTRADA }])).toEqual([2]);
    },
  );

  it('ignora outro código ou outro campo da fase', () => {
    expect(
      fasesComUnidadeNaoEncontrada([
        { field: 'fases[1].unidadeResponsavelId', code: 'uniplus.validacao' },
        { field: 'fases[1].inicio', code: NAO_ENCONTRADA },
      ]),
    ).toEqual([]);
  });
});

describe('recusas do servidor à regra de deliberação das bancas da etapa', () => {
  const PREFIXO = 'uniplus.selecao.banca.';

  it('aponta o campo da regra da banca, pela posição da etapa e da banca', () => {
    expect(
      recusaDaBancaDaEtapa({
        field: 'etapas[2].bancas[1].regraDeDeliberacao.desempate',
        code: `${PREFIXO}desempate_nao_se_aplica`,
      }),
    ).toMatchObject({ indice: 2, campo: 'bancas.1.desempate' });
  });

  it('cai no campo da tabela quando o caminho aponta só a banca', () => {
    expect(
      recusaDaBancaDaEtapa({
        field: 'etapas[0].bancas[0]',
        code: `${PREFIXO}regra_de_deliberacao_obrigatoria`,
      }),
    ).toMatchObject({ indice: 0, campo: 'bancas.0.regra' });
  });

  it('reconhece o campo sem distinguir a caixa', () => {
    expect(
      recusaDaBancaDaEtapa({
        field: 'Etapas[0].Bancas[3].RegraDeDeliberacao.SemUnanimidade',
        code: `${PREFIXO}sem_unanimidade_obrigatoria`,
      }),
    ).toMatchObject({ campo: 'bancas.3.semUnanimidade' });
  });

  it('prefere a mensagem do servidor para o mínimo de integrantes', () => {
    expect(
      recusaDaBancaDaEtapa({
        field: 'etapas[0].bancas[0].regraDeDeliberacao.integrantes',
        code: `${PREFIXO}integrantes_abaixo_do_minimo`,
        message: 'A banca precisa de 3 integrantes.',
      })?.texto,
    ).toBe('A banca precisa de 3 integrantes.');
  });

  it('ignora o erro que não é da regra de uma banca da etapa', () => {
    expect(
      recusaDaBancaDaEtapa({
        field: 'etapas[0].notaMaxima',
        code: `${PREFIXO}criterio_obrigatorio`,
      }),
    ).toBeNull();
    expect(
      recusaDaBancaDaEtapa({ field: 'etapas[0].bancas[0]', code: 'uniplus.validacao' }),
    ).toBeNull();
  });

  it('entrega o texto da banca ou o do campo da etapa, com a etapa que o erro nomeia', () => {
    expect(
      textoDaRecusaDaEtapa({
        field: 'etapas[1].bancas[0].regraDeDeliberacao.quorum',
        code: `${PREFIXO}quorum_incoerente`,
      }),
    ).toMatchObject({ indice: 1, texto: expect.stringContaining('quórum') });
    expect(
      textoDaRecusaDaEtapa({
        field: 'etapas[3].notaMaxima',
        code: 'uniplus.selecao.etapa_processo.nota_maxima_invalida',
      }),
    ).toEqual({ indice: 3, texto: 'A nota máxima precisa ser maior que zero.' });
    expect(textoDaRecusaDaEtapa({ field: 'etapas[0]', code: 'uniplus.validacao' })).toBeNull();
  });

  it('não dá campo ao erro de banca fora do formato que a etapa conhece', () => {
    expect(
      campoDaRecusa(localDoErroDaEtapa('etapas[0].bancas[0].regraDeDeliberacao.quorum')),
    ).toBeNull();
  });
});
