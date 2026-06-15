import type { FastifyRequest } from "fastify";
import type { UserProfile } from "@notesync/shared-types";

export interface AuthenticatedRequest extends FastifyRequest {
  user: UserProfile;
}
