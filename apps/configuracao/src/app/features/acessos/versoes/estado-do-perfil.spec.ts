import { describe, expect, it } from 'vitest';
import {
  acoesDoPerfil,
  resumoDoPerfil,
  situacoesDoPerfil,
  type ResumoDoPerfil,
} from './estado-do-perfil';
import { perfilDoDetalhe } from './perfis.testing';

const EM_VIGOR: ResumoDoPerfil = {
  ativo: true,
  governanca: false,
  temVigente: true,
  temPendente: false,
  emJanelaDeMigracao: false,
  suspensoDesde: null,
  desativadoDesde: null,
  etapasDaRetomadaPorDecidir: [],
};
const GESTAO = { gestaoDeAcessos: true, protecaoDeDados: false };
const textos = (resumo: ResumoDoPerfil): string[] => situacoesDoPerfil(resumo).map((s) => s.texto);

describe('situacoesDoPerfil', () => {
  it('mostra o perfil em vigor', () => {
    expect(textos(EM_VIGOR)).toEqual(['Em vigor']);
  });

  it('soma a versão pendente à situação em vigor', () => {
    expect(textos({ ...EM_VIGOR, temPendente: true })).toEqual(['Em vigor', 'Versão pendente']);
  });

  it('avisa quando o perfil ainda não tem versão em vigor', () => {
    expect(textos({ ...EM_VIGOR, temVigente: false, temPendente: true })).toEqual([
      'Sem versão em vigor',
      'Versão pendente',
    ]);
  });

  it('mostra a janela de migração aberta depois da versão em vigor', () => {
    expect(textos({ ...EM_VIGOR, emJanelaDeMigracao: true })).toEqual([
      'Em vigor',
      'Janela de migração aberta',
    ]);
  });

  it('diz que o perfil está desativado antes das demais situações', () => {
    expect(textos({ ...EM_VIGOR, ativo: false })).toEqual(['Desativado', 'Em vigor']);
  });

  it('distingue o perfil suspenso do desativado e mostra desde quando', () => {
    const suspenso = situacoesDoPerfil({ ...EM_VIGOR, suspensoDesde: '2026-11-09T12:00:00Z' });
    const desativado = situacoesDoPerfil({
      ...EM_VIGOR,
      ativo: false,
      desativadoDesde: '2026-11-08T12:00:00Z',
    });

    expect(suspenso.map((s) => [s.texto, s.variante, s.desde])).toEqual([
      ['Suspenso', 'danger', '2026-11-09T12:00:00Z'],
      ['Em vigor', 'success', undefined],
    ]);
    expect(desativado[0]).toEqual({
      texto: 'Desativado',
      variante: 'neutral',
      desde: '2026-11-08T12:00:00Z',
    });
  });

  it('soma suspenso e desativado quando as duas contenções valem', () => {
    expect(textos({ ...EM_VIGOR, ativo: false, suspensoDesde: '2026-11-09T12:00:00Z' })).toEqual([
      'Suspenso',
      'Desativado',
      'Em vigor',
    ]);
  });

  it('mostra o perfil de governança só como ativo ou desativado', () => {
    const governanca = { ...EM_VIGOR, governanca: true };

    expect(textos(governanca)).toEqual(['Ativo']);
    expect(textos({ ...governanca, ativo: false })).toEqual(['Desativado']);
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
    expect(
      acoesDoPerfil({ ...EM_VIGOR, suspensoDesde: '2026-11-09T12:00:00Z' }, GESTAO).suspender,
    ).toBe(false);
  });

  describe('retomada da suspensão', () => {
    const SUSPENSO = {
      ...EM_VIGOR,
      suspensoDesde: '2026-11-09T12:00:00Z',
      etapasDaRetomadaPorDecidir: ['gestao_de_acessos', 'protecao_de_dados'],
    };
    const AMBAS = { gestaoDeAcessos: true, protecaoDeDados: true };

    it('oferece cada etapa por decidir que a pessoa tem permissão para decidir', () => {
      expect(acoesDoPerfil(SUSPENSO, AMBAS).retomar).toEqual([
        'gestao_de_acessos',
        'protecao_de_dados',
      ]);
      expect(acoesDoPerfil(SUSPENSO, GESTAO).retomar).toEqual(['gestao_de_acessos']);
      expect(
        acoesDoPerfil(SUSPENSO, { gestaoDeAcessos: false, protecaoDeDados: false }).retomar,
      ).toEqual([]);
    });

    it('não oferece a etapa já decidida nem a que o perfil deixou de exigir', () => {
      const soAProtecao = { ...SUSPENSO, etapasDaRetomadaPorDecidir: ['protecao_de_dados'] };

      expect(acoesDoPerfil(soAProtecao, AMBAS).retomar).toEqual(['protecao_de_dados']);
      expect(acoesDoPerfil({ ...SUSPENSO, etapasDaRetomadaPorDecidir: [] }, AMBAS).retomar).toEqual(
        [],
      );
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

      expect(resumoDoPerfil(perfil).etapasDaRetomadaPorDecidir).toEqual(['protecao_de_dados']);
    });
  });

  it('desativado, só se reativa', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, ativo: false }, GESTAO)).toEqual({
      suspender: true,
      retomar: [],
      proporVersao: false,
      removerPermissoes: false,
      cancelarVersaoPendente: false,
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
      desativar: false,
      reativar: false,
    });
  });
});
