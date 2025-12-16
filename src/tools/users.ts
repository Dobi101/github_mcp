import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GitHubClient } from '../github-client.js';

const githubClient = new GitHubClient();

export const userTools: Tool[] = [
  {
    name: 'get_user',
    description: 'Получает информацию о пользователе GitHub по его username',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Имя пользователя GitHub (например, "octocat")',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'get_authenticated_user',
    description: 'Получает информацию об аутентифицированном пользователе (используется токен из GITHUB_TOKEN)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

export async function handleUserTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_user': {
      const username = args.username as string;
      if (!username) {
        throw new Error('Username is required');
      }
      return await githubClient.getUser(username);
    }

    case 'get_authenticated_user': {
      return await githubClient.getAuthenticatedUser();
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

