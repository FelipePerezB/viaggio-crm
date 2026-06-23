import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { template } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const templates = await db
            .select()
            .from(template)
            .where(eq(template.userId, session.user.id));

        return NextResponse.json({ success: true, templates });
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

        const bodyData = await request.json();
        const { name, language, category } = bodyData;

        if (!name || !language) {
            return NextResponse.json(
                { error: "name and language are required" },
                { status: 400 }
            );
        }

        const [newTemplate] = await db.insert(template).values({
            userId: session.user.id,
            name,
            language,
            category: category || 'marketing',
        }).returning();

        return NextResponse.json({
            success: true,
            template: newTemplate
        });
    } catch (error: any) {
        console.log(error)
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
            return NextResponse.json({ error: "Missing template id" }, { status: 400 });
        }

        await db.delete(template)
            .where(and(eq(template.id, id), eq(template.userId, session.user.id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
