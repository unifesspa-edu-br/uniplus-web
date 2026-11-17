import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  CEP_DE_MARABA,
  FORMULARIO_DE_ENDERECO_RESIDENCIAL,
  MUNICIPIO_DE_MARABA,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('o endereço pelo CEP é respondido como o endereço estruturado do Geo, com a cidade', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    expect(tela.querySelector('legend')?.textContent).toContain('Endereço residencial');

    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507-590');
    cenario.clicar(cenario.botao('Buscar CEP'));
    cenario.digitar(tela.querySelector('input[id$="-numero"]') as HTMLInputElement, '12');

    expect(cenario.simulacoes.at(-1)?.respostas?.['ENDERECO_RESIDENCIAL']).toEqual({
      cep: '68507590',
      logradouro: 'Rua Folha 31',
      numero: '12',
      complemento: null,
      bairro: 'Nova Marabá',
      distrito: null,
      cidade: MUNICIPIO_DE_MARABA,
      latitude: null,
      longitude: null,
      nivelResolucao: 'logradouro',
      origem: 'logradouro',
    });
  });

  it('o endereço do candidato não oferece o atalho para preencher sem CEP', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);

    expect(cenario.botao('preencher sem CEP')).toBeUndefined();
    expect(tela.querySelector('select[id$="-uf"]')).toBeNull();
  });

  it('o CEP que o Geo não encontra não preenche nada e orienta a busca dos Correios em nova aba', () => {
    cenario.resultadoDoCep = () =>
      of(errorResult(mockProblemDetails({ status: 404, code: 'uniplus.geo.cep_nao_encontrado' })));
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);

    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68500000');
    cenario.clicar(cenario.botao('Buscar CEP'));

    expect(tela.querySelector('input[id$="-logradouro"]')).toBeNull();
    const erro = tela.querySelector('[id$="-cep-error"]') as HTMLElement;
    expect(erro.getAttribute('role')).toBe('alert');
    expect(erro.textContent).toContain('CEP não encontrado. Confira o seu CEP na');
    expect(erro.textContent).toContain('use o CEP geral da sua cidade');
    const link = erro.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://buscacepinter.correios.com.br/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.textContent).toContain('abre em nova aba');
    expect(tela.querySelector('input[id$="-cep"]')?.getAttribute('aria-describedby')).toContain(
      erro.id,
    );
  });

  const buscarCepComOrigem = (origem: string): HTMLElement => {
    cenario.resultadoDoCep = () =>
      of(
        okResult({
          ...CEP_DE_MARABA,
          logradouro: null,
          tipo: null,
          bairro: 'Nova Marabá',
          nivelResolucao: 'cidade',
          origem,
        }),
      );
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));
    return tela;
  };

  it('o CEP de grande usuário não exige bairro nem logradouro, mesmo no nível da cidade', () => {
    cenario.resultadoDoCep = () =>
      of(
        okResult({
          ...CEP_DE_MARABA,
          logradouro: null,
          tipo: null,
          bairro: null,
          nivelResolucao: 'cidade',
          origem: 'grande-usuario',
        }),
      );
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);

    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    const bairro = tela.querySelector('input[id$="-bairro"]') as HTMLInputElement;
    expect(bairro.getAttribute('aria-required')).toBeNull();
    expect(bairro.readOnly).toBe(false);
    expect(cenario.simulacoes.at(-1)?.respostas?.['ENDERECO_RESIDENCIAL']).toMatchObject({
      cep: '68507590',
      origem: 'grande-usuario',
    });
  });

  it('a origem desconhecida do Geo exige a confirmação do CEP, como a faixa', () => {
    const tela = buscarCepComOrigem('origem-nova');

    expect(tela.querySelector('[id$="-cep-faixa"]')).not.toBeNull();
    expect(tela.querySelector('[id$="-cep-confirmacao"]')?.getAttribute('role')).toBe('alert');
    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('o aviso do CEP geral descreve o campo CEP para o leitor de tela', () => {
    cenario.resultadoDoCep = () =>
      of(okResult({ ...CEP_DE_MARABA, bairro: null, origem: 'cep-geral' }));
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    const aviso = tela.querySelector('[id$="-cep-geral"]') as HTMLElement;
    expect(tela.querySelector('input[id$="-cep"]')?.getAttribute('aria-describedby')).toContain(
      aviso.id,
    );
  });

  it('o CEP geral oficial mostra de qual cidade é e exige logradouro e bairro', () => {
    cenario.resultadoDoCep = () =>
      of(
        okResult({
          ...CEP_DE_MARABA,
          logradouro: null,
          tipo: null,
          bairro: null,
          origem: 'cep-geral',
        }),
      );
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    expect(tela.textContent).toContain('Este é o CEP geral de Marabá/PA');
    expect(tela.querySelector('input[id$="-bairro"]')?.getAttribute('aria-required')).toBe('true');
    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('o CEP que só cai numa faixa avisa, não preenche além da cidade e não vale sem confirmação', () => {
    const tela = buscarCepComOrigem('faixa-bairro');

    const aviso = tela.querySelector('[id$="-cep-faixa"]') as HTMLElement;
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(aviso.textContent).toContain('O CEP 68507590 não corresponde a uma rua cadastrada');
    expect(aviso.textContent).toContain('faixa de CEPs de Marabá/PA');
    expect(tela.querySelector('input[id$="-bairro"]')).toBeNull();
    expect(tela.textContent).toContain('Confirmo que este é o CEP que uso no meu endereço');
    const erro = tela.querySelector('[id$="-cep-confirmacao"]') as HTMLElement;
    expect(erro.getAttribute('role')).toBe('alert');
    const descricao = tela
      .querySelector('input[type="checkbox"]')
      ?.getAttribute('aria-describedby');
    expect(descricao).toContain(erro.id);
    expect(descricao).toContain(aviso.id);
    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('confirmado o CEP de faixa, logradouro e bairro são obrigatórios e a resposta leva cepConfirmado', () => {
    const tela = buscarCepComOrigem('faixa-cidade');

    cenario.clicar(tela.querySelector('input[type="checkbox"]') as HTMLElement);
    const logradouro = tela.querySelector('input[id$="-logradouro"]') as HTMLInputElement;
    const bairro = tela.querySelector('input[id$="-bairro"]') as HTMLInputElement;
    expect([logradouro.value, bairro.value]).toEqual(['', '']);
    expect(logradouro.getAttribute('aria-required')).toBe('true');
    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();

    cenario.digitar(logradouro, 'Rua do Centro');
    cenario.digitar(bairro, 'Centro');
    expect(cenario.simulacoes.at(-1)?.respostas?.['ENDERECO_RESIDENCIAL']).toMatchObject({
      cepConfirmado: true,
      origem: 'faixa-cidade',
    });
  });

  it('ao trocar o CEP, os avisos de faixa e de CEP geral somem até a próxima busca e o endereço fica pendente', () => {
    const tela = buscarCepComOrigem('faixa-cidade');
    cenario.clicar(tela.querySelector('input[type="checkbox"]') as HTMLElement);

    cenario.clicar(cenario.botao('Trocar CEP'));
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507');

    expect(tela.querySelector('[id$="-cep-faixa"]')).toBeNull();
    expect(tela.querySelector('input[type="checkbox"]')).toBeNull();
    expect(tela.querySelector('[id$="-cep-geral"]')).toBeNull();
    expect(tela.querySelector('input[id$="-bairro"]')?.getAttribute('aria-required')).toBeNull();
    expect(tela.textContent).toContain('Valide o CEP em "Buscar CEP"');
    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('trocar o CEP desfaz a confirmação', () => {
    const tela = buscarCepComOrigem('faixa-distrito');
    const caixa = tela.querySelector('input[type="checkbox"]') as HTMLInputElement;
    cenario.clicar(caixa);
    expect(caixa.checked).toBe(true);

    cenario.clicar(cenario.botao('Trocar CEP'));
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507');
    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    expect((tela.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
  });

  it('logradouro e bairro vindos do CEP continuam editáveis', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    const logradouro = tela.querySelector('input[id$="-logradouro"]') as HTMLInputElement;
    const bairro = tela.querySelector('input[id$="-bairro"]') as HTMLInputElement;
    expect([logradouro.readOnly, bairro.readOnly]).toEqual([false, false]);
    cenario.digitar(bairro, 'Cidade Nova');
    expect(cenario.simulacoes.at(-1)?.respostas?.['ENDERECO_RESIDENCIAL']).toMatchObject({
      bairro: 'Cidade Nova',
    });
  });

  it('o complemento é um campo de várias linhas, de linha inteira, limitado a 300 caracteres e com contador', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    const complemento = tela.querySelector('textarea[id$="-complemento"]') as HTMLTextAreaElement;
    expect(complemento.getAttribute('maxlength')).toBe('300');
    expect(complemento.closest('.form-grid__full')).not.toBeNull();
    expect(tela.textContent).toContain(
      'Use para indicar ponto de referência ou o endereço real, quando o CEP for o geral da cidade ou de outro bairro.',
    );
    cenario.digitar(complemento as unknown as HTMLInputElement, 'Casa azul');
    const contagem = tela.querySelector('[id$="-complemento-contagem"]') as HTMLElement;
    expect(contagem.textContent).toContain('9 de 300 caracteres');
    expect(complemento.getAttribute('aria-describedby')).toContain(contagem.id);
  });

  it('o endereço já respondido volta à tela com a cidade', () => {
    cenario.fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    cenario.fixture.componentRef.setInput('formulario', FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.fixture.componentRef.setInput('inicial', {
      respostas: {
        ENDERECO_RESIDENCIAL: {
          cep: '68507590',
          logradouro: 'Rua Folha 31',
          cidade: MUNICIPIO_DE_MARABA,
          nivelResolucao: 'logradouro',
          origem: 'logradouro',
        },
      },
    });
    cenario.fixture.detectChanges();

    const tela = cenario.fixture.nativeElement as HTMLElement;
    expect((tela.querySelector('input[id$="-cidade"]') as HTMLInputElement).value).toBe('Marabá');
    expect((tela.querySelector('input[id$="-uf"]') as HTMLInputElement).value).toBe('PA');
    expect((tela.querySelector('input[id$="-logradouro"]') as HTMLInputElement).value).toBe(
      'Rua Folha 31',
    );
  });

  it('o CEP trocado e ainda não resolvido deixa o endereço obrigatório sem resposta', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_RESIDENCIAL);
    cenario.digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    cenario.clicar(cenario.botao('Buscar CEP'));

    cenario.clicar(cenario.botao('Trocar CEP'));
    const cep = tela.querySelector('input[id$="-cep"]') as HTMLInputElement;
    cenario.digitar(cep, '6850');
    cenario.clicar(cenario.botao('Concluir a seção'));

    expect(cenario.respostasDaUltimaSimulacao()['ENDERECO_RESIDENCIAL']).toBeUndefined();
    expect(tela.textContent).toContain('Responda este campo.');
    expect(cep.value).toBe('6850');
  });
});
