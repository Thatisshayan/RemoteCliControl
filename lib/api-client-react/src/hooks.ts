import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getBaseUrl } from "./client.js";
import type {
  ConnectionConfig,
  ConnectionProfile,
  Session,
  FileItem,
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
  useQuery({ queryKey: keys.connection, queryFn: () => api.get<ConnectionConfig>("/connection") });

export const useSaveConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ConnectionConfig, "id">) => api.post<ConnectionConfig>("/connection", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.connection }),
  });
};

export const useTestConnection = () =>
  useMutation({
    mutationFn: (data: ConnectionConfig) => api.post<TestResult>("/connection/test", data),
  });

// Multi-profile hooks
export const useGetConnections = () =>
  useQuery({ queryKey: keys.connections, queryFn: () => api.get<ConnectionProfile[]>("/connections") });

export const useGetActiveConnection = () =>
  useQuery({ queryKey: keys.connectionsActive, queryFn: () => api.get<ConnectionProfile>("/connections/active") });

export const useCreateConnection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string } & Omit<ConnectionConfig, "id">) =>
      api.post<ConnectionProfile>("/connections", data),
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
export const useGetSessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => api.get<Session[]>("/sessions") });

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Session>("/sessions"),
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
      api.patch<Session>(`/sessions/${id}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  });
};

// File hooks
export const useListFiles = (path: string) =>
  useQuery({
    queryKey: keys.files(path),
    queryFn: () => api.get<{ path: string; items: FileItem[] }>("/files", { path }),
  });

export const useDeleteFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.delete<void>("/files", { path }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
};

export const useMakeDirectory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.post<void>("/files/mkdir", { path }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
};

export const useReadFile = () =>
  useMutation({
    mutationFn: (path: string) => api.get<{ content: string }>("/files/read", { path }),
  });

export const useDownloadFile = () =>
  useMutation({
    mutationFn: (path: string) => {
      const url = `${getBaseUrl()}/files/download?path=${encodeURIComponent(path)}`;
      return fetch(url).then((r) => r.blob());
    },
  });

// Process hooks
export const useGetProcesses = () =>
  useQuery({ queryKey: keys.processes, queryFn: () => api.get<RemoteProcess[]>("/processes") });

export const useKillProcess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pid: number) => api.delete<void>(`/processes/${pid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.processes }),
  });
};

// Command hooks
export const useGetCommands = () =>
  useQuery({ queryKey: keys.commands, queryFn: () => api.get<SavedCommand[]>("/commands") });

export const useCreateCommand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; command: string; description?: string }) =>
      api.post<SavedCommand>("/commands", data),
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
