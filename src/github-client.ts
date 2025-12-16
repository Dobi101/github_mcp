import { config } from "dotenv";
import type {
  GitHubUser,
  GitHubRepository,
  GitHubError,
  ListUserRepositoriesOptions,
  ListOrganizationRepositoriesOptions,
} from "./types/github.js";

// Реэкспорт типов для удобства использования
export type {
  GitHubUser,
  GitHubRepository,
  GitHubError,
  ListUserRepositoriesOptions,
  ListOrganizationRepositoriesOptions,
};

config();

export class GitHubClient {
  private baseUrl = "https://api.github.com";
  private apiVersion = "2022-11-28";
  private token: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": this.apiVersion,
      Authorization: `Bearer ${this.token}`,
      ...(options.headers as Record<string, string>),
    });

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData: GitHubError = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));

      throw new Error(
        errorData.message ||
          `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    // Обработка rate limiting
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");

    if (remaining === "0") {
      const resetTime = reset ? new Date(parseInt(reset) * 1000) : new Date();
      throw new Error(
        `Rate limit exceeded. Reset at: ${resetTime.toISOString()}`
      );
    }

    return response.json();
  }

  async getUser(username: string): Promise<GitHubUser> {
    return this.request<GitHubUser>(`/users/${username}`);
  }

  async getAuthenticatedUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("/user");
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  async listUserRepositories(
    username: string,
    options?: ListUserRepositoriesOptions
  ): Promise<GitHubRepository[]> {
    const params = new URLSearchParams();
    if (options?.type) params.append("type", options.type);
    if (options?.sort) params.append("sort", options.sort);
    if (options?.direction) params.append("direction", options.direction);
    if (options?.per_page)
      params.append("per_page", options.per_page.toString());
    if (options?.page) params.append("page", options.page.toString());

    const query = params.toString();
    const endpoint = `/users/${username}/repos${query ? `?${query}` : ""}`;

    return this.request<GitHubRepository[]>(endpoint);
  }

  async listOrganizationRepositories(
    org: string,
    options?: ListOrganizationRepositoriesOptions
  ): Promise<GitHubRepository[]> {
    const params = new URLSearchParams();
    if (options?.type) params.append("type", options.type);
    if (options?.sort) params.append("sort", options.sort);
    if (options?.direction) params.append("direction", options.direction);
    if (options?.per_page)
      params.append("per_page", options.per_page.toString());
    if (options?.page) params.append("page", options.page.toString());

    const query = params.toString();
    const endpoint = `/orgs/${org}/repos${query ? `?${query}` : ""}`;

    return this.request<GitHubRepository[]>(endpoint);
  }
}
