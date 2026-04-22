interface SteamUser {
  name: string;
  steamId: string;
}

interface Window {
  electronStore?: {
    getAll(): Promise<Record<string, string>>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
    bulkSave(data: Record<string, string>): Promise<void>;
    getStorePath(): Promise<string>;
  };
  steam?: {
    getUser(): Promise<SteamUser | null>;
    getTicket(): Promise<string | null>;
    unlockAchievement(id: string): Promise<boolean>;
    setPresence(key: string, value: string): Promise<boolean>;
    openInviteDialog(connectStr: string): Promise<boolean>;
  };
  electronWindow?: {
    minimize(): void;
    maximize(): void;
    close(): void;
    setFullscreen(flag: boolean): Promise<void>;
    isMaximized(): Promise<boolean>;
    isFullscreen(): Promise<boolean>;
    setResolution(width: number, height: number): Promise<void>;
    getDisplays(): Promise<{ width: number; height: number }>;
  };
}
