import { afterEach, describe, expect, it } from 'vitest';

import { soPeloDesempate } from '../classificacao/recusas-da-formula.testing';
import { FormulaPassoComponent } from './formula.component';
import {
  MontagemDe,
  RESOLUCAO,
  SELETOR_RESOLUCAO,
  encerrarMontagem,
  montar,
  rascunhoComResolucao,
  responderPesos,
  texto,
} from './peso-por-area.testing';

const MENSAGEM = 'Mensagem inventada sobre o critério de desempate na ordem 3.';
const ERRO_FORA_DA_RESOLUCAO = '#f-baseado-enem-erro';

function recusarPeloDesempate(m: MontagemDe<FormulaPassoComponent>): void {
  m.store.classificacao.registrarRecusasDaFormula(soPeloDesempate(MENSAGEM), 0);
  m.fixture.detectChanges();
}

function caixaDoEnem(m: MontagemDe<FormulaPassoComponent>): HTMLInputElement {
  const caixa = m.el.querySelector<HTMLInputElement>('input#f-baseado-enem');
  if (caixa === null) throw new Error('caixa do ENEM ausente');
  return caixa;
}

describe('FormulaPassoComponent — recusa pelo desempate gravado', () => {
  afterEach(encerrarMontagem);

  it('sem a resolução na tela, mostra a mensagem depois da caixa do ENEM, ligada a ela', async () => {
    const m = await montar(FormulaPassoComponent, {});
    recusarPeloDesempate(m);

    const erro = m.el.querySelector(ERRO_FORA_DA_RESOLUCAO);
    expect(texto(erro)).toBe(MENSAGEM);
    expect(m.el.querySelector(SELETOR_RESOLUCAO)).toBeNull();
    expect(caixaDoEnem(m).getAttribute('aria-describedby')).toBe('f-baseado-enem-erro');
    expect(caixaDoEnem(m).getAttribute('aria-invalid')).toBe('true');
  });

  it('marcar o ENEM faz a mensagem sumir, e ela não reaparece sob a resolução', async () => {
    const m = await montar(FormulaPassoComponent, {});
    recusarPeloDesempate(m);

    m.componente.escolherRegraCalculo('FORMULA_MEDIA_PONDERADA|1.0');
    m.componente.alternarBaseadoEmEnem(true);
    m.fixture.detectChanges();
    responderPesos(m);
    m.fixture.detectChanges();

    expect(m.el.querySelector(ERRO_FORA_DA_RESOLUCAO)).toBeNull();
    expect(texto(m.el)).not.toContain(MENSAGEM);
    expect(caixaDoEnem(m).getAttribute('aria-describedby')).toBeNull();
  });

  it('trocar a regra de cálculo faz a mensagem sumir', async () => {
    const m = await montar(FormulaPassoComponent, {});
    recusarPeloDesempate(m);

    m.componente.escolherRegraCalculo('CLASSIFICACAO_IMPORTADA|1.0');
    m.fixture.detectChanges();

    expect(m.el.querySelector(ERRO_FORA_DA_RESOLUCAO)).toBeNull();
    expect(m.store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('com a resolução exigida, mostra a mensagem só sob a resolução, sem repetir depois da caixa', async () => {
    const m = await montar(FormulaPassoComponent, {
      antesDeMontar: rascunhoComResolucao(RESOLUCAO),
    });
    responderPesos(m);
    recusarPeloDesempate(m);

    expect(m.el.querySelector(ERRO_FORA_DA_RESOLUCAO)).toBeNull();
    expect(texto(m.el).split(MENSAGEM)).toHaveLength(2);
  });
});
