import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  ROTA_OPCOES,
  ROTA_PROCESSO_RELIDO,
  SEM_CORPO,
  proximoTick,
  recusa422,
  montarPassoDeOpcoes,
} from './vagas.opcoes.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  OFERTA,
  OUTRA_OFERTA,
  ROTA_DISTRIBUICAO,
  comReleitura,
  distribuicao,
} from './vagas.testing';

describe('VagasPassoComponent — número de opções de curso', () => {
  const TEXTO = 'Com 2 opções de curso, cadastre pelo menos dois cursos.';

  let componente: VagasPassoComponent;
  let fixture: ComponentFixture<VagasPassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let tela: HTMLElement;
  let campo: () => HTMLSelectElement;
  let escolherNumero: (numero: string) => void;
  let ofertas: (...ids: string[]) => void;
  let gravado: (numero: number) => void;
  let encerrar: () => void;

  beforeEach(async () => {
    ({
      componente,
      fixture,
      store,
      controller,
      tela,
      campo,
      escolherNumero,
      ofertas,
      gravado,
      encerrar,
    } = await montarPassoDeOpcoes());
  });

  afterEach(() => encerrar());

  it('mostra o número de opções como primeiro campo do padrão, antes da regra, com a ajuda', () => {
    const regra = tela.querySelector('#f-regra') as HTMLElement;

    expect(campo()).not.toBeNull();
    expect(campo().compareDocumentPosition(regra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tela.querySelector('#f-opcoes-curso-ajuda')?.textContent).toContain(
      'Quantos cursos o candidato escolhe na inscrição. Com 2 opções, cadastre pelo menos dois cursos.',
    );
  });

  it('com 2 opções e 1 curso, bloqueia sem chamar a API e mostra o erro ligado ao campo', async () => {
    ofertas(OFERTA);
    escolherNumero('2');

    const resultado = await componente.persistir();
    await proximoTick();
    fixture.detectChanges();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(TEXTO);
    controller.expectNone(ROTA_OPCOES);
    controller.expectNone(ROTA_DISTRIBUICAO);
    const erro = tela.querySelector('#f-opcoes-curso-erro');
    expect(erro?.textContent).toContain(TEXTO);
    expect(erro?.closest('[aria-live]')).not.toBeNull();
    expect(campo().getAttribute('aria-describedby')).toContain('f-opcoes-curso-erro');
    expect(campo().getAttribute('aria-invalid')).toBe('true');
  });

  it('não acusa o erro antes de o operador tentar avançar', () => {
    ofertas(OFERTA);
    escolherNumero('2');

    expect(tela.querySelector('#f-opcoes-curso-erro')).toBeNull();
  });

  it('exige o número declarado', async () => {
    ofertas(OFERTA);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Informe o número de opções de curso.');
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  it('com 2 opções e 2 cursos, grava a distribuição e depois o número', async () => {
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    const opcoes = controller.expectOne(ROTA_OPCOES);
    expect(opcoes.request.method).toBe('PUT');
    expect(opcoes.request.body).toEqual({ numero: 2 });
    expect(opcoes.request.headers.get('Idempotency-Key')).toBeTruthy();
    opcoes.flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('reduzir cursos e opções grava o número primeiro e só então a distribuição', async () => {
    gravado(2);
    ofertas(OFERTA);
    escolherNumero('1');

    const gravacao = componente.persistir();
    // A distribuição só sai depois de o número baixar: com a ordem inversa o servidor a recusaria.
    controller.expectNone(ROTA_DISTRIBUICAO);
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('aumentar cursos e opções grava a distribuição primeiro e só então o número', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectNone(ROTA_OPCOES);
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('grava sempre os dois, mesmo com o quadro e o número iguais aos gravados', async () => {
    gravado(2);
    ofertas(OFERTA, OUTRA_OFERTA);
    store.patchObjectSection('opcoesDeCurso', { numero: '2' });
    fixture.detectChanges();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('relê o processo antes de decidir a ordem quando a gravação anterior ficou inconclusiva', async () => {
    gravado(1);
    ofertas(OFERTA);
    escolherNumero('1');
    store.vagasGravadasDefasadas.set(true);

    const gravacao = componente.persistir();
    // Outra aba ou uma resposta perdida deixou o servidor com 2 opções e 2 ofertas: o número baixa primeiro.
    controller.expectNone(ROTA_OPCOES);
    controller.expectOne(ROTA_PROCESSO_RELIDO).flush({ opcoesDeCurso: { numero: 2 } });
    await proximoTick();
    controller.expectNone(ROTA_DISTRIBUICAO);
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('o erro vindo da API some quando o quadro muda', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    const { body, opts } = recusa422(
      'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas',
    );
    controller.expectOne(ROTA_OPCOES).flush(body, opts);
    await gravacao;
    fixture.detectChanges();
    expect(tela.querySelector('#f-opcoes-curso-erro')).not.toBeNull();

    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA), distribuicao('terceira')],
    });
    fixture.detectChanges();

    expect(tela.querySelector('#f-opcoes-curso-erro')).toBeNull();
  });

  it('o diálogo de confirmação lista o número de opções de curso', () => {
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const itens = componente.confirmacaoDeGravacao()?.itens ?? [];

    expect(itens).toContainEqual({ rotulo: 'Número de opções de curso', valor: '2 opções' });
  });
});
