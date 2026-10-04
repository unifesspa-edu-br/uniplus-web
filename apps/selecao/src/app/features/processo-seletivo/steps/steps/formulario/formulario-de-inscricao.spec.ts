import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import {
  conteudoInicial,
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';

import type {
  CriterioDesempateConfigurado,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  FormularioDeInscricao,
} from '../../processo-seletivo.models';
import { comExigencia, exigenciaNova } from '../../shared/exigencias-documentais';
import {
  camposSemUsoDeclarado,
  camposSemValoresOfertados,
  comCamposQueAsExigenciasPressupoem,
  comoComandoDeReferenciaTemporal,
  fatosCitadosPelasExigencias,
  problemasDoFormulario,
  quemCitaNoProcesso,
  remocoesTravadasPor,
  SECAO_OUTROS_DADOS,
} from './formulario-de-inscricao';

const ID_TITULO = '01960000-0000-7000-0000-0000000000d1';
const ID_RESERVISTA = '01960000-0000-7000-0000-0000000000d2';

/** O catálogo como o servidor o publica — o que a tela pode coletar sai daqui. */
function fato(patch: Partial<FatoCandidatoView> & { codigo: string }): FatoCandidatoView {
  return {
    id: 'f',
    nome: patch.codigo,
    descricao: null,
    dominio: 'BOOLEANO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: `CAMPO_INSCRICAO:${patch.codigo}`,
    escopo: 'CANDIDATO',
    fonteValores: null,
    ativo: true,
    valoresDominioDeclarados: null,
    ...patch,
  } as unknown as FatoCandidatoView;
}

const SEXO = fato({ codigo: 'SEXO', nome: 'Sexo', dominio: 'CATEGORICO' });
const PCD = fato({ codigo: 'PCD', nome: 'Pessoa com deficiência' });
const RENDA = fato({ codigo: 'RENDA_FAMILIAR', nome: 'Renda familiar', dominio: 'NUMERICO' });
const MODALIDADE = fato({ codigo: 'MODALIDADE', origem: 'DERIVADO', binding: 'REGRA_DERIVACAO:MODALIDADE', dominio: 'CATEGORICO' });
const CATALOGO = [SEXO, PCD, RENDA, MODALIDADE];

const secao = (codigo: string, ordem: number, extra: Partial<EtapaDoFormulario> = {}): EtapaDoFormulario => ({
  codigo,
  ordem,
  tipo: 'SECAO',
  bloco: null,
  titulo: codigo,
  descricao: null,
  aviso: null,
  exibicao: null,
  ...extra,
});
const bloco = (codigo: string, ordem: number): EtapaDoFormulario => ({ ...secao(codigo, ordem), tipo: 'BLOCO', bloco: codigo });
const item = (fatoCodigo: string, ordem: number, etapaCodigo: string, extra: Partial<ItemDoFormulario> = {}): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: 'SEMPRE',
  precondicao: null,
  etapaCodigo,
  predicadoObrigatoriedade: null,
  ajuda: null,
  pedirConfirmacao: false,
  ...extra,
});

/** A inscrição como o servidor a devolve: os dados básicos, uma seção do certame, e os blocos. */
function inscricaoGravada(extra: Partial<ConteudoDoFormulario> = {}): ConteudoDoFormulario {
  return {
    titulo: null,
    etapas: [secao('DADOS_BASICOS', 0), secao('S1', 1), bloco('COMPROVACAO_DOCUMENTAL', 2), bloco('REVISAO_E_ACEITE', 3)],
    itens: [item('NOME', 0, 'DADOS_BASICOS'), item('SEXO', 1, 'DADOS_BASICOS'), item('PCD', 2, 'S1')],
    termos: [],
    pressupostos: [],
    grupos: [],
    ...extra,
  };
}

function formularioCom(conteudo: ConteudoDoFormulario, extra: Partial<FormularioDeInscricao> = {}): FormularioDeInscricao {
  return {
    faseCodigo: 'INSCRICAO',
    conteudo,
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
    fatosDasOutrasFinalidades: [],
    ...extra,
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

const NENHUMA_EXIGENCIA: ExigenciasDoRascunho = { raizes: [], emTodasAsFases: [] };
const MAIOR_IDADE = { regraCodigo: 'DESEMPATE-MAIOR-IDADE' } as CriterioDesempateConfigurado;

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
});

describe('quem cita cada fato no processo', () => {
  const nomes = { documento: (id: string) => (id === ID_TITULO ? 'Título de eleitor' : id), fato: (codigo: string) => codigo.toLowerCase() };

  it('junta exigências, regras de derivação e desempate, e trava a remoção dizendo quem depende', () => {
    const citantes = quemCitaNoProcesso(
      {
        documentos: rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'PCD', operador: 'IGUAL', valor: 'true' }])),
        derivacao: [{ codigoFato: 'MODALIDADE', regras: [{ contribui: 'LB_PCD', quando: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]] }] }],
        desempate: [MAIOR_IDADE],
      },
      nomes,
    );

    expect(citantes.get('PCD')).toEqual(['o documento “Título de eleitor”', 'as regras que calculam “modalidade”']);
    expect(citantes.get('DATA_NASCIMENTO')).toEqual(['o desempate por maior idade']);
    expect(remocoesTravadasPor(citantes).get('PCD')).toContain('dependem deste dado');
  });
});

describe('os campos que o processo pressupõe na inscrição', () => {
  const citados = (...fatos: string[]): ReadonlySet<string> => new Set(fatos);

  it('põe o campo citado na seção "Outros dados", criada antes do primeiro bloco do sistema e sem exibição', () => {
    const resultado = comCamposQueAsExigenciasPressupoem(inscricaoGravada(), citados('RENDA_FAMILIAR'), CATALOGO, new Set(), []);

    const etapas = [...(resultado.etapas ?? [])].sort((a, b) => Number(a.ordem) - Number(b.ordem));
    expect(etapas.map((e) => e.codigo)).toEqual(['DADOS_BASICOS', 'S1', SECAO_OUTROS_DADOS, 'COMPROVACAO_DOCUMENTAL', 'REVISAO_E_ACEITE']);
    expect(etapas[2].exibicao).toBeNull();
    expect(resultado.itens?.find((i) => i.fatoCodigo === 'RENDA_FAMILIAR')).toMatchObject({
      etapaCodigo: SECAO_OUTROS_DADOS,
      tipoRenderizacao: 'NUMERO',
      obrigatoriedade: 'SEMPRE',
    });
  });

  /** O campo oculto para parte dos candidatos nunca dispararia o gatilho para eles. */
  it('reaproveita a seção "Outros dados" que já existe, tirando a exibição condicional dela', () => {
    const condicional = [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]];
    const base = inscricaoGravada();
    const comSecao = { ...base, etapas: [...(base.etapas ?? []), secao(SECAO_OUTROS_DADOS, 1.5, { exibicao: condicional })] };

    const resultado = comCamposQueAsExigenciasPressupoem(comSecao, citados('RENDA_FAMILIAR'), CATALOGO, new Set(), []);

    expect(resultado.etapas?.filter((e) => e.codigo === SECAO_OUTROS_DADOS)).toHaveLength(1);
    expect(resultado.etapas?.find((e) => e.codigo === SECAO_OUTROS_DADOS)?.exibicao).toBeNull();
  });

  /** Fora da seção reservada, o fato básico seria recusado como alteração dos dados básicos. */
  it('não põe fato do conjunto básico, nem antes de o formulário existir no servidor', () => {
    expect(comCamposQueAsExigenciasPressupoem(conteudoInicial(), citados('SEXO'), CATALOGO, new Set(), []).itens).toEqual([]);
  });

  /** Um fato tem um único formulário que o coleta: repeti-lo na inscrição é recusado. */
  it('não põe fato que outra finalidade já coleta', () => {
    const inscricao = inscricaoGravada();
    expect(comCamposQueAsExigenciasPressupoem(inscricao, citados('RENDA_FAMILIAR'), CATALOGO, new Set(), ['RENDA_FAMILIAR'])).toBe(inscricao);
  });

  it('não põe fato que um grupo do formulário já coleta', () => {
    const inscricao = inscricaoGravada({
      grupos: [
        {
          codigo: 'FAMILIA', ordem: 3, rotulo: 'Família', etapaCodigo: 'S1', minimo: 1, maximo: null, exibicao: null,
          obrigatoriedade: 'SEMPRE', predicadoObrigatoriedade: null, subitens: [item('RENDA_FAMILIAR', 0, 'S1')], incluiCandidato: false,
        },
      ],
    });
    expect(comCamposQueAsExigenciasPressupoem(inscricao, citados('RENDA_FAMILIAR'), CATALOGO, new Set(), [])).toBe(inscricao);
  });

  it('não põe campo para fato derivado', () => {
    const inscricao = inscricaoGravada();
    expect(comCamposQueAsExigenciasPressupoem(inscricao, citados('MODALIDADE'), CATALOGO, new Set(), [])).toBe(inscricao);
  });

  it('tira o campo que entrou sozinho e nada cita mais, e a seção que ele esvaziou', () => {
    const comCampo = comCamposQueAsExigenciasPressupoem(inscricaoGravada(), citados('RENDA_FAMILIAR'), CATALOGO, new Set(), []);

    const semGatilho = comCamposQueAsExigenciasPressupoem(comCampo, citados(), CATALOGO, new Set(['RENDA_FAMILIAR']), []);

    expect(semGatilho.itens?.map((i) => i.fatoCodigo)).not.toContain('RENDA_FAMILIAR');
    expect(semGatilho.etapas?.map((e) => e.codigo)).not.toContain(SECAO_OUTROS_DADOS);
  });

  /** Removê-lo apagaria no servidor uma configuração que ninguém pediu para tirar. */
  it('preserva o campo que não entrou por este mecanismo', () => {
    const inscricao = inscricaoGravada();
    expect(comCamposQueAsExigenciasPressupoem(inscricao, citados(), CATALOGO, new Set(), [])).toBe(inscricao);
  });

  it('não tira o campo que outra regra do formulário cita', () => {
    const base = inscricaoGravada();
    const citadoPorCampo = {
      ...base,
      itens: [...(base.itens ?? []), item('RENDA_FAMILIAR', 3, 'S1', { precondicao: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]] })],
    };

    expect(comCamposQueAsExigenciasPressupoem(citadoPorCampo, citados(), CATALOGO, new Set(['PCD']), [])).toBe(citadoPorCampo);
  });
});

describe('a política que ancora a apuração da idade', () => {
  const FASES = new Map([['INSCRICAO', 'id-inscricao']]);

  it('resolve a fase de código para identificador', () => {
    expect(comoComandoDeReferenciaTemporal({ tipo: 'INICIO_FASE', data: '', faseCodigo: 'INSCRICAO' }, FASES)).toEqual({
      tipo: 'INICIO_FASE',
      data: null,
      faseId: 'id-inscricao',
    });
  });

  it('tudo nulo remove a política', () => {
    expect(comoComandoDeReferenciaTemporal({ tipo: '', data: '', faseCodigo: '' }, FASES)).toEqual({ tipo: null, data: null, faseId: null });
  });
});

describe('o que impede gravar o formulário', () => {
  const FASES_VIVAS = new Set(['INSCRICAO', 'HABILITACAO']);

  it('cobra a política quando alguma exigência condiciona por idade', () => {
    const problemas = problemasDoFormulario(
      formularioCom(inscricaoGravada()),
      rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'FAIXA_ETARIA', operador: 'MAIOR_IGUAL', valor: '18' }])),
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('idade'));
  });

  it('acusa a apuração ancorada em fase que saiu do cronograma', () => {
    const problemas = problemasDoFormulario(
      formularioCom(inscricaoGravada(), { referenciaTemporal: { tipo: 'INICIO_FASE', data: '', faseCodigo: 'RECURSOS' } }),
      NENHUMA_EXIGENCIA,
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('não está no cronograma'));
  });

  it('cobra o rótulo que o candidato vai ler, também nos campos de grupo', () => {
    const problemas = problemasDoFormulario(
      formularioCom(inscricaoGravada({ itens: [item('PCD', 0, 'S1', { rotulo: '  ' })] })),
      NENHUMA_EXIGENCIA,
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('rótulo'));
  });
});

describe('campos que nada no certame usa', () => {
  it('aponta o campo do certame que nada usa, e não os dados básicos', () => {
    const semUso = camposSemUsoDeclarado(formularioCom(inscricaoGravada()), NENHUMA_EXIGENCIA);

    expect(semUso.map((c) => c.fatoCodigo)).toEqual(['PCD']);
  });

  it('não aponta o campo que uma exigência, a derivação ou outra regra do formulário cita', () => {
    const quando = [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]];

    expect(camposSemUsoDeclarado(formularioCom(inscricaoGravada()), rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'PCD', operador: 'IGUAL', valor: 'true' }])))).toEqual([]);
    expect(camposSemUsoDeclarado(formularioCom(inscricaoGravada(), { derivacao: [{ codigoFato: 'MODALIDADE', regras: [{ quando }] }] }), NENHUMA_EXIGENCIA)).toEqual([]);
    const citadoPorSecao = inscricaoGravada();
    expect(
      camposSemUsoDeclarado(
        formularioCom({ ...citadoPorSecao, etapas: [...(citadoPorSecao.etapas ?? []), secao('S2', 1.5, { exibicao: quando })] }),
        NENHUMA_EXIGENCIA,
      ),
    ).toEqual([]);
  });
});

describe('campos cujo domínio sai da oferta de atendimento', () => {
  const semOferta = { condicoes: [], recursos: [], tiposDeficiencia: [] };
  const comCampos = (...campos: readonly [string, string][]) =>
    formularioCom(inscricaoGravada({ itens: campos.map(([codigo, tipo], i) => item(codigo, i, 'S1', { tipoRenderizacao: tipo })) }));

  it('acusa os campos de seleção sem valor nenhum ofertado, na ordem em que a tela os nomeia', () => {
    const formulario = comCampos(['TIPO_DEFICIENCIA', 'SELECAO_MULTIPLA'], ['CONDICAO_ATENDIMENTO', 'SELECAO_UNICA']);

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual(['a condição de atendimento', 'o tipo de deficiência']);
  });

  it('cala quando a oferta declara ao menos um valor, ou quando o campo não é de seleção', () => {
    const comOferta = { ...semOferta, condicoes: [{ id: 'c1', codigo: 'PCD', nome: 'PcD' }] };

    expect(camposSemValoresOfertados(comCampos(['CONDICAO_ATENDIMENTO', 'SELECAO_UNICA']), comOferta)).toEqual([]);
    expect(camposSemValoresOfertados(comCampos(['CONDICAO_ATENDIMENTO', 'TEXTO']), semOferta)).toEqual([]);
  });
});
