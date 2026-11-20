import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EtiquetaDoPerfil } from './estado-do-perfil';
import {
  ACESSO_EM_VIGOR,
  ACESSO_SEM_VERSAO_EM_VIGOR,
  ACESSO_SUSPENSO,
} from './situacao-do-acesso.testing';
import { SituacaoDoPerfilComponent } from './situacao-do-perfil.component';

const SUSPENSO_DESDE = '2026-11-10T11:00:00Z';
const DESATIVADO: EtiquetaDoPerfil = {
  texto: 'Desativado',
  variante: 'neutral',
  desde: '2026-11-08T15:00:00Z',
};
const JANELA_ABERTA: EtiquetaDoPerfil = { texto: 'Janela de migração aberta', variante: 'warning' };

interface Entradas {
  readonly situacaoDoAcesso?: { readonly codigo: string; readonly rotulo: string };
  readonly suspensoDesde?: string | null;
  readonly etiquetas?: readonly EtiquetaDoPerfil[];
  readonly versaoPendente?: boolean;
}

describe('SituacaoDoPerfilComponent', () => {
  let fixture: ComponentFixture<SituacaoDoPerfilComponent>;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const textoDaSituacao = (): string => (raiz().textContent ?? '').replace(/\s+/g, ' ').trim();
  const situacaoDoAcesso = (): HTMLElement => {
    const embrulho = raiz().querySelector<HTMLElement>(':scope > span');
    if (embrulho === null) throw new Error('situação do acesso ausente');
    return embrulho;
  };
  const variantes = (): (string | undefined)[] =>
    [...raiz().querySelectorAll('.tag')].map((etiqueta) =>
      [...etiqueta.classList].find((classe) => classe.startsWith('tag--')),
    );

  function mostrar(entradas: Entradas = {}): void {
    fixture.componentRef.setInput('situacaoDoAcesso', entradas.situacaoDoAcesso ?? ACESSO_EM_VIGOR);
    fixture.componentRef.setInput('suspensoDesde', entradas.suspensoDesde ?? null);
    fixture.componentRef.setInput('etiquetas', entradas.etiquetas ?? []);
    fixture.componentRef.setInput('versaoPendente', entradas.versaoPendente ?? false);
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(SituacaoDoPerfilComponent);
  });

  it('mostra só o rótulo que a API devolveu para a situação do acesso, sem data', () => {
    mostrar({ situacaoDoAcesso: { ...ACESSO_EM_VIGOR, rotulo: 'Valendo' } });

    expect(textoDaSituacao()).toBe('Valendo');
    expect(raiz().querySelector('.cfg-muted')).toBeNull();
  });

  it.each([
    { acesso: ACESSO_SUSPENSO, variante: 'tag--danger' },
    { acesso: ACESSO_EM_VIGOR, variante: 'tag--success' },
    { acesso: ACESSO_SEM_VERSAO_EM_VIGOR, variante: 'tag--warning' },
  ])(
    'a situação "$acesso.rotulo" tem a cor $variante, pelo código dela',
    ({ acesso, variante }) => {
      mostrar({ situacaoDoAcesso: acesso });

      expect(variantes()).toEqual([variante]);
    },
  );

  it('a situação que o web ainda não conhece aparece em cor neutra, com o rótulo da API', () => {
    mostrar({ situacaoDoAcesso: { codigo: 'em_revisao', rotulo: 'Em revisão' } });

    expect(textoDaSituacao()).toBe('Em revisão');
    expect(variantes()).toEqual(['tag--neutral']);
  });

  it('com suspensão, o rótulo e o "desde" são partes separadas por espaço', () => {
    mostrar({ situacaoDoAcesso: ACESSO_SUSPENSO, suspensoDesde: SUSPENSO_DESDE });

    const embrulho = situacaoDoAcesso();
    expect(embrulho.textContent).toBe(`${ACESSO_SUSPENSO.rotulo} desde 10/11/2026, 08:00`);
    expect(embrulho.querySelector('.tag')?.textContent?.trim()).toBe(ACESSO_SUSPENSO.rotulo);
    expect(embrulho.querySelector('.cfg-muted')?.textContent).toBe('desde 10/11/2026, 08:00');
  });

  it('depois da situação do acesso vêm as etiquetas do web, cada uma com o desde dela, e a versão pendente', () => {
    mostrar({
      situacaoDoAcesso: ACESSO_SUSPENSO,
      suspensoDesde: SUSPENSO_DESDE,
      etiquetas: [DESATIVADO, JANELA_ABERTA],
      versaoPendente: true,
    });

    expect(textoDaSituacao()).toBe(
      `${ACESSO_SUSPENSO.rotulo} desde 10/11/2026, 08:00 Desativado desde 08/11/2026, 12:00 ` +
        `${JANELA_ABERTA.texto} Versão pendente`,
    );
  });

  it('as etiquetas do web mantêm a variante que receberam', () => {
    mostrar({ etiquetas: [DESATIVADO, JANELA_ABERTA] });

    expect(variantes()).toEqual(['tag--success', 'tag--neutral', 'tag--warning']);
  });

  it('a versão pendente é texto auxiliar, não etiqueta', () => {
    mostrar({ versaoPendente: true });

    expect(variantes()).toEqual(['tag--success']);
    expect(textoDaSituacao()).toBe(`${ACESSO_EM_VIGOR.rotulo} Versão pendente`);
  });

  it('as etiquetas são estáticas: nada se anuncia como aviso', () => {
    mostrar({
      situacaoDoAcesso: ACESSO_SUSPENSO,
      suspensoDesde: SUSPENSO_DESDE,
      etiquetas: [DESATIVADO, JANELA_ABERTA],
      versaoPendente: true,
    });

    expect(raiz().querySelector('[role], [aria-live]')).toBeNull();
  });
});
