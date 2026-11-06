import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
} from './recusa-do-servidor';

describe('marcarRecusaDoServidor', () => {
  it('invalida o controle com a mensagem da API e o toca', () => {
    const controle = new FormControl('x');

    marcarRecusaDoServidor(controle, 'codigo_repetido', 'Código já usado.');

    expect(controle.errors).toEqual({
      backend: { code: 'codigo_repetido', message: 'Código já usado.' },
    });
    expect(controle.touched).toBe(true);
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

describe('marcarRecusasDosCampos', () => {
  const campos = (campo: string): 'a' | 'b' | null =>
    campo === 'A' ? 'a' : campo === 'B' ? 'b' : null;

  it('marca só os campos que a tela mapeia e diz se aplicou algum', () => {
    const form = new FormGroup({ a: new FormControl(''), b: new FormControl('') });

    const aplicou = marcarRecusasDosCampos(
      [
        { field: 'A', code: 'x', message: 'Recusado.' },
        { field: 'Desconhecido', code: 'y', message: 'Ignorado.' },
      ],
      form,
      campos,
    );

    expect(aplicou).toBe(true);
    expect(form.controls.a.hasError('backend')).toBe(true);
    expect(form.controls.b.hasError('backend')).toBe(false);
  });

  it('devolve falso quando nenhuma recusa tem campo no formulário', () => {
    const form = new FormGroup({ a: new FormControl(''), b: new FormControl('') });

    expect(marcarRecusasDosCampos([{ field: 'Z', code: 'x', message: 'm' }], form, campos)).toBe(
      false,
    );
  });
});
