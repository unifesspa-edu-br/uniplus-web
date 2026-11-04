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
import type { CatalogosDoCronograma } from './catalogos-do-cronograma.service';
import type { EtapaForm } from './cronograma-form';
import {
  etapaDeclaraNotaMaxima,
  etapaDeNotaDoEnem,
  etapaEhDeAvaliacaoHumana,
  etapaUsaEscalaDeAtendimento,
} from './declaracoes-da-etapa';
import { caracteresAdmitidos, eliminaPorCarater, pontuaPorCarater } from './regras-da-etapa';

export type CatalogosDaLeitura = Pick<
  CatalogosDoCronograma,
  'rotuloDoAto' | 'rotuloDoTipoEtapa' | 'bancas' | 'tipoEtapaPorId'
>;

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

/**
 * A etapa como a consulta a lê: cada declaração em texto, sem o controle que a edita.
 * Peso e nota mínima só aparecem quando o caráter da etapa os admite, como na edição.
 */
export function etapaLida(grupo: FormGroup<EtapaForm>, catalogos: CatalogosDaLeitura) {
  const rotulosDosAtos = catalogos.rotuloDoAto();
  const nomeDoAto = (codigo: string): string => rotulosDosAtos.get(codigo) ?? codigo;
  const tipos = catalogos.tipoEtapaPorId();
  const controles = grupo.controls;
  const tipo = tipos.get(controles.tipoEtapaOrigemId.value);
  const carater = caracteresAdmitidos(
    tipo,
    etapaDeNotaDoEnem(grupo, tipos),
    controles.carater.value,
  ).find((opcao) => opcao.valor === controles.carater.value);
  const janela =
    controles.inicio.value || controles.fim.value
      ? `${dataHoraLida(controles.inicio.value) || '—'} até ${dataHoraLida(controles.fim.value) || '—'}`
      : '';
  const nomesDasBancas = catalogos.bancas();
  const declaraNota = etapaDeclaraNotaMaxima(grupo, tipos);
  const avaliacaoHumana = etapaEhDeAvaliacaoHumana(grupo, tipos);

  return {
    nome: nomeDaEtapa(grupo),
    tipo: catalogos.rotuloDoTipoEtapa().get(controles.tipoEtapaOrigemId.value) ?? '',
    carater: carater?.rotulo ?? '',
    peso: pontuaPorCarater(controles.carater.value) ? controles.peso.value : null,
    notaMinima: eliminaPorCarater(controles.carater.value) ? controles.notaMinima.value : null,
    notaMaxima: declaraNota ? leituraDoCampoDecimal(controles.notaMaxima.value) : null,
    formaDeAvaliacao: declaraNota
      ? rotuloDaFormaDeAvaliacao(controles.formaDeAvaliacao.value)
      : null,
    regraDeConsolidacao: avaliacaoHumana
      ? controles.regraConsolidacaoCodigo.value
        ? `${controles.regraConsolidacaoCodigo.value} (${controles.regraConsolidacaoVersao.value})`
        : ''
      : null,
    passoDoLancamento:
      avaliacaoHumana && !etapaUsaEscalaDeAtendimento(grupo, tipos)
        ? leituraDoCampoDecimal(controles.passoDoLancamento.value)
        : null,
    itensDeAvaliacao: declaraNota ? itensLidos(grupo) : null,
    escalaDeAtendimento: etapaUsaEscalaDeAtendimento(grupo, tipos)
      ? controles.escalaDeAtendimento.value.map(
          (nivel) => `${nivel.rotulo} — ${decimalLido(nivel.percentual)}%`,
        )
      : null,
    notaDoEnem: etapaDeNotaDoEnem(grupo, tipos),
    janela,
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
