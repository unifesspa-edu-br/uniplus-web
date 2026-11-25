import { describe, expect, it } from 'vitest';
import { Document } from 'openapi-backend';
import { conferirPedido, conferirPedidoNoDocumento } from './conferir-pedido.testing';
import { conferirResposta, tipoAceitoEmSucesso } from './conferir-resposta.testing';
import { criarConferidor } from './documentos-do-contrato.testing';
import { mensagemDasDivergencias } from './divergencia-do-contrato.testing';
import { RegistroDeDivergencias } from './registro-de-divergencias.testing';

const caminhoDaOperacao = '/api/organizacao/unidades';

describe('conferência do contrato', () => {
  it('confere pedido e resposta válidos', async () => {
    const pedido = await conferirPedido({
      method: 'GET',
      path: caminhoDaOperacao,
      headers: {},
    });
    expect(pedido.divergencias).toEqual([]);
    if (!pedido.operacao) throw new Error('Operação não encontrada.');
    const tipo = tipoAceitoEmSucesso(pedido.operacao, 'application/vnd.uniplus.unidade.v1+json');
    expect(conferirResposta(pedido, { codigo: 200, tipoDeConteudo: tipo, corpo: [] })).toEqual([]);
  });

  it.each([
    ['Application/JSON; charset=utf-8', true],
    ['text/plain; charset=privado', false],
  ])('confere o tipo de conteúdo %s', async (tipo, valido) => {
    const pedido = await conferirUnidade(tipo);
    expect(pedido.divergencias.map((item) => item.regra)).toEqual(
      valido ? [] : ['tipo de conteúdo não declarado'],
    );
    expect(mensagemDasDivergencias(pedido.divergencias)).not.toContain(tipo);
  });

  it('recusa consulta fora da lista e protege o valor', async () => {
    const pedido = await conferirPedido({
      method: 'GET',
      path: caminhoDaOperacao + '?direction=valor-ficticio',
      headers: {},
    });
    expect(pedido.divergencias).not.toEqual([]);
    expect(mensagemDasDivergencias(pedido.divergencias)).not.toContain('valor-ficticio');
  });

  it('valida enumeração referenciada no corpo sem revelar o valor', async () => {
    const pedido = {
      method: 'POST',
      path: '/api/organizacao/admin/unidades',
      headers: { 'Idempotency-Key': 'chave', 'Content-Type': 'application/json' },
      body: { ...corpoDaUnidade(), tipo: 'REITORIA' },
    };
    expect((await conferirPedido(pedido)).divergencias).toEqual([]);
    pedido.body.tipo = 'valor-ficticio';
    const invalido = await conferirPedido(pedido);
    expect(invalido.divergencias[0]?.regra).toBe('pedido fora do contrato');
    expect(mensagemDasDivergencias(invalido.divergencias)).not.toContain('valor-ficticio');
  });

  it('recusa uuid inválido no caminho sem revelar o valor', async () => {
    const pedido = await conferirPedido({
      method: 'DELETE',
      path: '/api/organizacao/admin/unidades/uuid-invalido',
      headers: {},
    });
    expect(pedido.operacao?.path).toBe('/api/organizacao/admin/unidades/{id}');
    expect(pedido.divergencias[0]?.regra).toBe('pedido fora do contrato');
    expect(mensagemDasDivergencias(pedido.divergencias)).not.toContain('uuid-invalido');
  });

  it('recusa corpo inválido e código sem esquema', async () => {
    const pedido = await conferirPedido({
      method: 'GET',
      path: caminhoDaOperacao,
      headers: {},
    });
    if (!pedido.operacao) throw new Error('Operação não encontrada.');
    const tipo = tipoAceitoEmSucesso(pedido.operacao, 'application/vnd.uniplus.unidade.v1+json');
    expect(conferirResposta(pedido, { codigo: 200, tipoDeConteudo: tipo, corpo: {} })).not.toEqual(
      [],
    );
    expect(conferirResposta(pedido, { codigo: 599, tipoDeConteudo: tipo, corpo: [] })).not.toEqual(
      [],
    );
    expect(
      conferirResposta(pedido, { codigo: 200, tipoDeConteudo: 'text/plain', corpo: [] }),
    ).not.toEqual([]);
  });

  it('recusa operação inexistente sem mostrar o caminho informado', async () => {
    const pedido = await conferirPedido({
      method: 'GET',
      path: '/api/organizacao/valor-ficticio',
      headers: {},
    });
    expect(mensagemDasDivergencias(pedido.divergencias)).not.toContain('valor-ficticio');
    expect(pedido.divergencias).not.toEqual([]);
  });

  it('recusa operação sem operationId', async () => {
    const documento: Document = {
      openapi: '3.1.0',
      info: { title: 'Teste', version: '1' },
      paths: {
        '/api/organizacao/exemplo': { get: { responses: { '200': { description: 'Resposta' } } } },
      },
    };
    const conferidor = await criarConferidor(documento);
    const pedido = conferirPedidoNoDocumento(conferidor, {
      method: 'GET',
      path: '/api/organizacao/exemplo',
      headers: {},
    });
    expect(pedido.divergencias[0].regra).toContain('operationId');
  });

  it('registra e limpa as divergências ao encerrar', async () => {
    const registro = new RegistroDeDivergencias();
    registro.registrar([
      { metodo: 'GET', caminho: '/api/{...}', campo: 'pedido', regra: 'inválido' },
    ]);
    expect(registro.ler()).toHaveLength(1);
    await expect(registro.encerrar()).rejects.toThrow('inválido');
    expect(registro.ler()).toEqual([]);
  });
  it('transforma falhas internas em divergência e aguarda as pendências', async () => {
    const registro = new RegistroDeDivergencias();
    registro.acompanhar(Promise.reject(new Error('valor privado')));
    await expect(registro.encerrar()).rejects.toThrow('não foi possível conferir');
    expect(registro.ler()).toEqual([]);
  });

  it('aceita resposta 204 declarada sem corpo e recusa conteúdo indevido', async () => {
    const pedido = await conferirPedido({
      method: 'DELETE',
      path: '/api/organizacao/admin/unidades/123e4567-e89b-12d3-a456-426614174000',
      headers: {},
    });
    expect(pedido.divergencias).toEqual([]);
    expect(conferirResposta(pedido, { codigo: 204, corpo: null })).toEqual([]);
    expect(conferirResposta(pedido, { codigo: 204, corpo: 'indevido' })).not.toEqual([]);
    expect(conferirResposta(pedido, { codigo: 200, corpo: null })).not.toEqual([]);
  });

  it('não revela valores sensíveis do cabeçalho e do corpo', async () => {
    const pedido = await conferirPedido({
      method: 'POST',
      path: '/api/organizacao/admin/unidades',
      headers: { 'idempotency-key': 'segredo;cabecalho', 'content-type': 'application/json' },
      body: { nome: 'segredo-corpo' },
    });
    const mensagem = mensagemDasDivergencias(pedido.divergencias);
    expect(pedido.divergencias).not.toEqual([]);
    expect(mensagem).not.toContain('segredo;cabecalho');
    expect(mensagem).not.toContain('segredo-corpo');
    const resposta = conferirResposta(pedido, {
      codigo: 201,
      tipoDeConteudo: 'application/json',
      corpo: 'segredo-resposta',
    });
    expect(resposta).not.toEqual([]);
    expect(mensagemDasDivergencias(resposta)).not.toContain('segredo-resposta');
  });
});

function corpoDaUnidade() {
  return {
    nome: 'Unidade',
    alias: null,
    slug: null,
    sigla: null,
    codigo: null,
    unidadeSuperiorId: null,
    tipo: null,
    unidadeAcademica: true,
    vigenciaInicio: '2025-01-01',
    vigenciaFim: null,
  };
}

function conferirUnidade(tipo: string) {
  return conferirPedido({
    method: 'POST',
    path: '/api/organizacao/admin/unidades',
    headers: { 'Idempotency-Key': 'chave', 'Content-Type': tipo },
    body: corpoDaUnidade(),
  });
}
