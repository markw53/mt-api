import { User } from "./users";
import { TeamResponse } from "./teams";
import { TicketResponse } from "./tickets";
import { EventRegistrationResponse, EventResponse } from "./events";

export interface AdminDashboardData {
  users: User[];
  total_users: number;
  events: EventResponse[];
  total_events: number;
  draft_events: EventResponse[];
  teams: TeamResponse[];
  total_teams: number;
  total_team_members: number;
  tickets: TicketResponse[];
  registrations: EventRegistrationResponse[];
}