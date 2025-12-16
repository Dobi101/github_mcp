import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { userTools, handleUserTool } from './tools/users.js';
import { repositoryTools, handleRepositoryTool } from './tools/repositories.js';

async function main() {
  // Создаем MCP сервер
  const server = new Server(
    {
      name: 'github-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Регистрируем обработчик для списка tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...userTools, ...repositoryTools],
    };
  });

  // Регистрируем обработчик для вызова tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
            type: 'text',
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
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Создаем транспорт stdio
  const transport = new StdioServerTransport();
  
  // Подключаем сервер к транспорту
  await server.connect(transport);

  console.error('GitHub MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});

