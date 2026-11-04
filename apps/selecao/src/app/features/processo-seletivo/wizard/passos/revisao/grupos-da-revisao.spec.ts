import { ItemConformidadeDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { agruparPorDimensao, comoGruposDaRevisao, rotuloDaDimensao } from './grupos-da-revisao';

describe('agruparPorDimensao', () => {
  it('agrupa preservando a ordem de primeira aparição e marca ok só quando TODOS os itens do grupo são ok', () => {
    const itens: ItemConformidadeDto[] = [
      { codigo: 'a', dimensao: 'taxa_inscricao', mensagem: 'x', ok: true },
      { codigo: 'b', dimensao: 'classificacao', mensagem: 'y', ok: false },
      { codigo: 'c', dimensao: 'taxa_inscricao', mensagem: 'z', ok: false },
    ];

    const grupos = agruparPorDimensao(itens);

    expect(grupos.map((g) => g.dimensao)).toEqual(['taxa_inscricao', 'classificacao']);
    expect(grupos[0].ok).toBe(false);
    expect(grupos[0].itens).toHaveLength(2);
    expect(grupos[1].ok).toBe(false);
  });

  it('grupo com todos os itens ok fica ok', () => {
    const itens: ItemConformidadeDto[] = [
      { codigo: 'a', dimensao: 'cronograma', mensagem: 'x', ok: true },
      { codigo: 'b', dimensao: 'cronograma', mensagem: 'y', ok: true },
    ];

    expect(agruparPorDimensao(itens)[0].ok).toBe(true);
  });
});

describe('rotuloDaDimensao', () => {
  it.each([
    ['identificacao', 'Identificação'],
    ['taxa_inscricao', 'Taxa de inscrição'],
    ['distribuicao_vagas', 'Distribuição de vagas'],
    ['cascata_remanejamento', 'Cascata de remanejamento'],
    ['cronograma', 'Cronograma'],
    ['exigencias_documentais', 'Exigências documentais'],
    ['contagem_de_prazos', 'Contagem de prazos'],
    ['classificacao', 'Classificação'],
    ['atendimento_especializado', 'Atendimento especializado'],
    ['coleta_de_fatos', 'Coleta de fatos'],
  ])('nomeia a dimensão %s em pt-BR, com acento', (dimensao, rotulo) => {
    expect(rotuloDaDimensao(dimensao)).toBe(rotulo);
  });

  it('mostra a dimensão ainda desconhecida pela grafia do código, sem sublinhado', () => {
    expect(rotuloDaDimensao('dimensao_nova')).toBe('Dimensao nova');
  });

  /** O código vem do servidor: uma chave herdada de objeto não pode passar por dimensão conhecida. */
  it('não trata como conhecida uma dimensão que coincide com propriedade herdada', () => {
    expect(rotuloDaDimensao('constructor')).toBe('Constructor');
  });
});

describe('comoGruposDaRevisao', () => {
  const pendentes = comoGruposDaRevisao(
    agruparPorDimensao([
      {
        codigo: 'distribuicao_vagas_ausente',
        dimensao: 'distribuicao_vagas',
        mensagem: 'Distribuição',
        ok: false,
      },
      {
        codigo: 'distribuicao_vagas_oferta_sem_grupo_area_enem',
        dimensao: 'distribuicao_vagas',
        mensagem: 'Grupo',
        ok: false,
      },
      {
        codigo: 'calendario_vigente_ausente',
        dimensao: 'contagem_de_prazos',
        mensagem: 'Calendário',
        ok: false,
      },
    ]),
  );
  const item = (codigo: string) =>
    pendentes.flatMap((grupo) => grupo.itens).find((candidato) => candidato.codigo === codigo);

  it('identifica a mensagem e a orientação de cada item pelo código', () => {
    const oferta = item('distribuicao_vagas_oferta_sem_grupo_area_enem');

    expect(oferta?.idDaMensagem).toBe(
      'rev-item-distribuicao_vagas_oferta_sem_grupo_area_enem-mensagem',
    );
    expect(oferta?.orientacao?.id).toBe(
      'rev-item-distribuicao_vagas_oferta_sem_grupo_area_enem-orientacao',
    );
    expect(item('distribuicao_vagas_ausente')?.orientacao).toBeNull();
  });

  it('item sem passo mostra só a orientação', () => {
    expect(item('calendario_vigente_ausente')?.passo).toBeNull();
    expect(item('calendario_vigente_ausente')?.orientacao?.texto).toContain('Configuração');
  });

  it('item conforme não mostra orientação nem botão', () => {
    const [grupo] = comoGruposDaRevisao(
      agruparPorDimensao([
        {
          codigo: 'calendario_vigente_ausente',
          dimensao: 'contagem_de_prazos',
          mensagem: 'x',
          ok: true,
        },
      ]),
    );
    expect(grupo.itens[0]).toMatchObject({ orientacao: null, passo: null });
  });
});
