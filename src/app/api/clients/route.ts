import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { client } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { uuidv4 } from "better-auth";

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userClients = await db
            .select()
            .from(client)
            .where(eq(client.userId, session.user.id));

        return NextResponse.json({ success: true, clients: userClients });
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
        const { name, phone, status, notes } = body;

        const now = new Date();

        const [newClient] = await db.insert(client).values({
            name,
            phone,
            status: status || null,
            notes: notes || null,
            userId: session.user.id,
        }).returning();

        return NextResponse.json({ success: true, client: newClient });
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
        const name = searchParams.get("name");

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        await db.delete(client)
            .where(eq(client.name, name));

        return NextResponse.json({ success: true });
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
        const { name, phone, status, notes } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required to update" }, { status: 400 });
        }

        const [updatedClient] = await db.update(client)
            .set({
                phone,
                ...(status !== undefined && { status }),
                ...(notes !== undefined && { notes })
            })
            .where(eq(client.name, name))
            .returning();

        return NextResponse.json({ success: true, client: updatedClient });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
