import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retired() {
  return NextResponse.json(
    {
      ok: false,
      error: "Este módulo foi retirado. O DroneGestor agora disponibiliza somente a Calculadora de Calda."
    },
    { status: 410 }
  );
}

export async function GET() { return retired(); }
export async function POST() { return retired(); }
export async function PUT() { return retired(); }
export async function PATCH() { return retired(); }
export async function DELETE() { return retired(); }
