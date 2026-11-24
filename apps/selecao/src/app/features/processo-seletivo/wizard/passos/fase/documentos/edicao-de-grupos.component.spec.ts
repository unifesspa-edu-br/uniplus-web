import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { exigencia, rascunho } from '../../../shared/exigencias/exigencias.testing';
import { CatalogoDosCriteriosDeDistincaoDeApresentacoes } from '../../cronograma/catalogos/catalogo-dos-criterios-de-distincao-de-apresentacoes.service';
import { CriterioDeDistincaoComponent } from './criterio-de-distincao.component';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { CatalogoDeFases } from '../../cronograma/catalogos/catalogo-de-fases.service';
import { CatalogoDasFormasDeComprovacao } from '../../cronograma/catalogos/catalogo-das-formas-de-comprovacao.service';
import { CatalogoDasConsequenciasDeIndeferimento } from '../../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
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
      provide: CatalogoDasConsequenciasDeIndeferimento,
      useValue: { consequencias: signal([]), situacao: signal('pronto'), erro: signal(null) },
    },
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
  TestBed.overrideComponent(CriterioDeDistincaoComponent, {
    set: {
      providers: [
        {
          provide: CatalogoDosCriteriosDeDistincaoDeApresentacoes,
          useValue: {
            criterios: signal([{ codigo: 'MENSAL', rotulo: 'Por mês' }]),
            situacao: signal('pronto'),
            erro: signal(null),
            carregar: vi.fn(),
            repetir: vi.fn(),
          },
        },
      ],
    },
  });
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
  it('grava e remove o critério escolhido no grupo', () => {
    const { fixture, draft } = montar();
    const tela = combinarCinco(fixture);
    const campo = tela.querySelector('sel-criterio-de-distincao select') as HTMLSelectElement;
    campo.value = 'MENSAL';
    campo.dispatchEvent(new Event('change'));
    expect(draft().documentos.regrasDeComprovacao[0].criterioDeDistincao).toBe('MENSAL');
    campo.value = '';
    campo.dispatchEvent(new Event('change'));
    expect(draft().documentos.regrasDeComprovacao[0].criterioDeDistincao).toBeNull();
  });
});
