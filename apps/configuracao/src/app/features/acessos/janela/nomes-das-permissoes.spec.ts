import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { GESTAO_DE_ACESSOS, linhaDe, montarJanela } from './pagina-da-janela.testing';

const URL_DO_CATALOGO = 'http://api.test/api/autorizacao/permissoes';
const CODIGO = 'selecao:processos:aprovar';
const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [
          {
            codigo: CODIGO,
            nome: 'Aprovar processos seletivos',
            descricao: '',
            sensibilidade: 'interno',
          },
        ],
      },
    ],
  },
];

describe('nomes das permissões do acréscimo na janela', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('mostra o nome legível quando quem lê pode consultar o catálogo', async () => {
    const pagina = montarJanela([
      GESTAO_DE_ACESSOS,
      PERMISSAO.autorizacao.permissoesConsultarCatalogo,
    ]);
    await pagina.responder(janelaDeMigracao({ itens: [itemDaJanela()] }));
    await pagina.assentar();
    pagina.http.expectOne(URL_DO_CATALOGO).flush(CATALOGO);
    await pagina.assentar();

    const permissao = linhaDe(pagina.host, 'c1').querySelector('td[data-label="Acréscimo"] code');
    expect(permissao?.textContent?.trim()).toBe('Aprovar processos seletivos');
    expect(permissao?.getAttribute('title')).toBe(CODIGO);
  });

  it('mantém o código, sem ler o catálogo, para quem só aprova', async () => {
    const pagina = montarJanela([GESTAO_DE_ACESSOS]);
    await pagina.responder(janelaDeMigracao({ itens: [itemDaJanela()] }));

    const permissao = linhaDe(pagina.host, 'c1').querySelector('td[data-label="Acréscimo"] code');
    expect(permissao?.textContent?.trim()).toBe(CODIGO);
    pagina.http.expectNone(URL_DO_CATALOGO);
  });
});
