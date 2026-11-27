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

function provedoresDaFase(admiteComplementacao: boolean) {
  return [
    {
      provide: FaseEmEdicao,
      useValue: {
        faseDoRascunho: signal({ codigo: 'HABILITACAO', produtos: [], congelados: null }),
        admiteComplementacao: signal(admiteComplementacao),
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

function montar(admiteComplementacao = false) {
  const processo = processoComDocumentos();
  TestBed.configureTestingModule({
    providers: [
      { provide: ProcessoSeletivoStore, useValue: processo },
      ...provedoresDaFase(admiteComplementacao),
    ],
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

  describe('prazo para reenvio do grupo', () => {
    const caixa = (tela: HTMLElement) =>
      tela.querySelector<HTMLInputElement>('sel-prazo-para-reenvio input');
    const grupo = (draft: ReturnType<typeof montar>['draft']) =>
      draft().documentos.regrasDeComprovacao[0];

    it('não oferece a caixa em fase que não admite complementação', () => {
      const { fixture } = montar(false);
      expect(caixa(combinarCinco(fixture))).toBeNull();
    });

    it('marcar e desmarcar chega ao rascunho, com rótulo e aviso', () => {
      const { fixture, draft } = montar(true);
      const tela = combinarCinco(fixture);
      const campo = caixa(tela) as HTMLInputElement;
      expect(tela.querySelector(`label[for="${campo.id}"]`)?.textContent).toContain(
        'reenviar os documentos',
      );
      campo.click();
      fixture.detectChanges();
      expect(grupo(draft).abrePrazoParaReenvio).toBe(true);
      expect(tela.querySelector('[role=status]')?.textContent).toContain(
        'Prazo para reenvio do grupo atualizado.',
      );
      caixa(tela)?.click();
      expect(grupo(draft).abrePrazoParaReenvio).toBe(false);
    });

    it('mantém visível o prazo já gravado e não o apaga ao trocar consequência ou norma', () => {
      const { fixture, draft } = montar(false);
      const tela = combinarCinco(fixture);
      const identificador = grupo(draft).identificadorNoRascunho;
      const componente = fixture.componentInstance as unknown as {
        atualizarConsequencia(regra: unknown, valor: string): void;
        atualizarNormas(regra: unknown, bases: unknown[]): void;
        grupos: GruposDeDocumentosStore;
      };
      componente.grupos.editar(identificador, { abrePrazoParaReenvio: true });
      fixture.detectChanges();
      expect(caixa(tela)?.checked).toBe(true);
      componente.atualizarConsequencia(grupo(draft), 'ELIMINA_DO_PROCESSO');
      componente.atualizarNormas(grupo(draft), []);
      expect(grupo(draft)).toMatchObject({
        abrePrazoParaReenvio: true,
        consequencia: 'ELIMINA_DO_PROCESSO',
        basesLegais: [],
      });
    });
  });
});
