import { pgTable, text, timestamp, boolean, integer, date, index, primaryKey, serial, uuid } from "drizzle-orm/pg-core";

// ─── Better-Auth tables ──────────────────────────────────────
// These are required by better-auth for session management.
// The column names use snake_case to match better-auth defaults.

export const users = pgTable("users", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const sessions = pgTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
    },
    (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
    "accounts",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
    "verifications",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// ─── App-specific tables ─────────────────────────────────────
// Connection and client tables reference users.id (text) from better-auth.

export const connection = pgTable("connections", {
    id: text("id").primaryKey(),
    url: text().notNull(),
    name: text().notNull(),
    sheetId: text("sheet_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastSyncAt: timestamp("last_sync_at"),
    status: text().notNull().default("connected"),
    rowCount: integer("row_count"),
    errorMsg: text("error_msg"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const dataRules = pgTable("data_rules", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ruleType: text("rule_type").notNull(), // 'replace' | 'stop_word'
    columnName: text("column_name"),       // only for 'replace' (e.g. 'location', 'client')
    matchValue: text("match_value").notNull(),
    newValue: text("new_value"),           // only for 'replace'
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    index("data_rules_user_id_idx").on(table.userId),
    index("data_rules_type_idx").on(table.userId, table.ruleType),
]);

export const client = pgTable("clients", {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    phone: text().notNull(),
    status: text(),
    notes: text(),
    createdAt: date("created_at").defaultNow(),
    updatedAt: date("updated_at").defaultNow(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const template = pgTable("templates", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    language: text("language").notNull(),
    category: text("category").default("marketing").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    index("templates_user_id_idx").on(table.userId),
]);