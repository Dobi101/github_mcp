import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { userTools, handleUserTool } from "./tools/users.js";
import { repositoryTools, handleRepositoryTool } from "./tools/repositories.js";
import http from "http";
import { URL } from "url";

const PORT = process.env.MCP_PORT || 3000;
const MCP_PATH = "/mcp";

// Хранилище для сессий и сообщений
const sessions = new Map<string, any[]>();
// Хранилище для активных SSE соединений
const sseConnections = new Map<string, http.ServerResponse>();

async function main() {
  // Создаем MCP сервер
  const mcpServer = new Server(
    {
      name: "github-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Регистрируем обработчик для списка tools
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...userTools, ...repositoryTools],
    };
  });

  // Регистрируем обработчик для вызова tools
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      // Проверяем, к какой группе относится tool
      if (userTools.some((tool) => tool.name === name)) {
        result = await handleUserTool(name, args || {});
      } else if (repositoryTools.some((tool) => tool.name === name)) {
        result = await handleRepositoryTool(name, args || {});
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Создаем HTTP сервер
  const httpServer = http.createServer(async (req, res) => {
    // Устанавливаем CORS заголовки
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Mcp-Session-Id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Обработка GET запроса для SSE (Server-Sent Events) - для получения сообщений
    if (req.method === "GET" && url.pathname === MCP_PATH) {
      const headerSessionId = req.headers["mcp-session-id"];
      const sessionId =
        url.searchParams.get("Mcp-Session-Id") ||
        (typeof headerSessionId === "string"
          ? headerSessionId
          : Array.isArray(headerSessionId)
          ? headerSessionId[0]
          : null) ||
        "default";

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Mcp-Session-Id": sessionId,
      });

      // Сохраняем SSE соединение
      sseConnections.set(sessionId, res);

      // Отправляем накопленные сообщения
      const sessionMessages = sessions.get(sessionId) || [];
      for (const msg of sessionMessages) {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
      sessions.set(sessionId, []);

      // Отправляем ping для поддержания соединения
      const pingInterval = setInterval(() => {
        try {
          res.write(`: ping\n\n`);
        } catch (error) {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Держим соединение открытым
      req.on("close", () => {
        clearInterval(pingInterval);
        sseConnections.delete(sessionId);
        res.end();
      });

      return;
    }

    // Обработка POST запросов для отправки сообщений
    if (req.method === "POST" && url.pathname === MCP_PATH) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const request = JSON.parse(body);
          // Получаем session ID из заголовка или генерируем новый
          const headerSessionId = req.headers["mcp-session-id"];
          let sessionId: string | null =
            typeof headerSessionId === "string"
              ? headerSessionId
              : Array.isArray(headerSessionId)
              ? headerSessionId[0]
              : url.searchParams.get("Mcp-Session-Id");

          // Если session ID не указан, генерируем новый
          if (!sessionId) {
            sessionId = `session-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
          }

          let response: any;

          if (request.method === "initialize") {
            response = {
              jsonrpc: "2.0",
              id: request.id,
              result: {
                protocolVersion: "2024-11-05",
                version: "1.0.0",
                capabilities: {
                  tools: {},
                },
                serverInfo: {
                  name: "github-mcp-server",
                  version: "1.0.0",
                },
              },
            };
            // Инициализируем сессию
            if (!sessions.has(sessionId)) {
              sessions.set(sessionId, []);
            }
            // Отправляем ответ через SSE, если соединение установлено
            const sseRes = sseConnections.get(sessionId);
            if (sseRes) {
              sseRes.write(`data: ${JSON.stringify(response)}\n\n`);
            }
          } else if (request.method === "tools/list") {
            // Вызываем обработчик напрямую
            const toolsResult = {
              tools: [...userTools, ...repositoryTools],
            };
            response = {
              jsonrpc: "2.0",
              id: request.id,
              result: toolsResult,
            };
            // Отправляем ответ через SSE, если соединение установлено
            const sseRes = sseConnections.get(sessionId);
            if (sseRes) {
              sseRes.write(`data: ${JSON.stringify(response)}\n\n`);
            }
          } else if (request.method === "tools/call") {
            // Вызываем обработчик напрямую
            const { name, arguments: args } = request.params || {};
            let callResult: any;

            try {
              let result: unknown;

              // Проверяем, к какой группе относится tool
              if (userTools.some((tool) => tool.name === name)) {
                result = await handleUserTool(name, args || {});
              } else if (repositoryTools.some((tool) => tool.name === name)) {
                result = await handleRepositoryTool(name, args || {});
              } else {
                throw new Error(`Unknown tool: ${name}`);
              }

              callResult = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              callResult = {
                content: [
                  {
                    type: "text",
                    text: `Error: ${errorMessage}`,
                  },
                ],
                isError: true,
              };
            }

            response = {
              jsonrpc: "2.0",
              id: request.id,
              result: callResult,
            };
            // Отправляем ответ через SSE, если соединение установлено
            const sseRes = sseConnections.get(sessionId);
            if (sseRes) {
              sseRes.write(`data: ${JSON.stringify(response)}\n\n`);
            }
          } else {
            response = {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32601,
                message: "Method not found",
              },
            };
          }

          // Всегда возвращаем ответ в теле POST запроса
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Mcp-Session-Id": sessionId,
            "Access-Control-Expose-Headers": "Mcp-Session-Id",
          });
          res.end(JSON.stringify(response));
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message:
                error instanceof Error ? error.message : "Internal error",
            },
          };
          res.writeHead(500, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify(errorResponse));
        }
      });

      return;
    }

    // 404 для других путей
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(PORT, () => {
    console.error(
      `GitHub MCP Server running on http://localhost:${PORT}${MCP_PATH}`
    );
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
