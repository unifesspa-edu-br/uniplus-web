import { describe, expect, it } from 'vitest';

import {
  campoDaUnidade,
  campoDoValor,
  elemento,
  IDS,
  IDS_COM_AJUDA,
  montarPrazo,
  umaRecusa,
  descritoPor,
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

  it('o problema do prazo marca e descreve valor e unidade, em parágrafo de alerta', () => {
    const fixture = montarPrazo({ problema: 'O prazo precisa ser um número.' });

    expect(elemento(fixture, IDS.problema).getAttribute('role')).toBe('alert');
    expect(elemento(fixture, IDS.problema).textContent).toContain('precisa ser um número');
    for (const campo of [campoDoValor(fixture), campoDaUnidade(fixture)]) {
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(descritoPor(campo)).toEqual([IDS.problema]);
    }
  });

  it('descreve cada campo pela ajuda, pelo problema e pela recusa dele, nessa ordem', () => {
    const fixture = montarPrazo({
      ids: IDS_COM_AJUDA,
      problema: 'Problema.',
      recusasDoValor: [umaRecusa('prazoValor')],
      recusasDaUnidade: [umaRecusa('prazoUnidade')],
    });

    expect(descritoPor(campoDoValor(fixture))).toEqual([
      IDS_COM_AJUDA.ajuda,
      IDS.problema,
      IDS.recusasDoValor,
    ]);
    expect(descritoPor(campoDaUnidade(fixture))).toEqual([
      IDS_COM_AJUDA.ajuda,
      IDS.problema,
      IDS.recusasDaUnidade,
    ]);
  });

  it('sem ajuda, problema nem recusa, os campos não têm descrição', () => {
    const fixture = montarPrazo();

    expect(campoDoValor(fixture).hasAttribute('aria-describedby')).toBe(false);
    expect(campoDaUnidade(fixture).hasAttribute('aria-describedby')).toBe(false);
  });
});
