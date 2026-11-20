import { describe, expect, it } from 'vitest';
import {
  acoesDoPerfil,
  etiquetasDoDetalhe,
  etiquetasDoPerfil,
  resumoDaLista,
  resumoDoDetalhe,
  type EtiquetaDoPerfil,
  type ResumoDoDetalheDoPerfil,
} from './estado-do-perfil';
import { perfilDoDetalhe } from './perfis.testing';
import {
  ACESSO_EM_VIGOR,
  ACESSO_SEM_VERSAO_EM_VIGOR,
  ACESSO_SUSPENSO,
} from './situacao-do-acesso.testing';

const EM_VIGOR: ResumoDoDetalheDoPerfil = {
  ativo: true,
  governanca: false,
  situacaoDoAcesso: ACESSO_EM_VIGOR,
  temVigente: true,
  temPendente: false,
  emJanelaDeMigracao: false,
  suspensoDesde: null,
  desativadoDesde: null,
  etapasDaRetomadaPorDecidir: [],
};
const SUSPENSO_DESDE = '2026-11-09T12:00:00Z';
const DESATIVADO_DESDE = '2026-11-08T12:00:00Z';
const SUSPENSO = { ...EM_VIGOR, situacaoDoAcesso: ACESSO_SUSPENSO, suspensoDesde: SUSPENSO_DESDE };
const GESTAO = { gestaoDeAcessos: true, protecaoDeDados: false };
const textos = (etiquetas: readonly EtiquetaDoPerfil[]): string[] => etiquetas.map((e) => e.texto);

describe('etiquetasDoPerfil', () => {
  it('perfil ativo em vigor mostra só a situação do acesso, sem data', () => {
    expect(etiquetasDoPerfil(EM_VIGOR)).toEqual([
      { texto: ACESSO_EM_VIGOR.rotulo, variante: 'success' },
    ]);
  });

  it('perfil ativo sem versão em vigor mostra só a situação do acesso, sem data', () => {
    const semVersao = { ...EM_VIGOR, situacaoDoAcesso: ACESSO_SEM_VERSAO_EM_VIGOR };

    expect(etiquetasDoPerfil(semVersao)).toEqual([
      { texto: ACESSO_SEM_VERSAO_EM_VIGOR.rotulo, variante: 'warning' },
    ]);
  });

  it('perfil suspenso mostra o rótulo da API com a data da suspensão', () => {
    expect(etiquetasDoPerfil(SUSPENSO)).toEqual([
      { texto: ACESSO_SUSPENSO.rotulo, variante: 'danger', desde: SUSPENSO_DESDE },
    ]);
  });

  it('perfil só desativado continua em vigor e mostra a desativação à parte', () => {
    const desativado = { ...EM_VIGOR, ativo: false, desativadoDesde: DESATIVADO_DESDE };

    expect(etiquetasDoPerfil(desativado)).toEqual([
      { texto: ACESSO_EM_VIGOR.rotulo, variante: 'success' },
      { texto: 'Desativado', variante: 'neutral', desde: DESATIVADO_DESDE },
    ]);
  });

  it('perfil suspenso e desativado mostra as duas situações e não mostra em vigor', () => {
    const ambos = { ...SUSPENSO, ativo: false, desativadoDesde: DESATIVADO_DESDE };

    expect(etiquetasDoPerfil(ambos)).toEqual([
      { texto: ACESSO_SUSPENSO.rotulo, variante: 'danger', desde: SUSPENSO_DESDE },
      { texto: 'Desativado', variante: 'neutral', desde: DESATIVADO_DESDE },
    ]);
  });

  it('perfil desativado sem a data da desativação mostra só o texto', () => {
    expect(etiquetasDoPerfil({ ...EM_VIGOR, ativo: false }).at(-1)).toEqual({
      texto: 'Desativado',
      variante: 'neutral',
    });
  });

  it('o texto da situação do acesso é o rótulo que a API devolveu', () => {
    const acesso = { ...ACESSO_EM_VIGOR, rotulo: 'Valendo' };

    expect(textos(etiquetasDoPerfil({ ...EM_VIGOR, situacaoDoAcesso: acesso }))).toEqual([
      'Valendo',
    ]);
  });

  it('o perfil de governança mostra a situação do acesso como os demais, sem Ativo', () => {
    expect(textos(etiquetasDoPerfil({ ...EM_VIGOR, governanca: true }))).toEqual([
      ACESSO_EM_VIGOR.rotulo,
    ]);
  });

  it('a versão pendente não vira etiqueta', () => {
    expect(textos(etiquetasDoPerfil({ ...EM_VIGOR, temPendente: true }))).toEqual([
      ACESSO_EM_VIGOR.rotulo,
    ]);
  });
});

describe('etiquetasDoDetalhe', () => {
  it('mostra as mesmas etiquetas da lista quando não há janela de migração', () => {
    expect(etiquetasDoDetalhe(SUSPENSO)).toEqual(etiquetasDoPerfil(SUSPENSO));
  });

  it('mostra a janela de migração aberta depois da situação do acesso', () => {
    expect(textos(etiquetasDoDetalhe({ ...EM_VIGOR, emJanelaDeMigracao: true }))).toEqual([
      ACESSO_EM_VIGOR.rotulo,
      'Janela de migração aberta',
    ]);
  });
});

describe('acoesDoPerfil', () => {
  it('oferece propor, remover e desativar ao perfil em vigor', () => {
    expect(acoesDoPerfil(EM_VIGOR, GESTAO)).toEqual({
      suspender: true,
      retomar: [],
      proporVersao: true,
      removerPermissoes: true,
      cancelarVersaoPendente: false,
      enviarDocumento: false,
      desativar: true,
      reativar: false,
    });
  });

  it('com versão pendente, oferece cancelá-la e não propõe outra', () => {
    const acoes = acoesDoPerfil({ ...EM_VIGOR, temPendente: true }, GESTAO);

    expect(acoes.cancelarVersaoPendente).toBe(true);
    expect(acoes.proporVersao).toBe(false);
  });

  it('com a janela de migração aberta, não propõe versão nova mas segue aceitando a remoção', () => {
    const acoes = acoesDoPerfil({ ...EM_VIGOR, emJanelaDeMigracao: true }, GESTAO);

    expect(acoes.proporVersao).toBe(false);
    expect(acoes.removerPermissoes).toBe(true);
  });

  it('sem versão em vigor, não há o que remover', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, temVigente: false }, GESTAO).removerPermissoes).toBe(false);
  });

  it('sem a permissão da gestão de acessos, não desativa nem reativa', () => {
    const sem = { gestaoDeAcessos: false, protecaoDeDados: true };

    expect(acoesDoPerfil(EM_VIGOR, sem).desativar).toBe(false);
    expect(acoesDoPerfil({ ...EM_VIGOR, ativo: false }, sem).reativar).toBe(false);
  });

  it('suspende quem tem a permissão da gestão de acessos ou a da proteção de dados', () => {
    const protecao = { gestaoDeAcessos: false, protecaoDeDados: true };
    const nenhuma = { gestaoDeAcessos: false, protecaoDeDados: false };

    expect(acoesDoPerfil(EM_VIGOR, protecao).suspender).toBe(true);
    expect(acoesDoPerfil(EM_VIGOR, nenhuma).suspender).toBe(false);
  });

  it('o perfil já suspenso não se suspende de novo', () => {
    expect(acoesDoPerfil(SUSPENSO, GESTAO).suspender).toBe(false);
  });

  describe('retomada da suspensão', () => {
    const SUSPENSO_A_RETOMAR = {
      ...SUSPENSO,
      etapasDaRetomadaPorDecidir: ['gestao_de_acessos', 'protecao_de_dados'],
    };
    const AMBAS = { gestaoDeAcessos: true, protecaoDeDados: true };

    it('oferece cada etapa por decidir que a pessoa tem permissão para decidir', () => {
      expect(acoesDoPerfil(SUSPENSO_A_RETOMAR, AMBAS).retomar).toEqual([
        'gestao_de_acessos',
        'protecao_de_dados',
      ]);
      expect(acoesDoPerfil(SUSPENSO_A_RETOMAR, GESTAO).retomar).toEqual(['gestao_de_acessos']);
      expect(
        acoesDoPerfil(SUSPENSO_A_RETOMAR, { gestaoDeAcessos: false, protecaoDeDados: false })
          .retomar,
      ).toEqual([]);
    });

    it('não oferece a etapa já decidida nem a que o perfil deixou de exigir', () => {
      const soAProtecao = {
        ...SUSPENSO_A_RETOMAR,
        etapasDaRetomadaPorDecidir: ['protecao_de_dados'],
      };

      expect(acoesDoPerfil(soAProtecao, AMBAS).retomar).toEqual(['protecao_de_dados']);
      expect(
        acoesDoPerfil({ ...SUSPENSO_A_RETOMAR, etapasDaRetomadaPorDecidir: [] }, AMBAS).retomar,
      ).toEqual([]);
    });

    it('lê as etapas por decidir do que a suspensão exige agora e já decidiu', () => {
      const perfil = perfilDoDetalhe({
        suspensao: {
          desde: '2026-11-09T12:00:00Z',
          papelDeQuemSuspendeu: 'gestao_de_acessos',
          etapasExigidasAgora: ['gestao_de_acessos', 'protecao_de_dados'],
          etapasDecididas: ['gestao_de_acessos'],
        },
      });

      expect(resumoDoDetalhe(perfil).etapasDaRetomadaPorDecidir).toEqual(['protecao_de_dados']);
    });
  });

  it('desativado, só se reativa', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, ativo: false }, GESTAO)).toEqual({
      suspender: true,
      retomar: [],
      proporVersao: false,
      removerPermissoes: false,
      cancelarVersaoPendente: false,
      enviarDocumento: false,
      desativar: false,
      reativar: true,
    });
  });

  it('o perfil de governança não tem nenhuma ação de versão ou de situação', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, governanca: true }, GESTAO)).toEqual({
      suspender: false,
      retomar: [],
      proporVersao: false,
      removerPermissoes: false,
      cancelarVersaoPendente: false,
      enviarDocumento: false,
      desativar: false,
      reativar: false,
    });
  });
});

describe('resumo da lista e do detalhe', () => {
  it('a lista não informa a janela de migração, que só o detalhe conhece', () => {
    const listado = {
      ...perfilDoDetalhe(),
      temVersaoVigente: true,
      temVersaoPendente: false,
    };

    expect('emJanelaDeMigracao' in resumoDaLista(listado)).toBe(false);
  });

  it('o detalhe informa se há janela de migração', () => {
    const janela = { id: 'j1', terminaEm: '2026-11-12T12:00:00Z', situacao: 'aberta' };

    expect(
      resumoDoDetalhe(perfilDoDetalhe({ revisaoDasConcessoes: janela })).emJanelaDeMigracao,
    ).toBe(true);
    expect(
      resumoDoDetalhe(perfilDoDetalhe({ revisaoDasConcessoes: null })).emJanelaDeMigracao,
    ).toBe(false);
  });

  it('a lista resume a versão pendente e a situação do acesso que a API devolve', () => {
    const listado = {
      ...perfilDoDetalhe(),
      situacaoDoAcesso: ACESSO_SUSPENSO,
      temVersaoPendente: true,
    };

    const resumo = resumoDaLista(listado);

    expect([resumo.temPendente, resumo.situacaoDoAcesso]).toEqual([true, ACESSO_SUSPENSO]);
  });

  it('a lista não calcula a vigência: o resumo dela não traz versão em vigor', () => {
    const listado = { ...perfilDoDetalhe(), temVersaoPendente: false };

    expect('temVigente' in resumoDaLista(listado)).toBe(false);
  });

  it('o detalhe sabe se há versão em vigor pela composição em vigor', () => {
    expect(resumoDoDetalhe(perfilDoDetalhe()).temVigente).toBe(true);
    expect(resumoDoDetalhe(perfilDoDetalhe({ composicaoEmVigor: null })).temVigente).toBe(false);
  });

  it('a lista e o detalhe do mesmo perfil mostram as mesmas etiquetas', () => {
    const suspensao = {
      desde: SUSPENSO_DESDE,
      papelDeQuemSuspendeu: 'gestao_de_acessos',
      etapasExigidasAgora: ['gestao_de_acessos'],
      etapasDecididas: [],
    };
    const detalhe = perfilDoDetalhe({
      situacaoDoAcesso: ACESSO_SUSPENSO,
      suspensao,
      ativo: false,
      desativadoDesde: DESATIVADO_DESDE,
    });
    const listado = { ...detalhe, temVersaoPendente: false };

    expect(etiquetasDoPerfil(resumoDaLista(listado))).toEqual(
      etiquetasDoDetalhe(resumoDoDetalhe(detalhe)),
    );
  });
});
