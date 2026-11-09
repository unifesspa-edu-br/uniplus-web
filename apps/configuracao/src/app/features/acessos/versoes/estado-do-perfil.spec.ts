import { describe, expect, it } from 'vitest';
import { acoesDoPerfil, situacoesDoPerfil, type ResumoDoPerfil } from './estado-do-perfil';

const EM_VIGOR: ResumoDoPerfil = { ativo: true, governanca: false, temVigente: true, temPendente: false };
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

  it('diz que o perfil está desativado antes das demais situações', () => {
    expect(textos({ ...EM_VIGOR, ativo: false })).toEqual(['Desativado', 'Em vigor']);
  });

  it('mostra o perfil de governança só como ativo ou desativado', () => {
    const governanca = { ...EM_VIGOR, governanca: true };

    expect(textos(governanca)).toEqual(['Ativo']);
    expect(textos({ ...governanca, ativo: false })).toEqual(['Desativado']);
  });
});

describe('acoesDoPerfil', () => {
  it('oferece propor, remover e desativar ao perfil em vigor', () => {
    expect(acoesDoPerfil(EM_VIGOR)).toEqual({
      proporVersao: true,
      removerPermissoes: true,
      cancelarVersaoPendente: false,
      desativar: true,
      reativar: false,
    });
  });

  it('com versão pendente, oferece cancelá-la e não propõe outra', () => {
    const acoes = acoesDoPerfil({ ...EM_VIGOR, temPendente: true });

    expect(acoes.cancelarVersaoPendente).toBe(true);
    expect(acoes.proporVersao).toBe(false);
  });

  it('sem versão em vigor, não há o que remover', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, temVigente: false }).removerPermissoes).toBe(false);
  });

  it('desativado, só se reativa', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, ativo: false })).toEqual({
      proporVersao: false,
      removerPermissoes: false,
      cancelarVersaoPendente: false,
      desativar: false,
      reativar: true,
    });
  });

  it('o perfil de governança não tem nenhuma ação de versão ou de situação', () => {
    expect(acoesDoPerfil({ ...EM_VIGOR, governanca: true })).toEqual({
      proporVersao: false,
      removerPermissoes: false,
      cancelarVersaoPendente: false,
      desativar: false,
      reativar: false,
    });
  });
});
