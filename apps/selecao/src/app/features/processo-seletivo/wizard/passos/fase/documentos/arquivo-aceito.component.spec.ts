import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CatalogoDosFormatosPermitidos } from '../../cronograma/catalogos/catalogo-dos-formatos-permitidos.service';
import type { FormatosAceitos } from '../../../processo-seletivo.models';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';
import { ArquivoAceitoComponent } from './arquivo-aceito.component';

function catalogoDisponivel() {
  return {
    carregar: vi.fn(),
    repetir: vi.fn(),
    erro: signal(null),
    situacao: signal('pronto'),
    formatos: signal([
      { codigo: 'PDF', rotulo: 'PDF' },
      { codigo: 'PNG', rotulo: 'PNG' },
    ]),
  };
}

function montar() {
  const catalogo = catalogoDisponivel();
  const estado = signal<{ formatosPermitidos: FormatosAceitos; tamanhoMaximoBytes: number | null }>(
    {
      formatosPermitidos: { tipo: 'qualquer' },
      tamanhoMaximoBytes: 5 * 1024 * 1024,
    },
  );
  const escrever = vi.fn((_id: string, mudanca: Partial<ReturnType<typeof estado>>) => {
    estado.update((atual) => ({ ...atual, ...mudanca }));
  });
  TestBed.configureTestingModule({
    providers: [
      RecusasDasExigencias,
      {
        provide: ExigenciasDaFaseStore,
        useValue: { exigenciaDoDocumento: estado, escreverExigencia: escrever },
      },
      { provide: CatalogoDosFormatosPermitidos, useValue: catalogo },
    ],
  });
  const tela = TestBed.createComponent(ArquivoAceitoComponent);
  tela.componentRef.setInput('idBase', 'arquivo');
  tela.componentRef.setInput('documentoId', 'documento');
  tela.detectChanges();
  return { tela, estado, escrever, recusas: TestBed.inject(RecusasDasExigencias) };
}

const FORMATOS_COM_TAMANHO = {
  tipo: 'lista',
  itens: [
    { formato: 'PDF', tamanhoMaximoBytes: 100 },
    { formato: 'PNG', tamanhoMaximoBytes: 100 },
  ],
};
const RECUSA_DO_TAMANHO = [
  {
    identificadorDaRegra: 'documento',
    codigo: 'TAMANHO',
    campo: 'documento.requisitos.formatosPermitidos[0].tamanhoMaximoBytesMax',
    mensagem: 'Corrija o PDF.',
  },
];

function montarComRecusaDoFormato() {
  const resultado = montar();
  resultado.estado.update((atual) => ({
    ...atual,
    formatosPermitidos: FORMATOS_COM_TAMANHO as FormatosAceitos,
  }));
  resultado.recusas.registrar(RECUSA_DO_TAMANHO);
  resultado.tela.detectChanges();
  return resultado;
}

const FORMATO_PDF = { tipo: 'lista', itens: [{ formato: 'PDF', tamanhoMaximoBytes: null }] };

const RECUSA_DOS_FORMATOS = [
  {
    identificadorDaRegra: 'documento',
    codigo: 'FORMATO_INVALIDO',
    campo: 'documento.requisitos.formatosPermitidos',
    mensagem: 'Formato inválido.',
  },
];

const FORMATOS_ARREDONDADOS = {
  tipo: 'lista',
  itens: [
    { formato: 'PDF', tamanhoMaximoBytes: 104858 },
    { formato: 'PNG', tamanhoMaximoBytes: 100 },
  ],
};

describe('ArquivoAceitoComponent', () => {
  it('associa a recusa do servidor aos formatos', () => {
    const { tela, recusas } = montar();
    recusas.registrar(RECUSA_DOS_FORMATOS);
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.querySelector('fieldset')?.getAttribute('aria-describedby')).toContain(
      'arquivo-formatos-recusas',
    );
    expect(elemento.querySelector('#arquivo-formatos-recusas')?.textContent).toContain(
      'Formato inválido.',
    );
    tela.componentInstance.escolherLista();
    tela.detectChanges();
    expect(elemento.querySelector('#arquivo-formatos-recusas')?.textContent).not.toContain(
      'Formato inválido.',
    );
  });

  it('converte fração de megabyte em bytes inteiros', () => {
    const { tela, escrever } = montar();
    const campo = (tela.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#arquivo-tamanho',
    ) as HTMLInputElement;
    campo.value = '0.1';
    campo.dispatchEvent(new Event('input'));
    expect(escrever).toHaveBeenCalledWith('documento', { tamanhoMaximoBytes: 104858 });
  });

  it('converte fração de megabyte para o formato escolhido', () => {
    const { tela, estado } = montarComRecusaDoFormato();
    const campo = (tela.nativeElement as HTMLElement).querySelector(
      '#arquivo-PDF',
    ) as HTMLInputElement;
    campo.value = '0.1';
    campo.dispatchEvent(new Event('input'));
    expect(estado().formatosPermitidos).toEqual(FORMATOS_ARREDONDADOS);
    tela.detectChanges();
    expect(
      (tela.nativeElement as HTMLElement).querySelector('#arquivo-PDF-recusas')?.textContent,
    ).not.toContain('Corrija o PDF.');
  });

  it('associa a recusa ao tamanho do formato indicado', () => {
    const { tela } = montarComRecusaDoFormato();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.querySelector('#arquivo-PDF')?.getAttribute('aria-invalid')).toBe('true');
    expect(elemento.querySelector('#arquivo-PDF')?.getAttribute('aria-describedby')).toContain(
      'arquivo-PDF-recusas',
    );
    expect(elemento.querySelector('#arquivo-PNG')?.getAttribute('aria-invalid')).toBeNull();
    expect(elemento.querySelector('#arquivo-PDF-recusas')?.textContent).toContain('Corrija o PDF.');
  });

  it('oferece os formatos carregados e informa quando a lista está vazia', () => {
    const { tela, estado } = montar();
    estado.update((atual) => ({ ...atual, formatosPermitidos: { tipo: 'lista', itens: [] } }));
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Selecione ao menos um formato');
    expect(elemento.textContent).toContain('PDF');
    expect(elemento.textContent).toContain('PNG');
  });

  it('exibe a seleção recebida e indica tamanho maior que o permitido', () => {
    const { tela, estado } = montar();
    estado.update((atual) => ({
      ...atual,
      formatosPermitidos: {
        tipo: 'lista',
        itens: [{ formato: 'PDF', tamanhoMaximoBytes: 6 * 1024 * 1024 }],
      },
    }));
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBe(true);
    expect(elemento.querySelector<HTMLInputElement>('#arquivo-PDF')?.value).toBe('6');
    expect(
      elemento.querySelector<HTMLInputElement>('#arquivo-PDF')?.getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('grava a lista selecionada e descarta seus itens ao aceitar qualquer formato', () => {
    const { tela, estado } = montar();
    tela.componentInstance.escolherLista();
    expect(estado().formatosPermitidos).toEqual({ tipo: 'lista', itens: [] });
    const caixa = document.createElement('input');
    caixa.checked = true;
    caixa.addEventListener('change', (evento) => tela.componentInstance.alternar('PDF', evento));
    caixa.dispatchEvent(new Event('change'));
    expect(estado().formatosPermitidos).toEqual(FORMATO_PDF);
    tela.componentInstance.escolherQualquer();
    expect(estado().formatosPermitidos).toEqual({ tipo: 'qualquer' });
  });
});
