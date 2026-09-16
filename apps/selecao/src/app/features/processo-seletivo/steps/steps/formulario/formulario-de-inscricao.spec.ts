import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  FormularioDeInscricao,
} from '../../processo-seletivo.models';
import { comExigencia, exigenciaNova } from '../../shared/exigencias-documentais';
import {
  camposSemValoresOfertados,
  comCamposQueAsExigenciasPressupoem,
  comoComandoDeFatosColetados,
  comoComandoDeReferenciaTemporal,
  ehColetavel,
  camposSemUsoDeclarado,
  fatosCitadosPelaDerivacao,
  fatosCitadosPelasExigencias,
  problemasDoFormulario,
  renderizacaoDe,
} from './formulario-de-inscricao';

const ID_TITULO = '01960000-0000-7000-0000-0000000000d1';
const ID_RESERVISTA = '01960000-0000-7000-0000-0000000000d2';

/** O catálogo como o servidor o publica — o que a tela pode coletar sai daqui. */
function fato(patch: Partial<FatoCandidatoView>): FatoCandidatoView {
  return {
    id: 'f',
    codigo: 'SEXO',
    nome: 'Sexo',
    descricao: null,
    dominio: 'CATEGORICO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: ['FEMININO', 'MASCULINO', 'INTERSEXO'],
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:SEXO',
    valoresDominioDeclarados: null,
    ...patch,
  } as FatoCandidatoView;
}

const SEXO = fato({});
const NACIONALIDADE = fato({
  codigo: 'NACIONALIDADE',
  nome: 'Nacionalidade',
  binding: 'CAMPO_INSCRICAO:NACIONALIDADE',
  valoresDominio: ['NATO', 'NATURALIZADO', 'ESTRANGEIRO'],
});
const EGRESSO = fato({
  codigo: 'EGRESSO_ESCOLA_PUBLICA',
  nome: 'Egresso de escola pública',
  dominio: 'BOOLEANO',
  valoresDominio: null,
  binding: 'CAMPO_INSCRICAO:EGRESSO_ESCOLA_PUBLICA',
});
const CONCORRER_PPI = fato({
  codigo: 'CONCORRER_PPI',
  nome: 'Deseja concorrer às vagas reservadas a pretos, pardos e indígenas',
  dominio: 'BOOLEANO',
  valoresDominio: null,
  binding: 'CAMPO_INSCRICAO:CONCORRER_PPI',
});
const IDADE = fato({
  codigo: 'FAIXA_ETARIA',
  nome: 'Faixa etária',
  dominio: 'NUMERICO',
  origem: 'DERIVADO',
  binding: 'ATRIBUTO_CANDIDATO:FAIXA_ETARIA',
  valoresDominio: null,
});
const MODALIDADE = fato({
  codigo: 'MODALIDADE',
  nome: 'Modalidade',
  origem: 'DERIVADO',
  cardinalidade: 'MULTIVALORADO',
  binding: 'REGRA_DERIVACAO:MODALIDADE',
  valoresDominio: null,
});
const PCD = fato({
  codigo: 'PCD',
  nome: 'Pessoa com deficiência',
  dominio: 'BOOLEANO',
  binding: 'CAMPO_INSCRICAO:PCD',
  valoresDominio: null,
});

const CATALOGO = [SEXO, NACIONALIDADE, IDADE, MODALIDADE, PCD];

function formularioVazio(): FormularioDeInscricao {
  return {
    titulo: '',
    termoAceiteTexto: '',
    fatos: [],
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
  };
}

/** Uma exigência com o gatilho dado, na fase da habilitação. */
function exigenciaCom(
  tipoDocumentoId: string,
  condicoes: readonly { fato: string; operador: string; valor: string }[],
): ExigenciaDeDocumento {
  return {
    ...exigenciaNova(tipoDocumentoId, 'HABILITACAO'),
    aplicabilidade: 'CONDICIONAL',
    condicoes: condicoes.map((c, i) => ({ clausula: 0, ...c, ordem: i })),
  } as ExigenciaDeDocumento;
}

function rascunhoCom(...exigencias: readonly ExigenciaDeDocumento[]): ExigenciasDoRascunho {
  return exigencias.reduce<ExigenciasDoRascunho>(
    (acumulado, atual) => comExigencia(acumulado, atual),
    { raizes: [], emTodasAsFases: [] },
  );
}

describe('o que pode virar campo do formulário', () => {
  it('só fato declarado pelo candidato, com binding de campo de inscrição', () => {
    expect(ehColetavel(SEXO)).toBe(true);
    expect(ehColetavel(NACIONALIDADE)).toBe(true);
    expect(ehColetavel(PCD)).toBe(true);
  });

  /**
   * Derivado não é pergunta: a idade é apurada contra um instante e a modalidade é calculada
   * das respostas. Coletá-los poria no formulário um campo que o candidato não responde.
   */
  it('não oferece fato derivado, nem por atributo nem por regra', () => {
    expect(ehColetavel(IDADE)).toBe(false);
    expect(ehColetavel(MODALIDADE)).toBe(false);
  });

  it('deriva a apresentação do domínio e da cardinalidade, não da escolha da tela', () => {
    expect(renderizacaoDe(SEXO)).toBe('SELECAO_UNICA');
    expect(renderizacaoDe(PCD)).toBe('BOOLEANO');
    expect(renderizacaoDe(IDADE)).toBe('NUMERO');
    expect(renderizacaoDe(MODALIDADE)).toBe('SELECAO_MULTIPLA');
  });
});

describe('os fatos que as exigências citam', () => {
  it('reúne os fatos de todas as condições, de todas as exigências', () => {
    const citados = fatosCitadosPelasExigencias(
      rascunhoCom(
        exigenciaCom(ID_TITULO, [
          { fato: 'NACIONALIDADE', operador: 'DIFERENTE', valor: '"ESTRANGEIRO"' },
          { fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
        ]),
        exigenciaCom(ID_RESERVISTA, [{ fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }]),
      ),
    );

    expect([...citados].sort()).toEqual(['NACIONALIDADE', 'SEXO']);
  });

  /** A exigência pode estar dentro de um grupo, e o fato dela conta igual. */
  it('alcança a exigência que está dentro de um grupo', () => {
    const comGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      raizes: [
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          filhos: [
            {
              tipo: 'FOLHA',
              documento: exigenciaCom(ID_TITULO, [
                { fato: 'PCD', operador: 'IGUAL', valor: 'true' },
              ]),
              quantidadeMinima: null,
              consequencia: null,
              basesLegais: null,
              filhos: null,
              chaveDistincao: null,
              dataReferencia: null,
              ocorrenciasEsperadas: null,
              repetePorEntidade: null,
            },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };

    expect([...fatosCitadosPelasExigencias(comGrupo)]).toEqual(['PCD']);
  });
});

describe('a combinação automática entre exigência e formulário', () => {
  /**
   * O caso que motiva a frente: o título de eleitor não se cobra de estrangeiro nem de mulher,
   * e para isso o certame precisa perguntar nacionalidade e sexo. O administrador não deveria
   * ter de lembrar disso.
   */
  it('põe no formulário o campo que a exigência pressupõe', () => {
    const resultado = comCamposQueAsExigenciasPressupoem(
      formularioVazio(),
      rascunhoCom(
        exigenciaCom(ID_TITULO, [
          { fato: 'NACIONALIDADE', operador: 'DIFERENTE', valor: '"ESTRANGEIRO"' },
          { fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
        ]),
      ),
      CATALOGO,
      new Set(),
    );

    expect(resultado.fatos.map((c) => c.fatoCodigo).sort()).toEqual(['NACIONALIDADE', 'SEXO']);
    expect(resultado.fatos.every((c) => c.obrigatorio)).toBe(true);
    expect(resultado.fatos.map((c) => c.ordem)).toEqual([0, 1]);
  });

  /** Fato derivado não vira campo, mesmo citado — ele resolve por outro caminho. */
  it('não põe campo para fato derivado citado no gatilho', () => {
    const resultado = comCamposQueAsExigenciasPressupoem(
      formularioVazio(),
      rascunhoCom(
        exigenciaCom(ID_TITULO, [{ fato: 'FAIXA_ETARIA', operador: 'MAIOR_IGUAL', valor: '18' }]),
      ),
      CATALOGO,
      new Set(),
    );

    expect(resultado.fatos).toEqual([]);
  });

  /**
   * A outra direção importa tanto quanto: sexo e cor/raça são dado sensível, e manter o campo
   * depois que nenhuma exigência o cita é coletar sem finalidade. Mas só sai o que ENTROU por
   * exigência — o conjunto que a chamada informa.
   */
  it('tira o campo que entrou por exigência e que nenhuma cita mais', () => {
    const comSexo = comCamposQueAsExigenciasPressupoem(
      formularioVazio(),
      rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }])),
      CATALOGO,
      new Set(),
    );
    expect(comSexo.fatos).toHaveLength(1);

    const semExigencia = comCamposQueAsExigenciasPressupoem(
      comSexo,
      { raizes: [], emTodasAsFases: [] },
      CATALOGO,
      new Set(['SEXO']),
    );
    expect(semExigencia.fatos).toEqual([]);
  });

  /**
   * O caso que reabrir um processo produz: o formulário vem cheio da configuração gravada, e
   * NENHUM gatilho foi lido ainda. Remover aqui apagaria no servidor, na gravação seguinte,
   * uma configuração que ninguém pediu para tirar.
   */
  it('não remove o campo que veio da configuração gravada', () => {
    const jaConfigurado: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'SEXO', ordem: 0, rotulo: 'Sexo', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
        { fatoCodigo: 'NACIONALIDADE', ordem: 1, rotulo: 'Nacionalidade', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
      ],
    };

    const resultado = comCamposQueAsExigenciasPressupoem(
      jaConfigurado,
      { raizes: [], emTodasAsFases: [] },
      CATALOGO,
      new Set(),
    );

    expect(resultado).toBe(jaConfigurado);
  });

  /** Campo declarado de propósito permanece: ele não entrou por exigência nenhuma. */
  it('preserva o campo que o operador acrescentou à mão', () => {
    const comSexo = comCamposQueAsExigenciasPressupoem(
      formularioVazio(),
      rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }])),
      CATALOGO,
      new Set(),
    );

    const semExigencia = comCamposQueAsExigenciasPressupoem(
      comSexo,
      { raizes: [], emTodasAsFases: [] },
      CATALOGO,
      new Set(),
    );

    expect(semExigencia.fatos.map((c) => c.fatoCodigo)).toEqual(['SEXO']);
  });

  /**
   * Devolve o MESMO objeto quando nada muda: quem grava decide por identidade, e um array novo
   * a cada chamada dispararia um PUT de formulário a cada gravação de cronograma.
   */
  it('não inventa mudança quando o formulário já tem exatamente o que as exigências pedem', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'SEXO', ordem: 0, rotulo: 'Sexo', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
      ],
    };

    const resultado = comCamposQueAsExigenciasPressupoem(
      formulario,
      rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }])),
      CATALOGO,
      new Set(['SEXO']),
    );

    expect(resultado).toBe(formulario);
  });
});

describe('o formulário no que o comando recebe', () => {
  it('renumera a ordem a partir de zero, sem buracos', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'SEXO', ordem: 7, rotulo: 'Sexo', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
        { fatoCodigo: 'PCD', ordem: 3, rotulo: 'PcD', tipoRenderizacao: 'BOOLEANO', obrigatorio: false, precondicao: null },
      ],
    };

    expect(comoComandoDeFatosColetados(formulario).map((c) => c.ordem)).toEqual([0, 1]);
  });

  /** A pré-condição não é editável na tela e viaja como veio. */
  it('carrega a pré-condição intocada', () => {
    const precondicao = [[{ fato: 'COR_RACA', operador: 'IGUAL', valor: 'PRETA' }]];
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'PCD', ordem: 0, rotulo: 'PcD', tipoRenderizacao: 'BOOLEANO', obrigatorio: false, precondicao },
      ],
    };

    expect(comoComandoDeFatosColetados(formulario)[0].precondicao).toEqual(precondicao);
  });
});

describe('a política que ancora a apuração da idade', () => {
  const FASES = new Map([['INSCRICAO', 'id-inscricao']]);

  it('resolve a fase de código para identificador', () => {
    expect(
      comoComandoDeReferenciaTemporal(
        { tipo: 'INICIO_FASE', data: '', faseCodigo: 'INSCRICAO' },
        FASES,
      ),
    ).toEqual({ tipo: 'INICIO_FASE', data: null, faseId: 'id-inscricao' });
  });

  it('manda a data quando a apuração é por data específica', () => {
    expect(
      comoComandoDeReferenciaTemporal(
        { tipo: 'DATA_ESPECIFICA', data: '2027-01-31', faseCodigo: '' },
        FASES,
      ),
    ).toEqual({ tipo: 'DATA_ESPECIFICA', data: '2027-01-31', faseId: null });
  });

  it('tudo nulo remove a política', () => {
    expect(comoComandoDeReferenciaTemporal({ tipo: '', data: '', faseCodigo: '' }, FASES)).toEqual({
      tipo: null,
      data: null,
      faseId: null,
    });
  });
});

describe('o que impede gravar o formulário', () => {
  const FASES_VIVAS = new Set(['INSCRICAO', 'HABILITACAO']);

  /**
   * A idade não é respondida: é apurada contra um instante. Sem a política declarada, a
   * publicação é recusada — e descobrir isso no último passo obriga a refazer o caminho.
   */
  it('cobra a política quando alguma exigência condiciona por idade', () => {
    const problemas = problemasDoFormulario(
      formularioVazio(),
      rascunhoCom(
        exigenciaCom(ID_TITULO, [{ fato: 'FAIXA_ETARIA', operador: 'MAIOR_IGUAL', valor: '18' }]),
      ),
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('idade'));
  });

  it('não cobra a política quando nenhuma exigência fala de idade', () => {
    expect(
      problemasDoFormulario(formularioVazio(), { raizes: [], emTodasAsFases: [] }, FASES_VIVAS),
    ).toEqual([]);
  });

  it('cobra a data quando a apuração é por data específica', () => {
    const problemas = problemasDoFormulario(
      { ...formularioVazio(), referenciaTemporal: { tipo: 'DATA_ESPECIFICA', data: '', faseCodigo: '' } },
      { raizes: [], emTodasAsFases: [] },
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('data'));
  });

  it('acusa a apuração ancorada em fase que saiu do cronograma', () => {
    const problemas = problemasDoFormulario(
      { ...formularioVazio(), referenciaTemporal: { tipo: 'INICIO_FASE', data: '', faseCodigo: 'RECURSOS' } },
      { raizes: [], emTodasAsFases: [] },
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('não está no cronograma'));
  });

  it('cobra o rótulo que o candidato vai ler', () => {
    const problemas = problemasDoFormulario(
      {
        ...formularioVazio(),
        fatos: [
          { fatoCodigo: 'SEXO', ordem: 0, rotulo: '  ', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
        ],
      },
      { raizes: [], emTodasAsFases: [] },
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('rótulo'));
  });
});

describe('campos que nada no certame usa', () => {
  /** Campo de dado sensível que nenhuma exigência cita mais é coleta sem finalidade. */
  it('aponta o campo que nenhuma exigência, derivação ou pré-condição cita', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'SEXO', ordem: 0, rotulo: 'Sexo', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
      ],
    };

    expect(camposSemUsoDeclarado(formulario, { raizes: [], emTodasAsFases: [] }).map((c) => c.fatoCodigo))
      .toEqual(['SEXO']);
  });

  it('não aponta o campo que uma exigência cita', () => {
    const exigencias = comExigencia(
      { raizes: [], emTodasAsFases: [] },
      exigenciaCom(ID_TITULO, [{ fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' }]),
    );
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'SEXO', ordem: 0, rotulo: 'Sexo', tipoRenderizacao: 'SELECAO_UNICA', obrigatorio: true, precondicao: null },
      ],
    };

    expect(camposSemUsoDeclarado(formulario, exigencias)).toEqual([]);
  });

  /**
   * Os opt-ins de cota não são citados por exigência nenhuma: quem depende deles é a regra que
   * deriva a modalidade. Apontá-los como sem uso mandaria o operador apagar justamente o que
   * faz a cota existir.
   */
  it('não aponta o campo de que uma regra de derivação depende', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'CONCORRER_PPI', ordem: 0, rotulo: 'Concorrer PPI', tipoRenderizacao: 'BOOLEANO', obrigatorio: false, precondicao: null },
      ],
      derivacao: [
        {
          codigoFato: 'MODALIDADE',
          regras: [
            { ordem: 0, contribui: 'AC', quando: null },
            { ordem: 1, contribui: 'LB_PPI', quando: [[{ fato: 'CONCORRER_PPI', operador: 'IGUAL', valor: true }]] },
          ],
        },
      ],
    };

    expect(camposSemUsoDeclarado(formulario, { raizes: [], emTodasAsFases: [] })).toEqual([]);
  });

  /** Campo que só existe para decidir se outro aparece continua tendo finalidade. */
  it('não aponta o campo de que a pré-condição de outro campo depende', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        { fatoCodigo: 'PCD', ordem: 0, rotulo: 'PcD', tipoRenderizacao: 'BOOLEANO', obrigatorio: false, precondicao: null },
        {
          fatoCodigo: 'TIPO_DEFICIENCIA',
          ordem: 1,
          rotulo: 'Tipo de deficiência',
          tipoRenderizacao: 'SELECAO_UNICA',
          obrigatorio: false,
          precondicao: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]],
        },
      ],
    };

    expect(camposSemUsoDeclarado(formulario, { raizes: [], emTodasAsFases: [] }).map((c) => c.fatoCodigo))
      .toEqual(['TIPO_DEFICIENCIA']);
  });
});

describe('campos que as regras de derivação pressupõem', () => {
  /**
   * A matriz que deriva a modalidade pergunta ao candidato se ele quer concorrer a cada cota e
   * se veio de escola pública. Sem esses campos coletados, o servidor recusa a própria matriz —
   * e a recusa fala de um fato que quem monta o edital nunca mencionou. Por isso eles entram
   * junto, pelo mesmo caminho dos fatos que os gatilhos citam.
   */
  it('acrescenta o campo que a matriz de derivação cita, mesmo sem gatilho nenhum', () => {
    const dependencias = fatosCitadosPelaDerivacao([
      { ordem: 0, contribui: 'AC', quando: null },
      {
        ordem: 1,
        contribui: 'LB_PPI',
        quando: [
          [
            { fato: 'EGRESSO_ESCOLA_PUBLICA', operador: 'IGUAL', valor: true },
            { fato: 'CONCORRER_PPI', operador: 'IGUAL', valor: true },
          ],
        ],
      },
    ]);

    expect(dependencias).toEqual(['EGRESSO_ESCOLA_PUBLICA', 'CONCORRER_PPI']);

    const reconciliado = comCamposQueAsExigenciasPressupoem(
      formularioVazio(),
      { raizes: [], emTodasAsFases: [] },
      [EGRESSO, CONCORRER_PPI],
      new Set(),
      dependencias,
    );

    expect(reconciliado.fatos.map((campo) => campo.fatoCodigo)).toEqual([
      'EGRESSO_ESCOLA_PUBLICA',
      'CONCORRER_PPI',
    ]);
  });

  /**
   * O campo que entrou por um gatilho e passou a sustentar também a matriz de derivação não
   * pode sair quando o gatilho é apagado: a matriz gravada ficaria citando o que o processo
   * não coleta mais, e a recusa só apareceria no gate de publicação, falando de regra de
   * derivação — longe do gatilho que o operador acabou de remover.
   */
  it('campo posto por gatilho não sai quando a matriz de derivação passou a depender dele', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        {
          fatoCodigo: 'EGRESSO_ESCOLA_PUBLICA',
          ordem: 0,
          rotulo: 'Egresso de escola pública',
          tipoRenderizacao: 'BOOLEANO',
          obrigatorio: true,
          precondicao: null,
        },
      ],
      derivacao: [
        {
          codigoFato: 'MODALIDADE',
          regras: [
            {
              ordem: 0,
              contribui: 'LB_EP',
              quando: [[{ fato: 'EGRESSO_ESCOLA_PUBLICA', operador: 'IGUAL', valor: true }]],
            },
          ],
        },
      ],
    };

    // O gatilho que trouxe o campo já não existe, e ele está na memória do que foi posto
    // automaticamente — sem as dependências da matriz, seria removido aqui.
    const reconciliado = comCamposQueAsExigenciasPressupoem(
      formulario,
      { raizes: [], emTodasAsFases: [] },
      [EGRESSO],
      new Set(['EGRESSO_ESCOLA_PUBLICA']),
      formulario.derivacao.flatMap((config) => fatosCitadosPelaDerivacao(config.regras)),
    );

    expect(reconciliado.fatos.map((campo) => campo.fatoCodigo)).toEqual([
      'EGRESSO_ESCOLA_PUBLICA',
    ]);
  });

  /** Sem a matriz a sustentar, o campo posto pelo gatilho sai quando o gatilho sai. */
  it('campo posto por gatilho sai quando nada mais o cita', () => {
    const formulario: FormularioDeInscricao = {
      ...formularioVazio(),
      fatos: [
        {
          fatoCodigo: 'EGRESSO_ESCOLA_PUBLICA',
          ordem: 0,
          rotulo: 'Egresso de escola pública',
          tipoRenderizacao: 'BOOLEANO',
          obrigatorio: true,
          precondicao: null,
        },
      ],
    };

    const reconciliado = comCamposQueAsExigenciasPressupoem(
      formulario,
      { raizes: [], emTodasAsFases: [] },
      [EGRESSO],
      new Set(['EGRESSO_ESCOLA_PUBLICA']),
    );

    expect(reconciliado.fatos).toEqual([]);
  });

  /** A regra âncora não tem condição, e não pressupõe campo nenhum. */
  it('regra incondicional não pressupõe campo', () => {
    expect(fatosCitadosPelaDerivacao([{ ordem: 0, contribui: 'AC', quando: null }])).toEqual([]);
  });
});

describe('campos cujo domínio sai da oferta de atendimento', () => {
  const semOferta = { condicoes: [], recursos: [], tiposDeficiencia: [] };

  const formularioCom = (fatos: readonly { fatoCodigo: string; tipoRenderizacao: string }[]) =>
    ({
      titulo: '',
      termoAceiteTexto: '',
      fatos: fatos.map((f, i) => ({ ...f, ordem: i + 1, rotulo: f.fatoCodigo, obrigatorio: false, precondicao: null })),
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      derivacao: [],
    }) as unknown as FormularioDeInscricao;

  /**
   * O acoplamento existe nos dois sentidos, e a ordem dos passos decide onde o aviso é útil: o
   * operador acrescenta o campo aqui, depois de já ter passado pela oferta.
   */
  it('acusa o campo de seleção sem valor nenhum ofertado', () => {
    const formulario = formularioCom([
      { fatoCodigo: 'CONDICAO_ATENDIMENTO', tipoRenderizacao: 'SELECAO_UNICA' },
    ]);

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual(['a condição de atendimento']);
  });

  it('acusa os dois de uma vez, na ordem em que a tela os nomeia', () => {
    const formulario = formularioCom([
      { fatoCodigo: 'TIPO_DEFICIENCIA', tipoRenderizacao: 'SELECAO_MULTIPLA' },
      { fatoCodigo: 'CONDICAO_ATENDIMENTO', tipoRenderizacao: 'SELECAO_UNICA' },
    ]);

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual([
      'a condição de atendimento',
      'o tipo de deficiência',
    ]);
  });

  it('cala quando a oferta declara ao menos um valor', () => {
    const formulario = formularioCom([
      { fatoCodigo: 'CONDICAO_ATENDIMENTO', tipoRenderizacao: 'SELECAO_UNICA' },
    ]);
    const comOferta = {
      ...semOferta,
      condicoes: [{ id: 'c1', codigo: 'PCD' }],
    } as unknown as typeof semOferta;

    expect(camposSemValoresOfertados(formulario, comOferta)).toEqual([]);
  });

  /** O fato que não é campo de seleção não escolhe de lista nenhuma — não depende da oferta. */
  it('ignora o fato perguntado fora de um campo de seleção', () => {
    const formulario = formularioCom([
      { fatoCodigo: 'CONDICAO_ATENDIMENTO', tipoRenderizacao: 'TEXTO_LIVRE' },
    ]);

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual([]);
  });
});
