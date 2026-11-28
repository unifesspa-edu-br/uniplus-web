import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AC, modalidade } from './modalidades-de-teste.testing';
import { PaginaDaListaDeModalidades } from './modalidades-list.page.testing';
import { COMPOSICOES, NATUREZAS, REGRAS } from './modalidades-tabela.testing';

const RESERVADA = modalidade({ id: 'id-par', codigo: 'PAR', nome: 'Modalidade par' });
const ALTERNATIVA = modalidade({ id: 'id-alt', codigo: 'ALT', nome: 'Modalidade alternativa' });
const RETIRA_DE_AC = modalidade({
  id: 'id-ret',
  codigo: 'RET',
  nome: 'Modalidade retirada',
  naturezaLegal: NATUREZAS.acao,
  composicaoVagas: COMPOSICOES.retirada,
  composicaoOrigem: 'AC',
  remanejamento: { regra: REGRAS.destino, destino: 'AC', par: null, fallback: null },
});
const CRUZADA = modalidade({
  id: 'id-cruz',
  codigo: 'CRU',
  nome: 'Modalidade cruzada',
  remanejamento: { regra: REGRAS.cruzado, destino: null, par: 'PAR', fallback: 'ALT' },
});

describe('ModalidadesListPage com a lista em mais de uma página', () => {
  let pagina: PaginaDaListaDeModalidades;

  const celula = (codigo: string, coluna: string): string | undefined =>
    (
      pagina.fixture.nativeElement.querySelector(
        `tr[data-codigo="${codigo}"] td[data-label="${coluna}"]`,
      ) as HTMLElement
    ).textContent
      ?.replace(/\s+/g, ' ')
      .trim();

  beforeEach(async () => {
    pagina = new PaginaDaListaDeModalidades();
    await pagina.flushEmDuasPaginas([RETIRA_DE_AC, CRUZADA], [AC, RESERVADA, ALTERNATIVA]);
    pagina.fixture.detectChanges();
  });

  afterEach(() => {
    pagina.verificar();
  });

  it('mostra as modalidades de todas as páginas', () => {
    expect(pagina.component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual([
      'RET',
      'CRU',
      'AC',
      'PAR',
      'ALT',
    ]);
  });

  it('nomeia a origem e o destino que estão em outra página', () => {
    const origem = 'AC — Modalidade de teste Alfa';
    expect(celula('RET', 'Composição de vagas')).toBe(`${COMPOSICOES.retirada.rotulo} ${origem}`);
    expect(celula('RET', 'Remanejamento')).toBe(`${REGRAS.destino.rotulo} → ${origem}`);
  });

  it('nomeia o par e a alternativa que estão em outra página', () => {
    expect(celula('CRU', 'Remanejamento')).toBe(
      `${REGRAS.cruzado.rotulo} (PAR — Modalidade par / ALT — Modalidade alternativa)`,
    );
  });

  it('mostra quem referencia uma modalidade que está em outra página', () => {
    expect(celula('AC', 'Referenciada por')).toBe('RET — Modalidade retirada');
    expect(celula('PAR', 'Referenciada por')).toBe('CRU — Modalidade cruzada');
  });

  it('a busca por nome encontra modalidade da segunda página', () => {
    pagina.component['busca'].set('ALTERNATIVA');
    expect(pagina.component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['ALT']);
  });

  it('a contagem por natureza soma as modalidades de todas as páginas', () => {
    const chips = pagina.component['chipsNatureza']();
    expect(chips.find((c) => c.value === NATUREZAS.ampla.codigo)?.count).toBe(4);
    expect(chips.find((c) => c.value === NATUREZAS.acao.codigo)?.count).toBe(1);
  });
});
