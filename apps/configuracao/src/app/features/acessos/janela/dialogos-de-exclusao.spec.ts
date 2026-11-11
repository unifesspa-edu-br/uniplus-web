import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import {
  GESTAO_DE_ACESSOS,
  PROTECAO_DE_DADOS,
  abrirJanela,
  botao,
  escolher,
  linhaDe,
  presente,
} from './pagina-da-janela.testing';

const RETIDA = itemDaJanela({
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  situacao: 'retida',
});
const NA_PROTECAO = itemDaJanela({
  concessaoId: 'c2',
  beneficiarioNome: 'Leandro Teste',
  situacao: 'aguardando_protecao_de_dados',
  exigeProtecaoDeDados: true,
});
const JANELA = janelaDeMigracao({ loteEnviado: true, itens: [RETIDA, NA_PROTECAO] });
const caixaDe = (dialogo: Element) =>
  presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]'));

describe('diálogos de exclusão presentes na mesma tela', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('cada diálogo tem a própria caixa, e o foco vai à do diálogo em que se tentou confirmar', async () => {
    const { host, assentar } = await abrirJanela(JANELA, [GESTAO_DE_ACESSOS, PROTECAO_DE_DADOS]);
    const dialogos = [...host.querySelectorAll('cfg-exclusao-dialog')];
    expect(dialogos).toHaveLength(3);
    const ids = dialogos.map((dialogo) => caixaDe(dialogo).id);
    expect(new Set(ids).size).toBe(3);

    presente(botao(linhaDe(host, 'c1'), 'Recusar')).click();
    await assentar();
    const daRetida = presente(host.querySelector('cfg-retidas-da-janela cfg-exclusao-dialog'));
    presente(botao(daRetida, 'Recusar concessão')).click();
    await assentar();
    expect(document.activeElement).toBe(caixaDe(daRetida));
    expect(caixaDe(daRetida).getAttribute('aria-describedby')).toBe(`${caixaDe(daRetida).id}-erro`);

    escolher(linhaDe(host, 'c2'), 'Recusar');
    await assentar();
    presente(botao(host, 'Enviar as decisões')).click();
    await assentar();
    const daProtecao = presente(
      host.querySelector('cfg-protecao-de-dados-da-janela cfg-exclusao-dialog'),
    );
    presente(botao(daProtecao, 'Recusar e enviar')).click();
    await assentar();
    expect(document.activeElement).toBe(caixaDe(daProtecao));
  });
});
