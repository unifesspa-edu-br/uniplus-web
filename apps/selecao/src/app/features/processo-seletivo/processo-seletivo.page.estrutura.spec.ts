import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { ProviderToken } from '@angular/core';
import { By } from '@angular/platform-browser';
import { StepsResponsivoComponent } from '@uniplus/shared-ui/components';
import {
  SituacaoDoProcessoSeletivoCodigo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { configurarPagina } from './processo-seletivo.page.testing';
import { tituloDoPasso } from './wizard/shared/titulo-do-passo';
import { ROTULOS_DOS_PASSOS } from './wizard/processo-seletivo.data';
import { ProcessoSeletivoStore } from './wizard/processo-seletivo.store';
import { RecusasDaPublicacao } from './wizard/shared/recusas/recusas-da-publicacao.service';
import { NumeracaoDasRespostasRecusadas } from './wizard/shared/recusas/numeracao-das-respostas-recusadas';

const COMPONENTE_POR_ROTULO: Readonly<Record<string, string>> = {
  'Tipo do processo': 'sel-step-tipo-processo',
  Identificação: 'sel-step-identificacao',
  Pagamento: 'sel-step-pagamento',
  Vagas: 'sel-step-vagas',
  Cronograma: 'sel-step-cronograma',
  'Fórmula e precisão': 'sel-step-formula',
  FADA: 'sel-step-bonus',
  Desempate: 'sel-step-desempate',
  Eliminação: 'sel-step-eliminacao',
  'Atend. especial': 'sel-step-atendimento',
  'Prova presencial': 'sel-step-prova-presencial',
  Formulários: 'sel-step-formulario',
  'Revisão e publicação': 'sel-step-revisao',
};

const RECUSA_DE_EXEMPLO: Parameters<RecusasDaPublicacao['registrar']>[0] = {
  type: 'about:blank',
  title: 'x',
  status: 422,
  code: 'uniplus.x',
  traceId: 't',
  errors: [{ code: 'uniplus.y', message: 'Causa.' }],
};

const MODOS_DA_PAGINA: readonly (readonly [string, string | null])[] = [
  ['em edição', null],
  ['em consulta', SituacaoDoProcessoSeletivoCodigo.PUBLICADO],
];

type PaginaMontada = ComponentFixture<ProcessoSeletivoPage>;

function montarPaginaRenderizada(): PaginaMontada {
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  fixture.detectChanges();
  return fixture;
}

function montarPaginaNoModo(situacao: string | null): PaginaMontada {
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  if (situacao !== null) {
    fixture.debugElement.injector.get(ProcessoSeletivoStore).remoteSnapshot.set({
      id: 'processo-publicado',
      situacao: { codigo: situacao, rotulo: situacao },
    } as unknown as ProcessoSeletivoDto);
  }
  fixture.detectChanges();
  return fixture;
}

function paineisVisiveis(fixture: PaginaMontada): HTMLElement[] {
  const host = fixture.nativeElement as HTMLElement;
  return Array.from(host.querySelectorAll('.step-pane') as NodeListOf<HTMLElement>).filter(
    (painel) => !painel.hasAttribute('hidden'),
  );
}

function esperarPainelDoPasso(fixture: PaginaMontada, rotulo: string, indice: number): void {
  const visiveis = paineisVisiveis(fixture);

  expect(visiveis, `nenhum painel visível no passo ${indice} ("${rotulo}")`).toHaveLength(1);
  expect(
    visiveis[0].firstElementChild?.tagName.toLowerCase(),
    `no passo ${indice} o stepper anuncia "${rotulo}", mas o painel visível é outro`,
  ).toBe(COMPONENTE_POR_ROTULO[rotulo]);
}

function esperarSemRolagemPropria(fixture: PaginaMontada): void {
  const wizContent = (fixture.nativeElement as HTMLElement).querySelector('.wiz-content');
  expect(wizContent?.hasAttribute('uiBackToTopContainer')).toBe(false);
  expect(wizContent?.hasAttribute('tabindex')).toBe(false);
  expect(wizContent?.getAttribute('role')).toBeNull();
}

function dialogoDasEtapas(fixture: PaginaMontada): HTMLDialogElement {
  const dialog = (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>(
    'dialog.steps-overlay',
  );
  if (dialog === null) throw new Error('Diálogo de etapas ausente.');
  return dialog;
}

function etapasDaPagina(fixture: PaginaMontada): StepsResponsivoComponent {
  return fixture.debugElement.query(By.directive(StepsResponsivoComponent))
    .componentInstance as StepsResponsivoComponent;
}

function mesmoProvedorEmDuasPaginas<T>(token: ProviderToken<T>): [T, T] {
  const primeira = TestBed.createComponent(ProcessoSeletivoPage);
  const segunda = TestBed.createComponent(ProcessoSeletivoPage);
  return [primeira.debugElement.injector.get(token), segunda.debugElement.injector.get(token)];
}

describe('ProcessoSeletivoPage — estrutura', () => {
  beforeEach(configurarPagina);

  /**
   * O painel de cada passo é escolhido pela POSIÇÃO — `[hidden]` compara com
   * `passoAtual()` —, e o validador que decide o avanço também é resolvido por
   * índice. Um painel a mais ou a menos desalinha rótulo, conteúdo e validação
   * de todos os passos seguintes: o passo mostraria um formulário e cobraria os
   * campos de outro, e o último passo ficaria inalcançável.
   *
   * Nenhum gate pegava isso — o template compila com painel vazio, e os testes
   * de passo montam cada componente isoladamente.
   */
  it('tem um painel por passo declarado, sem sobra nem lacuna', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const paineis = Array.from(host.querySelectorAll('.step-pane') as NodeListOf<HTMLElement>);

    expect(paineis).toHaveLength(ROTULOS_DOS_PASSOS.length);
    for (const painel of paineis) {
      expect(
        painel.children.length,
        `painel de passo vazio em "${painel.outerHTML.slice(0, 80)}"`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * O painel e o validador de cada passo são resolvidos por ÍNDICE, mas o índice de cada um vem
   * de duas fontes diferentes: o rótulo sai de `PASSOS`, e o painel e o validador saem da ordem
   * em que o template declara as seções — treze literais `passoAtual() !== N` escritos à mão e
   * um `viewChildren` que lê a ordem de declaração.
   *
   * Reordenar um passo mexendo só em `PASSOS` dessincroniza os dois lados **sem erro de
   * compilação**: o stepper anuncia um passo e a tela mostra outro, e `validar()`/`persistir()`
   * operam no componente errado. Este teste amarra os dois.
   */
  it('o painel visível em cada índice é o do passo que o stepper anuncia', () => {
    const fixture = montarPaginaRenderizada();

    expect(Object.keys(COMPONENTE_POR_ROTULO)).toEqual([...ROTULOS_DOS_PASSOS]);

    ROTULOS_DOS_PASSOS.forEach((rotulo, indice) => {
      fixture.componentInstance.store.goTo(indice);
      fixture.detectChanges();
      esperarPainelDoPasso(fixture, rotulo, indice);
    });
  });

  it('o título do passo, destino do foco das leituras, existe uma vez e fora dos painéis ocultos', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    fixture.componentInstance.store.goTo(3);
    fixture.detectChanges();

    const titulo = tituloDoPasso();

    expect(titulo?.textContent).toContain(ROTULOS_DOS_PASSOS[3]);
    expect(titulo?.closest('[hidden]')).toBeNull();
    expect(document.querySelectorAll('.step-head h1')).toHaveLength(1);
  });

  it('não declara landmark main próprio', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('main').length).toBe(0);
  });

  it('não recria o shell da aplicação', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.admin-shell')).toBeNull();
    expect(host.querySelector('.admin-main')).toBeNull();
    expect(host.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('mantém a área útil do wizard', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.wiz-shell')).not.toBeNull();
    expect(host.querySelector('.wiz-content')).not.toBeNull();
  });

  it.each(MODOS_DA_PAGINA)(
    '%s, .wiz-content não é contêiner de rolagem próprio: rola o .page do shell',
    (_modo, status) => {
      esperarSemRolagemPropria(montarPaginaNoModo(status));
    },
  );
});

describe('ProcessoSeletivoPage — lista de etapas', () => {
  beforeEach(configurarPagina);

  function montar() {
    const fixture = montarPaginaRenderizada();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>(
      'dialog.steps-overlay',
    );
    if (dialog === null) {
      throw new Error('A lista de etapas precisa ser um <dialog> para conter o foco.');
    }
    return { fixture, page: fixture.componentInstance, dialog, etapas: etapasDaPagina(fixture) };
  }

  function instrumentar(dialog: HTMLDialogElement) {
    const showModal = vi.fn();
    dialog.showModal = showModal;
    dialog.close = vi.fn(() => dialog.dispatchEvent(new Event('close')));
    return showModal;
  }

  function montarComListaAberta() {
    const { fixture, dialog, etapas } = montar();
    const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);
    instrumentar(dialog);
    etapas.abrir();
    return { fixture, dialog, etapas, store };
  }

  function tituloDoPassoOuFalha(fixture: PaginaMontada): HTMLElement {
    const titulo = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.step-head h1',
    );
    if (titulo === null) throw new Error('Título do passo ausente.');
    return titulo;
  }

  function botoesAtuaisDaColunaLateral(fixture: PaginaMontada): NodeListOf<Element> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll(
      'nav[aria-label="Etapas do cadastro"] li button[aria-current="step"]',
    );
  }

  it('abre a lista de etapas como diálogo modal', () => {
    const { dialog, etapas } = montar();
    const showModal = instrumentar(dialog);
    etapas.abrir();

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(etapas.aberto()).toBe(true);
  });

  it('mantém o passo atual como ativo mesmo já concluído, para o aria-current não sumir', () => {
    const { fixture } = montar();
    const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);

    store.syncCompleted([1]);
    store.goTo(1);
    fixture.detectChanges();

    const atuais = botoesAtuaisDaColunaLateral(fixture);
    expect(atuais.length).toBe(1);
    expect(atuais[0].textContent).toContain(store.labels[1]);
    expect(atuais[0].textContent).toContain('(concluída)');
  });

  it('o passo acionado na coluna lateral vai para o store, sem fechar a lista', () => {
    const { fixture, etapas, store } = montarComListaAberta();

    const botoes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Etapas do cadastro"] li button',
    );
    botoes[2].click();

    expect(store.passoAtual()).toBe(2);
    expect(etapas.aberto()).toBe(true);
  });

  it('o passo acionado na lista em diálogo vai para o store e fecha a lista', () => {
    const { dialog, etapas, store } = montarComListaAberta();

    dialog.querySelectorAll<HTMLButtonElement>('ui-steps li button')[3].click();

    expect(store.passoAtual()).toBe(3);
    expect(etapas.aberto()).toBe(false);
  });

  it('escolher na lista em diálogo o passo em que já se está leva o foco ao título dele', async () => {
    const { fixture, dialog, store } = montarComListaAberta();
    const titulo = tituloDoPassoOuFalha(fixture);
    document.body.append(fixture.nativeElement);

    dialog.querySelectorAll<HTMLButtonElement>('ui-steps li button')[store.passoAtual()].click();
    await Promise.resolve();

    expect(document.activeElement).toBe(titulo);
    fixture.nativeElement.remove();
  });

  it('sincroniza o estado quando o diálogo fecha', () => {
    const { dialog, etapas } = montar();
    instrumentar(dialog);

    etapas.abrir();
    etapas.fechar();

    expect(etapas.aberto()).toBe(false);
  });
});

describe('ProcessoSeletivoPage — bloqueio de scroll', () => {
  beforeEach(configurarPagina);

  it('libera o bloqueio de scroll ao destruir a página com overlay aberto', () => {
    const fixture = montarPaginaRenderizada();
    dialogoDasEtapas(fixture).showModal = vi.fn();

    etapasDaPagina(fixture).abrir();
    fixture.detectChanges();
    expect(document.body.classList.contains('ui-overlay-open')).toBe(true);

    fixture.destroy();
    expect(document.body.classList.contains('ui-overlay-open')).toBe(false);
  });

  it('provê uma numeração das respostas recusadas por página, para todos os passos', () => {
    const [daPrimeira, daSegunda] = mesmoProvedorEmDuasPaginas(NumeracaoDasRespostasRecusadas);

    daPrimeira.proxima();

    expect(daPrimeira.proxima()).toBe(2);
    expect(daSegunda.proxima()).toBe(1);
  });

  it('provê as recusas da publicação por página, para a Revisão escrever e o Cronograma ler', () => {
    const [daPrimeira, daSegunda] = mesmoProvedorEmDuasPaginas(RecusasDaPublicacao);

    daPrimeira.registrar(RECUSA_DE_EXEMPLO, 'x');

    expect(daPrimeira.recusas()).toHaveLength(1);
    expect(daSegunda.recusas()).toHaveLength(0);
  });
});
