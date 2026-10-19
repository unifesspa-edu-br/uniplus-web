import { describe, expect, it } from 'vitest';

import { pedidoDoAto, pedidoDoItem, type DadosDoAto, type DadosDoItem } from './pedido-do-ato';

const PRINCIPAL = '01960000-0000-7000-0000-0000000000a1';
const ANEXO = '01960000-0000-7000-0000-0000000000a2';
const CORRIGIDO = '01960000-0000-7000-0000-0000000000a3';

const dados: DadosDoAto = {
  tipoAtoCodigo: 'AVISO',
  numero: '  03/2026 ',
  dataPublicacao: '2026-10-19',
  assinante: ' Pró-reitoria de Ensino ',
  atoCorrigidoId: null,
  motivoDaCorrecao: '',
};

describe('pedidoDoAto', () => {
  it('apara os textos e deixa de fora o que o servidor trata como ausente', () => {
    const pedido = pedidoDoAto({ ...dados, numero: '   ' }, PRINCIPAL, []);

    expect(pedido).toEqual({
      tipoAtoCodigo: 'AVISO',
      numero: null,
      dataPublicacao: '2026-10-19',
      assinante: 'Pró-reitoria de Ensino',
      documentoPrincipalId: PRINCIPAL,
    });
  });

  it('leva os anexos na ordem escolhida, com o nome com que são baixados', () => {
    const pedido = pedidoDoAto(dados, PRINCIPAL, [
      { documentoAPublicarId: ANEXO, nome: ' Planilha ' },
    ]);

    expect(pedido.numero).toBe('03/2026');
    expect(pedido.anexos).toEqual([{ documentoId: ANEXO, nome: 'Planilha' }]);
  });

  it('leva o ato corrigido junto do motivo', () => {
    const pedido = pedidoDoAto(
      { ...dados, atoCorrigidoId: CORRIGIDO, motivoDaCorrecao: ' Corrige a data. ' },
      PRINCIPAL,
      [],
    );

    expect(pedido.atoCorrigidoId).toBe(CORRIGIDO);
    expect(pedido.motivoDaCorrecao).toBe('Corrige a data.');
  });

  it('descarta o motivo quando o ato não corrige outro', () => {
    const pedido = pedidoDoAto({ ...dados, motivoDaCorrecao: 'sobrou do tipo anterior' }, PRINCIPAL, []);

    expect(pedido).not.toHaveProperty('motivoDaCorrecao');
    expect(pedido).not.toHaveProperty('atoCorrigidoId');
  });
});

describe('pedidoDoItem', () => {
  const dadosDoItem: DadosDoItem = {
    numero: dados.numero,
    dataPublicacao: dados.dataPublicacao,
    assinante: dados.assinante,
    atoCorrigidoId: null,
    motivoDaCorrecao: '',
  };

  it('não leva o tipo, que vem do item do edital, e leva a confirmação da política', () => {
    const pedido = pedidoDoItem(dadosDoItem, PRINCIPAL, [], true);

    expect(pedido).toEqual({
      numero: '03/2026',
      dataPublicacao: '2026-10-19',
      assinante: 'Pró-reitoria de Ensino',
      documentoPrincipalId: PRINCIPAL,
      politicaDeDivulgacaoConfirmada: true,
    });
  });

  it('leva o ato corrigido junto do motivo, como no documento avulso', () => {
    const pedido = pedidoDoItem(
      { ...dadosDoItem, atoCorrigidoId: CORRIGIDO, motivoDaCorrecao: ' Corrige a lista. ' },
      PRINCIPAL,
      [],
      false,
    );

    expect(pedido).toMatchObject({
      atoCorrigidoId: CORRIGIDO,
      motivoDaCorrecao: 'Corrige a lista.',
      politicaDeDivulgacaoConfirmada: false,
    });
  });
});
