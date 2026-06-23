import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone, templateName, components } = await req.json();

    if (!phone || !templateName) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros: phone o templateName' }, { status: 400 });
    }

    // Estas variables DEBEN configurarse en un archivo .env.local en la raíz del proyecto
    const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    console.log(WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, templateName)
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return NextResponse.json({
        success: false,
        error: 'Faltan configurar las variables de entorno WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID. Por favor añádelas al archivo .env.local'
      }, { status: 500 });
    }

    // Limpiar el teléfono para que sea compatible con Meta (ej: quitar el +, espacios, guiones)
    const cleanPhone = phone.replace(/\D/g, '');

    // Construcción del payload de Meta Cloud API
    const payload = {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en"// Asumimos español como idioma de la plantilla
        },
        components: components || []
      }
    };

    const response = await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error desde Meta API:', data);
      return NextResponse.json({
        success: false,
        error: data.error?.message || 'Error desconocido de la API de Meta'
      }, { status: response.status });
    }

    return NextResponse.json({ success: true, metaResponse: data });

  } catch (error: any) {
    console.error('Error enviando WhatsApp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
