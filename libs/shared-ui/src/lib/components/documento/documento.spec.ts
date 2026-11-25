import { resolve } from 'node:path';

import { DOCUMENT } from '@angular/common';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { parse, type Root } from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentoComponent } from './documento';
import { declaracoesDaRegra, lerFolhaDeEstilo } from '@uniplus/shared-testing';
import { razaoDeContraste } from '../../../styles/testing/contraste.testing';

@Component({
  standalone: true,
  imports: [DocumentoComponent],
  template: `
    <ui-documento titulo="Comprovante de inscrição" [aviso]="aviso">
      <button uiDocumentoAcoes type="button">Imprimir comprovante</button>
      <p id="corpo">Conteúdo</p>
    </ui-documento>
  `,
})
class DocumentoDeTeste {
  aviso: string | null = null;
  readonly documento = viewChild.required(DocumentoComponent);
}

function montar(aviso: string | null = null) {
  const fixture = TestBed.createComponent(DocumentoDeTeste);
  fixture.componentInstance.aviso = aviso;
  fixture.detectChanges();
  return { fixture, tela: fixture.nativeElement as HTMLElement };
}

const impressoEm = (tela: HTMLElement): string =>
  [...tela.querySelectorAll('.documento__papel p')]
    .map((p) => p.textContent?.trim() ?? '')
    .find((texto) => texto.startsWith('Impresso em')) ?? '';

function esperarAvisoSemFundo(folha: Root): void {
  const fundos: string[] = [];
  folha.walkRules((regra) => {
    if (regra.selectors.includes('.documento__aviso')) {
      for (const no of regra.nodes) {
        if (no.type === 'decl' && /^background(?:-|$)/iu.test(no.prop)) fundos.push(no.prop);
      }
    }
  });
  expect(fundos).toEqual([]);
}

describe('DocumentoComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('no beforeprint, o instante da impressão entra no papel na hora, sem esperar a detecção de mudanças', () => {
    const { tela } = montar();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-11T13:30:00Z'));

    window.dispatchEvent(new Event('beforeprint'));

    expect(impressoEm(tela)).toBe('Impresso em 11/12/2026, 10:30');
  });

  it('imprimir atualiza o instante antes de abrir a janela de impressão', () => {
    const { fixture, tela } = montar();
    const janela = TestBed.inject(DOCUMENT).defaultView as Window;
    let noPapel = '';
    vi.spyOn(janela, 'print').mockImplementation(() => {
      noPapel = impressoEm(tela);
    });

    fixture.componentInstance.documento().imprimir();

    expect(noPapel).toMatch(/^Impresso em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/u);
  });

  it('é o dono do h1 e das ações; o conteúdo vai para o corpo', () => {
    const { tela } = montar();

    expect(tela.querySelectorAll('h1')).toHaveLength(1);
    expect(tela.querySelector('.page-header__actions button')?.textContent?.trim()).toBe(
      'Imprimir comprovante',
    );
    expect(tela.querySelector('.documento__corpo #corpo')).not.toBeNull();
  });

  it('o cabeçalho de tela, com o título e as ações, não sai no papel; o do papel só sai nele', () => {
    const { tela } = montar();
    const cabecalhoDeTela = tela.querySelector('ui-page-header') as HTMLElement;

    expect(cabecalhoDeTela.classList).toContain('u-no-print');
    expect(cabecalhoDeTela.querySelector('h1')).not.toBeNull();
    expect(cabecalhoDeTela.querySelector('.documento__acoes button')).not.toBeNull();
    expect(tela.querySelector('.documento__papel')?.classList).toContain('u-print-only');
  });

  it('focar leva o foco ao título', () => {
    const { fixture, tela } = montar();

    fixture.componentInstance.documento().focar();

    expect(document.activeElement).toBe(tela.querySelector('h1'));
  });
});

describe('DocumentoComponent — aviso', () => {
  const AVISO = 'Inscrição cancelada em 10/10/2026';

  it("sem aviso, não renderiza bloco nem marca d'água e o título não é descrito por nada", () => {
    const { tela } = montar(null);

    expect(tela.querySelector('.documento__aviso')).toBeNull();
    expect(tela.querySelector('.documento__aviso-marca')).toBeNull();
    expect(tela.querySelector('h1')?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('com aviso, mostra o bloco estático no topo do corpo, sem aria-live', () => {
    const { tela } = montar(AVISO);
    const bloco = tela.querySelector('.documento__corpo > :first-child') as HTMLElement;

    expect(bloco.classList).toContain('documento__aviso');
    expect(bloco.textContent?.trim()).toBe(AVISO);
    expect(bloco.closest('[aria-live]')).toBeNull();
    expect(bloco.hasAttribute('aria-live')).toBe(false);
  });

  it('o título é descrito pelo aviso', () => {
    const { tela } = montar(AVISO);
    const bloco = tela.querySelector('.documento__aviso') as HTMLElement;

    expect(bloco.id).not.toBe('');
    expect(tela.querySelector('h1')?.getAttribute('aria-describedby')).toBe(bloco.id);
  });

  it('a cópia de impressão é só do papel e fica fora da leitura de tela', () => {
    const { tela } = montar(AVISO);
    const marca = tela.querySelector('.documento__aviso-marca') as HTMLElement;

    expect(marca.textContent?.trim()).toBe(AVISO);
    expect(marca.getAttribute('aria-hidden')).toBe('true');
    expect(marca.classList).toContain('u-print-only');
  });
});

describe('folha de estilo compartilhada — papel do documento', () => {
  const folha = lerFolhaDeEstilo(resolve(__dirname, '../../../styles/components.css'));
  const regra = (seletor: string, midia?: string) => declaracoesDaRegra(folha, seletor, midia);
  const papel = regra(':root:has(.documento)', 'print');

  it('imprime em papel branco com texto escuro e contraste suficiente', () => {
    expect(papel.get('background')).toBe('#ffffff');
    expect(papel.get('--surface-card')).toBe('#ffffff');
    expect(papel.get('--text-primary')).toBe('#111111');
    expect(regra('.documento__papel', 'print').get('display')).toMatch(/^flex(?: !important)?$/u);
    expect(
      razaoDeContraste(papel.get('--text-primary') ?? '', papel.get('--surface-card') ?? ''),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('mantém o fragmento sem caixa e espaça seus filhos na impressão', () => {
    expect(regra('.documento__fragmento').get('display')).toBe('contents');
    const filhos = regra('.documento__corpo > .documento__fragmento > *', 'print');
    expect(filhos.get('margin-block-start')).toBe('3mm');
  });

  it('usa página A4 nomeada somente para o documento', () => {
    const paginas: { nome: string; tamanho: string | undefined }[] = [];
    folha.walkAtRules('page', (pagina) => {
      let tamanho: string | undefined;
      pagina.walkDecls('size', (declaracao) => {
        tamanho = declaracao.value;
      });
      paginas.push({ nome: pagina.params, tamanho });
    });
    expect(paginas).toEqual([{ nome: 'documento', tamanho: 'A4' }]);
    expect(regra(':root:has(.documento)').get('page')).toBe('documento');
  });

  it('libera a altura e o conteúdo da cadeia inteira no papel', () => {
    for (const sufixo of ['', ' body', ' body > *', ' ui-app-shell', ' .ui-app-shell', ' .page']) {
      const declaracoes = regra(':root:has(.documento)' + sufixo, 'print');
      expect(declaracoes.get('height')).toBe('auto');
      expect(declaracoes.get('max-height')).toBe('none');
      expect(declaracoes.get('overflow')).toBe('visible');
    }
  });

  it('apresenta aviso com borda e sem fundo', () => {
    const aviso = regra('.documento__aviso');
    expect(aviso.get('border')).toMatch(/^0\.25rem solid(?:\s|$)/u);
    esperarAvisoSemFundo(folha);
  });

  it('rejeita fundo no aviso dentro de uma regra de mídia', () => {
    const folhaComFundo = parse('@media print { .documento__aviso { background-color: red } }');
    expect(() => esperarAvisoSemFundo(folhaComFundo)).toThrow();
  });

  it('apresenta a marca de impressão fixa e legível', () => {
    const marca = regra('.documento__aviso-marca', 'print');
    expect(marca.get('position')).toBe('fixed');
    expect(marca.get('mix-blend-mode')).toBe('multiply');
    expect(marca.get('font-size')).toBe('28pt');
    // A marca clara preserva a leitura do texto sobreposto na impressão.
    expect(marca.get('color')).toBe('#d1d5db');
    expect(marca.get('print-color-adjust')).toBe('exact');
    expect(marca.get('-webkit-print-color-adjust')).toBe('exact');
  });

  it('não mostra anel no título com foco programático', () => {
    expect(regra('.page-header__title:focus-visible').get('box-shadow')).toBe('none');
  });

  it('mantém contraste dos sinais e links no papel', () => {
    for (const nome of ['--text-link', '--color-primary']) {
      expect(papel.has(nome)).toBe(true);
      expect(razaoDeContraste(papel.get(nome) ?? '', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
    expect(papel.has('--color-success-700')).toBe(true);
    expect(papel.has('--color-success-50')).toBe(true);
    expect(
      razaoDeContraste(
        papel.get('--color-success-700') ?? '',
        papel.get('--color-success-50') ?? '',
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('restaura os valores claros dos tokens de sucesso, link e primário', () => {
    expect(papel.get('--color-success-700')).toBe('#0a5a16');
    expect(papel.get('--color-success-50')).toBe('#e7f4e9');
    expect(papel.get('--text-link')).toBe('#1351b4');
    expect(papel.get('--color-primary')).toBe('#1351b4');
  });
});
