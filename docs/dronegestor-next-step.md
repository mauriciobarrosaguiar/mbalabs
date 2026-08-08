# DroneGestor Agro — próxima etapa

## Entregue neste ciclo

- GPS do celular para obter a posição real do talhão.
- Clima atual via Open-Meteo usando a coordenada do piloto.
- Temperatura, umidade, vento, direção, rajadas e precipitação.
- Atualização automática dos campos climáticos da missão.
- Atalho para abrir a coordenada no OpenStreetMap.
- Migration inicial preparada para configurações, drones, protocolos e aplicações.

## Pendente para persistência em produção

O projeto Vercel de produção usa o Supabase `jrbkojhnltqfqwpczwuw`. A conexão administrativa disponível no ambiente atual não possui permissão nesse projeto. A migration não deve ser aplicada em outro Supabase.

Antes de aplicar em produção, revisar as políticas RLS com base no vínculo `core_usuarios` / `core_empresas` do banco principal.