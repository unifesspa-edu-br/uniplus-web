import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { CadastroInicialService } from './cadastro-inicial.service';
import { ChaveDeSubstituicao } from './chave-de-substituicao';

/**
 * A `Idempotency-Key` que ficou para trás é invisível: o comando do processo
 * novo sai com a chave que o servidor viu no anterior, e o replay devolve o
 * resultado daquele em vez de aplicar o que foi pedido. Enumerar as chaves à
 * mão no descarte já deixou cinco de fora, então o que se testa aqui não é uma
 * lista — é que NENHUMA sobreviveu.
 */
describe('CadastroInicialService — descarte do cadastro em andamento', () => {
  function chavesDe(servico: CadastroInicialService): Map<string, string> {
    const chaves = new Map<string, string>();
    for (const [nome, campo] of Object.entries(servico)) {
      if (campo instanceof ChaveDeSubstituicao) {
        chaves.set(nome, campo.contextoPara({ corpo: 'igual' }).get(IDEMPOTENCY_KEY_TOKEN) ?? '');
      }
    }
    return chaves;
  }

  it('renova toda chave de substituição, sem depender de lista nominal', () => {
    TestBed.configureTestingModule({
      providers: [
        CadastroInicialService,
        { provide: SELECAO_BASE_PATH, useValue: '/api/selecao' },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const servico = TestBed.inject(CadastroInicialService);

    const antes = chavesDe(servico);
    expect(antes.size, 'o serviço precisa ter chaves de substituição para o teste dizer algo').toBeGreaterThan(10);

    servico.descartarCadastroEmAndamento();

    // Mesmo corpo de novo: sem a renovação, a chave seria reaproveitada tal e qual.
    const depois = chavesDe(servico);
    const sobreviventes = [...antes].filter(([nome, chave]) => depois.get(nome) === chave).map(([nome]) => nome);

    expect(sobreviventes, 'chaves que atravessaram a troca de processo').toEqual([]);
  });
});
