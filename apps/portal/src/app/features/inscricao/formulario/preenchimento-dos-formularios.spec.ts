import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ErroDoServidor } from '@uniplus/shared-inscricao/formulario';

import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { EscolhaDoCurso } from './escolha-do-curso';
import { DOIS_FORMULARIOS } from './formularios-da-inscricao.testing';
import { GravacaoDaInscricao } from './gravacao-da-inscricao';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import { PreenchimentoDosFormularios } from './preenchimento-dos-formularios';

const FORMULARIOS = [...DOIS_FORMULARIOS, { ...DOIS_FORMULARIOS[0], codigo: 'EXTRA' }];
const RECUSA_DO_NOME: ErroDoServidor = { campo: 'NOME', mensagem: 'Informe o nome completo.' };

function montar() {
  const errosDoServidor = signal<readonly ErroDoServidor[]>([]);
  const naTela = signal<unknown>(null);
  TestBed.configureTestingModule({
    providers: [
      PreenchimentoDosFormularios,
      {
        provide: LeituraDaInscricao,
        useValue: { formularios: signal(FORMULARIOS.map((formulario) => ({ formulario }))) },
      },
      { provide: GravacaoDaInscricao, useValue: { errosDoServidor } },
      { provide: AvaliacaoDaInscricaoEstado, useValue: { naTela } },
      {
        provide: EscolhaDoCurso,
        useValue: { erroDaOferta: signal(null), erroDaSegundaOferta: signal(null) },
      },
    ],
  });
  const preenchimento = TestBed.inject(PreenchimentoDosFormularios);
  return { preenchimento, errosDoServidor, naTela };
}

describe('PreenchimentoDosFormularios — recusas do envio', () => {
  let cenario: ReturnType<typeof montar>;

  beforeEach(() => {
    cenario = montar();
    cenario.errosDoServidor.set([RECUSA_DO_NOME]);
    TestBed.tick();
  });

  it('mantém a mesma lista de recusas do formulário quando só a avaliação muda', () => {
    const antes = cenario.preenchimento.recusasDe('INSCRICAO');

    cenario.naTela.set({ documentos: { fases: [] }, calculando: false });
    cenario.naTela.set({ documentos: { fases: [] }, calculando: true });

    expect(antes).toEqual([RECUSA_DO_NOME]);
    expect(cenario.preenchimento.recusasDe('INSCRICAO')).toBe(antes);
  });

  it('mantém a lista quando a avaliação só muda o nome do documento recusado', () => {
    const documentos = (nome: string) => ({
      documentos: {
        fases: [
          { documentos: [{ exigenciaId: 'exigencia-1', nome, formularioCodigo: 'INSCRICAO' }] },
        ],
      },
    });
    cenario.errosDoServidor.set([
      { campo: 'documentos.exigencia-1.ocorrencia-1', mensagem: 'Envie.' },
    ]);
    cenario.naTela.set(documentos('Histórico escolar'));
    TestBed.tick();
    const antes = cenario.preenchimento.recusasDe('INSCRICAO');

    cenario.naTela.set(documentos('Histórico escolar completo'));

    expect(antes).toHaveLength(1);
    expect(cenario.preenchimento.recusasDe('INSCRICAO')).toBe(antes);
  });

  it('mantém a lista de um formulário quando a recusa de outro muda de lugar', () => {
    const documento = (formularioCodigo: string) => ({
      documentos: {
        fases: [
          { documentos: [{ exigenciaId: 'exigencia-1', nome: 'Histórico', formularioCodigo }] },
        ],
      },
    });
    cenario.errosDoServidor.set([
      RECUSA_DO_NOME,
      { campo: 'documentos.exigencia-1.ocorrencia-1', mensagem: 'Envie.' },
    ]);
    cenario.naTela.set(documento('DADOS_ACADEMICOS'));
    TestBed.tick();
    const doNome = cenario.preenchimento.recusasDe('INSCRICAO');

    cenario.naTela.set(documento('EXTRA'));

    expect(cenario.preenchimento.recusasDe('INSCRICAO')).toBe(doNome);
  });

  it('entrega uma lista nova quando o servidor recusa de novo', () => {
    const antes = cenario.preenchimento.recusasDe('INSCRICAO');

    cenario.errosDoServidor.set([{ ...RECUSA_DO_NOME }]);
    TestBed.tick();

    expect(cenario.preenchimento.recusasDe('INSCRICAO')).not.toBe(antes);
    expect(cenario.preenchimento.recusasDe('INSCRICAO')).toEqual([RECUSA_DO_NOME]);
  });
});
