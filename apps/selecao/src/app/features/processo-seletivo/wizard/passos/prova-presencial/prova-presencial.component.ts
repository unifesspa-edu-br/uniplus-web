import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { leituraDeMunicipioNoGeo } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  EscolhaComExplicacaoComponent,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
  ValorEmConsultaComponent,
} from '@uniplus/shared-ui/components';

import {
  type ConfirmacaoDeGravacao,
  type GravacaoDoPasso,
  provePassoDoWizard,
} from '../../passo-do-wizard';
import type { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  type RecusaDaPublicacao,
  RecusasDaPublicacao,
} from '../../shared/recusas/recusas-da-publicacao.service';
import { provaPresencialDe } from '../../shared/hidratacao/hidratacao-da-prova-presencial';
import {
  avisoDeRemocaoDosMunicipios,
  escolherProvaPresencial,
  comMunicipioAdicionado,
  semMunicipio,
  municipiosQueSeraoRemovidos,
  rotuloDoMunicipio,
  type MunicipioDeProva,
} from './declaracao-da-prova-presencial';
import { GravacaoDaProvaPresencialService } from './gravacao-da-prova-presencial.service';
import {
  primeiraRecusaDaProvaPresencial,
  unirRecusasDaProvaPresencial,
} from './recusas-da-prova-presencial';
import {
  eRecusaDaProvaPresencial,
  RecusasDaPublicacaoNaProvaPresencial,
} from './recusas-da-publicacao-na-prova-presencial.service';
import { NomesDosMunicipiosDeProva } from './nomes-dos-municipios-de-prova.service';
import { MunicipiosDeProvaComponent } from './municipios-de-prova.component';

const OPCOES_DE_ESCOLHA = [
  {
    codigo: 'sem',
    rotulo: 'Sem prova presencial',
    descricao: 'O processo não tem prova presencial e não declara município de prova.',
  },
  {
    codigo: 'com',
    rotulo: 'Com prova presencial',
    descricao: 'O candidato escolhe uma cidade de prova entre os municípios declarados aqui.',
  },
];
const ESCOLHA_OBRIGATORIA = 'Escolha se o processo tem prova presencial.';

@Component({
  selector: 'sel-step-prova-presencial',
  standalone: true,
  imports: [
    AlertComponent,
    EscolhaComExplicacaoComponent,
    MunicipiosDeProvaComponent,
    ValorEmConsultaComponent,
  ],
  providers: [
    provePassoDoWizard(ProvaPresencialPassoComponent),
    NomesDosMunicipiosDeProva,
    { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useFactory: leituraDeMunicipioNoGeo },
  ],
  templateUrl: './prova-presencial.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProvaPresencialPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly gravacao = inject(GravacaoDaProvaPresencialService);
  private readonly nomesDeMunicipios = inject(NomesDosMunicipiosDeProva);
  private readonly publicacao = inject(RecusasDaPublicacaoNaProvaPresencial);
  private readonly respostaDaPublicacao = inject(RecusasDaPublicacao);
  private readonly injector = inject(Injector);
  protected readonly recusas = computed(() =>
    unirRecusasDaProvaPresencial(this.gravacao.recusasDaGravacao(), this.publicacao.recusas()),
  );
  readonly erroDeGravacao = signal<string | null>(null);
  readonly escolhaInvalida = signal(false);
  protected readonly opcoes = OPCOES_DE_ESCOLHA;
  protected readonly declaracao = computed(() => this.store.draft().provaPresencial);
  protected readonly escolha = computed(() => {
    const valor = this.declaracao().temProvaPresencial;
    return valor === null ? '' : valor ? 'com' : 'sem';
  });
  protected readonly municipiosResolvidos = computed(() =>
    this.declaracao().municipios.map((municipio) => this.nomesDeMunicipios.resolver(municipio)),
  );
  protected readonly valorEmConsulta = computed(() => {
    const escolha = this.escolha();
    if (escolha === 'sem') return 'Sem prova presencial';
    return escolha === 'com' ? `Com prova presencial em: ${this.nomes()}` : null;
  });
  protected readonly nomes = computed(() =>
    this.municipiosResolvidos().map(rotuloDoMunicipio).join(', '),
  );
  protected readonly avisoDeRemocao = computed(() =>
    avisoDeRemocaoDosMunicipios(this.municipiosResolvidos()),
  );
  private readonly campo = viewChild(EscolhaComExplicacaoComponent);
  private readonly municipios = viewChild(MunicipiosDeProvaComponent);
  private readonly gravada = computed(() => {
    const gravada = this.gravacao.gravadaNoServidor();
    if (gravada && gravada.processoId === this.store.processoSeletivoId())
      return gravada.declaracao;
    const snapshot = this.store.remoteSnapshot();
    return snapshot ? provaPresencialDe(snapshot) : { temProvaPresencial: null, municipios: [] };
  });
  private readonly removidos = computed(() =>
    municipiosQueSeraoRemovidos(this.declaracao(), this.gravada()),
  );

  constructor() {
    effect(() => {
      this.nomesDeMunicipios.carregar(this.declaracao().municipios);
      this.nomesDeMunicipios.carregar(this.gravada().municipios);
    });
    effect(() => this.irAoCampoDaRecusa(this.respostaDaPublicacao.destino()));
  }

  private irAoCampoDaRecusa(destino: RecusaDaPublicacao | null): void {
    if (destino === null || !eRecusaDaProvaPresencial(destino)) return;
    untracked(() => this.respostaDaPublicacao.destino.set(null));
    afterNextRender(() => setTimeout(() => this.focarRecusa(destino.resposta, destino.ordem), 0), {
      injector: this.injector,
    });
  }

  private focarRecusa(resposta: number, ordem: number): void {
    const recusas = this.recusas();
    const corresponde = (recusa: { resposta: number; ordem: number }) =>
      recusa.resposta === resposta && recusa.ordem === ordem;
    if (recusas.escolha.some(corresponde)) {
      this.campo()?.focar();
      return;
    }
    const municipio = [...recusas.porMunicipio].find(([, itens]) => itens.some(corresponde));
    this.municipios()?.focarMunicipio(municipio?.[0] ?? '');
  }

  protected escolher(valor: string): void {
    if (!this.store.aceitaEdicao()) return;
    this.store.patchObjectSection(
      'provaPresencial',
      escolherProvaPresencial(this.declaracao(), valor === 'com'),
    );
    this.escolhaInvalida.set(false);
  }

  protected adicionar(municipio: MunicipioDeProva): void {
    this.store.patchObjectSection(
      'provaPresencial',
      comMunicipioAdicionado(this.declaracao(), municipio),
    );
  }

  protected remover(codigo: string): void {
    this.store.patchObjectSection('provaPresencial', semMunicipio(this.declaracao(), codigo));
  }

  validar(): ValidacaoDoPasso {
    const invalida = this.declaracao().temProvaPresencial === null;
    this.escolhaInvalida.set(invalida);
    return invalida ? { valid: false, messages: [ESCOLHA_OBRIGATORIA] } : { valid: true };
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    const removidos = this.removidos();
    if (!removidos.length) return null;
    return {
      ...textoDaRemocao(removidos.length),
      itens: removidos.map((municipio, indice) => ({
        rotulo: `Município de prova ${indice + 1}`,
        valor: rotuloDoMunicipio(this.nomesDeMunicipios.resolver(municipio)),
      })),
      rotuloDeConfirmar: 'Confirmar e gravar',
    };
  }

  async persistir(gravacao?: GravacaoDoPasso): Promise<ValidacaoDoPasso> {
    if (this.declaracao().temProvaPresencial === null) return this.validar();
    const impedimento = this.impedimentoDeRemocao(gravacao);
    if (impedimento) return impedimento;
    const id = this.store.processoSeletivoId();
    if (id === null)
      return {
        valid: false,
        messages: ['Conclua o cadastro do processo antes de declarar a prova presencial.'],
      };
    this.erroDeGravacao.set(null);
    const resultado = await this.gravacao.gravar(id, this.declaracao());
    if (!resultado.valid) this.erroDeGravacao.set(resultado.messages?.[0] ?? null);
    return resultado;
  }

  private impedimentoDeRemocao(gravacao?: GravacaoDoPasso): ValidacaoDoPasso | null {
    if (gravacao?.confirmadaPeloOperador !== false || !this.removidos().length) return null;
    return {
      valid: false,
      messages: [
        'Grave o passo Prova presencial para confirmar a remoção dos municípios de prova.',
      ],
    };
  }

  async revelarCampoInvalido(): Promise<boolean> {
    const recusas = this.recusas();
    const primeira = primeiraRecusaDaProvaPresencial(recusas);
    if (this.escolhaInvalida() || (primeira && recusas.escolha.includes(primeira.recusa))) {
      this.campo()?.focar();
      return !!this.campo();
    }
    return this.municipios()?.focarMunicipio(primeira?.codigo ?? '') ?? false;
  }
}

function textoDaRemocao(quantidade: number): Pick<ConfirmacaoDeGravacao, 'titulo' | 'aviso'> {
  return quantidade === 1
    ? {
        titulo: 'Município de prova será removido',
        aviso: 'O município de prova será removido do processo.',
      }
    : {
        titulo: 'Municípios de prova serão removidos',
        aviso: 'Os municípios de prova serão removidos do processo.',
      };
}
