import db from "../db/connection";
import {
  Ticket,
  TicketResponse,
  TicketWithEventInfo,
  TicketWithUserInfo,
} from "../types";
import { convertIdsInArray, convertIds } from "../utils/converters";

// Common ID fields that need to be converted
const idFields = ["id", "event_id", "user_id", "registration_id"];

// Get all tickets
export const fetchAllTickets = async (): Promise<TicketResponse[]> => {
  const result = await db.query(`
    SELECT * FROM tickets
    ORDER BY issued_at DESC;
  `);

  return convertIdsInArray(result.rows, idFields) as TicketResponse[];
};

// Get ticket by ID
export const fetchTicketById = async (id: number): Promise<TicketResponse> => {
  const result = await db.query(
    `
    SELECT * FROM tickets WHERE id = $1;
  `,
    [id]
  );
  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Ticket not found",
    });
  }

  return convertIds(result.rows[0], idFields) as TicketResponse;
};

// Get tickets by user ID
export const fetchTicketsByUserId = async (
  userId: number
): Promise<TicketWithEventInfo[]> => {
  const result = await db.query(
    `
    SELECT t.*, e.title as event_title, e.start_time, e.end_time, e.location 
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    WHERE t.user_id = $1
    ORDER BY t.issued_at DESC;
  `,
    [userId]
  );

  return convertIdsInArray(result.rows, idFields) as TicketWithEventInfo[];
};

// Get tickets by event ID
export const fetchTicketsByEventId = async (
  eventId: number
): Promise<TicketWithUserInfo[]> => {
  const result = await db.query(
    `
    SELECT t.*, u.username, u.email
    FROM tickets t
    JOIN users u ON t.user_id = u.id
    WHERE t.event_id = $1
    ORDER BY t.issued_at DESC;
  `,
    [eventId]
  );

  return convertIdsInArray(result.rows, idFields) as TicketWithUserInfo[];
};

// Get ticket by ticket code
export const fetchTicketByCode = async (
  ticketCode: string
): Promise<
  TicketResponse & {
    event_title: string;
    start_time: string;
    end_time: string;
    location: string;
    username: string;
    email: string;
  }
> => {
  const result = await db.query(
    `
    SELECT t.*, e.title as event_title, e.start_time, e.end_time, e.location, u.username, u.email
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    JOIN users u ON t.user_id = u.id
    WHERE t.ticket_code = $1;
  `,
    [ticketCode]
  );
  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Ticket not found",
    });
  }

  return convertIds(result.rows[0], idFields) as TicketResponse & {
    event_title: string;
    start_time: string;
    end_time: string;
    location: string;
    username: string;
    email: string;
  };
};

// Create a new ticket
export const createTicket = async (
  ticketData: Ticket
): Promise<TicketResponse> => {
  const { event_id, user_id, registration_id, ticket_code, status } =
    ticketData;

  const result = await db.query(
    `
    INSERT INTO tickets
      (event_id, user_id, registration_id, ticket_code, status)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING *;
  `,
    [event_id, user_id, registration_id, ticket_code, status || "valid"]
  );

  return convertIds(result.rows[0], idFields) as TicketResponse;
};

// Create a ticket within a transaction
export const createTicketInTransaction = async (
  client: any,
  ticketData: Ticket
): Promise<TicketResponse> => {
  const { event_id, user_id, registration_id, ticket_code, status } =
    ticketData;

  const result = await client.query(
    `
    INSERT INTO tickets
      (event_id, user_id, registration_id, ticket_code, status)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING *;
  `,
    [event_id, user_id, registration_id, ticket_code, status || "valid"]
  );

  return convertIds(result.rows[0], idFields) as TicketResponse;
};

export const hasUserPaid = async (
  userId: number,
  eventId: number
): Promise<boolean> => {
  // Validate inputs
  if (isNaN(userId) || isNaN(eventId)) {
    return Promise.reject({
      status: 400,
      msg: "Invalid userId or eventId",
    });
  }

  // First verify that the user exists
  const { rows: users } = await db.query("SELECT id FROM users WHERE id = $1", [
    userId,
  ]);
  if (users.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "User not found",
    });
  }

  // Then verify that the event exists
  const { rows: events } = await db.query(
    "SELECT id FROM events WHERE id = $1",
    [eventId]
  );
  if (events.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Event not found",
    });
  }

  // Check if user has a valid paid ticket for this event
  const result = await db.query(
    `
    SELECT * FROM tickets 
    WHERE user_id = $1 
    AND event_id = $2 
    AND status = 'valid' 
    AND paid = true;
    `,
    [userId, eventId]
  );

  return result.rows.length > 0;
};

// Update a ticket's status
export const updateTicketStatus = async (id: number, status: string) => {
  // First check if ticket exists
  await fetchTicketById(id);

  // If marking as used, update the used_at timestamp
  if (status === "used") {
    const result = await db.query(
      `
      UPDATE tickets
      SET status = $1, used_at = NOW()
      WHERE id = $2
      RETURNING *;
      `,
      [status, id]
    );

    return convertIds(result.rows[0], idFields);
  }

  // For other status updates
  const result = await db.query(
    `
    UPDATE tickets
    SET status = $1
    WHERE id = $2
    RETURNING *;
    `,
    [status, id]
  );

  return convertIds(result.rows[0], idFields);
};

// Delete a ticket
export const deleteTicket = async (id: number) => {
  // First check if ticket exists
  await fetchTicketById(id);

  const result = await db.query(
    `
    DELETE FROM tickets
    WHERE id = $1
    RETURNING *;
    `,
    [id]
  );
  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Ticket not found",
    });
  }
  return convertIds(result.rows[0], idFields);
};

/**
 * Marks a ticket as paid
 * @param ticketId ID of the ticket to update
 * @param paid Paid status (default: true)
 * @returns Promise resolving to the updated ticket
 */
export const markTicketAsPaid = async (
  ticketId: number,
  paid: boolean = true
): Promise<TicketResponse | undefined> => {
  const queryString = `
    UPDATE tickets
    SET paid = $1, status = $2
    WHERE id = $3
    RETURNING *
  `;

  const status = paid ? "valid" : "pending_payment";
  const result = await db.query(queryString, [paid, status, ticketId]);
  return result.rows[0];
};