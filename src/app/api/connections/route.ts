import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connection } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userConnections = await db
            .select()
            .from(connection)
            .where(eq(connection.userId, session.user.id));

        // Map DB format to GoogleSheetConnection interface
        const formatted = userConnections.map((c) => ({
            id: c.id,
            name: c.name,
            sheetUrl: c.url,
            sheetId: c.sheetId,
            addedAt: c.createdAt?.toISOString(),
            lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
            status: c.status,
            rowCount: c.rowCount,
            errorMsg: c.errorMsg,
        }));

        return NextResponse.json({ connections: formatted });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, sheetUrl, sheetId, addedAt, status } = body;

        const [newConn] = await db.insert(connection).values({
            id,
            name,
            url: sheetUrl,
            sheetId,
            userId: session.user.id,
            createdAt: new Date(addedAt),
            status: status || "connected",
        }).returning();

        return NextResponse.json({ success: true, connection: newConn });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, status, lastSyncAt, rowCount, errorMsg } = body;

        const [updated] = await db.update(connection)
            .set({
                status,
                lastSyncAt: lastSyncAt ? new Date(lastSyncAt) : null,
                rowCount: rowCount ?? null,
                errorMsg: errorMsg ?? null,
                updatedAt: new Date(),
            })
            .where(eq(connection.id, id))
            .returning();

        return NextResponse.json({ success: true, connection: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing connection ID" }, { status: 400 });
        }

        await db.delete(connection).where(eq(connection.id, id));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
