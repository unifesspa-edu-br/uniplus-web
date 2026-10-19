import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import type {
  CertamePublicadoDto,
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { ComprovanteDaInscricaoPage } from './comprovante-da-inscricao.page';

const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const SEM_CABECALHOS = new HttpHeaders();
/** O que o teste muda nas respostas do comprovante. */
let respostasAlteradas: Record<string, unknown> = {};

/** Fernanda Drumond, persona fictícia do portal de documentação. */
const CPF_DA_CONTA = '69959836371';
const cpfDoLogin = signal(CPF_DA_CONTA);
const usuario = { user: () => ({ cpf: cpfDoLogin() }) };

const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };

const FORMULARIO = {
  etapas: [{ codigo: 'DADOS_BASICOS', ordem: 0, tipo: 'SECAO', titulo: 'Dados do candidato' }],
  fatosColetados: [
    {
      fatoCodigo: 'NOME',
      ordem: 0,
      rotulo: 'Nome completo',
      tipoRenderizacao: 'TEXTO',
      etapaCodigo: 'DADOS_BASICOS',
    },
    {
      fatoCodigo: 'DESEJA_NOME_SOCIAL',
      ordem: 1,
      rotulo: 'Deseja usar nome social?',
      tipoRenderizacao: 'BOOLEANO',
      etapaCodigo: 'DADOS_BASICOS',
    },
    {
      fatoCodigo: 'NOME_SOCIAL',
      ordem: 2,
      rotulo: 'Nome social',
      tipoRenderizacao: 'TEXTO',
      etapaCodigo: 'DADOS_BASICOS',
    },
    {
      fatoCodigo: 'NATURALIDADE_MUNICIPIO',
      ordem: 3,
      rotulo: 'Município de nascimento',
      tipoRenderizacao: 'MUNICIPIO',
      etapaCodigo: 'DADOS_BASICOS',
    },
  ],
  grupos: [],
  termos: [{ codigo: 'VERACIDADE', nome: 'Declaração de veracidade' }],
  pressupostos: [],
} as unknown as FormularioRenderizavelDto;

type ModalidadesDoComprovante = ComprovanteInscricaoDto['modalidades'];

/** O primeiro envio concorre em duas modalidades, gravadas fora da ordem; a correção, em uma. */
const MODALIDADES_POR_ENVIO: Record<number, ModalidadesDoComprovante> = {
  1: [
    { codigo: 'LI_EP', nome: 'Escola pública, independente de renda', ordem: 1 },
    { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 },
  ],
  2: [{ codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 }],
};
/** Nulo quando o processo não define pela inscrição as modalidades de concorrência. */
let modalidadesDoEnvio = (numero: number): ModalidadesDoComprovante =>
  MODALIDADES_POR_ENVIO[numero];

/** A 2ª opção que o envio declarou e as modalidades dela; nulas quando o envio não a declarou. */
let segundaOpcaoDoEnvio: { id: string; modalidades: ModalidadesDoComprovante } | null = null;
/** Quantas opções de curso o processo admite. */
let opcoesDoProcesso = 1;

/** Fernanda Drumond, persona fictícia do portal de documentação, que prefere o nome social. */
function comprovante(numeroInscricao: string, numero: number): ComprovanteInscricaoDto {
  return {
    cpfMascarado: '***.598.363-**',
    numeroInscricao,
    instante: '2026-12-11T13:30:00Z',
    fusoHorario: FUSO,
    hashIntegridade: 'a'.repeat(64),
    ofertaCursoId: 'o2',
    ofertaCursoSegundaOpcaoId: segundaOpcaoDoEnvio?.id ?? null,
    respostas: {
      NOME: 'Fernanda Laura Nicole Drumond',
      DESEJA_NOME_SOCIAL: true,
      NOME_SOCIAL: 'Ariel Drumond',
      NATURALIDADE_MUNICIPIO: '5002704',
      ...respostasAlteradas,
    },
    derivados: {},
    grupos: {},
    aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
    modalidades: modalidadesDoEnvio(numero),
    modalidadesSegundaOpcao: segundaOpcaoDoEnvio?.modalidades ?? null,
  };
}

const OFERTA_MEDICINA = {
  ofertaCursoOrigemId: 'o1',
  cursoNome: 'Medicina',
  cursoGrau: 'Bacharelado',
  unidadeOfertanteNome: 'Campus Marabá',
  turnos: ['MATUTINO', 'VESPERTINO'],
};
const OFERTA_DIREITO = { ...OFERTA_MEDICINA, ofertaCursoOrigemId: 'o2', cursoNome: 'Direito' };

let ofertas: readonly (typeof OFERTA_MEDICINA)[] = [OFERTA_MEDICINA];
/** O fim do período de inscrição, que decide se o envio ainda se corrige. */
let fimDoPeriodo = '2999-12-31T02:59:00Z';
const NAO_ENCONTRADO = apiFailure(
  {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    code: 'nao_encontrado',
    traceId: '',
  },
  404,
  SEM_CABECALHOS,
);

/** Duas submissões: a primeira e a correção. */
const INSCRICAO = {
  processoSeletivoId: PROCESSO,
  nomeDoProcesso: 'Medicina 2027',
  numeroInscricao: '00000042',
  situacao: 'submetida',
  nomePreferido: 'Ariel Drumond',
  cpfMascarado: '***.598.363-**',
  comprovantes: [
    { numero: 1, instante: '2026-12-11T13:30:00Z' },
    { numero: 2, instante: '2026-12-12T09:00:00Z' },
  ],
} as MinhaInscricaoDto;

const servico = {
  listar: () => of(apiOk([INSCRICAO], 200, SEM_CABECALHOS)),
  comprovante: (_: string, numero: number) =>
    of(numero <= 2 ? apiOk(comprovante('00000042', numero), 200, SEM_CABECALHOS) : NAO_ENCONTRADO),
  formulario: () => of(apiOk(FORMULARIO, 200, SEM_CABECALHOS)),
  nomesDosMunicipios: (codigos: readonly string[]) =>
    of(new Map(codigos.map((c) => [c, c === '5002704' ? 'Campo Grande — MS' : c]))),
  certame: (): Observable<ApiResult<CertamePublicadoDto | null>> =>
    of(
      apiOk(
        {
          nome: 'Medicina 2027',
          identificadorLegivel: 'Edital 001/2026',
          unidadeAdministradora: { nome: 'Centro de Processos Seletivos' },
          periodo: { inicio: '2026-12-01T03:00:00Z', fim: fimDoPeriodo },
          localidade: { fusoHorario: FUSO },
          ofertas,
          opcoesDeCurso: { numero: opcoesDoProcesso },
        } as unknown as CertamePublicadoDto,
        200,
        SEM_CABECALHOS,
      ),
    ),
};

let fixture: ComponentFixture<ComprovanteDaInscricaoPage>;

async function abrir(numero?: string): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [ComprovanteDaInscricaoPage],
    providers: [
      provideRouter([]),
      { provide: MinhasInscricoesService, useValue: servico },
      { provide: UserContextService, useValue: usuario },
    ],
  });
  fixture = TestBed.createComponent(ComprovanteDaInscricaoPage);
  fixture.componentRef.setInput('processoId', PROCESSO);
  if (numero) fixture.componentRef.setInput('numero', numero);
  await atualizar();
  return fixture.nativeElement as HTMLElement;
}

async function atualizar(): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const links = (tela: HTMLElement): string[] =>
  Array.from(tela.querySelectorAll('nav a')).map((a) => a.textContent?.trim() ?? '');

/** A seção do comprovante pelo título dela. */
const secao = (tela: HTMLElement, titulo: string): HTMLElement | null =>
  (Array.from(tela.querySelectorAll('ui-secao-de-documento')).find(
    (s) => s.querySelector('.secao-de-documento__titulo')?.textContent?.trim() === titulo,
  ) as HTMLElement | undefined) ?? null;

const modalidadesNaTela = (tela: HTMLElement): string[] =>
  Array.from(
    secao(tela, 'Modalidades em que você concorre')?.querySelectorAll('ul > li') ?? [],
  ).map((li) => li.textContent?.trim() ?? '');

const dado = (tela: HTMLElement, rotulo: string): string | null => {
  const par = Array.from(tela.querySelectorAll('dl > div')).find(
    (d) => d.querySelector('dt')?.textContent?.trim() === rotulo,
  );
  return par?.querySelector('dd')?.textContent?.trim().replace(/\s+/g, ' ') ?? null;
};

describe('ComprovanteDaInscricaoPage', () => {
  afterEach(() => {
    cpfDoLogin.set(CPF_DA_CONTA);
    fimDoPeriodo = '2999-12-31T02:59:00Z';
    modalidadesDoEnvio = (numero) => MODALIDADES_POR_ENVIO[numero];
    respostasAlteradas = {};
    segundaOpcaoDoEnvio = null;
    opcoesDoProcesso = 1;
    vi.restoreAllMocks();
  });

  it('o titular revela o CPF do login para conferir, sem nova consulta', async () => {
    const tela = await abrir();
    const consultas = (Object.keys(servico) as (keyof typeof servico)[]).map((metodo) =>
      vi.spyOn(servico, metodo),
    );

    (tela.querySelector('button[aria-label="Mostrar CPF"]') as HTMLButtonElement).click();
    await atualizar();

    expect(tela.querySelector('.dado-revelavel__tela')?.textContent?.trim()).toBe('699.598.363-71');
    for (const consulta of consultas) expect(consulta).not.toHaveBeenCalled();
  });

  it('sem conferir com o CPF do comprovante, o do login não se revela', async () => {
    // Kevin Carvalho, outra persona fictícia.
    cpfDoLogin.set('33257350376');
    const tela = await abrir();

    expect(tela.querySelector('button[aria-label="Mostrar CPF"]')).toBeNull();
    expect(tela.textContent).toContain('***.598.363-**');
    expect(tela.textContent).not.toContain('332.573.503-76');
  });

  it('com nome social, ele vem em destaque e o nome civil em seguida, sem se repetirem nas respostas', async () => {
    const tela = await abrir();

    expect(dado(tela, 'Uso do nome social')).toBe('Sim');
    expect(dado(tela, 'Nome social')).toBe('Ariel Drumond');
    expect(dado(tela, 'Nome civil')).toBe('Fernanda Laura Nicole Drumond');
    expect(dado(tela, 'Nome')).toBeNull();
    expect(dado(tela, 'Nome completo')).toBeNull();
    expect(dado(tela, 'Deseja usar nome social?')).toBeNull();
  });

  it('sem uso do nome social, o comprovante registra "Não" e não mostra nome social algum', async () => {
    respostasAlteradas = { DESEJA_NOME_SOCIAL: false };
    const tela = await abrir();

    expect(dado(tela, 'Uso do nome social')).toBe('Não');
    expect(dado(tela, 'Nome')).toBe('Fernanda Laura Nicole Drumond');
    expect(dado(tela, 'Nome social')).toBeNull();
    expect(tela.textContent).not.toContain('Ariel Drumond');
  });

  it('quando o formulário não coleta o uso do nome social, o comprovante não registra o dado', async () => {
    respostasAlteradas = { DESEJA_NOME_SOCIAL: undefined, NOME_SOCIAL: undefined };
    const tela = await abrir();

    expect(dado(tela, 'Uso do nome social')).toBeNull();
    expect(dado(tela, 'Nome')).toBe('Fernanda Laura Nicole Drumond');
  });

  it('o município de nascimento aparece pelo nome e pela UF, não pelo código', async () => {
    const tela = await abrir();

    expect(dado(tela, 'Município de nascimento')).toBe('Campo Grande — MS');
    expect(tela.textContent).not.toContain('5002704');
  });

  it('o envio sai no fuso do processo, com o nome dele', async () => {
    const tela = await abrir();

    expect(dado(tela, 'Enviado em')).toBe('11/12/2026, 10:30, horário de Belém (PA)');
  });

  it('o último envio é o que vale e se corrige até o fim do período', async () => {
    const tela = await abrir();

    expect(dado(tela, 'Situação')).toBe('É o que vale');
    expect(tela.textContent).toContain('Envio 2 de 2');
    expect(tela.textContent).toContain('Você pode corrigir a inscrição até');
    expect(links(tela)).toEqual(['‹ Envio anterior']);
    expect(tela.querySelector('.alert')).toBeNull();
  });

  it('o envio anterior foi substituído: avisa, aponta o mais recente e não oferece correção', async () => {
    const tela = await abrir('1');

    expect(dado(tela, 'Situação')).toBe('Substituído');
    expect(tela.textContent).toContain('Envio 1 de 2');
    expect(tela.querySelector('[aria-live="polite"] .alert')?.textContent).toContain(
      'Este envio foi substituído por um mais recente.',
    );
    expect(tela.textContent).not.toContain('Corrigir inscrição');
    expect(tela.textContent).not.toContain('Próximos passos');
  });

  it('com o período encerrado, diz quando terminou e não oferece correção', async () => {
    fimDoPeriodo = '2026-01-16T02:59:00Z';
    const tela = await abrir();

    expect(tela.textContent).toContain(
      'O período de inscrição terminou em 15/01/2026, 23:59, horário de Belém (PA).',
    );
    expect(tela.textContent).not.toContain('Corrigir inscrição');
  });

  it('ao abrir, o foco vai ao título do documento', async () => {
    const tela = await abrir();

    expect(document.activeElement).toBe(tela.querySelector('h1'));
  });

  it('a falha transitória ao ler o certame leva ao erro com nova tentativa, não ao comprovante sem prazo', async () => {
    vi.spyOn(servico, 'certame').mockReturnValue(
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Serviço indisponível',
            status: 503,
            code: 'indisponivel',
            traceId: '',
          },
          503,
          SEM_CABECALHOS,
        ),
      ),
    );

    const tela = await abrir();

    expect(tela.textContent).not.toContain('Imprimir comprovante');
    expect(tela.textContent).toContain('Tentar novamente');
  });

  it('um número que a inscrição não emitiu não abre comprovante nenhum', async () => {
    const tela = await abrir('3');

    expect(tela.textContent).toContain('Não encontramos este comprovante');
    expect(tela.textContent).not.toContain('Imprimir comprovante');
  });

  it.each(['foo', '0'])(
    'o número %s, que não é de comprovante, não abre o mais recente nem o pede ao serviço',
    async (numero) => {
      const pedir = vi.spyOn(servico, 'comprovante');

      const tela = await abrir(numero);

      expect(tela.textContent).toContain('Não encontramos este comprovante');
      expect(pedir).not.toHaveBeenCalled();
    },
  );

  it('mostra o curso escolhido pelo nome congelado na publicação', async () => {
    ofertas = [OFERTA_MEDICINA, OFERTA_DIREITO];
    const tela = await abrir();
    ofertas = [OFERTA_MEDICINA];

    expect(dado(tela, 'Curso')).toBe(
      'Direito (Bacharelado) — Campus Marabá — Matutino e Vespertino',
    );
  });

  it('com 2 opções, mostra a 1ª e a 2ª e as modalidades concorridas em cada uma', async () => {
    ofertas = [OFERTA_MEDICINA, OFERTA_DIREITO];
    opcoesDoProcesso = 2;
    segundaOpcaoDoEnvio = {
      id: 'o1',
      modalidades: [{ codigo: 'LI_EP', nome: 'Escola pública, independente de renda', ordem: 0 }],
    };
    const tela = await abrir('1');
    ofertas = [OFERTA_MEDICINA];

    expect(dado(tela, '1ª opção')).toContain('Direito');
    expect(dado(tela, '2ª opção')).toContain('Medicina');
    expect(dado(tela, 'Curso')).toBeNull();
    const modalidades = secao(tela, 'Modalidades em que você concorre');
    const listas = [...(modalidades?.querySelectorAll('ul') ?? [])].map((ul) =>
      [...ul.querySelectorAll('li')].map((li) => li.textContent?.trim()),
    );
    expect(listas).toEqual([
      ['Ampla concorrência', 'Escola pública, independente de renda'],
      ['Escola pública, independente de renda'],
    ]);
  });

  it('o processo de 2 opções com a 2ª vazia mostra "Não declarada" e as modalidades só da 1ª', async () => {
    ofertas = [OFERTA_MEDICINA, OFERTA_DIREITO];
    opcoesDoProcesso = 2;
    const tela = await abrir('1');
    ofertas = [OFERTA_MEDICINA];

    expect(dado(tela, '2ª opção')).toBe('Não declarada');
    const modalidades = secao(tela, 'Modalidades em que você concorre');
    expect(modalidades?.querySelectorAll('ul')).toHaveLength(1);
  });

  it('trocar o número na mesma página mostra o outro envio', async () => {
    const tela = await abrir('2');

    fixture.componentRef.setInput('numero', '1');
    await atualizar();

    expect(tela.textContent).toContain('Envio 1 de 2');
    expect(links(tela)).toEqual(['Envio seguinte ›']);
  });

  it('lista as modalidades do envio pelo nome congelado, na ordem gravada, sem o código', async () => {
    const tela = await abrir('1');

    expect(modalidadesNaTela(tela)).toEqual([
      'Ampla concorrência',
      'Escola pública, independente de renda',
    ]);
    const texto = secao(tela, 'Modalidades em que você concorre')?.textContent ?? '';
    expect(texto).not.toContain('LI_EP');
    expect(texto).not.toMatch(/\bAC\b/);
  });

  it('o comprovante da correção mostra as modalidades que ela recalculou', async () => {
    const tela = await abrir();

    expect(modalidadesNaTela(tela)).toEqual(['Ampla concorrência']);
  });

  it('o processo que não define as modalidades pela inscrição diz isso, sem lista', async () => {
    modalidadesDoEnvio = () => null;
    const tela = await abrir();

    const modalidades = secao(tela, 'Modalidades em que você concorre');
    expect(modalidades?.querySelector('ul')).toBeNull();
    expect(modalidades?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Este processo seletivo não define pela inscrição as modalidades de concorrência. Consulte o edital.',
    );
  });
});
