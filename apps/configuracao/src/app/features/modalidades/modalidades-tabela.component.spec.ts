import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModalidadesTabelaComponent } from './modalidades-tabela.component';

import {
  COMPOSICOES,
  MODALIDADE as modalidade,
  NATUREZAS,
  REGRAS,
} from './modalidades-tabela.testing';

describe('ModalidadesTabelaComponent', () => {
  let fixture: ComponentFixture<ModalidadesTabelaComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModalidadesTabelaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ModalidadesTabelaComponent);
    raiz = fixture.nativeElement as HTMLElement;
  });

  function montar(itens: readonly ModalidadeDto[], indisponivel: boolean): void {
    const entradas: Record<string, unknown> = {
      modalidades: itens,
      quemConcorre: new Map(itens.map((m) => [m.id, 'Todos os candidatos'])),
      referencias: new Map(),
      indisponivel,
      removendoId: indisponivel ? (itens[0]?.id ?? null) : null,
    };
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }

  it('indisponível, nenhuma ação da linha fica disponível e a linha sinaliza a remoção', () => {
    montar([modalidade], true);
    const acoes = [...raiz.querySelectorAll('td.table-responsive__actions button, td a.btn')];
    expect(acoes.length).toBeGreaterThanOrEqual(2);
    expect(
      acoes.filter(
        (a) => !(a as HTMLButtonElement).disabled && a.getAttribute('aria-disabled') !== 'true',
      ),
    ).toEqual([]);
    expect(raiz.querySelector('tr[data-codigo="V"]')?.textContent).toContain('Removendo...');
  });

  it('as ações da linha emitem a modalidade da linha', () => {
    montar([modalidade], false);
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

    it('exibe os rótulos recebidos e resume o remanejamento', () => {
      const itens = [
        com('A', {}),
        com('B', {
          naturezaLegal: NATUREZAS.cota,
          remanejamento: { regra: REGRAS.cascata, destino: null, par: null, fallback: null },
        }),
        com('C', {
          naturezaLegal: NATUREZAS.acao,
          composicaoVagas: COMPOSICOES.retirada,
          composicaoOrigem: 'A',
          remanejamento: { regra: REGRAS.destino, destino: 'A', par: null, fallback: null },
        }),
        com('D', {
          remanejamento: { regra: REGRAS.cruzado, destino: null, par: 'B', fallback: null },
        }),
      ];
      montar(itens, false);
      expect(linha('A', 'Remanejamento')).toBe('—');
      expect(linha('B', 'Natureza')).toBe(NATUREZAS.cota.rotulo);
      expect(linha('B', 'Remanejamento')).toBe(REGRAS.cascata.rotulo);
      expect(linha('C', 'Natureza')).toBe(NATUREZAS.acao.rotulo);
      expect(linha('C', 'Remanejamento')).toBe(`${REGRAS.destino.rotulo} → A`);
      expect(linha('C', 'Composição de vagas')).toBe(`${COMPOSICOES.retirada.rotulo} A`);
      expect(linha('D', 'Remanejamento')).toBe(`${REGRAS.cruzado.rotulo} (B / —)`);
    });

    it('lista as modalidades que referenciam a da linha, ou "Nenhuma"', () => {
      const itens = [com('A', {}), com('C', { composicaoOrigem: 'A' })];
      montar(itens, false);
      fixture.componentRef.setInput('referencias', new Map([['A', [itens[1]]]]));
      fixture.detectChanges();
      expect(linha('A', 'Referenciada por')).toBe('C');
      expect(linha('C', 'Referenciada por')).toBe('Nenhuma');
    });
  });
});
