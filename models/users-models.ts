import db from "../db/connection";
import { User, EventRegistrationResponse } from "../types";

export const selectUsers = async (): Promise<{
  users: User[];
  total_users: number;
}> => {
  const usersResult = await db.query(`
    SELECT 
      u.*,
      CASE 
        WHEN COUNT(t.id) = 0 THEN '[]'::json
        ELSE json_agg(
          CASE 
            WHEN t.id IS NULL THEN NULL
            ELSE json_build_object(
              'team_id', t.id,
              'team_name', t.name,
              'team_description', t.description,
              'role', tm.role
            )
          END
        )
      END as teams
    FROM users u
    LEFT JOIN team_members tm ON u.id = tm.user_id
    LEFT JOIN teams t ON tm.team_id = t.id
    GROUP BY u.id
  `);

  const countResult = usersResult.rows.length;

  if (usersResult.rows.length === 0) {
    return Promise.reject({ status: 404, msg: "No users found" });
  }

  return {
    users: usersResult.rows as User[],
    total_users: countResult,
  };
};

export const selectUserByUsername = async (
  username: string
): Promise<User | null> => {
  const { rows } = await db.query(
    `
    SELECT 
      u.*,
      CASE 
        WHEN COUNT(t.id) = 0 THEN '[]'::json
        ELSE json_agg(
          CASE 
            WHEN t.id IS NULL THEN NULL
            ELSE json_build_object(
              'team_id', t.id,
              'team_name', t.name,
              'team_description', t.description,
              'role', tm.role
            )
          END
        )
      END as teams
    FROM users u
    LEFT JOIN team_members tm ON u.id = tm.user_id
    LEFT JOIN teams t ON tm.team_id = t.id
    WHERE u.username = $1
    GROUP BY u.id
  `,
    [username]
  );

  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
  return rows[0] as User;
};

export const selectUserByEmail = async (
  email: string
): Promise<User | null> => {
  const { rows } = await db.query(
    `
    SELECT 
      u.*,
      CASE 
        WHEN COUNT(t.id) = 0 THEN '[]'::json
        ELSE json_agg(
          CASE 
            WHEN t.id IS NULL THEN NULL
            ELSE json_build_object(
              'team_id', t.id,
              'team_name', t.name,
              'team_description', t.description,
              'role', tm.role
            )
          END
        )
      END as teams
    FROM users u
    LEFT JOIN team_members tm ON u.id = tm.user_id
    LEFT JOIN teams t ON tm.team_id = t.id
    WHERE u.email = $1
    GROUP BY u.id
  `,
    [email]
  );

  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
  return rows[0] as User;
};

export const selectUserById = async (id: number): Promise<User | null> => {
  const { rows } = await db.query(
    `
    SELECT 
      u.*,
      CASE 
        WHEN COUNT(t.id) = 0 THEN '[]'::json
        ELSE json_agg(
          CASE 
            WHEN t.id IS NULL THEN NULL
            ELSE json_build_object(
              'team_id', t.id,
              'team_name', t.name,
              'team_description', t.description,
              'role', tm.role
            )
          END
        )
      END as teams
    FROM users u
    LEFT JOIN team_members tm ON u.id = tm.user_id
    LEFT JOIN teams t ON tm.team_id = t.id
    WHERE u.id = $1
    GROUP BY u.id
  `,
    [id]
  );
  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
  return rows[0] as User;
};

export const insertUser = async (
  username: string,
  email: string,
  password_hash: string,
  profile_image_url?: string,
  team_id?: number,
  role?: string
): Promise<User> => {
  try {
    const userResult = await db.query(
      "INSERT INTO users (username, email, password_hash, profile_image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [username, email, password_hash, profile_image_url]
    );

    if (userResult.rows.length === 0) {
      return Promise.reject({ status: 404, msg: "User not found" });
    }

    const user = userResult.rows[0];

    // If team_id and role are provided, add the user to the team
    if (team_id && role) {
      await db.query(
        "INSERT INTO team_members (user_id, team_id, role) VALUES ($1, $2, $3)",
        [user.id, team_id, role]
      );
    }

    // Fetch the user with team information
    const userWithTeamResult = await db.query(
      `
      SELECT 
        u.*,
        CASE 
          WHEN COUNT(t.id) = 0 THEN '[]'::json
          ELSE json_agg(
            CASE 
              WHEN t.id IS NULL THEN NULL
              ELSE json_build_object(
                'team_id', t.id,
                'team_name', t.name,
                'team_description', t.description,
                'role', tm.role
              )
            END
          )
        END as teams
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN teams t ON tm.team_id = t.id
      WHERE u.id = $1
      GROUP BY u.id
    `,
      [user.id]
    );

    if (userWithTeamResult.rows.length === 0) {
      return Promise.reject({ status: 404, msg: "User not found" });
    }

    return userWithTeamResult.rows[0];
  } catch (error) {
    throw error;
  }
};

export const updateUser = async (
  id: number,
  updates: Partial<User>,
  teamUpdates?: { team_id: number; role: string }[]
): Promise<User> => {
  try {
    const updateEntries = Object.entries(updates);
    if (updateEntries.length > 0) {
      const setClause = updateEntries
        .map(([field], index) => `${field} = $${index + 1}`)
        .join(", ");

      const values: any[] = updateEntries.map(([_, value]) => value);

      // Add ID as the last parameter
      values.push(id);

      const query = `
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *
      `;

      const { rows } = await db.query(query, values);

      if (rows.length === 0) {
        return Promise.reject({ status: 404, msg: "User not found" });
      }
    }

    // Handle team membership updates if provided
    if (teamUpdates && teamUpdates.length > 0) {
      // First, remove all existing team memberships
      await db.query("DELETE FROM team_members WHERE user_id = $1", [id]);

      // Then add the new team memberships
      for (const teamUpdate of teamUpdates) {
        await db.query(
          "INSERT INTO team_members (user_id, team_id, role) VALUES ($1, $2, $3)",
          [id, teamUpdate.team_id, teamUpdate.role]
        );
      }
    }

    // Fetch the updated user with team information
    const userWithTeamResult = await db.query(
      `
      SELECT 
        u.*,
        CASE 
          WHEN COUNT(t.id) = 0 THEN '[]'::json
          ELSE json_agg(
            CASE 
              WHEN t.id IS NULL THEN NULL
              ELSE json_build_object(
                'team_id', t.id,
                'team_name', t.name,
                'team_description', t.description,
                'role', tm.role
              )
            END
          )
        END as teams
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN teams t ON tm.team_id = t.id
      WHERE u.id = $1
      GROUP BY u.id
    `,
      [id]
    );

    return userWithTeamResult.rows[0];
  } catch (error) {
    throw error;
  }
};

export const deleteUser = async (id: number): Promise<void> => {
  const { rows } = await db.query(
    "DELETE FROM users WHERE id = $1 RETURNING *",
    [id]
  );

  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
};

export const selectUserEventRegistrations = async (
  userId: number
): Promise<EventRegistrationResponse[]> => {
  const { rows } = await db.query(
    `
    SELECT 
      er.*,
      e.title as event_title,
      e.description as event_description,
      e.location as event_location,
      e.start_time,
      e.end_time,
      e.status as event_status,
      t.name as team_name
    FROM event_registrations er
    JOIN events e ON er.event_id = e.id
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE er.user_id = $1
    ORDER BY e.start_time DESC
    `,
    [userId]
  );

  return rows.map((registration) => ({
    ...registration,
    id: Number(registration.id),
    event_id: Number(registration.event_id),
    user_id: Number(registration.user_id),
  })) as EventRegistrationResponse[];
};