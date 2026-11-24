import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CatalogoDasEscolhasDoPrazoDeEmissao } from '../../cronograma/catalogos/catalogo-das-escolhas-do-prazo-de-emissao.service';
import { CatalogoDosEfeitosNaAnaliseDoDocumento } from '../../cronograma/catalogos/catalogo-dos-efeitos-na-analise-do-documento.service';
import { CatalogoDosTiposDaDataDeReferencia } from '../../cronograma/catalogos/catalogo-dos-tipos-da-data-de-referencia.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { CatalogoDasUnidadesDoPrazoDeEmissao } from '../../cronograma/catalogos/catalogo-das-unidades-do-prazo-de-emissao.service';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';
import { PrazoDeEmissaoComponent } from './prazo-de-emissao.component';

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
  RecusasDasExigencias,
  {
    provide: ExigenciasDaFaseStore,
    useValue: {
      exigenciaDoDocumento: () => ({
        prazoDeEmissao: {
          escolha: 'COM_PRAZO',
          valor: 30,
          unidade: 'DIAS',
          referencia: null,
          efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
        },
      }),
      escreverExigencia: escrever,
    },
  },
  {
    provide: CatalogoDasEscolhasDoPrazoDeEmissao,
    useValue: catalogo('escolhasDoPrazoDeEmissao', [
      { codigo: 'SEM_PRAZO', rotulo: 'Escolha recebida' },
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
  {
    provide: CatalogoDasUnidadesDoPrazoDeEmissao,
    useValue: catalogo('unidadesDoPrazoDeEmissao', []),
  },
];

function montar() {
  escrever.mockClear();
  TestBed.configureTestingModule({ providers: PROVEDORES });
  const tela = TestBed.createComponent(PrazoDeEmissaoComponent);
  tela.componentRef.setInput('documentoId', 'documento');
  tela.componentRef.setInput('idBase', 'campo');
  tela.detectChanges();
  return { tela, escrever };
}

const RECUSA_DO_VALOR = [
  {
    identificadorDaRegra: 'documento',
    campo: 'documento.requisitos.prazoDeEmissao.valor',
    codigo: 'prazo_de_emissao.valor',
    mensagem: 'Informe outro prazo.',
  },
];

describe('prazo-de-emissao', () => {
  it('mostra a opção recebida e descarta os detalhes ao escolhê-la', () => {
    const { tela, escrever } = montar();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Escolha recebida');
    elemento
      .querySelector<HTMLInputElement>('#campo-SEM_PRAZO')
      ?.dispatchEvent(new Event('change'));
    expect(escrever).toHaveBeenCalledWith('documento', {
      prazoDeEmissao: expect.objectContaining({ escolha: 'SEM_PRAZO', referencia: null }),
    });
  });
  it('mostra o valor existente e a recusa junto ao campo', () => {
    const { tela } = montar();
    TestBed.inject(RecusasDasExigencias).registrar(RECUSA_DO_VALOR);
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.querySelector<HTMLInputElement>('#campo-valor')?.value).toBe('30');
    expect(elemento.querySelector('#campo-valor-recusas')?.textContent).toContain(
      'Informe outro prazo.',
    );
    elemento.querySelector<HTMLInputElement>('#campo-valor')?.dispatchEvent(new Event('input'));
    tela.detectChanges();
    expect(elemento.querySelector('#campo-valor-recusas')?.textContent).not.toContain(
      'Informe outro prazo.',
    );
  });
});
