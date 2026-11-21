import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { recusasDoProblema, type ProblemDetails } from '@uniplus/shared-core/http';
import {
  aplicarRecusasDoProblema,
  MENSAGEM_SEM_MAPEAMENTO,
  recusasDoControle,
  textoDaCausaGeral,
} from './recusa-do-servidor';

function problema(errors: ProblemDetails['errors']): ProblemDetails {
  return {
    type: 'https://developers.example.test/erros/uniplus.configuracao.validacao',
    title: 'Validação',
    status: 422,
    code: 'uniplus.configuracao.validacao',
    traceId: '',
    errors,
  };
}

function formulario(): FormGroup<{ nome: FormControl<string> }> {
  return new FormGroup({ nome: new FormControl('', { nonNullable: true }) });
}

const controleDoNome = (campo: string): 'nome' | null => (campo === 'Nome' ? 'nome' : null);
const CAUSA_GERAL = { code: 'uniplus.configuracao.bloqueada', message: 'A edição está bloqueada.' };

describe('recusas do problema com causa geral', () => {
  it('separa a causa geral da recusa de campo e mantém a raiz como recusa de campo', () => {
    const recusas = recusasDoProblema(
      problema([CAUSA_GERAL, { field: '', code: 'raiz', message: 'Raiz inválida.' }]),
    );

    expect(recusas.gerais).toEqual([CAUSA_GERAL]);
    expect(recusas.deCampo.map((recusa) => recusa.campo)).toEqual(['']);
  });

  it('mostra a causa geral na área geral sem acionar a mensagem sem mapeamento', () => {
    const texto = aplicarRecusasDoProblema(
      recusasDoProblema(problema([CAUSA_GERAL])),
      formulario(),
      controleDoNome,
    );

    expect(texto).toBe('A edição está bloqueada.');
    expect(texto).not.toContain(MENSAGEM_SEM_MAPEAMENTO);
  });

  it('o campo vazio da raiz não marca controle e pede a mensagem sem mapeamento', () => {
    const form = formulario();

    const texto = aplicarRecusasDoProblema(
      recusasDoProblema(problema([{ field: '', code: 'raiz', message: 'Raiz inválida.' }])),
      form,
      controleDoNome,
    );

    expect(recusasDoControle(form.controls.nome)).toEqual([]);
    expect(texto).toBe(MENSAGEM_SEM_MAPEAMENTO);
  });

  it('marca o campo mapeado e deixa na área geral só a causa geral', () => {
    const form = formulario();

    const texto = aplicarRecusasDoProblema(
      recusasDoProblema(
        problema([{ field: 'Nome', code: 'nome', message: 'Informe o nome.' }, CAUSA_GERAL]),
      ),
      form,
      controleDoNome,
    );

    expect(recusasDoControle(form.controls.nome)).toHaveLength(1);
    expect(texto).toBe('A edição está bloqueada.');
  });

  it('sem causa geral e com o campo mapeado, a área geral fica vazia', () => {
    const texto = aplicarRecusasDoProblema(
      recusasDoProblema(problema([{ field: 'Nome', code: 'nome', message: 'Informe.' }])),
      formulario(),
      controleDoNome,
    );

    expect(texto).toBeNull();
  });

  it('une as mensagens das causas gerais do problema e ignora as de campo', () => {
    const texto = textoDaCausaGeral(
      problema([
        CAUSA_GERAL,
        { field: 'Nome', code: 'nome', message: 'Informe o nome.' },
        { code: 'outra', message: 'Há pendência.' },
      ]),
    );

    expect(texto).toBe('A edição está bloqueada. Há pendência.');
  });

  it('o problema sem causa geral não tem texto de causa geral', () => {
    expect(textoDaCausaGeral(problema([{ field: 'Nome', code: 'n', message: 'm' }]))).toBeNull();
    expect(textoDaCausaGeral(problema(undefined))).toBeNull();
  });
});
