import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PerfilListadoDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { PerfisListaComponent } from './perfis-lista.component';

const COMUM: PerfilListadoDto = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  temVersaoVigente: true,
  temVersaoPendente: false,
  suspensao: null,
  desativadoDesde: null,
};
const COM_PENDENTE: PerfilListadoDto = { ...COMUM, id: 'p4', nome: 'Auditoria', temVersaoPendente: true };
const DESATIVADO: PerfilListadoDto = { ...COMUM, id: 'p3', nome: 'Consulta', ativo: false };
const SUSPENSO: PerfilListadoDto = {
  ...COMUM,
  id: 'p5',
  nome: 'Atendimento',
  suspensao: {
    desde: '2026-11-09T15:00:00Z',
    papelDeQuemSuspendeu: 'gestao_de_acessos',
    etapasExigidasAgora: ['gestao_de_acessos'],
    etapasDecididas: [],
  },
};
const GOVERNANCA: PerfilListadoDto = {
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
    perfis?: readonly PerfilListadoDto[];
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
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(PerfisListaComponent);
  });

  it('oferece reativar ou desativar, e nada para o perfil de governança', () => {
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

    expect(botoes().length).toBeGreaterThan(2);
    expect(botoes().every(indisponivel)).toBe(true);
  });

  it('sem escrita nem recarga, os botões estão disponíveis', () => {
    entradas({});

    const dasLinhas = [...raiz().querySelectorAll<HTMLButtonElement>('tbody button')];
    expect(dasLinhas.length).toBe(2);
    expect(dasLinhas.some(indisponivel)).toBe(false);
  });

  it('o título da lista recebe foco programático', () => {
    entradas({});

    expect(raiz().querySelector('#cfg-perfis-titulo')?.getAttribute('tabindex')).toBe('-1');
  });

  it('emite o perfil da linha ao alternar a situação', () => {
    entradas({});
    const alternados: PerfilListadoDto[] = [];
    fixture.componentInstance.alternarAtivacao.subscribe((perfil) => alternados.push(perfil));

    raiz()
      .querySelector<HTMLButtonElement>('button[aria-label="Reativar o perfil Consulta"]')
      ?.click();

    expect(alternados).toEqual([DESATIVADO]);
  });

  it('leva o nome do perfil ao detalhe dele', () => {
    entradas({});

    const ligacao = raiz().querySelector<HTMLAnchorElement>('tr[data-perfil-id="p1"] a');
    expect(ligacao?.getAttribute('href')).toBe('/acessos/perfis/p1');
  });

  it('mostra as situações do perfil: em vigor, versão pendente, desativado e governança', () => {
    entradas({ perfis: [COMUM, COM_PENDENTE, DESATIVADO, GOVERNANCA] });

    const situacao = (id: string): string =>
      raiz().querySelector(`tr[data-perfil-id="${id}"] td[data-label="Situação"]`)?.textContent ?? '';
    expect(situacao('p1')).toContain('Em vigor');
    expect(situacao('p4')).toContain('Versão pendente');
    expect(situacao('p3')).toContain('Desativado');
    expect(situacao('p2')).toContain('Ativo');
  });

  it('sem perfis, convida a criar o primeiro; com falha de carga, não afirma que está vazio', () => {
    entradas({ perfis: [], temProximo: false });
    expect(raiz().textContent).toContain('Nenhum perfil');

    entradas({ perfis: [], temProximo: false, erro: 'Falhou.' });
    expect(raiz().textContent).not.toContain('Nenhum perfil');
  });

  it('mostra o perfil suspenso e o desativado com situações distintas e desde quando', () => {
    entradas({
      perfis: [
        SUSPENSO,
        { ...DESATIVADO, desativadoDesde: '2026-11-08T15:00:00Z' },
      ],
    });

    const linhas = [...raiz().querySelectorAll('tr[data-perfil-id]')];
    expect(linhas[0]?.querySelector('[data-label="Situação"]')?.textContent).toContain('Suspenso');
    expect(linhas[0]?.querySelector('[data-label="Situação"]')?.textContent).toContain(
      'desde 09/11/2026',
    );
    expect(linhas[1]?.querySelector('[data-label="Situação"]')?.textContent).toContain('Desativado');
    expect(linhas[1]?.querySelector('[data-label="Situação"]')?.textContent).toContain(
      'desde 08/11/2026',
    );
    expect(linhas[1]?.querySelector('[data-label="Situação"]')?.textContent).not.toContain(
      'Suspenso',
    );
  });
});
