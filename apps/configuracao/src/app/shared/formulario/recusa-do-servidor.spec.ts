import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { paginaDoProblema, type ProblemDetails } from '@uniplus/shared-core/http';
import {
  descartarRecusasDoServidor,
  descartarRecusasDoServidorPorCodigo,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  recusasDoControle,
  type RecusaDoServidor,
} from './recusa-do-servidor';

const BASE_DAS_PAGINAS = 'https://developers.example.test/erros/';

function problema(parcial: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    type: `${BASE_DAS_PAGINAS}uniplus.configuracao.validacao`,
    title: 'Validação',
    status: 422,
    code: 'uniplus.configuracao.validacao',
    traceId: '',
    ...parcial,
  };
}

describe('marcarRecusaDoServidor', () => {
  it('invalida o controle com a recusa da API e o toca', () => {
    const controle = new FormControl('x');

    marcarRecusaDoServidor(controle, 'codigo_repetido', 'Código já usado.');

    expect(recusasDoControle(controle)).toEqual([
      { codigo: 'codigo_repetido', mensagem: 'Código já usado.', pagina: null },
    ]);
    expect(controle.touched).toBe(true);
  });

  it('guarda a página da recusa, como a do 409 que não traz errors[]', () => {
    const controle = new FormControl('x');
    const conflito = problema({
      status: 409,
      type: `${BASE_DAS_PAGINAS}uniplus.configuracao.conflito`,
      code: 'uniplus.configuracao.conflito',
    });

    marcarRecusaDoServidor(controle, conflito.code, 'Já existe.', paginaDoProblema(conflito));

    expect(recusasDoControle(controle)[0].pagina).toBe(
      `${BASE_DAS_PAGINAS}uniplus.configuracao.conflito`,
    );
  });

  it('acumula as recusas do mesmo campo, na ordem recebida', () => {
    const controle = new FormControl('x');

    marcarRecusaDoServidor(controle, 'a', 'Primeira.');
    marcarRecusaDoServidor(controle, 'b', 'Segunda.');

    expect(recusasDoControle(controle).map((recusa) => recusa.mensagem)).toEqual([
      'Primeira.',
      'Segunda.',
    ]);
  });

  it('não repete a recusa igual a uma que o campo já tem', () => {
    const controle = new FormControl('x');

    marcarRecusaDoServidor(controle, 'a', 'Primeira.');
    marcarRecusaDoServidor(controle, 'a', 'Primeira.');

    expect(recusasDoControle(controle)).toHaveLength(1);
  });

  it('mantém as recusas de um campo separadas das do outro', () => {
    const a = new FormControl('x');
    const b = new FormControl('y');

    marcarRecusaDoServidor(a, 'a', 'Do A.');
    marcarRecusaDoServidor(b, 'b', 'Do B.');

    expect(recusasDoControle(a).map((recusa) => recusa.codigo)).toEqual(['a']);
    expect(recusasDoControle(b).map((recusa) => recusa.codigo)).toEqual(['b']);
  });

  it('a edição do campo limpa as recusas do servidor', () => {
    const controle = new FormControl('x');
    marcarRecusaDoServidor(controle, 'a', 'Primeira.');

    controle.setValue('y');

    expect(recusasDoControle(controle)).toEqual([]);
  });
});

describe('recusasDoControle', () => {
  it('é vazia para o controle sem recusa do servidor', () => {
    const controle = new FormControl('x');
    controle.setErrors({ required: true });

    expect(recusasDoControle(controle)).toEqual([]);
  });
});

describe('descartarRecusasDoServidor', () => {
  it('libera o formulário cujo erro do servidor ficou em outro campo, inclusive dentro de lista', () => {
    const form = new FormGroup({
      a: new FormControl('x'),
      b: new FormControl('y', Validators.required),
      itens: new FormArray([new FormGroup({ c: new FormControl('z') })]),
    });
    marcarRecusaDoServidor(form.controls.a, 'regra', 'Revise.');
    marcarRecusaDoServidor(form.controls.itens.at(0).controls.c, 'regra', 'Revise.');
    expect(form.invalid).toBe(true);

    descartarRecusasDoServidor(form);

    expect(form.valid).toBe(true);
  });

  it('descarta só o erro do servidor, sem emitir, e deixa os outros erros onde estão', () => {
    const form = new FormGroup({ a: new FormControl('x'), b: new FormControl('y') });
    marcarRecusaDoServidor(form.controls.a, 'regra', 'Revise.');
    form.controls.b.setErrors({ outro: true });
    let emissoes = 0;
    const contar = (): void => {
      emissoes += 1;
    };
    form.controls.a.valueChanges.subscribe(contar);
    form.controls.a.statusChanges.subscribe(contar);
    form.controls.b.statusChanges.subscribe(contar);
    form.valueChanges.subscribe(contar);
    form.statusChanges.subscribe(contar);

    descartarRecusasDoServidor(form);

    expect(form.controls.a.hasError('backend')).toBe(false);
    expect(form.controls.b.hasError('outro')).toBe(true);
    expect(emissoes).toBe(0);
  });
});

describe('descartarRecusasDoServidorPorCodigo', () => {
  const DO_PAR: ReadonlySet<string> = new Set(['par']);

  it('tira só a recusa do código dado e mantém a outra recusa e o erro local', () => {
    const controle = new FormControl('', Validators.required);
    marcarRecusaDoServidor(controle, 'par', 'Do par.');
    marcarRecusaDoServidor(controle, 'propria', 'Da própria.');

    descartarRecusasDoServidorPorCodigo(controle, DO_PAR);

    expect(recusasDoControle(controle).map((r) => r.codigo)).toEqual(['propria']);
    expect(controle.hasError('required')).toBe(true);
  });

  it('libera o controle quando todas as recusas são do código dado', () => {
    const controle = new FormControl('x');
    marcarRecusaDoServidor(controle, 'par', 'Do par.');

    descartarRecusasDoServidorPorCodigo(controle, DO_PAR);

    expect(controle.errors).toBeNull();
  });

  it('não mexe no controle sem recusa do código dado', () => {
    const controle = new FormControl('x');
    controle.setErrors({ outro: true });

    descartarRecusasDoServidorPorCodigo(controle, DO_PAR);

    expect(controle.errors).toEqual({ outro: true });
  });
});

describe('marcarRecusasDosCampos', () => {
  const recusa = (campo: string, codigo: string, mensagem: string): RecusaDoServidor => ({
    campo,
    codigo,
    mensagem,
    pagina: null,
  });
  const campos = (campo: string): 'a' | 'b' | null =>
    campo === 'A' ? 'a' : campo === 'B' ? 'b' : null;

  it('marca só os campos que a tela mapeia e diz se aplicou algum', () => {
    const form = new FormGroup({ a: new FormControl(''), b: new FormControl('') });

    const aplicou = marcarRecusasDosCampos(
      [recusa('A', 'x', 'Recusado.'), recusa('Desconhecido', 'y', 'Ignorado.')],
      form,
      campos,
    );

    expect(aplicou).toBe(true);
    expect(form.controls.a.hasError('backend')).toBe(true);
    expect(form.controls.b.hasError('backend')).toBe(false);
  });

  it('acumula no campo as recusas que o servidor devolveu para ele, com a página de cada uma', () => {
    const form = new FormGroup({ a: new FormControl(''), b: new FormControl('') });

    marcarRecusasDosCampos(
      [
        { ...recusa('A', 'x', 'Primeira.'), pagina: `${BASE_DAS_PAGINAS}x` },
        recusa('A', 'y', 'Segunda.'),
        recusa('B', 'z', 'Do outro campo.'),
      ],
      form,
      campos,
    );

    expect(recusasDoControle(form.controls.a)).toEqual([
      { codigo: 'x', mensagem: 'Primeira.', pagina: `${BASE_DAS_PAGINAS}x` },
      { codigo: 'y', mensagem: 'Segunda.', pagina: null },
    ]);
    expect(recusasDoControle(form.controls.b)).toHaveLength(1);
  });

  it('devolve falso quando nenhuma recusa tem campo no formulário', () => {
    const form = new FormGroup({ a: new FormControl(''), b: new FormControl('') });

    expect(marcarRecusasDosCampos([recusa('Z', 'x', 'm')], form, campos)).toBe(false);
  });
});
