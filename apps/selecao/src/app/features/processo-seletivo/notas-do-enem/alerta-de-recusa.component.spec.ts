import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLIENT_PROBLEM_CODES, type ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { AlertaDeRecusaComponent } from './alerta-de-recusa.component';
import { explicarRecusa, type ContextoDaRecusa, type RecusaExplicada } from './recusas-do-enem';

const NS = 'uniplus.selecao.notas_do_enem.';
const ID = '0af7651916cd43dd8448eb211c80319c';

@Component({
  standalone: true,
  imports: [AlertaDeRecusaComponent],
  template: `<sel-alerta-de-recusa [recusa]="recusa" />`,
})
class AnfitriaoComponent {
  recusa!: RecusaExplicada;
}

function problema(status: number, code: string, extras: Partial<ProblemDetails> = {}) {
  return { type: 'about:blank', title: 'Recusa', status, code, traceId: ID, ...extras };
}

function renderizar(recusa: RecusaExplicada): HTMLElement {
  const fixture = TestBed.createComponent(AnfitriaoComponent);
  fixture.componentInstance.recusa = recusa;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const bloco = (raiz: HTMLElement): HTMLElement | null =>
  raiz.querySelector('ui-referencia-ao-suporte');

describe('AlertaDeRecusaComponent: referência ao suporte', () => {
  it.each<ContextoDaRecusa>(['importacao', 'envio', 'lote'])(
    'a recusa da API no uso "%s" mostra o código do erro e o identificador do pedido',
    (contexto) => {
      const raiz = renderizar(explicarRecusa(problema(422, `${NS}lote_nao_encontrado`), contexto));

      expect(bloco(raiz)?.textContent).toContain('Código do erro');
      expect(bloco(raiz)?.textContent).toContain(`${NS}lote_nao_encontrado`);
      expect(bloco(raiz)?.textContent).toContain('Identificador do pedido');
      expect(bloco(raiz)?.textContent).toContain(ID);
    },
  );

  it('o bloco fica fora da região que anuncia a recusa', () => {
    const raiz = renderizar(explicarRecusa(problema(422, `${NS}arquivo_vazio`), 'importacao'));

    expect(raiz.querySelector('[role="alert"]')?.contains(bloco(raiz))).toBe(false);
    expect(bloco(raiz)).not.toBeNull();
  });

  it('a linha "Código para a equipe técnica" não existe mais', () => {
    const raiz = renderizar(explicarRecusa(problema(500, 'uniplus.erro.interno'), 'envio'));

    expect(raiz.textContent).not.toContain('Código para a equipe técnica');
    expect(bloco(raiz)).not.toBeNull();
  });

  it('o arquivo grande demais traz o bloco ao lado da orientação à equipe técnica', () => {
    const raiz = renderizar(
      explicarRecusa(problema(413, `${NS}arquivo_grande_demais`), 'importacao'),
    );

    expect(raiz.textContent).toContain('acione a equipe técnica');
    expect(bloco(raiz)?.textContent).toContain(ID);
  });

  it('o código de situação desconhecido mantém a linha e a coluna e traz o bloco', () => {
    const raiz = renderizar(
      explicarRecusa(
        problema(422, `${NS}codigo_de_situacao_desconhecido`, { detail: 'Linha 3, coluna 21.' }),
        'importacao',
      ),
    );

    expect(raiz.textContent).toContain('Linha 3, coluna 21.');
    expect(bloco(raiz)?.textContent).toContain(ID);
  });

  it('a recusa sem código nem identificador no formato da API não mostra o bloco', () => {
    const raiz = renderizar(
      explicarRecusa(problema(422, 'Fora do Formato', { traceId: 'abc' }), 'importacao'),
    );

    expect(bloco(raiz)).toBeNull();
    expect(raiz.textContent).not.toContain('Código do erro');
  });

  it('a falha de conexão sem resposta não mostra o bloco', () => {
    const raiz = renderizar(
      explicarRecusa(
        problema(0, CLIENT_PROBLEM_CODES.NETWORK_ERROR, { traceId: '' }),
        'importacao',
      ),
    );

    expect(bloco(raiz)).toBeNull();
  });

  it('o identificador fora do formato não aparece, e o código sozinho sim', () => {
    const raiz = renderizar(
      explicarRecusa(problema(422, `${NS}arquivo_vazio`, { traceId: 'trace-1' }), 'importacao'),
    );

    expect(bloco(raiz)?.textContent).not.toContain('Identificador do pedido');
    expect(bloco(raiz)?.textContent).toContain(`${NS}arquivo_vazio`);
  });
});
