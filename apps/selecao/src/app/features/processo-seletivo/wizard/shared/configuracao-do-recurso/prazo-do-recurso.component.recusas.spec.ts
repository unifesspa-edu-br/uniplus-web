import { describe, expect, it } from 'vitest';

import { idsDosParametros } from './ids-dos-parametros';
import type { IdsDoPrazo } from './prazo-do-recurso.component';
import {
  campoDaUnidade,
  campoDoValor,
  elemento,
  IDS,
  IDS_COM_AJUDA,
  montarPrazo,
  umaRecusa,
  descritoPor,
  UNIDADES,
} from './prazo-do-recurso.testing';

describe('PrazoDoRecursoComponent: recusas', () => {
  it('marca e descreve só o valor quando só o valor é recusado', () => {
    const fixture = montarPrazo({ recusasDoValor: [umaRecusa('prazoValor')] });

    expect(campoDoValor(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(descritoPor(campoDoValor(fixture))).toEqual([IDS.recusasDoValor]);
    expect(campoDaUnidade(fixture).hasAttribute('aria-invalid')).toBe(false);
    expect(descritoPor(campoDaUnidade(fixture))).toEqual([]);
    expect(elemento(fixture, IDS.recusasDaUnidade)).toBeNull();
  });

  it('marca e descreve só a unidade quando só a unidade é recusada', () => {
    const fixture = montarPrazo({ recusasDaUnidade: [umaRecusa('prazoUnidade')] });

    expect(campoDaUnidade(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(descritoPor(campoDaUnidade(fixture))).toEqual([IDS.recusasDaUnidade]);
    expect(campoDoValor(fixture).hasAttribute('aria-invalid')).toBe(false);
    expect(elemento(fixture, IDS.recusasDoValor)).toBeNull();
  });

  it('mostra a mensagem, o código e a página da recusa no bloco do campo, que aceita foco', () => {
    const fixture = montarPrazo({ recusasDoValor: [umaRecusa('prazoValor')] });
    const bloco = elemento(fixture, IDS.recusasDoValor);

    expect(bloco.textContent).toContain('O prazo precisa ser maior que zero.');
    expect(bloco.textContent).toContain('uniplus.selecao.recurso.prazo_nao_positivo');
    expect(bloco.querySelector('a')?.getAttribute('href')).toContain('prazo_nao_positivo');
    expect(bloco.getAttribute('tabindex')).toBe('-1');
  });

  it('a recusa a conferir segue à vista e descreve o campo, sem marcá-lo como inválido', () => {
    const fixture = montarPrazo({ recusasDoValor: [umaRecusa('prazoValor', true)] });

    expect(elemento(fixture, IDS.recusasDoValor).textContent).toContain(
      'conferida de novo na próxima gravação',
    );
    expect(descritoPor(campoDoValor(fixture))).toEqual([IDS.recusasDoValor]);
    expect(campoDoValor(fixture).hasAttribute('aria-invalid')).toBe(false);
  });

  it('descreve cada campo pela ajuda e pela recusa dele, nessa ordem', () => {
    const fixture = montarPrazo({
      ids: IDS_COM_AJUDA,
      recusasDoValor: [umaRecusa('prazoValor')],
      recusasDaUnidade: [umaRecusa('prazoUnidade')],
    });

    expect(descritoPor(campoDoValor(fixture))).toEqual([IDS_COM_AJUDA.ajuda, IDS.recusasDoValor]);
    expect(descritoPor(campoDaUnidade(fixture))).toEqual([
      IDS_COM_AJUDA.ajuda,
      IDS.recusasDaUnidade,
    ]);
  });

  it('sem ajuda nem recusa, os campos não têm descrição', () => {
    const fixture = montarPrazo();

    expect(campoDoValor(fixture).hasAttribute('aria-describedby')).toBe(false);
    expect(campoDaUnidade(fixture).hasAttribute('aria-describedby')).toBe(false);
  });
});

const PRAZOS = idsDosParametros('rec');

const comAjuda = (ids: IdsDoPrazo, ...outros: string[]) =>
  [ids.ajuda, ...outros].filter((id) => id !== undefined);

describe.each<[string, IdsDoPrazo, string]>([
  ['de interposição', PRAZOS.prazoDeInterposicao, 'prazoUnidade'],
  ['da 2ª instância', PRAZOS.prazoDaSegundaInstancia, 'prazoSegundaInstanciaUnidade'],
])('PrazoDoRecursoComponent: unidade recusada sem opções, prazo %s', (_nome, ids, campo) => {
  const montarSemOpcoes = (comRecusa = true) =>
    montarPrazo({
      ids,
      unidades: [],
      situacao: 'carregando',
      recusasDaUnidade: comRecusa ? [umaRecusa(campo)] : [],
    });

  it('liga o parágrafo de situação e o seletor à recusa da unidade', () => {
    const fixture = montarSemOpcoes();

    expect(descritoPor(elemento(fixture, ids.situacao))).toEqual([ids.recusasDaUnidade]);
    expect(descritoPor(elemento(fixture, ids.unidade))).toEqual(
      comAjuda(ids, ids.situacao, ids.recusasDaUnidade),
    );
  });

  it('sem recusa, o parágrafo de situação não tem descrição', () => {
    const fixture = montarSemOpcoes(false);

    expect(elemento(fixture, ids.situacao).hasAttribute('aria-describedby')).toBe(false);
  });

  it('quando as opções chegam com o foco no parágrafo de situação, o foco vai ao seletor', async () => {
    const fixture = montarSemOpcoes();
    elemento(fixture, ids.situacao).focus();

    fixture.componentRef.setInput('unidades', UNIDADES);
    fixture.componentRef.setInput('situacao', 'pronta');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(elemento(fixture, ids.situacao)).toBeNull();
    expect(document.activeElement).toBe(elemento(fixture, ids.unidade));
    expect(descritoPor(elemento(fixture, ids.unidade))).toEqual(
      comAjuda(ids, ids.recusasDaUnidade),
    );
  });

  it('quando as opções chegam com o foco em outro campo, o foco não se move', async () => {
    const fixture = montarSemOpcoes();
    elemento(fixture, ids.valor).focus();

    fixture.componentRef.setInput('unidades', UNIDADES);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(elemento(fixture, ids.valor));
  });
});
