import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import {
  ConnectionProfileSafeSchema,
  ConnectionInputSchema,
  NamedConnectionInputSchema,
  SessionSchema,
  SessionRenameInputSchema,
  FileListResponseSchema,
  FileReadResponseSchema,
  FilePathInputSchema,
  RemoteProcessSchema,
  SavedCommandSchema,
  TestResultSchema,
  SuccessResponseSchema,
} from "@remotectrl/api-zod";
import type {
  ConnectionConfig,
  ConnectionProfile,
  NamedConnectionInput,
  Session,
  FileListResponse,
  FileReadResponse,
  RemoteProcess,
  SavedCommand,
  TestResult,
} from "@remotectrl/api-zod";

// Query key factories
export const keys = {
  connection: ["connection"] as const,
  connections: ["connections"] as const,
  connectionsActive: ["connections", "active"] as const,
  sessions: ["sessions"] as const,
  files: (path: string) => ["files", path] as const,
  processes: ["processes"] as const,
  commands: ["commands"] as const,
};

// Connection hooks
export const useGetConnection = () =>
  useQuery({
    queryKey: keys.connection,
    queryFn: () => api.get<ConnectionProfile>("/connection", undefined, ConnectionProfileSafeSchema),
  });

export const useSaveConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConnectionConfig) =>
      api.post<ConnectionProfile>("/connection", ConnectionInputSchema.parse(data), undefined, ConnectionProfileSafeSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.connection }),
  });
};

export const useTestConnection = () =>
  useMutation({
    mutationFn: (data: ConnectionConfig) =>
      api.post<TestResult>("/connection/test", ConnectionInputSchema.parse(data), undefined, TestResultSchema),
  });

// Multi-profile hooks
export const useGetConnections = () =>
  useQuery({
    queryKey: keys.connections,
    queryFn: () => api.get<ConnectionProfile[]>("/connections", undefined, { parse: (data) => ConnectionProfileSafeSchema.array().parse(data) }),
  });

export const useGetActiveConnection = () =>
  useQuery({
    queryKey: keys.connectionsActive,
    queryFn: () => api.get<ConnectionProfile>("/connections/active", undefined, ConnectionProfileSafeSchema),
  });

export const useCreateConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NamedConnectionInput) =>
      api.post<ConnectionProfile>("/connections", NamedConnectionInputSchema.parse(data), undefined, ConnectionProfileSafeSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.connections }),
  });
};

export const useDeleteConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.connections }),
  });
};

export const useActivateConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/connections/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.connections });
      qc.invalidateQueries({ queryKey: keys.connectionsActive });
    },
  });
};

// Session hooks
export const useGetSessions = (options?: { refetchInterval?: number }) =>
  useQuery({
    queryKey: keys.sessions,
    queryFn: () => api.get<Session[]>("/sessions", undefined, { parse: (data) => SessionSchema.array().parse(data) }),
    ...options,
  });

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Session>("/sessions", undefined, undefined, SessionSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  });
};

export const useCloseSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  });
};

export const useRenameSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<Session>(`/sessions/${id}`, SessionRenameInputSchema.parse({ title }), undefined, SessionSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  });
};

// File hooks
export const useListFiles = (path: string) =>
  useQuery({
    queryKey: keys.files(path),
    queryFn: () => api.get<FileListResponse>("/files", FilePathInputSchema.parse({ path }), FileListResponseSchema),
    staleTime: 10_000,
  });

export const useDeleteFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.delete<void>("/files", FilePathInputSchema.parse({ path }), SuccessResponseSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
};

export const useMakeDirectory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.post<void>("/files/mkdir", FilePathInputSchema.parse({ path }), undefined, SuccessResponseSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
};

export const useReadFile = () =>
  useMutation({
    mutationFn: (path: string) => api.get<FileReadResponse>("/files/read", FilePathInputSchema.parse({ path }), FileReadResponseSchema),
  });

// Process hooks
export const useGetProcesses = (options?: { refetchInterval?: number }) =>
  useQuery({
    queryKey: keys.processes,
    queryFn: () => api.get<RemoteProcess[]>("/processes", undefined, { parse: (data) => RemoteProcessSchema.array().parse(data) }),
    ...options,
  });

export const useKillProcess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pid: number) => api.delete<void>(`/processes/${pid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.processes }),
  });
};

// Command hooks
export const useGetCommands = () =>
  useQuery({
    queryKey: keys.commands,
    queryFn: () => api.get<SavedCommand[]>("/commands", undefined, { parse: (data) => SavedCommandSchema.array().parse(data) }),
  });

export const useCreateCommand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; command: string; description?: string }) =>
      api.post<SavedCommand>("/commands", data, undefined, SavedCommandSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.commands }),
  });
};

export const useDeleteCommand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/commands/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.commands }),
  });
};
