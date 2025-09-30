export interface GitHubWebhookPayload {
  action?: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    user: {
      login: string;
    };
  };
  pull_request?: {
    number: number;
    title: string;
    body: string;
    user: {
      login: string;
    };
  };
  comment?: {
    body: string;
    user: {
      login: string;
    };
  };
  repository: {
    full_name: string;
    clone_url: string;
  };
  sender: {
    login: string;
  };
}

export type IssueType = 'issue' | 'pr';

export interface ClaudeInstruction {
  type: IssueType;
  number: number;
  instruction: string;
  repository: string;
  sender: string;
  cloneUrl: string;
}
