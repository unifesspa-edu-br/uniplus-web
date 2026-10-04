import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ApiResult } from '@uniplus/shared-core/http';
import { NEVER, of, type Observable } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import type { ConteudoDoFormulario, FatoDoFormulario, GrupoDoFormulario } from '../editor-de-formulario/formulario-editavel';
import {
  PreVisualizacaoDeFormulariosComponent,
  type DocumentoAvaliado,
  type GrupoAvaliado,
  type ResultadoDaPreVisualizacao,
  type SimulacaoDeFormularios,
} from './pre-visualizacao-de-formularios';

const PARFOR: FatoDoFormulario = {
  codigo: 'PARFOR',
  nome: 'Vínculo com o PARFOR',
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  binding: 'CAMPO_FORMULARIO:PARFOR',
  fonteValores: null,
  escopo: 'CANDIDATO',
  ativo: true,
} as unknown as FatoDoFormulario;

const vazio: ConteudoDoFormulario = { titulo: null, etapas: [], itens: [], termos: [], pressupostos: [], grupos: [] };

describe('PreVisualizacaoDeFormulariosComponent', () => {
  it('o campo que um formulário coleta vai como resposta, mesmo que outro, listado antes, o pressuponha', () => {
    const habilitacao: ConteudoDoFormulario = { ...vazio, pressupostos: ['PARFOR'] };
    const inscricao: ConteudoDoFormulario = {
      ...vazio,
      etapas: [{ codigo: 'S1', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Vínculos', descricao: null, aviso: null }],
      itens: [{ fatoCodigo: 'PARFOR', ordem: 0, rotulo: 'Cursa pelo PARFOR?', tipoRenderizacao: 'BOOLEANO', obrigatoriedade: 'SEMPRE', etapaCodigo: 'S1', pedirConfirmacao: false }],
    };
    let enviada: SimulacaoDeFormularios | null = null;

    const fixture = TestBed.createComponent(PreVisualizacaoDeFormulariosComponent);
    fixture.componentRef.setInput('formularios', [
      { finalidade: 'HABILITACAO', nome: 'habilitação', conteudo: habilitacao },
      { finalidade: 'INSCRICAO', nome: 'inscrição', conteudo: inscricao },
    ]);
    fixture.componentRef.setInput('catalogo', [PARFOR]);
    fixture.componentRef.setInput('avaliar', (simulacao: SimulacaoDeFormularios) => {
      enviada = simulacao;
      return NEVER;
    });
    fixture.componentRef.setInput('idBase', 'previa');
    fixture.componentRef.setInput('origem', 'O processo gravado.');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const parfor = host.querySelector('#previa-simulacao-PARFOR') as HTMLSelectElement;
    parfor.value = 'true';
    parfor.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (Array.from(host.querySelectorAll('button')).find((botao) => botao.textContent?.trim() === 'Pré-visualizar') as HTMLButtonElement).click();

    expect(enviada).toMatchObject({ respostas: { PARFOR: true }, pressupostos: {} });
  });
});

describe('PreVisualizacaoDeFormulariosComponent com campo de município', () => {
  afterEach(() => vi.useRealTimers());

  it('responde o município pelo código IBGE, escolhido pelo nome na busca', async () => {
    vi.useFakeTimers();
    const municipio = { ...PARFOR, codigo: 'MUNICIPIO_RESIDENCIA', nome: 'Município de residência', dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' } as FatoDoFormulario;
    const inscricao: ConteudoDoFormulario = {
      ...vazio,
      etapas: [{ codigo: 'S1', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Endereço', descricao: null, aviso: null }],
      itens: [{ fatoCodigo: 'MUNICIPIO_RESIDENCIA', ordem: 0, rotulo: 'Município', tipoRenderizacao: 'MUNICIPIO', obrigatoriedade: 'SEMPRE', etapaCodigo: 'S1', pedirConfirmacao: false }],
    };
    let enviada: SimulacaoDeFormularios | null = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () => of({ ok: true as const, data: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }], status: 200, headers: new HttpHeaders() }),
        },
      ],
    });

    const fixture = TestBed.createComponent(PreVisualizacaoDeFormulariosComponent);
    fixture.componentRef.setInput('formularios', [{ finalidade: 'INSCRICAO', nome: 'inscrição', conteudo: inscricao }]);
    fixture.componentRef.setInput('catalogo', [municipio]);
    fixture.componentRef.setInput('avaliar', (simulacao: SimulacaoDeFormularios) => {
      enviada = simulacao;
      return NEVER;
    });
    fixture.componentRef.setInput('idBase', 'previa');
    fixture.componentRef.setInput('origem', 'O processo gravado.');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const campo = host.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mar';
    campo.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    [...host.querySelectorAll<HTMLElement>('[role="option"]')].find((opcao) => opcao.textContent?.includes('Marabá'))?.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    (Array.from(host.querySelectorAll('button')).find((botao) => botao.textContent?.trim() === 'Pré-visualizar') as HTMLButtonElement).click();

    expect(enviada).toMatchObject({ respostas: { MUNICIPIO_RESIDENCIA: '1504208' } });

    // A resposta volta a "sem resposta", como nos outros campos.
    const limpar = (): HTMLButtonElement | undefined =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((botao) => botao.textContent?.includes('sem resposta'));
    const botao = limpar();
    expect(botao, 'com resposta, há o que limpar').toBeDefined();
    botao?.click();
    fixture.detectChanges();
    expect(limpar(), 'sem resposta, não há o que limpar').toBeUndefined();
    expect((host.querySelector('input[role="combobox"]') as HTMLInputElement).value).toBe('');
  });
});

describe('PreVisualizacaoDeFormulariosComponent com grupo repetível', () => {
  const RENDA = { ...PARFOR, codigo: 'RENDA', nome: 'Renda mensal', dominio: 'NUMERICO', escopo: 'MEMBRO' } as FatoDoFormulario;
  const MEMBROS = {
    codigo: 'MEMBROS',
    ordem: 0,
    rotulo: 'Composição familiar',
    etapaCodigo: 'S1',
    minimo: 1,
    maximo: '3',
    exibicao: null,
    obrigatoriedade: null,
    predicadoObrigatoriedade: null,
    incluiCandidato: false,
    subitens: [{ fatoCodigo: 'RENDA', ordem: 0, rotulo: 'Renda', tipoRenderizacao: 'NUMERO', obrigatoriedade: 'SEMPRE', etapaCodigo: null, pedirConfirmacao: false }],
  } as unknown as GrupoDoFormulario;
  const inscricao: ConteudoDoFormulario = {
    ...vazio,
    etapas: [{ codigo: 'S1', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Família', descricao: null, aviso: null }],
    grupos: [MEMBROS],
  };
  const avaliado = (grupo: Partial<GrupoAvaliado>, documentos: readonly DocumentoAvaliado[] | null = []): ResultadoDaPreVisualizacao => ({
    formularios: [
      {
        finalidade: 'INSCRICAO',
        itens: [],
        termos: [],
        grupos: [{ codigo: 'MEMBROS', etapaCodigo: 'S1', visivel: 'VERDADEIRO', obrigatorio: 'VERDADEIRO', contagemValida: true, ocorrenciaDoCandidatoValida: true, ocorrencias: [], ...grupo }],
      },
    ],
    documentos,
  });
  const RG: DocumentoAvaliado = {
    exigenciaId: 'e-rg',
    nome: 'RG do membro',
    obrigatorio: true,
    fase: { chave: 'INSCRICAO', nome: 'Inscrição', ordem: 0 },
    etapa: null,
    situacao: 'EXIGIDO',
    grupo: 'MEMBROS',
    ocorrenciaId: 'MEMBROS#2',
    alternativas: [],
  };

  function montar(opcoes: { simulaGrupos?: boolean; resposta?: () => Observable<ApiResult<ResultadoDaPreVisualizacao>> } = {}) {
    const enviadas: SimulacaoDeFormularios[] = [];
    const fixture = TestBed.createComponent(PreVisualizacaoDeFormulariosComponent);
    fixture.componentRef.setInput('formularios', [{ finalidade: 'INSCRICAO', nome: 'inscrição', conteudo: inscricao }]);
    fixture.componentRef.setInput('catalogo', [RENDA]);
    fixture.componentRef.setInput('avaliar', (simulacao: SimulacaoDeFormularios) => {
      enviadas.push(simulacao);
      return opcoes.resposta?.() ?? NEVER;
    });
    fixture.componentRef.setInput('idBase', 'previa');
    fixture.componentRef.setInput('origem', 'O processo gravado.');
    if (opcoes.simulaGrupos !== false) fixture.componentRef.setInput('simulaGrupos', true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const botao = (inicio: string): HTMLButtonElement => {
      const encontrado = Array.from(host.querySelectorAll('button')).find((elemento) => elemento.textContent?.trim().startsWith(inicio));
      expect(encontrado, `o botão "${inicio}" existe`).toBeDefined();
      return encontrado as HTMLButtonElement;
    };
    const escrever = (id: string, texto: string): void => {
      const campo = host.querySelector(`#${id}`) as HTMLInputElement | null;
      expect(campo, `o campo ${id} existe`).not.toBeNull();
      (campo as HTMLInputElement).value = texto;
      (campo as HTMLInputElement).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const acrescentar = async (): Promise<void> => {
      botao('Acrescentar ocorrência').click();
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, host, enviadas, botao, escrever, acrescentar };
  }

  it('envia cada ocorrência acrescentada com a identidade dela e as respostas dos campos', async () => {
    const { botao, escrever, acrescentar, enviadas } = montar();

    await acrescentar();
    escrever('previa-grupo-MEMBROS-1-RENDA', '1500');
    botao('Pré-visualizar').click();

    expect(enviadas[0].grupos).toEqual({ MEMBROS: [{ id: 'MEMBROS#1', respostas: { RENDA: 1500 } }] });
  });

  it('sem a simulação de grupos, os campos de grupo não aparecem e o envio vai sem grupos', () => {
    const { host, botao, enviadas } = montar({ simulaGrupos: false });

    expect(host.textContent).not.toContain('Composição familiar');
    botao('Pré-visualizar').click();
    expect(enviadas[0].grupos).toBeNull();
  });

  it('valor não reconhecido num campo de ocorrência impede pré-visualizar', async () => {
    const { botao, escrever, acrescentar } = montar();

    await acrescentar();
    escrever('previa-grupo-MEMBROS-1-RENDA', 'mil');

    expect(botao('Pré-visualizar').disabled).toBe(true);
  });

  it('mudar a resposta de uma ocorrência descarta o resultado anterior', async () => {
    const { host, botao, escrever, acrescentar, fixture } = montar({ resposta: () => of(ok(avaliado({}))) });
    await acrescentar();
    botao('Pré-visualizar').click();
    fixture.detectChanges();
    expect(host.textContent, 'o resultado aparece').toContain('Grupo: Composição familiar');

    escrever('previa-grupo-MEMBROS-1-RENDA', '900');

    expect(host.textContent).not.toContain('Grupo: Composição familiar');
  });

  it('o grupo oculto com ocorrências simuladas diz que elas só são avaliadas com o grupo exibido', async () => {
    const { host, botao, acrescentar, fixture } = montar({ resposta: () => of(ok(avaliado({ visivel: 'FALSO' }))) });
    await acrescentar();

    botao('Pré-visualizar').click();
    fixture.detectChanges();

    expect(host.textContent).toContain('As ocorrências simuladas só são avaliadas com o grupo exibido.');
  });

  it('a quantidade de ocorrências vale ou não pelo que a API devolve, com o limite do grupo quando não vale', async () => {
    const { host, botao, acrescentar, fixture } = montar({ resposta: () => of(ok(avaliado({ contagemValida: false, ocorrencias: [{ id: 'MEMBROS#1', itens: [] }] }))) });
    await acrescentar();

    botao('Pré-visualizar').click();
    fixture.detectChanges();

    const quantidade = Array.from(host.querySelectorAll('dt')).find((termo) => termo.textContent?.trim() === 'Quantidade de ocorrências');
    expect(quantidade?.nextElementSibling?.textContent?.trim()).toBe('1 — fora do limite de 1 a 3');
  });

  it('enquanto a avaliação está em curso, as ocorrências não mudam', async () => {
    const { host, botao, acrescentar, fixture } = montar();
    await acrescentar();

    botao('Pré-visualizar').click();
    fixture.detectChanges();

    expect(host.querySelector('#previa-grupo-MEMBROS-1-RENDA')?.matches(':disabled')).toBe(true);
    expect(botao('Remover a ocorrência 1').matches(':disabled')).toBe(true);
  });

  it('ao acrescentar uma ocorrência, o foco vai ao primeiro campo dela', async () => {
    const { host, acrescentar } = montar();

    await acrescentar();

    expect(document.activeElement).toBe(host.querySelector('#previa-grupo-MEMBROS-1-RENDA'));
  });

  it('ao remover a única ocorrência, o foco vai ao botão de acrescentar e a remoção é anunciada', async () => {
    const { host, botao, acrescentar, fixture } = montar();
    await acrescentar();

    botao('Remover a ocorrência 1').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(host.querySelector('#previa-grupo-MEMBROS-acrescentar'));
    expect(host.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('Ocorrência 1 removida de Composição familiar.');
  });

  it('o documento por membro diz o grupo e a posição da ocorrência, ou que nenhuma foi avaliada', async () => {
    const semOcorrencia: DocumentoAvaliado = { ...RG, exigenciaId: 'e-cpf', nome: 'CPF do membro', situacao: 'NAO_EXIGIDO', ocorrenciaId: null };
    const { host, botao, acrescentar, fixture } = montar({ resposta: () => of(ok(avaliado({}, [RG, semOcorrencia]))) });
    await acrescentar();
    await acrescentar();
    botao('Remover a ocorrência 1').click();
    fixture.detectChanges();
    await acrescentar();

    botao('Pré-visualizar').click();
    fixture.detectChanges();

    const ocorrencias = Array.from(host.querySelectorAll('td[data-label="Ocorrência"]'), (celula) => celula.textContent?.trim());
    expect(ocorrencias, 'MEMBROS#2 é a primeira depois de remover a MEMBROS#1').toEqual([
      'Composição familiar, ocorrência 1',
      'Composição familiar — sem ocorrência avaliada',
    ]);
  });

  it('sem lista de documentos, a pré-visualização não fala de documentos', async () => {
    const { host, botao, fixture } = montar({ resposta: () => of(ok(avaliado({}, null))) });

    botao('Pré-visualizar').click();
    fixture.detectChanges();

    expect(host.textContent, 'o resultado aparece').toContain('Grupo: Composição familiar');
    expect(host.textContent).not.toContain('Documentos exigidos');
  });
});

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data, status: 200, headers: new HttpHeaders() } as ApiResult<T>;
}
