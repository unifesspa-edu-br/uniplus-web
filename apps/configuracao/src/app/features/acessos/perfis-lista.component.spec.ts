import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { PerfisListaComponent } from './perfis-lista.component';

const COMUM: PerfilDto = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  permissoes: [],
};
const DESATIVADO: PerfilDto = { ...COMUM, id: 'p3', nome: 'Consulta', ativo: false };
const GOVERNANCA: PerfilDto = {
  ...COMUM,
  id: 'p2',
  nome: 'Gestor de acessos',
  governanca: 'gestor',
};

describe('PerfisListaComponent', () => {
  let fixture: ComponentFixture<PerfisListaComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];

  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';

  function entradas(parcial: {
    perfis?: readonly PerfilDto[];
    carregando?: boolean;
    gravando?: boolean;
    erro?: string | null;
    temProximo?: boolean;
  }): void {
    fixture.componentRef.setInput('perfis', parcial.perfis ?? [COMUM, DESATIVADO, GOVERNANCA]);
    fixture.componentRef.setInput('carregando', parcial.carregando ?? false);
    fixture.componentRef.setInput('gravando', parcial.gravando ?? false);
    fixture.componentRef.setInput('erro', parcial.erro ?? null);
    fixture.componentRef.setInput('temAnterior', false);
    fixture.componentRef.setInput('temProximo', parcial.temProximo ?? true);
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(PerfisListaComponent);
  });

  it('oferece editar e reativar ou desativar, e nada para o perfil de governança', () => {
    entradas({});

    expect(
      raiz().querySelector('button[aria-label="Desativar o perfil Operador de inscrições"]'),
    ).not.toBeNull();
    expect(raiz().querySelector('button[aria-label="Reativar o perfil Consulta"]')).not.toBeNull();
    expect(raiz().querySelector('tr[data-perfil-id="p2"] button')).toBeNull();
    expect(raiz().textContent).toContain('Governança');
  });

  it.each([
    ['uma escrita em curso', { gravando: true }],
    ['a recarga da lista', { carregando: true }],
  ])('com %s, todo botão fica indisponível, inclusive a paginação', (_, estado) => {
    entradas(estado);

    expect(botoes().length).toBeGreaterThan(4);
    expect(botoes().every(indisponivel)).toBe(true);
  });

  it('sem escrita nem recarga, os botões estão disponíveis', () => {
    entradas({});

    const dasLinhas = [...raiz().querySelectorAll<HTMLButtonElement>('tbody button')];
    expect(dasLinhas.length).toBe(4);
    expect(dasLinhas.some(indisponivel)).toBe(false);
  });

  it('o título da lista recebe foco programático', () => {
    entradas({});

    expect(raiz().querySelector('#cfg-perfis-titulo')?.getAttribute('tabindex')).toBe('-1');
  });

  it('emite o perfil da linha ao editar e ao alternar a situação', () => {
    entradas({});
    const editados: PerfilDto[] = [];
    const alternados: PerfilDto[] = [];
    fixture.componentInstance.editar.subscribe((perfil) => editados.push(perfil));
    fixture.componentInstance.alternarAtivacao.subscribe((perfil) => alternados.push(perfil));

    raiz()
      .querySelector<HTMLButtonElement>('button[aria-label="Editar o perfil Consulta"]')
      ?.click();
    raiz()
      .querySelector<HTMLButtonElement>('button[aria-label="Reativar o perfil Consulta"]')
      ?.click();

    expect(editados).toEqual([DESATIVADO]);
    expect(alternados).toEqual([DESATIVADO]);
  });

  it('sem perfis, convida a criar o primeiro; com falha de carga, não afirma que está vazio', () => {
    entradas({ perfis: [], temProximo: false });
    expect(raiz().textContent).toContain('Nenhum perfil');

    entradas({ perfis: [], temProximo: false, erro: 'Falhou.' });
    expect(raiz().textContent).not.toContain('Nenhum perfil');
  });
});
