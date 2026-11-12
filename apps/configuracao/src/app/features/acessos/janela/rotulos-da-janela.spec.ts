import { describe, expect, it } from 'vitest';
import { formaDoEncerramento, situacaoDaJanela, situacaoDoItem } from './rotulos-da-janela';

describe('rótulos da janela', () => {
  it('traduz a situação da concessão e devolve o código desconhecido como veio', () => {
    expect(situacaoDoItem('aguardando_protecao_de_dados').texto).toBe(
      'Aguarda o Representante do controlador',
    );
    expect(situacaoDoItem('recusada').variante).toBe('danger');
    expect(situacaoDoItem('nova').texto).toBe('nova');
  });

  it('traduz a situação da janela', () => {
    expect(situacaoDaJanela('encerrando').texto).toBe('Em encerramento');
    expect(situacaoDaJanela('x').texto).toBe('x');
  });

  it('diz como a janela terminou, sem inventar quando ainda não terminou', () => {
    expect(formaDoEncerramento('manual')).toBe(
      'A gestão de acessos encerrou a janela antes do prazo.',
    );
    expect(formaDoEncerramento('outra')).toBe('outra');
    expect(formaDoEncerramento(null)).toBeNull();
  });
});
