import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { provideMensagensDeAcesso, textoDaRecusa } from './mensagens-de-acesso';
import {
  abreviado,
  detalheDaTrilha,
  etapa,
  motivoDaDispensa,
  sensibilidade,
  situacaoDoAnexo,
  situacaoDoPedido,
  tipoDeEvento,
} from './rotulos-de-acesso';
import { autorDoEvento } from './trilha-de-acesso.component';

describe('mensagens de acesso', () => {
  it('troca o texto curto da API pelo título e pela orientação do código registrado', () => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const problemas = TestBed.inject(ProblemI18nService);

    const mensagem = problemas.resolve({
      type: 'x',
      title: 'texto da API',
      status: 422,
      code: 'uniplus.autorizacao.pedido.anexo_nao_verificado',
      traceId: '',
    });

    expect(textoDaRecusa(mensagem)).toBe(
      'O documento ainda não foi verificado. Aguarde a verificação. Se o documento foi recusado, envie outro arquivo.',
    );
  });

  it('mantém o título da API quando o código não tem orientação própria', () => {
    expect(textoDaRecusa({ title: 'Falhou' })).toBe('Falhou');
  });
});

describe('rótulos de acesso', () => {
  it('traduz o vocabulário da API e devolve o código desconhecido como veio', () => {
    expect(situacaoDoPedido('aguardando_gestor').texto).toBe('Aguardando o gestor de acessos');
    expect(situacaoDoPedido('novo').texto).toBe('novo');
    expect(situacaoDoAnexo('em_verificacao')).toBe('Em verificação');
    expect(situacaoDoAnexo('x')).toBe('x');
    expect(tipoDeEvento('pedido_criado')).toBe('Pedido criado');
    expect(sensibilidade('Sensivel')).toBe('Dado sensível');
    expect(etapa('encarregada')).toBe('Encarregada de dados');
    expect(etapa(null)).toBe('—');
    expect(motivoDaDispensa('designacao_da_encarregada')).toBe(
      'designação da encarregada de dados',
    );
    expect(motivoDaDispensa('outro')).toBe('outro');
  });

  it('identifica o autor sem expor o identificador inteiro', () => {
    expect(autorDoEvento({ emissor: 'unifesspa', sub: '0123456789abcdef' })).toBe(
      'Pessoa 01234567',
    );
    expect(autorDoEvento({ emissor: 'uniplus:sistema', sub: 'verificador' })).toBe(
      'Verificador de documentos',
    );
  });
});

describe('detalhe da trilha', () => {
  it('abrevia o SHA-256, tira o id do anexo e traduz os códigos, sem mexer no texto livre', () => {
    const anexo = '01a188d4-4a99-7db5-b0cd-0f3e30cce2be';
    const hash = '5d6e2503398ad015225386263fa8814cc2e829f0f871cd2d290e9b705fff3d88';

    expect(abreviado(hash)).toBe('5d6e2503…');
    expect(detalheDaTrilha(`Anexo ${anexo}. SHA-256 do PDF: ${hash}.`)).toBe(
      'Documento. SHA-256 do PDF: 5d6e2503….',
    );
    expect(detalheDaTrilha('Etapa: gestor. Sensibilidade avaliada: pessoal.')).toBe(
      'Etapa: Gestor de acessos. Sensibilidade avaliada: Dado pessoal.',
    );
    expect(detalheDaTrilha('Motivo: designacao_da_encarregada.')).toBe(
      'Motivo: designação da encarregada de dados.',
    );
    expect(detalheDaTrilha('Motivo: faltou.')).toBe('Motivo: faltou.');
    expect(detalheDaTrilha(null)).toBe('—');
  });
});
