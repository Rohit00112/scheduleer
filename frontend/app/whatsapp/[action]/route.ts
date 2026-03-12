import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError, getErrorMessage } from "@/lib/server/errors";
import {
  getWhatsAppTwiML,
  handleWhatsAppMessage,
  sendWhatsAppReply,
  validateTwilioSignature,
} from "@/lib/server/services/integrations";
import { whatsappTestSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(request: NextRequest) {
  const action = request.nextUrl.pathname.split("/").filter(Boolean).at(-1);

  try {
    if (action === "webhook") {
      const formData = await request.formData();
      const body = Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
      ) as Record<string, string>;

      if (process.env.VALIDATE_TWILIO_SIGNATURE === "true") {
        const signature = request.headers.get("x-twilio-signature") || "";
        const isValid = validateTwilioSignature(request.url, body, signature);
        if (!isValid) {
          return new Response("Forbidden", { status: 403, headers: NO_STORE_HEADERS });
        }
      }

      const from = body.From;
      const message = body.Body;
      if (!from || !message) {
        return new Response("Missing From or Body", {
          status: 400,
          headers: NO_STORE_HEADERS,
        });
      }

      const reply = await handleWhatsAppMessage(from, message);
      if (reply.length > 1500) {
        await sendWhatsAppReply(from, reply);
      }

      return new Response(getWhatsAppTwiML(reply), {
        status: 200,
        headers: {
          "Content-Type": "text/xml",
          ...NO_STORE_HEADERS,
        },
      });
    }

    if (action === "test") {
      const body = whatsappTestSchema.parse(await request.json());
      const reply = await handleWhatsAppMessage("test-user", body.message);
      return NextResponse.json(
        { reply },
        {
          headers: NO_STORE_HEADERS,
        },
      );
    }

    return NextResponse.json(
      { message: "Not Found" },
      {
        status: 404,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Invalid request", issues: error.issues },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message },
        {
          status: error.status,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    console.error(error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
