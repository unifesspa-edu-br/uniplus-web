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
      rotulos: new Map(itens.map((m) => [m.codigo, m.nome ? `${m.codigo} — ${m.nome}` : m.codigo])),
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
    raiz
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remover modalidade V — Modalidade de teste V"]',
      )
      ?.click();
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
      nome: `Nome ${codigo}`,
      descricao: null,
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
      expect(linha('C', 'Remanejamento')).toBe(`${REGRAS.destino.rotulo} → A — Nome A`);
      expect(linha('C', 'Composição de vagas')).toBe(`${COMPOSICOES.retirada.rotulo} A — Nome A`);
      expect(linha('D', 'Remanejamento')).toBe(`${REGRAS.cruzado.rotulo} (B — Nome B / —)`);
    });

    it('mostra código e nome na coluna Modalidade, com ações de nome acessível igual', () => {
      montar([com('A', {})], false);
      expect(linha('A', 'Modalidade')).toBe('A — Nome A');
      expect(raiz.querySelector('th')?.textContent?.trim()).toBe('Modalidade');
      expect(raiz.querySelector('[aria-label="Editar modalidade A — Nome A"]')).not.toBeNull();
    });

    it('sem nome, mostra só o código na coluna, nas ações e no remanejamento', () => {
      const origem = com('A', { nome: '' });
      const itens = [
        origem,
        com('C', {
          remanejamento: { regra: REGRAS.destino, destino: 'A', par: null, fallback: null },
        }),
      ];
      montar(itens, false);
      expect(linha('A', 'Modalidade')).toBe('A');
      expect(raiz.querySelector('[aria-label="Remover modalidade A"]')).not.toBeNull();
      expect(linha('C', 'Remanejamento')).toBe(`${REGRAS.destino.rotulo} → A`);
    });

    it('quebra em qualquer ponto o código com nome e o nome sem espaços, sem estourar o cartão', () => {
      const longo = com('A', { nome: 'NomeSemEspacosMuitoLongoParaCaberEmTelaDe320Pixels' });
      montar([longo, com('C', { composicaoOrigem: 'A' })], false);
      fixture.componentRef.setInput('referencias', new Map([['C', [longo]]]));
      fixture.detectChanges();
      const quebram = (seletor: string): boolean[] =>
        [...raiz.querySelectorAll(seletor)].map(
          (e) => getComputedStyle(e).overflowWrap === 'anywhere',
        );
      expect(quebram('td[data-label="Modalidade"], td[data-label="Modalidade"] code')).toEqual([
        true,
        true,
        true,
        true,
      ]);
      expect(quebram('.cfg-refs code')).toEqual([true]);
    });

    it('lista as modalidades que referenciam a da linha, ou "Nenhuma"', () => {
      const itens = [com('A', {}), com('C', { composicaoOrigem: 'A' })];
      montar(itens, false);
      fixture.componentRef.setInput('referencias', new Map([['A', [itens[1]]]]));
      fixture.detectChanges();
      expect(linha('A', 'Referenciada por')).toBe('C — Nome C');
      expect(linha('C', 'Referenciada por')).toBe('Nenhuma');
    });
  });
});
