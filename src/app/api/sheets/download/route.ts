import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Proxy para descargar Google Sheets como XLSX
 * Evita problemas de CORS al hacer fetch server-side.
 * 
 * GET /api/sheets/download?sheetId=XXXXX
 * 
 * Descarga TODAS las hojas del spreadsheet como un archivo XLSX binario.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sheetId = searchParams.get('sheetId');

  if (!sheetId) {
    return NextResponse.json(
      { error: 'Falta el parámetro sheetId' },
      { status: 400 }
    );
  }

  // Validar que el sheetId tenga un formato razonable
  if (!/^[a-zA-Z0-9_-]+$/.test(sheetId)) {
    return NextResponse.json(
      { error: 'sheetId inválido' },
      { status: 400 }
    );
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

  try {
    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GelatoCRM/1.0)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      const statusText = response.status === 404
        ? 'Google Sheet no encontrado. Verifica que la URL sea correcta.'
        : response.status === 403
          ? 'Google Sheet no es público. Comparte la hoja con "Cualquiera con el enlace".'
          : `Error al descargar: HTTP ${response.status}`;

      return NextResponse.json(
        { error: statusText },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sheet_${sheetId}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    console.error('Error descargando Google Sheet:', err);
    return NextResponse.json(
      { error: 'Error de red al contactar Google Sheets. Intenta nuevamente.' },
      { status: 502 }
    );
  }
}
