import type {
  FaseOuEtapaDoMotivo,
  IdentidadeDoMotivo,
  MotivoNoDocumento,
} from './motivo-no-documento';
import type { MotivoOferecido } from './grupos-de-motivos';

export function identidadeDoMotivoOferecido(
  faseOuEtapa: FaseOuEtapaDoMotivo,
  motivo: MotivoOferecido,
): IdentidadeDoMotivo {
  return { ...faseOuEtapa, tipoCodigo: motivo.tipoCodigo, codigo: motivo.codigo };
}

/** O motivo oferecido como entra no documento: a referência e a cópia do que o cadastro diz dele. */
export function comoMotivoEscolhido(
  faseOuEtapa: FaseOuEtapaDoMotivo,
  motivo: MotivoOferecido,
): MotivoNoDocumento {
  return {
    ...identidadeDoMotivoOferecido(faseOuEtapa, motivo),
    descricao: motivo.descricao,
    ...(motivo.sentido === null ? {} : { sentido: motivo.sentido }),
    ...(motivo.subclassificacao === null ? {} : { subclassificacao: motivo.subclassificacao }),
  };
}
