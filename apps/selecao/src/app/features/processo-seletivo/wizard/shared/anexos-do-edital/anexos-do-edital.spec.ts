import { describe, expect, it } from 'vitest';

import type { AnexoDoEdital } from '../../processo-seletivo.models';
import {
  LIMITE_DE_ANEXOS,
  comoPedidoDeAnexos,
  mensagensDosAnexos,
  nomeInicialDoAnexo,
  nomeNoDownload,
  recusaDoNomeDoAnexo,
  tipoDeMidiaDoAnexo,
} from './anexos-do-edital';

const ID = '01960000-0000-7000-0000-0000000005d1';

function anexo(parcial: Partial<AnexoDoEdital> = {}): AnexoDoEdital {
  return {
    id: ID,
    nomeArquivo: 'cronograma.pdf',
    nome: 'Cronograma',
    progress: 100,
    fase: 'confirmado',
    documentoAPublicarId: ID,
    ...parcial,
  };
}

describe('recusaDoNomeDoAnexo', () => {
  it('aceita o nome com ou sem a extensão do arquivo', () => {
    expect(recusaDoNomeDoAnexo('Cronograma', 'cronograma.pdf')).toBeNull();
    expect(recusaDoNomeDoAnexo('Cronograma.PDF', 'cronograma.pdf')).toBeNull();
  });

  it('exige nome, mesmo quando só sobra a extensão', () => {
    expect(recusaDoNomeDoAnexo('   ', 'a.pdf')).toBe('Informe o nome do anexo.');
    expect(recusaDoNomeDoAnexo('.pdf', 'a.pdf')).toBe('Informe o nome do anexo.');
  });

  it.each(['pasta/nome', 'a\\b', 'a<b', 'a:b', 'a"b', 'a|b', 'a?b', 'a*b', 'a;b', 'a\u0007b'])(
    'recusa o caractere que o download não aceita em %j',
    (nome) => {
      expect(recusaDoNomeDoAnexo(nome, 'a.pdf')).toContain('não pode ter');
    },
  );

  // O limite do servidor conta a extensão que ele acrescenta ao nome.
  it('conta a extensão no limite de 120 caracteres', () => {
    expect(recusaDoNomeDoAnexo('a'.repeat(116), 'a.pdf')).toBeNull();
    expect(recusaDoNomeDoAnexo('a'.repeat(117), 'a.pdf')).toContain('120 caracteres');
  });
});

describe('nomeNoDownload', () => {
  it('acrescenta a extensão uma só vez, com o nome digitado com ou sem ela', () => {
    expect(nomeNoDownload('Cronograma detalhado', 'a.pdf')).toBe('Cronograma detalhado.pdf');
    expect(nomeNoDownload('Cronograma detalhado.pdf', 'a.pdf')).toBe('Cronograma detalhado.pdf');
    expect(nomeNoDownload('  Anexo I.PDF ', 'a.pdf')).toBe('Anexo I.pdf');
  });
});

describe('formatos do anexo', () => {
  it('declara o tipo de mídia de PDF, DOCX e ODT pela extensão, sem diferenciar maiúsculas', () => {
    expect(tipoDeMidiaDoAnexo('a.PDF')).toBe('application/pdf');
    expect(tipoDeMidiaDoAnexo('a.docx')).toContain('wordprocessingml.document');
    expect(tipoDeMidiaDoAnexo('a.odt')).toBe('application/vnd.oasis.opendocument.text');
    expect(tipoDeMidiaDoAnexo('a.png')).toBeNull();
  });

  it('propõe o nome do arquivo sem a extensão', () => {
    expect(nomeInicialDoAnexo('plano.final.docx')).toBe('plano.final');
    expect(nomeInicialDoAnexo('semextensao')).toBe('semextensao');
  });
});

describe('anexos na publicação', () => {
  it('manda ao pedido só os confirmados, com o nome aparado', () => {
    const outro = anexo({ id: 'b', documentoAPublicarId: 'b', nome: '  Modelo  ' });
    const emEnvio = anexo({ id: 'c', fase: 'enviando', documentoAPublicarId: 'c' });

    expect(comoPedidoDeAnexos([anexo(), outro, emEnvio])).toEqual([
      { documentoId: ID, nome: 'Cronograma' },
      { documentoId: 'b', nome: 'Modelo' },
    ]);
  });

  it('não acusa nada quando todos estão confirmados e bem nomeados', () => {
    expect(mensagensDosAnexos([anexo()])).toEqual([]);
  });

  it('impede publicar com anexo ainda em envio ou com falha', () => {
    expect(mensagensDosAnexos([anexo({ fase: 'erro' })])).toEqual([
      expect.stringContaining('não foi enviado por completo'),
    ]);
  });

  it('nomeia o arquivo cujo nome o servidor recusaria', () => {
    expect(mensagensDosAnexos([anexo({ nome: 'a/b' })])).toEqual([
      expect.stringContaining('Anexo cronograma.pdf: O nome do anexo não pode ter'),
    ]);
  });

  it('acusa mais anexos que o limite do edital', () => {
    const muitos = Array.from({ length: LIMITE_DE_ANEXOS + 1 }, (_, i) =>
      anexo({ id: `${i}`, documentoAPublicarId: `${i}` }),
    );

    expect(mensagensDosAnexos(muitos)).toEqual([`O edital aceita no máximo ${LIMITE_DE_ANEXOS} anexos.`]);
  });
});
