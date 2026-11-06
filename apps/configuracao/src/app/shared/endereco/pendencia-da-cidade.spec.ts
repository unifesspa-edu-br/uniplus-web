import { DestroyRef, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';
import { limparPendenciaDaCidadeAoPreencher, pendenciaDaCidade } from './pendencia-da-cidade';

const comCidade = {
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
} as EnderecoEstruturado;

describe('pendenciaDaCidade', () => {
  const controle = (erros: Record<string, boolean> | null): FormControl => {
    const item = new FormControl(null);
    item.setErrors(erros);
    return item;
  };

  it('sem cidade, nomeia quem a exige', () => {
    expect(pendenciaDaCidade(controle({ cidadeObrigatoria: true }), 'o campus')).toBe(
      'Selecione a cidade do endereço (obrigatória para o campus).',
    );
  });

  it('com o CEP digitado e sem resolver, quem comunica é o campo do CEP', () => {
    expect(
      pendenciaDaCidade(controle({ cidadeObrigatoria: true, cepNaoResolvido: true }), 'o campus'),
    ).toBeNull();
  });

  it('com a cidade definida, não há pendência', () => {
    expect(pendenciaDaCidade(controle(null), 'o campus')).toBeNull();
  });
});

describe('limparPendenciaDaCidadeAoPreencher', () => {
  const destroyRef = { onDestroy: () => () => undefined } as unknown as DestroyRef;

  it('retira a pendência quando a cidade é preenchida, mas não a recusa do servidor', () => {
    const endereco = new FormControl<EnderecoEstruturado | null>(null);
    const erro = signal<string | null>(
      'Selecione a cidade do endereço (obrigatória para o local).',
    );
    limparPendenciaDaCidadeAoPreencher(endereco, erro, destroyRef);

    endereco.setValue({ ...comCidade, cep: '1' } as EnderecoEstruturado);
    expect(erro()).toBeNull();

    erro.set('A cidade não corresponde ao CEP informado.');
    endereco.setValue(comCidade);
    expect(erro()).toBe('A cidade não corresponde ao CEP informado.');
  });

  it('mantém a pendência enquanto a cidade segue vazia', () => {
    const endereco = new FormControl<EnderecoEstruturado | null>(null);
    const erro = signal<string | null>(
      'Selecione a cidade do endereço (obrigatória para o campus).',
    );
    limparPendenciaDaCidadeAoPreencher(endereco, erro, destroyRef);

    endereco.setValue(null);

    expect(erro()).not.toBeNull();
  });
});
