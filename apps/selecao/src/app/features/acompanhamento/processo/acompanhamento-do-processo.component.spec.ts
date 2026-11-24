import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AcompanhamentoDoProcessoComponent,
  type ProcessoDoAcompanhamento,
  type SituacaoApresentada,
} from './acompanhamento-do-processo.component';

const AVISO = 'Não há informações de acompanhamento disponíveis no momento';

/** Fixtures fictícias: existem só nos testes, nunca em código de produção. */
const PROCESSO_A: ProcessoDoAcompanhamento = { id: 'processo-a', nome: 'Processo Seletivo A' };
const PROCESSO_B: ProcessoDoAcompanhamento = { id: 'processo-b', nome: 'Processo Seletivo B' };
const PROCESSO_DE_NOME_LONGO: ProcessoDoAcompanhamento = {
  id: 'processo-longo',
  nome:
    'Processo Seletivo para Ingresso nos Cursos de Graduação Presenciais em Regime Especial — ' +
    'SequenciaSemEspacosDeUmNomeExcessivamenteLongoParaForcarAQuebraDeLinha',
};

const lido = (processo: ProcessoDoAcompanhamento): SituacaoApresentada => ({
  estado: 'lido',
  processo,
});

@Component({
  standalone: true,
  imports: [AcompanhamentoDoProcessoComponent],
  template: `
    <sel-acompanhamento-do-processo [situacao]="situacao()" destinoDoPainel="/painel">
      <a acoesDoProcesso href="#editar">Editar processo</a>
      <p conteudoDoAcompanhamento>Indicadores</p>
    </sel-acompanhamento-do-processo>
  `,
})
class AnfitriaoComConteudo {
  readonly situacao = signal<SituacaoApresentada>(lido(PROCESSO_A));
}

describe('AcompanhamentoDoProcessoComponent', () => {
  let fixture: ComponentFixture<AcompanhamentoDoProcessoComponent>;
  let tentouDeNovo: number;

  beforeEach(() => {
    tentouDeNovo = 0;
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(AcompanhamentoDoProcessoComponent);
    fixture.componentRef.setInput('destinoDoPainel', '/dashboard');
    fixture.componentInstance.tentarNovamente.subscribe(() => tentouDeNovo++);
  });

  const mostrar = (situacao: SituacaoApresentada) => {
    fixture.componentRef.setInput('situacao', situacao);
    fixture.detectChanges();
  };
  const host = () => fixture.nativeElement as HTMLElement;
  const texto = () => host().textContent ?? '';
  const botao = (rotulo: string) =>
    Array.from(host().querySelectorAll('button')).find((b) => b.textContent?.includes(rotulo));
  const linkDoPainel = () =>
    Array.from(host().querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Voltar ao painel'),
    );

  it('carregado: nome no cabeçalho, só a seção Acompanhamento e o aviso', () => {
    mostrar(lido(PROCESSO_A));
    expect(host().querySelector('h1')?.textContent).toContain('Processo Seletivo A');
    expect(host().querySelector('#acompanhamento-secao')?.textContent).toBe('Acompanhamento');
    expect(host().querySelector('[role="tablist"], [role="tab"]')).toBeNull();
    expect(texto()).toContain(AVISO);
  });

  it('nome longo continua inteiro no cabeçalho', () => {
    mostrar(lido(PROCESSO_DE_NOME_LONGO));
    expect(host().querySelector('h1')?.textContent).toContain(PROCESSO_DE_NOME_LONGO.nome);
  });

  it('carregando: sem nome, sem aviso de ausência, com retorno ao painel', () => {
    mostrar(lido(PROCESSO_A));
    mostrar({ estado: 'lendo' });
    expect(texto()).toContain('Carregando processo seletivo');
    expect(host().querySelector('[role="status"]')?.getAttribute('aria-busy')).toBe('true');
    expect(texto()).not.toContain('Processo Seletivo A');
    expect(texto()).not.toContain(AVISO);
    expect(host().querySelector('h1')?.textContent).toContain('Acompanhamento');
    expect(linkDoPainel()).toBeDefined();
  });

  it('falha: oferece nova tentativa e não mostra o aviso de ausência', () => {
    mostrar({ estado: 'falha' });
    expect(texto()).toContain('Não foi possível carregar o processo seletivo');
    expect(texto()).not.toContain(AVISO);
    botao('Tentar novamente')?.click();
    expect(tentouDeNovo).toBe(1);
  });

  it('não encontrado: mensagem própria, retorno e nenhum nome anterior', () => {
    mostrar(lido(PROCESSO_A));
    mostrar({ estado: 'nao-encontrado' });
    expect(texto()).toContain('Processo seletivo não encontrado');
    expect(texto()).not.toContain('Processo Seletivo A');
    expect(texto()).not.toContain(AVISO);
    expect(botao('Tentar novamente')).toBeUndefined();
  });

  it('acesso negado: mensagem própria, sem nova tentativa e sem dados do anterior', () => {
    mostrar(lido(PROCESSO_A));
    mostrar({ estado: 'acesso-negado' });
    expect(texto()).toContain('Acesso negado');
    expect(texto()).not.toContain('Processo Seletivo A');
    expect(texto()).not.toContain(AVISO);
    expect(botao('Tentar novamente')).toBeUndefined();
    expect(linkDoPainel()).toBeDefined();
  });

  it('troca de A para B passa pelo carregamento sem manter A', () => {
    mostrar(lido(PROCESSO_A));
    mostrar({ estado: 'lendo' });
    expect(texto()).not.toContain('Processo Seletivo A');
    mostrar(lido(PROCESSO_B));
    expect(host().querySelector('h1')?.textContent).toContain('Processo Seletivo B');
  });

  it.each([
    ['lendo', { estado: 'lendo' }],
    ['falha', { estado: 'falha' }],
    ['nao-encontrado', { estado: 'nao-encontrado' }],
    ['acesso-negado', { estado: 'acesso-negado' }],
    ['lido', lido(PROCESSO_A)],
  ] as const)('em %s, "Voltar ao painel" é um link com endereço real', (_estado, situacao) => {
    mostrar(situacao);
    expect(linkDoPainel()?.getAttribute('href')).toBe('/dashboard');
  });
});

describe('AcompanhamentoDoProcessoComponent — pontos de integração', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('projeta as ações no cabeçalho e o conteúdo no lugar da mensagem de ausência', () => {
    const fixture = TestBed.createComponent(AnfitriaoComConteudo);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.page-header__actions')?.textContent).toContain('Editar processo');
    expect(host.querySelector('section')?.textContent).toContain('Indicadores');
    expect(host.textContent).not.toContain(AVISO);
  });

  it('de carregado para carregando, as ações somem do cabeçalho', () => {
    const fixture = TestBed.createComponent(AnfitriaoComConteudo);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.page-header__actions')?.textContent).toContain('Editar processo');
    fixture.componentInstance.situacao.set({ estado: 'lendo' });
    fixture.detectChanges();
    expect(host.querySelector('.page-header__actions')?.textContent).not.toContain(
      'Editar processo',
    );
  });

  it.each([
    ['lendo', { estado: 'lendo' }],
    ['falha', { estado: 'falha' }],
    ['nao-encontrado', { estado: 'nao-encontrado' }],
    ['acesso-negado', { estado: 'acesso-negado' }],
  ] as const)(
    'em %s, não projeta ações nem conteúdo e mantém o retorno ao painel',
    (_estado, situacao) => {
      const fixture = TestBed.createComponent(AnfitriaoComConteudo);
      fixture.componentInstance.situacao.set(situacao);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const cabecalho = host.querySelector('.page-header__actions')?.textContent ?? '';
      const retorno = Array.from(host.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Voltar ao painel'),
      );
      expect(cabecalho).not.toContain('Editar processo');
      expect(host.textContent).not.toContain('Indicadores');
      expect(retorno?.getAttribute('href')).toBe('/painel');
    },
  );
});
