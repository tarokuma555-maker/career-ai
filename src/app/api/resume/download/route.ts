import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumeDocument, CVDocument } from "@/lib/resume-pdf";
import type { GeneratedResumeData, GeneratedCVData } from "@/lib/resume-types";
import React from "react";

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const docType: "resume" | "cv" = body.docType || "resume";

  try {
    let buffer: Buffer;
    let filename: string;

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    if (docType === "resume") {
      const data = body.generatedResume as GeneratedResumeData;
      if (!data?.personalInfo) {
        return NextResponse.json({ error: "履歴書データが不正です。" }, { status: 400 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(ResumeDocument, { data }) as any;
      buffer = await renderToBuffer(element);
      filename = `履歴書_${dateStr}.pdf`;
    } else {
      const data = body.generatedCV as GeneratedCVData;
      if (!data?.workHistory) {
        return NextResponse.json({ error: "職務経歴書データが不正です。" }, { status: 400 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(CVDocument, { data }) as any;
      buffer = await renderToBuffer(element);
      filename = `職務経歴書_${dateStr}.pdf`;
    }

    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "PDF生成に失敗しました。" }, { status: 500 });
  }
}
