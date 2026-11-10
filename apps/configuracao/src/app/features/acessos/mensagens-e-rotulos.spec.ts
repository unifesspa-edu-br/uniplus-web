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

  it.each([
    ['etapa_invalida', 'A decisão foi pedida para uma etapa que a versão não aguarda agora.'],
    ['mesmo_decisor_nas_duas_etapas', 'Você já decidiu a outra etapa desta versão.'],
    ['sem_permissao_na_etapa', 'Falta a permissão de aprovação da etapa'],
  ])('na versão, %s segue falando da versão', (codigo, inicio) => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const problemas = TestBed.inject(ProblemI18nService);

    const mensagem = problemas.resolve({
      type: 'x',
      title: 'texto da API',
      status: 422,
      code: `uniplus.autorizacao.perfil.${codigo}`,
      traceId: '',
    });

    expect(textoDaRecusa(mensagem)).toContain(inicio);
  });

  it('orienta nos dois códigos do fim de vigência', () => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const problemas = TestBed.inject(ProblemI18nService);
    const resolver = (code: string) =>
      textoDaRecusa(problemas.resolve({ type: 'x', title: 'API', status: 422, code, traceId: '' }));

    expect(resolver('uniplus.autorizacao.pedido.validade_invalida')).toContain('prazo');
    expect(resolver('uniplus.autorizacao.pedido.prazo_vencido')).toContain('voltou à gestão de acessos');
  });

  it('orienta nas recusas da janela de migração, com os nomes das funções', () => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const problemas = TestBed.inject(ProblemI18nService);
    const resolver = (code: string) =>
      textoDaRecusa(problemas.resolve({ type: 'x', title: 'API', status: 422, code, traceId: '' }));

    expect(resolver('uniplus.autorizacao.pedido.perfil_em_janela_de_migracao')).toContain(
      'não recebe pessoa nova',
    );
    expect(resolver('uniplus.autorizacao.perfil.janela_de_migracao_aberta')).toContain(
      'não aceita outra versão pendente',
    );
    expect(resolver('uniplus.autorizacao.migracao.lote_incompleto')).toContain('gestão de acessos');
    expect(resolver('uniplus.autorizacao.perfil.acrescimo_com_concessao_ativa')).toBe('API');
  });

  it('mantém o título da API quando o código não tem orientação própria', () => {
    expect(textoDaRecusa({ title: 'Falhou' })).toBe('Falhou');
  });
});

describe('rótulos de acesso', () => {
  it('traduz o vocabulário da API e devolve o código desconhecido como veio', () => {
    expect(situacaoDoPedido('aguardando_gestor').texto).toBe('Aguardando a gestão de acessos');
    expect(situacaoDoPedido('novo').texto).toBe('novo');
    expect(situacaoDoAnexo('em_verificacao')).toBe('Em verificação');
    expect(situacaoDoAnexo('x')).toBe('x');
    expect(tipoDeEvento('pedido_criado')).toBe('Pedido criado');
    expect(tipoDeEvento('prazo_vencido_entre_etapas')).toBe('Prazo vencido entre as etapas');
    expect(sensibilidade('Sensivel')).toBe('Dado sensível');
    expect(etapa('protecao_de_dados')).toBe('Proteção de dados');
    expect(etapa(null)).toBe('—');
    expect(motivoDaDispensa('designacao_de_protecao_de_dados')).toBe(
      'designação de proteção de dados',
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
    expect(autorDoEvento(null)).toBe('Sistema');
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
      'Etapa: Gestão de acessos. Sensibilidade avaliada: Dado pessoal.',
    );
    expect(detalheDaTrilha('Motivo: designacao_de_protecao_de_dados.')).toBe(
      'Motivo: designação de proteção de dados.',
    );
    expect(detalheDaTrilha('Motivo: faltou.')).toBe('Motivo: faltou.');
    expect(detalheDaTrilha(null)).toBe('—');
  });

  it('traduz a etapa e a dispensa da decisão da migração e tira o identificador da janela', () => {
    const janela = '01a188d4-4a99-7db5-b0cd-0f3e30cce2be';

    expect(
      detalheDaTrilha(
        `Etapa: gestao_de_acessos. Janela: ${janela}. Dispensa: beneficiario_ja_tem_protecao_de_dados.`,
      ),
    ).toBe(
      'Etapa: Gestão de acessos. Dispensa: a pessoa beneficiada já exerce a proteção de dados.',
    );
    expect(tipoDeEvento('migracao_recusar')).toBe('Migração recusada');
  });
});
