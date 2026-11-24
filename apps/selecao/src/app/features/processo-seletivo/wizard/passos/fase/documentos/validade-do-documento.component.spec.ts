import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CatalogoDasEscolhasDaValidade } from '../../cronograma/catalogos/catalogo-das-escolhas-da-validade.service';
import { CatalogoDosEfeitosNaAnaliseDoDocumento } from '../../cronograma/catalogos/catalogo-dos-efeitos-na-analise-do-documento.service';
import { CatalogoDosTiposDaDataDeReferencia } from '../../cronograma/catalogos/catalogo-dos-tipos-da-data-de-referencia.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';

import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { ValidadeDoDocumentoComponent } from './validade-do-documento.component';

function catalogo(propriedade: string, opcoes: readonly { codigo: string; rotulo: string }[]) {
  return {
    carregar: vi.fn(),
    repetir: vi.fn(),
    erro: signal(null),
    situacao: signal('pronto'),
    [propriedade]: signal(opcoes),
  };
}

const escrever = vi.fn();
const PROVEDORES = [
  {
    provide: ExigenciasDaFaseStore,
    useValue: {
      exigenciaDoDocumento: () => ({
        validade: {
          escolha: 'EXIGE_DOCUMENTO_VALIDO',
          referencia: null,
          efeitoDoVencimento: 'RECUSAR_DOCUMENTO',
        },
      }),
      escreverExigencia: escrever,
    },
  },
  {
    provide: CatalogoDasEscolhasDaValidade,
    useValue: catalogo('escolhasDaValidade', [
      { codigo: 'NAO_EXIGE_DOCUMENTO_VALIDO', rotulo: 'Escolha recebida' },
    ]),
  },
  {
    provide: CatalogoDosEfeitosNaAnaliseDoDocumento,
    useValue: catalogo('efeitosNaAnaliseDoDocumento', []),
  },
  {
    provide: CatalogoDosTiposDaDataDeReferencia,
    useValue: catalogo('tiposDaDataDeReferencia', []),
  },
  { provide: FormularioDoCronograma, useValue: { linhaDoTempo: signal([]) } },
];

function montar() {
  escrever.mockClear();
  TestBed.configureTestingModule({ providers: PROVEDORES });
  const tela = TestBed.createComponent(ValidadeDoDocumentoComponent);
  tela.componentRef.setInput('documentoId', 'documento');
  tela.componentRef.setInput('idBase', 'campo');
  tela.detectChanges();
  return { tela, escrever };
}

describe('validade-do-documento', () => {
  it('mostra a opção recebida e descarta os detalhes ao escolhê-la', () => {
    const { tela, escrever } = montar();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Escolha recebida');
    elemento
      .querySelector<HTMLInputElement>('#campo-NAO_EXIGE_DOCUMENTO_VALIDO')
      ?.dispatchEvent(new Event('change'));
    expect(escrever).toHaveBeenCalledWith('documento', {
      validade: expect.objectContaining({
        escolha: 'NAO_EXIGE_DOCUMENTO_VALIDO',
        referencia: null,
      }),
    });
  });
});
