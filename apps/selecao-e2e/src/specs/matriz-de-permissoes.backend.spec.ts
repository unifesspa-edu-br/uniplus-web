import { test, expect } from '@playwright/test';
import {
  UNIDADE_DO_CERTAME,
  acharNaListagem,
  chamarApi,
  garantirConcessao,
  garantirPerfil,
} from '@uniplus/shared-e2e';
import { cenarioDaProjecao, type CenarioDaProjecao } from '../fixtures/cenario-da-projecao';

/**
 * Cada permissão de dado e de arquivo, sozinha, contra a API real: uma persona fictícia por
 * perfil, e o que a consulta administrativa devolve para ela. `selecao:inscricoes:consultar` dá
 * só o acesso; o que aparece depende da classificação de cada item. A spec confere a resposta
 * da API, que é o que a tela exibe sem decidir nada por conta própria (web#1333 e web#1334).
 */

interface ItemDaResposta {
  readonly fatoCodigo: string;
  readonly valor?: unknown;
  readonly podeRevelar: boolean;
}

interface OfertaEscolhida {
  readonly id: string;
  readonly nome: string;
  readonly ordem: number;
}

interface Resposta {
  readonly id?: string;
  readonly processo?: { readonly id: string; readonly nome: string };
  readonly arquivos?: readonly { readonly classificacaoProtecao: string }[];
  readonly secoes?: readonly { readonly itens?: readonly ItemDaResposta[] }[];
  readonly derivados?: readonly ItemDaResposta[];
  readonly numeroInscricao?: string;
  readonly submetidaEm?: string;
  readonly situacao?: string;
  readonly ofertas?: readonly OfertaEscolhida[];
}

interface Linha {
  readonly id: string;
  readonly processo?: { readonly id: string; readonly nome: string };
  readonly numeroInscricao?: string;
  readonly nome?: { readonly valor: string };
  readonly cpf?: { readonly valor: string; readonly podeRevelar: boolean };
  readonly situacao?: string;
  readonly ofertas?: readonly OfertaEscolhida[];
  readonly submetidaEm?: string;
}

/** As respostas e os derivados que a API devolveu, de qualquer seção. */
function itensDe(corpo: Resposta): readonly ItemDaResposta[] {
  const secoes = corpo.secoes ?? [];
  return [...secoes.flatMap((s) => s.itens ?? []), ...(corpo.derivados ?? [])];
}

// O catálogo não classifica nenhum fato como público: a permissão de dados públicos dá o cabeçalho
// (situação e ofertas) e nenhuma resposta do formulário.
const DADOS = [
  { persona: 'cecilia.assis', permissao: 'selecao:dados-publicos:consultar', classes: [], mascarado: false, revela: false },
  { persona: 'andre.barbosa', permissao: 'selecao:dados-internos:consultar', classes: ['INTERNO'], mascarado: false, revela: false },
  { persona: 'ayla.luz', permissao: 'selecao:dados-pessoais:consultar', classes: ['PESSOAL'], mascarado: false, revela: false },
  { persona: 'barbara.porto', permissao: 'selecao:dados-sensiveis:consultar', classes: ['SENSIVEL'], mascarado: false, revela: false },
  { persona: 'helena.rezende', permissao: 'selecao:dados-identificadores:consultar', classes: ['IDENTIFICADOR'], mascarado: true, revela: false },
  { persona: 'benjamin.drumond', permissao: 'selecao:dados-identificadores:revelar', classes: ['IDENTIFICADOR'], mascarado: false, revela: true },
] as const;

const DOCUMENTOS = [
  { persona: 'breno.novaes', permissao: 'selecao:documentos-publicos:consultar', mostraLaudo: false },
  { persona: 'bruna.peixoto', permissao: 'selecao:documentos-internos:consultar', mostraLaudo: false },
  { persona: 'calebe.souza', permissao: 'selecao:documentos-pessoais:consultar', mostraLaudo: false },
  { persona: 'camila.nunes', permissao: 'selecao:documentos-identificadores:consultar', mostraLaudo: false },
  { persona: 'catarina.rocha', permissao: 'selecao:documentos-sensiveis:consultar', mostraLaudo: true },
] as const;

test.describe('Matriz de permissões de dado e de arquivo', () => {
  let cenario: CenarioDaProjecao;
  const classeDoFato = new Map<string, string>();

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    cenario = await cenarioDaProjecao();
    for (const { persona, permissao } of [...DADOS, ...DOCUMENTOS]) {
      const perfil = await garantirPerfil(
        `E2E projeção — somente ${permissao}`,
        `Matriz de permissões: só ${permissao}, além do acesso às inscrições.`,
        ['selecao:inscricoes:consultar', permissao],
      );
      await garantirConcessao(persona, perfil, UNIDADE_DO_CERTAME);
    }
    let proximo: string | null = '/api/configuracao/admin/fatos-candidato?limit=100';
    while (proximo !== null) {
      const pagina: { corpo: { codigo: string; classificacaoProtecao: string }[]; cabecalhos: Headers } = await chamarApi(
        'isabella.figueiredo',
        'GET',
        proximo,
      );
      pagina.corpo.forEach((f) => classeDoFato.set(f.codigo, f.classificacaoProtecao));
      const link = /<([^>]+)>;\s*rel="next"/.exec(pagina.cabecalhos.get('link') ?? '');
      proximo = link === null ? null : (link[1] ?? '').replace(/^https?:\/\/[^/]+/, '');
    }
  });

  const detalhe = (persona: string) =>
    chamarApi<Resposta>(
      persona,
      'GET',
      `/api/selecao/processos-seletivos/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}`,
    );

  for (const caso of DADOS) {
    test(`só ${caso.permissao}: o detalhe traz apenas as respostas das classes [${caso.classes.join(', ')}]`, async () => {
      const { status, corpo } = await detalhe(caso.persona);
      const itens = itensDe(corpo);
      const classes = new Set(itens.map((i) => String(classeDoFato.get(i.fatoCodigo))));

      expect(status).toBe(200);
      expect([...classes].sort()).toEqual([...caso.classes].sort());
      expect(corpo.arquivos ?? []).toHaveLength(0);
      // Só a permissão de revelar oferece a revelação; só a de consultar o identificador traz o valor mascarado.
      expect(itens.every((i) => i.podeRevelar === caso.revela)).toBe(true);
      if (caso.revela) {
        expect(itens.every((i) => i.valor === undefined)).toBe(true);
      }
      if (caso.mascarado) {
        expect(itens.find((i) => i.fatoCodigo === 'CPF')?.valor).toBe('***.598.363-**');
      }
    });
  }

  for (const caso of DOCUMENTOS.filter((c) => !c.mostraLaudo)) {
    test(`só ${caso.permissao}: o laudo sensível não aparece`, async () => {
      const { status, corpo } = await detalhe(caso.persona);

      expect(status).toBe(200);
      expect(corpo.arquivos).toEqual([]);
    });
  }

  test('só selecao:documentos-sensiveis:consultar: o laudo sensível aparece', async () => {
    const { status, corpo } = await detalhe('catarina.rocha');

    expect(status).toBe(200);
    expect(corpo.arquivos?.map((a) => a.classificacaoProtecao)).toContain('SENSIVEL');
    expect(corpo.arquivos?.filter((a) => a.classificacaoProtecao !== 'SENSIVEL')).toEqual([]);
  });

  test('o detalhe traz o cabeçalho conforme a classe: público dá situação e curso; interno, número e data', async () => {
    const publico = (await detalhe('cecilia.assis')).corpo;
    const interno = (await detalhe('andre.barbosa')).corpo;

    expect(publico.situacao).toBeDefined();
    expect(publico.ofertas?.length).toBeGreaterThan(0);
    expect(publico.numeroInscricao).toBeUndefined();
    expect(interno.numeroInscricao).toBeDefined();
    expect(interno.submetidaEm).toBeDefined();
    expect(interno.situacao).toBeUndefined();
    expect(interno.ofertas).toBeUndefined();
    // O processo acompanha o acesso ao resource, qualquer que seja a classe.
    expect(publico.processo?.id).toBe(cenario.processoId);
    expect(interno.processo?.id).toBe(cenario.processoId);
  });

  test('a listagem segue as mesmas classes: público, interno e pessoal aparecem cada um com a sua permissão', async () => {
    const numeroDoErick = (
      await chamarApi<Resposta>(
        'andre.barbosa',
        'GET',
        `/api/selecao/processos-seletivos/${cenario.processoId}/inscricoes/${cenario.erick.inscricaoId}`,
      )
    ).corpo.numeroInscricao;
    const linhaDe = async (persona: string, procurada: (l: Linha) => boolean): Promise<Linha | undefined> =>
      acharNaListagem<Linha>(persona, `/api/selecao/processos-seletivos/${cenario.processoId}/inscricoes?limit=100`, procurada);

    const publico = await linhaDe('cecilia.assis', (l) => l.id === cenario.erick.inscricaoId);
    const interno = await linhaDe('andre.barbosa', (l) => l.numeroInscricao === numeroDoErick);
    const pessoal = await linhaDe('ayla.luz', (l) => l.id === cenario.erick.inscricaoId);
    const identificador = await linhaDe('helena.rezende', (l) => l.id === cenario.erick.inscricaoId);

    expect(publico?.situacao).toBeDefined();
    expect(publico?.ofertas?.length).toBeGreaterThan(0);
    expect(publico?.nome).toBeUndefined();
    expect(publico?.cpf).toBeUndefined();
    expect(interno?.numeroInscricao).toBe(numeroDoErick);
    expect(interno?.submetidaEm).toBeDefined();
    expect(interno?.nome).toBeUndefined();
    expect(pessoal?.nome?.valor).toBe('Erick Isaac Ramos');
    expect(pessoal?.cpf).toBeUndefined();
    expect(identificador?.cpf?.valor).toBe('***.342.259-**');
    expect(identificador?.cpf?.podeRevelar).toBe(false);
    expect(identificador?.nome).toBeUndefined();
  });

  test('o id e o processo da linha vêm com o acesso, mesmo para quem tem só dados internos', async () => {
    const pagina = await chamarApi<Linha[]>(
      'andre.barbosa',
      'GET',
      `/api/selecao/processos-seletivos/${cenario.processoId}/inscricoes?limit=100`,
    );

    expect(pagina.corpo.length).toBeGreaterThan(0);
    expect(pagina.corpo.every((linha) => linha.id !== undefined && linha.processo?.id === cenario.processoId)).toBe(true);
  });

  // UNI-REQ-0208: revelar independe de ver o valor mascarado; a permissão de revelar basta para a rota.
  test('só a permissão de revelar já revela o CPF pela rota, sem o detalhe mostrar o campo', async () => {
    const revelacao = await chamarApi(
      'benjamin.drumond',
      'POST',
      `/api/selecao/processos-seletivos/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}/campos/CPF/revelacao`,
    );

    expect(revelacao.status).toBe(200);
  });
});
