# Calda Fácil Android

Aplicativo Android simples que abre diretamente a calculadora pública em:

`https://www.mbalabs.com.br/calda-facil`

- Pacote: `br.com.mbalabs.caldafacil`
- Login: não necessário
- Min SDK: Android 7.0 (API 24)
- Target SDK: 35

## APK de teste

O workflow `.github/workflows/calda-facil-apk.yml` gera `CaldaFacil.apk` automaticamente quando o projeto Android ou a calculadora são alterados no `main`.

O APK atual é de desenvolvimento (`debug`) e serve para instalação/testes diretos. Para distribuição permanente/Play Store deve ser criada uma chave de assinatura de produção mantida fora do repositório.
