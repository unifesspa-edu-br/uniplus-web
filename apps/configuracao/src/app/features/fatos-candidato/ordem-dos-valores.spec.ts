import { describe, expect, it } from 'vitest';
import { trocarDeLugar } from './ordem-dos-valores';

const codigos = ['A', 'B', 'C', 'D'];

describe('trocarDeLugar', () => {
  it('troca com o vizinho e devolve a lista completa', () => {
    expect(trocarDeLugar(codigos, 'C', -1)?.codigos).toEqual(['A', 'C', 'B', 'D']);
    expect(trocarDeLugar(codigos, 'B', 1)?.codigos).toEqual(['A', 'C', 'B', 'D']);
  });

  it('não troca o que está na ponta nem o código desconhecido', () => {
    expect(trocarDeLugar(codigos, 'A', -1)).toBeNull();
    expect(trocarDeLugar(codigos, 'D', 1)).toBeNull();
    expect(trocarDeLugar(codigos, 'X', 1)).toBeNull();
  });

  it('o foco fica no botão que ainda vale: o oposto quando o valor chega à ponta', () => {
    expect(trocarDeLugar(codigos, 'B', -1)?.focoEm).toBe('descer');
    expect(trocarDeLugar(codigos, 'C', 1)?.focoEm).toBe('subir');
  });

  it('no meio da lista o foco segue o sentido do movimento', () => {
    expect(trocarDeLugar(['A', 'B', 'C', 'D', 'E'], 'D', -1)?.focoEm).toBe('subir');
    expect(trocarDeLugar(['A', 'B', 'C', 'D', 'E'], 'B', 1)?.focoEm).toBe('descer');
  });
});
