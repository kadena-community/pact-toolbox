import * as Docker from "dockerode";

export interface DockerServiceConfig {
  containerName: string;
  image?: string;
  platform?: string;
  restart?: string;
  stopSignal?: string;
  stopGracePeriod?: number; // seconds
  ulimits?: { Name: string; Soft: number; Hard: number }[];
  dependsOn?: { [key: string]: { condition: string } };
  entrypoint?: string | string[];
  command?: string[];
  ports?: { target: number; published: string | number; protocol?: string }[];
  volumes?: string[];
  environment?: string[] | { [key: string]: string };
  labels?: { [key: string]: string };
  build?: { context: string; dockerfile: string };
  profiles?: string[];
  expose?: string[];
  healthCheck?: Docker.HealthConfig;
  deploy?: {
    replicas?: number;
    restartPolicy?: {
      condition?: "on-failure" | "none" | "always" | "unless-stopped";
      delay?: string; // e.g., "5s"
      maxAttempts?: number;
      window?: string; // e.g., "120s"
    };
  };
}
