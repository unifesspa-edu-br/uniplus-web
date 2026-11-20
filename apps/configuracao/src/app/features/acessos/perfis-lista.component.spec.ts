import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PerfilListadoDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { PerfisListaComponent } from './perfis-lista.component';
import {
  ACESSO_EM_VIGOR,
  ACESSO_SEM_VERSAO_EM_VIGOR,
  ACESSO_SUSPENSO,
} from './versoes/situacao-do-acesso.testing';

const COMUM: PerfilListadoDto = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  situacaoDoAcesso: ACESSO_EM_VIGOR,
  temVersaoPendente: false,
  suspensao: null,
  desativadoDesde: null,
};
const COM_PENDENTE: PerfilListadoDto = {
  ...COMUM,
  id: 'p4',
  nome: 'Auditoria',
  temVersaoPendente: true,
};
const DESATIVADO: PerfilListadoDto = { ...COMUM, id: 'p3', nome: 'Consulta', ativo: false };
const SUSPENSO: PerfilListadoDto = {
  ...COMUM,
  id: 'p5',
  nome: 'Atendimento',
  situacaoDoAcesso: ACESSO_SUSPENSO,
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

  it('com uma escrita em curso ou a recarga da lista, a paginação fica indisponível', () => {
    entradas({ gravando: true });
    expect(botoes().length).toBeGreaterThan(0);
    expect(botoes().every(indisponivel)).toBe(true);
  });

  it('a linha não traz botão de ação: desativar e reativar são do detalhe do perfil', () => {
    entradas({});

    expect(raiz().querySelector('tbody button')).toBeNull();
    expect(raiz().textContent).toContain('Governança');
  });

  it('o título da lista recebe foco programático', () => {
    entradas({});

    expect(raiz().querySelector('#cfg-perfis-titulo')?.getAttribute('tabindex')).toBe('-1');
  });

  it('leva o nome do perfil ao detalhe dele', () => {
    entradas({});

    const ligacao = raiz().querySelector<HTMLAnchorElement>('tr[data-perfil-id="p1"] a');
    expect(ligacao?.getAttribute('href')).toBe('/acessos/perfis/p1');
  });

  it('sem perfis, convida a criar o primeiro; com falha de carga, não afirma que está vazio', () => {
    entradas({ perfis: [], temProximo: false });
    expect(raiz().textContent).toContain('Nenhum perfil');

    entradas({ perfis: [], temProximo: false, erro: 'Falhou.' });
    expect(raiz().textContent).not.toContain('Nenhum perfil');
  });

  describe('situação do perfil', () => {
    const celula = (id: string): HTMLElement => {
      const encontrada = raiz().querySelector<HTMLElement>(
        `tr[data-perfil-id="${id}"] td[data-label="Situação"]`,
      );
      if (encontrada === null) throw new Error(`linha ${id} ausente`);
      return encontrada;
    };
    const situacao = (id: string): string =>
      (celula(id).textContent ?? '').replace(/\s+/g, ' ').trim();
    const etiquetas = (id: string): string[] =>
      [...celula(id).querySelectorAll('ui-tag')].map((tag) => tag.textContent?.trim() ?? '');
    const SUSPENSO_DESDE = 'desde 09/11/2026, 12:00';
    const DESATIVADO_DESDE = '2026-11-08T15:00:00Z';
    const desativado = (perfil: PerfilListadoDto): PerfilListadoDto => ({
      ...perfil,
      ativo: false,
      desativadoDesde: DESATIVADO_DESDE,
    });

    it('perfil ativo em vigor mostra só o rótulo da situação, sem data', () => {
      entradas({ perfis: [COMUM] });

      expect(situacao('p1')).toBe(ACESSO_EM_VIGOR.rotulo);
    });

    it('perfil ativo sem versão em vigor mostra só o rótulo da situação, sem data', () => {
      const semVersao = { ...COMUM, situacaoDoAcesso: ACESSO_SEM_VERSAO_EM_VIGOR };
      entradas({ perfis: [semVersao] });

      expect(situacao('p1')).toBe(ACESSO_SEM_VERSAO_EM_VIGOR.rotulo);
    });

    it('perfil ativo e suspenso mostra o rótulo com a data da suspensão', () => {
      entradas({ perfis: [SUSPENSO] });

      expect(situacao('p5')).toBe(`${ACESSO_SUSPENSO.rotulo} ${SUSPENSO_DESDE}`);
    });

    it('perfil só desativado continua em vigor e mostra a desativação com a data', () => {
      entradas({ perfis: [desativado(COMUM)] });

      expect(situacao('p1')).toBe(`${ACESSO_EM_VIGOR.rotulo} Desativado desde 08/11/2026, 12:00`);
    });

    it('perfil sem versão em vigor e desativado mostra as duas situações', () => {
      const semVersao = { ...COMUM, situacaoDoAcesso: ACESSO_SEM_VERSAO_EM_VIGOR };
      entradas({ perfis: [desativado(semVersao)] });

      expect(situacao('p1')).toBe(
        `${ACESSO_SEM_VERSAO_EM_VIGOR.rotulo} Desativado desde 08/11/2026, 12:00`,
      );
    });

    it('perfil suspenso e desativado mostra cada data junto da etiqueta dela', () => {
      entradas({ perfis: [desativado(SUSPENSO)] });

      expect(situacao('p5')).toBe(
        `${ACESSO_SUSPENSO.rotulo} ${SUSPENSO_DESDE} Desativado desde 08/11/2026, 12:00`,
      );
      expect(situacao('p5')).not.toContain(ACESSO_EM_VIGOR.rotulo);
    });

    it('perfil de governança mostra só a situação do acesso, sem Ativo nem Desativado', () => {
      entradas({ perfis: [GOVERNANCA] });

      expect(situacao('p2')).toBe(ACESSO_EM_VIGOR.rotulo);
    });

    it('versão pendente aparece depois das etiquetas, como texto auxiliar', () => {
      entradas({ perfis: [COM_PENDENTE] });

      expect(etiquetas('p4')).toEqual([ACESSO_EM_VIGOR.rotulo]);
      expect(situacao('p4')).toBe(`${ACESSO_EM_VIGOR.rotulo} Versão pendente`);
    });

    it('perfil desativado e com versão pendente mantém cada texto separado', () => {
      entradas({ perfis: [desativado(COM_PENDENTE)] });

      expect(situacao('p4')).toBe(
        `${ACESSO_EM_VIGOR.rotulo} Desativado desde 08/11/2026, 12:00 Versão pendente`,
      );
    });

    it('o texto da etiqueta é o rótulo que a API devolve, ainda que diferente do usual', () => {
      const acesso = { ...ACESSO_EM_VIGOR, rotulo: 'Valendo' };
      entradas({ perfis: [{ ...COMUM, situacaoDoAcesso: acesso }] });

      expect(situacao('p1')).toBe('Valendo');
    });

    it('a cor da etiqueta vem do código da situação do acesso', () => {
      const semVersao = { ...COMUM, id: 'p6', situacaoDoAcesso: ACESSO_SEM_VERSAO_EM_VIGOR };
      entradas({ perfis: [COMUM, SUSPENSO, semVersao] });

      const cor = (id: string): string | undefined =>
        [...(celula(id).querySelector('.tag')?.classList ?? [])].find((classe) =>
          classe.startsWith('tag--'),
        );
      expect([cor('p1'), cor('p5'), cor('p6')]).toEqual([
        'tag--success',
        'tag--danger',
        'tag--warning',
      ]);
    });
  });
});
