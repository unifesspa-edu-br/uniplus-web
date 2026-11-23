import { inject, Injectable, Injector } from '@angular/core';

import type { RegraDeComprovacao } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  documentosDe,
  exigenciasLocalizadas,
} from '../../../shared/exigencias/consulta-das-exigencias';
import { focarAposRenderizar } from '../../../shared/foco-apos-renderizar';
import { idDaFase } from '../../fase/ids-da-fase';
import { RecusasDasExigencias } from '../../fase/documentos/recusas-das-exigencias.service';
import type { RecusaDaExigencia } from './gravacao-das-exigencias-documentais.service';
import { ExpansaoDoCronograma } from './expansao-do-cronograma.service';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

@Injectable()
export class ApresentacaoDasRecusasDasExigencias {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly expansao = inject(ExpansaoDoCronograma);
  private readonly recusas = inject(RecusasDasExigencias);
  private readonly injetor = inject(Injector);

  apresentar(): void {
    const recusadas = this.recusasLocalizadas();
    const indices = this.cronograma
      .linhaDoTempo()
      .filter((fase) =>
        recusadas.some(
          ({ exigencia }) => exigencia.documento.faseCodigo === fase.grupo.controls.codigo.value,
        ),
      )
      .map((fase) => fase.indice);
    this.expansao.abrirFases(indices);
    const primeira = recusadas[0];
    if (primeira) this.focar(primeira.recusa, primeira.exigencia.documento.faseCodigo);
  }

  private recusasLocalizadas() {
    const rascunho = this.store.draft().documentos;
    const exigencias = exigenciasLocalizadas(rascunho);
    const grupos = rascunho.regrasDeComprovacao;
    return this.recusas.todas().flatMap((recusa) => {
      const exigencia = exigencias.find(
        (item) => item.identificadorNoRascunho === recusa.identificadorDaRegra,
      );
      const documento = exigencia?.documento ?? documentoDaRecusa(recusa, grupos, exigencias);
      return documento ? [{ recusa, exigencia: { documento } }] : [];
    });
  }

  private focar(recusa: RecusaDaExigencia, fase: string): void {
    const identificador = recusa.identificadorDaRegra;
    if (identificador === null) return;
    const campoDoGrupo = alvoDoGrupo(recusa.campo, identificador);
    if (campoDoGrupo) {
      focarAposRenderizar(this.injetor, campoDoGrupo);
      return;
    }
    this.focarDocumento(recusa, fase, identificador);
  }

  private focarDocumento(recusa: RecusaDaExigencia, fase: string, identificador: string): void {
    const linha = idDaFase(fase, `doc-linha-${identificador}`);
    const arquivo = idDaFase(fase, `doc-arquivo-${identificador}`);
    const campo = recusa.campo;
    const prazoOuValidade = alvoDoPrazoOuValidade(campo, fase, identificador);
    if (prazoOuValidade) {
      focarAposRenderizar(this.injetor, prazoOuValidade, linha);
    } else if (campo.startsWith('documento.requisitos.formatosPermitidos')) {
      focarAposRenderizar(this.injetor, `${arquivo}-qualquer`, linha);
    } else if (campo.startsWith('documento.requisitos.tamanhoMaximoBytes')) {
      focarAposRenderizar(this.injetor, `${arquivo}-tamanho`, linha);
    } else if (campo.startsWith('documento.indeferimento.consequencia')) {
      focarAposRenderizar(this.injetor, idDaFase(fase, `doc-consequencia-${identificador}`), linha);
    } else focarAposRenderizar(this.injetor, linha);
  }
}

function documentoDaRecusa(
  recusa: RecusaDaExigencia,
  grupos: readonly RegraDeComprovacao[],
  exigencias: ReturnType<typeof exigenciasLocalizadas>,
) {
  const grupo = encontrarGrupo(grupos, recusa.identificadorDaRegra);
  const documento = grupo && documentosDe([grupo])[0];
  if (documento) return documento;
  const fase = recusa.faseCodigo;
  const herdada = exigencias.find(
    (item) => item.documento.tipoDocumentoId === recusa.identificadorDaRegra,
  );
  return fase && herdada ? { ...herdada.documento, faseCodigo: fase } : null;
}

function encontrarGrupo(
  regras: readonly RegraDeComprovacao[],
  identificador: string | null,
): RegraDeComprovacao | undefined {
  for (const regra of regras) {
    if (regra.forma !== 'DOCUMENTO' && regra.identificadorNoRascunho === identificador)
      return regra;
    const encontrado = encontrarGrupo(regra.itens ?? [], identificador);
    if (encontrado) return encontrado;
  }
  return undefined;
}

function alvoDoGrupo(campo: string, identificador: string): string | null {
  if (campo.startsWith('cardinalidade.quantidadeMinima')) return `quantidade-${identificador}`;
  if (campo.startsWith('indeferimento.consequencia')) return `consequencia-${identificador}`;
  if (campo.startsWith('indeferimento.basesLegais')) return `normas-${identificador}-grupo`;
  return null;
}

const CAMPOS_DO_PRAZO_E_DA_VALIDADE: Readonly<Record<string, string>> = {
  valor: 'valor',
  unidade: 'unidade',
  referencia: 'referencia-tipo',
  'referencia.tipo': 'referencia-tipo',
  'referencia.data': 'referencia-data',
  'referencia.faseId': 'referencia-fase',
  efeitoForaDoPrazo: 'efeito',
  efeitoDoVencimento: 'efeito',
};

function alvoDoPrazoOuValidade(campo: string, fase: string, identificador: string): string | null {
  const partes = /^documento\.requisitos\.(prazoDeEmissao|validade)\.(.+)$/.exec(campo);
  if (!partes) return null;
  const prazo = partes[1] === 'prazoDeEmissao';
  const base = idDaFase(fase, `doc-${prazo ? 'prazo' : 'validade'}-${identificador}`);
  const destino =
    partes[2] === 'escolha'
      ? prazo
        ? 'semPrazo'
        : 'naoExigeDocumentoValido'
      : CAMPOS_DO_PRAZO_E_DA_VALIDADE[partes[2]];
  return destino ? `${base}-${destino}` : null;
}
