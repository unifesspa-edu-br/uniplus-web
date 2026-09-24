import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AlertaNovaTentativaComponent } from './alerta-nova-tentativa.component';

describe('AlertaNovaTentativaComponent', () => {
  let fixture: ComponentFixture<AlertaNovaTentativaComponent>;

  function criar(entradas: {
    mensagem: string;
    pendente: boolean;
    tentativas?: number;
  }): HTMLElement {
    fixture = TestBed.createComponent(AlertaNovaTentativaComponent);
    fixture.componentRef.setInput('titulo', 'Não foi possível carregar a lista');
    fixture.componentRef.setInput('mensagem', entradas.mensagem);
    fixture.componentRef.setInput('pendente', entradas.pendente);
    fixture.componentRef.setInput('idMensagem', 'mensagem');
    fixture.componentRef.setInput('tentativasSemSucesso', entradas.tentativas ?? 1);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texto = (raiz: HTMLElement): string | undefined =>
    raiz.querySelector('#mensagem')?.textContent?.trim();

  beforeEach(() => TestBed.configureTestingModule({ imports: [AlertaNovaTentativaComponent] }));

  it('criado durante a carga: botão ocupado, com o rótulo de sempre, e só a mensagem', () => {
    const raiz = criar({ mensagem: 'A lista não foi carregada.', pendente: true });

    const botao = raiz.querySelector('button');
    expect(botao?.getAttribute('aria-disabled')).toBe('true');
    expect(botao?.getAttribute('aria-busy')).toBe('true');
    expect(botao?.textContent?.trim()).toBe('Tentar novamente');
    expect(raiz.querySelector('[role="status"]')).toBeNull();
    expect(texto(raiz)).toBe('A lista não foi carregada.');
  });

  it('recriado, volta a mostrar só a mensagem: a contagem vem de quem carrega', () => {
    criar({ mensagem: 'Falhou.', pendente: false, tentativas: 3 });
    const raiz = criar({ mensagem: 'Falhou.', pendente: false });

    expect(texto(raiz)).toBe('Falhou.');
  });

  it('falha repetida muda o texto, para a região viva anunciar de novo', () => {
    const raiz = criar({ mensagem: 'Falhou.', pendente: false, tentativas: 2 });
    expect(texto(raiz)).toBe('Falhou. Tentativa 2 sem sucesso.');

    fixture.componentRef.setInput('tentativasSemSucesso', 3);
    fixture.detectChanges();
    expect(texto(raiz)).toBe('Falhou. Tentativa 3 sem sucesso.');
  });

  it.each([[''], ['   ']])('mensagem %j cai no texto padrão, sem ponto solto', (mensagem) => {
    expect(texto(criar({ mensagem, pendente: false }))).toBe('A lista não foi carregada.');
    expect(texto(criar({ mensagem, pendente: false, tentativas: 2 }))).toBe(
      'A lista não foi carregada. Tentativa 2 sem sucesso.',
    );
  });

  it('mensagem sem ponto final ganha o ponto antes da contagem', () => {
    const raiz = criar({ mensagem: 'Erro interno', pendente: false, tentativas: 2 });

    expect(texto(raiz)).toBe('Erro interno. Tentativa 2 sem sucesso.');
  });
});
