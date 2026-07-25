import { createContext } from 'react';

export interface AIProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  nostr?: boolean;
  proxy?: boolean;
  openSecret?: string;
}

export interface MCPServer {
  type: 'streamable-http';
  url: string;
  headers?: Record<string, string>;
}

export interface MCPServers {
  [key: string]: MCPServer;
}

/** Reasoning effort levels for models that support reasoning_effort. */
export type ThinkingLevel = 'auto' | 'low' | 'medium' | 'high';

export interface AISettings {
  providers: AIProvider[];
  recentlyUsedModels: string[];
  imageModel?: string;
  mcpServers?: MCPServers;
  /** Built-in tool names that are disabled. Omitting a name means the tool is enabled. */
  disabledBuiltinTools?: string[];
  /** Per-model reasoning effort overrides, keyed by full model id (provider/model). */
  modelThinkingLevels?: Record<string, ThinkingLevel>;
}

export interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  setProvider: (provider: AIProvider) => void;
  removeProvider: (id: string) => void;
  setProviders: (providers: AIProvider[]) => void;
  addRecentlyUsedModel: (modelId: string) => void;
  setMCPServer: (name: string, server: MCPServer) => void;
  removeMCPServer: (name: string) => void;
  isConfigured: boolean;
  isLoading: boolean;
  /** Set the reasoning effort override for a specific model. */
  setModelThinkingLevel: (modelId: string, level: ThinkingLevel) => void;
  /** Get the reasoning effort override for a specific model (default 'auto'). */
  getModelThinkingLevel: (modelId: string) => ThinkingLevel;
}

export const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);