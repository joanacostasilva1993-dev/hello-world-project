# ViralFlow Local Bridge

Bridge local HTTP para ligar o browser do ViralFlow a um runtime local.

## Estado atual

- Health check
- Início de jobs
- Estado/progresso de jobs
- Cancelamento
- Dry Run determinístico
- CORS restrito ao preview local

**Importante:** esta versão ainda não executa comandos reais no Drift. O runtime real do Drift/MCP será ligado num adaptador separado depois de validarmos este contrato no ambiente local.

## Executar

```bash
npm run bridge
```

Por defeito:

`http://127.0.0.1:4317/v1/bridge`

Pode alterar:

```bash
LOCAL_BRIDGE_HOST=127.0.0.1 LOCAL_BRIDGE_PORT=4317 npm run bridge
```
