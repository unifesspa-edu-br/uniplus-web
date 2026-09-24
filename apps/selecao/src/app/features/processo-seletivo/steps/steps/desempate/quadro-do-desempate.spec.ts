import { describe, expect, it } from 'vitest';

import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore, type ClassificacaoGravada } from '../../processo-seletivo.store';
import type { GrupoDoQuadro } from '../../shared/quadro-de-pesos';
import { REGRA_CALCULO_MEDIA_PONDERADA } from '../classificacao/classificacao-para-comando';
import {
  conferirDesempateGravado,
  reavaliarRecusaPeloDesempate,
  recusaAoGravarODesempate,
  recusaSemAreas,
  situacaoDoQuadro,
} from './quadro-do-desempate';
import type { LeituraDoCadastro } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';

const GRAVADA = 'Resolução gravada';
const ESCOLHIDA = 'Resolução escolhida';

const CANONICAS = [
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática' },
  { codigo: 'REDACAO', rotulo: 'Redação' },
];

function grupos(...areas: string[]): readonly GrupoDoQuadro[] {
  return ['G1', 'G2'].map((codigo) => ({
    codigo,
    rotulo: codigo,
    baseLegal: 'Anexo I',
    areas: areas.map((area) => ({ codigo: area, rotulo: area, peso: 1, corte: null })),
  }));
}

function classificacao(resolucao: string | null): WizardDraft['classificacao'] {
  return {
    regraCalculoCodigo: resolucao === null ? 'OUTRA' : REGRA_CALCULO_MEDIA_PONDERADA,
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: '',
    regraArredondamentoVersao: '',
    casasArredondamento: '',
    regraOrdemAlocacaoCodigo: '',
    regraOrdemAlocacaoVersao: '',
    nOpcoesAlocacao: '',
    baseadoEmEnem: resolucao !== null,
    resolucaoPesoAreaEnem: resolucao ?? '',
    regrasEliminacao: [],
  };
}

function lido(quadro: readonly GrupoDoQuadro[], leitura = 1): LeituraDoCadastro {
  return {
    lido: true,
    carregando: false,
    leitura,
    pedida: leitura,
    falha: null,
    quadroDaResolucaoEscolhida: quadro,
    canonicas: CANONICAS,
  };
}

const CARREGANDO: LeituraDoCadastro = {
  lido: false,
  carregando: true,
  leitura: 0,
  pedida: 0,
  falha: null,
  quadroDaResolucaoEscolhida: [],
  canonicas: CANONICAS,
};

const FALHOU: LeituraDoCadastro = { ...CARREGANDO, carregando: false, falha: 'Não foi possível.' };

function comQuadro(resolucao: string, quadro: readonly GrupoDoQuadro[], confirmada = true) {
  return { estado: 'com-quadro', resolucao, grupos: quadro, confirmada } as const;
}

const NUNCA: ClassificacaoGravada = { estado: 'nunca-gravada' };

function criterio(areas: string[]): CriterioDesempateConfigurado {
  return {
    regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
    regraVersao: '1',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas,
  };
}

describe('situacaoDoQuadro', () => {
  it('com a classificação gravada desconhecida, não afirma quadro nenhum', () => {
    const situacao = situacaoDoQuadro(
      classificacao(GRAVADA),
      { estado: 'desconhecida' },
      lido(grupos('REDACAO')),
    );

    expect(situacao).toEqual({ tipo: 'por-reler', motivo: 'desconhecida' });
  });

  it('com a cópia por confirmar, não afirma os valores dela: falta a releitura', () => {
    const situacao = situacaoDoQuadro(
      classificacao(GRAVADA),
      comQuadro(GRAVADA, grupos('REDACAO'), false),
      lido(grupos('REDACAO')),
    );

    expect(situacao).toEqual({ tipo: 'por-reler', motivo: 'por-confirmar' });
  });

  it('gravada sem quadro, vale o quadro que a próxima gravação copia do cadastro', () => {
    expect(
      situacaoDoQuadro(classificacao(GRAVADA), { estado: 'sem-quadro' }, lido(grupos('REDACAO'))),
    ).toMatchObject({ tipo: 'lido', aceitas: [{ codigo: 'REDACAO' }], divergencia: null });
    expect(situacaoDoQuadro(classificacao(null), { estado: 'sem-quadro' }, CARREGANDO)).toEqual({
      tipo: 'sem-quadro',
    });
  });

  it('com o quadro gravado e o rascunho fora do ENEM, a próxima gravação recusa', () => {
    expect(
      situacaoDoQuadro(classificacao(null), comQuadro(GRAVADA, grupos('REDACAO')), CARREGANDO),
    ).toEqual({ tipo: 'rascunho-sem-quadro' });
  });

  it('com o cadastro lido sem a resolução escolhida, ela está fora do cadastro, gravada ou não', () => {
    expect(
      situacaoDoQuadro(classificacao(GRAVADA), comQuadro(GRAVADA, grupos('REDACAO')), lido([])),
    ).toEqual({ tipo: 'fora-do-cadastro' });
    expect(
      situacaoDoQuadro(classificacao(ESCOLHIDA), comQuadro(GRAVADA, grupos('REDACAO')), lido([])),
    ).toEqual({ tipo: 'fora-do-cadastro' });
    expect(situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, lido([]))).toEqual({
      tipo: 'fora-do-cadastro',
    });
  });

  it('sem o cadastro lido, a cópia gravada decide, e outra resolução fica a confirmar', () => {
    const situacao = situacaoDoQuadro(
      classificacao(ESCOLHIDA),
      comQuadro(GRAVADA, grupos('REDACAO')),
      CARREGANDO,
    );

    expect(situacao).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'REDACAO' }],
      divergencia: { tipo: 'a-confirmar', gravada: GRAVADA },
    });
  });

  it('com outra resolução escolhida, valem as áreas que as duas têm em todos os grupos', () => {
    const situacao = situacaoDoQuadro(
      classificacao(ESCOLHIDA),
      comQuadro(GRAVADA, grupos('LINGUAGENS', 'REDACAO')),
      lido(grupos('REDACAO', 'MATEMATICA')),
    );

    expect(situacao).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'REDACAO' }],
      divergencia: { tipo: 'outra-resolucao', gravada: GRAVADA, escolhida: ESCOLHIDA },
    });
  });

  it('com a mesma resolução mudada no cadastro, valem as áreas que a cópia e o cadastro têm', () => {
    const situacao = situacaoDoQuadro(
      classificacao(GRAVADA),
      comQuadro(GRAVADA, grupos('LINGUAGENS', 'REDACAO')),
      lido(grupos('REDACAO')),
    );

    expect(situacao).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'REDACAO' }],
      divergencia: { tipo: 'cadastro-alterado', gravada: GRAVADA },
    });
  });

  it('sem área que a cópia e o quadro da escolhida tenham juntos, não há o que oferecer', () => {
    expect(
      situacaoDoQuadro(
        classificacao(ESCOLHIDA),
        comQuadro(GRAVADA, grupos('LINGUAGENS')),
        lido(grupos('REDACAO')),
      ),
    ).toMatchObject({
      tipo: 'resolucoes-sem-area-em-comum',
      gravada: GRAVADA,
      escolhida: ESCOLHIDA,
    });
  });

  it('sem classificação gravada, o quadro vem do cadastro: carregando, em falha ou lido', () => {
    expect(situacaoDoQuadro(classificacao(''), NUNCA, CARREGANDO)).toEqual({
      tipo: 'sem-resolucao',
    });
    expect(situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, CARREGANDO)).toEqual({
      tipo: 'carregando',
    });
    expect(situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, FALHOU)).toEqual({
      tipo: 'falha',
      mensagem: 'Não foi possível.',
    });
    // A nova tentativa em curso depois de uma falha já não é a falha.
    expect(
      situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, { ...FALHOU, carregando: true }),
    ).toEqual({ tipo: 'carregando' });
    expect(
      situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, lido(grupos('REDACAO', 'MATEMATICA'))),
    ).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'MATEMATICA' }, { codigo: 'REDACAO' }],
      divergencia: null,
    });
  });
});

describe('recusaSemAreas', () => {
  it('é a dica da situação, sem a maiúscula e o ponto', () => {
    expect(recusaSemAreas({ tipo: 'por-reler', motivo: 'por-confirmar' })).toBe(
      'o quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura, e as áreas que o desempate pode citar dependem disso; releia o processo pelo aviso no início do passo',
    );
  });

  it('não recusa quando há áreas a oferecer, nem enquanto o cadastro carrega', () => {
    const oferece = situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, lido(grupos('REDACAO')));

    expect(recusaSemAreas(oferece)).toBeNull();
    expect(recusaSemAreas({ tipo: 'carregando' })).toBeNull();
  });
});

describe('conferirDesempateGravado', () => {
  it('sem critério por área não há o que conferir', () => {
    expect(
      conferirDesempateGravado(
        [{ ...criterio([]), regraCodigo: 'DESEMPATE-MAIOR-IDADE' }],
        classificacao(null),
        CARREGANDO,
      ),
    ).toEqual({ resultado: 'sem-pendencia' });
  });

  it('com o rascunho fora do ENEM, todo critério por área fica sem quadro', () => {
    expect(
      conferirDesempateGravado([criterio(['REDACAO'])], classificacao(null), CARREGANDO),
    ).toEqual({
      resultado: 'com-pendencias',
      pendencias: [{ posicao: 1, semQuadro: true, fora: [], todas: true }],
    });
  });

  it('aponta, pelo rótulo, as áreas que o cadastro lido não tem em todos os grupos', () => {
    expect(
      conferirDesempateGravado(
        [criterio(['REDACAO']), criterio(['LINGUAGENS', 'MATEMATICA'])],
        classificacao(ESCOLHIDA),
        lido(grupos('REDACAO', 'MATEMATICA')),
      ),
    ).toEqual({
      resultado: 'com-pendencias',
      pendencias: [{ posicao: 2, semQuadro: false, fora: ['Linguagens'], todas: false }],
    });
  });

  it('sem o cadastro lido não confere, o que não é o mesmo que não haver pendência', () => {
    expect(
      conferirDesempateGravado([criterio(['REDACAO'])], classificacao(ESCOLHIDA), CARREGANDO),
    ).toEqual({ resultado: 'nao-conferivel' });
  });
});

describe('reavaliarRecusaPeloDesempate', () => {
  function comRecusa(criterios: CriterioDesempateConfigurado[], leituraNaRecusa = 1) {
    const store = new ProcessoSeletivoStore();
    store.patchObjectSection('classificacao', classificacao(ESCOLHIDA));
    store.criteriosDesempateGravados.set(criterios);
    store.recusarPeloDesempate('Recusa pelo desempate.', leituraNaRecusa);
    return store;
  }

  it('com o cadastro relido depois da recusa, tira a recusa que ele já não provoca', () => {
    const store = comRecusa([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 2));

    expect(store.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('com o cadastro de antes da recusa, mantém a recusa: o servidor julgou pelo dele', () => {
    const store = comRecusa([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 1));

    expect(store.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });

  it('com o cadastro relido que ainda a provoca, mantém a recusa', () => {
    const store = comRecusa([criterio(['LINGUAGENS'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 2));

    expect(store.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });

  it('sem critério por área gravado, tira a recusa sem depender do cadastro', () => {
    const store = comRecusa([{ ...criterio([]), regraCodigo: 'DESEMPATE-MAIOR-IDADE' }]);

    reavaliarRecusaPeloDesempate(store, CARREGANDO);

    expect(store.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('critérios regravados depois da recusa, com o mesmo cadastro, tiram a recusa que já não provocam', () => {
    const store = comRecusa([criterio(['LINGUAGENS'])]);
    store.criteriosDesempateGravados.set([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 1));

    expect(store.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('os mesmos critérios regravados com o mesmo cadastro deixam a recusa', () => {
    const store = comRecusa([criterio(['REDACAO'])]);
    store.criteriosDesempateGravados.set([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 1));

    expect(store.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });

  it('com os critérios gravados desconhecidos, mantém a recusa', () => {
    const store = comRecusa([criterio(['REDACAO'])]);
    store.criteriosDesempateGravados.set(null);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 2));

    expect(store.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });
});

describe('recusaAoGravarODesempate', () => {
  const PREFIXO = 'uniplus.selecao.processo_seletivo.';
  const criterios = [criterio(['REDACAO']), criterio(['MATEMATICA', 'REDACAO'])];
  const rotulo = (codigo: string) =>
    CANONICAS.find((area) => area.codigo === codigo)?.rotulo ?? codigo;

  it('diz o critério e a área que o campo aponta', () => {
    expect(
      recusaAoGravarODesempate(
        { field: 'criterios[1].areas[0]', code: `${PREFIXO}desempate_area_enem_fora_do_quadro` },
        criterios,
        rotulo,
      ),
    ).toBe(
      'Critério de desempate 2: a área Matemática não é comum a todos os grupos da resolução de Peso por Área.',
    );
  });

  it('a área citada por outro critério diz qual é o outro', () => {
    expect(
      recusaAoGravarODesempate(
        { field: 'criterios[1].areas[1]', code: `${PREFIXO}area_enem_citada_por_outro_criterio` },
        criterios,
        rotulo,
      ),
    ).toBe('Critério de desempate 2: a área Redação já é citada pelo critério 1.');
  });

  it('a área repetida no mesmo critério continua "repetida"', () => {
    expect(
      recusaAoGravarODesempate(
        {
          field: 'criterios[0].areas[0]',
          code: 'uniplus.selecao.criterio_desempate.area_repetida',
        },
        criterios,
        rotulo,
      ),
    ).toBe(
      'Critério de desempate 1: a área Redação aparece mais de uma vez na ordem de desempate.',
    );
  });

  it('sem critério no campo, a frase começa pela maiúscula e fala de uma das áreas', () => {
    expect(
      recusaAoGravarODesempate(
        { field: 'criterios', code: `${PREFIXO}area_enem_citada_por_outro_criterio` },
        criterios,
        rotulo,
      ),
    ).toBe('Uma das áreas já é citada por outro critério de desempate.');
  });

  it('devolve null para o code que a tela não explica', () => {
    expect(
      recusaAoGravarODesempate({ field: 'criterios[0]', code: 'outro' }, criterios, rotulo),
    ).toBeNull();
  });
});
