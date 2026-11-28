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
import { RecusasDasExigencias } from './recusas-das-exigencias.service';
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

function provedoresDaFase(admiteComplementacao: boolean, liberada: boolean) {
  return [
    {
      provide: FaseEmEdicao,
      useValue: {
        faseDoRascunho: signal({ codigo: 'HABILITACAO', produtos: [], congelados: null }),
        admiteComplementacao: signal(admiteComplementacao),
      },
    },
    { provide: FormularioDoCronograma, useValue: { edicaoLiberada: signal(liberada) } },
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

function montar(admiteComplementacao = false, liberada = true) {
  const processo = processoComDocumentos();
  TestBed.configureTestingModule({
    providers: [
      { provide: ProcessoSeletivoStore, useValue: processo },
      RecusasDasExigencias,
      ...provedoresDaFase(admiteComplementacao, liberada),
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
  return { fixture, draft: processo.draft, recusas: TestBed.inject(RecusasDasExigencias) };
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

  describe('combinação e edição do grupo', () => {
    const botao = (tela: HTMLElement, texto: string) =>
      [...tela.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
    const grupo = (draft: ReturnType<typeof montar>['draft']) =>
      draft().documentos.regrasDeComprovacao[0];
    const escolher = (tela: HTMLElement, selecao: HTMLSelectElement, valor: string) => {
      selecao.value = valor;
      selecao.dispatchEvent(new Event('change'));
      return tela;
    };

    it('só libera "Criar grupo" com dois ou mais documentos escolhidos', () => {
      const { fixture } = montar();
      const tela = fixture.nativeElement as HTMLElement;
      (botao(tela, 'Combinar') as HTMLButtonElement).click();
      fixture.detectChanges();
      const campos = tela.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
      expect(botao(tela, 'Criar grupo')?.disabled).toBe(true);
      campos[0].click();
      campos[1].click();
      fixture.detectChanges();
      expect(botao(tela, 'Criar grupo')?.disabled).toBe(false);
      campos[1].click();
      fixture.detectChanges();
      expect(botao(tela, 'Criar grupo')?.disabled).toBe(true);
    });

    it('abre e fecha a lista de documentos pelo botão "Combinar documentos"', () => {
      const { fixture } = montar();
      const tela = fixture.nativeElement as HTMLElement;
      const combinar = botao(tela, 'Combinar') as HTMLButtonElement;
      expect(combinar.getAttribute('aria-expanded')).toBe('false');
      expect(tela.querySelector('fieldset')).toBeNull();
      combinar.click();
      fixture.detectChanges();
      expect(combinar.getAttribute('aria-expanded')).toBe('true');
      expect(tela.querySelector('legend')?.textContent).toContain('dois ou mais documentos');
      combinar.click();
      fixture.detectChanges();
      expect(tela.querySelector('fieldset')).toBeNull();
    });

    it('avisa quando os documentos escolhidos não são do mesmo formulário', () => {
      const { fixture, draft } = montar();
      (draft as unknown as { set(v: unknown): void }).set({
        documentos: rascunho(
          exigencia({ tipoDocumentoId: 'RG' }),
          exigencia({ tipoDocumentoId: 'CIN', formularioCodigo: 'ISENCAO_TAXA' }),
        ),
      });
      const tela = combinarCinco(fixture);
      expect(tela.querySelector('[role=status]')?.textContent).toContain(
        'Escolha documentos do mesmo momento de coleta e formulário.',
      );
      expect(draft().documentos.regrasDeComprovacao.every((r) => r.forma === 'DOCUMENTO')).toBe(
        true,
      );
    });

    it('com a edição bloqueada, não deixa combinar nem alterar', () => {
      const { fixture } = montar(false, false);
      const tela = fixture.nativeElement as HTMLElement;
      expect((botao(tela, 'Combinar') as HTMLButtonElement).disabled).toBe(true);
    });

    it('com a edição bloqueada e o grupo já criado, os campos do grupo ficam desabilitados', () => {
      const { fixture, draft } = montar();
      const tela = combinarCinco(fixture);
      const liberada = TestBed.inject(FormularioDoCronograma).edicaoLiberada as unknown as {
        set(v: boolean): void;
      };
      liberada.set(false);
      fixture.detectChanges();
      expect(grupo(draft)).toBeDefined();
      expect(botao(tela, 'Incluir documento')?.disabled).toBe(true);
      expect(botao(tela, 'Retirar do grupo')?.disabled).toBe(true);
    });

    it('troca a quantidade mínima e avisa', () => {
      const { fixture, draft } = montar();
      const tela = combinarCinco(fixture);
      tela.querySelector<HTMLInputElement>('input[value=QUANTIDADE_MINIMA_DE_ITENS]')?.click();
      fixture.detectChanges();
      const campo = tela.querySelector<HTMLInputElement>('input[type=number]') as HTMLInputElement;
      campo.value = '3';
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(grupo(draft).quantidadeMinima).toBe(3);
      expect(tela.querySelector('[role=status]')?.textContent).toContain(
        'Quantidade mínima atualizada.',
      );
    });

    it('retira um documento do grupo e o inclui de novo, devolvendo o foco ao botão', () => {
      const { fixture, draft } = montar();
      const tela = combinarCinco(fixture);
      botao(tela, 'Retirar do grupo')?.click();
      fixture.detectChanges();
      expect(grupo(draft).itens).toHaveLength(4);
      expect(tela.querySelector('[role=status]')?.textContent).toContain(
        'Documento retirado do grupo.',
      );
      expect(document.activeElement).toBe(tela.querySelector('button'));
      const selecao = tela.querySelector('select[id^=incluir-]') as HTMLSelectElement;
      expect(selecao.options).toHaveLength(2);
      escolher(tela, selecao, selecao.options[1].value);
      fixture.detectChanges();
      botao(tela, 'Incluir documento')?.click();
      fixture.detectChanges();
      expect(grupo(draft).itens).toHaveLength(5);
      expect(tela.querySelector('[role=status]')?.textContent).toContain(
        'Documento incluído no grupo.',
      );
    });

    it('grava a consequência escolhida e volta a "não decide sozinha" ao esvaziar', () => {
      const { fixture, draft } = montar();
      const tela = combinarCinco(fixture);
      const selecao = tela.querySelector('select[id^=consequencia-]') as HTMLSelectElement;
      expect(selecao.options[0].textContent).toContain('Nada além de faltar');
      selecao.options[0].value = 'ELIMINA_DO_PROCESSO';
      escolher(tela, selecao, 'ELIMINA_DO_PROCESSO');
      fixture.detectChanges();
      expect(grupo(draft).consequencia).toBe('ELIMINA_DO_PROCESSO');
      expect(tela.querySelector('[role=status]')?.textContent).toContain(
        'Consequência do grupo atualizada.',
      );
      escolher(tela, selecao, '');
      expect(grupo(draft).consequencia).toBeNull();
    });

    it('reabre a lista e mostra a recusa do servidor; trocar a consequência a limpa', () => {
      const { fixture, draft, recusas } = montar();
      const tela = combinarCinco(fixture);
      (botao(tela, 'Combinar') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(tela.querySelector('sel-grupo-de-documentos')).toBeNull();
      recusas.registrar([
        {
          identificadorDaRegra: grupo(draft).identificadorNoRascunho,
          campo: 'indeferimento.consequencia',
          codigo: 'CONSEQUENCIA_INVALIDA',
          mensagem: 'Escolha uma consequência válida para o grupo.',
        },
      ]);
      fixture.detectChanges();
      expect(tela.textContent).toContain('Escolha uma consequência válida para o grupo.');
      const selecao = tela.querySelector('select[id^=consequencia-]') as HTMLSelectElement;
      expect(selecao.getAttribute('aria-invalid')).toBe('true');
      escolher(tela, selecao, '');
      fixture.detectChanges();
      expect(tela.textContent).not.toContain('Escolha uma consequência válida para o grupo.');
    });
  });
});
