import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CatalogoDosTiposDaDataDeReferencia } from '../../cronograma/catalogos/catalogo-dos-tipos-da-data-de-referencia.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { ReferenciaDeDataComponent } from './referencia-de-data.component';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';

const PROVEDORES = [
  RecusasDasExigencias,
  {
    provide: CatalogoDosTiposDaDataDeReferencia,
    useValue: {
      carregar: vi.fn(),
      repetir: vi.fn(),
      erro: signal(null),
      situacao: signal('pronto'),
      tiposDaDataDeReferencia: signal([{ codigo: 'DATA_ESPECIFICA', rotulo: 'Data específica' }]),
    },
  },
  { provide: FormularioDoCronograma, useValue: { linhaDoTempo: signal([]) } },
];

function montar(tipo: string) {
  TestBed.configureTestingModule({ providers: PROVEDORES });
  const tela = TestBed.createComponent(ReferenciaDeDataComponent);
  tela.componentRef.setInput('referencia', { tipo, data: null, faseCodigo: null });
  tela.componentRef.setInput('documentoId', 'documento');
  tela.componentRef.setInput('caminho', 'documento.requisitos.validade.referencia');
  tela.componentRef.setInput('idBase', 'referencia');
  tela.detectChanges();
  return tela;
}

describe('referência de data', () => {
  it('oferece os tipos recebidos e mostra data apenas para data específica', () => {
    const tela = montar('DATA_ESPECIFICA');
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Data específica');
    expect(elemento.querySelector('input[type=date]')).not.toBeNull();
    expect(elemento.querySelector('#referencia-fase')).toBeNull();
  });

  it.each(['INICIO_DA_FASE', 'FIM_DA_FASE'])('mostra fase para %s', (tipo) => {
    const elemento = montar(tipo).nativeElement as HTMLElement;
    expect(elemento.querySelector('#referencia-fase')).not.toBeNull();
    expect(elemento.querySelector('input[type=date]')).toBeNull();
  });

  it.each([
    ['DATA_ESPECIFICA', 'data', 'data', 'input'],
    ['INICIO_DA_FASE', 'faseId', 'fase', 'change'],
  ])('mostra e limpa a recusa de %s no campo correspondente', (tipo, campo, sufixo, evento) => {
    const tela = montar(tipo);
    TestBed.inject(RecusasDasExigencias).registrar([
      {
        identificadorDaRegra: 'documento',
        campo: `documento.requisitos.validade.referencia.${campo}`,
        codigo: 'ausente',
        mensagem: 'Informe o valor.',
      },
    ]);
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    const entrada = elemento.querySelector(`#referencia-${sufixo}`);
    expect(entrada?.getAttribute('aria-invalid')).toBe('true');
    expect(entrada?.getAttribute('aria-describedby')).toBe(`referencia-${sufixo}-recusas`);
    expect(entrada?.parentElement?.textContent).toContain('Informe o valor.');
    expect(elemento.querySelector('#referencia-tipo-recusas')?.textContent).not.toContain(
      'Informe o valor.',
    );
    entrada?.dispatchEvent(new Event(evento));
    tela.detectChanges();
    expect(entrada?.getAttribute('aria-invalid')).toBeNull();
    expect(entrada?.parentElement?.textContent).not.toContain('Informe o valor.');
  });

  it('não mostra data nem fase para o fim das inscrições', () => {
    const elemento = montar('FIM_DAS_INSCRICOES').nativeElement as HTMLElement;
    expect(elemento.querySelector('#referencia-fase')).toBeNull();
    expect(elemento.querySelector('input[type=date]')).toBeNull();
  });

  it.each(['referencia', 'referencia.tipo'])(
    'mostra a recusa de %s no tipo e limpa ao editar',
    (campo) => {
      const tela = montar('DATA_ESPECIFICA');
      const caminho = `documento.requisitos.validade.${campo}`;
      TestBed.inject(RecusasDasExigencias).registrar([
        {
          identificadorDaRegra: 'documento',
          campo: caminho,
          codigo: 'ausente',
          mensagem: 'Informe a referência.',
        },
        {
          identificadorDaRegra: 'documento',
          campo: 'documento.requisitos.validade.referencia.data',
          codigo: 'data',
          mensagem: 'Informe a data.',
        },
      ]);
      tela.detectChanges();
      const elemento = tela.nativeElement as HTMLElement;
      const seletor = elemento.querySelector<HTMLSelectElement>('#referencia-tipo');
      expect(seletor?.getAttribute('aria-invalid')).toBe('true');
      expect(seletor?.getAttribute('aria-describedby')).toContain('referencia-tipo-recusas');
      expect(elemento.querySelector('#referencia-tipo-recusas')?.textContent).toContain(
        'Informe a referência.',
      );
      expect(elemento.querySelector('#referencia-tipo-recusas')?.textContent).not.toContain(
        'Informe a data.',
      );
      expect(elemento.querySelector('#referencia-data-recusas')?.textContent).toContain(
        'Informe a data.',
      );
      seletor?.dispatchEvent(new Event('change'));
      tela.detectChanges();
      expect(seletor?.getAttribute('aria-invalid')).toBeNull();
      expect(elemento.querySelector('#referencia-tipo-recusas')?.textContent).not.toContain(
        'Informe a referência.',
      );
    },
  );
});
