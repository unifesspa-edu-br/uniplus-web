import { inject, Injectable, Injector } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { exigenciasLocalizadas } from '../../../shared/exigencias/consulta-das-exigencias';
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
    const exigencias = exigenciasLocalizadas(this.store.draft().documentos);
    return this.recusas.todas().flatMap((recusa) => {
      const exigencia = exigencias.find(
        (item) => item.identificadorNoRascunho === recusa.identificadorDaRegra,
      );
      return exigencia ? [{ recusa, exigencia }] : [];
    });
  }

  private focar(recusa: RecusaDaExigencia, fase: string): void {
    const identificador = recusa.identificadorDaRegra;
    if (identificador === null) return;
    const linha = idDaFase(fase, `doc-linha-${identificador}`);
    const arquivo = idDaFase(fase, `doc-arquivo-${identificador}`);
    const campo = recusa.campo;
    if (campo.startsWith('documento.requisitos.formatosPermitidos')) {
      focarAposRenderizar(this.injetor, `${arquivo}-qualquer`, linha);
    } else if (campo.startsWith('documento.requisitos.tamanhoMaximoBytes')) {
      focarAposRenderizar(this.injetor, `${arquivo}-tamanho`, linha);
    } else if (campo.startsWith('documento.indeferimento.consequencia')) {
      focarAposRenderizar(this.injetor, idDaFase(fase, `doc-consequencia-${identificador}`), linha);
    } else focarAposRenderizar(this.injetor, linha);
  }
}
