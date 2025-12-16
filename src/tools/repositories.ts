import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GitHubClient } from '../github-client.js';

const githubClient = new GitHubClient();

export const repositoryTools: Tool[] = [
  {
    name: 'get_repository',
    description: 'Получает информацию о репозитории GitHub по owner и repo name',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Владелец репозитория (username или organization name)',
        },
        repo: {
          type: 'string',
          description: 'Название репозитория',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'list_user_repositories',
    description: 'Получает список репозиториев пользователя GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Имя пользователя GitHub',
        },
        type: {
          type: 'string',
          enum: ['all', 'owner', 'member'],
          description: 'Тип репозиториев для получения. По умолчанию: all',
        },
        sort: {
          type: 'string',
          enum: ['created', 'updated', 'pushed', 'full_name'],
          description: 'Поле для сортировки. По умолчанию: full_name',
        },
        direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Направление сортировки. По умолчанию: desc',
        },
        per_page: {
          type: 'number',
          description: 'Количество результатов на странице (1-100). По умолчанию: 30',
        },
        page: {
          type: 'number',
          description: 'Номер страницы. По умолчанию: 1',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'list_organization_repositories',
    description: 'Получает список репозиториев организации GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        org: {
          type: 'string',
          description: 'Название организации GitHub',
        },
        type: {
          type: 'string',
          enum: ['all', 'public', 'private', 'forks', 'sources', 'member'],
          description: 'Тип репозиториев для получения. По умолчанию: all',
        },
        sort: {
          type: 'string',
          enum: ['created', 'updated', 'pushed', 'full_name'],
          description: 'Поле для сортировки. По умолчанию: full_name',
        },
        direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Направление сортировки. По умолчанию: desc',
        },
        per_page: {
          type: 'number',
          description: 'Количество результатов на странице (1-100). По умолчанию: 30',
        },
        page: {
          type: 'number',
          description: 'Номер страницы. По умолчанию: 1',
        },
      },
      required: ['org'],
    },
  },
];

export async function handleRepositoryTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_repository': {
      const owner = args.owner as string;
      const repo = args.repo as string;
      if (!owner || !repo) {
        throw new Error('Owner and repo are required');
      }
      return await githubClient.getRepository(owner, repo);
    }

    case 'list_user_repositories': {
      const username = args.username as string;
      if (!username) {
        throw new Error('Username is required');
      }
      const options = {
        type: args.type as 'all' | 'owner' | 'member' | undefined,
        sort: args.sort as 'created' | 'updated' | 'pushed' | 'full_name' | undefined,
        direction: args.direction as 'asc' | 'desc' | undefined,
        per_page: args.per_page as number | undefined,
        page: args.page as number | undefined,
      };
      return await githubClient.listUserRepositories(username, options);
    }

    case 'list_organization_repositories': {
      const org = args.org as string;
      if (!org) {
        throw new Error('Organization name is required');
      }
      const options = {
        type: args.type as 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member' | undefined,
        sort: args.sort as 'created' | 'updated' | 'pushed' | 'full_name' | undefined,
        direction: args.direction as 'asc' | 'desc' | undefined,
        per_page: args.per_page as number | undefined,
        page: args.page as number | undefined,
      };
      return await githubClient.listOrganizationRepositories(org, options);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

