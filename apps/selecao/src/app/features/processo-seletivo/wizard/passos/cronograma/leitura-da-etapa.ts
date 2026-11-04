import type { FormGroup } from '@angular/forms';

import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type ProdutoDaFase,
  type RecursoDaEtapa,
} from '../../processo-seletivo.models';
import { rotuloDaFormaDeAvaliacao } from '../../shared/forma-de-avaliacao';
import { decimalLido, textoDaSoma } from '../../shared/itens-de-avaliacao';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import type { CatalogoDeAtos } from './catalogos/catalogo-de-atos.service';
import type { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import type { CatalogoDeTiposDeEtapa } from './catalogos/catalogo-de-tipos-de-etapa.service';
import type { EtapaForm } from './cronograma-form';
import {
  etapaDeclaraNotaMaxima,
  etapaDeNotaDoEnem,
  etapaEhDeAvaliacaoHumana,
  etapaUsaEscalaDeAtendimento,
} from './declaracoes-da-etapa';
import { caracteresAdmitidos, eliminaPorCarater, pontuaPorCarater } from './regras-da-etapa';

/** O que a consulta da etapa lê dos catálogos, para nomear ato, tipo e banca. */
export type CatalogosDaLeitura = Pick<CatalogoDeAtos, 'rotuloDoAto'> &
  Pick<CatalogoDeTiposDeEtapa, 'rotuloDoTipoEtapa' | 'tipoEtapaPorId'> &
  Pick<CatalogoDeBancas, 'bancas'>;

/**
 * Como a tela nomeia o papel de uma publicação. O token que o contrato venha a
 * acrescentar aparece como veio: inventar rótulo para o desconhecido esconderia
 * do operador que a fase declara algo que esta tela ainda não sabe descrever.
 */
export function rotuloDoPapel(papel: string | null): string {
  if (papel === PAPEL_PRELIMINAR) return 'resultado preliminar';
  if (papel === PAPEL_DEFINITIVO) return 'resultado definitivo';
  return papel ?? 'não é resultado';
}

/** O nome que a etapa já tem, ou o que a linha fechada mostra enquanto ele não existe. */
export function nomeDaEtapa(grupo: FormGroup<EtapaForm>): string {
  const nome = grupo.controls.nome.value.trim();
  return nome === '' ? 'Etapa sem nome' : nome;
}

/**
 * Dia e hora como a consulta os lê: `AAAA-MM-DDTHH:mm`, a hora de parede do campo, vira
 * `DD/MM/AAAA HH:mm`. Vazio fica vazio, para o valor em consulta dizer "Não informado".
 */
export function dataHoraLida(valor: string): string {
  const [data = '', hora = ''] = valor.split('T');
  const [ano, mes, dia] = data.split('-');
  if (!ano || !mes || !dia) return '';
  return hora ? `${dia}/${mes}/${ano} ${hora}` : `${dia}/${mes}/${ano}`;
}

/** Os itens como a consulta os lê, com a soma contra a nota máxima da etapa. */
function itensLidos(grupo: FormGroup<EtapaForm>): {
  readonly linhas: readonly string[];
  readonly soma: string;
} {
  const itens = grupo.controls.itensDeAvaliacao.value;
  return {
    linhas: itens.map((item) => `${item.rotulo} — ${decimalLido(item.pontuacaoMaxima)}`),
    soma: textoDaSoma(itens, grupo.controls.notaMaxima.value),
  };
}

function recursoLido(recurso: RecursoDaEtapa, nomeDoAto: (codigo: string) => string): string {
  const unidade = (valor: string): string => (valor === 'horas' ? 'horas' : 'dias úteis');
  const par = (valor: string, un: string): string =>
    valor === '' ? '' : `${valor} ${unidade(un)}`;
  const partes = [
    recurso.ancora === 'atoPublicado'
      ? `prazo corre da publicação de ${nomeDoAto(recurso.atoAncoraCodigo)}`
      : 'prazo corre da ciência do candidato',
    `prazo de ${par(recurso.prazoValor, recurso.prazoUnidade) || 'não informado'}`,
  ];
  const primeira = par(
    recurso.suspensividadePrimeiraInstanciaValor,
    recurso.suspensividadePrimeiraInstanciaUnidade,
  );
  const segunda = recurso.admiteInstanciaSuperior
    ? par(
        recurso.suspensividadeSegundaInstanciaValor,
        recurso.suspensividadeSegundaInstanciaUnidade,
      )
    : '';
  if (primeira) partes.push(`suspensividade da 1ª instância de ${primeira}`);
  partes.push(
    recurso.admiteInstanciaSuperior ? 'admite instância superior' : 'não admite instância superior',
  );
  if (segunda) partes.push(`suspensividade da 2ª instância de ${segunda}`);
  return partes.join('; ');
}

type TiposDeEtapa = ReturnType<CatalogosDaLeitura['tipoEtapaPorId']>;

function janelaLida(controles: EtapaForm): string {
  if (!controles.inicio.value && !controles.fim.value) return '';
  return `${dataHoraLida(controles.inicio.value) || '—'} até ${dataHoraLida(controles.fim.value) || '—'}`;
}

function regraDeConsolidacaoLida(controles: EtapaForm): string {
  const codigo = controles.regraConsolidacaoCodigo.value;
  return codigo ? `${codigo} (${controles.regraConsolidacaoVersao.value})` : '';
}

/** Quem é a etapa e como o caráter a pontua: tipo, caráter, peso, nota mínima e janela. */
function identificacaoLida(
  grupo: FormGroup<EtapaForm>,
  catalogos: CatalogosDaLeitura,
  tipos: TiposDeEtapa,
) {
  const controles = grupo.controls;
  const caraterAtual = controles.carater.value;
  const carater = caracteresAdmitidos(
    tipos.get(controles.tipoEtapaOrigemId.value),
    etapaDeNotaDoEnem(grupo, tipos),
    caraterAtual,
  ).find((opcao) => opcao.valor === caraterAtual);

  return {
    nome: nomeDaEtapa(grupo),
    tipo: catalogos.rotuloDoTipoEtapa().get(controles.tipoEtapaOrigemId.value) ?? '',
    carater: carater?.rotulo ?? '',
    peso: pontuaPorCarater(caraterAtual) ? controles.peso.value : null,
    notaMinima: eliminaPorCarater(caraterAtual) ? controles.notaMinima.value : null,
    janela: janelaLida(controles),
  };
}

/** Como a etapa é avaliada: nota máxima, forma, consolidação, lançamento, itens e escala. */
function avaliacaoLida(grupo: FormGroup<EtapaForm>, tipos: TiposDeEtapa) {
  const controles = grupo.controls;
  const declaraNota = etapaDeclaraNotaMaxima(grupo, tipos);
  const avaliacaoHumana = etapaEhDeAvaliacaoHumana(grupo, tipos);
  const usaEscala = etapaUsaEscalaDeAtendimento(grupo, tipos);

  return {
    notaMaxima: declaraNota ? leituraDoCampoDecimal(controles.notaMaxima.value) : null,
    formaDeAvaliacao: declaraNota
      ? rotuloDaFormaDeAvaliacao(controles.formaDeAvaliacao.value)
      : null,
    regraDeConsolidacao: avaliacaoHumana ? regraDeConsolidacaoLida(controles) : null,
    passoDoLancamento:
      avaliacaoHumana && !usaEscala
        ? leituraDoCampoDecimal(controles.passoDoLancamento.value)
        : null,
    itensDeAvaliacao: declaraNota ? itensLidos(grupo) : null,
    escalaDeAtendimento: usaEscala
      ? controles.escalaDeAtendimento.value.map(
          (nivel) => `${nivel.rotulo} — ${decimalLido(nivel.percentual)}%`,
        )
      : null,
    notaDoEnem: etapaDeNotaDoEnem(grupo, tipos),
  };
}

/** O que a etapa entrega e quem a conduz: parecer, bancas, publicações e recursos. */
function divulgacaoLida(grupo: FormGroup<EtapaForm>, catalogos: CatalogosDaLeitura) {
  const controles = grupo.controls;
  const rotulosDosAtos = catalogos.rotuloDoAto();
  const nomeDoAto = (codigo: string): string => rotulosDosAtos.get(codigo) ?? codigo;
  const nomesDasBancas = catalogos.bancas();

  return {
    parecerIndividual: controles.emiteParecerIndividual.value,
    bancas: controles.bancas.value.map(
      (id) => nomesDasBancas.find((banca) => banca.id === id)?.nome ?? id,
    ),
    publicacoes: controles.produtos.value
      .filter((produto: ProdutoDaFase) => produto.atoCodigo !== '')
      .map((produto) => `${nomeDoAto(produto.atoCodigo)} — ${rotuloDoPapel(produto.papel)}`),
    recursos: controles.recursos.value.map((recurso) => recursoLido(recurso, nomeDoAto)),
  };
}

/**
 * A etapa como a consulta a lê: cada declaração em texto, sem o controle que a edita.
 * Peso e nota mínima só aparecem quando o caráter da etapa os admite, como na edição.
 */
export function etapaLida(grupo: FormGroup<EtapaForm>, catalogos: CatalogosDaLeitura) {
  return {
    ...identificacaoLida(grupo, catalogos, catalogos.tipoEtapaPorId()),
    ...avaliacaoLida(grupo, catalogos.tipoEtapaPorId()),
    ...divulgacaoLida(grupo, catalogos),
  };
}
