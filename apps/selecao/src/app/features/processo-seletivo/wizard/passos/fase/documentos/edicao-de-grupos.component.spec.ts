import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { exigencia, rascunho } from '../../../shared/exigencias/exigencias.testing';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { CatalogoDeFases } from '../../cronograma/catalogos/catalogo-de-fases.service';
import { CatalogoDasFormasDeComprovacao } from '../../cronograma/catalogos/catalogo-das-formas-de-comprovacao.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import { EdicaoDeGruposComponent } from './edicao-de-grupos.component';
import { GruposDeDocumentosStore } from './grupos-de-documentos.store';

const NOMES = ['RG', 'CIN', 'CNH', 'Carteira de trabalho', 'Passaporte'];

function processoComDocumentos() {
  const documentos = rascunho(...NOMES.map((nome) => exigencia({ tipoDocumentoId: nome })));
  const draft = signal({ documentos });
  const patchSection = (_secao: string, valor: typeof documentos) =>
    draft.set({ documentos: valor });
  return { draft, patchSection };
}

function catalogoDasFormas() {
  return {
    formas: signal([
      { codigo: FormaDeComprovacaoCodigo.TODOS_OS_ITENS, rotulo: 'Todos os itens' },
      { codigo: FormaDeComprovacaoCodigo.QUANTIDADE_MINIMA_DE_ITENS, rotulo: 'Quantidade mínima' },
    ]),
    situacao: signal('pronto'),
    erro: signal(null),
    carregar: vi.fn(),
    repetir: vi.fn(),
  };
}

function provedoresDaFase() {
  return [
    {
      provide: FaseEmEdicao,
      useValue: {
        faseDoRascunho: signal({ codigo: 'HABILITACAO', produtos: [], congelados: null }),
      },
    },
    { provide: FormularioDoCronograma, useValue: { edicaoLiberada: signal(true) } },
    { provide: CatalogoDeFases, useValue: { fasePorId: signal(new Map()) } },
    {
      provide: CatalogoDeDocumentos,
      useValue: { tipoDocumentoPorId: signal(new Map(NOMES.map((nome) => [nome, { nome }]))) },
    },
  ];
}

function montar() {
  const processo = processoComDocumentos();
  TestBed.configureTestingModule({
    providers: [{ provide: ProcessoSeletivoStore, useValue: processo }, ...provedoresDaFase()],
  });
  const providers = [
    GruposDeDocumentosStore,
    { provide: CatalogoDasFormasDeComprovacao, useValue: catalogoDasFormas() },
  ];
  TestBed.overrideComponent(EdicaoDeGruposComponent, { set: { providers } });
  const fixture = TestBed.createComponent(EdicaoDeGruposComponent);
  fixture.detectChanges();
  return { fixture, draft: processo.draft };
}

function combinarCinco(fixture: ComponentFixture<EdicaoDeGruposComponent>): HTMLElement {
  const tela = fixture.nativeElement as HTMLElement;
  tela.querySelector<HTMLButtonElement>('button')?.click();
  fixture.detectChanges();
  tela.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((campo) => campo.click());
  fixture.detectChanges();
  [...tela.querySelectorAll('button')]
    .find((botao) => botao.textContent?.includes('Criar grupo'))
    ?.click();
  fixture.detectChanges();
  return tela;
}

describe('Edição de grupos de documentos', () => {
  it('combina cinco documentos com quantidade mínima igual a um', () => {
    const { fixture, draft } = montar();
    const tela = combinarCinco(fixture);
    expect(draft().documentos.regrasDeComprovacao[0].quantidadeMinima).toBe(1);
    expect(draft().documentos.regrasDeComprovacao[0].itens).toHaveLength(5);
    expect(tela.textContent).toContain(
      'Um destes 5 documentos: RG, CIN, CNH, Carteira de trabalho, Passaporte',
    );
    expect(document.activeElement).toBe(tela.querySelector('button'));
  });

  it('permite exigir todos os documentos combinados', () => {
    const { fixture, draft } = montar();
    const tela = combinarCinco(fixture);
    tela.querySelector<HTMLInputElement>('input[value=TODOS_OS_ITENS]')?.click();
    fixture.detectChanges();
    expect(draft().documentos.regrasDeComprovacao[0].forma).toBe('TODOS_OS_ITENS');
  });
});
