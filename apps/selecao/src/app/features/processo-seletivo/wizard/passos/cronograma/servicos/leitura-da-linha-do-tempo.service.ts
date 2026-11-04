import { computed, inject, Injectable } from '@angular/core';
import type { FormGroup } from '@angular/forms';

import { CatalogosDoCronograma } from '../catalogos-do-cronograma.service';
import { etapaDoFormulario, type EtapaForm, type FaseForm } from '../cronograma-form';
import { rotuloDoPapel } from '../leitura-da-etapa';
import { componeNota } from '../regras-da-etapa';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

/** O que a linha do tempo lê do formulário para mostrar: as etapas de cada fase, o que ela publica e as marcas do cabeçalho. */
@Injectable()
export class LeituraDaLinhaDoTempo {
  private readonly catalogos = inject(CatalogosDoCronograma);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly versaoDoFormulario = this.cronograma.versao;

  /**
   * Os controles de etapa que declaram pertencer a esta fase, com o índice que cada um
   * ocupa no FormArray — é por ele que o template liga rótulo, `id` e remoção.
   *
   * A etapa é filha da fase no domínio, mas no formulário continua irmã de `fases`: um
   * `formArrayName` aninhado seria procurado dentro do grupo da fase, que não a contém.
   * Por isso a ligação é por referência, e o recorte acontece aqui.
   */
  etapasDaFase(
    codigo: string,
    agrupaEtapas: boolean,
  ): readonly { indice: number; grupo: FormGroup<EtapaForm> }[] {
    this.versaoDoFormulario();
    return this.cronograma.etapas.controls
      .map((grupo, indice) => ({ indice, grupo }))
      .filter(({ grupo }) => {
        const declarada = grupo.controls.faseCodigo.value;
        // Etapa gravada antes do vínculo não declara fase: continua aparecendo sob a
        // fase que o cadastro marca como agrupadora, que é onde ela sempre esteve.
        return declarada === '' ? agrupaEtapas : declarada === codigo;
      });
  }

  readonly etapasQueCompoemNota = computed(() => {
    this.versaoDoFormulario();
    return this.cronograma.etapas.controls.map(etapaDoFormulario).filter(componeNota).length;
  });

  /**
   * Etapas que nenhuma fase da linha do tempo agrupa.
   *
   * O agregado tolera o estado — só a publicação o recusa —, e chega-se a ele
   * quando a fase de avaliação sai e a gravação que esvaziaria as etapas não
   * acontece. Elas não têm onde aparecer na linha do tempo, então a tela as
   * mostra à parte: sem isso a conferência cobra a remoção de etapas que não
   * estão em lugar nenhum, e o cronograma fica sem gravação possível.
   *
   * Resolve pelo mesmo caminho da conferência — o que a fase congelou vale
   * sobre o catálogo —, para que as duas nunca discordem sobre haver ou não
   * quem agrupe.
   */
  readonly etapasOrfas = computed<readonly { indice: number; rotulo: string }[]>(() => {
    this.versaoDoFormulario();
    const codigosNaLinha = new Set(
      this.cronograma.fases.controls.map((grupo) => grupo.controls.codigo.value),
    );
    const haAgrupadora = this.cronograma
      .linhaDoTempo()
      .some((item) => item.exigencias?.agrupaEtapas === true);

    return this.cronograma.etapas.controls
      .map((grupo, indice) => ({ indice, grupo }))
      .filter(({ grupo }) => {
        const codigo = grupo.controls.faseCodigo.value;
        // Sem fase declarada, a etapa só é órfã quando nenhuma fase a agruparia.
        return codigo === '' ? !haAgrupadora : !codigosNaLinha.has(codigo);
      })
      .map(({ indice, grupo }) => {
        const nome = grupo.controls.nome.value.trim();
        return { indice, rotulo: nome === '' ? `Etapa ${indice + 1}, ainda sem nome` : nome };
      });
  });

  /**
   * O que a fase publica, como a tela o mostra: nome do ato e papel da
   * publicação. É leitura, não escolha — a declaração dos produtos é de outro
   * passo, e o que está aqui atravessa a gravação inalterado.
   *
   * O ato cujo rótulo o catálogo não resolve aparece pelo código: ele descreve
   * o cronograma gravado, e escondê-lo faria a fase parecer publicar menos do
   * que publica.
   */
  produtosDaFase(
    grupo: FormGroup<FaseForm>,
  ): readonly { atoCodigo: string; nome: string; papel: string }[] {
    const rotulos = this.catalogos.rotuloDoAto();

    return grupo.controls.produtos.value.map((produto) => ({
      atoCodigo: produto.atoCodigo,
      nome: rotulos.get(produto.atoCodigo) ?? produto.atoCodigo,
      papel: rotuloDoPapel(produto.papel),
    }));
  }

  /** O que a fase publica, em texto: o ato e o papel dele no ciclo recursal. */
  produtosLidosDaFase(grupo: FormGroup<FaseForm>): readonly string[] {
    return this.produtosDaFase(grupo).map((produto) => `${produto.nome} — ${produto.papel}`);
  }

  /**
   * O que a fase fechada diz de si: quantas etapas acontecem nela e quantos documentos ela
   * exige. É o bastante para o operador saber onde entrar sem abrir uma por uma.
   */
  marcasDaFase(indice: number): readonly string[] {
    const { etapas, documentos } = this.cronograma.dependentesDaFase(indice);
    const marcas: string[] = [];
    if (etapas > 0) marcas.push(etapas === 1 ? '1 etapa' : `${etapas} etapas`);
    if (documentos > 0) {
      marcas.push(documentos === 1 ? '1 documento' : `${documentos} documentos`);
    }
    return marcas;
  }
}
