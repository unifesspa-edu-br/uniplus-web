import { FormaDoEncerramento, SituacaoDaMigracao } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { formaDoEncerramento, situacaoDaJanela, situacaoDoItem } from './rotulos-da-janela';

describe('rótulos da janela', () => {
  it('traduz a situação da concessão e devolve o código desconhecido como veio', () => {
    expect(situacaoDoItem(SituacaoDaMigracao.AGUARDANDO_PROTECAO_DE_DADOS).texto).toBe(
      'Aguarda o Representante do controlador',
    );
    expect(situacaoDoItem(SituacaoDaMigracao.RECUSADA).variante).toBe('danger');
    expect(situacaoDoItem('nova').texto).toBe('nova');
  });

  it('traduz a situação da janela', () => {
    expect(situacaoDaJanela('encerrando').texto).toBe('Em encerramento');
    expect(situacaoDaJanela('x').texto).toBe('x');
  });

  it('diz como a janela terminou, sem inventar quando ainda não terminou', () => {
    expect(formaDoEncerramento(FormaDoEncerramento.MANUAL)).toBe(
      'A gestão de acessos encerrou a janela antes do prazo.',
    );
    expect(formaDoEncerramento('outra')).toBe('outra');
    expect(formaDoEncerramento(null)).toBeNull();
  });
});
