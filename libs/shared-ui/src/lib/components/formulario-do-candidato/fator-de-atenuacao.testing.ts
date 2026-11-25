import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BUSCA_DE_MUNICIPIOS,
  type MunicipioEncontrado,
} from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP } from '../endereco-geo/endereco-geo.model';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type {
  CampoApresentado,
  DependenciasDaAvaliacao,
  FormularioDoCandidato,
  GrupoApresentado,
  RespostaFixa,
} from './formulario-do-candidato.model';
import type {
  GrupoDasRegras,
  ItemDasRegras,
  ValorJson,
} from './interpretador/regras-do-formulario';
import {
  apresentacaoDaPagina,
  campoApresentado,
  grupoDasRegras,
  itemDasRegras,
} from './formularios-de-exemplo.testing';
import type { MunicipiosGravados } from './valor-de-municipio-gravado';

/** A Revisão e aceite resume o pedido do Fator de Atenuação (UNI-REQ-0150) com os rótulos do formulário. */
export const SOLICITA_O_FATOR = 'PEDE_BENEFICIO_X';
export const CAMINHO_DO_FATOR = 'VINCULO_BENEFICIO_X';
export const MUNICIPIO_DO_FATOR = 'CIDADE_BENEFICIO_X';
export const FATO_FORA_DO_FATOR = 'OUTRA_PERGUNTA';
export const MESES_NA_AREA = 'MESES_NA_AREA';
export const ATIVIDADES_NA_AREA = 'ATIVIDADES_NA_AREA';
export const DATA_INICIO_NA_AREA = 'DATA_INICIO_NA_AREA';
export const TELEFONE_DO_CONTATO = 'TELEFONE_DO_CONTATO';

const PAGINA_DO_FATOR_NAS_REGRAS = 'Inscricao:FATOR';

const FATOS_COM_O_FATOR = [
  SOLICITA_O_FATOR,
  CAMINHO_DO_FATOR,
  MUNICIPIO_DO_FATOR,
  FATO_FORA_DO_FATOR,
  MESES_NA_AREA,
  ATIVIDADES_NA_AREA,
  DATA_INICIO_NA_AREA,
  TELEFONE_DO_CONTATO,
];

const DEPENDENCIAS_PADRAO = {
  fatos: [MUNICIPIO_DO_FATOR, SOLICITA_O_FATOR, CAMINHO_DO_FATOR].sort(),
  grupos: [],
};

const PAGINAS_DO_FATOR: FormularioDoCandidato['paginas'] = [
  {
    codigo: 'FATOR',
    codigoNasRegras: PAGINA_DO_FATOR_NAS_REGRAS,
    ordem: 0,
    tipo: 'SECAO',
    apresentacao: apresentacaoDaPagina('Fator de Atenuação'),
  },
  {
    codigo: 'REVISAO',
    codigoNasRegras: null,
    ordem: 1,
    tipo: 'BLOCO',
    bloco: 'REVISAO_E_ACEITE',
    apresentacao: apresentacaoDaPagina('Revisão e aceite'),
  },
];

const CAMPOS_DO_FATOR: CampoApresentado[] = [
  campoApresentado(SOLICITA_O_FATOR, 'Deseja solicitar o Fator?', 'SIM_OU_NAO'),
  campoApresentado(
    CAMINHO_DO_FATOR,
    'Por qual vínculo com a área você solicita o Fator?',
    'ESCOLHA_UNICA',
    {
      ordem: 1,
      valoresSelecionaveis: [
        { codigo: 'RESIDENCIA', descricao: 'Residência no período do edital', ordem: 0 },
        { codigo: 'ENSINO_MEDIO', descricao: 'Ensino médio cursado na área', ordem: 1 },
      ],
    },
  ),
  campoApresentado(MUNICIPIO_DO_FATOR, 'Em qual município você residiu?', 'ESCOLHA_UNICA', {
    ordem: 2,
    valoresSelecionaveis: [{ codigo: '2105302', descricao: 'Imperatriz — MA', ordem: 0 }],
  }),
  campoApresentado(MESES_NA_AREA, 'Meses na área', 'NUMERO', { ordem: 4 }),
  campoApresentado(ATIVIDADES_NA_AREA, 'Atividades na área', 'ESCOLHA_MULTIPLA', {
    ordem: 5,
    valoresSelecionaveis: [
      { codigo: 'PESCA', descricao: 'Pesca artesanal', ordem: 0 },
      { codigo: 'ROCA', descricao: 'Roça de subsistência', ordem: 1 },
    ],
  }),
  campoApresentado(DATA_INICIO_NA_AREA, 'Início na área', 'DATA', { ordem: 6 }),
  campoApresentado(TELEFONE_DO_CONTATO, 'Telefone de contato', 'TEXTO', {
    ordem: 7,
    formato: 'TELEFONE',
  }),
];

const CAMPO_FORA_DO_FATOR = campoApresentado(FATO_FORA_DO_FATOR, 'Outra pergunta', 'TEXTO', {
  ordem: 3,
});

const GRUPO_DA_FAMILIA: GrupoApresentado = {
  codigo: 'FAMILIA',
  ordem: 0,
  rotulo: 'Integrante da família',
  ocorrencias: { minimo: 0, maximo: 3, incluiCandidato: false },
  subitens: [
    campoApresentado('RENDA', 'Renda', 'NUMERO'),
    campoApresentado('NOME', 'Nome', 'TEXTO', { ordem: 1 }),
    campoApresentado('BONUS', 'Bônus', 'NUMERO', { ordem: 2 }),
  ],
};

/** O bônus só aparece quando a renda é 999, valor que nenhuma ocorrência dos testes informa. */
const REGRA_DO_GRUPO_DA_FAMILIA: GrupoDasRegras = grupoDasRegras(
  'FAMILIA',
  [
    itemDasRegras('RENDA'),
    itemDasRegras('NOME'),
    itemDasRegras('BONUS', {
      exibicao: [[{ fato: 'RENDA', operador: 'IGUAL', valor: 999 }]],
    }),
  ],
  { ocorrencias: { minimo: 0, maximo: 3, incluiCandidato: false } },
);

/** O caminho e o município só aparecem com o Fator pedido. */
const regraDoItem = (fatoCodigo: string): ItemDasRegras =>
  itemDasRegras(
    fatoCodigo,
    fatoCodigo === CAMINHO_DO_FATOR || fatoCodigo === MUNICIPIO_DO_FATOR
      ? { exibicao: [[{ fato: SOLICITA_O_FATOR, operador: 'IGUAL', valor: true }]] }
      : {},
  );

const formularioDaInscricao = (
  itens: CampoApresentado[],
  fatosDaPagina: string[],
): FormularioDoCandidato => ({
  finalidade: 'INSCRICAO',
  paginas: PAGINAS_DO_FATOR,
  termos: [],
  coleta: { itens, grupos: [] },
  regras: {
    paginas: [{ codigo: PAGINA_DO_FATOR_NAS_REGRAS, itens: fatosDaPagina.map(regraDoItem) }],
  },
  pressupostos: { fatos: [] },
});

export const formularioComOFator = (): FormularioDoCandidato =>
  formularioDaInscricao([...CAMPOS_DO_FATOR, CAMPO_FORA_DO_FATOR], FATOS_COM_O_FATOR);

export const formularioSemOFator = (): FormularioDoCandidato =>
  formularioDaInscricao([campoApresentado('EMAIL', 'E-mail', 'TEXTO')], ['EMAIL']);

const municipioPorBusca = (campo: CampoApresentado): CampoApresentado =>
  campo.fatoCodigo === MUNICIPIO_DO_FATOR
    ? {
        ...campo,
        valoresSelecionaveis: undefined,
        apresentacao: { ...campo.apresentacao, tipoDeCampo: 'MUNICIPIO' },
      }
    : campo;

/** Troca a seleção do município pela busca, que só traz o código quando o nome não foi carregado. */
export const comMunicipioPorBusca = (base: FormularioDoCandidato): FormularioDoCandidato => ({
  ...base,
  coleta: { ...base.coleta, itens: base.coleta.itens.map(municipioPorBusca) },
});

/** Acrescenta ao formulário um grupo de integrantes, na seção do Fator, com um subitem numérico. */
export const comOGrupo = (base: FormularioDoCandidato): FormularioDoCandidato => ({
  ...base,
  coleta: { ...base.coleta, grupos: [GRUPO_DA_FAMILIA] },
  regras: {
    paginas: [
      {
        codigo: PAGINA_DO_FATOR_NAS_REGRAS,
        itens: base.regras.paginas?.[0]?.itens ?? [],
        grupos: [REGRA_DO_GRUPO_DA_FAMILIA],
      },
    ],
  },
});

/** O que a pessoa já preencheu ao abrir a inscrição: as entradas do componente que o carregam. */
export interface PreenchimentoDaInscricao {
  respostas: Record<string, ValorJson>;
  grupos?: Record<string, { id: string; respostas: Record<string, ValorJson> }[]>;
  fixas?: Record<string, RespostaFixa>;
  /** O que o processo publica do Fator; sem informar, as dependências padrão do cenário. */
  dependenciasDoFator?: DependenciasDaAvaliacao | null;
}

const noProcessoDoFator = ({ dependenciasDoFator }: PreenchimentoDaInscricao) => ({
  dependenciasDoFator:
    dependenciasDoFator === undefined ? DEPENDENCIAS_PADRAO : dependenciasDoFator,
});

const partidaDaInscricao = (preenchimento: PreenchimentoDaInscricao) => ({
  respostas: preenchimento.respostas,
  grupos: preenchimento.grupos ?? {},
  paginasConcluidas: [],
  pressupostos: {},
  envio: {},
});

const entradasDaInscricao = (
  formulario: FormularioDoCandidato,
  preenchimento: PreenchimentoDaInscricao,
  municipiosGravados: MunicipiosGravados,
): Record<string, unknown> => ({
  formulario,
  noProcesso: noProcessoDoFator(preenchimento),
  respostasFixas: preenchimento.fixas ?? {},
  municipiosGravados,
  inicial: partidaDaInscricao(preenchimento),
});

export class CenarioDaRevisaoDoFator {
  gravados: MunicipiosGravados = {};
  achadosPelaBusca: readonly MunicipioEncontrado[] = [];
  fixture!: ComponentFixture<FormularioDoCandidatoComponent>;
  tela!: HTMLElement;

  static preparar(): CenarioDaRevisaoDoFator {
    const cenario = new CenarioDaRevisaoDoFator();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () => of({ ok: true, data: cenario.achadosPelaBusca }),
        },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
      ],
    });
    return cenario;
  }

  abrir(formulario: FormularioDoCandidato, preenchimento: PreenchimentoDaInscricao): void {
    this.fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    const entradas = entradasDaInscricao(formulario, preenchimento, this.gravados);
    for (const [nome, valor] of Object.entries(entradas)) {
      this.fixture.componentRef.setInput(nome, valor);
    }
    this.fixture.detectChanges();
    this.tela = this.fixture.nativeElement as HTMLElement;
  }

  abrirNaRevisao(formulario: FormularioDoCandidato, preenchimento: PreenchimentoDaInscricao): void {
    this.abrir(formulario, preenchimento);
    this.irParaARevisao();
  }

  irParaARevisao(): void {
    const revisao = [...this.tela.querySelectorAll('ui-steps .ui-steps__botao')].find((botao) =>
      botao.textContent?.includes('Revisão e aceite'),
    ) as HTMLButtonElement;
    revisao.click();
    this.fixture.detectChanges();
  }

  resumo(): HTMLElement | null {
    return this.tela.querySelector('ui-fator-de-atenuacao-da-inscricao');
  }

  encerrar(): void {
    vi.useRealTimers();
  }
}
