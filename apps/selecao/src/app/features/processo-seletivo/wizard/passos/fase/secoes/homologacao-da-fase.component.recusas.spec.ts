import { TestBed } from '@angular/core/testing';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RecusasDoServidorNasFases } from '../../cronograma/servicos/recusas-do-servidor-nas-fases.service';
import { usarFase, type ContextoDaFase } from '../fase-passo.testing';
import {
  aAlternativaDaEdicao,
  abrirAFase,
  elementoDe,
  selecionar,
  umaFaseQueHomologa,
  umaRegra,
} from './homologacao-da-fase.testing';

const CODIGO = 'uniplus.selecao.homologacao_das_inscricoes.edicao_do_exame_invalida';
const MENSAGEM = 'A edição do exame deve ser um ano entre 1998 e 2100.';
const CONDICAO = 'homologacao-alternativas-0-condicoes-0';
const EDICAO = `${CONDICAO}-edicaoDoExame`;
const RAIZ = 'fases[0].regraDeHomologacao';

describe('HomologacaoDaFaseComponent: recusas da API', () => {
  let tela: ContextoDaFase;

  usarFase((contexto) => {
    tela = contexto;
  });

  beforeEach(async () => {
    document.body.appendChild(tela.nativo);
    const regra = umaRegra({ alternativas: [aAlternativaDaEdicao(2025)] });
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: regra }));
  });

  afterEach(() => {
    tela.nativo.remove();
  });

  const recusaDe = (campo: string, codigo = CODIGO, mensagem = MENSAGEM): RecusaDoProblema => ({
    campo,
    codigo,
    mensagem,
    pagina: null,
    ordem: 0,
    identificadores: [],
  });
  const recusarTodas = (...recusas: readonly RecusaDoProblema[]): void => {
    const enviadas = tela.store.draft().cronograma.fases;
    TestBed.inject(RecusasDoServidorNasFases).registrar(1, enviadas, recusas, () => true);
    tela.detectar();
  };
  const recusar = (campo: string, codigo = CODIGO, mensagem = MENSAGEM): void =>
    recusarTodas(recusaDe(campo, codigo, mensagem));
  const texto = (sufixo: string) =>
    tela.nativo.querySelector(`#fase-AVALIACAO-${sufixo}`)?.textContent;

  it('mostra a recusa da edição junto ao campo, com o código, e liga o campo a ela', () => {
    recusar(`${RAIZ}.alternativas[0].condicoes[0].edicaoDoExame`);

    const campo = elementoDe(tela.nativo, EDICAO);
    const bloco = elementoDe(tela.nativo, `${EDICAO}-recusa`);

    expect(bloco.textContent).toContain(MENSAGEM);
    expect(bloco.textContent).toContain(CODIGO);
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(bloco.id);
  });

  it('mostra a recusa do motivo e a do tipo junto de cada campo', () => {
    recusarTodas(
      recusaDe(
        `${RAIZ}.alternativas[0].condicoes[0].motivoDesfavoravelCodigo`,
        CODIGO,
        'Motivo recusado.',
      ),
      recusaDe(`${RAIZ}.alternativas[0].condicoes[0].tipo`, CODIGO, 'Tipo recusado.'),
    );

    expect(texto(`${CONDICAO}-motivoDesfavoravelCodigo-recusa`)).toContain('Motivo recusado.');
    expect(texto(`${CONDICAO}-tipo-recusa`)).toContain('Tipo recusado.');
  });

  it('mostra a recusa do resultado junto do seletor dele', () => {
    recusar(
      `${RAIZ}.resultadoAtoCodigo`,
      'uniplus.selecao.homologacao_das_inscricoes.resultado_nao_declarado',
      'Resultado não declarado.',
    );

    expect(texto('homologacao-resultado-recusa')).toContain('Resultado não declarado.');
    expect(elementoDe(tela.nativo, 'homologacao-resultado').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('mostra no alto da seção a recusa à regra inteira', () => {
    recusar(
      RAIZ,
      'uniplus.selecao.homologacao_das_inscricoes.confirmacao_do_inep_ausente',
      'Falta a confirmação do INEP.',
    );

    expect(texto('homologacao-recusa')).toContain('Falta a confirmação do INEP.');
  });

  it('mostra no alto a recusa à alternativa que o servidor aponta e que a tela já não tem', () => {
    recusar(`${RAIZ}.alternativas[1].condicoes[0].tipo`);

    expect(texto('homologacao-recusa')).toContain(MENSAGEM);
  });

  it('passa a recusa do campo ao alto quando a pessoa muda o que ela recusou', () => {
    recusar(`${RAIZ}.alternativas[0].condicoes[0].edicaoDoExame`);

    selecionar(elementoDe(tela.nativo, EDICAO), '2024');
    tela.detectar();

    expect(tela.nativo.querySelector(`#fase-AVALIACAO-${EDICAO}-recusa`)).toBeNull();
    expect(texto('homologacao-recusa')).toContain(MENSAGEM);
  });

  it('não repete a recusa do campo no alto da seção', () => {
    recusar(`${RAIZ}.alternativas[0].condicoes[0].edicaoDoExame`);

    expect(tela.nativo.querySelector('#fase-AVALIACAO-homologacao-recusa')).toBeNull();
  });
});
