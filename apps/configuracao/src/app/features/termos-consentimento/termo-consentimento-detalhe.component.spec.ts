import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TermoConsentimentoDetalheComponent } from './termo-consentimento-detalhe.component';
import { AcaoTermo, criarFormularioRascunho } from './termo-consentimento-form';
import { REVISADO, termo, versao } from './termos-consentimento.testing';

interface Estado {
  readonly processando?: boolean;
  readonly acao?: AcaoTermo | null;
  readonly leituraDefasada?: boolean;
  readonly podeRevisar?: boolean;
  readonly podePromover?: boolean;
  readonly podeRemover?: boolean;
  readonly dados?: ReturnType<typeof termo> | null;
}

describe('TermoConsentimentoDetalheComponent', () => {
  function montar(estado: Estado = {}): ComponentFixture<TermoConsentimentoDetalheComponent> {
    const fixture = TestBed.createComponent(TermoConsentimentoDetalheComponent);
    fixture.componentRef.setInput('form', criarFormularioRascunho());
    fixture.componentRef.setInput('termo', estado.dados === undefined ? termo() : estado.dados);
    fixture.componentRef.setInput('processando', estado.processando ?? false);
    fixture.componentRef.setInput('acaoEmAndamento', estado.acao ?? null);
    fixture.componentRef.setInput('leituraDefasada', estado.leituraDefasada ?? false);
    fixture.componentRef.setInput('podeRevisar', estado.podeRevisar ?? true);
    fixture.componentRef.setInput('podePromover', estado.podePromover ?? true);
    fixture.componentRef.setInput('podeRemover', estado.podeRemover ?? true);
    fixture.detectChanges();
    return fixture;
  }
  const botao = (fixture: ComponentFixture<unknown>, acao: string): HTMLButtonElement =>
    (fixture.nativeElement as HTMLElement).querySelector(
      `[data-acao="${acao}"]`,
    ) as HTMLButtonElement;
  const ACOES = ['revisar', 'promover', 'remover'] as const;

  it('emite cada ação ao clicar no botão disponível', () => {
    const fixture = montar();
    const emitidos: string[] = [];
    const c = fixture.componentInstance;
    c.revisar.subscribe(() => emitidos.push('revisar'));
    c.promover.subscribe(() => emitidos.push('promover'));
    c.remover.subscribe(() => emitidos.push('remover'));
    ACOES.forEach((acao) => botao(fixture, acao).click());
    expect(emitidos).toEqual(['revisar', 'promover', 'remover']);
  });

  it('com processamento em curso, marca os botões como indisponíveis e não emite', () => {
    const fixture = montar({ processando: true, acao: 'promover' });
    const emitidos: string[] = [];
    const c = fixture.componentInstance;
    c.revisar.subscribe(() => emitidos.push('revisar'));
    c.promover.subscribe(() => emitidos.push('promover'));
    c.remover.subscribe(() => emitidos.push('remover'));
    c.salvar.subscribe(() => emitidos.push('salvar'));
    ACOES.forEach((acao) => {
      expect(botao(fixture, acao).getAttribute('aria-disabled')).toBe('true');
      expect(botao(fixture, acao).matches(':disabled')).toBe(false);
      botao(fixture, acao).click();
    });
    expect(botao(fixture, 'promover').getAttribute('aria-busy')).toBe('true');
    expect(botao(fixture, 'promover').textContent).toContain('Promovendo...');
    expect(botao(fixture, 'rascunho').getAttribute('aria-disabled')).toBe('true');
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    expect(emitidos).toEqual([]);
  });

  it.each([
    ['revisar', 'Marcando...'],
    ['rascunho', 'Salvando...'],
  ] as const)('anuncia a ação %s em curso no botão', (acao, texto) => {
    const fixture = montar({ processando: true, acao });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')?.textContent,
    ).toContain(texto);
  });

  it('desabilita pela regra os botões que o termo não permite, com o motivo', () => {
    const fixture = montar({
      podeRevisar: false,
      podePromover: false,
      podeRemover: false,
      dados: termo({ versoes: [versao()] }),
    });
    ACOES.forEach((acao) => expect(botao(fixture, acao).matches(':disabled')).toBe(true));
    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Termo com versão promovida não pode ser removido.');
    expect(texto).toContain('Marque o rascunho como revisado antes de promover.');
  });

  it('mostra o estado de elaboração ou a data da revisão', () => {
    expect((montar().nativeElement as HTMLElement).textContent).toContain('Em elaboração');
    const revisado = montar({ dados: REVISADO }).nativeElement as HTMLElement;
    expect(revisado.textContent).toContain('Revisado em 11/08/2026');
  });

  it('lista as versões com o rótulo da forma de aceite e o hash completo no título', () => {
    const hash = 'abcdef0123456789';
    const fixture = montar({
      dados: termo({
        versoes: [
          versao({ formaAceite: 'REGISTRO_DIGITAL_COM_LOG_IP', hash }),
          versao({ id: 'v2', formaAceite: 'OUTRA', hash: 'curto' }),
        ],
      }),
    });
    const linhas = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')];
    expect(
      linhas.map((l) => l.querySelector('[data-label="Forma de aceite"]')?.textContent),
    ).toEqual(['Registro digital (com log de IP)', 'OUTRA']);
    expect(linhas[0].querySelector('code')?.getAttribute('title')).toBe(hash);
    expect(linhas[1].querySelector('code')?.textContent).toBe('curto');
  });

  it('sem termo carregado, não afirma motivo para a remoção indisponível', () => {
    const fixture = montar({ dados: null, podeRevisar: false, podeRemover: false });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nenhuma versão promovida ainda.',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[aria-label="Remover termo indisponível"]',
      ),
    ).toBeNull();
  });

  it('com a leitura defasada, bloqueia revisar e promover e explica o motivo', () => {
    const fixture = montar({ leituraDefasada: true, podeRevisar: false, podePromover: false });
    ['revisar', 'promover'].forEach((acao) =>
      expect(botao(fixture, acao).matches(':disabled')).toBe(true),
    );
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Recarregue os dados antes de continuar.');
    expect(raiz.textContent).not.toContain('Preencha texto e base legal do rascunho salvo');
  });

  describe('foco ao fim de uma ação com campo recusado', () => {
    function terminar(acao: AcaoTermo): HTMLElement {
      const fixture = montar({ processando: true, acao });
      const campo = fixture.componentInstance.form().controls.texto;
      campo.markAsTouched();
      campo.setErrors({ backend: { code: 'c', message: 'Recusado.' } });
      fixture.componentRef.setInput('processando', false);
      fixture.componentRef.setInput('acaoEmAndamento', null);
      fixture.detectChanges();
      TestBed.inject(ApplicationRef).tick();
      return (fixture.nativeElement as HTMLElement).querySelector('textarea') as HTMLElement;
    }

    it('salvar o rascunho leva o foco ao campo recusado', () => {
      const texto = terminar('rascunho');
      expect(document.activeElement).toBe(texto);
    });

    it.each(['revisar', 'promover'] as const)('%s não leva o foco ao campo do rascunho', (acao) => {
      const texto = terminar(acao);
      expect(document.activeElement).not.toBe(texto);
    });
  });
});
