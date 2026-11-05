import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModalidadesListaComponent } from './modalidades-lista.component';

const modalidade: ModalidadeDto = {
  id: 'id-v',
  codigo: 'V',
  legalFixa: false,
  descricao: 'Modalidade V',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESIDUAL_DO_VO',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

describe('ModalidadesListaComponent', () => {
  let fixture: ComponentFixture<ModalidadesListaComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModalidadesListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ModalidadesListaComponent);
    raiz = fixture.nativeElement as HTMLElement;
  });

  function montar(itens: readonly ModalidadeDto[], temFiltro: boolean, removendo: boolean): void {
    const entradas: Record<string, unknown> = {
      filtrosAtivos: [],
      chipsNatureza: [{ value: 'AMPLA', label: 'Ampla', count: itens.length }],
      modalidadesFiltradas: itens,
      quemConcorre: new Map(itens.map((m) => [m.id, 'Todos os candidatos'])),
      referencias: new Map(),
      loading: false,
      errorMessage: null,
      temFiltroAtivo: temFiltro,
      prevCursor: 'anterior',
      nextCursor: 'proximo',
      removendo,
      modalidadeEmRemocao: itens[0] ?? null,
    };
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }

  const indisponivel = (acionador: Element): boolean =>
    (acionador as HTMLButtonElement).disabled ||
    acionador.getAttribute('aria-disabled') === 'true' ||
    acionador.closest('[inert]') !== null;
  const botao = (texto: string): HTMLButtonElement | undefined =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(texto),
    );

  it('com remoção em curso, nenhum acionador da lista fica disponível', () => {
    montar([modalidade], true, true);
    const acionadores = [...raiz.querySelectorAll('button, a.btn')];
    expect(acionadores.length).toBeGreaterThanOrEqual(6);
    expect(acionadores.filter((a) => !indisponivel(a))).toEqual([]);
    expect(botao('Limpar')?.disabled).toBe(true);
    const paginacao = [...raiz.querySelectorAll('ui-pager button')];
    expect(paginacao).toHaveLength(2);
    expect(paginacao.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('com remoção em curso, "Limpar filtros" do estado vazio fica desabilitado', () => {
    montar([], true, true);
    expect(botao('Limpar filtros')?.disabled).toBe(true);
  });

  it('sem remoção, os acionadores de limpar e de paginação respondem', () => {
    montar([], true, false);
    const pedidos: string[] = [];
    fixture.componentInstance.limpar.subscribe(() => pedidos.push('limpar'));
    fixture.componentInstance.proximo.subscribe(() => pedidos.push('proximo'));
    botao('Limpar filtros')?.click();
    botao('Próximo')?.click();
    expect(pedidos).toEqual(['limpar', 'proximo']);
  });

  it('as ações da linha emitem a modalidade da linha', () => {
    montar([modalidade], false, false);
    const removidas: ModalidadeDto[] = [];
    fixture.componentInstance.remover.subscribe((m) => removidas.push(m));
    raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.click();
    expect(removidas).toEqual([modalidade]);
  });

  describe('apresentação das colunas', () => {
    const linha = (codigo: string, coluna: string): string =>
      (
        raiz.querySelector(`tr[data-codigo="${codigo}"] td[data-label="${coluna}"]`) as HTMLElement
      ).textContent
        ?.replace(/\s+/g, ' ')
        .trim() ?? '';
    const com = (codigo: string, parte: Partial<ModalidadeDto>): ModalidadeDto => ({
      ...modalidade,
      id: `id-${codigo}`,
      codigo,
      ...parte,
    });

    it('resume o remanejamento por regra e traduz natureza e composição', () => {
      const itens = [
        com('A', {}),
        com('B', {
          naturezaLegal: 'COTA_RESERVADA',
          regraRemanejamento: 'SEGUE_CASCATA',
        }),
        com('C', {
          naturezaLegal: 'ACAO_AFIRMATIVA',
          composicaoVagas: 'RETIRA_DE',
          composicaoOrigem: 'A',
          regraRemanejamento: 'DESTINO_UNICO',
          remanejamentoDestino: 'A',
        }),
        com('D', {
          naturezaLegal: 'ACAO_AFIRMATIVA',
          regraRemanejamento: 'CRUZADO',
          remanejamentoPar: 'B',
          remanejamentoFallback: null,
        }),
        com('E', { naturezaLegal: 'INEDITA', composicaoVagas: 'INEDITA' }),
      ];
      montar(itens, false, false);
      expect(linha('A', 'Remanejamento')).toBe('—');
      expect(linha('B', 'Remanejamento')).toMatch(/^Segue .+$/i);
      expect(linha('C', 'Remanejamento')).toMatch(/ → A$/);
      expect(linha('C', 'Composição de vagas')).toMatch(/ A$/);
      expect(linha('D', 'Remanejamento')).toMatch(/\(B \/ —\)$/);
      expect(linha('E', 'Natureza')).toBe('INEDITA');
      expect(linha('E', 'Composição de vagas')).toBe('INEDITA');
    });

    it('lista as modalidades que referenciam a da linha, ou "Nenhuma"', () => {
      const itens = [com('A', {}), com('C', { composicaoOrigem: 'A' })];
      montar(itens, false, false);
      fixture.componentRef.setInput('referencias', new Map([['A', [itens[1]]]]));
      fixture.detectChanges();
      expect(linha('A', 'Referenciada por')).toBe('C');
      expect(linha('C', 'Referenciada por')).toBe('Nenhuma');
    });
  });
});
