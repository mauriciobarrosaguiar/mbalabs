# MBA Calda — aplicativo Android 100% nativo

Aplicativo offline escrito em **Java com widgets nativos Android** (Activity, TextView, EditText, Spinner, Button, ScrollView e SharedPreferences). **Não usa WebView, HTML, JavaScript, conexão com internet, servidor nem conta de usuário.**

## Funcionalidade
- Tanque (L) e taxa de aplicação (L/ha).
- Área coberta por tanque: `tanque / taxa`.
- Vários produtos com nome, dosagem por hectare e unidade `mL/ha`, `L/ha`, `g/ha` ou `kg/ha`.
- Quantidade por tanque: `área do tanque * dose por hectare`.
- Conversão legível: 1000 mL = 1 L, 1000 g = 1 kg. Sem conversão de massa em volume.
- Atualização automática, memória local dos dados, inclusão e exclusão de produtos, copiar resumo, limpar dados.
- Entrada numérica em português com vírgula ou ponto.

## Exemplo
Tanque 40 L, aplicação 10 L/ha → **4 ha**. Dose de 250 mL/ha → **1 L do produto por tanque**.

## Como gerar o APK (Android Studio)
1. Abra a pasta `mba-calda-nativo` no Android Studio, com JDK 17 e SDK 35.
2. Sincronize o projeto com Gradle.
3. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`.
4. APK de teste: `app/build/outputs/apk/debug/app-debug.apk`.

Opcional: `gradle :app:assembleDebug` em computador com SDK e Gradle configurados.

## Observação agronômica
A capacidade é o volume **final** da calda. Esta ferramenta não recomenda doses, produtos nem sequência de mistura. Siga a bula, as orientações técnicas e use os equipamentos de proteção.

## Privacidade
Nenhuma permissão é exigida e nada é enviado à internet. Dados salvos somente no próprio celular.
