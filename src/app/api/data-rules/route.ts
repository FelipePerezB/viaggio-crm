import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dataRules } from "@/db/schema";
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

        const rules = await db
            .select()
            .from(dataRules)
            .where(eq(dataRules.userId, session.user.id));

        const formatted = rules.map((r) => ({
            id: r.id,
            ruleType: r.ruleType,
            columnName: r.columnName,
            matchValue: r.matchValue,
            newValue: r.newValue,
        }));

        return NextResponse.json({ success: true, rules: formatted });
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
        const { ruleType, columnName, matchValue, newValue } = body;

        if (!ruleType || !matchValue) {
            return NextResponse.json(
                { error: "ruleType and matchValue are required" },
                { status: 400 }
            );
        }

        const [newRule] = await db.insert(dataRules).values({
            userId: session.user.id,
            ruleType,
            columnName: columnName || null,
            matchValue,
            newValue: newValue || null,
        }).returning();

        return NextResponse.json({
            success: true,
            rule: {
                id: newRule.id,
                ruleType: newRule.ruleType,
                columnName: newRule.columnName,
                matchValue: newRule.matchValue,
                newValue: newRule.newValue,
            }
        });
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
        const { id, matchValue, newValue } = body;

        if (!id) {
            return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
        }

        const [updated] = await db.update(dataRules)
            .set({
                matchValue,
                newValue: newValue ?? null,
            })
            .where(and(eq(dataRules.id, id), eq(dataRules.userId, session.user.id)))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            rule: {
                id: updated.id,
                ruleType: updated.ruleType,
                columnName: updated.columnName,
                matchValue: updated.matchValue,
                newValue: updated.newValue,
            }
        });
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
            return NextResponse.json({ error: "Missing rule id" }, { status: 400 });
        }

        await db.delete(dataRules)
            .where(and(eq(dataRules.id, id), eq(dataRules.userId, session.user.id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
