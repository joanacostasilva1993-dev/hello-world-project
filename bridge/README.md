# ViralFlow Local Bridge

Bridge local HTTP para ligar o browser do ViralFlow a um runtime local.

## Estado atual

- Health check
- Início de jobs
- Estado/progresso de jobs
- Cancelamento
- Dry Run determinístico
- Adaptador Drift MCP via `drift --mcp-stdio`
- Materialização temporária de assets HTTP(S)
- Descoberta dinâmica de operações de texto/marcadores
- CORS restrito ao preview local

## Modos

Por defeito, o bridge fica em **Dry Run** e não toca no Drift.

Para ativar execução real:

```bash
VIRALFLOW_DRIFT_REAL=1 npm run bridge
```

O comando do Drift pode ser alterado:

```bash
DRIFT_COMMAND=/caminho/para/drift VIRALFLOW_DRIFT_REAL=1 npm run bridge
```

Se a instalação precisar de argumentos MCP específicos:

```bash
DRIFT_MCP_ARGS='["--mcp-stdio"]' VIRALFLOW_DRIFT_REAL=1 npm run bridge
```

No modo real, o Drift precisa de Agent Access ativo quando se usa `--mcp-stdio`.

Por defeito:

`http://127.0.0.1:4317/v1/bridge`

Pode alterar:

```bash
LOCAL_BRIDGE_HOST=127.0.0.1 LOCAL_BRIDGE_PORT=4317 npm run bridge
```

## Segurança

O token MCP não passa pelo browser ViralFlow. O processo local inicia a ligação ao Drift e mantém a sessão MCP dentro do bridge.

O modo real dá ao processo local controlo do editor Drift. Use-o apenas quando pretende essa execução.

## Próximo passo

Depois de validar o Dry Run, testar o health check com Drift instalado e Agent Access ativo. Só depois devemos ligar a execução real pelo painel como fluxo normal de produção.
